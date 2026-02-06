"""
Audio recording module - Core Audio Tap system audio capture.

Captures system audio via a Swift helper binary using IPC (subprocess).
All audio stays in memory and is never written to disk.
"""

import subprocess
import threading
import struct
import json
import sys
import numpy as np
from pathlib import Path
from typing import Optional, Callable, List
from dataclasses import dataclass


def _debug(msg: str) -> None:
    """Print debug message to stderr to avoid corrupting IPC stdout."""
    print(msg, file=sys.stderr, flush=True)


@dataclass
class AudioConfig:
    """Configuration for audio capture."""
    sample_rate: int = 16000  # Target sample rate for Whisper


class CoreAudioTapRecorder:
    """macOS native system audio capture using Core Audio Taps via Swift helper."""

    def __init__(self, config: AudioConfig = AudioConfig(),
                 on_error: Optional[Callable[[str], None]] = None,
                 on_warning: Optional[Callable[[str], None]] = None):
        self._config = config
        self._on_error = on_error
        self._on_warning = on_warning
        self._helper_path = Path(__file__).parent / "bin" / "courier-audio-helper"

        # Process and threading
        self._process: Optional[subprocess.Popen] = None
        self._audio_thread: Optional[threading.Thread] = None
        self._control_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._ready_event = threading.Event()

        # Audio buffer
        self._audio_chunks: List[np.ndarray] = []
        self._lock = threading.Lock()

        # State
        self._actual_sample_rate: Optional[float] = None
        self._channels: int = 1
        self._total_samples: int = 0
        self._microphone_active: bool = False

    @property
    def microphone_active(self) -> bool:
        """Whether microphone is being captured (for UI indication)."""
        return self._microphone_active

    def start(self) -> None:
        """Start capturing system audio."""
        if not self._helper_path.exists():
            if self._on_error:
                self._on_error("Audio helper not found. Please run build_helper.sh")
            return

        self._stop_event.clear()
        self._ready_event.clear()
        self._audio_chunks = []
        self._total_samples = 0
        self._actual_sample_rate = None

        # Spawn Swift helper process
        try:
            self._process = subprocess.Popen(
                [str(self._helper_path)],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=0  # Unbuffered
            )
        except OSError as e:
            if self._on_error:
                self._on_error(f"Failed to start audio helper: {e}")
            return

        # Start reader threads
        self._control_thread = threading.Thread(
            target=self._control_reader, daemon=True
        )
        self._audio_thread = threading.Thread(
            target=self._audio_reader, daemon=True
        )
        self._control_thread.start()
        self._audio_thread.start()

        # Wait for helper to signal ready
        if not self._ready_event.wait(timeout=5.0):
            self._cleanup()
            if self._on_error:
                self._on_error("Audio helper did not become ready")
            return

        # Send start command
        self._send_command({
            "command": "start",
            "sampleRate": self._config.sample_rate
        })

    def stop(self) -> np.ndarray:
        """Stop capturing and return audio as numpy array."""
        if not self._process:
            return np.array([], dtype=np.float32)

        # Send stop command
        self._send_command({"command": "stop"})

        # Wait with timeout
        if not self._stop_event.wait(timeout=5.0):
            if self._on_error:
                self._on_error("Audio helper didn't respond to stop command")
            self._force_kill()

        # Terminate helper process
        self._cleanup()

        # Collect whatever audio we have (best-effort)
        return self._collect_audio()

    def _collect_audio(self) -> np.ndarray:
        """Concatenate buffered audio chunks, downmix to mono, and resample."""
        with self._lock:
            if not self._audio_chunks:
                return np.array([], dtype=np.float32)
            audio = np.concatenate(self._audio_chunks)

        # Downmix interleaved stereo to mono
        if self._channels > 1:
            # Trim to multiple of channel count
            trim = len(audio) - (len(audio) % self._channels)
            audio = audio[:trim].reshape(-1, self._channels).mean(axis=1).astype(np.float32)

        # Resample if needed
        if self._actual_sample_rate and self._actual_sample_rate != self._config.sample_rate:
            audio = self._resample(audio, self._actual_sample_rate, self._config.sample_rate)

        duration = len(audio) / self._config.sample_rate
        _debug(f"Captured {duration:.1f} seconds of system audio")

        return audio

    def _force_kill(self) -> None:
        """Force kill the helper process."""
        if self._process:
            try:
                self._process.kill()
                self._process.wait(timeout=2.0)
            except Exception:
                pass
            finally:
                self._process = None

    def __del__(self):
        """Cleanup on garbage collection."""
        self._cleanup()

    def _cleanup(self) -> None:
        """Ensure helper process is terminated."""
        if self._process:
            try:
                self._process.terminate()
                self._process.wait(timeout=2.0)
            except subprocess.TimeoutExpired:
                self._process.kill()
                self._process.wait()
            except Exception:
                pass
            finally:
                self._process = None

    def _send_command(self, command: dict) -> None:
        """Send JSON command to Swift helper via stdin."""
        if not self._process or not self._process.stdin:
            return

        try:
            line = json.dumps(command) + "\n"
            self._process.stdin.write(line.encode())
            self._process.stdin.flush()
        except (BrokenPipeError, OSError):
            if self._on_error:
                self._on_error("Lost connection to audio helper")
            self._stop_event.set()

    def _control_reader(self) -> None:
        """Read JSON control messages from stdout."""
        try:
            while self._process and not self._stop_event.is_set():
                line = self._process.stdout.readline()
                if not line:
                    # Helper process exited unexpectedly
                    returncode = self._process.poll() if self._process else None
                    if returncode is not None and returncode != 0:
                        if self._on_error:
                            self._on_error(f"Audio helper crashed (exit code: {returncode})")
                    self._stop_event.set()
                    break

                try:
                    msg = json.loads(line.decode().strip())
                    self._handle_control_message(msg)
                except json.JSONDecodeError:
                    continue
        except Exception as e:
            if self._on_error:
                self._on_error(f"Control reader error: {e}")
            self._stop_event.set()

    def _handle_control_message(self, msg: dict) -> None:
        """Handle a control message from the Swift helper."""
        msg_type = msg.get("type")

        if msg_type == "ready":
            self._ready_event.set()
        elif msg_type == "started":
            self._actual_sample_rate = msg.get("actualSampleRate")
            self._channels = msg.get("channels", 2)
            self._microphone_active = msg.get("microphoneActive", False)
        elif msg_type == "stopped":
            self._total_samples = msg.get("totalSamples", 0)
            self._stop_event.set()
        elif msg_type == "warning":
            # Non-fatal warning (e.g., microphone unavailable)
            warning_code = msg.get("code", "UNKNOWN")
            warning_message = msg.get("message", "Unknown warning")
            _debug(f"[Courier] Warning ({warning_code}): {warning_message}")
            # Don't set stop_event - recording continues
            if self._on_warning:
                self._on_warning(warning_message)
        elif msg_type == "error":
            error_code = msg.get("code", "UNKNOWN")
            error_message = msg.get("message", "Unknown error")

            if error_code == "PERMISSION_DENIED":
                error_message = "Audio capture permission denied. Please grant in System Settings."
            elif error_code == "DEVICE_ERROR":
                error_message = "Failed to create audio capture device."

            if self._on_error:
                self._on_error(error_message)
            self._stop_event.set()

    def _audio_reader(self) -> None:
        """Read binary audio data from stderr."""
        try:
            while self._process and not self._stop_event.is_set():
                # Read 4-byte size prefix (big-endian uint32)
                size_bytes = self._read_exact(self._process.stderr, 4)
                if not size_bytes:
                    break

                chunk_size = struct.unpack(">I", size_bytes)[0]

                # Sanity check: skip empty or unreasonably large chunks
                # Max ~10 seconds at 48kHz float32 mono
                if chunk_size == 0 or chunk_size > 48000 * 4 * 10:
                    continue

                # Read audio data
                audio_bytes = self._read_exact(self._process.stderr, chunk_size)
                if not audio_bytes:
                    break

                # Verify float32 alignment
                if len(audio_bytes) % 4 != 0:
                    continue

                # Convert to numpy float32 array
                chunk = np.frombuffer(audio_bytes, dtype=np.float32)

                with self._lock:
                    self._audio_chunks.append(chunk)
        except Exception as e:
            if self._on_error:
                self._on_error(f"Audio reader error: {e}")

    @staticmethod
    def _read_exact(stream, n: int) -> Optional[bytes]:
        """Read exactly n bytes from stream."""
        data = b""
        while len(data) < n:
            chunk = stream.read(n - len(data))
            if not chunk:
                return None
            data += chunk
        return data

    @staticmethod
    def _resample(audio: np.ndarray, orig_sr: float, target_sr: float) -> np.ndarray:
        """Resample audio with proper anti-aliasing filter."""
        if orig_sr == target_sr:
            return audio
        from math import gcd
        from scipy.signal import resample_poly

        # Compute integer up/down factors
        orig = int(orig_sr)
        target = int(target_sr)
        divisor = gcd(orig, target)
        up = target // divisor
        down = orig // divisor

        return resample_poly(audio, up, down).astype(np.float32)

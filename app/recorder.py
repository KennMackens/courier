"""
Audio recording module - Core Audio Tap system audio capture.

Captures system audio via a Swift helper binary using IPC (subprocess).
All audio stays in memory and is never written to disk.
"""

import subprocess
import threading
import struct
import json
import numpy as np
from pathlib import Path
from typing import Optional, Callable, List
from dataclasses import dataclass


@dataclass
class AudioConfig:
    """Configuration for audio capture."""
    sample_rate: int = 16000  # Target sample rate for Whisper


class CoreAudioTapRecorder:
    """macOS native system audio capture using Core Audio Taps via Swift helper."""

    def __init__(self, config: AudioConfig = AudioConfig(),
                 on_error: Optional[Callable[[str], None]] = None):
        self._config = config
        self._on_error = on_error
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
        self._total_samples: int = 0

    def start(self) -> None:
        """Start capturing system audio."""
        if not self._helper_path.exists():
            raise FileNotFoundError(f"Audio helper not found: {self._helper_path}")

        self._stop_event.clear()
        self._ready_event.clear()
        self._audio_chunks = []
        self._total_samples = 0
        self._actual_sample_rate = None

        # Spawn Swift helper process
        self._process = subprocess.Popen(
            [str(self._helper_path)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            bufsize=0  # Unbuffered
        )

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
            raise TimeoutError("Audio helper did not become ready")

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

        # Wait for "stopped" response
        self._stop_event.wait(timeout=5.0)

        # Terminate helper process
        self._cleanup()

        # Concatenate audio chunks
        with self._lock:
            if not self._audio_chunks:
                return np.array([], dtype=np.float32)
            audio = np.concatenate(self._audio_chunks)

        # Resample if needed
        if self._actual_sample_rate and self._actual_sample_rate != self._config.sample_rate:
            audio = self._resample(audio, self._actual_sample_rate, self._config.sample_rate)

        duration = len(audio) / self._config.sample_rate
        print(f"Captured {duration:.1f} seconds of system audio")

        return audio

    def _cleanup(self) -> None:
        """Terminate the helper process."""
        if self._process:
            try:
                self._process.terminate()
                self._process.wait(timeout=3.0)
            except (subprocess.TimeoutExpired, OSError):
                self._process.kill()
            self._process = None

    def _send_command(self, command: dict) -> None:
        """Send JSON command to Swift helper via stdin."""
        if self._process and self._process.stdin:
            try:
                line = json.dumps(command) + "\n"
                self._process.stdin.write(line.encode())
                self._process.stdin.flush()
            except (BrokenPipeError, OSError):
                if self._on_error:
                    self._on_error("Lost connection to audio helper")

    def _control_reader(self) -> None:
        """Read JSON control messages from stdout."""
        try:
            while self._process and not self._stop_event.is_set():
                line = self._process.stdout.readline()
                if not line:
                    break  # EOF - helper exited

                try:
                    msg = json.loads(line.decode().strip())
                    self._handle_control_message(msg)
                except json.JSONDecodeError:
                    continue
        except Exception as e:
            if self._on_error:
                self._on_error(f"Control reader error: {e}")

    def _handle_control_message(self, msg: dict) -> None:
        """Handle a control message from the Swift helper."""
        msg_type = msg.get("type")

        if msg_type == "ready":
            self._ready_event.set()
        elif msg_type == "started":
            self._actual_sample_rate = msg.get("actualSampleRate")
        elif msg_type == "stopped":
            self._total_samples = msg.get("totalSamples", 0)
            self._stop_event.set()
        elif msg_type == "error":
            if self._on_error:
                self._on_error(msg.get("message", "Unknown error"))

    def _audio_reader(self) -> None:
        """Read binary audio data from stderr."""
        try:
            while self._process and not self._stop_event.is_set():
                # Read 4-byte size prefix (big-endian uint32)
                size_bytes = self._read_exact(self._process.stderr, 4)
                if not size_bytes:
                    break

                chunk_size = struct.unpack(">I", size_bytes)[0]

                # Read audio data
                audio_bytes = self._read_exact(self._process.stderr, chunk_size)
                if not audio_bytes:
                    break

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

    def _resample(self, audio: np.ndarray, orig_sr: float, target_sr: float) -> np.ndarray:
        """Resample audio using linear interpolation."""
        if orig_sr == target_sr:
            return audio
        ratio = target_sr / orig_sr
        new_length = int(len(audio) * ratio)
        indices = np.linspace(0, len(audio) - 1, new_length)
        return np.interp(indices, np.arange(len(audio)), audio).astype(np.float32)

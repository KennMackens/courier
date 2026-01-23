"""
Audio recording module - simple buffered recording.

Records audio to memory buffer for post-meeting transcription.
"""

import threading
import numpy as np
import sounddevice as sd
from typing import Optional, Callable
from dataclasses import dataclass


@dataclass
class AudioConfig:
    """Configuration for audio recording."""
    sample_rate: int = 16000  # 16kHz for Whisper
    channels: int = 1


class AudioRecorder:
    """
    Simple audio recorder that buffers audio in memory.

    Records from a single input device and stores all audio
    for batch transcription after recording stops.
    """

    def __init__(
        self,
        device_index: int,
        config: Optional[AudioConfig] = None,
        on_error: Optional[Callable[[str], None]] = None
    ):
        self.device_index = device_index
        self.config = config or AudioConfig()
        self.on_error = on_error

        # Get device's native sample rate
        device_info = sd.query_devices(device_index)
        self._device_sample_rate = int(device_info['default_samplerate'])
        print(f"Recording device: {device_info['name']} at {self._device_sample_rate} Hz")

        # Threading control
        self._stop_event = threading.Event()
        self._recording_thread: Optional[threading.Thread] = None

        # Audio buffer
        self._audio_chunks: list[np.ndarray] = []
        self._lock = threading.Lock()

        # Stream reference
        self._stream: Optional[sd.InputStream] = None

    def _audio_callback(self, indata: np.ndarray, frames: int, time_info, status):
        """Callback for audio input - just buffer the data."""
        if status:
            print(f"Audio status: {status}")

        # Convert to mono if needed
        audio = indata[:, 0] if indata.ndim > 1 else indata.flatten()
        audio = audio.astype(np.float32)

        with self._lock:
            self._audio_chunks.append(audio.copy())

    def _recording_loop(self):
        """Main recording loop."""
        try:
            self._stream = sd.InputStream(
                device=self.device_index,
                channels=1,
                samplerate=self._device_sample_rate,
                blocksize=int(self._device_sample_rate * 0.1),  # 100ms blocks
                callback=self._audio_callback,
                dtype=np.float32
            )

            self._stream.start()
            print("Recording started...")

            while not self._stop_event.is_set():
                self._stop_event.wait(timeout=0.1)

            print("Recording stopped.")

        except Exception as e:
            error_msg = f"Recording error: {e}"
            print(error_msg)
            if self.on_error:
                self.on_error(error_msg)
        finally:
            if self._stream:
                self._stream.stop()
                self._stream.close()
                self._stream = None

    def start(self):
        """Start recording."""
        if self._recording_thread and self._recording_thread.is_alive():
            return

        self._stop_event.clear()

        # Clear buffer
        with self._lock:
            self._audio_chunks.clear()

        self._recording_thread = threading.Thread(target=self._recording_loop, daemon=True)
        self._recording_thread.start()

    def stop(self) -> np.ndarray:
        """Stop recording and return the complete audio buffer."""
        self._stop_event.set()
        if self._recording_thread:
            self._recording_thread.join(timeout=2.0)
            self._recording_thread = None

        # Concatenate all chunks and resample to 16kHz for Whisper
        with self._lock:
            if not self._audio_chunks:
                return np.array([], dtype=np.float32)

            audio = np.concatenate(self._audio_chunks)
            self._audio_chunks.clear()

        # Resample if needed
        if self._device_sample_rate != self.config.sample_rate:
            audio = self._resample(audio, self._device_sample_rate, self.config.sample_rate)

        duration = len(audio) / self.config.sample_rate
        print(f"Recorded {duration:.1f} seconds of audio")

        return audio

    def _resample(self, audio: np.ndarray, orig_sr: int, target_sr: int) -> np.ndarray:
        """Resample audio using linear interpolation."""
        if orig_sr == target_sr:
            return audio

        ratio = target_sr / orig_sr
        new_length = int(len(audio) * ratio)
        indices = np.linspace(0, len(audio) - 1, new_length)
        resampled = np.interp(indices, np.arange(len(audio)), audio)

        return resampled.astype(np.float32)

    def is_recording(self) -> bool:
        """Check if currently recording."""
        return self._recording_thread is not None and self._recording_thread.is_alive()

    def get_duration(self) -> float:
        """Get current recording duration in seconds."""
        with self._lock:
            total_samples = sum(len(c) for c in self._audio_chunks)
        return total_samples / self._device_sample_rate

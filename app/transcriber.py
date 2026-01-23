"""
Transcription module using faster-whisper.

Simple batch transcription - transcribes complete audio after recording.
"""

import threading
import numpy as np
from typing import Optional, Callable
from dataclasses import dataclass

from faster_whisper import WhisperModel


# Available Whisper models (larger = better quality, slower)
WHISPER_MODELS = [
    ("tiny", "Tiny (fastest, English only)"),
    ("base", "Base (fast, English best)"),
    ("small", "Small (good multilingual)"),
    ("medium", "Medium (better multilingual)"),
    ("large-v3", "Large v3 (best quality, slowest)"),
]


@dataclass
class TranscriberConfig:
    """Configuration for the transcriber."""
    model_size: str = "medium"  # Use medium for good Dutch support
    language: str = "en"
    beam_size: int = 5


def get_compute_device() -> tuple[str, str]:
    """Detect the best available compute device."""
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda", "float16"
    except ImportError:
        pass

    # CPU with int8 quantization
    return "cpu", "int8"


class Transcriber:
    """
    Batch transcriber using faster-whisper.

    Transcribes complete audio recordings (not real-time).
    """

    def __init__(self, config: Optional[TranscriberConfig] = None):
        self.config = config or TranscriberConfig()
        self._model: Optional[WhisperModel] = None
        self._model_loaded_for: Optional[str] = None  # Track which model is loaded

    def _load_model(self):
        """Load the Whisper model if not already loaded."""
        if self._model is not None and self._model_loaded_for == self.config.model_size:
            return  # Already loaded

        device, compute_type = get_compute_device()
        print(f"Loading Whisper model '{self.config.model_size}' on {device} ({compute_type})...")
        print(f"Language: {self.config.language}")

        self._model = WhisperModel(
            self.config.model_size,
            device=device,
            compute_type=compute_type
        )
        self._model_loaded_for = self.config.model_size
        print("Model loaded successfully.")

    def transcribe(self, audio: np.ndarray) -> str:
        """
        Transcribe audio array to text.

        Args:
            audio: Audio data as float32 numpy array (16kHz, mono)

        Returns:
            Transcribed text
        """
        if len(audio) == 0:
            return ""

        self._load_model()

        # Ensure correct format
        audio = audio.astype(np.float32)

        # Normalize if needed
        max_val = np.abs(audio).max()
        if max_val > 1.0:
            audio = audio / max_val

        print(f"Transcribing {len(audio) / 16000:.1f} seconds of audio...")

        segments, info = self._model.transcribe(
            audio,
            language=self.config.language,
            beam_size=self.config.beam_size,
            vad_filter=True,
            vad_parameters=dict(threshold=0.5)
        )

        # Collect all segment texts
        texts = []
        for segment in segments:
            text = segment.text.strip()
            if text:
                texts.append(text)

        result = " ".join(texts)
        print(f"Transcription complete: {len(result)} characters")

        return result

    def transcribe_async(
        self,
        audio: np.ndarray,
        on_complete: Callable[[str], None],
        on_error: Optional[Callable[[str], None]] = None
    ):
        """
        Transcribe audio in a background thread.

        Args:
            audio: Audio data
            on_complete: Callback with transcription result
            on_error: Optional error callback
        """
        def _transcribe_thread():
            try:
                result = self.transcribe(audio)
                on_complete(result)
            except Exception as e:
                print(f"Transcription error: {e}")
                if on_error:
                    on_error(str(e))

        thread = threading.Thread(target=_transcribe_thread, daemon=True)
        thread.start()

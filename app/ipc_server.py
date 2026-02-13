"""
IPC Server for Electron <-> Python communication.

This module provides the entry point for the Python backend when running
under Electron. It replaces the CustomTkinter GUI with a JSON-RPC interface.

Usage:
    python -m app.ipc_server
"""

import sys
import os
import subprocess
import threading
import numpy as np
from pathlib import Path
from typing import Optional, Dict, Any
from dataclasses import dataclass


def _debug(msg: str) -> None:
    """Print debug message to stderr to avoid corrupting IPC stdout."""
    print(f"[IPC] {msg}", file=sys.stderr, flush=True)


from .ipc_protocol import (
    IPCReader, IPCWriter, Request, ErrorCode
)
from .recorder import CoreAudioTapRecorder, AudioConfig
from .transcriber import Transcriber, TranscriberConfig, WHISPER_MODELS
from .mlx_inference import MLXConfig, MLXNotesGenerator, DEFAULT_MLX_MODEL
from .model_manager import ModelManager, DownloadProgress
from .constants import (
    SUPPORTED_TRANSCRIPTION_LANGUAGE,
    SUPPORTED_ENHANCEMENT_MODEL_ID,
)

SUPPORTED_PERFORMANCE_MODES = ("balanced", "low_cpu")
ENHANCEMENT_ENABLED = False
PERFORMANCE_PRESETS = {
    "balanced": {
        "beam_size": 5,
        "cpu_threads": 4,
        "enhance_cpu_threads": 2,
        "enhance_temperature": 0.2,
        "enhance_top_p": 0.8,
        "enhance_max_tokens": 900,
        "enhance_chunk_window_minutes": 10,
        "enhance_chunk_min_duration_minutes": 15,
        "enhance_chunk_max_count": 24,
        "enhance_chunk_retry_attempts": 1,
        "enhance_transcript_char_limit": 40000,
    },
    "low_cpu": {
        "beam_size": 2,
        "cpu_threads": 2,
        "enhance_cpu_threads": 1,
        "enhance_temperature": 0.15,
        "enhance_top_p": 0.75,
        "enhance_max_tokens": 320,
        "enhance_chunk_window_minutes": 20,
        "enhance_chunk_min_duration_minutes": 20,
        "enhance_chunk_max_count": 16,
        "enhance_chunk_retry_attempts": 1,
        "enhance_transcript_char_limit": 18000,
    },
}


@dataclass
class Settings:
    """Application settings."""
    language: str = SUPPORTED_TRANSCRIPTION_LANGUAGE
    whisper_model: str = "medium"
    mlx_model: str = DEFAULT_MLX_MODEL
    recording_threshold: int = 30  # Minimum recording duration in seconds
    performance_mode: str = "low_cpu"


class IPCServer:
    """
    Main IPC server for handling Electron requests.

    Manages recording, transcription, and note enhancement operations.
    """

    VERSION = "1.0.0"

    def __init__(self):
        self.reader = IPCReader()
        self.writer = IPCWriter()

        # State
        self.settings = Settings()
        self.recorder: Optional[CoreAudioTapRecorder] = None
        self.transcriber: Optional[Transcriber] = None
        self.audio_buffer: Optional[np.ndarray] = None
        self.transcript: str = ""
        self.transcript_segments: list[dict[str, float | str]] = []

        # Pending streaming operations
        self._pending_transcription: Optional[str] = None
        self._pending_enhancement: Optional[str] = None
        self._mlx_notes_generator: Optional[MLXNotesGenerator] = None

        # Model manager for MLX models
        self._model_manager = ModelManager()

        # Check if MLX model is available
        self._mlx_model_path = self._model_manager.get_model_path(DEFAULT_MLX_MODEL)

        # Path to Swift helper - use env var when bundled (set by Electron)
        bundled_helper = os.environ.get("OTTO_AUDIO_HELPER")
        if bundled_helper:
            self._helper_path = Path(bundled_helper)
        else:
            self._helper_path = Path(__file__).parent / "bin" / "courier-audio-helper"

        # Method handlers
        self._handlers: Dict[str, callable] = {
            "initialize": self._handle_initialize,
            "shutdown": self._handle_shutdown,
            "getSettings": self._handle_get_settings,
            "setSettings": self._handle_set_settings,
            "checkPermission": self._handle_check_permission,
            "startRecording": self._handle_start_recording,
            "stopRecording": self._handle_stop_recording,
            "transcribe": self._handle_transcribe,
            "enhanceNotes": self._handle_enhance_notes,
            "resetSession": self._handle_reset_session,
            # Model management
            "downloadModel": self._handle_download_model,
            "cancelDownload": self._handle_cancel_download,
            "isModelDownloaded": self._handle_is_model_downloaded,
            "getModelStatus": self._handle_get_model_status,
            "deleteModel": self._handle_delete_model,
            "getAvailableModels": self._handle_get_available_models,
            "getDownloadedModels": self._handle_get_downloaded_models,
        }

    def run(self):
        """Main IPC loop - reads from stdin, writes to stdout."""
        # Send ready notification
        self.writer.send_notification("ready", {
            "version": self.VERSION,
            "pythonVersion": sys.version
        })

        # Process requests
        for request in self.reader:
            try:
                self._handle_request(request)
            except Exception as e:
                self.writer.send_error(
                    request.id,
                    ErrorCode.INTERNAL_ERROR,
                    f"Unhandled error: {e}"
                )

    def _handle_request(self, request: Request):
        """Route request to appropriate handler."""
        handler = self._handlers.get(request.method)
        if handler:
            try:
                handler(request)
            except Exception as e:
                self.writer.send_error(
                    request.id,
                    ErrorCode.INTERNAL_ERROR,
                    str(e)
                )
        else:
            self.writer.send_error(
                request.id,
                ErrorCode.METHOD_NOT_FOUND,
                f"Method not found: {request.method}"
            )

    def _is_supported_language(self, language: Any) -> bool:
        return language == SUPPORTED_TRANSCRIPTION_LANGUAGE

    def _is_supported_enhancement_model(self, model_id: Any) -> bool:
        return model_id == SUPPORTED_ENHANCEMENT_MODEL_ID

    def _is_supported_performance_mode(self, mode: Any) -> bool:
        return mode in SUPPORTED_PERFORMANCE_MODES

    def _get_performance_preset(self) -> dict[str, int]:
        return PERFORMANCE_PRESETS.get(self.settings.performance_mode, PERFORMANCE_PRESETS["balanced"])

    def _apply_runtime_thread_limit(self, cpu_threads: int) -> None:
        cpu_threads = max(1, int(cpu_threads))
        thread_limit_envs = [
            "OMP_NUM_THREADS",
            "OPENBLAS_NUM_THREADS",
            "MKL_NUM_THREADS",
            "VECLIB_MAXIMUM_THREADS",
            "NUMEXPR_NUM_THREADS",
            "BLIS_NUM_THREADS",
            "OTTO_CPU_THREAD_LIMIT",
        ]
        for key in thread_limit_envs:
            os.environ[key] = str(cpu_threads)

        try:
            import torch
            torch.set_num_threads(cpu_threads)
        except Exception:
            pass

    # --- Basic handlers ---

    def _handle_initialize(self, request: Request):
        """Handle initialize request."""
        self.writer.send_result(request.id, {
            "ready": True,
            "version": self.VERSION,
            "pythonVersion": sys.version,
            "helperAvailable": self._helper_path.exists()
        })

    def _handle_shutdown(self, request: Request):
        """Handle shutdown request."""
        # Clean up any active recording
        if self.recorder:
            try:
                self.recorder.stop()
            except Exception:
                pass
            self.recorder = None

        # Stop any active enhancement
        if self._mlx_notes_generator:
            self._mlx_notes_generator.stop()
            self._mlx_notes_generator = None

        self.writer.send_result(request.id, {"ok": True})
        sys.exit(0)

    def _handle_get_settings(self, request: Request):
        """Return current settings."""
        self.settings.language = SUPPORTED_TRANSCRIPTION_LANGUAGE
        if not self._is_supported_enhancement_model(self.settings.mlx_model):
            self.settings.mlx_model = SUPPORTED_ENHANCEMENT_MODEL_ID
        if not self._is_supported_performance_mode(self.settings.performance_mode):
            self.settings.performance_mode = "balanced"

        self.writer.send_result(request.id, {
            "language": self.settings.language,
            "whisperModel": self.settings.whisper_model,
            "mlxModel": self.settings.mlx_model,
            "availableModels": [m[0] for m in WHISPER_MODELS],
            "recordingThreshold": self.settings.recording_threshold,
            "performanceMode": self.settings.performance_mode,
        })

    def _handle_set_settings(self, request: Request):
        """Update settings."""
        params = request.params or {}

        if "language" in params:
            if not self._is_supported_language(params["language"]):
                self.writer.send_error(
                    request.id,
                    ErrorCode.INVALID_PARAMS,
                    f"Transcription language must be '{SUPPORTED_TRANSCRIPTION_LANGUAGE}' (Dutch only)."
                )
                return
            self.settings.language = params["language"]
        if "whisperModel" in params:
            self.settings.whisper_model = params["whisperModel"]
        if "mlxModel" in params:
            if not self._is_supported_enhancement_model(params["mlxModel"]):
                self.writer.send_error(
                    request.id,
                    ErrorCode.INVALID_PARAMS,
                    f"Enhancement model must be '{SUPPORTED_ENHANCEMENT_MODEL_ID}'."
                )
                return
            self.settings.mlx_model = params["mlxModel"]
            # Update the cached model path
            self._mlx_model_path = self._model_manager.get_model_path(self.settings.mlx_model)
        if "recordingThreshold" in params:
            self.settings.recording_threshold = params["recordingThreshold"]
        if "performanceMode" in params:
            if not self._is_supported_performance_mode(params["performanceMode"]):
                self.writer.send_error(
                    request.id,
                    ErrorCode.INVALID_PARAMS,
                    f"Performance mode must be one of: {', '.join(SUPPORTED_PERFORMANCE_MODES)}."
                )
                return
            self.settings.performance_mode = params["performanceMode"]
            preset = self._get_performance_preset()
            self._apply_runtime_thread_limit(preset["cpu_threads"])
            _debug(
                f"Applied performance mode '{self.settings.performance_mode}' "
                f"(beam_size={preset['beam_size']}, cpu_threads={preset['cpu_threads']})"
            )

        self.writer.send_result(request.id, {"ok": True})

    # --- Recording handlers ---

    def _handle_check_permission(self, request: Request):
        """Check if we have audio recording permission."""
        if not self._helper_path.exists():
            self.writer.send_error(
                request.id,
                ErrorCode.AUDIO_HELPER_ERROR,
                "Audio helper not found. Please run build_helper.sh"
            )
            return

        try:
            result = subprocess.run(
                [str(self._helper_path), "--check-permission"],
                capture_output=True,
                text=True,
                timeout=5
            )

            # Parse JSON response from helper
            import json
            try:
                response = json.loads(result.stdout.strip().split('\n')[-1])
                granted = response.get("granted", False)
            except (json.JSONDecodeError, IndexError):
                # Fallback: check exit code
                granted = result.returncode == 0

            self.writer.send_result(request.id, {"granted": granted})

        except subprocess.TimeoutExpired:
            self.writer.send_error(
                request.id,
                ErrorCode.AUDIO_HELPER_ERROR,
                "Permission check timed out"
            )
        except Exception as e:
            self.writer.send_error(
                request.id,
                ErrorCode.AUDIO_HELPER_ERROR,
                str(e)
            )

    def _handle_start_recording(self, request: Request):
        """Start audio recording."""
        if self.recorder is not None:
            self.writer.send_error(
                request.id,
                ErrorCode.RECORDING_IN_PROGRESS,
                "Recording already in progress"
            )
            return

        params = request.params or {}
        sample_rate = params.get("sampleRate", 16000)

        # Track request ID for error reporting
        request_id = request.id

        def on_error(message: str):
            self.writer.send_notification("recordingError", {"message": message})

        def on_warning(message: str):
            # Surface non-fatal warnings (e.g., microphone unavailable) to the UI
            self.writer.send_notification("recordingWarning", {"message": message})

        config = AudioConfig(sample_rate=sample_rate)
        self.recorder = CoreAudioTapRecorder(
            config=config,
            on_error=on_error,
            on_warning=on_warning,
        )

        # Start recording in a background thread (start() blocks until ready)
        def start_async():
            self.recorder.start()

            if self.recorder._process is not None:
                # Recording started successfully
                self.writer.send_result(request_id, {
                    "started": True,
                    "actualSampleRate": self.recorder._actual_sample_rate or sample_rate,
                    "microphoneActive": self.recorder.microphone_active,
                })
            else:
                self.writer.send_error(
                    request_id,
                    ErrorCode.AUDIO_HELPER_ERROR,
                    "Failed to start recording"
                )
                self.recorder = None

        thread = threading.Thread(target=start_async, daemon=True)
        thread.start()

    def _handle_stop_recording(self, request: Request):
        """Stop audio recording and collect audio."""
        if self.recorder is None:
            self.writer.send_error(
                request.id,
                ErrorCode.NOT_RECORDING,
                "Not currently recording"
            )
            return

        request_id = request.id
        recorder = self.recorder

        def stop_async():
            try:
                _debug("Stopping recorder...")
                audio = recorder.stop()
                _debug(f"Recorder stopped, audio shape: {audio.shape if audio is not None else 'None'}")

                # Append to buffer (session continuity)
                if audio is not None and len(audio) > 0:
                    if self.audio_buffer is None:
                        self.audio_buffer = audio
                    else:
                        self.audio_buffer = np.concatenate([self.audio_buffer, audio])

                    duration = len(audio) / 16000  # Assuming 16kHz
                    _debug(f"Audio buffer updated: {len(self.audio_buffer)} samples, {duration:.1f}s")

                    self.writer.send_result(request_id, {
                        "stopped": True,
                        "audioLength": len(audio),
                        "durationSec": round(duration, 2),
                        "totalBufferLength": len(self.audio_buffer)
                    })
                else:
                    _debug("WARNING: No audio captured!")
                    self.writer.send_result(request_id, {
                        "stopped": True,
                        "audioLength": 0,
                        "durationSec": 0,
                        "totalBufferLength": len(self.audio_buffer) if self.audio_buffer is not None else 0
                    })

            except Exception as e:
                self.writer.send_error(request_id, ErrorCode.INTERNAL_ERROR, str(e))
            finally:
                self.recorder = None

        thread = threading.Thread(target=stop_async, daemon=True)
        thread.start()

    # --- Transcription handler ---

    def _handle_transcribe(self, request: Request):
        """Transcribe the recorded audio."""
        _debug(f"Transcribe request received. Audio buffer: {len(self.audio_buffer) if self.audio_buffer is not None else 'None'}")

        if self.audio_buffer is None or len(self.audio_buffer) == 0:
            _debug("ERROR: No audio buffer available!")
            self.writer.send_error(
                request.id,
                ErrorCode.TRANSCRIPTION_ERROR,
                "No audio to transcribe"
            )
            return

        params = request.params or {}
        language = params.get("language", self.settings.language)
        model = params.get("model", self.settings.whisper_model)

        if not self._is_supported_language(language):
            self.writer.send_error(
                request.id,
                ErrorCode.INVALID_PARAMS,
                f"Transcription language must be '{SUPPORTED_TRANSCRIPTION_LANGUAGE}' (Dutch only)."
            )
            return

        language = SUPPORTED_TRANSCRIPTION_LANGUAGE
        request_id = request.id
        preset = self._get_performance_preset()
        beam_size = preset["beam_size"]
        cpu_threads = preset["cpu_threads"]
        self._apply_runtime_thread_limit(cpu_threads)
        _debug(
            f"Starting transcription: language={language}, model={model}, "
            f"audio_length={len(self.audio_buffer)}, performance_mode={self.settings.performance_mode}, "
            f"beam_size={beam_size}, cpu_threads={cpu_threads}"
        )

        # Create transcriber with current settings
        config = TranscriberConfig(
            model_size=model,
            language=language,
            beam_size=beam_size,
            cpu_threads=cpu_threads,
        )
        self.transcriber = Transcriber(config)

        def on_complete(transcript: str, transcript_segments: list[dict[str, float | str]]):
            _debug(f"Transcription complete: {len(transcript)} chars, first 100: {transcript[:100] if transcript else '(empty)'}")
            # Append to session transcript
            if self.transcript:
                self.transcript += "\n\n" + transcript
                self.transcript_segments.extend(transcript_segments)
            else:
                self.transcript = transcript
                self.transcript_segments = list(transcript_segments)

            # Send final result as stream done
            self.writer.send_stream(request_id, {
                "transcript": transcript,
                "totalTranscript": self.transcript,
                "transcriptSegments": transcript_segments,
                "totalTranscriptSegments": self.transcript_segments,
            }, done=True)

        def on_error(error: str):
            _debug(f"Transcription error: {error}")
            self.writer.send_error(request_id, ErrorCode.TRANSCRIPTION_ERROR, error)

        def transcribe_async():
            try:
                transcript, transcript_segments = self.transcriber.transcribe_with_segments(self.audio_buffer)
                on_complete(transcript, transcript_segments)
            except Exception as error:
                on_error(str(error))

        thread = threading.Thread(target=transcribe_async, daemon=True)
        thread.start()

        # Send initial acknowledgment
        self.writer.send_stream(request_id, {
            "status": "started",
            "audioLength": len(self.audio_buffer),
            "durationSec": round(len(self.audio_buffer) / 16000, 2)
        }, done=False)

    # --- Note enhancement handler ---

    def _handle_enhance_notes(self, request: Request):
        """Enhance notes with MLX LLM."""
        if not ENHANCEMENT_ENABLED:
            self.writer.send_error(
                request.id,
                ErrorCode.FEATURE_DISABLED,
                "Enhancement is disabled. Otto currently supports transcription only."
            )
            return

        params = request.params or {}
        notes = params.get("notes", "")
        transcript = params.get("transcript", self.transcript)
        language = params.get("language", self.settings.language)
        user_title = params.get("userTitle", "")
        transcript_segments = params.get("transcriptSegments")

        if not self._is_supported_language(language):
            self.writer.send_error(
                request.id,
                ErrorCode.INVALID_PARAMS,
                f"Enhancement language must be '{SUPPORTED_TRANSCRIPTION_LANGUAGE}' (Dutch only)."
            )
            return
        language = SUPPORTED_TRANSCRIPTION_LANGUAGE

        if not self._is_supported_enhancement_model(self.settings.mlx_model):
            self.writer.send_error(
                request.id,
                ErrorCode.INVALID_PARAMS,
                f"Enhancement model must be '{SUPPORTED_ENHANCEMENT_MODEL_ID}'."
            )
            return

        if transcript_segments is None and transcript == self.transcript:
            transcript_segments = self.transcript_segments

        _debug(f"[IPC] Enhance notes request: notes={len(notes)} chars, transcript={len(transcript) if transcript else 0} chars, language={language}")

        # Check if an enhancement is already in progress
        if self._mlx_notes_generator and self._mlx_notes_generator.is_generating():
            _debug("[IPC] Enhancement already in progress, stopping previous request")
            self._mlx_notes_generator.stop()
            self._mlx_notes_generator = None

        if not notes and not transcript:
            self.writer.send_error(
                request.id,
                ErrorCode.INVALID_PARAMS,
                "Either notes or transcript must be provided"
            )
            return

        request_id = request.id
        preset = self._get_performance_preset()
        enhancement_cpu_threads = preset["enhance_cpu_threads"]
        self._apply_runtime_thread_limit(enhancement_cpu_threads)

        transcript_char_limit = preset["enhance_transcript_char_limit"]
        if (
            transcript
            and isinstance(transcript, str)
            and transcript_char_limit > 0
            and len(transcript) > transcript_char_limit
        ):
            _debug(
                f"Trimming enhancement transcript from {len(transcript)} to "
                f"{transcript_char_limit} chars for responsiveness"
            )
            transcript = transcript[-transcript_char_limit:]
            if transcript_segments:
                transcript_segments = None
                _debug("Dropped transcript segments after transcript trim")

        _debug(
            "Enhancement performance preset "
            f"(mode={self.settings.performance_mode}, enhancement_cpu_threads={enhancement_cpu_threads}, "
            f"max_tokens={preset['enhance_max_tokens']}, "
            f"chunk_window_minutes={preset['enhance_chunk_window_minutes']}, "
            f"chunk_min_duration_minutes={preset['enhance_chunk_min_duration_minutes']}, "
            f"chunk_max_count={preset['enhance_chunk_max_count']}, "
            f"chunk_retry_attempts={preset['enhance_chunk_retry_attempts']}, "
            f"transcript_char_limit={preset['enhance_transcript_char_limit']})"
        )

        def on_complete(full_response: str):
            _debug(f"Enhancement complete: {len(full_response)} chars")
            self._mlx_notes_generator = None
            try:
                self.writer.send_result(request_id, {"complete": True, "notes": full_response})
            except Exception as e:
                _debug(f"Error sending complete: {e}")

        # Get the model path for the selected MLX model
        mlx_model_path = self._model_manager.get_model_path(self.settings.mlx_model)
        _debug(f"MLX model path: {mlx_model_path}")

        if not mlx_model_path:
            self.writer.send_error(
                request_id,
                ErrorCode.MODEL_NOT_FOUND,
                "MLX model not found. Please download the model first."
            )
            return

        def on_mlx_error(error: str):
            _debug(f"MLX error: {error}")
            self.writer.send_error(request_id, ErrorCode.INTERNAL_ERROR, f"MLX enhancement failed: {error}")

        try:
            # Configure MLX with the selected model and active performance preset
            mlx_config = MLXConfig(
                model_path=mlx_model_path,
                temperature=float(preset.get("enhance_temperature", 0.2)),
                top_p=float(preset.get("enhance_top_p", 0.8)),
                max_tokens=preset["enhance_max_tokens"],
                chunk_window_minutes=preset["enhance_chunk_window_minutes"],
                chunk_min_duration_minutes=preset["enhance_chunk_min_duration_minutes"],
                chunk_max_count=preset["enhance_chunk_max_count"],
                chunk_retry_attempts=preset["enhance_chunk_retry_attempts"],
            )
            _debug(f"Creating MLX generator with config: {mlx_config}")

            # Create and start MLX generator
            self._mlx_notes_generator = MLXNotesGenerator(
                config=mlx_config,
                on_complete=on_complete,
                on_error=on_mlx_error
            )

            _debug("Starting MLX enhancement...")
            self._mlx_notes_generator.enhance_notes(
                notes,
                transcript,
                language,
                user_title,
                transcript_segments=transcript_segments,
            )
        except Exception as e:
            _debug(f"Exception in MLX setup: {e}")
            import traceback
            _debug(traceback.format_exc())
            on_mlx_error(str(e))

    # --- Session management ---

    def _handle_reset_session(self, request: Request):
        """Reset the current session (clear audio buffer and transcript)."""
        self.audio_buffer = None
        self.transcript = ""
        self.transcript_segments = []

        self.writer.send_result(request.id, {"ok": True})

    # --- Model management handlers ---

    def _handle_download_model(self, request: Request):
        """Download an MLX model from HuggingFace with streaming progress."""
        params = request.params or {}
        model_id = params.get("modelId")

        if not model_id:
            self.writer.send_error(
                request.id,
                ErrorCode.INVALID_PARAMS,
                "modelId is required"
            )
            return

        if not self._is_supported_enhancement_model(model_id):
            self.writer.send_error(
                request.id,
                ErrorCode.INVALID_PARAMS,
                f"Only model '{SUPPORTED_ENHANCEMENT_MODEL_ID}' is supported."
            )
            return

        # Check if already downloaded
        if self._model_manager.is_model_downloaded(model_id):
            self.writer.send_result(request.id, {
                "alreadyDownloaded": True,
                "path": self._model_manager.get_model_path(model_id)
            })
            return

        request_id = request.id

        def on_progress(progress: DownloadProgress):
            # Format sizes for display
            downloaded_mb = progress.bytes_downloaded / (1024 * 1024)
            total_mb = progress.total_bytes / (1024 * 1024) if progress.total_bytes > 0 else 0
            speed_mb = progress.speed_bytes_per_sec / (1024 * 1024)

            self.writer.send_stream(request_id, {
                "status": progress.status,
                "modelId": model_id,
                "progress": progress.percentage,
                "downloaded": f"{downloaded_mb:.1f} MB",
                "total": f"{total_mb:.1f} MB" if total_mb > 0 else "unknown",
                "speed": f"{speed_mb:.1f} MB/s" if speed_mb > 0 else "",
            }, done=False)

            # Send completion when done
            if progress.status == "completed":
                self.writer.send_stream(request_id, {
                    "complete": True,
                    "modelId": model_id,
                    "path": self._model_manager.get_model_path(model_id)
                }, done=True)
            elif progress.status == "failed":
                self.writer.send_error(
                    request_id,
                    ErrorCode.MODEL_DOWNLOAD_ERROR,
                    progress.error or "Download failed"
                )
            elif progress.status == "cancelled":
                self.writer.send_stream(request_id, {
                    "cancelled": True,
                    "modelId": model_id,
                }, done=True)

        # Start download in background (non-blocking)
        try:
            self._model_manager.download_model(
                model_id,
                on_progress=on_progress,
                blocking=False
            )
            # Send acknowledgment
            self.writer.send_stream(request_id, {
                "status": "starting",
                "modelId": model_id
            }, done=False)
        except RuntimeError as e:
            self.writer.send_error(
                request.id,
                ErrorCode.MODEL_DOWNLOAD_IN_PROGRESS,
                str(e)
            )

    def _handle_cancel_download(self, request: Request):
        """Cancel an in-progress model download."""
        cancelled = self._model_manager.cancel_download()
        self.writer.send_result(request.id, {"cancelled": cancelled})

    def _handle_is_model_downloaded(self, request: Request):
        """Check if a model is downloaded and ready to use."""
        params = request.params or {}
        model_id = params.get("modelId")

        if not model_id:
            self.writer.send_error(
                request.id,
                ErrorCode.INVALID_PARAMS,
                "modelId is required"
            )
            return

        if not self._is_supported_enhancement_model(model_id):
            self.writer.send_error(
                request.id,
                ErrorCode.INVALID_PARAMS,
                f"Only model '{SUPPORTED_ENHANCEMENT_MODEL_ID}' is supported."
            )
            return

        is_downloaded = self._model_manager.is_model_downloaded(model_id)
        self.writer.send_result(request.id, {"downloaded": is_downloaded})

    def _handle_get_model_status(self, request: Request):
        """Get detailed status of a model."""
        params = request.params or {}
        model_id = params.get("modelId")

        if not model_id:
            self.writer.send_error(
                request.id,
                ErrorCode.INVALID_PARAMS,
                "modelId is required"
            )
            return

        if not self._is_supported_enhancement_model(model_id):
            self.writer.send_error(
                request.id,
                ErrorCode.INVALID_PARAMS,
                f"Only model '{SUPPORTED_ENHANCEMENT_MODEL_ID}' is supported."
            )
            return

        info = self._model_manager.get_model_info(model_id)
        if info:
            size_mb = info.size_bytes / (1024 * 1024)
            self.writer.send_result(request.id, {
                "exists": True,
                "modelId": info.model_id,
                "path": info.local_path,
                "size": f"{size_mb:.1f} MB",
                "sizeBytes": info.size_bytes,
                "downloadDate": info.download_date,
                "version": info.version
            })
        else:
            # Check if it's downloaded but not in manifest
            if self._model_manager.is_model_downloaded(model_id):
                path = self._model_manager.get_model_path(model_id)
                self.writer.send_result(request.id, {
                    "exists": True,
                    "modelId": model_id,
                    "path": path,
                    "size": "unknown",
                    "sizeBytes": 0,
                    "downloadDate": None,
                    "version": None
                })
            else:
                self.writer.send_result(request.id, {
                    "exists": False,
                    "modelId": model_id
                })

    def _handle_delete_model(self, request: Request):
        """Delete a downloaded model."""
        params = request.params or {}
        model_id = params.get("modelId")

        if not model_id:
            self.writer.send_error(
                request.id,
                ErrorCode.INVALID_PARAMS,
                "modelId is required"
            )
            return

        if not self._is_supported_enhancement_model(model_id):
            self.writer.send_error(
                request.id,
                ErrorCode.INVALID_PARAMS,
                f"Only model '{SUPPORTED_ENHANCEMENT_MODEL_ID}' is supported."
            )
            return

        deleted = self._model_manager.delete_model(model_id)
        if deleted:
            self.writer.send_result(request.id, {"deleted": True})
        else:
            self.writer.send_error(
                request.id,
                ErrorCode.MODEL_NOT_FOUND,
                f"Model not found: {model_id}"
            )

    def _handle_get_available_models(self, request: Request):
        """Get list of recommended models that can be downloaded."""
        models = self._model_manager.get_available_models()
        self.writer.send_result(request.id, {"models": models})

    def _handle_get_downloaded_models(self, request: Request):
        """Get list of all downloaded models."""
        models = self._model_manager.scan_local_models()
        result = []
        for info in models:
            if not self._is_supported_enhancement_model(info.model_id):
                continue
            size_mb = info.size_bytes / (1024 * 1024)
            result.append({
                "modelId": info.model_id,
                "path": info.local_path,
                "size": f"{size_mb:.1f} MB",
                "sizeBytes": info.size_bytes,
                "downloadDate": info.download_date
            })
        self.writer.send_result(request.id, {"models": result})


def main():
    """Entry point for the IPC server."""
    # Ensure unbuffered output for immediate JSON delivery
    sys.stdout.reconfigure(line_buffering=True)

    server = IPCServer()
    try:
        server.run()
    except KeyboardInterrupt:
        pass
    except EOFError:
        # stdin closed, Electron process exited
        pass


if __name__ == "__main__":
    main()

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
    IPCReader, IPCWriter, Request, ErrorCode,
    parse_request
)
from .recorder import CoreAudioTapRecorder, AudioConfig
from .transcriber import Transcriber, TranscriberConfig, WHISPER_MODELS
from .ollama import OllamaClient, OllamaConfig, NotesGenerator
from .mlx_inference import MLXConfig, MLXNotesGenerator, DEFAULT_MLX_MODEL
from .model_manager import ModelManager, ModelManagerConfig, DownloadProgress


@dataclass
class Settings:
    """Application settings."""
    language: str = "nl"
    whisper_model: str = "medium"
    mlx_model: str = DEFAULT_MLX_MODEL
    ollama_model: str = "llama3.2"
    ollama_endpoint: str = "http://localhost:11434"
    recording_threshold: int = 30  # Minimum recording duration in seconds


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

        # Pending streaming operations
        self._pending_transcription: Optional[str] = None
        self._pending_enhancement: Optional[str] = None
        self._notes_generator: Optional[NotesGenerator] = None
        self._mlx_notes_generator: Optional[MLXNotesGenerator] = None

        # Model manager for MLX models
        self._model_manager = ModelManager()

        # Check if MLX model is available
        self._mlx_model_path = self._model_manager.get_model_path(DEFAULT_MLX_MODEL)
        if self._mlx_model_path is None:
            # Try scanning for any downloaded model
            local_models = self._model_manager.scan_local_models()
            if local_models:
                self._mlx_model_path = local_models[0].local_path

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
            "getOllamaModels": self._handle_get_ollama_models,
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
        if self._notes_generator:
            self._notes_generator.stop()
            self._notes_generator = None

        self.writer.send_result(request.id, {"ok": True})
        sys.exit(0)

    def _handle_get_settings(self, request: Request):
        """Return current settings."""
        self.writer.send_result(request.id, {
            "language": self.settings.language,
            "whisperModel": self.settings.whisper_model,
            "mlxModel": self.settings.mlx_model,
            "ollamaModel": self.settings.ollama_model,
            "ollamaEndpoint": self.settings.ollama_endpoint,
            "availableModels": [m[0] for m in WHISPER_MODELS],
            "recordingThreshold": self.settings.recording_threshold
        })

    def _handle_set_settings(self, request: Request):
        """Update settings."""
        params = request.params or {}

        if "language" in params:
            self.settings.language = params["language"]
        if "whisperModel" in params:
            self.settings.whisper_model = params["whisperModel"]
        if "mlxModel" in params:
            self.settings.mlx_model = params["mlxModel"]
            # Update the cached model path
            self._mlx_model_path = self._model_manager.get_model_path(self.settings.mlx_model)
        if "ollamaModel" in params:
            self.settings.ollama_model = params["ollamaModel"]
        if "ollamaEndpoint" in params:
            self.settings.ollama_endpoint = params["ollamaEndpoint"]
        if "recordingThreshold" in params:
            self.settings.recording_threshold = params["recordingThreshold"]

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

        request_id = request.id
        _debug(f"Starting transcription: language={language}, model={model}, audio_length={len(self.audio_buffer)}")

        # Create transcriber with current settings
        config = TranscriberConfig(model_size=model, language=language)
        self.transcriber = Transcriber(config)

        def on_complete(transcript: str):
            _debug(f"Transcription complete: {len(transcript)} chars, first 100: {transcript[:100] if transcript else '(empty)'}")
            # Append to session transcript
            if self.transcript:
                self.transcript += "\n\n" + transcript
            else:
                self.transcript = transcript

            # Send final result as stream done
            self.writer.send_stream(request_id, {
                "transcript": transcript,
                "totalTranscript": self.transcript
            }, done=True)

        def on_error(error: str):
            _debug(f"Transcription error: {error}")
            self.writer.send_error(request_id, ErrorCode.TRANSCRIPTION_ERROR, error)

        # Start transcription (this already runs in background thread)
        self.transcriber.transcribe_async(
            self.audio_buffer,
            on_complete=on_complete,
            on_error=on_error
        )

        # Send initial acknowledgment
        self.writer.send_stream(request_id, {
            "status": "started",
            "audioLength": len(self.audio_buffer),
            "durationSec": round(len(self.audio_buffer) / 16000, 2)
        }, done=False)

    # --- Note enhancement handler ---

    def _handle_enhance_notes(self, request: Request):
        """Enhance notes with LLM (MLX by default, Ollama as fallback)."""
        params = request.params or {}
        notes = params.get("notes", "")
        transcript = params.get("transcript", self.transcript)
        language = params.get("language", self.settings.language)
        user_title = params.get("userTitle", "")
        use_ollama = params.get("useOllama", False)  # Force Ollama if requested

        _debug(f"[IPC] Enhance notes request: notes={len(notes)} chars, transcript={len(transcript) if transcript else 0} chars, language={language}")

        # Check if an enhancement is already in progress
        if self._mlx_notes_generator and self._mlx_notes_generator.is_generating():
            _debug("[IPC] Enhancement already in progress, stopping previous request")
            self._mlx_notes_generator.stop()
            self._mlx_notes_generator = None

        if self._notes_generator and self._notes_generator.is_generating():
            _debug("[IPC] Ollama enhancement already in progress, stopping previous request")
            self._notes_generator.stop()
            self._notes_generator = None

        if not notes and not transcript:
            self.writer.send_error(
                request.id,
                ErrorCode.INVALID_PARAMS,
                "Either notes or transcript must be provided"
            )
            return

        request_id = request.id

        def on_token(token: str):
            try:
                self.writer.send_stream(request_id, {"token": token}, done=False)
            except Exception as e:
                _debug(f"Error sending token: {e}")

        def on_complete(full_response: str):
            _debug(f"Enhancement complete: {len(full_response)} chars")
            # Clean up generator references
            self._mlx_notes_generator = None
            self._notes_generator = None
            try:
                self.writer.send_stream(request_id, {"complete": True}, done=True)
            except Exception as e:
                _debug(f"Error sending complete: {e}")

        # Get the model path for the selected MLX model
        mlx_model_path = self._model_manager.get_model_path(self.settings.mlx_model)
        _debug(f"MLX model path: {mlx_model_path}")

        # Try MLX first (unless Ollama explicitly requested)
        if not use_ollama and mlx_model_path:
            def on_mlx_error(error: str):
                _debug(f"MLX error: {error}")
                # Report MLX error directly - don't fall back to Ollama automatically
                # Ollama is only used when explicitly requested via useOllama parameter
                self.writer.send_error(request_id, ErrorCode.INTERNAL_ERROR, f"MLX enhancement failed: {error}")

            try:
                # Configure MLX with the selected model
                mlx_config = MLXConfig(model_path=mlx_model_path)
                _debug(f"Creating MLX generator with config: {mlx_config}")

                # Create and start MLX generator
                self._mlx_notes_generator = MLXNotesGenerator(
                    config=mlx_config,
                    on_progress=on_token,
                    on_complete=on_complete,
                    on_error=on_mlx_error
                )

                _debug("Starting MLX enhancement...")
                self._mlx_notes_generator.enhance_notes(notes, transcript, language, user_title)

                # Send acknowledgment
                self.writer.send_stream(request_id, {"status": "started", "backend": "mlx", "model": self.settings.mlx_model}, done=False)
            except Exception as e:
                _debug(f"Exception in MLX setup: {e}")
                import traceback
                _debug(traceback.format_exc())
                on_mlx_error(str(e))
        else:
            # Use Ollama
            _debug("Using Ollama for enhancement")
            self._enhance_with_ollama(request_id, notes, transcript, language, user_title, on_token, on_complete)

    def _enhance_with_ollama(self, request_id: str, notes: str, transcript: str,
                              language: str, user_title: str, on_token, on_complete):
        """Fallback enhancement using Ollama."""
        def on_error(error: str):
            self.writer.send_error(request_id, ErrorCode.OLLAMA_NOT_AVAILABLE, error)

        # Configure Ollama
        ollama_config = OllamaConfig(
            base_url=self.settings.ollama_endpoint,
            model=self.settings.ollama_model
        )

        # Create and start generator
        self._notes_generator = NotesGenerator(
            config=ollama_config,
            on_progress=on_token,
            on_complete=on_complete,
            on_error=on_error
        )

        self._notes_generator.enhance_notes(notes, transcript, language, user_title)

        # Send acknowledgment
        self.writer.send_stream(request_id, {"status": "started", "backend": "ollama"}, done=False)

    # --- Session management ---

    def _handle_reset_session(self, request: Request):
        """Reset the current session (clear audio buffer and transcript)."""
        self.audio_buffer = None
        self.transcript = ""

        self.writer.send_result(request.id, {"ok": True})

    def _handle_get_ollama_models(self, request: Request):
        """Get available Ollama models."""
        ollama_config = OllamaConfig(base_url=self.settings.ollama_endpoint)
        client = OllamaClient(ollama_config)
        models = client.list_models()
        self.writer.send_result(request.id, {"models": models})

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

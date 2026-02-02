"""
IPC Server for Electron <-> Python communication.

This module provides the entry point for the Python backend when running
under Electron. It replaces the CustomTkinter GUI with a JSON-RPC interface.

Usage:
    python -m app.ipc_server
"""

import sys
import subprocess
import threading
import numpy as np
from pathlib import Path
from typing import Optional, Dict, Any
from dataclasses import dataclass

from .ipc_protocol import (
    IPCReader, IPCWriter, Request, ErrorCode,
    parse_request
)
from .recorder import CoreAudioTapRecorder, AudioConfig
from .transcriber import Transcriber, TranscriberConfig, WHISPER_MODELS
from .ollama import OllamaClient, OllamaConfig, NotesGenerator


@dataclass
class Settings:
    """Application settings."""
    language: str = "nl"
    whisper_model: str = "medium"
    ollama_model: str = "llama3.2"
    ollama_endpoint: str = "http://localhost:11434"


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

        # Path to Swift helper
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
            "ollamaModel": self.settings.ollama_model,
            "ollamaEndpoint": self.settings.ollama_endpoint,
            "availableModels": [m[0] for m in WHISPER_MODELS]
        })

    def _handle_set_settings(self, request: Request):
        """Update settings."""
        params = request.params or {}

        if "language" in params:
            self.settings.language = params["language"]
        if "whisperModel" in params:
            self.settings.whisper_model = params["whisperModel"]
        if "ollamaModel" in params:
            self.settings.ollama_model = params["ollamaModel"]
        if "ollamaEndpoint" in params:
            self.settings.ollama_endpoint = params["ollamaEndpoint"]

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

        config = AudioConfig(sample_rate=sample_rate)
        self.recorder = CoreAudioTapRecorder(config=config, on_error=on_error)

        # Start recording in a background thread (start() blocks until ready)
        def start_async():
            self.recorder.start()

            if self.recorder._process is not None:
                # Recording started successfully
                self.writer.send_result(request_id, {
                    "started": True,
                    "actualSampleRate": self.recorder._actual_sample_rate or sample_rate
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
                audio = recorder.stop()

                # Append to buffer (session continuity)
                if audio is not None and len(audio) > 0:
                    if self.audio_buffer is None:
                        self.audio_buffer = audio
                    else:
                        self.audio_buffer = np.concatenate([self.audio_buffer, audio])

                    duration = len(audio) / 16000  # Assuming 16kHz

                    self.writer.send_result(request_id, {
                        "stopped": True,
                        "audioLength": len(audio),
                        "durationSec": round(duration, 2),
                        "totalBufferLength": len(self.audio_buffer)
                    })
                else:
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
        if self.audio_buffer is None or len(self.audio_buffer) == 0:
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

        # Create transcriber with current settings
        config = TranscriberConfig(model_size=model, language=language)
        self.transcriber = Transcriber(config)

        def on_complete(transcript: str):
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
        """Enhance notes with LLM."""
        params = request.params or {}
        notes = params.get("notes", "")
        transcript = params.get("transcript", self.transcript)
        language = params.get("language", self.settings.language)
        user_title = params.get("userTitle", "")

        if not notes and not transcript:
            self.writer.send_error(
                request.id,
                ErrorCode.INVALID_PARAMS,
                "Either notes or transcript must be provided"
            )
            return

        request_id = request.id

        # Configure Ollama
        ollama_config = OllamaConfig(
            base_url=self.settings.ollama_endpoint,
            model=self.settings.ollama_model
        )

        def on_token(token: str):
            self.writer.send_stream(request_id, {"token": token}, done=False)

        def on_complete(full_response: str):
            self.writer.send_stream(request_id, {"complete": True}, done=True)

        def on_error(error: str):
            self.writer.send_error(request_id, ErrorCode.OLLAMA_NOT_AVAILABLE, error)

        # Create and start generator
        self._notes_generator = NotesGenerator(
            config=ollama_config,
            on_progress=on_token,
            on_complete=on_complete,
            on_error=on_error
        )

        self._notes_generator.enhance_notes(notes, transcript, language, user_title)

        # Send acknowledgment
        self.writer.send_stream(request_id, {"status": "started"}, done=False)

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

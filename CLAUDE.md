# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Courier is a local-first macOS meeting recorder built with Python + Swift. It captures system audio using native Core Audio Taps, transcribes using local Whisper models, and generates enhanced meeting notes via Ollama LLMs. All processing happens locally - no cloud dependencies. Requires macOS 14.2+.

## Running the Application

```bash
# Requirements: macOS 14.2+ (Sonoma or later)

# Install Python dependencies
pip install -r requirements.txt

# Build Swift audio helper (requires Xcode/Swift toolchain)
# Note: Pre-built binary is included in app/bin/ - only rebuild if needed
./build_helper.sh

# Run the app
python main.py

# First run: Grant "Screen & System Audio Recording" permission when prompted

# Ollama must be running for note generation
ollama serve  # In separate terminal
```

## Architecture

**Entry point:** `main.py` creates the GUI and starts the event loop.

**Core modules in `app/`:**
- `gui.py` - CustomTkinter main window, settings modal, permission dialog, notes display (CourierApp class)
- `recorder.py` - CoreAudioTapRecorder: manages Swift helper subprocess, IPC protocol, audio buffering
- `transcriber.py` - Faster-Whisper transcription pipeline (Transcriber class)
- `ollama.py` - LLM integration for note enhancement (OllamaClient, NotesGenerator classes)

**Swift helper (`courier-audio-helper/`):**
- `AudioCaptureManager.swift` - Core Audio Taps API integration
- `IPCHandler.swift` - IPC protocol (JSON control + binary audio)
- `main.swift` - Entry point, CLI argument handling (`--check-permission`)

**Threading model:** Audio capture runs in a separate Swift process. Python communicates via IPC: JSON commands over stdin/stdout, binary PCM audio over stderr. Two daemon threads in Python handle reading control messages and audio data. Transcription and LLM calls also run in daemon threads. UI updates are marshaled to the main thread via `.after(0, callback)`.

**Data flow:**
1. CoreAudioTapRecorder spawns Swift helper subprocess
2. Swift helper creates Core Audio Tap for system-wide audio capture
3. Audio chunks streamed to Python via stderr (size-prefixed binary PCM float32)
4. On stop, audio resampled to 16kHz → Transcriber runs Whisper
5. User can enhance notes → NotesGenerator streams from Ollama

**Privacy design:** Audio kept in memory only, never written to disk. Transcribed then discarded.

## Key Patterns

- **Callback pattern for background work:** Functions accept `on_error`, `on_complete`, `on_progress` callbacks
- **Config dataclasses:** AudioConfig, TranscriberConfig, OllamaConfig for typed configuration
- **Lazy model loading:** Whisper models loaded on first transcription, then cached
- **Streaming tokens:** Ollama responses parsed line-by-line JSON for real-time display
- **Session continuity:** Audio and transcripts append across multiple recordings in a session

**IPC Protocol (Python <-> Swift):**
- Control: JSON over stdin (Python->Swift) and stdout (Swift->Python)
- Audio: Binary PCM float32 with 4-byte big-endian size prefix over stderr
- Commands: `{"command": "start", "sampleRate": 16000}`, `{"command": "stop"}`
- Responses: `{"type": "ready"}`, `{"type": "started", "actualSampleRate": ...}`, `{"type": "stopped", "totalSamples": ...}`, `{"type": "error", "code": "...", "message": "..."}`

## Technical Details

- **System requirements:** macOS 14.2+ (Sonoma or later)
- **Audio capture:** Core Audio Taps (native macOS API, system-wide)
- **Permission:** Screen & System Audio Recording (granted via System Settings)
- **Whisper models:** tiny, base, small, medium (default), large-v3
- **Compute detection:** CUDA -> MPS -> CPU with int8 quantization
- **Default language:** Dutch (nl), supports EN, DE, FR, ES, IT, PT
- **Ollama endpoint:** http://localhost:11434
- **Audio format:** 16kHz mono float32 required for Whisper (resampling handled automatically)
- **Build:** `build_helper.sh` creates universal binary (ARM64 + x86_64) in `app/bin/`

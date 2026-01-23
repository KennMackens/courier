# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Courier is a local-first desktop meeting recorder built with Python. It captures system audio and microphone input, transcribes using local Whisper models, and generates enhanced meeting notes via Ollama LLMs. All processing happens locally - no cloud dependencies.

## Running the Application

```bash
# Install dependencies
pip install -r requirements.txt

# Run the app
python main.py

# Ollama must be running for note generation
ollama serve  # In separate terminal
```

## Architecture

**Entry point:** `main.py` creates the GUI and starts the event loop.

**Core modules in `app/`:**
- `gui.py` - CustomTkinter main window, settings modal, notes display (CourierApp class)
- `recorder.py` - Audio capture with background threading (AudioRecorder class)
- `transcriber.py` - Faster-Whisper transcription pipeline (Transcriber class)
- `ollama.py` - LLM integration for note enhancement (OllamaClient, NotesGenerator classes)

**Threading model:** All heavy operations (recording, transcription, LLM calls) run in daemon threads. UI updates are marshaled to the main thread via `.after(0, callback)`. Audio chunks are buffered with `threading.Lock()`.

**Data flow:**
1. AudioRecorder captures from selected devices → numpy buffer in memory
2. On stop, audio resampled to 16kHz → Transcriber runs Whisper
3. User can enhance notes → NotesGenerator streams from Ollama

**Privacy design:** Audio kept in memory only, never written to disk. Transcribed then discarded.

## Key Patterns

- **Callback pattern for background work:** Functions accept `on_error`, `on_complete`, `on_progress` callbacks
- **Config dataclasses:** AudioConfig, TranscriberConfig, OllamaConfig for typed configuration
- **Lazy model loading:** Whisper models loaded on first transcription, then cached
- **Streaming tokens:** Ollama responses parsed line-by-line JSON for real-time display

## Technical Details

- **Whisper models:** tiny, base, small, medium (default), large-v3
- **Compute detection:** CUDA → MPS → CPU with int8 quantization
- **Default language:** Dutch (nl), supports EN, DE, FR, ES, IT, PT
- **Ollama endpoint:** http://localhost:11434
- **Audio format:** 16kHz mono required for Whisper (resampling handled automatically)

## Dual-Channel Recording

The app supports selecting two input devices (mic + system loopback) and mixing them. Users must explicitly select devices in Settings - no assumptions about system audio availability.

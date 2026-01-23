# Project: Courier
- Type: Desktop Application (Python)
- Goal: A local-first meeting recorder that captures system audio + mic, transcribes it, and generates enhanced notes using local LLMs.

## Core Architecture
1. **GUI Framework:** Use `CustomTkinter` for a modern, dark-mode UI.
2. **Audio Backend:** `sounddevice` and `numpy`.
3. **Transcription:** `faster-whisper` (running on CPU or MPS/CUDA if available).
4. **Intelligence:** `ollama` (via API calls to localhost:11434).

## Critical Technical Requirements (Must Follow)
1.  **Dual-Channel Recording (The Hard Part):**
    * The app must allow selecting *two* input devices:
        1.  Microphone (User voice).
        2.  Loopback Device (System audio/Other people).
    * It must mix these two streams into a single buffer for the transcriber.
    * *Constraint:* Do not assume standard system audio is available; explicitly prompt the user to select the input devices in a Settings menu.

2.  **Non-Blocking Threading:**
    * The Recording and Transcribing loops must run in separate threads (`threading` or `multiprocessing`) so the GUI never freezes.
    * Use a `Queue` to pass audio chunks from the recorder thread to the transcriber thread.

3.  **Data Handling:**
    * Do NOT save .wav/.mp3 files to disk (privacy first). Keep audio in a ring buffer or temporary stream, transcribe it, and discard the audio.
    * Append text to a local `transcript.txt` file in real-time.

## Feature List
* **Main Window:**
    * Status Indicator (Ready/Recording/Processing).
    * Live Transcript View (Auto-scrolling text box).
    * "Start/Stop" big button.
    * "Generate Notes" button (Trigger Ollama to summarize the `transcript.txt`).
* **Settings Modal:**
    * Dropdown to select "Mic Input Device".
    * Dropdown to select "System/Loopback Input Device".

## Implementation Plan
Phase 1: Create the GUI skeleton and Device Selection logic.
Phase 2: Implement the Audio Recording thread (mixing two inputs).
Phase 3: Implement the Faster-Whisper transcription pipeline.
Phase 4: Connect the "Generate Notes" button to Ollama.
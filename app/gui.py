import customtkinter as ctk
import sounddevice as sd
import numpy as np
from typing import Callable, Optional

from app.recorder import AudioRecorder, AudioConfig
from app.transcriber import Transcriber, TranscriberConfig, WHISPER_MODELS
from app.ollama import NotesGenerator, OllamaConfig


SUPPORTED_LANGUAGES = [
    ("English", "en"),
    ("Dutch", "nl"),
    ("German", "de"),
    ("French", "fr"),
    ("Spanish", "es"),
    ("Italian", "it"),
    ("Portuguese", "pt"),
]


class SettingsModal(ctk.CTkToplevel):
    """Settings modal for device, language, and model selection."""

    def __init__(self, parent, on_save: Optional[Callable] = None,
                 current_language: str = "nl", current_model: str = "medium",
                 current_device: Optional[int] = None):
        super().__init__(parent)
        self.on_save = on_save
        self.current_language = current_language
        self.current_model = current_model
        self.current_device = current_device

        self.title("Settings")
        self.geometry("500x350")
        self.resizable(False, False)

        self.transient(parent)

        # Delay grab_set() until window is visible to prevent macOS crash
        self.after(100, self._safe_grab)

        # Get available audio devices
        self.devices = self._get_input_devices()
        device_names = [d["name"] for d in self.devices]

        # Main frame
        main_frame = ctk.CTkFrame(self, fg_color="transparent")
        main_frame.pack(fill="both", expand=True, padx=20, pady=20)

        # Title
        title_label = ctk.CTkLabel(
            main_frame,
            text="Settings",
            font=ctk.CTkFont(size=18, weight="bold")
        )
        title_label.pack(pady=(0, 20))

        # Microphone selection
        mic_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
        mic_frame.pack(fill="x", pady=5)

        ctk.CTkLabel(mic_frame, text="Microphone:", font=ctk.CTkFont(size=14)).pack(anchor="w")
        self.mic_dropdown = ctk.CTkComboBox(
            mic_frame,
            values=device_names if device_names else ["No devices found"],
            width=450,
            state="readonly" if device_names else "disabled"
        )
        self.mic_dropdown.pack(pady=(5, 0))

        # Set current device
        if current_device is not None:
            for d in self.devices:
                if d["index"] == current_device:
                    self.mic_dropdown.set(d["name"])
                    break
        elif device_names:
            self.mic_dropdown.set(device_names[0])

        # Language selection
        lang_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
        lang_frame.pack(fill="x", pady=5)

        ctk.CTkLabel(lang_frame, text="Language:", font=ctk.CTkFont(size=14)).pack(anchor="w")
        lang_names = [name for name, code in SUPPORTED_LANGUAGES]
        self.lang_dropdown = ctk.CTkComboBox(lang_frame, values=lang_names, width=450, state="readonly")
        self.lang_dropdown.pack(pady=(5, 0))

        current_lang_name = next((name for name, code in SUPPORTED_LANGUAGES if code == self.current_language), "Dutch")
        self.lang_dropdown.set(current_lang_name)

        # Model selection
        model_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
        model_frame.pack(fill="x", pady=5)

        ctk.CTkLabel(model_frame, text="Whisper Model:", font=ctk.CTkFont(size=14)).pack(anchor="w")
        model_names = [desc for _, desc in WHISPER_MODELS]
        self.model_dropdown = ctk.CTkComboBox(model_frame, values=model_names, width=450, state="readonly")
        self.model_dropdown.pack(pady=(5, 0))

        current_model_name = next((desc for code, desc in WHISPER_MODELS if code == self.current_model), "Medium (better multilingual)")
        self.model_dropdown.set(current_model_name)

        # Buttons
        button_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
        button_frame.pack(fill="x", pady=(20, 0))

        ctk.CTkButton(button_frame, text="Cancel", width=100, fg_color="gray", command=self.destroy).pack(side="left")
        ctk.CTkButton(button_frame, text="Save", width=100, command=self._save_settings).pack(side="right")

    def _safe_grab(self):
        """Set grab after window is visible to prevent macOS crash."""
        if self.winfo_exists():
            self.grab_set()
            self.focus_force()

    def _get_input_devices(self) -> list:
        """Get list of available input audio devices."""
        devices = []
        try:
            all_devices = sd.query_devices()
            for i, device in enumerate(all_devices):
                if device["max_input_channels"] > 0:
                    devices.append({"index": i, "name": device["name"]})
        except Exception as e:
            print(f"Error querying devices: {e}")
        return devices

    def _save_settings(self):
        """Save settings and close."""
        mic_name = self.mic_dropdown.get()
        mic_device = next((d["index"] for d in self.devices if d["name"] == mic_name), None)

        lang_name = self.lang_dropdown.get()
        language = next((code for name, code in SUPPORTED_LANGUAGES if name == lang_name), "nl")

        model_name = self.model_dropdown.get()
        model = next((code for code, desc in WHISPER_MODELS if desc == model_name), "medium")

        if self.on_save:
            self.on_save(mic_device, language, model)
        self.destroy()


class NotesWindow(ctk.CTkToplevel):
    """Window for displaying generated meeting notes."""

    def __init__(self, parent):
        super().__init__(parent)
        self.title("Enhanced Notes")
        self.geometry("600x500")

        main_frame = ctk.CTkFrame(self, fg_color="transparent")
        main_frame.pack(fill="both", expand=True, padx=10, pady=10)

        ctk.CTkLabel(main_frame, text="Enhanced Meeting Notes", font=ctk.CTkFont(size=16, weight="bold")).pack(pady=(0, 10))

        self.notes_text = ctk.CTkTextbox(main_frame, font=ctk.CTkFont(size=13), wrap="word")
        self.notes_text.pack(fill="both", expand=True)

        self.status_label = ctk.CTkLabel(main_frame, text="Generating...", font=ctk.CTkFont(size=12))
        self.status_label.pack(pady=(10, 0))

    def append_text(self, text: str):
        self.notes_text.insert("end", text)
        self.notes_text.see("end")

    def set_status(self, status: str):
        self.status_label.configure(text=status)

    def clear(self):
        self.notes_text.delete("1.0", "end")


class CourierApp(ctk.CTk):
    """Main application window."""

    def __init__(self):
        super().__init__()

        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")

        self.title("Courier - Meeting Notes")
        self.geometry("900x600")
        self.minsize(700, 400)

        # State
        self.is_recording = False
        self.mic_device: Optional[int] = None
        self.language = "nl"  # Default to Dutch
        self.whisper_model = "medium"
        self.settings_window = None
        self.notes_window = None

        # Components
        self.recorder: Optional[AudioRecorder] = None
        self.transcriber: Optional[Transcriber] = None
        self.audio_buffer: Optional[np.ndarray] = None
        self.transcript: str = ""

        self._create_widgets()

    def _create_widgets(self):
        """Create UI."""
        # Top bar
        top_frame = ctk.CTkFrame(self)
        top_frame.pack(fill="x", padx=10, pady=10)

        # Status
        self.status_frame = ctk.CTkFrame(top_frame)
        self.status_frame.pack(side="left", padx=5)

        self.status_dot = ctk.CTkLabel(self.status_frame, text="●", font=ctk.CTkFont(size=16), text_color="gray")
        self.status_dot.pack(side="left", padx=5)

        self.status_label = ctk.CTkLabel(self.status_frame, text="Ready", font=ctk.CTkFont(size=14, weight="bold"))
        self.status_label.pack(side="left")

        # Settings button
        ctk.CTkButton(top_frame, text="⚙ Settings", width=100, command=self._open_settings).pack(side="right", padx=5)

        # Main content - split view
        content_frame = ctk.CTkFrame(self, fg_color="transparent")
        content_frame.pack(fill="both", expand=True, padx=10, pady=5)
        content_frame.grid_columnconfigure(0, weight=1)
        content_frame.grid_columnconfigure(1, weight=1)
        content_frame.grid_rowconfigure(0, weight=1)

        # Left: User notes
        notes_frame = ctk.CTkFrame(content_frame)
        notes_frame.grid(row=0, column=0, sticky="nsew", padx=(0, 5))

        ctk.CTkLabel(notes_frame, text="Your Notes", font=ctk.CTkFont(size=14, weight="bold")).pack(anchor="w", padx=10, pady=(10, 5))

        self.user_notes = ctk.CTkTextbox(notes_frame, font=ctk.CTkFont(size=13), wrap="word")
        self.user_notes.pack(fill="both", expand=True, padx=10, pady=(0, 10))

        # Right: Transcript
        transcript_frame = ctk.CTkFrame(content_frame)
        transcript_frame.grid(row=0, column=1, sticky="nsew", padx=(5, 0))

        ctk.CTkLabel(transcript_frame, text="Transcript (after recording)", font=ctk.CTkFont(size=14, weight="bold")).pack(anchor="w", padx=10, pady=(10, 5))

        self.transcript_text = ctk.CTkTextbox(transcript_frame, font=ctk.CTkFont(size=13), wrap="word", text_color="gray70")
        self.transcript_text.pack(fill="both", expand=True, padx=10, pady=(0, 10))
        self.transcript_text.configure(state="disabled")

        # Bottom controls
        controls_frame = ctk.CTkFrame(self)
        controls_frame.pack(fill="x", padx=10, pady=10)

        self.record_btn = ctk.CTkButton(
            controls_frame, text="● Start Recording",
            font=ctk.CTkFont(size=16, weight="bold"), height=50,
            fg_color="#d32f2f", hover_color="#b71c1c",
            command=self._toggle_recording
        )
        self.record_btn.pack(side="left", fill="x", expand=True, padx=(0, 5))

        self.enhance_btn = ctk.CTkButton(
            controls_frame, text="✎ Enhance Notes",
            font=ctk.CTkFont(size=16, weight="bold"), height=50,
            fg_color="#1976d2", hover_color="#1565c0",
            command=self._enhance_notes
        )
        self.enhance_btn.pack(side="right", fill="x", expand=True, padx=(5, 0))

    def _set_status(self, status: str, color: str = "gray"):
        self.status_label.configure(text=status)
        self.status_dot.configure(text_color=color)

    def _open_settings(self):
        if self.settings_window is None or not self.settings_window.winfo_exists():
            self.settings_window = SettingsModal(
                self, on_save=self._on_settings_save,
                current_language=self.language,
                current_model=self.whisper_model,
                current_device=self.mic_device
            )
        else:
            self.settings_window.focus()

    def _on_settings_save(self, mic_device, language, model):
        self.mic_device = mic_device
        self.language = language
        self.whisper_model = model
        print(f"Settings: device={mic_device}, language={language}, model={model}")

    def _toggle_recording(self):
        if not self.is_recording:
            if self.mic_device is None:
                self._open_settings()
                return
            self._start_recording()
        else:
            self._stop_recording()

    def _start_recording(self):
        # Clear previous transcript
        self.transcript = ""
        self.transcript_text.configure(state="normal")
        self.transcript_text.delete("1.0", "end")
        self.transcript_text.insert("1.0", "(Recording... transcript will appear when stopped)")
        self.transcript_text.configure(state="disabled")

        # Start recorder
        self.recorder = AudioRecorder(
            device_index=self.mic_device,
            on_error=lambda e: self.after(0, lambda: self._on_error(e))
        )
        self.recorder.start()

        self.is_recording = True
        self._set_status("Recording", "#4caf50")
        self.record_btn.configure(text="■ Stop Recording", fg_color="#4caf50", hover_color="#388e3c")

    def _stop_recording(self):
        if not self.recorder:
            return

        self._set_status("Processing...", "#ff9800")
        self.record_btn.configure(state="disabled")

        # Stop and get audio
        audio = self.recorder.stop()
        self.recorder = None
        self.audio_buffer = audio

        self.is_recording = False

        if len(audio) == 0:
            self._set_status("No audio recorded", "gray")
            self.record_btn.configure(state="normal", text="● Start Recording", fg_color="#d32f2f", hover_color="#b71c1c")
            return

        # Transcribe in background
        self._set_status("Transcribing...", "#ff9800")

        self.transcriber = Transcriber(TranscriberConfig(
            model_size=self.whisper_model,
            language=self.language
        ))

        self.transcriber.transcribe_async(
            audio,
            on_complete=lambda t: self.after(0, lambda: self._on_transcription_complete(t)),
            on_error=lambda e: self.after(0, lambda: self._on_error(e))
        )

    def _on_transcription_complete(self, transcript: str):
        self.transcript = transcript

        self.transcript_text.configure(state="normal")
        self.transcript_text.delete("1.0", "end")
        self.transcript_text.insert("1.0", transcript if transcript else "(No speech detected)")
        self.transcript_text.configure(state="disabled")

        self._set_status("Ready", "gray")
        self.record_btn.configure(state="normal", text="● Start Recording", fg_color="#d32f2f", hover_color="#b71c1c")

    def _on_error(self, error: str):
        self._set_status(f"Error: {error}", "red")
        self.record_btn.configure(state="normal", text="● Start Recording", fg_color="#d32f2f", hover_color="#b71c1c")

    def _enhance_notes(self):
        user_notes = self.user_notes.get("1.0", "end").strip()

        if not user_notes and not self.transcript:
            self._set_status("No notes or transcript", "gray")
            return

        # Open notes window
        if self.notes_window is None or not self.notes_window.winfo_exists():
            self.notes_window = NotesWindow(self)
        else:
            self.notes_window.focus()
            self.notes_window.clear()

        self._set_status("Enhancing notes...", "#ff9800")
        self.enhance_btn.configure(state="disabled")

        generator = NotesGenerator(
            config=OllamaConfig(),
            on_progress=lambda t: self.after(0, lambda: self.notes_window.append_text(t) if self.notes_window else None),
            on_complete=lambda _: self.after(0, self._on_enhance_complete),
            on_error=lambda e: self.after(0, lambda: self._on_enhance_error(e))
        )
        generator.enhance_notes(user_notes, self.transcript, self.language)

    def _on_enhance_complete(self):
        self._set_status("Ready", "gray")
        self.enhance_btn.configure(state="normal")
        if self.notes_window:
            self.notes_window.set_status("Done!")

    def _on_enhance_error(self, error: str):
        self._set_status("Ready", "gray")
        self.enhance_btn.configure(state="normal")
        if self.notes_window:
            self.notes_window.set_status(f"Error: {error}")

    def run(self):
        self.mainloop()

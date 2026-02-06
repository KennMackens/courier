"""
Ollama integration for generating meeting notes.

Connects to a local Ollama instance to summarize transcripts
and generate enhanced meeting notes.
"""

import threading
import requests
from typing import Optional, Callable
from dataclasses import dataclass


@dataclass
class OllamaConfig:
    """Configuration for Ollama."""
    base_url: str = "http://localhost:11434"
    model: str = "llama3.2"  # Default model, user can change
    timeout: int = 120  # Seconds


# Prompt for enhancing user notes with transcript context
ENHANCE_PROMPT_EN = """You are a meeting notes assistant. The user took brief notes during a meeting, and you have access to the meeting transcript (which may be imperfect due to automatic transcription).

Your task is to ENHANCE the user's notes by:
1. Starting with a concise meeting title on the first line (format: # Title Here)
2. Expanding bullet points with relevant details from the transcript
3. Adding any important points the user may have missed
4. Filling in names, numbers, dates, or specifics mentioned in the transcript
5. Organizing the notes into clear sections
6. Keeping the user's original structure and intent

IMPORTANT:
- Always start your response with a meeting title in the format "# Title" (5-10 words summarizing the main topic).
- Use standard markdown: # for headers, - or * for bullet points, **text** for bold. Do NOT use tables (|) or code fences (```).

The transcript quality may be poor - use it to extract meaning, not exact wording. Trust the user's notes for key topics.
{title_instruction}
USER'S NOTES:
{user_notes}

MEETING TRANSCRIPT (may contain errors):
{transcript}

ENHANCED MEETING NOTES:"""

ENHANCE_PROMPT_NL = """Je bent een assistent voor vergadernotities. De gebruiker heeft korte aantekeningen gemaakt tijdens een vergadering, en je hebt toegang tot het vergadertranscript (dat mogelijk onvolmaakt is door automatische transcriptie).

Je taak is om de aantekeningen van de gebruiker te VERBETEREN door:
1. Te beginnen met een beknopte vergadertitel op de eerste regel (formaat: # Titel Hier)
2. Opsommingstekens uit te breiden met relevante details uit het transcript
3. Belangrijke punten toe te voegen die de gebruiker mogelijk heeft gemist
4. Namen, nummers, data of specifieke details uit het transcript in te vullen
5. De notities in duidelijke secties te organiseren
6. De oorspronkelijke structuur en intentie van de gebruiker te behouden

BELANGRIJK:
- Begin je antwoord altijd met een vergadertitel in het formaat "# Titel" (5-10 woorden die het hoofdonderwerp samenvatten).
- Gebruik standaard markdown: # voor koppen, - of * voor opsommingen, **tekst** voor vet. Gebruik GEEN tabellen (|) of code blokken (```).

De kwaliteit van het transcript kan slecht zijn - gebruik het om betekenis te extraheren, niet exacte bewoordingen. Vertrouw op de aantekeningen van de gebruiker voor de hoofdonderwerpen.
{title_instruction}
AANTEKENINGEN GEBRUIKER:
{user_notes}

VERGADERTRANSCRIPT (kan fouten bevatten):
{transcript}

VERBETERDE VERGADERNOTITIES:"""

# Fallback prompt when only transcript is available (no user notes)
NOTES_PROMPT_EN = """You are a meeting notes assistant. Analyze the following meeting transcript and generate clear, structured notes.

IMPORTANT:
- Start with a concise meeting title in the format "# Title" (5-10 words summarizing the main topic).
- Use standard markdown: # for headers, - or * for bullet points, **text** for bold. Do NOT use tables (|) or code fences (```).
{title_instruction}
Include:
1. **Summary**: A brief 2-3 sentence overview of the meeting
2. **Key Points**: The main topics discussed (bullet points)
3. **Action Items**: Any tasks, assignments, or follow-ups mentioned (with owners if mentioned)
4. **Decisions Made**: Any decisions that were reached
5. **Questions/Open Items**: Any unresolved questions or items needing follow-up

Keep the notes concise but comprehensive. Use professional language.

TRANSCRIPT:
{transcript}

MEETING NOTES:"""

NOTES_PROMPT_NL = """Je bent een assistent voor vergadernotities. Analyseer het volgende vergadertranscript en genereer duidelijke, gestructureerde notities.

BELANGRIJK:
- Begin met een beknopte vergadertitel in het formaat "# Titel" (5-10 woorden die het hoofdonderwerp samenvatten).
- Gebruik standaard markdown: # voor koppen, - of * voor opsommingen, **tekst** voor vet. Gebruik GEEN tabellen (|) of code blokken (```).
{title_instruction}
Neem op:
1. **Samenvatting**: Een korte overview van 2-3 zinnen van de vergadering
2. **Belangrijkste Punten**: De hoofdonderwerpen die besproken zijn (opsommingstekens)
3. **Actiepunten**: Alle taken, opdrachten of follow-ups die genoemd zijn (met verantwoordelijken indien genoemd)
4. **Genomen Beslissingen**: Alle beslissingen die zijn genomen
5. **Vragen/Openstaande Punten**: Onopgeloste vragen of items die follow-up nodig hebben

Houd de notities beknopt maar volledig. Gebruik professionele taal.

TRANSCRIPT:
{transcript}

VERGADERNOTITIES:"""

ENHANCE_PROMPTS = {
    "en": ENHANCE_PROMPT_EN,
    "nl": ENHANCE_PROMPT_NL,
}

NOTES_PROMPTS = {
    "en": NOTES_PROMPT_EN,
    "nl": NOTES_PROMPT_NL,
}


class OllamaClient:
    """Client for interacting with local Ollama instance."""

    def __init__(self, config: Optional[OllamaConfig] = None):
        self.config = config or OllamaConfig()

    def is_available(self) -> bool:
        """Check if Ollama is running and accessible."""
        try:
            response = requests.get(
                f"{self.config.base_url}/api/tags",
                timeout=5
            )
            return response.status_code == 200
        except requests.RequestException:
            return False

    def list_models(self) -> list[str]:
        """List available models."""
        try:
            response = requests.get(
                f"{self.config.base_url}/api/tags",
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                return [model["name"] for model in data.get("models", [])]
        except requests.RequestException:
            pass
        return []

    def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        on_token: Optional[Callable[[str], None]] = None
    ) -> str:
        """
        Generate a response from Ollama.

        Args:
            prompt: The prompt to send
            model: Model to use (defaults to config.model)
            on_token: Optional callback for streaming tokens

        Returns:
            The complete generated response
        """
        model = model or self.config.model

        response = requests.post(
            f"{self.config.base_url}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": on_token is not None
            },
            timeout=self.config.timeout,
            stream=on_token is not None
        )

        if response.status_code != 200:
            raise Exception(f"Ollama error: {response.status_code} - {response.text}")

        if on_token:
            # Streaming response
            full_response = []
            for line in response.iter_lines():
                if line:
                    import json
                    data = json.loads(line)
                    token = data.get("response", "")
                    if token:
                        full_response.append(token)
                        on_token(token)
                    if data.get("done", False):
                        break
            return "".join(full_response)
        else:
            # Non-streaming response
            data = response.json()
            return data.get("response", "")


class NotesGenerator:
    """Generates meeting notes from transcripts using Ollama."""

    def __init__(
        self,
        config: Optional[OllamaConfig] = None,
        on_progress: Optional[Callable[[str], None]] = None,
        on_complete: Optional[Callable[[str], None]] = None,
        on_error: Optional[Callable[[str], None]] = None
    ):
        self.client = OllamaClient(config)
        self.config = config or OllamaConfig()
        self.on_progress = on_progress
        self.on_complete = on_complete
        self.on_error = on_error

        self._generation_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

    def enhance_notes(self, user_notes: str, transcript: str, language: str = "en", user_title: str = "") -> None:
        """
        Enhance user notes with transcript context in a background thread.

        Args:
            user_notes: The user's handwritten notes during the meeting
            transcript: The auto-generated meeting transcript
            language: Language code for the prompt
            user_title: Optional user-provided title to preserve
        """
        if self._generation_thread and self._generation_thread.is_alive():
            return  # Already generating

        self._stop_event.clear()
        self._generation_thread = threading.Thread(
            target=self._enhance_notes_thread,
            args=(user_notes, transcript, language, user_title),
            daemon=True
        )
        self._generation_thread.start()

    def _enhance_notes_thread(self, user_notes: str, transcript: str, language: str, user_title: str = ""):
        """Background thread for note enhancement."""
        try:
            # Check if Ollama is available
            if not self.client.is_available():
                if self.on_error:
                    self.on_error("Ollama is not running. Please start Ollama first.")
                return

            # Check if model is available
            available_models = self.client.list_models()
            if not available_models:
                if self.on_error:
                    self.on_error("No models found. Please pull a model first (e.g., 'ollama pull llama3.2')")
                return

            # Use configured model or first available
            model = self.config.model
            if model not in available_models:
                model = available_models[0]
                if self.on_progress:
                    self.on_progress(f"Using model: {model}\n\n")

            # Build title instruction based on whether user provided a title
            if user_title:
                title_instruction = f'\nUse this exact title: # {user_title}\n'
            else:
                title_instruction = ''

            # Choose prompt based on whether we have user notes
            if user_notes.strip():
                # Enhance user notes with transcript
                prompt_template = ENHANCE_PROMPTS.get(language, ENHANCE_PROMPT_EN)
                prompt = prompt_template.format(
                    user_notes=user_notes,
                    transcript=transcript or "(No transcript available)",
                    title_instruction=title_instruction
                )
            else:
                # No user notes - generate from transcript only
                prompt_template = NOTES_PROMPTS.get(language, NOTES_PROMPT_EN)
                prompt = prompt_template.format(
                    transcript=transcript,
                    title_instruction=title_instruction
                )

            # Generate with streaming
            full_response = []

            def handle_token(token: str):
                if self._stop_event.is_set():
                    raise InterruptedError("Generation cancelled")
                full_response.append(token)
                if self.on_progress:
                    self.on_progress(token)

            self.client.generate(prompt, model=model, on_token=handle_token)

            if self.on_complete:
                self.on_complete("".join(full_response))

        except InterruptedError:
            pass  # Cancelled by user
        except Exception as e:
            if self.on_error:
                self.on_error(str(e))

    def generate_notes(self, transcript: str, language: str = "en") -> None:
        """
        Generate notes from transcript only (legacy method).

        Args:
            transcript: The meeting transcript
            language: Language code for the prompt
        """
        self.enhance_notes("", transcript, language)

    def stop(self):
        """Stop the current generation."""
        self._stop_event.set()
        if self._generation_thread:
            self._generation_thread.join(timeout=2.0)
            self._generation_thread = None

    def is_generating(self) -> bool:
        """Check if currently generating."""
        return self._generation_thread is not None and self._generation_thread.is_alive()

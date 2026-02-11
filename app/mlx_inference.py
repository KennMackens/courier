"""
MLX inference for generating meeting notes.

Uses Apple's MLX framework for local LLM inference on Apple Silicon,
providing the same interface as ollama.py for seamless integration.
"""

import sys
import threading
from pathlib import Path
from typing import Optional, Callable
from dataclasses import dataclass

# Import prompt templates
from .prompts import (
    ENHANCE_SYSTEM_PROMPTS, NOTES_SYSTEM_PROMPTS,
    ENHANCE_SYSTEM_PROMPT_EN, NOTES_SYSTEM_PROMPT_EN,
)
from .constants import SUPPORTED_ENHANCEMENT_MODEL_ID


def _debug(msg: str) -> None:
    """Print debug message to stderr to avoid corrupting IPC stdout."""
    print(msg, file=sys.stderr, flush=True)


# Default MLX model for note enhancement (macOS Apple Silicon)
DEFAULT_MLX_MODEL = SUPPORTED_ENHANCEMENT_MODEL_ID

# Global lock to prevent concurrent MLX/Metal GPU operations
# Metal can crash if multiple command encoders are active simultaneously
_mlx_global_lock = threading.Lock()


@dataclass
class MLXConfig:
    """Configuration for MLX inference."""
    model_path: str = ""  # Path to local MLX model directory
    max_tokens: int = 2048  # Maximum tokens to generate
    temperature: float = 0.7  # Sampling temperature
    top_p: float = 0.9  # Top-p (nucleus) sampling
    repetition_penalty: float = 1.1  # Penalty for repeating tokens
    chunk_window_minutes: int = 8  # Time-based chunk size for long transcripts
    chunk_min_duration_minutes: int = 10  # Minimum transcript duration before chunking
    chunk_max_count: int = 24  # Guardrail: reject extremely large jobs
    chunk_retry_attempts: int = 2  # Retry per chunk on transient failures

    @staticmethod
    def models_directory() -> Path:
        """Get the models storage directory."""
        return Path.home() / "Library" / "Application Support" / "Otto" / "models"

    @staticmethod
    def default_model_path() -> str:
        """Get default model path (Fietje-2 Chat 6-bit)."""
        models_dir = MLXConfig.models_directory()
        # Convert HuggingFace model ID to directory name
        model_dir_name = DEFAULT_MLX_MODEL.replace("/", "--")
        return str(models_dir / model_dir_name)


class MLXClient:
    """Client for MLX-based LLM inference on Apple Silicon."""

    def __init__(self, config: Optional[MLXConfig] = None):
        self.config = config or MLXConfig()
        self._model = None
        self._tokenizer = None
        self._model_loaded = False
        self._load_lock = threading.Lock()

    def is_available(self) -> bool:
        """Check if MLX is available and model exists."""
        # Check if MLX is installed
        try:
            import mlx.core as mx
            import mlx_lm
        except ImportError as e:
            _debug(f"[MLX] Import failed: {e}")
            return False

        # Check if model path exists and contains model files
        if not self.config.model_path:
            _debug("[MLX] No model path configured")
            return False

        model_path = Path(self.config.model_path)
        if not model_path.exists():
            _debug(f"[MLX] Model path does not exist: {model_path}")
            return False

        # Check for config.json (required)
        has_config = (model_path / "config.json").exists()
        if not has_config:
            _debug(f"[MLX] config.json not found in {model_path}")
            return False

        # Check for weight files - support multiple formats like ModelManager does
        weight_files = ["weights.safetensors", "model.safetensors", "pytorch_model.bin"]
        has_weights = any((model_path / f).exists() for f in weight_files)
        if not has_weights:
            # Check for sharded weights (e.g., model-00001-of-00008.safetensors)
            has_weights = any(model_path.glob("*.safetensors"))

        if not has_weights:
            _debug(f"[MLX] No weight files found in {model_path}")
            return False

        # Check for tokenizer
        tokenizer_files = ["tokenizer.json", "tokenizer_config.json", "tokenizer.model"]
        has_tokenizer = any((model_path / f).exists() for f in tokenizer_files)

        if not has_tokenizer:
            _debug(f"[MLX] No tokenizer files found in {model_path}")
            return False

        return True

    def is_model_loaded(self) -> bool:
        """Check if model is currently loaded in memory."""
        return self._model_loaded and self._model is not None

    def load_model(self) -> bool:
        """
        Load the MLX model into memory.

        Note: Caller should hold _mlx_global_lock if calling from generate().

        Returns:
            True if model loaded successfully, False otherwise
        """
        with self._load_lock:
            if self._model_loaded:
                return True

            if not self.is_available():
                return False

            try:
                _debug(f"Loading MLX model from: {self.config.model_path}")
                from mlx_lm import load

                self._model, self._tokenizer = load(self.config.model_path)
                self._model_loaded = True
                _debug("MLX model loaded successfully")
                return True
            except Exception as e:
                _debug(f"[MLX] Failed to load model: {e}")
                import traceback
                _debug(traceback.format_exc())
                self._model = None
                self._tokenizer = None
                self._model_loaded = False
                return False

    def unload_model(self) -> None:
        """Unload model from memory to free resources."""
        with self._load_lock:
            self._model = None
            self._tokenizer = None
            self._model_loaded = False

            # Force garbage collection to free GPU memory
            import gc
            gc.collect()

    def _create_sampler_and_processors(self):
        """Create sampler and logits processors based on config."""
        from mlx_lm.sample_utils import make_sampler, make_logits_processors

        sampler = make_sampler(
            temp=self.config.temperature,
            top_p=self.config.top_p,
        )

        logits_processors = make_logits_processors(
            repetition_penalty=self.config.repetition_penalty,
        )

        return sampler, logits_processors

    def _format_prompt(
        self,
        prompt: str,
        system_prompt: Optional[str] = None
    ) -> str:
        """
        Format prompt using the model's chat template with proper role separation.

        Args:
            prompt: The user message content
            system_prompt: Optional system instructions (task description, format requirements)

        Returns:
            Formatted prompt string for the model
        """
        # Try to use the tokenizer's chat template for instruct models
        if hasattr(self._tokenizer, 'apply_chat_template'):
            try:
                messages = []
                if system_prompt:
                    messages.append({"role": "system", "content": system_prompt})
                messages.append({"role": "user", "content": prompt})

                formatted = self._tokenizer.apply_chat_template(
                    messages,
                    tokenize=False,
                    add_generation_prompt=True
                )
                return formatted
            except Exception:
                pass  # Fall back to raw prompt

        # Fallback: concatenate system and user prompts
        if system_prompt:
            return f"{system_prompt}\n\n{prompt}"
        return prompt

    def generate(
        self,
        prompt: str,
        on_token: Optional[Callable[[str], None]] = None,
        system_prompt: Optional[str] = None
    ) -> str:
        """
        Generate a response using the MLX model.

        Args:
            prompt: The user message content
            on_token: Optional callback for streaming tokens
            system_prompt: Optional system instructions for proper role separation

        Returns:
            The complete generated response
        """
        # Use global lock to prevent concurrent Metal GPU operations
        # This ensures only one MLX operation runs at a time
        with _mlx_global_lock:
            # Ensure model is loaded
            if not self.load_model():
                raise RuntimeError("Model not available. Please download the model first.")
            try:
                from mlx_lm import generate as mlx_generate, stream_generate

                # Format prompt using chat template with proper role separation
                formatted_prompt = self._format_prompt(prompt, system_prompt)

                sampler, logits_processors = self._create_sampler_and_processors()

                if on_token:
                    # Streaming generation
                    return self._generate_streaming(formatted_prompt, on_token, sampler, logits_processors)
                else:
                    # Non-streaming generation
                    response = mlx_generate(
                        self._model,
                        self._tokenizer,
                        prompt=formatted_prompt,
                        max_tokens=self.config.max_tokens,
                        sampler=sampler,
                        logits_processors=logits_processors,
                        verbose=False
                    )
                    return response

            except Exception as e:
                raise RuntimeError(f"MLX generation failed: {e}")

    def _generate_streaming(
        self,
        prompt: str,
        on_token: Callable[[str], None],
        sampler,
        logits_processors,
    ) -> str:
        """Generate with streaming token output."""
        from mlx_lm import stream_generate

        full_response = []
        token_count = 0

        _debug(f"Starting streaming generation, max_tokens={self.config.max_tokens}")

        try:
            # Use stream_generate for token-by-token output
            for response in stream_generate(
                self._model,
                self._tokenizer,
                prompt=prompt,
                max_tokens=self.config.max_tokens,
                sampler=sampler,
                logits_processors=logits_processors,
            ):
                # response.text contains the newly generated text segment
                if response.text:
                    full_response.append(response.text)
                    on_token(response.text)
                    token_count += 1

                    # Log progress periodically
                    if token_count % 100 == 0:
                        _debug(f"Generated {token_count} tokens...")
        except Exception as e:
            _debug(f"Error during streaming generation: {e}")
            import traceback
            _debug(traceback.format_exc())
            raise

        _debug(f"Streaming generation complete: {token_count} tokens")
        return "".join(full_response)


class MLXNotesGenerator:
    """Generates meeting notes from transcripts using MLX."""

    def __init__(
        self,
        config: Optional[MLXConfig] = None,
        on_progress: Optional[Callable[[str], None]] = None,
        on_complete: Optional[Callable[[str], None]] = None,
        on_error: Optional[Callable[[str], None]] = None
    ):
        self.client = MLXClient(config)
        self.config = config or MLXConfig()
        self.on_progress = on_progress
        self.on_complete = on_complete
        self.on_error = on_error

        self._generation_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

    def enhance_notes(
        self,
        user_notes: str,
        transcript: str,
        language: str = "nl",
        user_title: str = "",
        transcript_segments: Optional[list[dict[str, float | str]]] = None,
    ) -> None:
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
            args=(user_notes, transcript, language, user_title, transcript_segments),
            daemon=True
        )
        self._generation_thread.start()

    def _normalize_transcript_segments(
        self,
        transcript_segments: Optional[list[dict[str, float | str]]]
    ) -> list[dict[str, float | str]]:
        """Normalize and validate transcript segment metadata."""
        if not transcript_segments:
            return []

        normalized: list[dict[str, float | str]] = []
        for segment in transcript_segments:
            if not isinstance(segment, dict):
                continue

            text = str(segment.get("text", "")).strip()
            if not text:
                continue

            try:
                start = float(segment.get("start", 0.0))
                end = float(segment.get("end", start))
            except (TypeError, ValueError):
                continue

            if end < start:
                end = start

            normalized.append({
                "start": start,
                "end": end,
                "text": text,
            })

        normalized.sort(key=lambda entry: float(entry["start"]))
        return normalized

    def _format_timestamp(self, seconds: float) -> str:
        """Format seconds as HH:MM:SS or MM:SS."""
        total_seconds = max(0, int(round(seconds)))
        hours, remainder = divmod(total_seconds, 3600)
        minutes, secs = divmod(remainder, 60)
        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{secs:02d}"
        return f"{minutes:02d}:{secs:02d}"

    def _build_time_chunks(
        self,
        transcript_segments: list[dict[str, float | str]]
    ) -> list[list[dict[str, float | str]]]:
        """Split timestamped transcript segments into time-window chunks."""
        if not transcript_segments:
            return []

        chunk_window_seconds = max(1, self.config.chunk_window_minutes * 60)
        chunks: list[list[dict[str, float | str]]] = []
        current_chunk: list[dict[str, float | str]] = []
        current_chunk_start = float(transcript_segments[0]["start"])

        for segment in transcript_segments:
            if self._stop_event.is_set():
                raise InterruptedError("Generation cancelled")

            segment_start = float(segment["start"])
            segment_end = float(segment["end"])

            if not current_chunk:
                current_chunk = [segment]
                current_chunk_start = segment_start
                continue

            if segment_end - current_chunk_start <= chunk_window_seconds:
                current_chunk.append(segment)
            else:
                chunks.append(current_chunk)
                current_chunk = [segment]
                current_chunk_start = segment_start

        if current_chunk:
            chunks.append(current_chunk)

        if len(chunks) > self.config.chunk_max_count:
            raise RuntimeError(
                f"Transcript produced {len(chunks)} chunks, exceeding limit of {self.config.chunk_max_count}."
            )

        return chunks

    def _summarize_chunk(
        self,
        chunk: list[dict[str, float | str]],
        chunk_index: int,
        total_chunks: int,
        language: str,
    ) -> str:
        """Generate a compact summary for one transcript chunk."""
        chunk_lines = []
        for segment in chunk:
            timestamp = self._format_timestamp(float(segment["start"]))
            chunk_lines.append(f"[{timestamp}] {segment['text']}")
        chunk_transcript = "\n".join(chunk_lines)

        start_label = self._format_timestamp(float(chunk[0]["start"]))
        end_label = self._format_timestamp(float(chunk[-1]["end"]))

        if language == "nl":
            chunk_prompt = f"""Maak een compacte samenvatting van dit transcript-fragment voor latere aggregatie.
Geef alleen markdown bullet points met:
- Belangrijkste punten
- Beslissingen
- Actiepunten
- Open vragen (indien aanwezig)

Fragment {chunk_index}/{total_chunks}
Tijd: {start_label} - {end_label}

TRANSCRIPT:
{chunk_transcript}"""
        else:
            chunk_prompt = f"""Create a compact summary of this transcript chunk for downstream aggregation.
Return markdown bullet points only with:
- Key points
- Decisions
- Action items
- Open questions (if any)

Chunk {chunk_index}/{total_chunks}
Time: {start_label} - {end_label}

TRANSCRIPT:
{chunk_transcript}"""

        system_prompt = NOTES_SYSTEM_PROMPTS.get(language, NOTES_SYSTEM_PROMPT_EN)
        attempts = max(1, self.config.chunk_retry_attempts)
        last_error: Optional[Exception] = None

        for attempt in range(1, attempts + 1):
            try:
                summary = self.client.generate(chunk_prompt, system_prompt=system_prompt).strip()
                if summary:
                    return summary
                raise RuntimeError("Chunk summary was empty")
            except Exception as error:
                last_error = error
                _debug(
                    f"Chunk {chunk_index}/{total_chunks} summarization failed "
                    f"(attempt {attempt}/{attempts}): {error}"
                )

        raise RuntimeError(
            f"Failed to summarize chunk {chunk_index}/{total_chunks}: {last_error}"
        )

    def _enhance_notes_thread(
        self,
        user_notes: str,
        transcript: str,
        language: str,
        user_title: str = "",
        transcript_segments: Optional[list[dict[str, float | str]]] = None,
    ) -> None:
        """Background thread for note enhancement."""
        try:
            _debug(f"Starting enhancement thread: notes={len(user_notes)} chars, transcript={len(transcript)} chars")

            # Check if MLX model is available
            if not self.client.is_available():
                _debug("MLX model not available")
                if self.on_error:
                    self.on_error(
                        "MLX model not found. Please download the model first."
                    )
                return

            # Notify that we're loading the model (if not already loaded)
            if not self.client.is_model_loaded():
                _debug("Loading MLX model...")
                # Note: Don't send "Loading model..." through on_progress as it would
                # be concatenated to the notes. The frontend handles loading state separately.

            # Generate with streaming using proper role separation
            full_response = []

            def handle_token(token: str):
                if self._stop_event.is_set():
                    raise InterruptedError("Generation cancelled")
                full_response.append(token)
                if self.on_progress:
                    self.on_progress(token)

            # Build title instruction for system prompt
            if user_title:
                title_instruction = f'\nUse this exact title: # {user_title}'
            else:
                title_instruction = ''

            normalized_segments = self._normalize_transcript_segments(transcript_segments)
            should_chunk = False
            if normalized_segments:
                total_duration_seconds = float(normalized_segments[-1]["end"]) - float(normalized_segments[0]["start"])
                chunk_threshold_seconds = self.config.chunk_min_duration_minutes * 60
                should_chunk = total_duration_seconds >= chunk_threshold_seconds

            if should_chunk:
                _debug(
                    f"Using timestamp-based chunked summarization pipeline "
                    f"({len(normalized_segments)} segments)"
                )
                chunks = self._build_time_chunks(normalized_segments)
                chunk_summaries: list[str] = []
                total_chunks = len(chunks)

                for index, chunk in enumerate(chunks, start=1):
                    if self._stop_event.is_set():
                        raise InterruptedError("Generation cancelled")
                    chunk_summary = self._summarize_chunk(chunk, index, total_chunks, language)
                    chunk_summaries.append(f"## Chunk {index}\n{chunk_summary}")

                summaries_block = "\n\n".join(chunk_summaries)
                if user_notes.strip():
                    system_prompt = ENHANCE_SYSTEM_PROMPTS.get(language, ENHANCE_SYSTEM_PROMPT_EN)
                    if title_instruction:
                        system_prompt = system_prompt + title_instruction
                    user_content = f"""USER'S NOTES:
{user_notes}

CHUNK SUMMARIES (chronological):
{summaries_block}"""
                else:
                    system_prompt = NOTES_SYSTEM_PROMPTS.get(language, NOTES_SYSTEM_PROMPT_EN)
                    if title_instruction:
                        system_prompt = system_prompt + title_instruction
                    user_content = f"""CHUNK SUMMARIES (chronological):
{summaries_block}"""
            else:
                # Choose system prompt and user content based on whether we have user notes
                if user_notes.strip():
                    # Enhance user notes with transcript
                    system_prompt = ENHANCE_SYSTEM_PROMPTS.get(language, ENHANCE_SYSTEM_PROMPT_EN)
                    if title_instruction:
                        system_prompt = system_prompt + title_instruction
                    # User content: just the notes and transcript
                    user_content = f"""USER'S NOTES:
{user_notes}

MEETING TRANSCRIPT (may contain errors):
{transcript or "(No transcript available)"}"""
                else:
                    # No user notes - generate from transcript only
                    system_prompt = NOTES_SYSTEM_PROMPTS.get(language, NOTES_SYSTEM_PROMPT_EN)
                    if title_instruction:
                        system_prompt = system_prompt + title_instruction
                    # User content: just the transcript
                    user_content = f"""TRANSCRIPT:
{transcript}"""

            _debug("Starting MLX generation with system/user role separation...")
            self.client.generate(user_content, on_token=handle_token, system_prompt=system_prompt)
            _debug(f"MLX generation finished: {len(full_response)} tokens")

            if self.on_complete:
                self.on_complete("".join(full_response))

        except InterruptedError:
            _debug("Generation cancelled by user")
        except Exception as e:
            _debug(f"Enhancement error: {e}")
            import traceback
            _debug(traceback.format_exc())
            if self.on_error:
                self.on_error(str(e))

    def generate_notes(self, transcript: str, language: str = "nl") -> None:
        """
        Generate notes from transcript only (legacy method).

        Args:
            transcript: The meeting transcript
            language: Language code for the prompt
        """
        self.enhance_notes("", transcript, language)

    def stop(self) -> None:
        """Stop the current generation."""
        self._stop_event.set()
        if self._generation_thread:
            self._generation_thread.join(timeout=2.0)
            self._generation_thread = None

    def is_generating(self) -> bool:
        """Check if currently generating."""
        return (
            self._generation_thread is not None
            and self._generation_thread.is_alive()
        )

    def preload_model(self) -> bool:
        """
        Preload the model into memory for faster first generation.

        Returns:
            True if model loaded successfully
        """
        return self.client.load_model()

    def unload_model(self) -> None:
        """Unload model from memory to free resources."""
        self.client.unload_model()

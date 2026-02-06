"""
MLX inference for generating meeting notes.

Uses Apple's MLX framework for local LLM inference on Apple Silicon,
providing the same interface as ollama.py for seamless integration.
"""

import sys
import threading
import os
from pathlib import Path
from typing import Optional, Callable
from dataclasses import dataclass, field

# Import prompts from ollama module to avoid duplication
from .ollama import ENHANCE_PROMPTS, NOTES_PROMPTS, ENHANCE_PROMPT_EN, NOTES_PROMPT_EN


def _debug(msg: str) -> None:
    """Print debug message to stderr to avoid corrupting IPC stdout."""
    print(msg, file=sys.stderr, flush=True)


# Default MLX model for note enhancement (macOS Apple Silicon)
DEFAULT_MLX_MODEL = "mlx-community/Qwen2.5-3B-4bit"

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

    @staticmethod
    def models_directory() -> Path:
        """Get the models storage directory."""
        return Path.home() / "Library" / "Application Support" / "courier-desktop" / "models"

    @staticmethod
    def default_model_path() -> str:
        """Get default model path (Qwen2.5 3B Instruct 4-bit)."""
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

    def _format_prompt(self, prompt: str) -> str:
        """Format prompt using the model's chat template if available."""
        # Try to use the tokenizer's chat template for instruct models
        if hasattr(self._tokenizer, 'apply_chat_template'):
            try:
                messages = [{"role": "user", "content": prompt}]
                formatted = self._tokenizer.apply_chat_template(
                    messages,
                    tokenize=False,
                    add_generation_prompt=True
                )
                return formatted
            except Exception:
                pass  # Fall back to raw prompt
        return prompt

    def generate(
        self,
        prompt: str,
        on_token: Optional[Callable[[str], None]] = None
    ) -> str:
        """
        Generate a response using the MLX model.

        Args:
            prompt: The prompt to send
            on_token: Optional callback for streaming tokens

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

                # Format prompt using chat template if available
                formatted_prompt = self._format_prompt(prompt)

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
        language: str = "en",
        user_title: str = ""
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
            args=(user_notes, transcript, language, user_title),
            daemon=True
        )
        self._generation_thread.start()

    def _enhance_notes_thread(
        self,
        user_notes: str,
        transcript: str,
        language: str,
        user_title: str = ""
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

            _debug("Starting MLX generation...")
            self.client.generate(prompt, on_token=handle_token)
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

    def generate_notes(self, transcript: str, language: str = "en") -> None:
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

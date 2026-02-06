"""
Model download manager for MLX models from HuggingFace.

Handles downloading, caching, and managing MLX-format models
from HuggingFace Hub for local LLM inference.
"""

import json
import shutil
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Callable, Optional

from huggingface_hub import snapshot_download
from huggingface_hub.utils import (
    HfHubHTTPError,
    RepositoryNotFoundError,
    EntryNotFoundError,
)


@dataclass
class DownloadProgress:
    """Progress information for model download."""
    model_id: str
    bytes_downloaded: int = 0
    total_bytes: int = 0
    percentage: float = 0.0
    speed_bytes_per_sec: float = 0.0
    status: str = "pending"  # pending, downloading, completed, failed, cancelled
    error: Optional[str] = None


@dataclass
class ModelInfo:
    """Metadata about a downloaded model."""
    model_id: str
    local_path: str
    download_date: str
    size_bytes: int
    version: Optional[str] = None


@dataclass
class ModelManagerConfig:
    """Configuration for the model manager."""
    models_dir: str = ""

    @staticmethod
    def default_models_dir() -> str:
        """Get default model storage path."""
        app_support = Path.home() / "Library" / "Application Support" / "courier-desktop" / "models"
        return str(app_support)


class ModelManager:
    """
    Manages downloading and caching of MLX models from HuggingFace Hub.

    Supports progress tracking, cancellation, and resumable downloads.
    """

    # Files required for a valid MLX model
    REQUIRED_FILES = ["config.json"]
    WEIGHT_FILES = ["weights.safetensors", "model.safetensors", "pytorch_model.bin"]
    TOKENIZER_FILES = ["tokenizer.json", "tokenizer_config.json", "tokenizer.model"]

    def __init__(self, config: Optional[ModelManagerConfig] = None):
        self.config = config or ModelManagerConfig()
        if not self.config.models_dir:
            self.config.models_dir = ModelManagerConfig.default_models_dir()

        self._models_dir = Path(self.config.models_dir)
        self._manifest_path = self._models_dir / "manifest.json"

        self._current_download: Optional[DownloadProgress] = None
        self._cancel_event = threading.Event()
        self._download_thread: Optional[threading.Thread] = None
        self._download_lock = threading.Lock()

        # Ensure models directory exists
        self._models_dir.mkdir(parents=True, exist_ok=True)

        # Load or create manifest
        self._manifest = self._load_manifest()

    def _load_manifest(self) -> dict:
        """Load the models manifest from disk."""
        if self._manifest_path.exists():
            try:
                with open(self._manifest_path, "r") as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                return {"models": {}}
        return {"models": {}}

    def _save_manifest(self) -> None:
        """Save the models manifest to disk."""
        with open(self._manifest_path, "w") as f:
            json.dump(self._manifest, f, indent=2)

    def _model_id_to_dir_name(self, model_id: str) -> str:
        """Convert HuggingFace model ID to local directory name."""
        # Replace / with -- for directory name
        return model_id.replace("/", "--")

    def _get_model_dir(self, model_id: str) -> Path:
        """Get the local directory path for a model."""
        dir_name = self._model_id_to_dir_name(model_id)
        return self._models_dir / dir_name

    def is_model_downloaded(self, model_id: str) -> bool:
        """
        Check if a model is fully downloaded and valid.

        Args:
            model_id: HuggingFace model ID (e.g., 'mlx-community/phi-3-mini-4k-instruct-mlx')

        Returns:
            True if the model exists and is valid
        """
        model_dir = self._get_model_dir(model_id)

        if not model_dir.exists():
            return False

        # Check for required config file
        if not (model_dir / "config.json").exists():
            return False

        # Check for at least one weight file
        has_weights = any((model_dir / f).exists() for f in self.WEIGHT_FILES)
        if not has_weights:
            # Check for sharded weights
            has_weights = any(model_dir.glob("*.safetensors"))

        if not has_weights:
            return False

        # Check for tokenizer
        has_tokenizer = any((model_dir / f).exists() for f in self.TOKENIZER_FILES)

        return has_tokenizer

    def get_model_path(self, model_id: str) -> Optional[str]:
        """
        Get the local filesystem path for a downloaded model.

        Args:
            model_id: HuggingFace model ID

        Returns:
            Path to model directory, or None if not downloaded
        """
        if self.is_model_downloaded(model_id):
            return str(self._get_model_dir(model_id))
        return None

    def get_model_info(self, model_id: str) -> Optional[ModelInfo]:
        """
        Get metadata about a downloaded model.

        Args:
            model_id: HuggingFace model ID

        Returns:
            ModelInfo if model exists, None otherwise
        """
        if model_id in self._manifest.get("models", {}):
            data = self._manifest["models"][model_id]
            return ModelInfo(
                model_id=model_id,
                local_path=data.get("local_path", ""),
                download_date=data.get("download_date", ""),
                size_bytes=data.get("size_bytes", 0),
                version=data.get("version"),
            )
        return None

    def list_downloaded_models(self) -> list[ModelInfo]:
        """
        List all downloaded models.

        Returns:
            List of ModelInfo for each downloaded model
        """
        models = []
        for model_id in self._manifest.get("models", {}):
            info = self.get_model_info(model_id)
            if info and self.is_model_downloaded(model_id):
                models.append(info)
        return models

    def download_model(
        self,
        model_id: str,
        on_progress: Optional[Callable[[DownloadProgress], None]] = None,
        blocking: bool = True,
    ) -> Optional[str]:
        """
        Download a model from HuggingFace Hub.

        Args:
            model_id: HuggingFace model ID (e.g., 'mlx-community/Llama-3.2-1B-Instruct-4bit')
            on_progress: Optional callback for progress updates
            blocking: If True, wait for download to complete. If False, return immediately.

        Returns:
            Path to downloaded model (if blocking=True and successful), None otherwise
        """
        with self._download_lock:
            if self._download_thread and self._download_thread.is_alive():
                raise RuntimeError("Another download is already in progress")

            self._cancel_event.clear()
            self._current_download = DownloadProgress(
                model_id=model_id,
                status="pending"
            )

        if blocking:
            return self._download_model_sync(model_id, on_progress)
        else:
            self._download_thread = threading.Thread(
                target=self._download_model_sync,
                args=(model_id, on_progress),
                daemon=True
            )
            self._download_thread.start()
            return None

    def _download_model_sync(
        self,
        model_id: str,
        on_progress: Optional[Callable[[DownloadProgress], None]] = None,
    ) -> Optional[str]:
        """Synchronous model download implementation."""
        model_dir = self._get_model_dir(model_id)

        try:
            # Update status
            self._current_download.status = "downloading"
            if on_progress:
                on_progress(self._current_download)

            # Get model info to estimate size
            try:
                api = HfApi()
                repo_info = api.repo_info(model_id)
                # Estimate total size from siblings
                total_size = sum(
                    s.size for s in repo_info.siblings
                    if s.size is not None
                )
                self._current_download.total_bytes = total_size
            except Exception:
                # Continue without size estimate
                pass

            # Track progress using a custom callback
            start_time = time.time()
            last_update_time = start_time
            bytes_at_last_update = 0

            def progress_callback(current: int, total: int):
                nonlocal last_update_time, bytes_at_last_update

                if self._cancel_event.is_set():
                    raise InterruptedError("Download cancelled")

                now = time.time()
                elapsed = now - last_update_time

                self._current_download.bytes_downloaded = current
                if total > 0:
                    self._current_download.total_bytes = total
                    self._current_download.percentage = (current / total) * 100

                # Calculate speed (update every 0.5s)
                if elapsed >= 0.5:
                    bytes_delta = current - bytes_at_last_update
                    self._current_download.speed_bytes_per_sec = bytes_delta / elapsed
                    last_update_time = now
                    bytes_at_last_update = current

                if on_progress:
                    on_progress(self._current_download)

            # Download using huggingface_hub
            # The library handles resumable downloads automatically
            local_dir = snapshot_download(
                repo_id=model_id,
                local_dir=str(model_dir),
                local_dir_use_symlinks=False,
                resume_download=True,
            )

            if self._cancel_event.is_set():
                raise InterruptedError("Download cancelled")

            # Calculate final size
            total_size = sum(
                f.stat().st_size for f in model_dir.rglob("*") if f.is_file()
            )

            # Update manifest
            self._manifest.setdefault("models", {})[model_id] = {
                "local_path": str(model_dir),
                "download_date": datetime.now().isoformat(),
                "size_bytes": total_size,
                "version": None,  # Could be enhanced to track git commit
            }
            self._save_manifest()

            # Update progress
            self._current_download.status = "completed"
            self._current_download.bytes_downloaded = total_size
            self._current_download.total_bytes = total_size
            self._current_download.percentage = 100.0
            if on_progress:
                on_progress(self._current_download)

            return str(model_dir)

        except InterruptedError:
            self._current_download.status = "cancelled"
            if on_progress:
                on_progress(self._current_download)
            return None

        except RepositoryNotFoundError:
            self._current_download.status = "failed"
            self._current_download.error = f"Model '{model_id}' not found on HuggingFace"
            if on_progress:
                on_progress(self._current_download)
            return None

        except Exception as e:
            self._current_download.status = "failed"
            self._current_download.error = str(e)
            if on_progress:
                on_progress(self._current_download)
            return None

    def get_download_progress(self) -> Optional[DownloadProgress]:
        """
        Get the current download progress.

        Returns:
            DownloadProgress if a download is active, None otherwise
        """
        return self._current_download

    def cancel_download(self) -> bool:
        """
        Cancel the current download.

        Returns:
            True if a download was cancelled, False if no download was active
        """
        if self._download_thread and self._download_thread.is_alive():
            self._cancel_event.set()
            self._download_thread.join(timeout=5.0)
            return True
        return False

    def delete_model(self, model_id: str) -> bool:
        """
        Delete a downloaded model.

        Args:
            model_id: HuggingFace model ID

        Returns:
            True if model was deleted, False if it didn't exist
        """
        model_dir = self._get_model_dir(model_id)

        if not model_dir.exists():
            return False

        try:
            shutil.rmtree(model_dir)

            # Remove from manifest
            if model_id in self._manifest.get("models", {}):
                del self._manifest["models"][model_id]
                self._save_manifest()

            return True
        except Exception:
            return False

    def scan_local_models(self) -> list[ModelInfo]:
        """
        Scan the models directory for any valid models (including manually placed ones).

        This finds models that weren't downloaded through the manager but were
        placed directly in the models directory.

        Returns:
            List of ModelInfo for each discovered model
        """
        discovered = []

        if not self._models_dir.exists():
            return discovered

        for item in self._models_dir.iterdir():
            if not item.is_dir():
                continue

            # Skip hidden directories
            if item.name.startswith("."):
                continue

            # Check if it's a valid model directory
            has_config = (item / "config.json").exists()
            has_weights = any((item / f).exists() for f in self.WEIGHT_FILES)
            if not has_weights:
                has_weights = any(item.glob("*.safetensors"))
            has_tokenizer = any((item / f).exists() for f in self.TOKENIZER_FILES)

            if has_config and has_weights and has_tokenizer:
                # Determine model_id: either from manifest or use directory name
                model_id = None
                for mid, info in self._manifest.get("models", {}).items():
                    if info.get("local_path") == str(item):
                        model_id = mid
                        break

                if not model_id:
                    # Use directory name as model_id for manually placed models
                    model_id = item.name

                # Calculate size if not in manifest
                if model_id in self._manifest.get("models", {}):
                    size = self._manifest["models"][model_id].get("size_bytes", 0)
                    date = self._manifest["models"][model_id].get("download_date", "")
                else:
                    size = sum(f.stat().st_size for f in item.rglob("*") if f.is_file())
                    date = ""

                discovered.append(ModelInfo(
                    model_id=model_id,
                    local_path=str(item),
                    download_date=date,
                    size_bytes=size,
                ))

        return discovered

    def register_local_model(self, directory_name: str, model_id: Optional[str] = None) -> Optional[ModelInfo]:
        """
        Register a manually placed model in the manifest.

        Args:
            directory_name: Name of the directory in the models folder
            model_id: Optional model ID to use (defaults to directory_name)

        Returns:
            ModelInfo if successful, None if model directory is invalid
        """
        model_dir = self._models_dir / directory_name
        if not model_dir.exists():
            return None

        # Validate it's a proper model
        has_config = (model_dir / "config.json").exists()
        has_weights = any((model_dir / f).exists() for f in self.WEIGHT_FILES)
        if not has_weights:
            has_weights = any(model_dir.glob("*.safetensors"))
        has_tokenizer = any((model_dir / f).exists() for f in self.TOKENIZER_FILES)

        if not (has_config and has_weights and has_tokenizer):
            return None

        # Use directory name as model_id if not provided
        if not model_id:
            model_id = directory_name

        # Calculate size
        size = sum(f.stat().st_size for f in model_dir.rglob("*") if f.is_file())

        # Add to manifest
        self._manifest.setdefault("models", {})[model_id] = {
            "local_path": str(model_dir),
            "download_date": datetime.now().isoformat(),
            "size_bytes": size,
            "version": None,
        }
        self._save_manifest()

        return ModelInfo(
            model_id=model_id,
            local_path=str(model_dir),
            download_date=datetime.now().isoformat(),
            size_bytes=size,
        )

    def get_available_models(self) -> list[dict]:
        """
        Get a list of recommended MLX models from HuggingFace.

        Returns:
            List of model info dicts with id, name, size, description
        """
        curated_models = [
            {
                "id": "mlx-community/Qwen2.5-3B-4bit",
                "name": "Qwen 2.5 3B Instruct (4-bit)",
                "size_gb": 2.8,
                "description": "Balanced quality/speed for note enhancement on Apple Silicon",
            },
            {
                "id": "pdelobelle/fietje-2-chat-mlx-6Bit",
                "name": "Fietje-2 Chat (6-bit)",
                "size_gb": 2.2,
                "description": "Dutch-first model tuned for conversational summaries",
            },
        ]
        return curated_models

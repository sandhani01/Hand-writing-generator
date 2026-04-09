from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path


def _env_flag(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    def __init__(self) -> None:
        self.project_dir = Path(__file__).resolve().parents[1]
        self.data_dir = Path(
            os.environ.get(
                "HANDWRITING_DATA_DIR",
                self.project_dir / "backend_runtime",
            )
        )
        self.temp_dir = Path(
            os.environ.get(
                "HANDWRITING_TEMP_DIR",
                self.data_dir / "tmp",
            )
        )
        self.database_path = Path(
            os.environ.get(
                "HANDWRITING_DATABASE_PATH",
                self.data_dir / "app.db",
            )
        )
        self.database_url = os.environ.get(
            "HANDWRITING_DATABASE_URL",
            f"sqlite:///{self.database_path.as_posix()}",
        )
        self.storage_backend = os.environ.get(
            "HANDWRITING_STORAGE_BACKEND",
            "local",
        ).strip().lower()
        self.uploads_dir = Path(
            os.environ.get(
                "HANDWRITING_UPLOADS_DIR",
                self.data_dir / "uploads",
            )
        )
        self.glyph_sets_dir = Path(
            os.environ.get(
                "HANDWRITING_GLYPH_SETS_DIR",
                self.data_dir / "glyph_sets",
            )
        )
        self.renders_dir = Path(
            os.environ.get(
                "HANDWRITING_RENDERS_DIR",
                self.data_dir / "renders",
            )
        )
        self.storage_prefix = os.environ.get(
            "HANDWRITING_STORAGE_PREFIX",
            "handwritten-notes",
        ).strip("/")
        self.storage_bucket = os.environ.get("HANDWRITING_STORAGE_BUCKET", "").strip()
        self.storage_region = os.environ.get("HANDWRITING_STORAGE_REGION", "").strip()
        self.storage_endpoint_url = os.environ.get(
            "HANDWRITING_STORAGE_ENDPOINT_URL", ""
        ).strip()
        self.storage_access_key_id = os.environ.get(
            "HANDWRITING_STORAGE_ACCESS_KEY_ID", ""
        ).strip()
        self.storage_secret_access_key = os.environ.get(
            "HANDWRITING_STORAGE_SECRET_ACCESS_KEY", ""
        ).strip()
        self.storage_session_token = os.environ.get(
            "HANDWRITING_STORAGE_SESSION_TOKEN", ""
        ).strip()
        self.storage_use_ssl = _env_flag("HANDWRITING_STORAGE_USE_SSL", True)
        self.api_title = os.environ.get(
            "HANDWRITING_API_TITLE",
            "Handwritten Notes Backend",
        )
        self.auth_mode = os.environ.get("HANDWRITING_AUTH_MODE", "local").lower()
        self.dev_user_id = os.environ.get("HANDWRITING_DEV_USER_ID", "demo-user")
        self.dev_user_email = os.environ.get(
            "HANDWRITING_DEV_USER_EMAIL",
            "demo-user@local.dev",
        )
        self.session_ttl_hours = int(
            os.environ.get("HANDWRITING_SESSION_TTL_HOURS", "168")
        )
        self.password_hash_iterations = int(
            os.environ.get("HANDWRITING_PASSWORD_HASH_ITERATIONS", "600000")
        )
        self.max_alphabet_datasets = int(
            os.environ.get("HANDWRITING_MAX_ALPHABET_DATASETS", "5")
        )
        self.max_coding_datasets = int(
            os.environ.get("HANDWRITING_MAX_CODING_DATASETS", "3")
        )
        self.max_saved_renders = int(
            os.environ.get("HANDWRITING_MAX_SAVED_RENDERS", "3")
        )
        self.max_backgrounds = int(
            os.environ.get("HANDWRITING_MAX_BACKGROUNDS", "1")
        )
        self.job_workers = int(os.environ.get("HANDWRITING_JOB_WORKERS", "2"))
        self.default_background_path = Path(
            os.environ.get(
                "HANDWRITING_DEFAULT_BACKGROUND_PATH",
                self.project_dir / "backgrounds" / "ruled.png",
            )
        )
        self.cors_origins = [
            origin.strip()
            for origin in os.environ.get(
                "HANDWRITING_CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173",
            ).split(",")
            if origin.strip()
        ]

    @property
    def uses_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def uses_object_storage(self) -> bool:
        return self.storage_backend != "local"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

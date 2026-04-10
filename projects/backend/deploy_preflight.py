from __future__ import annotations

import json
from pathlib import Path

from backend.config import get_settings


def main() -> int:
    settings = get_settings()
    errors = settings.validate_runtime_requirements()

    project_root = Path(__file__).resolve().parents[1]
    checks = {
        "auth_mode": settings.auth_mode,
        "storage_backend": settings.storage_backend,
        "job_backend": settings.job_backend,
        "uses_sqlite": settings.uses_sqlite,
        "uses_external_auth": settings.uses_external_auth,
        "default_background_exists": settings.default_background_path.exists(),
        "extractor_present": (project_root / "extractor.py").exists(),
        "renderer_present": (project_root / "renderer.py").exists(),
    }

    print(json.dumps(checks, indent=2))

    if errors:
        print("\nMissing/invalid configuration:")
        for item in errors:
            print(f"- {item}")
        return 1

    print("\nPreflight passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

import json
import re
import shutil
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Lock
from typing import Annotated, Any

from fastapi import Header, HTTPException, status

from .config import get_settings
from .models import BackgroundRecord, DatasetRecord, RenderJobRecord


WORKSPACE_SESSION_HEADER = "X-Workspace-Session"
DEFAULT_BACKGROUND_ID = "default-ruled"
_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")
_WORKSPACE_SESSION_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$")
_MANIFEST_LOCK = Lock()
_CLEANUP_LOCK = Lock()
_last_cleanup_at: datetime | None = None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return _now().isoformat()


def _safe_name(raw_name: str) -> str:
    candidate = _SAFE_NAME_RE.sub("_", raw_name).strip("._")
    return candidate or "upload.png"


def get_workspace_session_id(
    x_workspace_session: Annotated[
        str | None, Header(alias=WORKSPACE_SESSION_HEADER)
    ] = None,
) -> str:
    if not x_workspace_session or not _WORKSPACE_SESSION_RE.match(
        x_workspace_session.strip()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "A valid workspace session header is required. "
                f"Send {WORKSPACE_SESSION_HEADER} with every authenticated request."
            ),
        )
    return x_workspace_session.strip()


def prepare_workspace_runtime() -> None:
    settings = get_settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.temp_dir.mkdir(parents=True, exist_ok=True)
    settings.workspaces_dir.mkdir(parents=True, exist_ok=True)


def workspace_root(user_id: str, workspace_session_id: str) -> Path:
    return get_settings().workspaces_dir / user_id / workspace_session_id


def manifest_path(user_id: str, workspace_session_id: str) -> Path:
    return workspace_root(user_id, workspace_session_id) / "manifest.json"


def uploads_root(user_id: str, workspace_session_id: str) -> Path:
    return workspace_root(user_id, workspace_session_id) / "uploads"


def glyph_sets_root(user_id: str, workspace_session_id: str) -> Path:
    return workspace_root(user_id, workspace_session_id) / "glyph_sets"


def renders_root(user_id: str, workspace_session_id: str) -> Path:
    return workspace_root(user_id, workspace_session_id) / "renders"


def _default_manifest(user_id: str, workspace_session_id: str) -> dict[str, Any]:
    timestamp = now_iso()
    return {
        "version": 1,
        "user_id": user_id,
        "workspace_session_id": workspace_session_id,
        "created_at": timestamp,
        "updated_at": timestamp,
        "selected_background_id": DEFAULT_BACKGROUND_ID,
        "datasets": [],
        "backgrounds": [],
        "renders": [],
    }


def _write_manifest(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(".tmp")
    temp_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=True),
        encoding="utf-8",
    )
    temp_path.replace(path)


def cleanup_stale_workspaces() -> None:
    global _last_cleanup_at

    settings = get_settings()
    now = _now()

    # Throttle cleanup to run at most once per hour
    with _CLEANUP_LOCK:
        if _last_cleanup_at and (now - _last_cleanup_at) < timedelta(minutes=60):
            return
        _last_cleanup_at = now

    prepare_workspace_runtime()
    cutoff = now - timedelta(hours=max(1, settings.workspace_ttl_hours))

    with _MANIFEST_LOCK:
        if not settings.workspaces_dir.exists():
            return
        for user_dir in settings.workspaces_dir.iterdir():
            if not user_dir.is_dir():
                continue

            for session_dir in user_dir.iterdir():
                if not session_dir.is_dir():
                    continue

                candidate_time = datetime.fromtimestamp(
                    session_dir.stat().st_mtime, timezone.utc
                )
                manifest = session_dir / "manifest.json"
                if manifest.exists():
                    try:
                        payload = json.loads(manifest.read_text(encoding="utf-8"))
                        updated_at = payload.get("updated_at") or payload.get("created_at")
                        if isinstance(updated_at, str):
                            candidate_time = datetime.fromisoformat(updated_at)
                    except Exception:
                        pass

                if candidate_time < cutoff:
                    shutil.rmtree(session_dir, ignore_errors=True)

            try:
                user_dir.rmdir()
            except OSError:
                pass


def load_workspace_manifest(
    user_id: str,
    workspace_session_id: str,
) -> dict[str, Any]:
    prepare_workspace_runtime()
    cleanup_stale_workspaces()
    path = manifest_path(user_id, workspace_session_id)

    with _MANIFEST_LOCK:
        if not path.exists():
            payload = _default_manifest(user_id, workspace_session_id)
            _write_manifest(path, payload)
            return payload

        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            payload = _default_manifest(user_id, workspace_session_id)
            _write_manifest(path, payload)
            return payload

        payload.setdefault("datasets", [])
        payload.setdefault("backgrounds", [])
        payload.setdefault("renders", [])
        payload.setdefault("selected_background_id", DEFAULT_BACKGROUND_ID)
        payload.setdefault("created_at", now_iso())
        payload["updated_at"] = payload.get("updated_at") or payload["created_at"]
        return payload


def save_workspace_manifest(
    user_id: str,
    workspace_session_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    prepare_workspace_runtime()
    payload["user_id"] = user_id
    payload["workspace_session_id"] = workspace_session_id
    payload["updated_at"] = now_iso()

    with _MANIFEST_LOCK:
        _write_manifest(manifest_path(user_id, workspace_session_id), payload)

    return payload


def clear_workspace(user_id: str, workspace_session_id: str) -> None:
    shutil.rmtree(workspace_root(user_id, workspace_session_id), ignore_errors=True)


def store_uploaded_file(
    user_id: str,
    workspace_session_id: str,
    category: str,
    item_id: str,
    filename: str,
    content: bytes,
) -> str:
    target = (
        uploads_root(user_id, workspace_session_id)
        / category
        / item_id
        / _safe_name(filename)
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    return str(target)


def dataset_glyph_root(user_id: str, workspace_session_id: str, dataset_id: str) -> str:
    target = glyph_sets_root(user_id, workspace_session_id) / dataset_id
    target.mkdir(parents=True, exist_ok=True)
    return str(target)


def render_output_path(user_id: str, workspace_session_id: str, render_id: str) -> str:
    target = renders_root(user_id, workspace_session_id) / f"{render_id}.png"
    target.parent.mkdir(parents=True, exist_ok=True)
    return str(target)


def remove_path(path_ref: str | None) -> None:
    if not path_ref:
        return

    target = Path(path_ref)
    if not target.exists():
        return
    if target.is_dir():
        shutil.rmtree(target, ignore_errors=True)
    else:
        target.unlink(missing_ok=True)


def dataset_to_dict(item: DatasetRecord) -> dict[str, Any]:
    return asdict(item)


def background_to_dict(item: BackgroundRecord) -> dict[str, Any]:
    return asdict(item)


def render_to_dict(item: RenderJobRecord) -> dict[str, Any]:
    return asdict(item)


def dataset_from_dict(payload: dict[str, Any]) -> DatasetRecord:
    return DatasetRecord(**payload)


def background_from_dict(payload: dict[str, Any]) -> BackgroundRecord:
    return BackgroundRecord(**payload)


def render_from_dict(payload: dict[str, Any]) -> RenderJobRecord:
    return RenderJobRecord(**payload)

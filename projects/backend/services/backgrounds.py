from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, status

from ..config import get_settings
from ..models import BackgroundRecord, User
from ..workspace import (
    DEFAULT_BACKGROUND_ID,
    background_from_dict,
    background_to_dict,
    load_workspace_manifest,
    now_iso,
    remove_path,
    save_workspace_manifest,
    store_uploaded_file,
)


def _default_background_record(user_id: str, *, selected: bool) -> BackgroundRecord:
    settings = get_settings()
    background_path = settings.default_background_path.resolve()
    timestamp = datetime.fromtimestamp(
        background_path.stat().st_mtime if background_path.exists() else 0,
        timezone.utc,
    ).isoformat()
    return BackgroundRecord(
        id=DEFAULT_BACKGROUND_ID,
        user_id=user_id,
        display_name="Default ruled page",
        source_image_path=str(background_path),
        status="completed",
        is_default=True,
        is_selected=selected,
        created_at=timestamp,
        updated_at=timestamp,
        error_message=None,
    )


def background_limit() -> int:
    return get_settings().max_backgrounds


def _custom_backgrounds_from_manifest(manifest: dict) -> list[BackgroundRecord]:
    items = [background_from_dict(item) for item in manifest.get("backgrounds", [])]
    return sorted(items, key=lambda item: item.created_at, reverse=True)


def list_user_backgrounds(
    user_id: str,
    workspace_session_id: str,
) -> list[BackgroundRecord]:
    manifest = load_workspace_manifest(user_id, workspace_session_id)
    custom_items = _custom_backgrounds_from_manifest(manifest)
    custom_selected = any(item.is_selected for item in custom_items)
    return [
        _default_background_record(user_id, selected=not custom_selected),
        *custom_items,
    ]


def list_custom_backgrounds(
    user_id: str,
    workspace_session_id: str,
) -> list[BackgroundRecord]:
    manifest = load_workspace_manifest(user_id, workspace_session_id)
    return _custom_backgrounds_from_manifest(manifest)


def create_background_from_upload(
    user: User,
    workspace_session_id: str,
    filename: str,
    content: bytes,
    display_name: str | None = None,
) -> BackgroundRecord:
    manifest = load_workspace_manifest(user.id, workspace_session_id)
    existing = manifest.get("backgrounds", [])
    if len(existing) >= background_limit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Background limit reached. Delete the current custom background first.",
        )

    background_id = str(uuid4())
    created_at = now_iso()
    normalized_name = (display_name or Path(filename).stem or background_id).strip() or background_id
    source_path = store_uploaded_file(
        user.id,
        workspace_session_id,
        "background",
        background_id,
        filename,
        content,
    )

    items: list[dict] = []
    for item in existing:
        item = dict(item)
        item["is_selected"] = False
        items.append(item)

    background = BackgroundRecord(
        id=background_id,
        user_id=user.id,
        display_name=normalized_name,
        source_image_path=source_path,
        status="completed",
        is_default=False,
        is_selected=True,
        created_at=created_at,
        updated_at=created_at,
        error_message=None,
    )
    items.insert(0, background_to_dict(background))
    manifest["backgrounds"] = items
    manifest["selected_background_id"] = background_id
    save_workspace_manifest(user.id, workspace_session_id, manifest)
    return background


def select_background(
    user_id: str,
    workspace_session_id: str,
    background_id: str,
) -> list[BackgroundRecord]:
    manifest = load_workspace_manifest(user_id, workspace_session_id)

    if background_id != DEFAULT_BACKGROUND_ID and not any(
        item.get("id") == background_id for item in manifest.get("backgrounds", [])
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Background not found.",
        )

    updated_at = now_iso()
    items: list[dict] = []
    for item in manifest.get("backgrounds", []):
        item = dict(item)
        item["is_selected"] = background_id != DEFAULT_BACKGROUND_ID and item.get("id") == background_id
        item["updated_at"] = updated_at
        items.append(item)

    manifest["backgrounds"] = items
    manifest["selected_background_id"] = background_id
    save_workspace_manifest(user_id, workspace_session_id, manifest)
    return list_user_backgrounds(user_id, workspace_session_id)


def delete_background(
    user_id: str,
    workspace_session_id: str,
    background_id: str,
) -> BackgroundRecord:
    if background_id == DEFAULT_BACKGROUND_ID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The default background cannot be deleted.",
        )

    manifest = load_workspace_manifest(user_id, workspace_session_id)
    kept_items: list[dict] = []
    deleted: BackgroundRecord | None = None

    for item in manifest.get("backgrounds", []):
        if item.get("id") == background_id:
            deleted = background_from_dict(item)
            continue
        kept_items.append(item)

    if deleted is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Background not found.",
        )

    manifest["backgrounds"] = kept_items
    if manifest.get("selected_background_id") == background_id:
        manifest["selected_background_id"] = DEFAULT_BACKGROUND_ID
        for item in manifest["backgrounds"]:
            item["is_selected"] = False

    save_workspace_manifest(user_id, workspace_session_id, manifest)
    remove_path(deleted.source_image_path)
    return deleted


def get_selected_background(
    user_id: str,
    workspace_session_id: str,
) -> BackgroundRecord:
    items = list_user_backgrounds(user_id, workspace_session_id)
    for item in items:
        if item.is_selected:
            return item
    return items[0]

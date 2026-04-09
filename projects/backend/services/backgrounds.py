from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import text

from ..config import get_settings
from ..database import connection_scope
from ..models import BackgroundRecord, User
from .storage import delete_ref, store_upload


DEFAULT_BACKGROUND_ID = "default-ruled"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _default_background_record(user_id: str, *, selected: bool) -> BackgroundRecord:
    settings = get_settings()
    background_path = settings.default_background_path.resolve()
    return BackgroundRecord(
        id=DEFAULT_BACKGROUND_ID,
        user_id=user_id,
        display_name="Default ruled page",
        source_image_path=str(background_path),
        status="completed",
        is_default=True,
        is_selected=selected,
        created_at=datetime.fromtimestamp(
            background_path.stat().st_mtime if background_path.exists() else 0,
            timezone.utc,
        ).isoformat(),
        updated_at=datetime.fromtimestamp(
            background_path.stat().st_mtime if background_path.exists() else 0,
            timezone.utc,
        ).isoformat(),
        error_message=None,
    )


def _row_to_background(row) -> BackgroundRecord:
    return BackgroundRecord(
        id=row["id"],
        user_id=row["user_id"],
        display_name=row["display_name"],
        source_image_path=row["source_image_path"],
        status=row["status"],
        is_default=False,
        is_selected=bool(row["is_selected"]),
        created_at=row["created_at"],
        updated_at=row.get("updated_at"),
        error_message=row.get("error_message"),
    )


def background_limit() -> int:
    return get_settings().max_backgrounds


def list_user_backgrounds(user_id: str) -> list[BackgroundRecord]:
    with connection_scope() as connection:
        rows = (
            connection.execute(
                text(
                    """
                    SELECT id, user_id, display_name, source_image_path, status,
                           is_selected, created_at, updated_at, error_message
                    FROM backgrounds
                    WHERE user_id = :user_id
                    ORDER BY created_at DESC
                    """
                ),
                {"user_id": user_id},
            )
            .mappings()
            .all()
        )

    custom_items = [_row_to_background(row) for row in rows]
    custom_selected = any(item.is_selected for item in custom_items)
    default_item = _default_background_record(user_id, selected=not custom_selected)
    return [default_item, *custom_items]


def list_custom_backgrounds(user_id: str) -> list[BackgroundRecord]:
    return [item for item in list_user_backgrounds(user_id) if not item.is_default]


def create_background_from_upload(
    user: User,
    filename: str,
    content: bytes,
    display_name: str | None = None,
) -> BackgroundRecord:
    existing = list_custom_backgrounds(user.id)
    if len(existing) >= background_limit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Background limit reached. Delete the current custom background first.",
        )

    background_id = str(uuid4())
    created_at = _now_iso()
    normalized_name = (display_name or Path(filename).stem or background_id).strip()
    if not normalized_name:
        normalized_name = background_id

    source_ref = store_upload(
        user.id,
        "background",
        background_id,
        filename,
        content,
    )

    with connection_scope() as connection:
        connection.execute(
            text("UPDATE backgrounds SET is_selected = 0 WHERE user_id = :user_id"),
            {"user_id": user.id},
        )
        connection.execute(
            text(
                """
                INSERT INTO backgrounds (
                    id, user_id, display_name, source_image_path, status,
                    is_selected, created_at, updated_at, error_message
                )
                VALUES (
                    :id, :user_id, :display_name, :source_image_path, 'completed',
                    1, :created_at, :updated_at, NULL
                )
                """
            ),
            {
                "id": background_id,
                "user_id": user.id,
                "display_name": normalized_name,
                "source_image_path": source_ref,
                "created_at": created_at,
                "updated_at": created_at,
            },
        )
        row = (
            connection.execute(
                text(
                    """
                    SELECT id, user_id, display_name, source_image_path, status,
                           is_selected, created_at, updated_at, error_message
                    FROM backgrounds
                    WHERE id = :background_id
                    """
                ),
                {"background_id": background_id},
            )
            .mappings()
            .first()
        )

    return _row_to_background(row)


def select_background(user_id: str, background_id: str) -> list[BackgroundRecord]:
    with connection_scope() as connection:
        if background_id == DEFAULT_BACKGROUND_ID:
            connection.execute(
                text("UPDATE backgrounds SET is_selected = 0 WHERE user_id = :user_id"),
                {"user_id": user_id},
            )
        else:
            existing = (
                connection.execute(
                    text(
                        """
                        SELECT id
                        FROM backgrounds
                        WHERE id = :background_id AND user_id = :user_id
                        """
                    ),
                    {"background_id": background_id, "user_id": user_id},
                )
                .mappings()
                .first()
            )
            if existing is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Background not found.",
                )

            connection.execute(
                text(
                    """
                    UPDATE backgrounds
                    SET is_selected = CASE WHEN id = :background_id THEN 1 ELSE 0 END,
                        updated_at = :updated_at
                    WHERE user_id = :user_id
                    """
                ),
                {
                    "background_id": background_id,
                    "user_id": user_id,
                    "updated_at": _now_iso(),
                },
            )

    return list_user_backgrounds(user_id)


def delete_background(user_id: str, background_id: str) -> BackgroundRecord:
    if background_id == DEFAULT_BACKGROUND_ID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The default background cannot be deleted.",
        )

    with connection_scope() as connection:
        row = (
            connection.execute(
                text(
                    """
                    SELECT id, user_id, display_name, source_image_path, status,
                           is_selected, created_at, updated_at, error_message
                    FROM backgrounds
                    WHERE id = :background_id AND user_id = :user_id
                    """
                ),
                {"background_id": background_id, "user_id": user_id},
            )
            .mappings()
            .first()
        )
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Background not found.",
            )

        background = _row_to_background(row)
        connection.execute(
            text(
                "DELETE FROM backgrounds WHERE id = :background_id AND user_id = :user_id"
            ),
            {"background_id": background_id, "user_id": user_id},
        )

    delete_ref(background.source_image_path)
    return background


def get_selected_background(user_id: str) -> BackgroundRecord:
    items = list_user_backgrounds(user_id)
    for item in items:
        if item.is_selected:
            return item
    return items[0]

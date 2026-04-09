from __future__ import annotations

import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import text

from ..config import get_settings
from ..database import connection_scope
from ..models import DatasetRecord, User
from .jobs import submit_dataset_job
from .pipeline import extract_dataset
from .storage import (
    dataset_glyph_ref,
    delete_ref,
    materialize_file,
    save_tree,
    store_upload,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _cleanup_temp_dir(path: Path) -> None:
    for _ in range(3):
        try:
            shutil.rmtree(path)
            return
        except FileNotFoundError:
            return
        except PermissionError:
            time.sleep(0.1)
    shutil.rmtree(path, ignore_errors=True)


def _row_to_dataset(row) -> DatasetRecord:
    return DatasetRecord(
        id=row["id"],
        user_id=row["user_id"],
        dataset_type=row["dataset_type"],
        display_name=row["display_name"],
        source_image_path=row["source_image_path"],
        glyph_root=row["glyph_root"],
        status=row["status"],
        created_at=row["created_at"],
        updated_at=row.get("updated_at"),
        error_message=row.get("error_message"),
    )


def dataset_limits() -> dict[str, int]:
    settings = get_settings()
    return {
        "alphabet": settings.max_alphabet_datasets,
        "coding": settings.max_coding_datasets,
    }


def list_user_datasets(user_id: str) -> list[DatasetRecord]:
    with connection_scope() as connection:
        rows = (
            connection.execute(
                text(
                    """
                    SELECT id, user_id, dataset_type, display_name, source_image_path,
                           glyph_root, status, created_at, updated_at, error_message
                    FROM datasets
                    WHERE user_id = :user_id
                    ORDER BY created_at DESC
                    """
                ),
                {"user_id": user_id},
            )
            .mappings()
            .all()
        )

    return [_row_to_dataset(row) for row in rows]


def get_dataset(user_id: str, dataset_id: str) -> DatasetRecord | None:
    with connection_scope() as connection:
        row = (
            connection.execute(
                text(
                    """
                    SELECT id, user_id, dataset_type, display_name, source_image_path,
                           glyph_root, status, created_at, updated_at, error_message
                    FROM datasets
                    WHERE id = :dataset_id AND user_id = :user_id
                    """
                ),
                {"dataset_id": dataset_id, "user_id": user_id},
            )
            .mappings()
            .first()
        )
    return _row_to_dataset(row) if row else None


def get_dataset_by_id(dataset_id: str) -> DatasetRecord | None:
    with connection_scope() as connection:
        row = (
            connection.execute(
                text(
                    """
                    SELECT id, user_id, dataset_type, display_name, source_image_path,
                           glyph_root, status, created_at, updated_at, error_message
                    FROM datasets
                    WHERE id = :dataset_id
                    """
                ),
                {"dataset_id": dataset_id},
            )
            .mappings()
            .first()
        )
    return _row_to_dataset(row) if row else None


def list_completed_datasets(user_id: str) -> list[DatasetRecord]:
    return [dataset for dataset in list_user_datasets(user_id) if dataset.status == "completed"]


def _count_for_type(user_id: str, dataset_type: str) -> int:
    with connection_scope() as connection:
        row = (
            connection.execute(
                text(
                    """
                    SELECT COUNT(*) AS count
                    FROM datasets
                    WHERE user_id = :user_id AND dataset_type = :dataset_type
                    """
                ),
                {"user_id": user_id, "dataset_type": dataset_type},
            )
            .mappings()
            .first()
        )

    return int(row["count"])


def create_dataset_from_upload(
    user: User,
    dataset_type: str,
    filename: str,
    content: bytes,
    display_name: str | None = None,
) -> DatasetRecord:
    if dataset_type not in {"alphabet", "coding"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="dataset_type must be 'alphabet' or 'coding'",
        )

    limits = dataset_limits()
    current_count = _count_for_type(user.id, dataset_type)
    if current_count >= limits[dataset_type]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"{dataset_type} dataset limit reached. "
                f"Max allowed is {limits[dataset_type]}."
            ),
        )

    dataset_id = str(uuid4())
    created_at = _now_iso()
    normalized_name = (display_name or Path(filename).stem or dataset_id).strip()
    if not normalized_name:
        normalized_name = dataset_id
    source_ref = store_upload(user.id, dataset_type, dataset_id, filename, content)
    glyph_root = dataset_glyph_ref(user.id, dataset_id)

    with connection_scope() as connection:
        connection.execute(
            text(
                """
                INSERT INTO datasets (
                    id, user_id, dataset_type, display_name, source_image_path,
                    glyph_root, status, created_at, updated_at, error_message
                )
                VALUES (
                    :id, :user_id, :dataset_type, :display_name, :source_image_path,
                    :glyph_root, 'queued', :created_at, :updated_at, NULL
                )
                """
            ),
            {
                "id": dataset_id,
                "user_id": user.id,
                "dataset_type": dataset_type,
                "display_name": normalized_name,
                "source_image_path": source_ref,
                "glyph_root": glyph_root,
                "created_at": created_at,
                "updated_at": created_at,
            },
        )
        row = (
            connection.execute(
                text(
                    """
                    SELECT id, user_id, dataset_type, display_name, source_image_path,
                           glyph_root, status, created_at, updated_at, error_message
                    FROM datasets
                    WHERE id = :dataset_id
                    """
                ),
                {"dataset_id": dataset_id},
            )
            .mappings()
            .first()
        )

    submit_dataset_job(dataset_id)
    return _row_to_dataset(row)


def rename_dataset(user_id: str, dataset_id: str, display_name: str) -> DatasetRecord:
    normalized_name = display_name.strip()
    if not normalized_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dataset name cannot be empty.",
        )

    updated_at = _now_iso()
    with connection_scope() as connection:
        existing = (
            connection.execute(
                text(
                    """
                    SELECT id
                    FROM datasets
                    WHERE id = :dataset_id AND user_id = :user_id
                    """
                ),
                {"dataset_id": dataset_id, "user_id": user_id},
            )
            .mappings()
            .first()
        )
        if existing is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found.",
            )

        connection.execute(
            text(
                """
                UPDATE datasets
                SET display_name = :display_name,
                    updated_at = :updated_at
                WHERE id = :dataset_id AND user_id = :user_id
                """
            ),
            {
                "display_name": normalized_name,
                "updated_at": updated_at,
                "dataset_id": dataset_id,
                "user_id": user_id,
            },
        )
        row = (
            connection.execute(
                text(
                    """
                    SELECT id, user_id, dataset_type, display_name, source_image_path,
                           glyph_root, status, created_at, updated_at, error_message
                    FROM datasets
                    WHERE id = :dataset_id AND user_id = :user_id
                    """
                ),
                {"dataset_id": dataset_id, "user_id": user_id},
            )
            .mappings()
            .first()
        )

    return _row_to_dataset(row)


def delete_dataset(user_id: str, dataset_id: str) -> DatasetRecord:
    with connection_scope() as connection:
        row = (
            connection.execute(
                text(
                    """
                    SELECT id, user_id, dataset_type, display_name, source_image_path,
                           glyph_root, status, created_at, updated_at, error_message
                    FROM datasets
                    WHERE id = :dataset_id AND user_id = :user_id
                    """
                ),
                {"dataset_id": dataset_id, "user_id": user_id},
            )
            .mappings()
            .first()
        )
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found.",
            )

        dataset = _row_to_dataset(row)
        connection.execute(
            text("DELETE FROM datasets WHERE id = :dataset_id AND user_id = :user_id"),
            {"dataset_id": dataset_id, "user_id": user_id},
        )

    delete_ref(dataset.source_image_path)
    delete_ref(dataset.glyph_root)
    return dataset


def process_dataset_job(dataset_id: str) -> None:
    dataset = get_dataset_by_id(dataset_id)
    if dataset is None:
        return

    _update_dataset_status(dataset_id, "processing", error_message=None)

    try:
        with materialize_file(dataset.source_image_path) as source_path:
            temp_dir = get_settings().temp_dir / f"dataset_job_{dataset_id}_{uuid4().hex[:8]}"
            temp_dir.mkdir(parents=True, exist_ok=True)
            try:
                output_dir = temp_dir / "glyphs"
                extract_dataset(
                    image_path=Path(source_path),
                    dataset_type=dataset.dataset_type,
                    output_folder=output_dir,
                )

                if get_dataset_by_id(dataset_id) is None:
                    return

                save_tree(output_dir, dataset.glyph_root)
            finally:
                _cleanup_temp_dir(temp_dir)

        _update_dataset_status(dataset_id, "completed", error_message=None)
    except Exception as exc:  # pragma: no cover - exercised in runtime failures
        delete_ref(dataset.glyph_root)
        _update_dataset_status(dataset_id, "failed", error_message=str(exc))


def _update_dataset_status(
    dataset_id: str,
    status_value: str,
    *,
    error_message: str | None,
) -> None:
    updated_at = _now_iso()
    with connection_scope() as connection:
        connection.execute(
            text(
                """
                UPDATE datasets
                SET status = :status,
                    updated_at = :updated_at,
                    error_message = :error_message
                WHERE id = :dataset_id
                """
            ),
            {
                "status": status_value,
                "updated_at": updated_at,
                "error_message": error_message,
                "dataset_id": dataset_id,
            },
        )

from __future__ import annotations

import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, status

from ..config import get_settings
from ..models import DatasetRecord, User
from ..workspace import (
    dataset_from_dict,
    dataset_glyph_root,
    dataset_to_dict,
    load_workspace_manifest,
    now_iso,
    remove_path,
    save_workspace_manifest,
    store_uploaded_file,
)
from .pipeline import extract_dataset


def dataset_limits() -> dict[str, int]:
    settings = get_settings()
    return {
        "alphabet": settings.max_alphabet_datasets,
        "coding": settings.max_coding_datasets,
    }


def _sorted_datasets(items: list[DatasetRecord]) -> list[DatasetRecord]:
    return sorted(items, key=lambda item: item.created_at, reverse=True)


def _list_from_manifest(manifest: dict) -> list[DatasetRecord]:
    return _sorted_datasets(
        [dataset_from_dict(item) for item in manifest.get("datasets", [])]
    )


def list_user_datasets(user_id: str, workspace_session_id: str) -> list[DatasetRecord]:
    manifest = load_workspace_manifest(user_id, workspace_session_id)
    return _list_from_manifest(manifest)


def get_dataset(
    user_id: str,
    workspace_session_id: str,
    dataset_id: str,
) -> DatasetRecord | None:
    for dataset in list_user_datasets(user_id, workspace_session_id):
        if dataset.id == dataset_id:
            return dataset
    return None


def list_completed_datasets(
    user_id: str,
    workspace_session_id: str,
) -> list[DatasetRecord]:
    return [
        dataset
        for dataset in list_user_datasets(user_id, workspace_session_id)
        if dataset.status == "completed"
    ]


def _count_for_type(manifest: dict, dataset_type: str) -> int:
    return sum(
        1
        for item in manifest.get("datasets", [])
        if item.get("dataset_type") == dataset_type
    )


def _replace_dataset(manifest: dict, dataset: DatasetRecord) -> None:
    items = manifest.get("datasets", [])
    for index, item in enumerate(items):
        if item.get("id") == dataset.id:
            items[index] = dataset_to_dict(dataset)
            manifest["datasets"] = items
            return
    items.insert(0, dataset_to_dict(dataset))
    manifest["datasets"] = items


def create_dataset_from_upload(
    user: User,
    workspace_session_id: str,
    dataset_type: str,
    filename: str,
    content: bytes,
    display_name: str | None = None,
) -> DatasetRecord:
    if dataset_type not in {"alphabet", "coding"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="dataset_type must be 'alphabet' or 'coding'.",
        )

    manifest = load_workspace_manifest(user.id, workspace_session_id)
    limits = dataset_limits()
    current_count = _count_for_type(manifest, dataset_type)
    if current_count >= limits[dataset_type]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"{dataset_type} dataset limit reached. "
                f"Max allowed is {limits[dataset_type]}."
            ),
        )

    dataset_id = str(uuid4())
    created_at = now_iso()
    normalized_name = (display_name or Path(filename).stem or dataset_id).strip() or dataset_id
    source_path = store_uploaded_file(
        user.id,
        workspace_session_id,
        dataset_type,
        dataset_id,
        filename,
        content,
    )
    glyph_root = dataset_glyph_root(user.id, workspace_session_id, dataset_id)

    dataset = DatasetRecord(
        id=dataset_id,
        user_id=user.id,
        dataset_type=dataset_type,
        display_name=normalized_name,
        source_image_path=source_path,
        glyph_root=glyph_root,
        status="processing",
        created_at=created_at,
        updated_at=created_at,
        error_message=None,
    )
    _replace_dataset(manifest, dataset)
    save_workspace_manifest(user.id, workspace_session_id, manifest)
    return dataset


def process_dataset_extraction(
    user_id: str,
    workspace_session_id: str,
    dataset_id: str,
) -> None:
    manifest = load_workspace_manifest(user_id, workspace_session_id)
    dataset = get_dataset(user_id, workspace_session_id, dataset_id)
    if not dataset:
        return

    try:
        glyph_root_path = Path(dataset.glyph_root)
        if glyph_root_path.exists():
            shutil.rmtree(glyph_root_path, ignore_errors=True)
        glyph_root_path.mkdir(parents=True, exist_ok=True)

        extract_dataset(
            image_path=Path(dataset.source_image_path),
            dataset_type=dataset.dataset_type,
            output_folder=glyph_root_path,
        )
        dataset.status = "completed"
        dataset.error_message = None
    except Exception as exc:  # pragma: no cover
        remove_path(dataset.glyph_root)
        dataset.status = "failed"
        dataset.error_message = str(exc)

    dataset.updated_at = now_iso()
    manifest = load_workspace_manifest(user_id, workspace_session_id)
    _replace_dataset(manifest, dataset)
    save_workspace_manifest(user_id, workspace_session_id, manifest)


def rename_dataset(
    user_id: str,
    workspace_session_id: str,
    dataset_id: str,
    display_name: str,
) -> DatasetRecord:
    normalized_name = display_name.strip()
    if not normalized_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dataset name cannot be empty.",
        )

    manifest = load_workspace_manifest(user_id, workspace_session_id)
    for item in manifest.get("datasets", []):
        if item.get("id") != dataset_id:
            continue
        item["display_name"] = normalized_name
        item["updated_at"] = now_iso()
        save_workspace_manifest(user_id, workspace_session_id, manifest)
        return dataset_from_dict(item)

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Dataset not found.",
    )


def delete_dataset(
    user_id: str,
    workspace_session_id: str,
    dataset_id: str,
) -> DatasetRecord:
    manifest = load_workspace_manifest(user_id, workspace_session_id)
    items = manifest.get("datasets", [])
    kept_items: list[dict] = []
    deleted: DatasetRecord | None = None

    for item in items:
        if item.get("id") == dataset_id:
            deleted = dataset_from_dict(item)
            continue
        kept_items.append(item)

    if deleted is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found.",
        )

    manifest["datasets"] = kept_items
    save_workspace_manifest(user_id, workspace_session_id, manifest)
    remove_path(deleted.source_image_path)
    remove_path(deleted.glyph_root)
    return deleted

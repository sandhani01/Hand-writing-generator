from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, status
from fastapi.responses import FileResponse

from ..config import get_settings
from ..models import RenderJobRecord, User
from ..workspace import (
    load_workspace_manifest,
    now_iso,
    remove_path,
    render_from_dict,
    render_output_path,
    render_to_dict,
    save_workspace_manifest,
)
from .backgrounds import get_selected_background
from .datasets import list_completed_datasets, list_user_datasets
from .pipeline import render_page


def _sorted_renders(items: list[RenderJobRecord]) -> list[RenderJobRecord]:
    return sorted(items, key=lambda item: item.created_at, reverse=True)


def list_render_jobs(user_id: str, workspace_session_id: str) -> list[RenderJobRecord]:
    manifest = load_workspace_manifest(user_id, workspace_session_id)
    return _sorted_renders(
        [render_from_dict(item) for item in manifest.get("renders", [])]
    )


def get_render_job(
    user_id: str,
    workspace_session_id: str,
    render_id: str,
) -> RenderJobRecord | None:
    for job in list_render_jobs(user_id, workspace_session_id):
        if job.id == render_id:
            return job
    return None


def _replace_render(manifest: dict, job: RenderJobRecord) -> None:
    items = manifest.get("renders", [])
    for index, item in enumerate(items):
        if item.get("id") == job.id:
            items[index] = render_to_dict(job)
            manifest["renders"] = items
            return
    items.insert(0, render_to_dict(job))
    manifest["renders"] = items


def _prune_old_renders(manifest: dict) -> None:
    keep_count = max(0, get_settings().max_saved_renders)
    completed = [item for item in manifest.get("renders", []) if item.get("status") == "completed"]
    completed_sorted = sorted(completed, key=lambda item: item.get("created_at", ""), reverse=True)
    stale_ids = {item["id"] for item in completed_sorted[keep_count:]}
    if not stale_ids:
        return

    kept: list[dict] = []
    for item in manifest.get("renders", []):
        if item.get("id") in stale_ids:
            remove_path(item.get("output_path"))
            continue
        kept.append(item)
    manifest["renders"] = kept


def create_render_job(
    user: User,
    workspace_session_id: str,
    text_content: str,
    options: dict,
    font_source: str = "personal",
) -> RenderJobRecord:
    if not font_source.startswith("default:"):
        datasets = list_user_datasets(user.id, workspace_session_id)
        completed_alphabet_datasets = [
            dataset
            for dataset in datasets
            if dataset.dataset_type == "alphabet" and dataset.status == "completed"
        ]
        failed_or_pending = [
            dataset
            for dataset in datasets
            if dataset.dataset_type == "alphabet" and dataset.status != "completed"
        ]
        if not completed_alphabet_datasets:
            detail = "At least one completed alphabet dataset is required before rendering."
            if failed_or_pending:
                detail = (
                    "Your alphabet dataset is not ready yet. Upload a valid sheet or fix "
                    "the failed dataset before rendering."
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=detail,
            )

    render_id = str(uuid4())
    created_at = now_iso()
    output_path = render_output_path(user.id, workspace_session_id, render_id)
    job = RenderJobRecord(
        id=render_id,
        user_id=user.id,
        text_content=text_content,
        options_json=json.dumps(options or {}, ensure_ascii=True),
        output_path=output_path,
        status="processing",
        created_at=created_at,
        updated_at=created_at,
        error_message=None,
    )

    manifest = load_workspace_manifest(user.id, workspace_session_id)
    _replace_render(manifest, job)
    save_workspace_manifest(user.id, workspace_session_id, manifest)

    try:
        glyph_roots = []
        if font_source.startswith("default:"):
            folder_name = font_source.split(":", 1)[1]
            default_dir = Path(get_settings().project_dir) / "Default Glyphs" / folder_name
            hw_dir = default_dir / "Handwritten Font Glyphs"
            sym_dir = default_dir / "Symbol Font Glyphs"
            if hw_dir.exists():
                glyph_roots.extend([str(d) for d in hw_dir.iterdir() if d.is_dir()])
            if sym_dir.exists():
                glyph_roots.extend([str(d) for d in sym_dir.iterdir() if d.is_dir()])
        else:
            datasets = list_completed_datasets(user.id, workspace_session_id)
            glyph_roots = [dataset.glyph_root for dataset in datasets]
        background = get_selected_background(user.id, workspace_session_id)
        background_path = Path(background.source_image_path)

        render_page(
            text=job.text_content,
            options=json.loads(job.options_json or "{}"),
            glyph_roots=glyph_roots,
            output_path=Path(job.output_path),
            background_path=background_path,
        )
        job.status = "completed"
        job.error_message = None
    except Exception as exc:  # pragma: no cover - runtime rendering failures
        remove_path(job.output_path)
        job.status = "failed"
        job.error_message = str(exc)

    job.updated_at = now_iso()
    manifest = load_workspace_manifest(user.id, workspace_session_id)
    _replace_render(manifest, job)
    _prune_old_renders(manifest)
    save_workspace_manifest(user.id, workspace_session_id, manifest)
    return job


def delete_render_job(
    user_id: str,
    workspace_session_id: str,
    render_id: str,
) -> RenderJobRecord:
    manifest = load_workspace_manifest(user_id, workspace_session_id)
    kept_items: list[dict] = []
    deleted: RenderJobRecord | None = None

    for item in manifest.get("renders", []):
        if item.get("id") == render_id:
            deleted = render_from_dict(item)
            continue
        kept_items.append(item)

    if deleted is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Render job not found.",
        )

    manifest["renders"] = kept_items
    save_workspace_manifest(user_id, workspace_session_id, manifest)
    remove_path(deleted.output_path)
    return deleted


def download_render_response(
    user_id: str,
    workspace_session_id: str,
    render_id: str,
):
    job = get_render_job(user_id, workspace_session_id, render_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Render job not found.",
        )
    if job.status == "failed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=job.error_message or "This render failed.",
        )
    if job.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This render is still processing.",
        )

    output_file = Path(job.output_path)
    if not output_file.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rendered file no longer exists in the current workspace.",
        )

    return FileResponse(
        output_file,
        media_type="image/png",
        filename=f"{render_id}.png",
    )

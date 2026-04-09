from __future__ import annotations

import json
import shutil
from contextlib import ExitStack
from datetime import datetime, timezone
from pathlib import Path
import time
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import bindparam, text

from ..config import get_settings
from ..database import connection_scope
from ..models import RenderJobRecord, User
from .backgrounds import get_selected_background
from .datasets import list_completed_datasets, list_user_datasets
from .jobs import submit_render_job
from .pipeline import render_page
from .storage import (
    build_download_response,
    delete_ref,
    materialize_file,
    materialize_tree,
    ref_exists,
    render_output_ref,
    save_file,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _cleanup_temp_dir(path: str) -> None:
    temp_path = Path(path)
    for _ in range(3):
        try:
            shutil.rmtree(temp_path)
            return
        except FileNotFoundError:
            return
        except PermissionError:
            time.sleep(0.1)
    shutil.rmtree(temp_path, ignore_errors=True)


def _row_to_render(row) -> RenderJobRecord:
    return RenderJobRecord(
        id=row["id"],
        user_id=row["user_id"],
        text_content=row["text_content"],
        options_json=row["options_json"],
        output_path=row["output_path"],
        status=row["status"],
        created_at=row["created_at"],
        updated_at=row.get("updated_at"),
        error_message=row.get("error_message"),
    )


def list_render_jobs(user_id: str) -> list[RenderJobRecord]:
    with connection_scope() as connection:
        rows = (
            connection.execute(
                text(
                    """
                    SELECT id, user_id, text_content, options_json, output_path,
                           status, created_at, updated_at, error_message
                    FROM render_jobs
                    WHERE user_id = :user_id
                    ORDER BY created_at DESC
                    """
                ),
                {"user_id": user_id},
            )
            .mappings()
            .all()
        )

    return [_row_to_render(row) for row in rows]


def get_render_job(user_id: str, render_id: str) -> RenderJobRecord | None:
    with connection_scope() as connection:
        row = (
            connection.execute(
                text(
                    """
                    SELECT id, user_id, text_content, options_json, output_path,
                           status, created_at, updated_at, error_message
                    FROM render_jobs
                    WHERE id = :render_id AND user_id = :user_id
                    """
                ),
                {"render_id": render_id, "user_id": user_id},
            )
            .mappings()
            .first()
        )
    return _row_to_render(row) if row else None


def get_render_job_by_id(render_id: str) -> RenderJobRecord | None:
    with connection_scope() as connection:
        row = (
            connection.execute(
                text(
                    """
                    SELECT id, user_id, text_content, options_json, output_path,
                           status, created_at, updated_at, error_message
                    FROM render_jobs
                    WHERE id = :render_id
                    """
                ),
                {"render_id": render_id},
            )
            .mappings()
            .first()
        )
    return _row_to_render(row) if row else None


def _prune_old_renders(user_id: str) -> None:
    settings = get_settings()
    keep_count = max(0, settings.max_saved_renders)

    with connection_scope() as connection:
        rows = (
            connection.execute(
                text(
                    """
                    SELECT id, user_id, text_content, options_json, output_path,
                           status, created_at, updated_at, error_message
                    FROM render_jobs
                    WHERE user_id = :user_id AND status = 'completed'
                    ORDER BY created_at DESC
                    """
                ),
                {"user_id": user_id},
            )
            .mappings()
            .all()
        )

        if len(rows) <= keep_count:
            return

        stale_jobs = [_row_to_render(row) for row in rows[keep_count:]]
        statement = text(
            """
            DELETE FROM render_jobs
            WHERE user_id = :user_id
              AND id IN :job_ids
            """
        ).bindparams(bindparam("job_ids", expanding=True))
        connection.execute(
            statement,
            {"user_id": user_id, "job_ids": [job.id for job in stale_jobs]},
        )

    for job in stale_jobs:
        delete_ref(job.output_path)


def create_render_job(
    user: User,
    text_content: str,
    options: dict,
) -> RenderJobRecord:
    datasets = list_user_datasets(user.id)
    completed_alphabet_datasets = [
        dataset
        for dataset in datasets
        if dataset.dataset_type == "alphabet" and dataset.status == "completed"
    ]
    pending_alphabet_datasets = [
        dataset
        for dataset in datasets
        if dataset.dataset_type == "alphabet" and dataset.status in {"queued", "processing"}
    ]
    if not completed_alphabet_datasets:
        detail = "At least one completed alphabet dataset is required before rendering."
        if pending_alphabet_datasets:
            detail = (
                "Your alphabet datasets are still processing. Wait for them to finish "
                "before rendering."
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        )

    render_id = str(uuid4())
    created_at = _now_iso()
    output_ref = render_output_ref(user.id, render_id)
    options_json = json.dumps(options or {}, ensure_ascii=True)
    with connection_scope() as connection:
        connection.execute(
            text(
                """
                INSERT INTO render_jobs (
                    id, user_id, text_content, options_json, output_path,
                    status, created_at, updated_at, error_message
                )
                VALUES (
                    :id, :user_id, :text_content, :options_json, :output_path,
                    'queued', :created_at, :updated_at, NULL
                )
                """
            ),
            {
                "id": render_id,
                "user_id": user.id,
                "text_content": text_content,
                "options_json": options_json,
                "output_path": output_ref,
                "created_at": created_at,
                "updated_at": created_at,
            },
        )
        row = (
            connection.execute(
                text(
                    """
                    SELECT id, user_id, text_content, options_json, output_path,
                           status, created_at, updated_at, error_message
                    FROM render_jobs
                    WHERE id = :render_id
                    """
                ),
                {"render_id": render_id},
            )
            .mappings()
            .first()
        )

    submit_render_job(render_id)
    return _row_to_render(row)


def process_render_job(render_id: str) -> None:
    job = get_render_job_by_id(render_id)
    if job is None:
        return

    _update_render_status(render_id, "processing", error_message=None)

    try:
        datasets = list_completed_datasets(job.user_id)
        alphabet_datasets = [
            dataset for dataset in datasets if dataset.dataset_type == "alphabet"
        ]
        if not alphabet_datasets:
            raise RuntimeError(
                "At least one completed alphabet dataset is required before rendering."
            )

        with ExitStack() as stack:
            glyph_roots: list[str] = []
            for dataset in datasets:
                local_root = stack.enter_context(materialize_tree(dataset.glyph_root))
                glyph_roots.append(str(local_root))

            selected_background = get_selected_background(job.user_id)
            if selected_background.is_default:
                background_path = Path(selected_background.source_image_path)
            else:
                background_path = stack.enter_context(
                    materialize_file(selected_background.source_image_path)
                )

            temp_dir = get_settings().temp_dir / f"render_job_{render_id}_{uuid4().hex[:8]}"
            temp_dir.mkdir(parents=True, exist_ok=True)
            try:
                local_output_path = temp_dir / f"{render_id}.png"
                render_page(
                    text=job.text_content,
                    options=json.loads(job.options_json or "{}"),
                    glyph_roots=glyph_roots,
                    output_path=local_output_path,
                    background_path=Path(background_path),
                )

                if get_render_job_by_id(render_id) is None:
                    return

                save_file(local_output_path, job.output_path)
            finally:
                _cleanup_temp_dir(str(temp_dir))

        _update_render_status(render_id, "completed", error_message=None)
        _prune_old_renders(job.user_id)
    except Exception as exc:  # pragma: no cover - exercised in runtime failures
        delete_ref(job.output_path)
        _update_render_status(render_id, "failed", error_message=str(exc))


def delete_render_job(user_id: str, render_id: str) -> RenderJobRecord:
    with connection_scope() as connection:
        row = (
            connection.execute(
                text(
                    """
                    SELECT id, user_id, text_content, options_json, output_path,
                           status, created_at, updated_at, error_message
                    FROM render_jobs
                    WHERE id = :render_id AND user_id = :user_id
                    """
                ),
                {"render_id": render_id, "user_id": user_id},
            )
            .mappings()
            .first()
        )
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Render job not found.",
            )

        job = _row_to_render(row)
        connection.execute(
            text("DELETE FROM render_jobs WHERE id = :render_id AND user_id = :user_id"),
            {"render_id": render_id, "user_id": user_id},
        )

    delete_ref(job.output_path)
    return job


def download_render_response(user_id: str, render_id: str):
    job = get_render_job(user_id, render_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Render job not found.",
        )
    if job.status in {"queued", "processing"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This render is still processing.",
        )
    if job.status == "failed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=job.error_message or "This render failed.",
        )
    if not ref_exists(job.output_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rendered file no longer exists in storage.",
        )

    return build_download_response(
        job.output_path,
        filename=f"{render_id}.png",
        media_type="image/png",
    )


def _update_render_status(
    render_id: str,
    status_value: str,
    *,
    error_message: str | None,
) -> None:
    updated_at = _now_iso()
    with connection_scope() as connection:
        connection.execute(
            text(
                """
                UPDATE render_jobs
                SET status = :status,
                    updated_at = :updated_at,
                    error_message = :error_message
                WHERE id = :render_id
                """
            ),
            {
                "status": status_value,
                "updated_at": updated_at,
                "error_message": error_message,
                "render_id": render_id,
            },
        )

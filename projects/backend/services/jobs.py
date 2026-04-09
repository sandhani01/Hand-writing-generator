from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from threading import Lock

from sqlalchemy import text

from ..config import get_settings
from ..database import connection_scope


_executor: ThreadPoolExecutor | None = None
_lock = Lock()
_started = False


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_executor() -> ThreadPoolExecutor:
    global _executor
    if _executor is None:
        settings = get_settings()
        _executor = ThreadPoolExecutor(
            max_workers=max(1, settings.job_workers),
            thread_name_prefix="handwriting-job",
        )
    return _executor


def start_job_system() -> None:
    global _started
    with _lock:
        if _started:
            return
        recover_interrupted_jobs()
        _get_executor()
        _started = True


def stop_job_system() -> None:
    global _executor, _started
    with _lock:
        if _executor is not None:
            _executor.shutdown(wait=False, cancel_futures=False)
        _executor = None
        _started = False


def recover_interrupted_jobs() -> None:
    failure_message = "Worker restarted before this job finished."
    updated_at = _now_iso()
    with connection_scope() as connection:
        connection.execute(
            text(
                """
                UPDATE datasets
                SET status = 'failed',
                    updated_at = :updated_at,
                    error_message = COALESCE(error_message, :failure_message)
                WHERE status IN ('queued', 'processing')
                """
            ),
            {"updated_at": updated_at, "failure_message": failure_message},
        )
        connection.execute(
            text(
                """
                UPDATE render_jobs
                SET status = 'failed',
                    updated_at = :updated_at,
                    error_message = COALESCE(error_message, :failure_message)
                WHERE status IN ('queued', 'processing')
                """
            ),
            {"updated_at": updated_at, "failure_message": failure_message},
        )


def submit_dataset_job(dataset_id: str) -> None:
    _get_executor().submit(_run_dataset_job, dataset_id)


def submit_render_job(render_id: str) -> None:
    _get_executor().submit(_run_render_job, render_id)


def _run_dataset_job(dataset_id: str) -> None:
    from .datasets import process_dataset_job

    process_dataset_job(dataset_id)


def _run_render_job(render_id: str) -> None:
    from .renders import process_render_job

    process_render_job(render_id)

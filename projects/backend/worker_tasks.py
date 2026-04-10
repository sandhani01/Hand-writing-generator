from __future__ import annotations

from .celery_app import celery_app
from .services.jobs import run_dataset_job_now, run_render_job_now


@celery_app.task(name="handwriting.dataset.process")
def run_dataset_job_task(dataset_id: str) -> None:
    run_dataset_job_now(dataset_id)


@celery_app.task(name="handwriting.render.process")
def run_render_job_task(render_id: str) -> None:
    run_render_job_now(render_id)

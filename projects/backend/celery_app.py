from __future__ import annotations

from celery import Celery

from .config import get_settings


settings = get_settings()
broker_url = (
    settings.celery_broker_url
    or settings.redis_url
    or "redis://localhost:6379/0"
)
result_backend = (
    settings.celery_result_backend
    or settings.redis_url
    or broker_url
)

celery_app = Celery(
    "handwritten_notes",
    broker=broker_url,
    backend=result_backend,
    include=["backend.worker_tasks"],
)

celery_app.conf.update(
    task_default_queue=settings.job_queue_name,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)

if settings.celery_task_always_eager:
    celery_app.conf.task_always_eager = True
    celery_app.conf.task_eager_propagates = True

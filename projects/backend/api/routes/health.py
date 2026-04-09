from __future__ import annotations

from fastapi import APIRouter

from ...config import get_settings
from ...schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(status="ok", app=settings.api_title)


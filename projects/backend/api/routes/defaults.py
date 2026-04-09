from __future__ import annotations

from fastapi import APIRouter

from ...schemas import DefaultsFeaturesResponse, DefaultsResponse
from ...services.pipeline import build_frontend_defaults, build_frontend_features

router = APIRouter(tags=["defaults"])


@router.get("/defaults", response_model=DefaultsResponse)
def defaults() -> DefaultsResponse:
    features = build_frontend_features()
    return DefaultsResponse(
        options=build_frontend_defaults(),
        features=DefaultsFeaturesResponse(
            charOverrides=bool(features.get("charOverrides")),
        ),
    )

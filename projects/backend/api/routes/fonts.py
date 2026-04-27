from __future__ import annotations

from fastapi import APIRouter, Depends

from ...auth import get_current_user
from ...models import User
from ...schemas import FontGenerateRequest
from ...services.fonts import generate_font_response
from ...workspace import get_workspace_session_id

router = APIRouter(prefix="/fonts", tags=["fonts"])


@router.post("/generate")
def generate_font(
    payload: FontGenerateRequest,
    current_user: User = Depends(get_current_user),
    workspace_session_id: str = Depends(get_workspace_session_id),
):
    return generate_font_response(
        user_id=current_user.id,
        workspace_session_id=workspace_session_id,
        font_name=payload.fontName,
        fmt=payload.format,
    )

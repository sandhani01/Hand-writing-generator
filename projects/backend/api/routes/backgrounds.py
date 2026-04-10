from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile, status

from ...auth import get_current_user
from ...models import User
from ...schemas import (
    BackgroundListResponse,
    BackgroundResponse,
    BackgroundSelectRequest,
    DeleteResponse,
)
from ...services.backgrounds import (
    background_limit,
    create_background_from_upload,
    delete_background,
    list_custom_backgrounds,
    list_user_backgrounds,
    select_background,
)
from ...workspace import get_workspace_session_id

router = APIRouter(prefix="/backgrounds", tags=["backgrounds"])


@router.get("", response_model=BackgroundListResponse)
def list_backgrounds(
    current_user: User = Depends(get_current_user),
    workspace_session_id: str = Depends(get_workspace_session_id),
) -> BackgroundListResponse:
    items = list_user_backgrounds(current_user.id, workspace_session_id)
    return BackgroundListResponse(
        items=[BackgroundResponse.model_validate(item) for item in items],
        custom_count=len(list_custom_backgrounds(current_user.id, workspace_session_id)),
        background_limit=background_limit(),
    )


@router.post("/upload", response_model=BackgroundResponse, status_code=status.HTTP_201_CREATED)
async def upload_background(
    background: UploadFile = File(...),
    display_name: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    workspace_session_id: str = Depends(get_workspace_session_id),
) -> BackgroundResponse:
    content = await background.read()
    item = create_background_from_upload(
        user=current_user,
        workspace_session_id=workspace_session_id,
        filename=background.filename or "background.png",
        content=content,
        display_name=display_name,
    )
    return BackgroundResponse.model_validate(item)


@router.patch("/select", response_model=BackgroundListResponse)
def update_selected_background(
    payload: BackgroundSelectRequest,
    current_user: User = Depends(get_current_user),
    workspace_session_id: str = Depends(get_workspace_session_id),
) -> BackgroundListResponse:
    items = select_background(current_user.id, workspace_session_id, payload.background_id)
    return BackgroundListResponse(
        items=[BackgroundResponse.model_validate(item) for item in items],
        custom_count=len([item for item in items if not item.is_default]),
        background_limit=background_limit(),
    )


@router.delete("/{background_id}", response_model=DeleteResponse)
def remove_background(
    background_id: str,
    current_user: User = Depends(get_current_user),
    workspace_session_id: str = Depends(get_workspace_session_id),
) -> DeleteResponse:
    item = delete_background(current_user.id, workspace_session_id, background_id)
    return DeleteResponse(status="deleted", id=item.id)

from __future__ import annotations

from fastapi import APIRouter, Depends, status

from ...auth import get_current_user
from ...models import User
from ...schemas import DeleteResponse, RenderCreateRequest, RenderJobResponse, RenderListResponse
from ...services.renders import (
    create_render_job,
    delete_render_job,
    download_render_response,
    list_render_jobs,
)
from ...workspace import get_workspace_session_id

router = APIRouter(prefix="/renders", tags=["renders"])


@router.get("", response_model=RenderListResponse)
def list_renders(
    current_user: User = Depends(get_current_user),
    workspace_session_id: str = Depends(get_workspace_session_id),
) -> RenderListResponse:
    jobs = list_render_jobs(current_user.id, workspace_session_id)
    return RenderListResponse(items=[RenderJobResponse.model_validate(job) for job in jobs])


@router.post("", response_model=RenderJobResponse, status_code=status.HTTP_202_ACCEPTED)
def create_render(
    payload: RenderCreateRequest,
    current_user: User = Depends(get_current_user),
    workspace_session_id: str = Depends(get_workspace_session_id),
) -> RenderJobResponse:
    job = create_render_job(
        user=current_user,
        workspace_session_id=workspace_session_id,
        text_content=payload.text,
        options=payload.options,
    )
    return RenderJobResponse.model_validate(job)


@router.get("/{render_id}/file")
def download_render(
    render_id: str,
    current_user: User = Depends(get_current_user),
    workspace_session_id: str = Depends(get_workspace_session_id),
):
    return download_render_response(current_user.id, workspace_session_id, render_id)


@router.delete("/{render_id}", response_model=DeleteResponse)
def remove_render(
    render_id: str,
    current_user: User = Depends(get_current_user),
    workspace_session_id: str = Depends(get_workspace_session_id),
) -> DeleteResponse:
    job = delete_render_job(current_user.id, workspace_session_id, render_id)
    return DeleteResponse(status="deleted", id=job.id)

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

router = APIRouter(prefix="/renders", tags=["renders"])


@router.get("", response_model=RenderListResponse)
def list_renders(current_user: User = Depends(get_current_user)) -> RenderListResponse:
    jobs = list_render_jobs(current_user.id)
    return RenderListResponse(items=[RenderJobResponse.model_validate(job) for job in jobs])


@router.post("", response_model=RenderJobResponse, status_code=status.HTTP_202_ACCEPTED)
def create_render(
    payload: RenderCreateRequest,
    current_user: User = Depends(get_current_user),
) -> RenderJobResponse:
    job = create_render_job(
        user=current_user,
        text_content=payload.text,
        options=payload.options,
    )
    return RenderJobResponse.model_validate(job)


@router.get("/{render_id}/file")
def download_render(
    render_id: str,
    current_user: User = Depends(get_current_user),
):
    return download_render_response(current_user.id, render_id)


@router.delete("/{render_id}", response_model=DeleteResponse)
def remove_render(
    render_id: str,
    current_user: User = Depends(get_current_user),
) -> DeleteResponse:
    job = delete_render_job(current_user.id, render_id)
    return DeleteResponse(status="deleted", id=job.id)

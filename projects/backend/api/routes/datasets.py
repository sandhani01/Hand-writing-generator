from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile, status

from ...auth import get_current_user
from ...models import User
from ...schemas import (
    DatasetListResponse,
    DatasetRenameRequest,
    DatasetResponse,
    DeleteResponse,
)
from ...services.datasets import (
    create_dataset_from_upload,
    dataset_limits,
    delete_dataset,
    list_user_datasets,
    process_dataset_extraction,
    rename_dataset,
)
from ...workspace import get_workspace_session_id

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.get("", response_model=DatasetListResponse)
def list_datasets(
    current_user: User = Depends(get_current_user),
    workspace_session_id: str = Depends(get_workspace_session_id),
) -> DatasetListResponse:
    items = list_user_datasets(current_user.id, workspace_session_id)
    limits = dataset_limits()
    alphabet_count = sum(1 for item in items if item.dataset_type == "alphabet")
    coding_count = sum(1 for item in items if item.dataset_type == "coding")
    return DatasetListResponse(
        items=[DatasetResponse.model_validate(item) for item in items],
        alphabet_count=alphabet_count,
        coding_count=coding_count,
        alphabet_limit=limits["alphabet"],
        coding_limit=limits["coding"],
    )


@router.post("/upload", response_model=DatasetResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_dataset(
    background_tasks: BackgroundTasks,
    grid: UploadFile = File(...),
    dataset_type: str = Form(..., alias="type"),
    display_name: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    workspace_session_id: str = Depends(get_workspace_session_id),
) -> DatasetResponse:
    content = await grid.read()
    dataset = create_dataset_from_upload(
        user=current_user,
        workspace_session_id=workspace_session_id,
        dataset_type=dataset_type,
        filename=grid.filename or "grid.jpg",
        content=content,
        display_name=display_name,
    )
    
    background_tasks.add_task(
        process_dataset_extraction,
        user_id=current_user.id,
        workspace_session_id=workspace_session_id,
        dataset_id=dataset.id,
    )
    
    return DatasetResponse.model_validate(dataset)


@router.patch("/{dataset_id}", response_model=DatasetResponse)
def update_dataset_name(
    dataset_id: str,
    payload: DatasetRenameRequest,
    current_user: User = Depends(get_current_user),
    workspace_session_id: str = Depends(get_workspace_session_id),
) -> DatasetResponse:
    dataset = rename_dataset(
        current_user.id,
        workspace_session_id,
        dataset_id,
        payload.display_name,
    )
    return DatasetResponse.model_validate(dataset)


@router.delete("/{dataset_id}", response_model=DeleteResponse)
def remove_dataset(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    workspace_session_id: str = Depends(get_workspace_session_id),
) -> DeleteResponse:
    dataset = delete_dataset(current_user.id, workspace_session_id, dataset_id)
    return DeleteResponse(status="deleted", id=dataset.id)

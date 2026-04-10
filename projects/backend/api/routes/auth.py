from __future__ import annotations

from fastapi import APIRouter, Depends, status

from ...auth import (
    get_current_user,
    login_local_user,
    signup_local_user,
)
from ...models import User
from ...schemas import AuthRequest, AuthSessionResponse, StatusResponse, UserResponse
from ...workspace import clear_workspace, get_workspace_session_id

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=AuthSessionResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: AuthRequest) -> AuthSessionResponse:
    user, access_token, expires_at = signup_local_user(payload.email, payload.password)
    return AuthSessionResponse(
        access_token=access_token,
        token_type="bearer",
        expires_at=expires_at,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=AuthSessionResponse)
def login(payload: AuthRequest) -> AuthSessionResponse:
    user, access_token, expires_at = login_local_user(payload.email, payload.password)
    return AuthSessionResponse(
        access_token=access_token,
        token_type="bearer",
        expires_at=expires_at,
        user=UserResponse.model_validate(user),
    )


@router.post("/logout", response_model=StatusResponse)
def logout(
    current_user: User = Depends(get_current_user),
    workspace_session_id: str = Depends(get_workspace_session_id),
) -> StatusResponse:
    clear_workspace(current_user.id, workspace_session_id)
    return StatusResponse(status="logged_out")

from __future__ import annotations

from fastapi import APIRouter, Depends, status

from ...auth import (
    get_current_access_token,
    get_current_user,
    login_local_user,
    logout_access_token,
    signup_local_user,
)
from ...models import User
from ...schemas import AuthRequest, AuthSessionResponse, StatusResponse, UserResponse

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
    access_token: str = Depends(get_current_access_token),
    current_user: User = Depends(get_current_user),
) -> StatusResponse:
    logout_access_token(access_token)
    return StatusResponse(status="logged_out")

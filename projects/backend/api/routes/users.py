from __future__ import annotations

from fastapi import APIRouter, Depends

from ...auth import get_current_user
from ...models import User
from ...schemas import UserResponse

router = APIRouter(tags=["users"])


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        auth_mode=current_user.auth_mode,
        created_at=current_user.created_at,
    )


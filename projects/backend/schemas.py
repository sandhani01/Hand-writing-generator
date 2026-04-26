from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    auth_mode: str
    created_at: str


class HealthResponse(BaseModel):
    status: str
    app: str


class StatusResponse(BaseModel):
    status: str


class DeleteResponse(BaseModel):
    status: str
    id: str


class AuthRequest(BaseModel):
    email: str
    password: str


class AuthSessionResponse(BaseModel):
    access_token: str
    token_type: str
    expires_at: str
    user: UserResponse


class DatasetRenameRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)


class DatasetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    dataset_type: str
    display_name: str
    source_image_path: str
    glyph_root: str
    status: str
    created_at: str
    updated_at: str | None = None
    error_message: str | None = None


class DatasetListResponse(BaseModel):
    items: list[DatasetResponse]
    alphabet_count: int
    coding_count: int
    alphabet_limit: int
    coding_limit: int


class BackgroundSelectRequest(BaseModel):
    background_id: str


class BackgroundResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    display_name: str
    source_image_path: str
    status: str
    is_default: bool
    is_selected: bool
    created_at: str
    updated_at: str | None = None
    error_message: str | None = None


class BackgroundListResponse(BaseModel):
    items: list[BackgroundResponse]
    custom_count: int
    background_limit: int


class RenderCreateRequest(BaseModel):
    text: str = Field(default="")
    options: dict[str, Any] = Field(default_factory=dict)
    font_source: str = Field(default="personal")


class RenderJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    text_content: str
    options_json: str
    output_path: str
    status: str
    created_at: str
    updated_at: str | None = None
    error_message: str | None = None


class RenderListResponse(BaseModel):
    items: list[RenderJobResponse]


class DefaultsFeaturesResponse(BaseModel):
    charOverrides: bool = False


class DefaultsResponse(BaseModel):
    options: dict[str, Any] = Field(default_factory=dict)
    features: DefaultsFeaturesResponse = Field(default_factory=DefaultsFeaturesResponse)
    fonts: list[str] = Field(default_factory=list)

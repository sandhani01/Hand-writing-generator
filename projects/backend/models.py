from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class User:
    id: str
    email: str
    auth_mode: str
    created_at: str


@dataclass(slots=True)
class DatasetRecord:
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


@dataclass(slots=True)
class BackgroundRecord:
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


@dataclass(slots=True)
class RenderJobRecord:
    id: str
    user_id: str
    text_content: str
    options_json: str
    output_path: str
    status: str
    created_at: str
    updated_at: str | None = None
    error_message: str | None = None

from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, status
from fastapi.responses import FileResponse

from ..config import get_settings
from .datasets import list_completed_datasets
from .pipeline import generate_font_file


def generate_font_response(
    user_id: str,
    workspace_session_id: str,
    font_name: str = "My Handwriting",
    fmt: str = "ttf",
) -> FileResponse:
    datasets = list_completed_datasets(user_id, workspace_session_id)
    glyph_roots = [dataset.glyph_root for dataset in datasets]
    
    if not glyph_roots:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No completed datasets found. Upload and process some handwriting first.",
        )

    settings = get_settings()
    # We store temporary fonts in the fonts_dir (which we'll define or use renders_dir)
    # For now, let's use a subfolder in data_dir
    temp_font_id = str(uuid4())
    output_dir = settings.data_dir / "temp_fonts" / user_id
    output_dir.mkdir(parents=True, exist_ok=True)
    
    output_path = output_dir / f"{temp_font_id}.ttf"
    
    try:
        final_path = generate_font_file(
            glyph_roots=glyph_roots,
            font_name=font_name,
            output_path=output_path,
            fmt=fmt,
        )
        
        media_type = "font/ttf" if fmt == "ttf" else "font/woff"
        safe_name = font_name.replace(" ", "_")
        filename = f"{safe_name}.{fmt}"
        
        return FileResponse(
            final_path,
            media_type=media_type,
            filename=filename,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Font generation failed: {str(exc)}",
        )

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parents[2]
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

import api_server  # noqa: E402
import extractor  # noqa: E402
import renderer  # noqa: E402


def build_frontend_defaults() -> dict:
    return api_server.build_frontend_default_options()


def build_frontend_features() -> dict:
    return api_server.build_frontend_features()


def extract_dataset(image_path: Path, dataset_type: str, output_folder: Path) -> Path:
    if dataset_type == "coding":
        labels = extractor.DEFAULT_CODING_SYMBOLS
        labels_file = extractor.CODING_SYMBOL_DIR / "labels.txt"
        if labels_file.exists():
            labels = extractor.load_labels_from_file(labels_file)
        labels = extractor.normalize_labels(
            labels,
            extractor.CODING_GRID_ROWS,
            extractor.CODING_GRID_COLS,
        )
        extractor.extract(
            image_path=str(image_path),
            output_folder=str(output_folder),
            grid_rows=extractor.CODING_GRID_ROWS,
            grid_cols=extractor.CODING_GRID_COLS,
            labels=labels,
            grid_mode="perspective",
            skip_morph=True,
            use_bounds=True,
            center_symbols=True,
            clean_symbols=True,
            threshold_mode="auto",
        )
    else:
        extractor.extract(
            image_path=str(image_path),
            output_folder=str(output_folder),
        )

    return output_folder


def render_page(
    text: str,
    options: dict,
    glyph_roots: list[str],
    output_path: Path,
    background_path: Path | None = None,
) -> Path:
    cfg = api_server.build_render_config(options)
    if background_path is not None:
        cfg["background_path"] = str(background_path)
    renderer.render(
        text=text,
        output_path=str(output_path),
        glyphs_dir=glyph_roots,
        cfg=cfg,
    )
    return output_path

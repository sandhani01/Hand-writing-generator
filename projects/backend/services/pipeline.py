from __future__ import annotations

import sys
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parents[2]
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

import api_server  # noqa: E402
import extractor  # noqa: E402
import renderer  # noqa: E402
import font_gen  # noqa: E402


def build_frontend_defaults() -> dict:

    return api_server.build_frontend_default_options()


def build_frontend_features() -> dict:
    return api_server.build_frontend_features()


def build_default_fonts() -> list[str]:
    default_dir = Path(api_server.PROJECT_DIR) / "Default Glyphs"
    if not default_dir.exists():
        return []
    return [d.name for d in default_dir.iterdir() if d.is_dir()]


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
            skip_morph=True,
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


def generate_font_file(
    glyph_roots: list[str],
    font_name: str,
    output_path: Path,
    fmt: str = "ttf",
) -> Path:
    library = font_gen.load_glyph_images(glyph_roots)
    if not library:
        raise ValueError("No glyph images found in the specified datasets.")

    font = font_gen.build_font(library, font_name=font_name)
    font.save(str(output_path))

    if fmt == "woff":
        woff_path = output_path.with_suffix(".woff")
        font_gen.convert_to_woff(str(output_path), str(woff_path))
        return woff_path

    return output_path


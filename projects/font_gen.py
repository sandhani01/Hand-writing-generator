"""
font_gen.py — Handwritten Font Generator
=========================================
Converts extracted glyph PNGs into an installable TrueType (.ttf) font file.

Pipeline:
  1. Load glyph PNGs from the same folder structure used by renderer.py
  2. Vectorize each glyph using OpenCV contour tracing
  3. Convert contours to TrueType outlines (quadratic Bézier) via fonttools
  4. Assemble a valid .ttf with all required tables
  5. Optionally emit .woff for web use

Usage:
  python font_gen.py --glyphs-dir "Default Glyphs/font-1/Handwritten Font Glyphs/a (1)"
  python font_gen.py --glyphs-dir "Default Glyphs/font-1/Handwritten Font Glyphs/a (1)","Default Glyphs/font-1/Symbol Font Glyphs/coding1"
  python font_gen.py --glyphs-dir "glyph_sets/handwriting1" --name "My Handwriting" --output my_font.ttf
"""

import argparse
import os
import struct
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from fontTools.ttLib import TTFont
from fontTools.fontBuilder import FontBuilder

PROJECT_DIR = Path(__file__).resolve().parent


# ---------------------------------------------------------------------------
# Character ↔ folder mapping  (mirrors renderer.py / extractor.py)
# ---------------------------------------------------------------------------

SYMBOL_FOLDER_MAP = {
    "!": "exclam",
    "@": "at",
    "#": "hash",
    "$": "dollar",
    "%": "percent",
    "^": "caret",
    "&": "ampersand",
    "*": "asterisk",
    "(": "lparen",
    ")": "rparen",
    "-": "dash",
    "_": "underscore",
    "=": "equals",
    "+": "plus",
    "[": "lbracket",
    "]": "rbracket",
    "{": "lbrace",
    "}": "rbrace",
    ";": "semicolon",
    ":": "colon",
    "'": "apostrophe",
    '"': "quote",
    "<": "lt",
    ">": "gt",
    "/": "slash",
    "?": "question",
    "\\": "backslash",
    "|": "pipe",
    "`": "backtick",
    "~": "tilde",
    ",": "comma",
    ".": "dot",
}

FOLDER_TO_CHAR = {}
for _ch, _folder in SYMBOL_FOLDER_MAP.items():
    FOLDER_TO_CHAR[_folder] = _ch

# letters + digits
for _c in "abcdefghijklmnopqrstuvwxyz":
    FOLDER_TO_CHAR[f"{_c}_lower"] = _c
    FOLDER_TO_CHAR[f"{_c}_upper"] = _c.upper()
for _d in "0123456789":
    FOLDER_TO_CHAR[_d] = _d


# Full set of characters we want in the font
ALL_CHARS = (
    list("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789")
    + list(SYMBOL_FOLDER_MAP.keys())
)


def get_folder_name(char: str) -> str:
    """Same logic as renderer.py get_folder_name."""
    if char.isupper():
        return char + "_upper"
    if char.islower():
        return char + "_lower"
    if char.isdigit():
        return char
    if char in SYMBOL_FOLDER_MAP:
        return SYMBOL_FOLDER_MAP[char]
    return str(char)


# ---------------------------------------------------------------------------
# Glyph loading
# ---------------------------------------------------------------------------

def resolve_project_path(path_like):
    path = Path(path_like)
    if path.is_absolute():
        return path
    if path.exists():
        return path.resolve()
    return (PROJECT_DIR / path).resolve()


def load_glyph_images(glyphs_dirs) -> dict[str, list[np.ndarray]]:
    """
    Load all glyph PNGs from one or more root directories.
    Returns {folder_name: [grayscale_array, ...]}.
    """
    if isinstance(glyphs_dirs, str):
        glyphs_dirs = [d.strip() for d in glyphs_dirs.split(",") if d.strip()]

    library: dict[str, list[np.ndarray]] = {}

    for root_str in glyphs_dirs:
        root = resolve_project_path(root_str)
        if not root.exists():
            print(f"  [warn] Glyph directory not found: {root}")
            continue

        for img_path in sorted(root.rglob("*.png")):
            if img_path.name == "detected_grid_debug.png":
                continue
            folder = img_path.parent.name
            img = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
            if img is not None and img.size > 0:
                library.setdefault(folder, []).append(img)

    return library


def pick_best_glyph(samples: list[np.ndarray]) -> np.ndarray:
    """
    Pick the representative glyph from multiple samples.
    Chooses the one that is most 'central' in terms of density (ignoring outliers).
    """
    if len(samples) == 1:
        return samples[0]

    # Simple heuristic: ignore very high density (ink spills) or very low (faded)
    # and pick the median density sample.
    densities = [int(np.sum(s > 30)) for s in samples]
    median_density = np.percentile(densities, 50)
    
    # Find the sample closest to the median density
    best_idx = 0
    min_diff = float("inf")
    for i, d in enumerate(densities):
        diff = abs(d - median_density)
        if diff < min_diff:
            min_diff = diff
            best_idx = i

    return samples[best_idx]


# ---------------------------------------------------------------------------
# Vectorisation: Bitmap → TrueType contours
# ---------------------------------------------------------------------------

# Font metrics constants (in font units; standard UPM = 1000)
UNITS_PER_EM = 1000
ASCENT = 800
DESCENT = -200
CAP_HEIGHT = 700
X_HEIGHT = 500
LINE_GAP = 0


def bitmap_to_contours(gray: np.ndarray, target_height: int = ASCENT) -> list[list[tuple[int, int]]]:
    """
    Convert a grayscale glyph image to a list of smoothed closed contours.
    """
    # 1. Minimal Cleaning
    cleaned = cv2.medianBlur(gray, 3)
    
    # 2. Thresholding: Robust Otsu
    _, binary = cv2.threshold(cleaned, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    if np.sum(binary == 255) > np.sum(binary == 0):
        binary = cv2.bitwise_not(binary)
    if np.sum(binary) == 0:
        return []

    # 3. High-res Upscale WITHOUT blurring
    # We use high resolution to allow the vectorizer to place points with sub-pixel precision.
    scale_factor = 4
    upscaled = cv2.resize(
        binary,
        (binary.shape[1] * scale_factor, binary.shape[0] * scale_factor),
        interpolation=cv2.INTER_NEAREST,
    )

    # 4. Extraction with high fidelity
    contours, hierarchy = cv2.findContours(
        upscaled, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE
    )

    if not contours:
        return []

    img_h, img_w = upscaled.shape[:2]
    font_scale = target_height / max(img_h, 1)
    
    result = []
    for i, contour in enumerate(contours):
        if len(contour) < 3:
            continue

        # 5. Very Gentle Simplification
        # We use a tiny epsilon to keep the exact shape, but just enough to remove redundant pixels.
        epsilon = 0.12 * scale_factor 
        approx = cv2.approxPolyDP(contour, epsilon, True)
        
        if len(approx) < 3:
            continue

        points_raw = [(float(pt[0][0]), float(pt[0][1])) for pt in approx]
        
        # Simple rolling average to remove quantization noise (pixel steps)
        n_pts = len(points_raw)
        smoothed_points = []
        if n_pts > 4:
            for j in range(n_pts):
                p_m1 = points_raw[(j - 1) % n_pts]
                p_0  = points_raw[j]
                p_p1 = points_raw[(j + 1) % n_pts]
                smoothed_points.append((
                    (p_m1[0] + 2*p_0[0] + p_p1[0]) / 4.0,
                    (p_m1[1] + 2*p_0[1] + p_p1[1]) / 4.0
                ))
        else:
            smoothed_points = points_raw

        # 6. Coordinate Space Conversion
        font_points = []
        for px, py in smoothed_points:
            fx = int(round(px * font_scale))
            fy = int(round((img_h - py) * font_scale))
            font_points.append((fx, fy))

        # 7. Winding Logic
        area = _signed_area(font_points)
        is_outer = (hierarchy is not None and hierarchy[0][i][3] == -1)
        if (is_outer and area > 0) or (not is_outer and area < 0):
            font_points.reverse()

        result.append(font_points)

    return result


def _signed_area(points: list[tuple[int, int]]) -> float:
    """Compute signed area of a polygon. Positive = counter-clockwise in y-up."""
    area = 0.0
    n = len(points)
    for i in range(n):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % n]
        area += (x2 - x1) * (y2 + y1)
    return area / 2.0


def compute_glyph_width(contours: list[list[tuple[int, int]]]) -> int:
    """Compute the advance width from the contour bounding box."""
    if not contours:
        return int(UNITS_PER_EM * 0.5)

    all_x = [pt[0] for contour in contours for pt in contour]
    max_x = max(all_x) if all_x else 0
    # Add some side-bearing
    return int(max_x + UNITS_PER_EM * 0.08)


def compute_lsb(contours: list[list[tuple[int, int]]]) -> int:
    """Compute left side bearing."""
    if not contours:
        return 0
    all_x = [pt[0] for contour in contours for pt in contour]
    return min(all_x) if all_x else 0


# ---------------------------------------------------------------------------
# Font builder
# ---------------------------------------------------------------------------

def build_font(
    glyph_library: dict[str, list[np.ndarray]],
    font_name: str = "My Handwriting",
    family_name: str | None = None,
) -> TTFont:
    """
    Build a TTFont from the glyph library.
    """
    if family_name is None:
        family_name = font_name

    # Build the character → contours mapping
    char_glyphs: dict[str, list[list[tuple[int, int]]]] = {}
    char_widths: dict[str, int] = {}

    print(f"\n[*] Vectorizing glyphs...")
    missing = []

    for char in ALL_CHARS:
        folder = get_folder_name(char)
        samples = glyph_library.get(folder, [])

        if not samples:
            missing.append(char)
            continue

        best = pick_best_glyph(samples)

        # Determine target height based on character type
        if char.isupper():
            target_h = CAP_HEIGHT
        elif char.islower() and char in "bdfhklt":
            target_h = int(ASCENT * 0.85)
        elif char.islower() and char in "gjpqy":
            target_h = int(X_HEIGHT * 1.4)
        elif char.islower():
            target_h = X_HEIGHT
        elif char.isdigit():
            target_h = int(CAP_HEIGHT * 0.9)
        elif char in ".,":
            target_h = int(X_HEIGHT * 0.25)
        else:
            target_h = int(CAP_HEIGHT * 0.85)

        contours = bitmap_to_contours(best, target_height=target_h)
        if contours:
            char_glyphs[char] = contours
            char_widths[char] = compute_glyph_width(contours)
        else:
            missing.append(char)

    if missing:
        print(f"  [!] Missing/empty glyphs for: {''.join(missing)}")

    if not char_glyphs:
        raise RuntimeError("No glyphs could be vectorized! Check your glyph directories.")

    print(f"  [ok] Vectorized {len(char_glyphs)} glyphs")

    # --------------- Build the font with FontBuilder ---------------

    # Glyph names
    glyph_names = [".notdef", "space"]
    char_map = {}  # unicode codepoint → glyph name

    for char in sorted(char_glyphs.keys()):
        # Use standard PostScript glyph naming
        glyph_name = _ps_glyph_name(char)
        glyph_names.append(glyph_name)
        char_map[ord(char)] = glyph_name

    # Also map space
    char_map[0x20] = "space"

    fb = FontBuilder(UNITS_PER_EM, isTTF=True)
    fb.setupGlyphOrder(glyph_names)
    fb.setupCharacterMap(char_map)

    # ---- Draw glyphs ----
    glyph_table = {}

    # .notdef — empty rectangle
    pen = fb.setupGlyf({})  # creates the glyf table
    notdef_pen = pen[".notdef"] if isinstance(pen, dict) else None

    # We'll use a different approach: draw glyphs directly
    from fontTools.pens.ttGlyphPen import TTGlyphPen
    from fontTools.ttLib.tables._g_l_y_f import Glyph

    glyf_table = fb.font["glyf"]

    # .notdef glyph (empty)
    notdef_pen = TTGlyphPen(None)
    notdef_pen.moveTo((50, 0))
    notdef_pen.lineTo((450, 0))
    notdef_pen.lineTo((450, 700))
    notdef_pen.lineTo((50, 700))
    notdef_pen.closePath()
    notdef_pen.moveTo((100, 50))
    notdef_pen.lineTo((100, 650))
    notdef_pen.lineTo((400, 650))
    notdef_pen.lineTo((400, 50))
    notdef_pen.closePath()
    glyf_table[".notdef"] = notdef_pen.glyph()

    # space glyph (empty, no contours)
    space_pen = TTGlyphPen(None)
    glyf_table["space"] = space_pen.glyph()

    # Character glyphs
    for char in sorted(char_glyphs.keys()):
        glyph_name = _ps_glyph_name(char)
        contours = char_glyphs[char]

        pen = TTGlyphPen(None)
        for contour in contours:
            if len(contour) < 3:
                continue
            
            # Use qCurveTo on the high-fidelity polyline.
            # This creates a smooth quadratic spline that stays very close to the natural ink line.
            pen.moveTo(contour[0])
            if len(contour) > 1:
                pen.qCurveTo(*contour[1:])
            pen.closePath()

        try:
            glyf_table[glyph_name] = pen.glyph()
        except Exception as e:
            print(f"  [!] Failed to build glyph '{char}': {e}")

    # ---- Metrics ----
    metrics = {}
    metrics[".notdef"] = (500, 50)
    metrics["space"] = (int(UNITS_PER_EM * 0.3), 0)
    for char in sorted(char_glyphs.keys()):
        glyph_name = _ps_glyph_name(char)
        width = char_widths.get(char, int(UNITS_PER_EM * 0.5))
        lsb = compute_lsb(char_glyphs[char])
        metrics[glyph_name] = (width, lsb)

    fb.setupHorizontalMetrics(metrics)

    fb.setupHorizontalHeader(
        ascent=ASCENT,
        descent=DESCENT,
    )

    fb.setupNameTable({
        "familyName": family_name,
        "styleName": "Regular",
        "psName": family_name.replace(" ", ""),
        "manufacturer": "Handwritten Notes Generator",
        "designer": "User",
        "description": f"Handwritten font generated from scanned handwriting samples.",
        "vendorURL": "",
        "designerURL": "",
        "licenseDescription": "Free for personal use",
        "version": "Version 1.0",
    })

    fb.setupOS2(
        sTypoAscender=ASCENT,
        sTypoDescender=DESCENT,
        sTypoLineGap=LINE_GAP,
        usWinAscent=ASCENT,
        usWinDescent=abs(DESCENT),
        sxHeight=X_HEIGHT,
        sCapHeight=CAP_HEIGHT,
        fsType=0,  # Installable embedding
    )

    fb.setupPost()

    fb.setupHead(
        unitsPerEm=UNITS_PER_EM,
    )

    return fb.font


def _ps_glyph_name(char: str) -> str:
    """Return a PostScript-valid glyph name for a character."""
    # Standard names for common characters
    _NAMES = {
        " ": "space",
        "!": "exclam",
        '"': "quotedbl",
        "#": "numbersign",
        "$": "dollar",
        "%": "percent",
        "&": "ampersand",
        "'": "quotesingle",
        "(": "parenleft",
        ")": "parenright",
        "*": "asterisk",
        "+": "plus",
        ",": "comma",
        "-": "hyphen",
        ".": "period",
        "/": "slash",
        ":": "colon",
        ";": "semicolon",
        "<": "less",
        "=": "equal",
        ">": "greater",
        "?": "question",
        "@": "at",
        "[": "bracketleft",
        "\\": "backslash",
        "]": "bracketright",
        "^": "asciicircum",
        "_": "underscore",
        "`": "grave",
        "{": "braceleft",
        "|": "bar",
        "}": "braceright",
        "~": "asciitilde",
    }

    if char in _NAMES:
        return _NAMES[char]
    if char.isalpha() or char.isdigit():
        return char if char.islower() or char.isdigit() else char
    # Fallback: uni+codepoint
    return f"uni{ord(char):04X}"


# ---------------------------------------------------------------------------
# WOFF conversion
# ---------------------------------------------------------------------------

def convert_to_woff(ttf_path: str, woff_path: str | None = None) -> str:
    """Convert a .ttf to .woff for web use."""
    if woff_path is None:
        woff_path = str(Path(ttf_path).with_suffix(".woff"))

    font = TTFont(ttf_path)
    font.flavor = "woff"
    font.save(woff_path)
    print(f"  [ok] WOFF saved: {woff_path}")
    return woff_path


def convert_to_woff2(ttf_path: str, woff2_path: str | None = None) -> str:
    """Convert a .ttf to .woff2 for web use (requires brotli)."""
    if woff2_path is None:
        woff2_path = str(Path(ttf_path).with_suffix(".woff2"))

    font = TTFont(ttf_path)
    font.flavor = "woff2"
    font.save(woff2_path)
    print(f"  [ok] WOFF2 saved: {woff2_path}")
    return woff2_path


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Generate a TrueType font (.ttf) from handwritten glyph PNGs."
    )
    parser.add_argument(
        "--glyphs-dir",
        required=True,
        help=(
            "Comma-separated list of glyph directories. "
            "Each should contain subfolders like a_lower/, A_upper/, exclam/, etc."
        ),
    )
    parser.add_argument(
        "--name",
        default="My Handwriting",
        help="Font family name (default: 'My Handwriting')",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Output .ttf file path (default: <name>.ttf in current directory)",
    )
    parser.add_argument(
        "--woff",
        action="store_true",
        help="Also generate .woff and .woff2 web font files",
    )

    args = parser.parse_args()

    # Resolve output path
    if args.output:
        output_path = args.output
    else:
        safe_name = args.name.replace(" ", "_")
        output_path = str(PROJECT_DIR / f"{safe_name}.ttf")

    print(f"=== Handwritten Font Generator ===")
    print(f"   Name: {args.name}")
    print(f"   Sources: {args.glyphs_dir}")
    print(f"   Output: {output_path}")

    # Load glyphs
    print(f"\n[*] Loading glyph images...")
    library = load_glyph_images(args.glyphs_dir)

    if not library:
        print("[ERROR] No glyph images found! Check your --glyphs-dir path.")
        return

    total_images = sum(len(v) for v in library.values())
    print(f"  [ok] Loaded {total_images} images across {len(library)} character folders")

    # Build font
    font = build_font(library, font_name=args.name)

    # Save
    font.save(output_path)
    file_size = os.path.getsize(output_path)
    print(f"\n[DONE] Font saved: {output_path} ({file_size / 1024:.1f} KB)")

    # Web formats
    if args.woff:
        try:
            convert_to_woff(output_path)
        except Exception as e:
            print(f"  [!] WOFF conversion failed: {e}")
        try:
            convert_to_woff2(output_path)
        except Exception as e:
            print(f"  [!] WOFF2 conversion failed (install 'brotli' package): {e}")

    print(f"\nDone! Install '{Path(output_path).name}' on your system to use your handwriting as a font.")


if __name__ == "__main__":
    main()

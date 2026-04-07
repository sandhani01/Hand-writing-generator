import os
import random
import argparse
import numpy as np
from pathlib import Path
from PIL import Image, ImageFilter, ImageEnhance

PROJECT_DIR = Path(__file__).resolve().parent


DEFAULT_CFG = {
    "page_width": 1240,
    "page_height": 1754,

    "margin_left": 100,
    "margin_top": 180,
    "margin_right": 30,
    "margin_bottom": 180,

    "backgrounds_dir": str(PROJECT_DIR / "backgrounds"),
    "background_file": "ruled.png",

    "glyphs_dir": str(PROJECT_DIR / "glyph_sets"),
    "glyph_size": 44,
    "render_scale_multiplier": 1.42,

    "line_height": 82,

    "char_spacing": -1,
    "word_spacing": 26,
    "word_spacing_jitter": 3,
    "line_drift_per_word": 0.18,
    "baseline_jitter": 0.25,

    "rotation_range": (-2.0, 2.0),

    "ink_color": (15, 30, 80),
    "page_color": (252, 248, 235),

    "pressure_min": 0.90,
    "pressure_max": 0.98,
    "stroke_gain": 1.28,
    "edge_roughness": 0.0,
    "texture_blend": 0.08,
}

ASCENDERS = set("bdfhklt")
DESCENDERS = set("gjpqy")
X_HEIGHT_LOWER = set("acemnorsuvwxz")

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
    "\"": "quote",
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


def get_folder_name(char):
    if char.isupper():
        return char + "_upper"
    if char.islower():
        return char + "_lower"
    if char.isdigit():
        return char
    if char in SYMBOL_FOLDER_MAP:
        return SYMBOL_FOLDER_MAP[char]
    return str(char)


def get_char_group(char):
    if char.isupper():
        return "upper"
    if char.isdigit():
        return "digit"
    if char == ",":
        return "comma"
    if char == ".":
        return "dot"
    if char in ASCENDERS:
        return "lower_asc"
    if char in DESCENDERS:
        return "lower_desc"
    if char in X_HEIGHT_LOWER:
        return "lower_x"
    if char.islower():
        return "lower_other"
    if not char.isalnum():
        return "symbol"
    return "other"


def get_char_metrics(char):
    group = get_char_group(char)

    if group == "upper":
        return {
            "scale_range": (0.48, 0.54),
            "width_factor": 1.00,
            "baseline_shift": 0,
        }
    if group == "lower_asc":
        return {
            "scale_range": (0.41, 0.45),
            "width_factor": 0.96,
            "baseline_shift": 0,
        }
    if group == "lower_desc":
        return {
            "scale_range": (0.46, 0.52),
            "width_factor": 0.96,
            "baseline_shift": 16,
        }
    if group == "lower_x":
        return {
            "scale_range": (0.33, 0.36),
            "width_factor": 0.92,
            "baseline_shift": 0,
        }
    if group == "digit":
        return {
            "scale_range": (0.34, 0.39),
            "width_factor": 0.92,
            "baseline_shift": 0,
        }
    if group == "comma":
        return {
            "scale_range": (0.28, 0.34),
            "width_factor": 0.70,
            "baseline_shift": 10,
        }
    if group == "dot":
        return {
            "scale_range": (0.22, 0.28),
            "width_factor": 0.62,
            "baseline_shift": 0,
        }
    if group == "symbol":
        return {
            "scale_range": (0.54, 0.60),
            "width_factor": 1.50,
            "baseline_shift": 0,
        }

    return {
        "scale_range": (0.33, 0.37),
        "width_factor": 0.92,
        "baseline_shift": 0,
    }


def estimate_word_width(word, cfg):
    width = 0

    for c in word:
        metrics = get_char_metrics(c)
        min_scale, max_scale = metrics["scale_range"]
        scale = ((min_scale + max_scale) / 2) * cfg["render_scale_multiplier"]
        char_width = cfg["glyph_size"] * scale * metrics["width_factor"]
        width += char_width + cfg["char_spacing"]

    return int(width)


def resolve_project_path(path_like):
    path = Path(path_like)
    if path.is_absolute():
        return path
    if path.exists():
        return path.resolve()
    return (PROJECT_DIR / path).resolve()


def split_glyph_roots(glyphs_dir):
    if isinstance(glyphs_dir, (list, tuple)):
        raw_roots = glyphs_dir
    else:
        raw_roots = [glyphs_dir]

    roots = []

    for root in raw_roots:
        if not root:
            continue

        parts = [part.strip() for part in str(root).split(",") if part.strip()]
        roots.extend(parts)

    return [resolve_project_path(root) for root in roots]


def load_glyph_library(glyphs_dir):
    library = {}

    roots = split_glyph_roots(glyphs_dir)

    if not roots:
        raise FileNotFoundError(
            "No glyph directories provided. Run extractor.py first."
        )

    missing_roots = []
    found_images = False

    for root in roots:
        if not root.exists():
            missing_roots.append(str(root))
            continue

        for img in sorted(root.rglob("*.png")):
            folder = img.parent.name
            library.setdefault(folder, []).append(
                Image.open(img).convert("L")
            )
            found_images = True

    if missing_roots and not found_images:
        raise FileNotFoundError(
            "Glyph folders not found: " + ", ".join(missing_roots)
        )

    if not found_images:
        raise FileNotFoundError(
            "No glyph PNGs found. Run extractor.py first."
        )

    return library


def load_background(cfg):
    bg_path = resolve_project_path(cfg["backgrounds_dir"]) / cfg["background_file"]

    if not bg_path.exists():
        page = Image.new(
            "RGB",
            (cfg["page_width"], cfg["page_height"]),
            cfg["page_color"]
        )
        return page

    bg = Image.open(bg_path).convert("RGB")

    if bg.size != (cfg["page_width"], cfg["page_height"]):
        bg = bg.resize(
            (cfg["page_width"], cfg["page_height"]),
            Image.LANCZOS
        )

    return bg


def trim_transparent_bounds(img):
    alpha = img.getchannel("A")
    bbox = alpha.getbbox()

    if bbox is None:
        return img

    return img.crop(bbox)


def roughen_alpha(alpha, roughness):
    arr = np.array(alpha, dtype=np.float32)

    if roughness <= 0:
        return alpha

    noise = np.random.normal(0, 255 * roughness, arr.shape)
    arr = np.clip(arr + noise, 0, 255)

    mask = Image.fromarray(arr.astype(np.uint8), "L")
    blur_radius = random.uniform(0.2, 0.6)

    return mask.filter(ImageFilter.GaussianBlur(blur_radius))


def prepare_glyph(glyph_gray, ink, scale, angle, pressure, cfg):

    new_size = (
        max(1, int(glyph_gray.width * scale)),
        max(1, int(glyph_gray.height * scale))
    )

    glyph = glyph_gray.resize(new_size, Image.LANCZOS)

    arr = np.array(glyph) / 255.0

    rgba = np.zeros((*arr.shape, 4), dtype=np.uint8)

    rgba[..., 0] = ink[0]
    rgba[..., 1] = ink[1]
    rgba[..., 2] = ink[2]
    alpha = np.clip(
        arr * pressure * cfg["stroke_gain"] * 255,
        0,
        255
    )
    rgba[..., 3] = alpha.astype(np.uint8)

    img = Image.fromarray(rgba, "RGBA")
    rotated = img.rotate(angle, expand=True, resample=Image.BICUBIC)
    rotated = trim_transparent_bounds(rotated)

    if rotated.getbbox() is None:
        return rotated

    alpha = rotated.getchannel("A")
    alpha = roughen_alpha(alpha, cfg["edge_roughness"])
    rotated.putalpha(alpha)

    return trim_transparent_bounds(rotated)


def paste_with_texture(page, glyph_rgba, x, y, cfg):
    gw, gh = glyph_rgba.size

    if gw <= 0 or gh <= 0:
        return

    x1 = max(0, x)
    y1 = max(0, y)
    x2 = min(page.width, x + gw)
    y2 = min(page.height, y + gh)

    if x1 >= x2 or y1 >= y2:
        return

    patch = page.crop((x1, y1, x2, y2)).convert("RGB")
    glyph_crop = glyph_rgba.crop((x1 - x, y1 - y, x2 - x, y2 - y)).copy()

    alpha = np.array(glyph_crop.getchannel("A"), dtype=np.float32)
    patch_arr = np.array(patch, dtype=np.float32)
    luminance = patch_arr.mean(axis=2) / 255.0

    alpha *= 1.0 - cfg["texture_blend"] * (1.0 - luminance)
    alpha *= random.uniform(0.97, 1.03)
    alpha = np.clip(alpha, 0, 255)
    glyph_crop.putalpha(Image.fromarray(alpha.astype(np.uint8), "L"))

    patch.paste(glyph_crop, (0, 0), glyph_crop)
    page.paste(patch, (x1, y1))


def render_char(page, char, library, cfg, x, baseline, glyph_cache):
    folder = get_folder_name(char)
    samples = library.get(folder)

    if not samples:
        return x + cfg["word_spacing"]

    glyph = random.choice(samples)
    metrics = get_char_metrics(char)

    angle = random.uniform(*cfg["rotation_range"])
    pressure = random.uniform(cfg["pressure_min"], cfg["pressure_max"])
    scale = random.uniform(*metrics["scale_range"]) * cfg["render_scale_multiplier"]
    baseline_shift = metrics["baseline_shift"] + random.uniform(
        -cfg["baseline_jitter"],
        cfg["baseline_jitter"]
    )

    glyph_rgba = prepare_glyph(
        glyph,
        cfg["ink_color"],
        scale,
        angle,
        pressure,
        cfg
    )

    gw, _ = glyph_rgba.size
    alpha_bbox = glyph_rgba.getchannel("A").getbbox()

    if alpha_bbox is None:
        return x + cfg["word_spacing"]

    ink_left, _, ink_right, ink_bottom = alpha_bbox
    y = baseline + baseline_shift - ink_bottom

    paste_with_texture(page, glyph_rgba, int(round(x)), int(round(y)), cfg)

    ink_width = max(1, ink_right - ink_left)
    side_bearing = max(1, int(round((gw - ink_width) * 0.45)))
    advance = ink_width + side_bearing + cfg["char_spacing"]
    advance = max(1, int(advance))

    return x + advance


def render_text(text, library, cfg):

    page = load_background(cfg)

    margin_left = cfg["margin_left"]
    usable_width = cfg["page_width"] - margin_left - cfg["margin_right"]

    words = [w for w in text.split(" ") if w]

    x = margin_left
    y = cfg["margin_top"]

    baseline = y
    line_drift = 0.0

    for word in words:

        word_width = estimate_word_width(word, cfg)

        if x + word_width > margin_left + usable_width:
            y += cfg["line_height"]
            baseline = y
            x = margin_left
            line_drift = 0.0

        for char in word:

            x = render_char(
                page,
                char,
                library,
                cfg,
                x,
                baseline + line_drift,
                None
            )

        x += cfg["word_spacing"] + random.uniform(
            -cfg["word_spacing_jitter"],
            cfg["word_spacing_jitter"]
        )
        line_drift += random.uniform(
            -cfg["line_drift_per_word"],
            cfg["line_drift_per_word"]
        )

    return page


def post_process(page):
    page = ImageEnhance.Brightness(page).enhance(
        random.uniform(0.97, 1.02)
    )

    return page


def render(text, output_path="page.png", glyphs_dir="glyphs", cfg=None):

    if cfg is None:
        cfg = DEFAULT_CFG.copy()

    library = load_glyph_library(glyphs_dir)

    page = render_text(text, library, cfg)

    page = post_process(page)

    page.save(output_path)

    print("Saved:", output_path)

    return output_path


if __name__ == "__main__":

    parser = argparse.ArgumentParser()

    parser.add_argument("--text")
    parser.add_argument("--file")

    parser.add_argument("--output", default="page.png")
    parser.add_argument("--glyphs-dir", action="append")

    args = parser.parse_args()

    if args.file:
        if not os.path.exists(args.file):
            print("File not found")
            exit()

        with open(args.file, "r", encoding="utf-8") as f:
            text = f.read()
    else:
        text = args.text

    glyphs_dir = args.glyphs_dir if args.glyphs_dir else DEFAULT_CFG["glyphs_dir"]

    render(text, args.output, glyphs_dir=glyphs_dir)

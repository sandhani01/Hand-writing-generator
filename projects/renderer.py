import os
import random
import argparse
import re
import numpy as np
from pathlib import Path
from PIL import Image, ImageFilter, ImageEnhance
try:
    import cv2
except ImportError:
    cv2 = None

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
    "background_path": None,

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
    "metric_overrides": {},
}

ASCENDERS = set("bdfhklt")
DESCENDERS = set("gjpqy")
X_HEIGHT_LOWER = set("acemnorsuvwxz")
TOP_SYMBOLS = set("^'\"`")
MID_SYMBOLS = set("-:+;<>=~")
LOW_SYMBOLS = set("_")

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

DEFAULT_CHAR_METRICS = {
    "upper": {
        "scale_range": (0.32, 0.36),
        "width_factor": 0.22,
        "baseline_shift": 0,
    },
    "lower_asc": {
        "scale_range": (0.41, 0.45),
        "width_factor": 0.96,
        "baseline_shift": 0,
    },

    "lower_desc": {
        "scale_range": (0.40, 0.44),
        "width_factor": 0.94,
        "baseline_shift": 10,
    },
    "lower_x": {
        "scale_range": (0.33, 0.36),
        "width_factor": 0.92,
        "baseline_shift": 0,
    },
    "digit": {
        "scale_range": (0.34, 0.39),
        "width_factor": 0.92,
        "baseline_shift": 0,
    },
    "comma": {
        "scale_range": (0.16, 0.20),
        "width_factor": 0.70,
        "baseline_shift": 10,
    },
    "dot": {
        "scale_range": (0.12, 0.14),
        "width_factor": 0.62,
        "baseline_shift": 0,
    },
    "symbol": {
        "scale_range": (0.36,0.40),
        "width_factor": 1.05,
        "baseline_shift": 2,
    },
    "symbol_top": {
        "scale_range": (0.36,0.40),
        "width_factor": 1.05,
        "baseline_shift": -18,
    },
    "symbol_mid_uplifted": {
        "scale_range": (0.36,0.40),
        "width_factor": 1.10,
        "baseline_shift": -7,
    },
    "symbol_mid": {
        "scale_range": (0.36,0.40),
        "width_factor": 1.10,
        "baseline_shift": 4,
    },
    "symbol_low": {
        "scale_range": (0.36,0.40),
        "width_factor": 1.10,
        "baseline_shift": 4,
    },
    "other": {
        "scale_range": (0.33, 0.37),
        "width_factor": 0.92,
        "baseline_shift": 0,
    },
}

MULTIPART_GLYPH_FOLDERS = {
    "i_lower",
    "j_lower",
    "exclam",
    "question",
    "semicolon",
    "colon",
    "quote",
    "percent",
    "equals",
    "hash",
    "asterisk",
}


def clean_loaded_glyph_components(
    glyph_array,
    min_area=4,
    ratio=0.18,
    preserve_neighbors=False,
):
    if cv2 is None:
        return glyph_array

    mask = (glyph_array > 0).astype(np.uint8)
    
    # Bridge tiny gaps (like interpolation ringing) so soft edges stay connected to the main body
    kernel = np.ones((3, 3), np.uint8)
    dilated_mask = cv2.dilate(mask, kernel, iterations=1)
    
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
        dilated_mask, connectivity=8
    )

    if num_labels <= 1:
        return glyph_array

    components = []
    for label_index in range(1, num_labels):
        area = int(stats[label_index, cv2.CC_STAT_AREA])
        if area < min_area:
            continue

        x = int(stats[label_index, cv2.CC_STAT_LEFT])
        y = int(stats[label_index, cv2.CC_STAT_TOP])
        w = int(stats[label_index, cv2.CC_STAT_WIDTH])
        h = int(stats[label_index, cv2.CC_STAT_HEIGHT])
        components.append(
            {
                "label": label_index,
                "area": area,
                "x": x,
                "y": y,
                "w": w,
                "h": h,
                "cx": x + (w / 2.0),
                "cy": y + (h / 2.0),
            }
        )

    if not components:
        return glyph_array

    largest_area = max(component["area"] for component in components)
    keep_threshold = max(min_area, int(round(largest_area * ratio)))
    primary = [
        component for component in components
        if component["area"] >= keep_threshold
    ]

    if not primary:
        primary = [max(components, key=lambda component: component["area"])]

    kept_labels = {component["label"] for component in primary}

    if preserve_neighbors:
        ref_x1 = min(component["x"] for component in primary)
        ref_y1 = min(component["y"] for component in primary)
        ref_x2 = max(component["x"] + component["w"] for component in primary)
        ref_y2 = max(component["y"] + component["h"] for component in primary)
        ref_cx = (ref_x1 + ref_x2) / 2.0
        ref_w = ref_x2 - ref_x1
        ref_h = ref_y2 - ref_y1
        neighbor_threshold = max(min_area, int(round(largest_area * 0.04)))

        for component in components:
            if component["label"] in kept_labels:
                continue
            if component["area"] < neighbor_threshold:
                continue

            horizontal_distance = abs(component["cx"] - ref_cx)
            horizontal_limit = max(14, ref_w * 0.80)

            if component["y"] + component["h"] < ref_y1:
                vertical_gap = ref_y1 - (component["y"] + component["h"])
            elif component["y"] > ref_y2:
                vertical_gap = component["y"] - ref_y2
            else:
                vertical_gap = 0

            if (
                horizontal_distance <= horizontal_limit
                and vertical_gap <= max(26, ref_h * 1.30)
            ):
                kept_labels.add(component["label"])

    keep_mask = np.zeros_like(mask)
    for label_index in kept_labels:
        keep_mask[labels == label_index] = 1

    if keep_mask.sum() == 0:
        return glyph_array

    return (glyph_array * keep_mask).astype(np.uint8)


def clean_loaded_glyph(glyph_gray, folder):
    if cv2 is None:
        return glyph_gray

    glyph_array = np.array(glyph_gray, dtype=np.uint8)
    if glyph_array.size == 0 or np.max(glyph_array) == 0:
        return glyph_gray

    preserve_neighbors = True
    ratio = 0.08
    
    cleaned = clean_loaded_glyph_components(
        glyph_array,
        min_area=4,
        ratio=ratio,
        preserve_neighbors=preserve_neighbors,
    )
    
    # Soften jagged/aliased edges (from binary extraction) into smooth natural ink
    cleaned = cv2.GaussianBlur(cleaned, (3, 3), 0.8)
    
    return Image.fromarray(cleaned, "L")


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
    if char in TOP_SYMBOLS:
        return "symbol_top"
    if char == "-":
        return "symbol_mid_uplifted"
    if char in MID_SYMBOLS:
        return "symbol_mid"
    if char in LOW_SYMBOLS:
        return "symbol_low"
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


def get_char_metrics(char, cfg=None):
    group = get_char_group(char)
    metrics = DEFAULT_CHAR_METRICS.get(group, DEFAULT_CHAR_METRICS["other"]).copy()
    metrics.setdefault("stroke_gain_multiplier", 1.0)
    metrics.setdefault("char_spacing_before_delta", 0.0)
    metrics.setdefault("char_spacing_delta", 0.0)

    if not cfg:
        return metrics

    def apply_overrides(source):
        scale_multiplier = float(source.get("scale_multiplier", 1.0))
        width_multiplier = float(source.get("width_multiplier", 1.0))
        baseline_delta = float(source.get("baseline_shift", 0.0))
        stroke_multiplier = float(source.get("stroke_gain_multiplier", 1.0))
        spacing_before_delta = float(source.get("char_spacing_before_delta", 0.0))
        spacing_delta = float(source.get("char_spacing_delta", 0.0))

        min_scale, max_scale = metrics["scale_range"]
        metrics["scale_range"] = (
            min_scale * scale_multiplier,
            max_scale * scale_multiplier,
        )
        metrics["width_factor"] *= width_multiplier
        metrics["baseline_shift"] += baseline_delta
        metrics["stroke_gain_multiplier"] *= stroke_multiplier
        metrics["char_spacing_before_delta"] += spacing_before_delta
        metrics["char_spacing_delta"] += spacing_delta

    apply_overrides(cfg.get("metric_overrides", {}).get(group, {}))
    apply_overrides(cfg.get("char_overrides", {}).get(char, {}))

    return metrics


def estimate_word_width(word, cfg):
    width = 0

    for c in word:
        metrics = get_char_metrics(c, cfg)
        min_scale, max_scale = metrics["scale_range"]
        scale = ((min_scale + max_scale) / 2) * cfg["render_scale_multiplier"]
        char_width = cfg["glyph_size"] * scale * metrics["width_factor"]
        width += (
            char_width
            + cfg["char_spacing"]
            + metrics["char_spacing_delta"]
        )

    return int(width)


def estimate_space_width(space_run, cfg):
    total = 0

    for char in space_run:
        if char == "\t":
            total += cfg["word_spacing"] * 4
        else:
            total += cfg["word_spacing"]

    return int(total)


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
            glyph_gray = Image.open(img).convert("L")
            glyph_gray = clean_loaded_glyph(glyph_gray, folder)
            library.setdefault(folder, []).append(glyph_gray)
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
    background_path = cfg.get("background_path")
    if background_path:
        bg_path = resolve_project_path(background_path)
    else:
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
    metrics = get_char_metrics(char, cfg)
    draw_x = x + metrics["char_spacing_before_delta"]

    angle = random.uniform(*cfg["rotation_range"])
    pressure = random.uniform(cfg["pressure_min"], cfg["pressure_max"])
    scale = random.uniform(*metrics["scale_range"]) * cfg["render_scale_multiplier"]
    baseline_shift = metrics["baseline_shift"] + random.uniform(
        -cfg["baseline_jitter"],
        cfg["baseline_jitter"]
    )
    glyph_cfg = cfg.copy()
    glyph_cfg["stroke_gain"] = (
        cfg["stroke_gain"] * metrics["stroke_gain_multiplier"]
    )

    glyph_rgba = prepare_glyph(
        glyph,
        cfg["ink_color"],
        scale,
        angle,
        pressure,
        glyph_cfg
    )

    gw, _ = glyph_rgba.size
    alpha_bbox = glyph_rgba.getchannel("A").getbbox()

    if alpha_bbox is None:
        return x + cfg["word_spacing"]

    ink_left, _, ink_right, ink_bottom = alpha_bbox
    y = baseline + baseline_shift - ink_bottom

    paste_with_texture(page, glyph_rgba, int(round(draw_x)), int(round(y)), cfg)

    ink_width = max(1, ink_right - ink_left)
    side_bearing = max(1, int(round((gw - ink_width) * 0.45)))
    advance = (
        ink_width
        + side_bearing
        + cfg["char_spacing"]
        + metrics["char_spacing_delta"]
    )
    advance = max(1, int(advance))

    return x + advance


def render_text(text, library, cfg):

    page = load_background(cfg)

    margin_left = cfg["margin_left"]
    usable_width = cfg["page_width"] - margin_left - cfg["margin_right"]
    max_baseline = cfg["page_height"] - cfg["margin_bottom"]
    baseline = cfg["margin_top"]
    lines = text.split("\n")

    for line_index, line in enumerate(lines):
        if line_index > 0:
            baseline += cfg["line_height"]

        if baseline > max_baseline:
            break

        x = margin_left
        line_drift = 0.0

        if line == "":
            continue

        tokens = re.findall(r"\S+|\s+", line)

        for token in tokens:
            if token.isspace():
                x += estimate_space_width(token, cfg) + random.uniform(
                    -cfg["word_spacing_jitter"],
                    cfg["word_spacing_jitter"]
                )
                line_drift += random.uniform(
                    -cfg["line_drift_per_word"],
                    cfg["line_drift_per_word"]
                ) * max(1, len(token))
                continue

            word_width = estimate_word_width(token, cfg)

            if x != margin_left and x + word_width > margin_left + usable_width:
                baseline += cfg["line_height"]

                if baseline > max_baseline:
                    return page

                x = margin_left
                line_drift = 0.0

            for char in token:
                x = render_char(
                    page,
                    char,
                    library,
                    cfg,
                    x,
                    baseline + line_drift,
                    None
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

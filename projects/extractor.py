import argparse
import os
from pathlib import Path

import cv2
import numpy as np

PROJECT_DIR = Path(__file__).resolve().parent
DEFAULT_IMAGE_DIR = PROJECT_DIR / "handwriting_samples"
DEFAULT_IMAGE_PATH = str(DEFAULT_IMAGE_DIR / "handwriting.jpg")
DEFAULT_OUTPUT_ROOT = PROJECT_DIR / "glyph_sets"
CODING_SYMBOL_DIR = PROJECT_DIR / "coding_symbol_samples"

HANDWRITING_GRID_ROWS = 8
HANDWRITING_GRID_COLS = 8

CODING_GRID_ROWS = 5
CODING_GRID_COLS = 6
MIN_COMPONENT_AREA = 6
PRIMARY_COMPONENT_AREA = 50

HANDWRITING_LABELS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789,.")

DEFAULT_CODING_SYMBOLS = [
    "!", "@", "#", "%", "^", "&",
    "*", "(", ")", "-", "_", "=",
    "+", "[", "]", "{", "}", ";",
    ":", "'", "\"", "<", ">", "/",
    "?", "\\", "|", "`", "~", "",
]

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


def default_output_folder(image_path, output_root=DEFAULT_OUTPUT_ROOT):
    stem = Path(image_path).stem
    return str(Path(output_root) / stem)


def default_debug_output_path(output_folder):
    return str(Path(output_folder) / "detected_grid_debug.png")


def discover_images(image_dir, pattern="*.jpg", required=False):
    directory = Path(image_dir)

    if not directory.exists():
        if required:
            raise FileNotFoundError(f"Samples folder not found: {directory}")
        return []

    images = sorted(directory.glob(pattern))

    if required and not images:
        raise FileNotFoundError(
            f"No sample images found in: {directory}"
        )

    return images


def discover_handwriting_images(image_dir=DEFAULT_IMAGE_DIR):
    return discover_images(image_dir, pattern="handwriting*.jpg", required=True)


def resolve_project_path(path_like):
    path = Path(path_like)
    if path.is_absolute():
        return path
    if path.exists():
        return path.resolve()
    return (PROJECT_DIR / path).resolve()


def folder_name(letter):
    if letter.isupper():
        return letter + "_upper"
    if letter.islower():
        return letter + "_lower"
    if letter.isdigit():
        return letter
    if letter in SYMBOL_FOLDER_MAP:
        return SYMBOL_FOLDER_MAP[letter]
    return str(letter)


def glyph_group(letter):
    if letter.isupper():
        return "upper"
    if letter.isdigit():
        return "digit"
    if letter in ASCENDERS:
        return "lower_asc"
    if letter in DESCENDERS:
        return "lower_desc"
    if letter in X_HEIGHT_LOWER:
        return "lower_x"
    if letter.islower():
        return "lower_other"
    return "symbol"


def make_box(x, y, w, h, area):
    return {
        "x": int(x),
        "y": int(y),
        "w": int(w),
        "h": int(h),
        "area": float(area),
        "cx": x + w / 2.0,
        "cy": y + h / 2.0,
    }


def merge_boxes(boxes):
    x1 = min(box["x"] for box in boxes)
    y1 = min(box["y"] for box in boxes)
    x2 = max(box["x"] + box["w"] for box in boxes)
    y2 = max(box["y"] + box["h"] for box in boxes)

    return {
        "x": x1,
        "y": y1,
        "w": x2 - x1,
        "h": y2 - y1,
        "area": sum(box["area"] for box in boxes),
        "cx": (x1 + x2) / 2.0,
        "cy": (y1 + y2) / 2.0,
    }


def crop_to_content(roi, pad=4):
    coords = cv2.findNonZero(roi)

    if coords is None:
        return roi

    x, y, w, h = cv2.boundingRect(coords)
    x1 = max(x - pad, 0)
    y1 = max(y - pad, 0)
    x2 = min(x + w + pad, roi.shape[1])
    y2 = min(y + h + pad, roi.shape[0])

    return roi[y1:y2, x1:x2]


def cluster_axis(values, groups):
    samples = np.array(values, dtype=np.float32).reshape(-1, 1)

    if len(samples) < groups:
        raise ValueError(
            f"Not enough components to cluster into {groups} groups."
        )

    cv2.setRNGSeed(42)
    criteria = (
        cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER,
        100,
        0.2,
    )
    _, _, centers = cv2.kmeans(
        samples,
        groups,
        None,
        criteria,
        20,
        cv2.KMEANS_PP_CENTERS,
    )

    return sorted(float(center[0]) for center in centers)


def nearest_index(value, centers):
    distances = [abs(value - center) for center in centers]
    return int(np.argmin(distances))


def gather_components(binary):
    contours, _ = cv2.findContours(
        binary,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    components = []

    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = cv2.contourArea(contour)

        if area >= MIN_COMPONENT_AREA:
            components.append(make_box(x, y, w, h, area))

    return components


def estimate_grid_centers(components, grid_rows, grid_cols):
    primary = [box for box in components if box["area"] > PRIMARY_COMPONENT_AREA]

    if len(primary) < grid_rows * grid_cols:
        raise RuntimeError(
            f"Not enough primary components to estimate the {grid_rows}x{grid_cols} layout."
        )

    col_centers = cluster_axis([box["cx"] for box in primary], grid_cols)
    row_centers = cluster_axis([box["cy"] for box in primary], grid_rows)

    return row_centers, col_centers


def assign_components_to_cells(components, row_centers, col_centers, grid_rows, grid_cols):
    cells = {(row, col): [] for row in range(grid_rows) for col in range(grid_cols)}

    for box in components:
        row = nearest_index(box["cy"], row_centers)
        col = nearest_index(box["cx"], col_centers)
        cells[(row, col)].append(box)

    return cells


def filter_cell_components(cell_boxes):
    if not cell_boxes:
        return []

    primary_boxes = [box for box in cell_boxes if box["area"] > PRIMARY_COMPONENT_AREA]

    if not primary_boxes:
        largest_area = max(box["area"] for box in cell_boxes)
        min_keep_area = max(MIN_COMPONENT_AREA, largest_area * 0.18)
        return [
            box for box in cell_boxes
            if box["area"] >= min_keep_area
        ]

    reference = merge_boxes(primary_boxes)
    kept = list(primary_boxes)

    for box in cell_boxes:
        if box in primary_boxes:
            continue

        horizontal_distance = abs(box["cx"] - reference["cx"])
        horizontal_limit = max(18, reference["w"] * 0.60)

        if box["y"] + box["h"] < reference["y"]:
            vertical_gap = reference["y"] - (box["y"] + box["h"])
        elif box["y"] > reference["y"] + reference["h"]:
            vertical_gap = box["y"] - (reference["y"] + reference["h"])
        else:
            vertical_gap = 0

        if (
            horizontal_distance <= horizontal_limit
            and vertical_gap <= max(45, reference["h"] * 0.90)
        ):
            kept.append(box)

    return kept


def build_ordered_cells(binary, cells, labels, grid_rows, grid_cols):
    ordered = []

    for row in range(grid_rows):
        for col in range(grid_cols):
            label_index = row * grid_cols + col
            if label_index >= len(labels):
                break

            char = labels[label_index]
            if char == "":
                continue
            cell_boxes = filter_cell_components(cells[(row, col)])

            if not cell_boxes:
                roi = np.zeros((16, 16), dtype=np.uint8)
                ordered.append((char, roi, 16, 16, row, col))
                continue

            merged = merge_boxes(cell_boxes)
            margin = 6
            x1 = max(0, merged["x"] - margin)
            y1 = max(0, merged["y"] - margin)
            x2 = min(binary.shape[1], merged["x"] + merged["w"] + margin)
            y2 = min(binary.shape[0], merged["y"] + merged["h"] + margin)

            roi = binary[y1:y2, x1:x2]
            roi = crop_to_content(roi)
            h, w = roi.shape[:2]

            ordered.append((char, roi, w, h, row, col))

    return ordered


def apply_post_threshold_cleanup(binary, skip_open=False):
    if skip_open:
        return binary

    kernel = np.ones((2, 2), np.uint8)
    return cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)


def preprocess_image(image, skip_open=False, mode="adaptive"):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)

    if mode == "otsu":
        _, thresh = cv2.threshold(
            blur,
            0,
            255,
            cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU,
        )
        return apply_post_threshold_cleanup(thresh, skip_open=skip_open)

    thresh = cv2.adaptiveThreshold(
        blur,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        11,
        2,
    )

    return apply_post_threshold_cleanup(thresh, skip_open=skip_open)


def choose_threshold_mode(image, skip_open, grid_rows, grid_cols):
    adaptive = preprocess_image(image, skip_open=skip_open, mode="adaptive")
    otsu = preprocess_image(image, skip_open=skip_open, mode="otsu")

    adaptive_components = len(gather_components(adaptive))
    otsu_components = len(gather_components(otsu))

    min_expected = max(12, int(round(grid_rows * grid_cols * 0.6)))
    if (
        otsu_components >= min_expected
        and adaptive_components > otsu_components * 3
    ):
        return otsu, "otsu"

    return adaptive, "adaptive"


def cluster_indices(indices, max_gap=2):
    if len(indices) == 0:
        return []

    groups = [[int(indices[0])]]

    for idx in indices[1:]:
        idx = int(idx)
        if idx - groups[-1][-1] <= max_gap:
            groups[-1].append(idx)
        else:
            groups.append([idx])

    return [int(round(np.mean(group))) for group in groups]


def cluster_line_centers(centers, required):
    centers = sorted(int(c) for c in centers)

    if len(centers) == required:
        return centers

    if len(centers) >= required:
        return [int(round(c)) for c in cluster_axis(centers, required)]

    return centers


def detect_grid_lines(binary, grid_rows, grid_cols):
    height, width = binary.shape[:2]

    horiz_len = max(10, int(width / grid_cols))
    vert_len = max(10, int(height / grid_rows))

    horiz_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (horiz_len, 1))
    vert_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, vert_len))

    horiz = cv2.morphologyEx(binary, cv2.MORPH_OPEN, horiz_kernel)
    vert = cv2.morphologyEx(binary, cv2.MORPH_OPEN, vert_kernel)

    line_mask = cv2.bitwise_or(horiz, vert)
    _, line_mask = cv2.threshold(line_mask, 1, 255, cv2.THRESH_BINARY)

    row_scores = np.sum(horiz > 0, axis=1)
    col_scores = np.sum(vert > 0, axis=0)

    if row_scores.size == 0 or col_scores.size == 0:
        return None, None, line_mask

    # Real drawn grid lines should span a large chunk of the sheet.
    if np.max(row_scores) < width * 0.45 or np.max(col_scores) < height * 0.45:
        return None, None, line_mask

    row_thresh = max(10, int(0.6 * np.max(row_scores)))
    col_thresh = max(10, int(0.6 * np.max(col_scores)))

    row_indices = np.where(row_scores >= row_thresh)[0]
    col_indices = np.where(col_scores >= col_thresh)[0]

    row_lines = cluster_indices(row_indices)
    col_lines = cluster_indices(col_indices)

    row_lines = cluster_line_centers(row_lines, grid_rows + 1)
    col_lines = cluster_line_centers(col_lines, grid_cols + 1)

    if len(row_lines) != grid_rows + 1 or len(col_lines) != grid_cols + 1:
        return None, None, line_mask

    return sorted(row_lines), sorted(col_lines), line_mask


def remove_line_mask(binary, line_mask):
    if line_mask is None:
        return binary

    inverted = cv2.bitwise_not(line_mask)
    return cv2.bitwise_and(binary, inverted)


def centers_to_bounds(centers, limit, expand_ratio=0.12):
    centers = [int(round(c)) for c in centers]
    centers = sorted(centers)

    bounds = []
    for i, center in enumerate(centers):
        if i == 0:
            start = 0
        else:
            start = int(round((centers[i - 1] + center) / 2.0))

        if i == len(centers) - 1:
            end = limit
        else:
            end = int(round((center + centers[i + 1]) / 2.0))

        span = max(1, end - start)
        grow = int(round(span * expand_ratio))
        start = max(0, start - grow)
        end = min(limit, end + grow)

        bounds.append((start, end))

    return bounds


def compute_grid_bounds(binary, trim_ratio=0.01):
    coords = cv2.findNonZero(binary)

    if coords is None:
        raise RuntimeError("No ink found in image.")

    x, y, w, h = cv2.boundingRect(coords)

    trim_x = int(round(w * trim_ratio))
    trim_y = int(round(h * trim_ratio))

    x1 = min(binary.shape[1] - 1, max(0, x + trim_x))
    y1 = min(binary.shape[0] - 1, max(0, y + trim_y))
    x2 = min(binary.shape[1], max(x1 + 1, x + w - trim_x))
    y2 = min(binary.shape[0], max(y1 + 1, y + h - trim_y))

    return x1, y1, x2, y2


def build_fixed_ordered_cells(
    binary,
    labels,
    grid_rows,
    grid_cols,
    inset_ratio=0.02,
    pad=4,
):
    ordered = []
    x1, y1, x2, y2 = compute_grid_bounds(binary)

    grid_w = x2 - x1
    grid_h = y2 - y1

    cell_w = grid_w / float(grid_cols)
    cell_h = grid_h / float(grid_rows)

    for row in range(grid_rows):
        for col in range(grid_cols):
            label_index = row * grid_cols + col
            if label_index >= len(labels):
                break

            char = labels[label_index]
            if char == "":
                continue

            cell_x1 = int(round(x1 + col * cell_w))
            cell_x2 = int(round(x1 + (col + 1) * cell_w))
            cell_y1 = int(round(y1 + row * cell_h))
            cell_y2 = int(round(y1 + (row + 1) * cell_h))

            inset_x = int(round((cell_x2 - cell_x1) * inset_ratio))
            inset_y = int(round((cell_y2 - cell_y1) * inset_ratio))

            roi_x1 = min(cell_x2 - 1, cell_x1 + inset_x)
            roi_x2 = max(roi_x1 + 1, cell_x2 - inset_x)
            roi_y1 = min(cell_y2 - 1, cell_y1 + inset_y)
            roi_y2 = max(roi_y1 + 1, cell_y2 - inset_y)

            roi = binary[roi_y1:roi_y2, roi_x1:roi_x2]
            roi = crop_to_content(roi, pad=pad)
            h, w = roi.shape[:2]

            ordered.append((char, roi, w, h, row, col))

    return ordered, (x1, y1, x2, y2)


def build_center_bounds_cells(
    binary,
    labels,
    row_centers,
    col_centers,
    inset_ratio=0.0,
    pad=1,
    expand_ratio=0.0,
):
    ordered = []
    height, width = binary.shape[:2]

    row_bounds = centers_to_bounds(row_centers, height, expand_ratio=expand_ratio)
    col_bounds = centers_to_bounds(col_centers, width, expand_ratio=expand_ratio)

    for row in range(len(row_bounds)):
        for col in range(len(col_bounds)):
            label_index = row * len(col_bounds) + col
            if label_index >= len(labels):
                break

            char = labels[label_index]
            if char == "":
                continue

            y1, y2 = row_bounds[row]
            x1, x2 = col_bounds[col]

            inset_x = int(round((x2 - x1) * inset_ratio))
            inset_y = int(round((y2 - y1) * inset_ratio))

            roi_x1 = min(x2 - 1, x1 + inset_x)
            roi_x2 = max(roi_x1 + 1, x2 - inset_x)
            roi_y1 = min(y2 - 1, y1 + inset_y)
            roi_y2 = max(roi_y1 + 1, y2 - inset_y)

            roi = binary[roi_y1:roi_y2, roi_x1:roi_x2]
            roi = crop_to_content(roi, pad=pad)
            h, w = roi.shape[:2]

            ordered.append((char, roi, w, h, row, col))

    return ordered, row_bounds, col_bounds


def build_line_ordered_cells(
    binary,
    labels,
    row_lines,
    col_lines,
    inset_ratio=0.02,
    pad=4,
):
    ordered = []

    for row in range(len(row_lines) - 1):
        for col in range(len(col_lines) - 1):
            label_index = row * (len(col_lines) - 1) + col
            if label_index >= len(labels):
                break

            char = labels[label_index]
            if char == "":
                continue

            cell_x1 = col_lines[col]
            cell_x2 = col_lines[col + 1]
            cell_y1 = row_lines[row]
            cell_y2 = row_lines[row + 1]

            inset_x = int(round((cell_x2 - cell_x1) * inset_ratio))
            inset_y = int(round((cell_y2 - cell_y1) * inset_ratio))

            roi_x1 = min(cell_x2 - 1, cell_x1 + inset_x)
            roi_x2 = max(roi_x1 + 1, cell_x2 - inset_x)
            roi_y1 = min(cell_y2 - 1, cell_y1 + inset_y)
            roi_y2 = max(roi_y1 + 1, cell_y2 - inset_y)

            roi = binary[roi_y1:roi_y2, roi_x1:roi_x2]
            roi = crop_to_content(roi, pad=pad)
            h, w = roi.shape[:2]

            ordered.append((char, roi, w, h, row, col))

    return ordered


def compute_reference_height(heights):
    if not heights:
        return 32.0

    heights = sorted(heights)
    index = int(round((len(heights) - 1) * 0.70))
    index = max(0, min(index, len(heights) - 1))

    return float(heights[index])


def compute_group_reference_heights(ordered_cells):
    grouped_heights = {}

    for char, _, _, h, _, _ in ordered_cells:
        grouped_heights.setdefault(glyph_group(char), []).append(h)

    reference_heights = {
        group: compute_reference_height(heights)
        for group, heights in grouped_heights.items()
    }

    all_heights = [height for heights in grouped_heights.values() for height in heights]
    global_reference = compute_reference_height(all_heights)

    return reference_heights, global_reference


def prepare_cells_for_normalization(ordered_cells, clean_symbols=False):
    prepared = []

    for char, roi, _, _, row, col in ordered_cells:
        group = glyph_group(char)
        prepared_roi = roi

        if clean_symbols and group == "symbol":
            prepared_roi = clean_small_components(prepared_roi, min_area=4, ratio=0.08)
            prepared_roi = crop_to_content(prepared_roi, pad=2)

        h, w = prepared_roi.shape[:2]
        prepared.append((char, prepared_roi, w, h, row, col))

    return prepared


def normalize_to_canvas(
    roi,
    reference_height,
    final_size=64,
    target_height_ratio=0.72,
    baseline_ratio=0.82,
    max_width_ratio=0.90,
    max_height_ratio=0.90,
    center_vertical=False,
):
    h, w = roi.shape[:2]

    canvas = np.zeros((final_size, final_size), dtype=np.uint8)

    target_height = final_size * target_height_ratio
    scale = target_height / max(reference_height, 1.0)

    fit_scale = min(
        scale,
        (final_size * max_width_ratio) / max(w, 1),
        (final_size * max_height_ratio) / max(h, 1),
    )

    new_w = max(1, int(round(w * fit_scale)))
    new_h = max(1, int(round(h * fit_scale)))

    interpolation = cv2.INTER_AREA if fit_scale < 1 else cv2.INTER_CUBIC
    resized = cv2.resize(roi, (new_w, new_h), interpolation=interpolation)

    xoff = max(0, (final_size - new_w) // 2)
    if center_vertical:
        yoff = (final_size - new_h) // 2
    else:
        baseline = int(round(final_size * baseline_ratio))
        yoff = baseline - new_h

    yoff = min(max(0, yoff), final_size - new_h)
    xoff = min(max(0, xoff), final_size - new_w)

    canvas[yoff:yoff + new_h, xoff:xoff + new_w] = resized

    return canvas


def clean_small_components(roi, min_area=4, ratio=0.08):
    if roi.size == 0:
        return roi

    mask = (roi > 0).astype(np.uint8)
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)

    if num_labels <= 1:
        return roi

    components = []

    for label_index in range(1, num_labels):
        area = int(stats[label_index, cv2.CC_STAT_AREA])
        if area < min_area:
            continue

        x = int(stats[label_index, cv2.CC_STAT_LEFT])
        y = int(stats[label_index, cv2.CC_STAT_TOP])
        w = int(stats[label_index, cv2.CC_STAT_WIDTH])
        h = int(stats[label_index, cv2.CC_STAT_HEIGHT])
        box = make_box(x, y, w, h, area)
        box["label"] = label_index
        components.append(box)

    if not components:
        return roi

    largest_area = max(int(box["area"]) for box in components)
    keep_threshold = max(min_area, int(round(largest_area * ratio)))
    primary = [box for box in components if box["area"] >= keep_threshold]

    if not primary:
        primary = [max(components, key=lambda box: box["area"])]

    reference = merge_boxes(primary)
    kept_labels = {box["label"] for box in primary}
    neighbor_threshold = max(min_area, int(round(largest_area * 0.04)))

    for box in components:
        if box["label"] in kept_labels or box["area"] < neighbor_threshold:
            continue

        horizontal_distance = abs(box["cx"] - reference["cx"])
        horizontal_limit = max(14, reference["w"] * 0.80)

        if box["y"] + box["h"] < reference["y"]:
            vertical_gap = reference["y"] - (box["y"] + box["h"])
        elif box["y"] > reference["y"] + reference["h"]:
            vertical_gap = box["y"] - (reference["y"] + reference["h"])
        else:
            vertical_gap = 0

        if (
            horizontal_distance <= horizontal_limit
            and vertical_gap <= max(26, reference["h"] * 1.30)
        ):
            kept_labels.add(box["label"])

    keep_mask = np.zeros_like(mask)
    for label_index in kept_labels:
            keep_mask[labels == label_index] = 1

    if keep_mask.sum() == 0:
        return roi

    cleaned = (keep_mask * 255).astype(np.uint8)
    return cleaned


def save_debug_overlay(image, cells, path, labels, grid_rows, grid_cols):
    overlay = image.copy()

    for row in range(grid_rows):
        for col in range(grid_cols):
            label_index = row * grid_cols + col
            if label_index >= len(labels):
                continue

            char = labels[label_index]
            if char == "":
                continue
            cell_boxes = filter_cell_components(cells[(row, col)])

            if not cell_boxes:
                continue

            merged = merge_boxes(cell_boxes)
            x1 = merged["x"]
            y1 = merged["y"]
            x2 = merged["x"] + merged["w"]
            y2 = merged["y"] + merged["h"]

            cv2.rectangle(overlay, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(
                overlay,
                char,
                (x1, max(20, y1 - 8)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (0, 255, 0),
                1,
                cv2.LINE_AA,
            )

    cv2.imwrite(path, overlay)


def save_fixed_grid_debug(image, grid_bounds, path, labels, grid_rows, grid_cols):
    overlay = image.copy()
    x1, y1, x2, y2 = grid_bounds

    grid_w = x2 - x1
    grid_h = y2 - y1

    cell_w = grid_w / float(grid_cols)
    cell_h = grid_h / float(grid_rows)

    for row in range(grid_rows):
        for col in range(grid_cols):
            label_index = row * grid_cols + col
            if label_index >= len(labels):
                continue

            char = labels[label_index]
            if char == "":
                continue

            cell_x1 = int(round(x1 + col * cell_w))
            cell_x2 = int(round(x1 + (col + 1) * cell_w))
            cell_y1 = int(round(y1 + row * cell_h))
            cell_y2 = int(round(y1 + (row + 1) * cell_h))

            cv2.rectangle(
                overlay,
                (cell_x1, cell_y1),
                (cell_x2, cell_y2),
                (0, 255, 0),
                2,
            )
            cv2.putText(
                overlay,
                char,
                (cell_x1 + 6, max(cell_y1 + 20, 20)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 0),
                1,
                cv2.LINE_AA,
            )

    cv2.imwrite(path, overlay)


def save_line_grid_debug(image, row_lines, col_lines, path, labels):
    overlay = image.copy()
    height, width = overlay.shape[:2]

    for y in row_lines:
        cv2.line(overlay, (0, y), (width - 1, y), (0, 255, 0), 2)

    for x in col_lines:
        cv2.line(overlay, (x, 0), (x, height - 1), (0, 255, 0), 2)

    cols = len(col_lines) - 1

    for row in range(len(row_lines) - 1):
        for col in range(len(col_lines) - 1):
            label_index = row * cols + col
            if label_index >= len(labels):
                continue

            char = labels[label_index]
            if char == "":
                continue

            x = col_lines[col] + 6
            y = row_lines[row] + 20
            cv2.putText(
                overlay,
                char,
                (x, y),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 0),
                1,
                cv2.LINE_AA,
            )

    cv2.imwrite(path, overlay)


def save_bounds_debug(image, row_bounds, col_bounds, path, labels):
    overlay = image.copy()

    for row, (y1, y2) in enumerate(row_bounds):
        for col, (x1, x2) in enumerate(col_bounds):
            label_index = row * len(col_bounds) + col
            if label_index >= len(labels):
                continue

            char = labels[label_index]
            if char == "":
                continue

            cv2.rectangle(
                overlay,
                (x1, y1),
                (x2, y2),
                (0, 255, 0),
                2,
            )
            cv2.putText(
                overlay,
                char,
                (x1 + 6, max(y1 + 20, 20)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 0),
                1,
                cv2.LINE_AA,
            )

    cv2.imwrite(path, overlay)


def normalize_labels(labels, grid_rows, grid_cols):
    total = grid_rows * grid_cols
    if len(labels) >= total:
        return labels[:total]
    return labels + [""] * (total - len(labels))


def load_labels_from_file(path):
    labels = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            symbol = line.strip()
            if symbol:
                labels.append(symbol)
    return labels


def extract(
    image_path=DEFAULT_IMAGE_PATH,
    output_folder=None,
    debug_output_path=None,
    grid_rows=HANDWRITING_GRID_ROWS,
    grid_cols=HANDWRITING_GRID_COLS,
    labels=None,
    grid_mode="auto",
    skip_morph=False,
    use_bounds=False,
    center_symbols=False,
    clean_symbols=False,
    threshold_mode="adaptive",
):
    image_path = str(resolve_project_path(image_path))

    if labels is None:
        labels = HANDWRITING_LABELS

    labels = normalize_labels(labels, grid_rows, grid_cols)

    if output_folder is None:
        output_folder = default_output_folder(image_path)
    else:
        output_folder = str(resolve_project_path(output_folder))

    if debug_output_path is None:
        debug_output_path = default_debug_output_path(output_folder)
    else:
        debug_output_path = str(resolve_project_path(debug_output_path))

    os.makedirs(output_folder, exist_ok=True)
    Path(debug_output_path).parent.mkdir(parents=True, exist_ok=True)

    image = cv2.imread(image_path)

    if image is None:
        raise FileNotFoundError(f"Could not read image: {image_path}")

    if threshold_mode == "auto":
        thresh, chosen_threshold_mode = choose_threshold_mode(
            image,
            skip_open=skip_morph,
            grid_rows=grid_rows,
            grid_cols=grid_cols,
        )
        print("Threshold mode:", chosen_threshold_mode)
    else:
        thresh = preprocess_image(
            image,
            skip_open=skip_morph,
            mode=threshold_mode,
        )

    if grid_mode == "fixed":
        ordered_cells, grid_bounds = build_fixed_ordered_cells(
            thresh, labels, grid_rows, grid_cols
        )
        print("Ordered glyph cells:", len(ordered_cells))
        save_fixed_grid_debug(
            image, grid_bounds, debug_output_path, labels, grid_rows, grid_cols
        )
        print("Saved debug overlay:", debug_output_path)
    elif grid_mode == "lines":
        row_lines, col_lines, line_mask = detect_grid_lines(
            thresh, grid_rows, grid_cols
        )

        if row_lines and col_lines:
            cleaned = remove_line_mask(thresh, line_mask)
            ordered_cells = build_line_ordered_cells(
                cleaned, labels, row_lines, col_lines
            )
            print("Ordered glyph cells:", len(ordered_cells))
            save_line_grid_debug(
                image, row_lines, col_lines, debug_output_path, labels
            )
            print("Saved debug overlay:", debug_output_path)
        else:
            cleaned = thresh
            components = gather_components(cleaned)
            print("Detected components:", len(components))

            row_centers, col_centers = estimate_grid_centers(
                components, grid_rows, grid_cols
            )
            print("Row centers:", [round(center, 1) for center in row_centers])
            print("Col centers:", [round(center, 1) for center in col_centers])

            if use_bounds:
                ordered_cells, row_bounds, col_bounds = build_center_bounds_cells(
                    cleaned, labels, row_centers, col_centers
                )
                save_bounds_debug(
                    image, row_bounds, col_bounds, debug_output_path, labels
                )
            else:
                cells = assign_components_to_cells(
                    components, row_centers, col_centers, grid_rows, grid_cols
                )
                ordered_cells = build_ordered_cells(
                    cleaned, cells, labels, grid_rows, grid_cols
                )
                save_debug_overlay(
                    image, cells, debug_output_path, labels, grid_rows, grid_cols
                )
            print("Ordered glyph cells:", len(ordered_cells))
            print("Saved debug overlay:", debug_output_path)
    else:
        components = gather_components(thresh)
        print("Detected components:", len(components))

        row_centers, col_centers = estimate_grid_centers(
            components, grid_rows, grid_cols
        )
        print("Row centers:", [round(center, 1) for center in row_centers])
        print("Col centers:", [round(center, 1) for center in col_centers])

        cells = assign_components_to_cells(
            components, row_centers, col_centers, grid_rows, grid_cols
        )
        ordered_cells = build_ordered_cells(
            thresh, cells, labels, grid_rows, grid_cols
        )

        print("Ordered glyph cells:", len(ordered_cells))
        save_debug_overlay(image, cells, debug_output_path, labels, grid_rows, grid_cols)
        print("Saved debug overlay:", debug_output_path)

    ordered_cells = prepare_cells_for_normalization(
        ordered_cells,
        clean_symbols=clean_symbols,
    )

    group_reference_heights, global_reference_height = compute_group_reference_heights(
        ordered_cells
    )

    print("Global reference height:", round(global_reference_height, 2))
    for group_name in sorted(group_reference_heights):
        print(
            f"{group_name} reference height:",
            round(group_reference_heights[group_name], 2)
        )

    for index, (char, roi, _, _, row, col) in enumerate(ordered_cells):
        group = glyph_group(char)
        reference_height = group_reference_heights.get(group, global_reference_height)

        baseline_ratio = 0.82
        target_height_ratio = 0.72

        if group == "lower_x":
            target_height_ratio = 0.58
        elif group == "lower_asc":
            target_height_ratio = 0.74
        elif group == "lower_desc":
            target_height_ratio = 0.80
            baseline_ratio = 0.70
        elif group == "upper":
            target_height_ratio = 0.78
        elif group == "digit":
            target_height_ratio = 0.70
        elif group == "symbol":
            target_height_ratio = 0.52

        glyph = normalize_to_canvas(
            roi,
            reference_height=reference_height,
            final_size=64,
            target_height_ratio=target_height_ratio,
            baseline_ratio=baseline_ratio,
            center_vertical=center_symbols and group == "symbol",
        )

        folder = os.path.join(output_folder, folder_name(char))
        os.makedirs(folder, exist_ok=True)

        glyph_path = os.path.join(folder, f"{folder_name(char)}_{index}.png")
        cv2.imwrite(glyph_path, glyph)

        print(f"Saved: {glyph_path} (row {row + 1}, col {col + 1})")

    print("\nExtraction complete!")
    return output_folder


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--image")
    parser.add_argument("--output")
    parser.add_argument("--debug-output")
    parser.add_argument("--grid", type=str, default=None)
    parser.add_argument("--labels-file", type=str, default=None)

    args = parser.parse_args()

    if args.image:
        labels = None
        grid_rows = HANDWRITING_GRID_ROWS
        grid_cols = HANDWRITING_GRID_COLS

        if args.grid:
            parts = args.grid.lower().split("x")
            if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                grid_rows = int(parts[0])
                grid_cols = int(parts[1])
            else:
                raise ValueError("--grid must look like 6x6 or 8x8.")

        if args.labels_file:
            labels = load_labels_from_file(resolve_project_path(args.labels_file))

        extract(
            image_path=args.image,
            output_folder=args.output,
            debug_output_path=args.debug_output,
            grid_rows=grid_rows,
            grid_cols=grid_cols,
            labels=labels,
        )
    else:
        if args.output or args.debug_output:
            raise ValueError(
                "--output and --debug-output require --image. "
                "Without --image, extractor processes every handwriting*.jpg sample automatically."
            )

        for image_path in discover_handwriting_images():
            print(f"\n=== Extracting dataset from {image_path.name} ===")
            extract(image_path=str(image_path))

        coding_images = discover_images(CODING_SYMBOL_DIR, pattern="*.jpg", required=False)
        if coding_images:
            labels = DEFAULT_CODING_SYMBOLS
            labels_file = CODING_SYMBOL_DIR / "labels.txt"
            if labels_file.exists():
                labels = load_labels_from_file(labels_file)

            labels = normalize_labels(labels, CODING_GRID_ROWS, CODING_GRID_COLS)

            for image_path in coding_images:
                print(f"\n=== Extracting coding symbols from {image_path.name} ===")
                output_folder = default_output_folder(
                    image_path, DEFAULT_OUTPUT_ROOT / "coding_symbols"
                )
                extract(
                    image_path=str(image_path),
                    output_folder=str(output_folder),
                    grid_rows=CODING_GRID_ROWS,
                    grid_cols=CODING_GRID_COLS,
                    labels=labels,
                    grid_mode="lines",
                    skip_morph=True,
                    use_bounds=True,
                    center_symbols=True,
                    clean_symbols=True,
                )

import argparse
import os
from pathlib import Path

import cv2
import cv2.aruco
import numpy as np
from concurrent.futures import ThreadPoolExecutor

PROJECT_DIR = Path(__file__).resolve().parent
DEFAULT_IMAGE_DIR = PROJECT_DIR / "handwriting_samples"
DEFAULT_IMAGE_PATH = str(DEFAULT_IMAGE_DIR / "handwriting.jpg")
DEFAULT_OUTPUT_ROOT = PROJECT_DIR / "glyph_sets"
CODING_SYMBOL_DIR = PROJECT_DIR / "coding_symbol_samples"

HANDWRITING_GRID_ROWS = 8
HANDWRITING_GRID_COLS = 8

FONT_GRID_ROWS = 7
FONT_GRID_COLS = 8

CODING_GRID_ROWS = 5
CODING_GRID_COLS = 6
MIN_COMPONENT_AREA = 6
PRIMARY_COMPONENT_AREA = 50

HANDWRITING_LABELS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789,.")
FONT_LABELS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")

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


def remove_line_mask(binary, line_mask):
    if line_mask is None:
        return binary

    inverted = cv2.bitwise_not(line_mask)
    return cv2.bitwise_and(binary, inverted)


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

    # Use a smaller kernel to preserve detail while removing noise
    kernel = np.ones((2, 2), np.uint8)
    opened = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    return opened


def normalize_input_for_extraction(image):
    if image.ndim == 2:
        gray = image.copy()
    else:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Flatten lighting and paper tint using a high-sigma Gaussian blur (stable but slower)
    softened = cv2.GaussianBlur(gray, (5, 5), 0)
    background = cv2.GaussianBlur(softened, (201, 201), 0)
    flattened = cv2.divide(softened, background, scale=255)

    # Keep this gentle so already-clean uploads do not get overprocessed.
    lifted = cv2.addWeighted(
        flattened,
        0.84,
        np.full_like(flattened, 255),
        0.16,
        -10,
    )
    return cv2.GaussianBlur(lifted, (3, 3), 0)


def preprocess_image(image, skip_open=False, mode="adaptive"):
    gray = normalize_input_for_extraction(image)
    # Reduced blur from (5,5) to (3,3) for higher precision extraction
    blur = cv2.GaussianBlur(gray, (3, 3), 0)

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
        21, # Increased block size for high-res
        4,  # Adjusted constant for high-res
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


def prepare_cells_for_normalization(ordered_cells, clean_symbols=True):
    def process_item(item):
        char, roi, _, _, row, col = item
        group = glyph_group(char)
        
        # 1. Edge-shaving: Catch slivers right at the cell boundary.
        h_roi, w_roi = roi.shape[:2]
        if h_roi > 6 and w_roi > 6:
            roi = roi[2:-2, 2:-2]
            
        # 2. Component cleaning: Remove disconnected noise.
        cleaning_ratio = 0.08 if group in ("upper", "lower_asc", "lower_desc", "lower_x") else 0.04
        prepared_roi = clean_small_components(roi, min_area=3, ratio=cleaning_ratio)
        prepared_roi = crop_to_content(prepared_roi, pad=2)

        h, w = prepared_roi.shape[:2]
        return (char, prepared_roi, w, h, row, col)

    prepared = [process_item(item) for item in ordered_cells]

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

    interpolation = cv2.INTER_LANCZOS4 if fit_scale < 1 else cv2.INTER_CUBIC
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


PERSPECTIVE_OUTPUT_SIZE = 2400




def find_grid_aruco(image, marker_ids=(0, 1, 2, 3), dictionary_id=cv2.aruco.DICT_4X4_50):
    """
    Find the grid border using 4 ArUco markers at the corners.
    Accumulates successfully detected markers across multiple image processing passes.
    """
    if image.ndim == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    # Revert to full-resolution detection for maximum reliability
    work_img = gray

    aruco_dict = cv2.aruco.getPredefinedDictionary(dictionary_id)
    parameters = cv2.aruco.DetectorParameters()
    parameters.adaptiveThreshWinSizeStep = 4 
    parameters.adaptiveThreshWinSizeMin = 3
    parameters.adaptiveThreshWinSizeMax = 25
    parameters.minMarkerPerimeterRate = 0.01 
    parameters.errorCorrectionRate = 0.8 # More forgiving
    
    detector = cv2.aruco.ArucoDetector(aruco_dict, parameters)

    found_markers = {} # marker_id -> corners (4, 2)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    
    def try_detect(img, pass_name):
        corners, ids, rejected = detector.detectMarkers(img)
        if ids is not None:
            ids = ids.flatten()
            for i, mid in enumerate(ids):
                if mid in marker_ids and mid not in found_markers:
                    # Refine corner on the ORIGINAL image
                    found_markers[mid] = corners[i].reshape((4, 2))
                    print(f"Pass '{pass_name}': Found Marker {mid}")
        return rejected

    # Optimized set of fast passes
    passes = [
        ("Standard", work_img),
        ("CLAHE", clahe.apply(work_img)),
        ("Contrast-Stretch", cv2.normalize(work_img, None, 0, 255, cv2.NORM_MINMAX)),
        ("Denoise", cv2.medianBlur(work_img, 3)),
        ("Blur", cv2.GaussianBlur(work_img, (3, 3), 0)),
        ("Sharpen", cv2.filter2D(work_img, -1, np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]]))),
        ("Adaptive-Thresh", cv2.adaptiveThreshold(work_img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 10)),
    ]

    last_rejected = None
    for name, img in passes:
        rej = try_detect(img, name)
        if rej is not None:
            last_rejected = rej
        if len(found_markers) >= 4:
            break

    # 3. Handle results and advanced fallbacks
    if len(found_markers) < 3:
        print("Standard passes failed. Trying advanced parameter sweep and morphology...")
        
        # Pass 6: Aggressive Contrast + Dilation (helps with faint markers)
        stretched = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
        dilated = cv2.dilate(stretched, np.ones((3, 3), np.uint8))
        try_detect(dilated, "Aggressive Dilation")
        
        # Pass 7: Parameter Sweep
        if len(found_markers) < 3:
            for win_size_min in [3, 11, 21]:
                if len(found_markers) >= 4: break
                parameters.adaptiveThreshWinSizeMin = win_size_min
                detector = cv2.aruco.ArucoDetector(aruco_dict, parameters)
                try_detect(gray, f"Sweep-WinMin-{win_size_min}")

    # 4. Handle results and geometric fallbacks
    found_ids = sorted(list(found_markers.keys()))
    
    if len(found_markers) < 3:
        # Save debug image
        debug_path = "aruco_discovery_critical_fail.png"
        debug_img = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        if found_markers:
            for mid, m_corners in found_markers.items():
                cv2.aruco.drawDetectedMarkers(debug_img, [m_corners.reshape(1, 4, 2)], np.array([mid]))
        if last_rejected is not None:
            cv2.aruco.drawDetectedMarkers(debug_img, last_rejected, borderColor=(0, 0, 255))
        cv2.imwrite(debug_path, debug_img)
        
        raise RuntimeError(
            f"Failed to find sufficient ArUco markers. Found: {found_ids}. Required: {list(marker_ids)}. "
            f"Check lighting and ensures markers are not cut off. Debug: {debug_path}"
        )

    # Mapping of which marker index corresponds to which grid corner
    # index 0: TL corner of marker, 1: TR corner of marker, 2: BR corner of marker, 3: BL corner of marker
    corner_map = {
        marker_ids[0]: 0, # TL marker uses its TL corner
        marker_ids[1]: 1, # TR marker uses its TR corner
        marker_ids[2]: 2, # BR marker uses its BR corner
        marker_ids[3]: 3, # BL marker uses its BL corner
    }

    if len(found_markers) == 3:
        # GEOMETRIC ESTIMATION OF 4TH MARKER
        missing_id = [m for m in marker_ids if m not in found_markers][0]
        print(f"ATTENTION: Marker {missing_id} missing. Estimating position from geometry...")
        
        # We need the "representative" corner point from each of the 3 found markers
        # to estimate the 4th corner point.
        pts = {}
        for mid, m_corners in found_markers.items():
             pts[mid] = m_corners[corner_map[mid]]
             
        # Parallelogram law: Vector(A,B) = Vector(D,C) => C = B + D - A
        # Based on marker_ids=(0,1,2,3) -> (TL, TR, BR, BL)
        if missing_id == marker_ids[0]: # TL missing
            estimated_pt = pts[marker_ids[1]] + pts[marker_ids[3]] - pts[marker_ids[2]]
        elif missing_id == marker_ids[1]: # TR missing
            estimated_pt = pts[marker_ids[0]] + pts[marker_ids[2]] - pts[marker_ids[3]]
        elif missing_id == marker_ids[2]: # BR missing
            estimated_pt = pts[marker_ids[1]] + pts[marker_ids[3]] - pts[marker_ids[0]]
        else: # BL missing
            estimated_pt = pts[marker_ids[0]] + pts[marker_ids[2]] - pts[marker_ids[1]]
            
        return np.array([
            pts.get(marker_ids[0], estimated_pt if missing_id == marker_ids[0] else None),
            pts.get(marker_ids[1], estimated_pt if missing_id == marker_ids[1] else None),
            pts.get(marker_ids[2], estimated_pt if missing_id == marker_ids[2] else None),
            pts.get(marker_ids[3], estimated_pt if missing_id == marker_ids[3] else None),
        ], dtype=np.float32)

    # Typical case: All 4 found
    print("SUCCESS: All 4 ArUco markers detected.")
    return np.array([
        found_markers[marker_ids[0]][0],
        found_markers[marker_ids[1]][1],
        found_markers[marker_ids[2]][2],
        found_markers[marker_ids[3]][3],
    ], dtype=np.float32)








def order_corners(pts):
    """Order 4 corner points as: top-left, top-right, bottom-right, bottom-left."""

    pts = pts.astype(np.float32)

    s = pts.sum(axis=1)
    tl = pts[np.argmin(s)]
    br = pts[np.argmax(s)]

    d = np.diff(pts, axis=1).ravel()
    tr = pts[np.argmin(d)]
    bl = pts[np.argmax(d)]

    return np.array([tl, tr, br, bl], dtype=np.float32)


def scrub_grid_lines_perspective(binary, grid_rows, grid_cols, thickness=10):
    """
    Remove grid lines from a rectified binary image by identifying them morphologically 
    and masking them out at predicted geometric intervals.
    """
    height, width = binary.shape[:2]
    
    # 1. Use morphology to find horizontal and vertical line candidates.
    horiz_len = max(10, int(width / grid_cols * 0.8))
    vert_len = max(10, int(height / grid_rows * 0.8))
    
    horiz_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (horiz_len, 1))
    vert_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, vert_len))
    
    horiz = cv2.morphologyEx(binary, cv2.MORPH_OPEN, horiz_kernel)
    vert = cv2.morphologyEx(binary, cv2.MORPH_OPEN, vert_kernel)
    
    # Dilate detected lines slightly to catch anti-aliasing artifacts.
    detected_mask = cv2.bitwise_or(horiz, vert)
    detected_mask = cv2.dilate(detected_mask, np.ones((3, 3), np.uint8))
    
    # 2. Add geometric "guess" masks for the grid boundaries.
    guess_mask = np.zeros_like(binary)
    cell_w = width / float(grid_cols)
    cell_h = height / float(grid_rows)
    
    for i in range(grid_rows + 1):
        y = int(round(i * cell_h))
        cv2.line(guess_mask, (0, y), (width - 1, y), 255, thickness)
    for i in range(grid_cols + 1):
        x = int(round(i * cell_w))
        cv2.line(guess_mask, (x, 0), (x, height - 1), 255, thickness)
        
    final_mask = cv2.bitwise_or(detected_mask, guess_mask)
    # Mandatorily erase outer edges.
    cv2.rectangle(final_mask, (0, 0), (width - 1, height - 1), 255, 6)

    return remove_line_mask(binary, final_mask)


def perspective_correct(image, corners, output_size=PERSPECTIVE_OUTPUT_SIZE):

    """Warp the image so the detected grid becomes a perfect square."""

    ordered = order_corners(corners)

    dst = np.array(
        [
            [0, 0],
            [output_size - 1, 0],
            [output_size - 1, output_size - 1],
            [0, output_size - 1],
        ],
        dtype=np.float32,
    )

    matrix = cv2.getPerspectiveTransform(ordered, dst)
    warped = cv2.warpPerspective(image, matrix, (output_size, output_size))

    return warped, matrix


def extract_cells_uniform(
    binary,
    labels,
    grid_rows,
    grid_cols,
    inset_ratio=0.08,
    pad=4,
):
    """Divide the rectified binary image into uniform grid cells and extract content."""
    height, width = binary.shape[:2]
    cell_w = width / float(grid_cols)
    cell_h = height / float(grid_rows)

    def process_cell(label_index):
        row = label_index // grid_cols
        col = label_index % grid_cols
        
        if label_index >= len(labels):
            return None

        char = labels[label_index]
        if char == "":
            return None

        x1 = int(round(col * cell_w))
        x2 = int(round((col + 1) * cell_w))
        y1 = int(round(row * cell_h))
        y2 = int(round((row + 1) * cell_h))

        inset_x = int(round((x2 - x1) * inset_ratio))
        inset_y = int(round((y2 - y1) * inset_ratio))

        roi_x1 = min(x2 - 1, x1 + inset_x)
        roi_x2 = max(roi_x1 + 1, x2 - inset_x)
        roi_y1 = min(y2 - 1, y1 + inset_y)
        roi_y2 = max(roi_y1 + 1, y2 - inset_y)

        roi = binary[roi_y1:roi_y2, roi_x1:roi_x2]
        roi = crop_to_content(roi, pad=pad)
        h, w = roi.shape[:2]

        if h < 2 or w < 2:
            return (char, np.zeros((16, 16), dtype=np.uint8), 16, 16, row, col)
        
        return (char, roi, w, h, row, col)

    results = []
    total_cells = grid_rows * grid_cols
    for i in range(total_cells):
        res = process_cell(i)
        if res is not None:
            results.append(res)

    return results


def save_perspective_debug(
    original,
    corners,
    rectified,
    path,
    labels,
    grid_rows,
    grid_cols,
):
    """Save a debug overlay showing the detected grid contour and rectified cell grid."""

    overlay = original.copy()

    pts = order_corners(corners).astype(np.int32).reshape((-1, 1, 2))
    cv2.polylines(overlay, [pts], True, (0, 255, 0), 3)

    corner_labels = ["TL", "TR", "BR", "BL"]
    ordered = order_corners(corners).astype(np.int32)
    for i, label in enumerate(corner_labels):
        cv2.circle(overlay, tuple(ordered[i]), 8, (0, 0, 255), -1)
        cv2.putText(
            overlay,
            label,
            (ordered[i][0] + 12, ordered[i][1] - 8),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 0, 255),
            2,
            cv2.LINE_AA,
        )

    rect_overlay = rectified.copy()
    if rect_overlay.ndim == 2:
        rect_overlay = cv2.cvtColor(rect_overlay, cv2.COLOR_GRAY2BGR)

    height, width = rectified.shape[:2]
    cell_w = width / float(grid_cols)
    cell_h = height / float(grid_rows)

    for row in range(grid_rows + 1):
        y = int(round(row * cell_h))
        cv2.line(rect_overlay, (0, y), (width - 1, y), (0, 255, 0), 1)
    for col in range(grid_cols + 1):
        x = int(round(col * cell_w))
        cv2.line(rect_overlay, (x, 0), (x, height - 1), (0, 255, 0), 1)

    for row in range(grid_rows):
        for col in range(grid_cols):
            label_index = row * grid_cols + col
            if label_index >= len(labels):
                continue
            char = labels[label_index]
            if char == "":
                continue
            x = int(round(col * cell_w)) + 4
            y = int(round(row * cell_h)) + 18
            cv2.putText(
                rect_overlay,
                char,
                (x, y),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                (0, 255, 0),
                1,
                cv2.LINE_AA,
            )

    target_h = overlay.shape[0]
    scale = target_h / max(rect_overlay.shape[0], 1)
    new_w = max(1, int(round(rect_overlay.shape[1] * scale)))
    rect_resized = cv2.resize(rect_overlay, (new_w, target_h))

    combined = np.hstack([overlay, rect_resized])
    cv2.imwrite(path, combined)


def extract(
    image_path,
    output_folder=None,
    debug_output_path=None,
    grid_rows=HANDWRITING_GRID_ROWS,
    grid_cols=HANDWRITING_GRID_COLS,
    labels=None,
    skip_morph=False,
    clean_symbols=False,
    threshold_mode="adaptive",
):
    """
    Main entry point for extracting handwritten characters from a sheet.
    Strictly requires ArUco markers (0, 1, 2, 3) at the corners for grid detection.
    """
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

    print("Detecting ArUco markers (0, 1, 2, 3)...")
    corners = find_grid_aruco(image)
    print("ArUco markers found — 4 corners detected.")

    rectified_color, transform_matrix = perspective_correct(
        image, corners, output_size=PERSPECTIVE_OUTPUT_SIZE
    )
    print(f"Perspective corrected to {PERSPECTIVE_OUTPUT_SIZE}x{PERSPECTIVE_OUTPUT_SIZE}.")

    # ArUco mode uses a bordered grid (Content + 1-cell border all around)
    augmented_rows = grid_rows + 2
    augmented_cols = grid_cols + 2

    # Use adaptive threshold selection for the rectified image.
    rectified_binary, threshold_type = choose_threshold_mode(
        rectified_color,
        skip_open=skip_morph,
        grid_rows=augmented_rows,
        grid_cols=augmented_cols,
    )
    print(f"Rectified threshold mode: {threshold_type}")

    # Remove the grid lines from the rectified binary image.
    rectified_binary = scrub_grid_lines_perspective(
        rectified_binary, augmented_rows, augmented_cols
    )

    # Build augmented labels list for the full augmented grid (Markers in corners, content in center)
    augmented_labels = [""] * (augmented_rows * augmented_cols)
    for r in range(grid_rows):
        for c in range(grid_cols):
            label_idx = r * grid_cols + c
            if label_idx < len(labels):
                aug_idx = (r + 1) * augmented_cols + (c + 1)
                augmented_labels[aug_idx] = labels[label_idx]

    ordered_cells = extract_cells_uniform(
        rectified_binary, augmented_labels, augmented_rows, augmented_cols
    )
    
    # Filter out the empty border cells from the final result
    ordered_cells = [cell for cell in ordered_cells if cell[0] != ""]
    print("Ordered glyph cells (extracted from inner grid):", len(ordered_cells))

    save_perspective_debug(
        image, corners, rectified_color, debug_output_path,
        augmented_labels, augmented_rows, augmented_cols
    )
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
            target_height_ratio = 0.70
            baseline_ratio = 0.76
        elif group == "upper":
            target_height_ratio = 1.0
        elif group == "digit":
            target_height_ratio = 0.70
        elif group == "symbol":
            target_height_ratio = 1.0

        glyph = normalize_to_canvas(
            roi,
            reference_height=reference_height,
            final_size=64,
            target_height_ratio=target_height_ratio,
            baseline_ratio=baseline_ratio,
            center_vertical=(group == "symbol"),
        )

        folder = os.path.join(output_folder, folder_name(char))
        os.makedirs(folder, exist_ok=True)

        glyph_path = os.path.join(folder, f"{folder_name(char)}_{index}.png")
        cv2.imwrite(glyph_path, glyph)

        print(f"Saved: {glyph_path} (row {row + 1}, col {col + 1})")

    print("\nExtraction complete!")
    return output_folder


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Handwritten Glyph Extractor (ArUco Version)")
    parser.add_argument("--image", help="Path to the image to extract from.")
    parser.add_argument("--output", help="Optional output folder.")
    parser.add_argument("--debug-output", help="Optional debug image path.")
    parser.add_argument("--grid", type=str, default=None, help="Grid size, e.g. 8x8 or 5x6.")
    parser.add_argument("--labels-file", type=str, default=None, help="Path to a text file containing cell labels.")

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
                # Default to coding symbols if 5x6 grid is specified
                if grid_rows == 5 and grid_cols == 6 and labels is None:
                    labels = DEFAULT_CODING_SYMBOLS
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
                "Without --image, extractor processes default samples automatically."
            )

        # Process standard handwriting samples
        for image_path in discover_handwriting_images():
            print(f"\n=== Extracting dataset from {image_path.name} ===")
            extract(image_path=str(image_path))

        # Process coding symbol samples
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
                    skip_morph=True,
                    clean_symbols=True,
                )

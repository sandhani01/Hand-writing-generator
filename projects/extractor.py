import argparse
import os
from pathlib import Path

import cv2
import numpy as np

PROJECT_DIR = Path(__file__).resolve().parent
DEFAULT_IMAGE_DIR = PROJECT_DIR / "handwriting_samples"
DEFAULT_IMAGE_PATH = str(DEFAULT_IMAGE_DIR / "handwriting.jpg")
DEFAULT_OUTPUT_ROOT = PROJECT_DIR / "glyph_sets"

GRID_ROWS = 8
GRID_COLS = 8
MIN_COMPONENT_AREA = 6
PRIMARY_COMPONENT_AREA = 50

LABELS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789,.")

ASCENDERS = set("bdfhklt")
DESCENDERS = set("gjpqy")
X_HEIGHT_LOWER = set("acemnorsuvwxz")


def default_output_folder(image_path):
    stem = Path(image_path).stem
    return str(DEFAULT_OUTPUT_ROOT / stem)


def default_debug_output_path(output_folder):
    return str(Path(output_folder) / "detected_grid_debug.png")


def discover_handwriting_images(image_dir=DEFAULT_IMAGE_DIR):
    directory = Path(image_dir)

    if not directory.exists():
        raise FileNotFoundError(f"Handwriting samples folder not found: {directory}")

    images = sorted(directory.glob("handwriting*.jpg"))

    if not images:
        raise FileNotFoundError(
            f"No handwriting sample images found in: {directory}"
        )

    return images


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
    if letter == ",":
        return "comma"
    if letter == ".":
        return "dot"
    return letter


def glyph_group(letter):
    if letter.isupper():
        return "upper"
    if letter.isdigit():
        return "digit"
    if letter in ",.":
        return "symbol"
    if letter in ASCENDERS:
        return "lower_asc"
    if letter in DESCENDERS:
        return "lower_desc"
    if letter in X_HEIGHT_LOWER:
        return "lower_x"
    return "lower_other"


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


def crop_to_content(roi, pad=2):
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


def estimate_grid_centers(components):
    primary = [box for box in components if box["area"] > PRIMARY_COMPONENT_AREA]

    if len(primary) < GRID_ROWS * GRID_COLS:
        raise RuntimeError(
            "Not enough primary components to estimate the 8x8 layout."
        )

    col_centers = cluster_axis([box["cx"] for box in primary], GRID_COLS)
    row_centers = cluster_axis([box["cy"] for box in primary], GRID_ROWS)

    return row_centers, col_centers


def assign_components_to_cells(components, row_centers, col_centers):
    cells = {(row, col): [] for row in range(GRID_ROWS) for col in range(GRID_COLS)}

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
        return [max(cell_boxes, key=lambda box: box["area"])]

    reference = merge_boxes(primary_boxes)
    kept = list(primary_boxes)

    for box in cell_boxes:
        if box in primary_boxes:
            continue

        horizontal_distance = abs(box["cx"] - reference["cx"])

        if box["y"] + box["h"] < reference["y"]:
            vertical_gap = reference["y"] - (box["y"] + box["h"])
        elif box["y"] > reference["y"] + reference["h"]:
            vertical_gap = box["y"] - (reference["y"] + reference["h"])
        else:
            vertical_gap = 0

        if (
            horizontal_distance <= max(14, reference["w"] * 0.45)
            and vertical_gap <= max(30, reference["h"] * 0.55)
        ):
            kept.append(box)

    return kept


def build_ordered_cells(binary, cells):
    ordered = []

    for row in range(GRID_ROWS):
        for col in range(GRID_COLS):
            label_index = row * GRID_COLS + col
            if label_index >= len(LABELS):
                break

            char = LABELS[label_index]
            cell_boxes = filter_cell_components(cells[(row, col)])

            if not cell_boxes:
                roi = np.zeros((16, 16), dtype=np.uint8)
                ordered.append((char, roi, 16, 16, row, col))
                continue

            merged = merge_boxes(cell_boxes)
            x1 = max(0, merged["x"] - 4)
            y1 = max(0, merged["y"] - 4)
            x2 = min(binary.shape[1], merged["x"] + merged["w"] + 4)
            y2 = min(binary.shape[0], merged["y"] + merged["h"] + 4)

            roi = binary[y1:y2, x1:x2]
            roi = crop_to_content(roi)
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


def normalize_to_canvas(
    roi,
    reference_height,
    final_size=64,
    target_height_ratio=0.72,
    baseline_ratio=0.82,
    max_width_ratio=0.90,
    max_height_ratio=0.90,
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
    baseline = int(round(final_size * baseline_ratio))
    yoff = baseline - new_h

    yoff = min(max(0, yoff), final_size - new_h)
    xoff = min(max(0, xoff), final_size - new_w)

    canvas[yoff:yoff + new_h, xoff:xoff + new_w] = resized

    return canvas


def save_debug_overlay(image, cells, path):
    overlay = image.copy()

    for row in range(GRID_ROWS):
        for col in range(GRID_COLS):
            label_index = row * GRID_COLS + col
            if label_index >= len(LABELS):
                continue

            char = LABELS[label_index]
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


def extract(image_path=DEFAULT_IMAGE_PATH, output_folder=None, debug_output_path=None):
    image_path = str(resolve_project_path(image_path))

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

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)

    thresh = cv2.adaptiveThreshold(
        blur,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        11,
        2,
    )

    kernel = np.ones((2, 2), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)

    components = gather_components(thresh)
    print("Detected components:", len(components))

    row_centers, col_centers = estimate_grid_centers(components)
    print("Row centers:", [round(center, 1) for center in row_centers])
    print("Col centers:", [round(center, 1) for center in col_centers])

    cells = assign_components_to_cells(components, row_centers, col_centers)
    ordered_cells = build_ordered_cells(thresh, cells)

    print("Ordered glyph cells:", len(ordered_cells))
    save_debug_overlay(image, cells, debug_output_path)
    print("Saved debug overlay:", debug_output_path)

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

    args = parser.parse_args()

    if args.image:
        extract(
            image_path=args.image,
            output_folder=args.output,
            debug_output_path=args.debug_output,
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

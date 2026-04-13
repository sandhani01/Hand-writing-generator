import json
import os
import re
import sys
import uuid
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

PROJECT_DIR = Path(__file__).resolve().parent
ROOT_DIR = PROJECT_DIR.parent

sys.path.insert(0, str(PROJECT_DIR))

import renderer  # noqa: E402

try:
    import extractor  # type: ignore  # noqa: E402
except ImportError:
    extractor = None


DEFAULT_PORT = 8001
SESSIONS = {}


def json_response(handler, status, payload):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(body)


def bytes_response(handler, status, data, content_type):
    handler.send_response(status)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Length", str(len(data)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(data)


def to_int(value, fallback):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return fallback


def to_float(value, fallback):
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def parse_hex_color(value, fallback):
    if not value or not isinstance(value, str):
        return fallback
    value = value.strip()
    if value.startswith("#"):
        value = value[1:]
    if len(value) != 6:
        return fallback
    try:
        return (
            int(value[0:2], 16),
            int(value[2:4], 16),
            int(value[4:6], 16),
        )
    except ValueError:
        return fallback


def resolve_output_dir():
    output_dir = PROJECT_DIR / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def build_frontend_default_options():
    cfg = renderer.DEFAULT_CFG
    rotation_range = cfg.get("rotation_range", (-2.0, 2.0))
    rotation = max(abs(float(rotation_range[0])), abs(float(rotation_range[1])))

    return {
        "lineHeight": int(cfg["line_height"]),
        "charSpacing": int(cfg["char_spacing"]),
        "wordSpacing": int(cfg["word_spacing"]),
        "jitter": 0.0,
        "inkColor": "#{:02x}{:02x}{:02x}".format(*cfg["ink_color"]),
        "overallScale": float(cfg["render_scale_multiplier"]),
        "marginLeft": int(cfg["margin_left"]),
        "marginTop": int(cfg["margin_top"]),
        "marginRight": int(cfg["margin_right"]),
        "marginBottom": int(cfg["margin_bottom"]),
        "baselineJitter": float(cfg["baseline_jitter"]),
        "lineDriftPerWord": float(cfg["line_drift_per_word"]),
        "wordSpacingJitter": float(cfg["word_spacing_jitter"]),
        "rotation": rotation,
        "pressureMin": float(cfg["pressure_min"]),
        "pressureMax": float(cfg["pressure_max"]),
        "strokeGain": float(cfg["stroke_gain"]),
        "edgeRoughness": float(cfg["edge_roughness"]),
        "textureBlend": float(cfg["texture_blend"]),
        "upperScale": 1.0,
        "ascenderScale": 1.0,
        "xHeightScale": 1.0,
        "descenderScale": 1.0,
        "descenderShift": 0.0,
        "digitScale": 1.0,
        "symbolScale": 1.0,
        "commaScale": 0.77,
        "commaShift": 0.0,
        "dotScale": 1.0,
        "heightMultiplier": 1.10,
        "widthMultiplier": 1.0,
        "charOverrides": {},
      }


def build_frontend_features():
    return {
        "charOverrides": True,
    }


def is_handwriting_dataset_dir(path):
    if not path.is_dir():
        return False
    child_names = {child.name for child in path.iterdir() if child.is_dir()}
    if not child_names:
        return False
    if any(name.endswith("_upper") or name.endswith("_lower") for name in child_names):
        return True
    return bool(child_names & {"comma", "dot", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"})


def dedupe_paths(paths):
    seen = set()
    ordered = []
    for path in paths:
        if path in seen:
            continue
        seen.add(path)
        ordered.append(path)
    return ordered


def list_datasets():
    glyph_root = PROJECT_DIR / "glyph_sets"
    handwriting_sets = []
    coding_sets = []

    if not glyph_root.exists():
        return handwriting_sets, coding_sets

    for entry in glyph_root.iterdir():
        if not entry.is_dir():
            continue
        if entry.name == "coding_symbols":
            for child in entry.iterdir():
                if child.is_dir():
                    coding_sets.append(str(child))
        elif is_handwriting_dataset_dir(entry):
            handwriting_sets.append(str(entry))

    return handwriting_sets, coding_sets


def ensure_datasets():
    handwriting_sets, coding_sets = list_datasets()
    if handwriting_sets or coding_sets or extractor is None:
        return handwriting_sets, coding_sets

    try:
        for image_path in extractor.discover_handwriting_images():
            extractor.extract(image_path=str(image_path))
    except FileNotFoundError:
        pass

    coding_images = extractor.discover_images(
        extractor.CODING_SYMBOL_DIR, pattern="*.jpg", required=False
    )
    if coding_images:
        labels = extractor.DEFAULT_CODING_SYMBOLS
        labels_file = extractor.CODING_SYMBOL_DIR / "labels.txt"
        if labels_file.exists():
            labels = extractor.load_labels_from_file(labels_file)
        labels = extractor.normalize_labels(
            labels, extractor.CODING_GRID_ROWS, extractor.CODING_GRID_COLS
        )

        for image_path in coding_images:
            output_folder = extractor.default_output_folder(
                image_path, extractor.DEFAULT_OUTPUT_ROOT / "coding_symbols"
            )
            extractor.extract(
                image_path=str(image_path),
                output_folder=str(output_folder),
                grid_rows=extractor.CODING_GRID_ROWS,
                grid_cols=extractor.CODING_GRID_COLS,
                labels=labels,
                grid_mode="lines",
                skip_morph=True,
                use_bounds=True,
                center_symbols=True,
                clean_symbols=True,
                threshold_mode="auto",
            )

    return list_datasets()


def parse_multipart(body, boundary):
    fields = {}
    files = {}

    if not boundary:
        return fields, files

    boundary_bytes = b"--" + boundary
    parts = body.split(boundary_bytes)

    for part in parts:
        if not part or part.startswith(b"--"):
            continue
        if part.startswith(b"\r\n"):
            part = part[2:]
        if part.endswith(b"\r\n"):
            part = part[:-2]

        header_blob, sep, content = part.partition(b"\r\n\r\n")
        if not sep:
            continue

        headers = {}
        for line in header_blob.split(b"\r\n"):
            if b":" not in line:
                continue
            name, value = line.split(b":", 1)
            headers[name.decode("utf-8").strip().lower()] = value.decode("utf-8").strip()

        disposition = headers.get("content-disposition", "")
        name_match = re.search(r'name="([^"]+)"', disposition)
        if not name_match:
            continue

        field_name = name_match.group(1)
        filename_match = re.search(r'filename="([^"]*)"', disposition)

        if filename_match:
            files[field_name] = {
                "filename": filename_match.group(1),
                "content": content,
            }
        else:
            fields[field_name] = content.decode("utf-8", errors="ignore")

    return fields, files


def run_extraction(image_path, glyph_type):
    if extractor is None:
        raise RuntimeError("Extractor is not available in this workspace yet.")

    if glyph_type == "coding":
        labels = extractor.DEFAULT_CODING_SYMBOLS
        labels_file = extractor.CODING_SYMBOL_DIR / "labels.txt"
        if labels_file.exists():
            labels = extractor.load_labels_from_file(labels_file)
        labels = extractor.normalize_labels(
            labels, extractor.CODING_GRID_ROWS, extractor.CODING_GRID_COLS
        )
        output_folder = extractor.default_output_folder(
            image_path, extractor.DEFAULT_OUTPUT_ROOT / "coding_symbols"
        )
        extractor.extract(
            image_path=str(image_path),
            output_folder=str(output_folder),
            grid_rows=extractor.CODING_GRID_ROWS,
            grid_cols=extractor.CODING_GRID_COLS,
            labels=labels,
            grid_mode="lines",
            skip_morph=True,
            use_bounds=True,
            center_symbols=True,
            clean_symbols=True,
            threshold_mode="auto",
        )
        return str(output_folder)

    output_folder = extractor.default_output_folder(image_path)
    extractor.extract(image_path=str(image_path), output_folder=str(output_folder))
    return str(output_folder)


def build_render_config(options):
    cfg = renderer.DEFAULT_CFG.copy()
    if not options:
        return cfg

    cfg["line_height"] = to_int(options.get("lineHeight"), cfg["line_height"])
    cfg["char_spacing"] = to_int(options.get("charSpacing"), cfg["char_spacing"])
    cfg["word_spacing"] = to_int(options.get("wordSpacing"), cfg["word_spacing"])
    cfg["margin_left"] = to_int(options.get("marginLeft"), cfg["margin_left"])
    cfg["margin_top"] = to_int(options.get("marginTop"), cfg["margin_top"])
    cfg["margin_right"] = to_int(options.get("marginRight"), cfg["margin_right"])
    cfg["margin_bottom"] = to_int(options.get("marginBottom"), cfg["margin_bottom"])
    cfg["render_scale_multiplier"] = to_float(
        options.get("overallScale"), cfg["render_scale_multiplier"]
    )
    cfg["height_multiplier"] = to_float(
        options.get("heightMultiplier"), cfg.get("height_multiplier", 1.0)
    )
    cfg["width_multiplier"] = to_float(
        options.get("widthMultiplier"), cfg.get("width_multiplier", 1.0)
    )

    jitter = to_float(options.get("jitter"), 0.0)
    cfg["baseline_jitter"] = to_float(
        options.get("baselineJitter"), max(0.0, jitter * 0.25)
    )
    cfg["line_drift_per_word"] = to_float(
        options.get("lineDriftPerWord"), max(0.0, jitter * 0.15)
    )
    cfg["word_spacing_jitter"] = to_float(
        options.get("wordSpacingJitter"), max(0.0, jitter * 0.25)
    )

    rotation = to_float(options.get("rotation"), min(4.0, jitter * 0.4))
    cfg["rotation_range"] = (-rotation, rotation)

    cfg["pressure_min"] = to_float(options.get("pressureMin"), cfg["pressure_min"])
    cfg["pressure_max"] = to_float(options.get("pressureMax"), cfg["pressure_max"])
    if cfg["pressure_max"] < cfg["pressure_min"]:
        cfg["pressure_max"] = cfg["pressure_min"]

    cfg["stroke_gain"] = to_float(options.get("strokeGain"), cfg["stroke_gain"])
    cfg["edge_roughness"] = to_float(
        options.get("edgeRoughness"), cfg["edge_roughness"]
    )
    cfg["texture_blend"] = to_float(
        options.get("textureBlend"), cfg["texture_blend"]
    )
    cfg["ink_color"] = parse_hex_color(options.get("inkColor"), cfg["ink_color"])

    cfg["metric_overrides"] = {
        "upper": {
            "scale_multiplier": to_float(options.get("upperScale"), 1.0),
        },
        "lower_asc": {
            "scale_multiplier": to_float(options.get("ascenderScale"), 1.0),
        },
        "lower_x": {
            "scale_multiplier": to_float(options.get("xHeightScale"), 1.0),
        },
        "lower_desc": {
            "scale_multiplier": to_float(options.get("descenderScale"), 1.0),
            "baseline_shift": to_float(options.get("descenderShift"), 0.0),
        },
        "digit": {
            "scale_multiplier": to_float(options.get("digitScale"), 1.0),
        },
        "symbol": {
            "scale_multiplier": to_float(options.get("symbolScale"), 1.0),
        },
        "comma": {
            "scale_multiplier": to_float(options.get("commaScale"), 1.0),
            "baseline_shift": to_float(options.get("commaShift"), 0.0),
        },
        "dot": {
            "scale_multiplier": to_float(options.get("dotScale"), 1.0),
        },
    }

    cfg["char_overrides"] = {}
    raw_char_overrides = options.get("charOverrides")
    if isinstance(raw_char_overrides, dict):
        for raw_char, override in raw_char_overrides.items():
            if not isinstance(raw_char, str) or len(raw_char) != 1:
                continue
            if not isinstance(override, dict):
                continue

            cfg["char_overrides"][raw_char] = {
                "scale_multiplier": to_float(
                    override.get("scaleMultiplier"), 1.0
                ),
                "width_multiplier": to_float(
                    override.get("widthMultiplier"), 1.0
                ),
                "baseline_shift": to_float(
                    override.get("baselineShift"), 0.0
                ),
                "stroke_gain_multiplier": to_float(
                    override.get("strokeGainMultiplier"), 1.0
                ),
                "char_spacing_before_delta": to_float(
                    override.get("spacingBeforeDelta"), 0.0
                ),
                "char_spacing_delta": to_float(
                    override.get("spacingDelta"), 0.0
                ),
            }

    return cfg


class ApiHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/defaults":
            json_response(
                self,
                200,
                {
                    "options": build_frontend_default_options(),
                    "features": build_frontend_features(),
                },
            )
            return

        if parsed.path == "/api/datasets":
            handwriting_sets, coding_sets = ensure_datasets()
            json_response(
                self,
                200,
                {"handwriting": handwriting_sets, "coding": coding_sets},
            )
            return

        if parsed.path.startswith("/output/"):
            output_path = resolve_output_dir() / parsed.path[len("/output/"):]
            if output_path.exists():
                bytes_response(self, 200, output_path.read_bytes(), "image/png")
                return
            json_response(self, 404, {"error": "Output not found"})
            return

        if parsed.path == "/":
            json_response(self, 200, {"status": "ok"})
            return

        json_response(self, 404, {"error": "Not found"})

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/extract":
            self.handle_extract()
            return

        if parsed.path == "/api/render":
            self.handle_render()
            return

        json_response(self, 404, {"error": "Not found"})

    def handle_extract(self):
        if extractor is None:
            json_response(
                self,
                501,
                {
                    "error": "Upload extraction is not available yet.",
                    "details": "extractor.py is missing from the projects folder.",
                },
            )
            return

        try:
            content_type = self.headers.get("Content-Type", "")
            if "multipart/form-data" not in content_type:
                json_response(self, 400, {"error": "Expected multipart/form-data"})
                return

            boundary = None
            for part in content_type.split(";"):
                part = part.strip()
                if part.startswith("boundary="):
                    boundary = part.split("=", 1)[1].strip().strip('"').encode("utf-8")
                    break

            if not boundary:
                json_response(self, 400, {"error": "Missing multipart boundary"})
                return

            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length)
            fields, files = parse_multipart(body, boundary)

            if "grid" not in files:
                json_response(self, 400, {"error": "No image uploaded"})
                return

            file_item = files["grid"]
            glyph_type = fields.get("type", "alphabet")
            session_id = fields.get("sessionId") or str(uuid.uuid4())
            target_dir = (
                extractor.CODING_SYMBOL_DIR
                if glyph_type == "coding"
                else extractor.DEFAULT_IMAGE_DIR
            )
            target_dir.mkdir(parents=True, exist_ok=True)

            original_name = file_item.get("filename") or "grid.jpg"
            suffix = Path(original_name).suffix or ".jpg"
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{Path(original_name).stem}_{timestamp}{suffix}"
            image_path = target_dir / filename

            with open(image_path, "wb") as file_handle:
                file_handle.write(file_item["content"])

            key = "coding" if glyph_type == "coding" else "handwriting"
            output_folder = run_extraction(image_path, key)

            session = SESSIONS.setdefault(
                session_id, {"handwriting": [], "coding": []}
            )
            if output_folder not in session[key]:
                session[key].append(output_folder)

            json_response(
                self,
                200,
                {"sessionId": session_id, "datasets": session},
            )
        except Exception as exc:
            print("Extraction error:", exc)
            json_response(
                self,
                500,
                {"error": "Extraction failed", "details": str(exc)},
            )

    def handle_render(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)

        try:
            data = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            json_response(self, 400, {"error": "Invalid JSON"})
            return

        text = data.get("text", "")
        if text is None:
            text = ""

        options = data.get("options", {})
        cfg = build_render_config(options)

        session_id = data.get("sessionId")
        existing_handwriting, existing_coding = ensure_datasets()
        if session_id and session_id in SESSIONS:
            handwriting_sets = dedupe_paths(
                SESSIONS[session_id]["handwriting"] + existing_handwriting
            )
            coding_sets = dedupe_paths(
                SESSIONS[session_id]["coding"] + existing_coding
            )
        else:
            handwriting_sets, coding_sets = existing_handwriting, existing_coding

        glyph_roots = handwriting_sets + coding_sets
        if not glyph_roots:
            json_response(
                self,
                400,
                {
                    "error": (
                        "No glyph datasets found. Add glyph sets or put samples in "
                        "handwriting_samples and extract them first."
                    )
                },
            )
            return

        output_dir = resolve_output_dir()
        output_name = f"render_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        output_path = output_dir / output_name

        try:
            renderer.render(
                text=text,
                output_path=str(output_path),
                glyphs_dir=glyph_roots,
                cfg=cfg,
            )
        except Exception as exc:
            print("Render error:", exc)
            json_response(self, 500, {"error": "Render failed", "details": str(exc)})
            return

        if not output_path.exists():
            json_response(self, 500, {"error": "Render failed"})
            return

        bytes_response(self, 200, output_path.read_bytes(), "image/png")


def run():
    port = int(os.environ.get("HANDWRITING_PORT", DEFAULT_PORT))
    server = ThreadingHTTPServer(("0.0.0.0", port), ApiHandler)
    print(f"Python API running at http://localhost:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()

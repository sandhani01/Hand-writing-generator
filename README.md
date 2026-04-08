# Handwritten Notes Generator

Generate realistic handwritten pages from your own handwriting datasets.

This project has two parts:

- `projects/` - Python pipeline (extractor, renderer, API server)
- `frontend/` - React + TypeScript web app (upload, compose, tune, preview, download)

---

## What It Does

1. You upload handwriting grid images (alphabet and optional coding symbols).
2. The extractor converts grids into glyph datasets.
3. The renderer composes text using those glyphs.
4. The web app lets you tune rendering behavior and export PNG pages.

---

## Project Structure

```text
Handwritten Notes Generator/
  frontend/                  # React UI (Vite)
  projects/
    api_server.py            # Python HTTP API
    extractor.py             # Grid -> glyph dataset extraction
    renderer.py              # Glyph dataset -> rendered page
    handwriting_samples/     # Input alphabet grid images
    coding_symbol_samples/   # Input coding symbols grid images
    glyph_sets/              # Extracted datasets
    output/                  # Rendered PNG outputs
    backgrounds/             # Page backgrounds (ruled/plain)
```

---

## Requirements

### Python side

- Python 3.10+ recommended
- Packages:
  - `numpy`
  - `opencv-python`
  - `pillow`

Install:

```powershell
pip install numpy opencv-python pillow
```

### Frontend side

- Node.js 18+ recommended
- npm

---

## Run Locally

Open two terminals.

### Terminal 1: Python API

```powershell
cd "C:\Users\ssand\Downloads\Handwritten Notes Generator\projects"
python api_server.py
```

Default API URL:

`http://localhost:8001`

Optional custom port:

```powershell
$env:HANDWRITING_PORT="8010"
python api_server.py
```

### Terminal 2: Frontend

```powershell
cd "C:\Users\ssand\Downloads\Handwritten Notes Generator\frontend"
npm install
npm run dev
```

Open the Vite URL shown in terminal (usually `http://localhost:5173`).

Optional API base override:

```powershell
$env:VITE_API_BASE="http://localhost:8001"
npm run dev
```

---

## Dataset Workflow

### Alphabet dataset

- Use an 8x8 alphabet grid image.
- Upload from frontend in **Datasets** section, or place images in:
  - `projects/handwriting_samples/`

### Coding symbols dataset

- Use a 6x5 symbols grid image.
- Upload from frontend in **Datasets** section, or place images in:
  - `projects/coding_symbol_samples/`

When extraction runs, datasets are created under:

- `projects/glyph_sets/<handwriting-set>/...`
- `projects/glyph_sets/coding_symbols/<coding-set>/...`

Debug overlays are saved in each output dataset folder as:

- `detected_grid_debug.png`

---

## API Endpoints (Current)

From `projects/api_server.py`:

- `GET /` - health (`{"status":"ok"}`)
- `GET /api/defaults` - frontend default render options + feature flags
- `GET /api/datasets` - available dataset list
- `POST /api/extract` - upload grid image and extract dataset
- `POST /api/render` - render page using current text/options/datasets

---

## Frontend Features

- Assignment mode: Simple / Coding
- Dataset upload and dataset count display
- Compose area with multiline support
- Basic and advanced render controls
- Exact character tuning (per-character override controls)
- Large preview + PNG download
- Light and dark theme support

---

## Common Commands

### Type-check frontend

```powershell
cd "C:\Users\ssand\Downloads\Handwritten Notes Generator\frontend"
npx tsc -b
```

### Lint frontend

```powershell
cd "C:\Users\ssand\Downloads\Handwritten Notes Generator\frontend"
npm run lint
```

### Python syntax check

```powershell
python -m py_compile "C:\Users\ssand\Downloads\Handwritten Notes Generator\projects\renderer.py" "C:\Users\ssand\Downloads\Handwritten Notes Generator\projects\extractor.py" "C:\Users\ssand\Downloads\Handwritten Notes Generator\projects\api_server.py"
```

---

## Troubleshooting

### "Failed to fetch" in frontend

- Confirm API is running:
  - `http://localhost:8001` should return `{"status":"ok"}`
- Restart both backend and frontend after code changes.

### UI changes not reflecting

- Hard refresh browser
- Restart `npm run dev`

### Character override filters appear not to work

- Restart Python API to load latest renderer/backend logic.
- Confirm `GET /api/defaults` returns feature support for char overrides.

### No datasets found

- Upload at least one alphabet grid or add sample images to:
  - `projects/handwriting_samples/`
- Re-run extraction through UI or API.

---

## Notes

- `projects/main.py` is an older script and not the primary runtime path.
- Primary runtime path is `api_server.py` + frontend.

---

## Next Suggested Improvements

- Add proper user auth + cloud storage (multi-user SaaS mode)
- Add persistent render history
- Add dataset quality scoring and bad-glyph detection UI
- Add one-click export profiles (exam style, coding style, neat style)


# Handwritten Notes Generator

Generate realistic handwritten pages from your own handwriting datasets.

This project has two parts:

- `projects/` - Python pipeline (extractor, renderer, API server)
- `frontend/` - React + TypeScript web app (upload, compose, tune, preview, download)

There are now two backend tracks inside `projects/`:

- `api_server.py` - the current local MVP backend used by the existing frontend
- `backend/` - a new production-oriented FastAPI scaffold for hosted multi-user development

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
    backend/                 # Production-ready FastAPI scaffold
    backend_runtime/         # Generated runtime data for backend/ (ignored)
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

For the new hosted backend scaffold, also install:

- `fastapi`
- `uvicorn`
- `python-multipart`
- `pydantic`

Install:

```powershell
pip install numpy opencv-python pillow
```

For the production backend scaffold:

```powershell
pip install -r projects/requirements-production.txt
```

### Frontend side

- Node.js 18+ recommended
- npm

---

## Run Locally

### Local MVP path

This is the older local backend flow. It is still useful for legacy pipeline testing, but the current React frontend is now wired to `projects/backend/`.

Open two terminals.

### Terminal 1: Python API

```powershell
cd projects
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
cd frontend
npm install
npm run dev
```

If you want the current frontend experience, start the hosted backend foundation below instead of `api_server.py`, then open the Vite URL shown in terminal (usually `http://localhost:5173`).

Optional API base override:

```powershell
$env:VITE_API_BASE="http://127.0.0.1:8000"
npm run dev
```

### Hosted backend foundation path

This is now the main multi-user backend path for the hosted app frontend.

```powershell
cd projects
uvicorn backend.main:app --reload
```

API base:

`http://127.0.0.1:8000/api/v1`

Browser entry:

- `http://127.0.0.1:8000/` -> redirects to docs

Auth default:

- local email/password auth is enabled by default
- sign up or sign in from the frontend UI

Hosted auth options:

- `HANDWRITING_AUTH_MODE=jwt` for a generic OIDC/JWT provider
- `HANDWRITING_AUTH_MODE=supabase` for Supabase JWTs
- configure issuer/audience/JWKS or a shared JWT secret in:
  - `projects/backend/.env.example`

Optional dev auth fallback:

- `X-Dev-User-Id: demo-user`
- `X-Dev-User-Email: demo-user@local.dev`

Config template:

- `projects/backend/.env.example`
- production template: `projects/backend/.env.render.supabase.r2.example`
- frontend production template: `frontend/.env.production.example`

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

### Hosted backend runtime layout

When using `projects/backend/`, user data is stored in:

- uploads: `projects/backend_runtime/uploads/<user-id>/...`
- glyph datasets: `projects/backend_runtime/glyph_sets/<user-id>/...`
- renders: `projects/backend_runtime/renders/<user-id>/...`
- metadata DB: `projects/backend_runtime/app.db`

Hosted render retention:

- only the newest `3` renders are kept per user
- older renders are deleted automatically when a new render is created

Hosted backgrounds:

- every user always starts with the default background:
  - `projects/backgrounds/ruled.png`
- every user can keep up to `1` custom uploaded background

Hosted queue mode:

- local default: in-process worker threads
- hosted option: Celery + Redis
- worker command:

```powershell
celery -A backend.celery_app.celery_app worker --loglevel=info
```

---

## API Endpoints (Current)

From `projects/api_server.py`:

- `GET /` - health (`{"status":"ok"}`)
- `GET /api/defaults` - frontend default render options + feature flags
- `GET /api/datasets` - available dataset list
- `POST /api/extract` - upload grid image and extract dataset
- `POST /api/render` - render page using current text/options/datasets

### Hosted backend scaffold endpoints

From `projects/backend/`:

- `GET /` -> redirects to `/docs`
- `GET /api/v1/health`
- `GET /api/v1/defaults`
- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/me`
- `GET /api/v1/datasets`
- `POST /api/v1/datasets/upload`
- `PATCH /api/v1/datasets/{dataset_id}`
- `DELETE /api/v1/datasets/{dataset_id}`
- `GET /api/v1/backgrounds`
- `POST /api/v1/backgrounds/upload`
- `PATCH /api/v1/backgrounds/select`
- `DELETE /api/v1/backgrounds/{background_id}`
- `GET /api/v1/renders`
- `POST /api/v1/renders`
- `GET /api/v1/renders/{render_id}/file`
- `DELETE /api/v1/renders/{render_id}`

---

## Frontend Features

- Assignment mode: Simple / Coding
- Dataset cards with rename/delete/status
- Background cards with default/custom switching
- Compose area with multiline support
- Basic and advanced render controls
- Exact character tuning (per-character override controls)
- Large preview + PNG download
- Render history with preview/download/delete
- Light and dark theme support

---

## Common Commands

### Type-check frontend

```powershell
cd frontend
npx tsc -b
```

### Lint frontend

```powershell
cd frontend
npm run lint
```

### Python syntax check

```powershell
python -m py_compile projects/renderer.py projects/extractor.py projects/api_server.py
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
- The legacy local MVP path is `api_server.py`.
- The current hosted/frontend auth path is `projects/backend/` + frontend.
- `projects/backend/` is the new hosted foundation and currently reuses the existing `extractor.py` and `renderer.py` pipeline under the hood.

---

## Next Suggested Improvements

- Wire a hosted auth provider into `projects/backend/auth.py`
- Move in-process background jobs to an external worker/queue service
- Add dataset selection per render instead of using all completed datasets
- Add dataset quality scoring and bad-glyph detection UI
- Add one-click export profiles (exam style, coding style, neat style)

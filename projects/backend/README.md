# Backend

FastAPI backend for the Handwritten Notes Generator.

## Current architecture

This backend now uses:

- Supabase JWT authentication
- temporary workspace storage on the local filesystem
- no database
- no object storage
- synchronous extraction and rendering

Each authenticated browser session sends an `X-Workspace-Session` header. The backend stores uploads, glyphs, custom backgrounds, and rendered PNGs inside a temporary workspace folder for that user and session.

When the user signs out or resets the workspace, that temporary folder is deleted.

## Runtime layout

By default, files are stored under:

- `projects/backend_runtime/workspaces/<user-id>/<workspace-session-id>/uploads/`
- `projects/backend_runtime/workspaces/<user-id>/<workspace-session-id>/glyph_sets/`
- `projects/backend_runtime/workspaces/<user-id>/<workspace-session-id>/renders/`

The built-in default background still comes from:

- `projects/backgrounds/ruled.png`

## Auth modes

### Supabase

Recommended production mode:

```env
HANDWRITING_AUTH_MODE=supabase
HANDWRITING_SUPABASE_URL=https://<project>.supabase.co
```

The backend verifies the bearer token from the frontend and derives:

- issuer
- audience
- JWKS URL

from the Supabase project URL unless you override them manually.

### Dev

Useful for local testing without Supabase:

```env
HANDWRITING_AUTH_MODE=dev
```

Then send:

- `X-Dev-User-Id`
- `X-Dev-User-Email`

### Local auth

`HANDWRITING_AUTH_MODE=local` is no longer supported in this ephemeral-storage build.

## Required request headers

All authenticated dataset, background, render, and logout requests must send:

- `Authorization: Bearer <supabase-access-token>`
- `X-Workspace-Session: <client-generated-session-id>`

## API routes

- `GET /api/v1/health`
- `GET /api/v1/defaults`
- `GET /api/v1/me`
- `POST /api/v1/auth/logout`
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

## Run locally

From `projects/`:

```powershell
python -m pip install -r requirements-production.txt
uvicorn backend.main:app --reload
```

Docs:

- `http://127.0.0.1:8000/docs`

## Environment template

Use:

- `projects/backend/.env.example`

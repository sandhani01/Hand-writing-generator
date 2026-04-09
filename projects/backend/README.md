# Hosted Backend

This package is the hosted, multi-user backend for the handwriting app.

It wraps the existing `extractor.py` and `renderer.py` pipeline with:

- local email/password auth
- per-user datasets
- dataset quotas
- render history
- background extraction/render jobs
- cloud-ready database and object-storage configuration

## What is implemented

- FastAPI app entrypoint
- local email/password authentication
- token-based login sessions
- user-aware dataset records
- dataset rename + delete
- dataset quotas:
  - `5` alphabet datasets
  - `3` coding datasets
- background quotas:
  - built-in default background
  - `1` custom uploaded background per user
- render history with automatic retention:
  - newest `3` completed renders kept per user
- background job states:
  - `queued`
  - `processing`
  - `completed`
  - `failed`
- local runtime storage for development
- cloud-ready config for:
  - PostgreSQL via `HANDWRITING_DATABASE_URL`
  - S3-compatible object storage via `HANDWRITING_STORAGE_BACKEND=s3`

## Current auth

Default auth mode is `local`.

Use:

- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`

Then send:

- `Authorization: Bearer <access_token>`

Optional local dev fallback:

- set `HANDWRITING_AUTH_MODE=dev`
- then use `X-Dev-User-Id` and `X-Dev-User-Email`

## Background jobs

Uploads and renders no longer block the request until the pipeline finishes.

Current implementation:

- request creates a queued dataset/render record
- in-process worker threads perform extraction/rendering
- frontend polls list endpoints and reacts to status changes

Important:

- this is already a real background-job flow for local hosting
- for larger production scale, the next step would be moving the worker to a separate process/queue service

## Storage and database

### Local development

By default the backend uses:

- SQLite
- local filesystem storage under `projects/backend_runtime/`

### Cloud-ready mode

You can switch to hosted infrastructure by configuration:

- PostgreSQL:
  - set `HANDWRITING_DATABASE_URL`
- S3-compatible object storage:
  - set `HANDWRITING_STORAGE_BACKEND=s3`
  - set bucket and credentials in `.env`

API routes stay the same, so the frontend barely changes.

## Run locally

From `projects/`:

```powershell
pip install -r requirements-production.txt
uvicorn backend.main:app --reload
```

API base:

`http://127.0.0.1:8000/api/v1`

Docs:

`http://127.0.0.1:8000/docs`

## Useful endpoints

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

## Runtime storage layout

When using local storage:

- uploads: `backend_runtime/uploads/<user-id>/...`
- glyph datasets: `backend_runtime/glyph_sets/<user-id>/...`
- renders: `backend_runtime/renders/<user-id>/...`
- default background: `../backgrounds/ruled.png`
- metadata DB: `backend_runtime/app.db`

## Environment template

Use:

- `backend/.env.example`

## What is next after this layer

- swap in real hosted auth provider verification
- move workers to a separate queue service
- add dataset selection per render
- add signed/public asset URLs for CDN-backed delivery

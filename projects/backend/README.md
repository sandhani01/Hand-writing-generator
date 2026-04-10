# Hosted Backend

This package is the hosted, multi-user backend for the handwriting app.

It wraps the existing `extractor.py` and `renderer.py` pipeline with:

- local email/password auth
- hosted provider-ready JWT auth (`jwt` / `supabase` modes)
- per-user datasets
- dataset quotas
- render history
- background extraction/render jobs
- cloud-ready database and object-storage configuration
- queue-ready worker execution

## What is implemented

- FastAPI app entrypoint
- local email/password authentication
- hosted bearer-token verification for `jwt` and `supabase` auth modes
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
- queue-ready config for:
  - Celery + Redis via `HANDWRITING_JOB_BACKEND=celery`

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

### Hosted auth mode

You can switch the backend to provider-backed bearer tokens:

- `HANDWRITING_AUTH_MODE=jwt`
- or `HANDWRITING_AUTH_MODE=supabase`

For generic JWT/OIDC verification, set:

- `HANDWRITING_AUTH_JWT_ISSUER`
- `HANDWRITING_AUTH_JWT_AUDIENCE`
- `HANDWRITING_AUTH_JWT_JWKS_URL`

If your provider uses a symmetric secret instead of JWKS, set:

- `HANDWRITING_AUTH_JWT_SECRET`

For Supabase, you can usually set just:

- `HANDWRITING_AUTH_MODE=supabase`
- `HANDWRITING_SUPABASE_URL=https://<project>.supabase.co`

and the backend will derive:

- issuer: `<supabase-url>/auth/v1`
- jwks url: `<supabase-url>/auth/v1/.well-known/jwks.json`
- audience: `authenticated`

## Background jobs

Uploads and renders no longer block the request until the pipeline finishes.

Current implementation:

- request creates a queued dataset/render record
- in-process worker threads perform extraction/rendering
- frontend polls list endpoints and reacts to status changes

Important:

- this is already a real background-job flow for local hosting
- for hosted scale, switch to:
  - `HANDWRITING_JOB_BACKEND=celery`
  - Redis broker / result backend
  - a separate Celery worker process

Worker command:

```powershell
celery -A backend.celery_app.celery_app worker --loglevel=info
```

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

Recommended hosted shape:

- auth: Supabase or another JWT/OIDC provider
- database: Postgres
- storage: S3 / Cloudflare R2
- jobs: Celery + Redis

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

### Hosted worker mode

```powershell
set HANDWRITING_JOB_BACKEND=celery
set HANDWRITING_REDIS_URL=redis://localhost:6379/0
celery -A backend.celery_app.celery_app worker --loglevel=info
```

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
- `backend/.env.render.supabase.r2.example` for Render + Supabase + R2 deployment

## What is next after this layer

- connect the frontend login flow to your hosted auth provider
- point `HANDWRITING_DATABASE_URL` at managed Postgres
- point `HANDWRITING_STORAGE_BACKEND=s3` at your bucket
- run the worker as a separate Celery service
- add dataset selection per render
- add signed/public asset URLs for CDN-backed delivery

## Deployment quickstart (Render + Supabase + R2)

1. Copy `backend/.env.render.supabase.r2.example` values into Render environment variables for:
   - API service
   - Worker service
2. Use the same env values for both API and worker, except process command:
   - API: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
   - Worker: `celery -A backend.celery_app.celery_app worker --loglevel=info`
3. In Supabase Auth, configure your frontend URL and enable the email login settings you want.
4. Set frontend production env from `frontend/.env.production.example`.
5. Update `HANDWRITING_CORS_ORIGINS` to your real frontend domain.

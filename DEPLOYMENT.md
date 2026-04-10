# Deployment Guide

This repo is now set up so you only need to provide keys/URLs and deploy.

For release execution, also use:

- `LAUNCH_CHECKLIST.md`

## 1. Recommended stack

- Auth + Postgres: Supabase
- Object storage: Cloudflare R2 (S3-compatible)
- Queue broker: Redis
- API + Worker + Frontend host: Render

## 2. Files you need

- Render blueprint: `render.yaml`
- Backend production env template:
  - `projects/backend/.env.render.supabase.r2.example`
- Frontend production env template:
  - `frontend/.env.production.example`

## 3. Required values

Backend:

- `HANDWRITING_SUPABASE_URL`
- `HANDWRITING_DATABASE_URL`
- `HANDWRITING_STORAGE_BUCKET`
- `HANDWRITING_STORAGE_ENDPOINT_URL`
- `HANDWRITING_STORAGE_ACCESS_KEY_ID`
- `HANDWRITING_STORAGE_SECRET_ACCESS_KEY`
- `HANDWRITING_CORS_ORIGINS`

Frontend:

- `VITE_API_BASE`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 4. Render deployment

1. Push repo to GitHub.
2. In Render, create Blueprint deployment from this repo.
3. Render will create:
   - `handwritten-api`
   - `handwritten-worker`
   - `handwritten-redis`
   - `handwritten-frontend`
4. Fill all `sync: false` env values in Render dashboard.
5. Set frontend URL into backend CORS env:
   - `HANDWRITING_CORS_ORIGINS=https://<your-frontend-domain>`
6. Redeploy all services.

## 5. Docker deployment (provider-agnostic)

Use:

- `projects/Dockerfile` for API/worker
- `frontend/Dockerfile` for frontend
- `docker-compose.deploy.yml` for full stack

Required local env files before compose:

- `projects/backend/.env` (use `projects/backend/.env.render.supabase.r2.example` as base)
- shell env (or `.env`) for frontend build args:
  - `VITE_API_BASE`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

Run:

```powershell
docker compose -f docker-compose.deploy.yml up --build -d
```

## 6. Preflight check (before deploy)

Run from `projects/`:

```powershell
python -m backend.deploy_preflight
```

If it prints `Preflight passed.`, the backend config is deploy-ready.

## 7. Post-deploy smoke test

1. Open frontend URL.
2. Sign up / sign in.
3. Upload alphabet dataset.
4. Upload coding dataset.
5. Upload custom background.
6. Render a page.
7. Download PNG.

## 8. Notes

- `render_jobs` retention is enforced (latest 3 per user by default).
- Background quota is enforced (default + 1 custom).
- API and worker must share the exact same env values for DB/storage/auth/redis.

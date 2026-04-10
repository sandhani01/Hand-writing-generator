# Launch Checklist

Use this checklist when you are ready to go live.

## 1) Choose deployment profile

`render.yaml` is currently tuned for a balanced starter launch.

If you want a different cost/performance profile, update the `plan` fields:

- Low-cost:
  - `handwritten-api`: `starter`
  - `handwritten-worker`: `starter`
  - `handwritten-frontend`: `free` (or `starter` if needed)
  - `handwritten-redis`: `free`
- Starter (recommended):
  - `handwritten-api`: `starter`
  - `handwritten-worker`: `starter`
  - `handwritten-frontend`: `starter`
  - `handwritten-redis`: `free`
- Pro:
  - `handwritten-api`: `pro`
  - `handwritten-worker`: `pro`
  - `handwritten-frontend`: `pro`
  - `handwritten-redis`: upgrade to paid Redis plan

## 2) Fill backend env values

Start from:

- `projects/backend/.env.render.supabase.r2.example`

Required keys:

- `HANDWRITING_SUPABASE_URL`
- `HANDWRITING_DATABASE_URL`
- `HANDWRITING_STORAGE_BUCKET`
- `HANDWRITING_STORAGE_ENDPOINT_URL`
- `HANDWRITING_STORAGE_ACCESS_KEY_ID`
- `HANDWRITING_STORAGE_SECRET_ACCESS_KEY`
- `HANDWRITING_CORS_ORIGINS`

## 3) Fill frontend env values

Start from:

- `frontend/.env.production.example`

Required keys:

- `VITE_API_BASE`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 4) Configure Supabase Auth

- Add your frontend domain to allowed redirect/site URLs.
- Decide if email confirmation is required:
  - if ON: users must confirm email before first login
  - if OFF: signup can issue session immediately

## 5) Deploy with Render Blueprint

1. Push this repo to GitHub.
2. In Render, create Blueprint deployment from `render.yaml`.
3. Fill all `sync: false` env vars in Render dashboard.
4. Redeploy API and worker after setting env vars.

## 6) Run backend preflight

From `projects/`:

```powershell
python -m backend.deploy_preflight
```

Deployment should proceed only when preflight passes.

## 7) Set domains

- Backend API domain:
  - use provided Render domain or custom API domain
- Frontend domain:
  - use provided Render domain or custom web domain
- Ensure:
  - `VITE_API_BASE` points to the backend public URL
  - `HANDWRITING_CORS_ORIGINS` includes the frontend public URL

## 8) Smoke test (must pass)

1. Sign up / sign in
2. Upload alphabet dataset
3. Upload coding dataset
4. Upload custom background
5. Render a page
6. Download output
7. Confirm render history keeps only last 3

## 9) Day-1 monitoring checks

- API `/api/v1/health` responds
- worker logs show jobs processing
- no repeated auth token verification failures
- no storage write failures

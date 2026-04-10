# Frontend

React + TypeScript + Vite frontend for the Handwritten Notes Generator.

## What it does

- signs users in
- manages alphabet, coding, and background datasets
- sends render requests to the backend
- previews and downloads the newest saved renders

## Auth modes

The frontend supports two auth modes:

- `local`
  - uses backend endpoints:
    - `POST /api/v1/auth/signup`
    - `POST /api/v1/auth/login`
- `supabase`
  - signs in directly against Supabase Auth
  - sends the returned bearer token to the backend
  - backend verifies that token in `jwt` / `supabase` mode

## Environment

Copy `.env.example` to `.env` and adjust values.

### Local auth

```env
VITE_API_BASE=http://127.0.0.1:8000
VITE_AUTH_PROVIDER=local
```

### Supabase auth

```env
VITE_API_BASE=http://127.0.0.1:8000
VITE_AUTH_PROVIDER=supabase
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

When using Supabase in the frontend, make sure the backend also matches:

- `HANDWRITING_AUTH_MODE=supabase`
- `HANDWRITING_SUPABASE_URL=https://<project>.supabase.co`

## Run

```powershell
npm install
npm run dev
```

## Build

```powershell
npm run build
```

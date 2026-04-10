# Frontend

React + TypeScript + Vite frontend for the Handwritten Notes Generator.

## What it does

- signs users in with Supabase Auth
- generates a temporary workspace session id after login
- uploads alphabet, coding, and background sheets for the current session
- renders pages from the extracted glyphs
- previews and downloads recent PNG outputs

The workspace session id is stored locally in the browser and sent to the backend in:

- `X-Workspace-Session`

When the user signs out or resets the workspace, the frontend asks the backend to delete that temporary session folder.

## Auth modes

- `supabase`
  - recommended mode
  - signs in directly against Supabase Auth
  - sends the returned bearer token to the backend
- `local`
  - kept only for legacy development paths
  - not recommended for the current ephemeral-storage backend

## Environment

Copy `.env.example` to `.env` and adjust values.

```env
VITE_API_BASE=http://127.0.0.1:8000
VITE_AUTH_PROVIDER=supabase
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Backend should match:

```env
HANDWRITING_AUTH_MODE=supabase
HANDWRITING_SUPABASE_URL=https://<project>.supabase.co
```

## Run

```powershell
npm install
npm run dev
```

## Build

```powershell
npm run build
```

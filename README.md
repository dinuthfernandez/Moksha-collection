# Moksha Collections — Website

A custom storefront for Moksha Collections, replacing the previous Zoho Commerce
site. Same exact brand colors and logo, built as a decoupled React frontend +
Python (FastAPI) backend so it can later be wrapped for iOS/Android (e.g. with
Capacitor) without a rewrite.

```
mc website/
├── frontend/   React + TypeScript (Vite) single-page app
├── backend/    FastAPI REST API backed by Supabase (schema: moksha_collection)
└── render.yaml Render Blueprint — deploys frontend + backend as 2 services
```

## Brand
- Onyx `#0E0A14`, Warm White `#FAF7F2`, Magenta `#E10A8C` / hover `#B80873`,
  Crystal Silver `#C8CAD0`, header/footer black `#000000`.
- Fonts: Playfair Display (display) + Inter (body).
- Logo/favicon: `frontend/public/assets/logo/`.

## Local development

### 1. Backend
```
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
copy .env.example .env        # then fill in Supabase credentials
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend
```
cd frontend
npm install
copy .env.example .env
npm run dev
```
Vite dev server runs on http://localhost:5173 and proxies `/api` to the
backend on port 8000.

## Database (Supabase)
All tables live in the **`moksha_collection`** schema — never `public`.

1. In the Supabase dashboard: **Project Settings → API → Exposed schemas**,
   add `moksha_collection` (this can't be done via SQL).
2. Run `backend/sql/001_schema.sql` in the Supabase SQL editor.
3. Run `backend/sql/002_seed_reference_data.sql` — seeds size charts and the
   header announcement bar text only. **Categories and products are left
   empty on purpose** until real content is provided.

## Deploying to Render
`render.yaml` defines two independent services (Blueprint deploy):
- `moksha-collections-api` — Python web service (FastAPI/uvicorn)
- `moksha-collections-web` — static site (Vite build), with SPA rewrite to
  `index.html` so client-side routing works.

After the first deploy, set `VITE_API_BASE_URL` on the frontend service to
`https://<your-api-service>.onrender.com/api`, and `ALLOWED_ORIGINS` on the
backend service to the frontend's URL, then redeploy the frontend.

## Future: iOS / Android
The frontend is a plain React SPA calling a REST API — no server-side
rendering lock-in — so it can be wrapped with [Capacitor](https://capacitorjs.com/)
later (`npm install @capacitor/core @capacitor/cli`, `npx cap init`, `npx cap add ios|android`)
and shipped as native apps against the same backend.

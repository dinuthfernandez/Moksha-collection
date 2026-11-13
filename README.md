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

### Homepage visibility
The admin **Show and Hide** page has separate switches for the homepage's Under 5
BHD, Clearance Sale, and Discounts sections. Changes are saved in Supabase
`app_state`; refresh an already open homepage to see them. All three are visible
until settings are saved. The former Banner admin page is no longer available,
but its stored banner data is not deleted. `/home-test` redirects to the homepage.
For a new database, run `backend/sql/027_app_state.sql` in the Supabase SQL editor.

### Maintenance developer access
Saving or removing the developer bypass password requires a successful Supabase
`app_state` write. A successful change immediately invalidates all existing
bypass cookies; connected pages receive a live refresh notification, with
periodic and tab-visibility checks as fallbacks. Disconnected or suspended
pages update when they reconnect or resume. The previous password is rejected.
Maintenance state is held in the running process, so this behavior assumes the
single backend process configured in `render.yaml`.

### Hourly product image sync
The hourly Zoho sync checks image document IDs for existing and new online products.
Images with the same stored document ID are not downloaded again; new or changed
images are compressed and stored with content-versioned URLs. If an image download
fails, the previous image is retained and the next sync retries it. A full sync
uses the same image check, while the single-product refresh forces a download.
This relies on Zoho changing the image document ID when its image is replaced.

To run the same light sync once from the Render Shell, from the project root:

```sh
python -u backend/light_sync.py
```

Wait for the deployed version to include this script before running it. It reports
progress and errors in the shell, does not alter the hourly schedule, and should
not be run while another sync is in progress.

### Super-admin customer support sessions
The super-admin Customers tab searches customer names, email addresses and phone
numbers. Open an active customer to start a separate 30-minute session without
their password. Configure `IMPERSONATION_PASSWORD_1` and
`IMPERSONATION_PASSWORD_2` as secret environment variables on the backend, then
enter them in order for each session. If either is missing, sessions are disabled.
Five incorrect attempts lock that IP for one hour per backend process; this
in-memory lock does not persist across restarts or coordinate multiple instances.
The session has full customer permissions, including purchases,
and uses its own browser-session cart rather than the customer's local cart.
Session starts and write requests are logged through the super-admin audit logger;
the dashboard's in-memory audit list is temporary, so retain server logs as needed.
Customer support sessions obey maintenance mode, and do not bypass disabled or
banned accounts. Close the support window or use End session when finished.
Ending a session removes the token from that window; a copied token remains valid
until its 30-minute expiry.

## Database (Supabase)
All tables live in the **`moksha_collection`** schema — never `public`.

1. In the Supabase dashboard: **Project Settings → API → Exposed schemas**,
   add `moksha_collection` (this can't be done via SQL).
2. Run `backend/sql/001_schema.sql` in the Supabase SQL editor.
3. Run `backend/sql/002_seed_reference_data.sql` — seeds size charts and the
   header announcement bar text only. **Categories and products are left
   empty on purpose** until real content is provided.
4. Run `backend/sql/003_customers_and_addresses.sql` — creates the customer
   accounts and international delivery-address tables used by the login/
   register system.

## Offline Zoho sales webhook
Run `backend/sql/016_zoho_offline_sale_webhook.sql` in Supabase before enabling
the offline-sale webhook. Set `ZOHO_OFFLINE_SALE_WEBHOOK_SECRET` to the same
long random value in the local backend `.env`, Render environment, and the
automation's `X-Webhook-Secret` header. Generate one with
`python -c "import secrets; print(secrets.token_urlsafe(48))"`; don't put it in
the request body or a public post.

Use `POST http://127.0.0.1:8000/api/webhooks/zoho/offline-sale` locally or
`POST https://moksha-collections.onrender.com/api/webhooks/zoho/offline-sale`
after deployment. This matches the "Notify Website Stock Out" webhook
configured on the Invoice module in Zoho Inventory (Settings → Automation →
Workflow Actions → Webhooks), which sends:

```json
{
  "source": "${Invoices.Source}",
  "invoice_id": "${Invoices.Invoice ID}",
  "invoice_number": "${Invoices.Invoice Number}",
  "line_items": [
    {
      "item_id": "${Invoices.LineItems.Item ID}",
      "name": "${Invoices.LineItems.Item Name}",
      "sku": "${Invoices.LineItems.SKU}",
      "quantity_sold": "${Invoices.LineItems.Quantity}"
    }
  ]
}
```

The endpoint immediately reduces matching Supabase stock. Repeated deliveries
for the same `invoice_id` are ignored, so Zoho retrying the webhook does not
deduct stock twice. Zoho's own sale changes its inventory; the regular
inventory sync later reconciles the website count to Zoho.

Zoho's webhook editor must also send the header `X-Webhook-Secret` with the
same value as `ZOHO_OFFLINE_SALE_WEBHOOK_SECRET`, or every delivery is
rejected with `401`.

## Accounts, login & delivery addresses
- Customers register/log in with email + password (bcrypt-hashed, JWT session
  token, 14-day expiry). See `backend/app/routers/auth.py`.
- Each customer can save multiple delivery addresses with full international
  fields (country, phone country code, state/region, postal code, delivery
  notes) — `backend/app/routers/addresses.py` and the frontend `/addresses` page.
- Set `JWT_SECRET_KEY` to a long random value in production (generate one with
  `python -c "import secrets; print(secrets.token_urlsafe(48))"`) — never reuse
  the local dev value in `.env.example`.

## Deploying to Render
`render.yaml` defines **one** Render web service (`moksha-collections`) that
builds the frontend, then starts FastAPI, which serves the API under `/api`
*and* the built frontend (`frontend/dist`) from the same process/URL — see
the bottom of `backend/app/main.py`. This only activates when
`frontend/dist` exists; local dev (no build present) is unaffected and keeps
using the separate Vite dev server + `--reload` backend as described above.

`VITE_API_BASE_URL` is set to `/api` (same-origin, relative) at build time,
so there's no separate frontend URL to wire up — just set the backend's
secret env vars (Supabase, JWT, Zoho, SMTP, admin password), deploy, and set
`ALLOWED_ORIGINS`/`FRONTEND_BASE_URL` to the service's own Render URL once
you know it.

## Future: iOS / Android
The frontend is a plain React SPA calling a REST API — no server-side
rendering lock-in — so it can be wrapped with [Capacitor](https://capacitorjs.com/)
later (`npm install @capacitor/core @capacitor/cli`, `npx cap init`, `npx cap add ios|android`)
and shipped as native apps against the same backend.

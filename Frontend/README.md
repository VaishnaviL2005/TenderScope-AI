# TenderScope AI - Frontend

Intelligent Tender Analysis. Smarter Product Decisions.

Frontend only (React + TypeScript + Tailwind + Vite) for the existing FastAPI backend.
No AI logic, pricing, matching or mock data lives in the browser; everything shown comes
from the backend.

## Quick start (local backend)

1. Start FastAPI on port 8000 so that http://127.0.0.1:8000/docs opens.
2. `npm install`
3. `cp .env.example .env` (defaults: `VITE_API_BASE_URL=/api/v1`, `DEV_PROXY_TARGET=http://127.0.0.1:8000`)
4. `npm run dev` and open http://localhost:5173

Checks: `npm run typecheck`, `npm run build`, `npm run preview`.

## How the API URL works

All calls go through `src/services/api.ts` (the `api` object). The base URL comes from
`VITE_API_BASE_URL` and may be:

- relative, e.g. `/api/v1`: resolved against the page origin (`http://localhost:5173/api/v1/...`)
- absolute, e.g. `https://api.example.com/api/v1`: used as-is

If it is unset, it defaults to `/api/v1`.

## Local backend connection (Vite proxy)

`vite.config.ts` forwards `/api/v1/*` from the dev server to `DEV_PROXY_TARGET`
(default `http://127.0.0.1:8000`). The browser only talks to `localhost:5173`, so no CORS
configuration is required during development.

**The proxy is for local development only** (`npm run dev` / `npm run preview`). It does
not exist once `dist/` is deployed to a real web server.

If the backend is down, the proxy answers with an HTTP 5xx; the UI then shows a hint
to check that FastAPI is running on the proxy target.

To skip the proxy, set an absolute `VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1`. The
backend CORS list must then allow `http://localhost:5173`.

## Connecting to a deployed backend

`VITE_API_BASE_URL` is embedded at **build time**: set it, then `npm run build`
(for example in `.env.production` or your CI environment).

**Option A - same origin (recommended).** Keep `VITE_API_BASE_URL=/api/v1` and route
`/api/v1` to FastAPI in your web server. Example nginx:

```nginx
server {
  listen 80;
  root /var/www/tenderscope-ai/dist;

  location /api/v1/ {
    proxy_pass http://127.0.0.1:8000;   # keeps the /api/v1 prefix
    proxy_read_timeout 1200s;           # analysis is synchronous and can take minutes
    client_max_body_size 25m;           # matches the 25 MB upload limit
  }

  location / {
    try_files $uri $uri/ /index.html;   # SPA routes
  }
}
```

Hosting platforms with rewrites or proxies (Netlify, Vercel, Cloudflare and others) need an
equivalent rule that sends `/api/v1/*` to the backend. Their proxy timeouts may be shorter than
the analysis time; if so, use option B.

**Option B - separate backend origin.** Build with
`VITE_API_BASE_URL=https://api.your-domain.com/api/v1` and add the frontend origin
(e.g. `https://tenders.your-domain.com`) to the backend CORS list.

In both cases any reverse proxy or load balancer in front of FastAPI needs a read timeout
longer than your slowest analysis.

## Security

- Every `VITE_*` value is public: it is visible in the built JavaScript.
- Never put database URLs, LLM keys, storage credentials or other secrets in frontend env
  files. They belong only in the backend environment.
- `DEV_PROXY_TARGET` is only read by the Vite config and is not exposed to the browser.

## Backend contract used by the UI

Envelope: `{ "success": bool, "message": str, "data": ... }`. Errors may use the envelope
(`data.error_code`, `data.details`) or FastAPI's default `{ "detail": ... }`. Statuses
404, 409, 413, 415, 422, 429, 500 and 503 have dedicated messages.

| Endpoint | Use |
|---|---|
| `GET /health` | health tiles and sidebar indicator |
| `POST /tenders/upload` (multipart field `file`) | upload |
| `GET /tenders?page=&page_size=` | history and statistics |
| `GET /tenders/{id}` | tender details |
| `POST /tenders/{id}/analyze` | synchronous analysis |
| `GET /tenders/{id}/status` | status (polled only when needed) |
| `GET /tenders/{id}/requirements` | optional; falls back to the report if it returns 404 |
| `GET /tenders/{id}/report` | report |
| `POST /tenders/{id}/questions` (`{"question": "..."}`) | Q&A |

Report paths rendered: `data.tender_overview`, `data.extracted_requirements`,
`data.technical_results.recommendations`, `data.pricing_results`, `data.quality_review`,
`data.disclaimer`. Unrecognised fields are shown under "Additional details" or "Other ... output".

### Analysis flow

1. `POST /analyze` waits for the synchronous analysis (client timeout 20 minutes).
2. If the response reports `completed`, the report opens without polling `/status`.
3. `/status` is polled only if the POST response does not settle it, on HTTP 409, on a client
   timeout or after a network error.
4. If `/status` still says `uploaded` shortly after a successful POST, the UI shows
   "completion not confirmed" and offers to open the report. It is not marked as failed.

## Adapting to the exact Swagger schema

Fields are read from lists of candidate keys. Add your field name to the relevant list:

- tender list and record fields: `src/services/tenderService.ts`
- requirements: `src/components/analysis/RequirementsSection.tsx`
- recommendations: `src/components/analysis/RecommendationsSection.tsx`
- pricing: `src/components/analysis/PricingSection.tsx`
- quality review: `src/components/analysis/QualityReviewSection.tsx`
- health checks: `src/pages/Dashboard.tsx`

## Structure

src/components/{layout,tender,analysis,chat,common}, src/pages, src/services, src/hooks,
src/utils, src/types.

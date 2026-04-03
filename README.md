# DealFlow AI

M&A intelligence platform — ingest public fundamentals, score acquisition targets with a transparent heuristic, and generate institutional-style acquisition theses powered by Claude AI.

<img width="1902" height="922" alt="Screenshot 5 2026-04-02 194854" src="https://github.com/user-attachments/assets/4c51340e-8bd9-4e53-8ce2-c9ad7a5eaf65" />


---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Architecture](#architecture)
5. [API Reference](#api-reference)
6. [Local Development](#local-development)
7. [Environment Variables](#environment-variables)
8. [Deployment](#deployment)
9. [Troubleshooting](#troubleshooting)
10. [Disclaimer](#disclaimer)

---

## Overview

DealFlow AI is a full-stack M&A intelligence tool for analyzing public acquisition targets. It pulls real-time fundamentals from Alpha Vantage, applies a transparent scoring model, and generates dual strategic/financial acquisition theses using Anthropic Claude. User accounts, watchlists, and basket scenario analysis are all persisted server-side.

---

## Features

### Deal Scoring
- Ingests company fundamentals from Alpha Vantage (`OVERVIEW` endpoint): revenue, net margin, revenue growth, debt/equity ratio, EBITDA, market cap, P/E.
- Scores every target using a transparent heuristic:
  ```
  score = growthRate × 0.4 + profitMargin × 0.3 − debtScore × 0.3
  ```
  where `debtScore` is D/E capped to the range [0, 1].
- Top deals ranked by score, displayed as a filterable card grid.

### Data Quality & Lineage
- Every data-backed value carries its source (`AV OVERVIEW`), timestamp, and symbol.
- Fields missing from Alpha Vantage are flagged with a visible badge; a documented fallback value is used so scoring still runs. This makes the model's assumptions fully auditable.

### AI-Powered Thesis Generation
- **Dual thesis panel** — Claude generates two independent narratives per target:
  - **Strategic thesis** — market position, competitive moat, strategic rationale.
  - **Financial thesis** — valuation, margin profile, debt capacity, return potential.
- Thesis is generated on demand and clearly marked as illustrative, not investment advice.

### Company Detail Page
- Deep-dive page at `/company/:symbol` with:
  - Full fundamentals grid (score, growth, margin, D/E, revenue, EBITDA, market cap, P/E).
  - Business description sourced from Alpha Vantage.
  - Source lineage footer (data provider, timestamp, missing-field warnings).
  - Single-company scenario scorer — adjust growth, margin, and D/E assumptions and instantly recompute the score without persisting changes.
  - Export to **PDF** and **Markdown**.

### Watchlist
- Add/remove any scored company to a personal watchlist.
- Watchlist persists in **MongoDB per user account** — survives page refreshes and works across devices.
- Falls back to `localStorage` for unauthenticated users (session-only).

### Basket Scenario Analysis
- Run a "what-if" analysis across the entire watchlist simultaneously.
- Apply shared delta assumptions (e.g. revenue growth −5 pp, margin −2 pp, D/E +0.1) to every watchlist company at once.
- Results table shows base score vs. scenario score and the delta for each company, ranked by scenario score.
- Server-side computation — no changes are persisted.

### Authentication
- Email + password registration and login.
- Passwords hashed with **bcrypt** (12 rounds). Plain-text passwords are never stored.
- **JWT** tokens (30-day expiry) stored in `localStorage`.
- Anti-enumeration: login returns the same error message for a wrong email or wrong password.
- The home page is gated — users must register or sign in before accessing deal data.

---

## Tech Stack

### Backend

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ |
| Framework | Express 4, TypeScript |
| Database | MongoDB via Mongoose |
| Auth | bcryptjs, jsonwebtoken |
| Validation | Zod |
| Data | Alpha Vantage REST API |
| AI | Anthropic Claude (`claude-sonnet-4-6` default) |

### Frontend

| Layer | Technology |
|-------|------------|
| Framework | React 18, TypeScript |
| Build | Vite |
| Styling | Tailwind CSS, Font Awesome 6 |
| Charts | Recharts |
| Routing | React Router v6 |
| State | React Context (`AuthContext`, `WatchlistContext`) |

---

## Architecture

```
+------------------------------------------+
|              Browser (Vite)              |
|                                          |
|  AuthContext --> WatchlistContext        |
|       |                |                 |
|    AuthModal     BasketScenarioPanel     |
|       |                |                 |
|     App.tsx --> /company/:symbol         |
+------------------+-----------------------+
                   |
          /api  (proxied in dev,
                 VITE_API_URL in prod)
                   |
+------------------v-----------------------+
|           Express API  (port 4000)       |
|                                          |
|  /api/auth        /api/watchlist         |
|  /api/companies   /api/analyze           |
|  /api/deals       /api/explain           |
+------------------+-----------------------+
                   |
        +----------+----------+
        |                     |
   MongoDB Atlas         External APIs
   (companies,           Alpha Vantage
    users)               Anthropic Claude
```

---

## API Reference

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Returns `{ ok, mongo }` — used by Render health checks |

### Authentication

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| POST | `/api/auth/register` | — | `{ email, password }` | Create account. Returns `{ token, email }` |
| POST | `/api/auth/login` | — | `{ email, password }` | Sign in. Returns `{ token, email }` |

### Companies

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/companies` | — | List all stored companies |
| GET | `/api/companies/:symbol` | — | Full detail for one company |
| POST | `/api/companies/sync` | — | Body `{ symbols: string[] }` — fetch from Alpha Vantage and store |
| POST | `/api/analyze` | — | Body `{}` rescore all; `{ symbol }` refresh one |
| GET | `/api/deals?limit=10` | — | Top N targets by score |
| POST | `/api/explain` | — | Body `{ symbol }` — generate dual AI thesis |

### Watchlist *(requires JWT)*

All watchlist routes require the header `Authorization: Bearer <token>`.

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| GET | `/api/watchlist` | JWT | — | Returns `{ watchlist: string[], companies: CompanyRow[] }` in user-defined order |
| POST | `/api/watchlist` | JWT | `{ symbol }` | Add symbol (`$addToSet` — no duplicates) |
| DELETE | `/api/watchlist/:symbol` | JWT | — | Remove symbol |
| POST | `/api/watchlist/scenario` | JWT | `{ growthDelta, marginDelta, deDelta }` | Basket rescoring — applies deltas to all watchlist companies server-side, returns ranked results without persisting |

#### Basket scenario request body

Deltas are expressed as decimals (e.g. `-0.05` = −5 percentage points):

```json
{
  "growthDelta": -0.05,
  "marginDelta": -0.02,
  "deDelta": 0.10
}
```

---

## Local Development

### Prerequisites

- Node.js 20+
- A MongoDB instance — [MongoDB Atlas free tier](https://www.mongodb.com/atlas) or local `mongod`
- Alpha Vantage API key — [free tier](https://www.alphavantage.co/support/#api-key) (~5 req/min, 25 req/day)
- Anthropic API key — [console.anthropic.com](https://console.anthropic.com)

### 1. Clone and configure

```bash
git clone <your-repo-url>
cd "DealFlow AI"

cp backend/.env.example backend/.env
# Edit backend/.env — see Environment Variables below
```

### 2. Start the backend

```bash
cd backend
npm install
npm run dev        # ts-node-dev with hot reload, listens on :4000
```

### 3. (Optional) Seed initial data

The sync script respects Alpha Vantage's free-tier rate limit (~13 s between symbols):

```bash
# From backend/
npm run sync
```

Symbols are configured via `DEFAULT_SYMBOLS` in `.env`.

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev        # Vite dev server on :5173
```

Vite proxies all `/api` and `/health` requests to `http://127.0.0.1:4000` in development — no extra CORS configuration needed locally.

### 5. Open the app

Navigate to [http://localhost:5173](http://localhost:5173). Register an account to unlock the dashboard.

---

## Environment Variables

### Backend — `backend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | **Yes** | MongoDB connection string, e.g. `mongodb+srv://user:pass@cluster.mongodb.net/dealflow` |
| `ALPHA_VANTAGE_API_KEY` | **Yes** | Alpha Vantage API key |
| `ANTHROPIC_API_KEY` | **Yes** | Anthropic API key for Claude |
| `JWT_SECRET` | **Yes** | Long random string used to sign JWTs. The server refuses to start without it. Generate one with `openssl rand -hex 64`. |
| `PORT` | No | HTTP port (default `4000`; Render sets this automatically) |
| `ANTHROPIC_MODEL` | No | Override the Claude model slug (default: `claude-sonnet-4-6`) |
| `DEFAULT_SYMBOLS` | No | Comma-separated tickers for `npm run sync` (default: `MSFT,AAPL,GOOGL,AMZN,JPM`) |

### Frontend — `frontend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Production only | Full origin of the deployed API, e.g. `https://dealflow-api.onrender.com` (no trailing slash). Leave unset in local development — the Vite proxy handles it. |

---

## Deployment

### Backend — Render

1. Push this repo to GitHub.
2. In Render: **New Web Service** → connect repo → set **Root directory** to `backend`.
3. **Build command:** `npm install && npm run build`
4. **Start command:** `npm start`
5. **Health check path:** `/health`
6. Add all required environment variables in the Render dashboard. **`JWT_SECRET` is mandatory** — auth endpoints will return 500 without it.

A `render.yaml` Blueprint is included. If your Render account supports Blueprints, connect the repo and Render will configure the service automatically; set secret env vars manually in the Render dashboard afterward.

### Frontend — Vercel

1. In Vercel: **New Project** → import repo → set **Root directory** to `frontend`.
2. **Build command:** `npm run build` — **Output directory:** `dist`
3. Set environment variable: `VITE_API_URL` = your Render service URL (no trailing slash).
4. `vercel.json` is pre-configured to rewrite all routes to `index.html` for client-side routing.

CORS on the API is open (`cors({ origin: true })`) — no additional configuration needed.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED 127.0.0.1:4000` in Vite terminal | Backend not running | In a second terminal: `cd backend && npm run dev`. Keep it running alongside the frontend. |
| `500` errors on all `/api/*` routes | Proxy cannot reach the API | Start the backend as above. |
| "MongoDB is not connected" in UI | Missing or invalid `MONGODB_URI` | Copy `.env.example` → `.env`, paste your Atlas connection string, restart the API. In Atlas → Network Access, allow your current IP (or `0.0.0.0/0` for testing only). |
| "JWT_SECRET not configured" in auth modal | `JWT_SECRET` missing from `backend/.env` | Add `JWT_SECRET=<long random string>` to `backend/.env` and **restart the backend process**. |
| `[vite] server connection lost` | Vite process stopped or crashed | Restart `npm run dev` in `frontend/`. |
| Alpha Vantage returns a `Note:` instead of data | Free-tier rate limit hit (~5 req/min) | Wait 60 s and retry, or use smaller batches in the Ingest panel. |
| Company card shows "N fields missing" badge | Alpha Vantage did not return those fields for that ticker | Expected behaviour on the free tier. The model uses documented fallback values and surfaces the badge so assumptions remain auditable. The badge disappears automatically once Alpha Vantage returns real data on the next sync. |

---

## Disclaimer

Educational and portfolio demonstration use only. All data is sourced from public APIs and may be delayed or incomplete. AI-generated theses are illustrative narratives — they are not investment advice, financial analysis, or a recommendation to buy or sell any security.

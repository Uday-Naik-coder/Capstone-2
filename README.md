# Telco Customer Churn — MERN + ML

A full-stack customer-churn prediction application. A React SPA is served by an
Express API, which calls a Python (FastAPI) inference service backed by a pinned,
MLflow-tracked XGBoost model. **All of this ships in a single Docker image** —
the Node server serves the built SPA and runs the Python model as a child
process, so there is one container to build, push, and deploy.

---

## Table of contents

1. [Architecture](#architecture)
2. [Prerequisites](#prerequisites)
3. [Quick start (Docker — recommended)](#quick-start-docker--recommended)
4. [Local development (without Docker)](#local-development-without-docker)
5. [How to verify everything is working](#how-to-verify-everything-is-working)
6. [End-to-end file reference](#end-to-end-file-reference)
7. [Environment variables](#environment-variables)
8. [Tests](#tests)
9. [Model & serving notes](#model--serving-notes)
10. [CI/CD](#cicd)
11. [Troubleshooting](#troubleshooting)

---

## Architecture

One container runs two runtimes:

```
Browser ──► Express API (serves built SPA + /api) ──► Python ML (child process) ──► pinned XGBoost model
   :8080            :4000 (same container)              :8000 (127.0.0.1)
```

- **Frontend** — React + Vite + Tailwind. JWT + Google OAuth login, churn form,
  prediction result, and a per-user **prediction history** (view + delete). Built
  with Vite; Express serves the static bundle from `public/` and falls back to
  `index.html` for client-side routes.
- **Backend** — Express (ESM). Auth (JWT + Google OAuth), request validation, and
  a proxy to the ML service. MongoDB-backed user store (optional — predictions
  still work without a database).
- **ML service** — FastAPI exposing `GET /health` and `POST /predict`. Loads the
  bundled pinned production model and reuses the unchanged inference pipeline.
  Predictions return a label: `"Likely to churn"` / `"Not likely to churn"`.
  In the single image it runs as a child process on `127.0.0.1:8000` (enabled by
  `ML_EMBED=1`); in local dev it can still run as a standalone process and the
  backend reaches it via `ML_SERVICE_URL`.

Request flow for a prediction:

```
CustomerForm.jsx → api.predict() → POST /api/predict (Bearer JWT)
   → prediction.controller.js → validateCustomer() → mlClient.predict()
   → FastAPI POST /predict → predictor.predict_label() → inference.predict()
   → { "prediction": "Likely to churn" | "Not likely to churn" }
```

---

## Prerequisites

**For Docker (recommended):** Docker Engine / Docker Desktop with Compose v2.

**For local development:**
- Node.js **>= 20** and npm
- Python **3.11** (a virtualenv at repo root `.venv/` is expected by the commands below)
- MongoDB (local or a connection string) — optional, only needed for login/registration persistence
- A modern browser (the e2e test uses headless Chrome via Selenium)

---

## Quick start (Docker — recommended)

```bash
# 1. Create your env file and set JWT_SECRET (and optionally Google OAuth vars)
cp .env.example .env
#   then edit .env:  JWT_SECRET=<run: openssl rand -hex 32>

# 2. Build and start the whole stack (single app image + MongoDB)
docker compose up --build

# 3. Open the app
#   http://localhost:8080      (or http://localhost:$HTTP_PORT)
```

That's it — one image serves the SPA, the API, and the embedded Python model.
Data persists in the `mongo-data` volume across restarts.

Run the published image directly (without Compose):

```bash
docker build -t udaynaik07/capstone-2:latest .
docker run --rm -p 8080:4000 --env-file .env udaynaik07/capstone-2:latest
# open http://localhost:8080
```

---

## Local development (without Docker)

Local dev runs as **three separate processes**. Start them in this order.

```bash
# ---- from repo root ----
# 1) Python ML service (standalone). NOTE: run from the "ML Model/" directory so
#    `services.ml.main` resolves and the pinned model path is found.
cd "ML Model"
# Windows:
..\.venv\Scripts\python -m uvicorn services.ml.main:app --host 127.0.0.1 --port 8000
# macOS/Linux:
# ../.venv/bin/python -m uvicorn services.ml.main:app --host 127.0.0.1 --port 8000

# 2) Backend API (separate terminal)
cd Website/backend
cp .env.example .env          # set JWT_SECRET, MONGODB_URI (optional), ML_SERVICE_URL=http://127.0.0.1:8000
npm install
npm run dev                   # nodemon, listens on http://localhost:4000

# 3) Frontend SPA (separate terminal)
cd Website/frontend
cp .env.example .env          # optional: VITE_GOOGLE_CLIENT_ID
npm install
npm run dev                   # Vite, serves http://localhost:5173 and proxies /api -> :4000
```

Open **http://localhost:5173**. In dev, Vite proxies `/api` to the backend on
port 4000, and the backend proxies predictions to the ML service on port 8000.

> If you don't set `ML_EMBED`, the backend does **not** spawn Python — it expects
> the standalone ML service (step 1) to be running. `ML_EMBED=1` is only used by
> the single Docker image.

---

## How to verify everything is working

Run these checks after starting the stack (Docker or local). Each one is
independent and safe to run in isolation.

### 1. Backend health (the single best end-to-end signal)

```bash
curl http://localhost:8080/api/health          # Docker
# or during local dev:
curl http://localhost:4000/api/health
```

Expect HTTP **200** with a body like:

```json
{
  "status": "ok",
  "database": "connected",
  "ml": { "up": true, "data": { "status": "ok", "model": "3b1a41221fc44548aed629fa42b762e0", "features": 30 } }
}
```

- `status: "ok"`  → ML service reachable.
- `status: "degraded"` (HTTP 503) → ML service is down; start it (or check `ML_EMBED`).
- `database` → `connected` / `disconnected` (predictions still work if disconnected).

### 2. The SPA is served

```bash
curl -I http://localhost:8080/                  # Docker
# or http://localhost:5173/ during local dev
```

Expect HTTP **200** and `content-type: text/html`.

### 3. End-to-end prediction (authenticated)

`/api/predict` requires a Bearer JWT by default (`AUTH_REQUIRED=true`), so a bare
call returns **401** — that is correct, not a failure. Full flow:

```bash
BASE=http://localhost:8080                       # or :4000 in local dev

# Register (201) + login (200, returns a token)
curl -s -X POST $BASE/api/auth/register -H 'content-type: application/json' \
  -d '{"name":"Test","email":"test@example.com","password":"password123"}'
TOKEN=$(curl -s -X POST $BASE/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"test@example.com","password":"password123"}' | python -c "import sys,json;print(json.load(sys.stdin)['token'])")

# Predict with the reference customer (SeniorCitizen = 0)
curl -s -X POST $BASE/api/predict -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"gender":"Female","SeniorCitizen":0,"Partner":"No","Dependents":"No","tenure":2,"PhoneService":"Yes","MultipleLines":"No","InternetService":"No","OnlineSecurity":"No internet service","OnlineBackup":"No internet service","DeviceProtection":"No internet service","TechSupport":"No internet service","StreamingTV":"No internet service","StreamingMovies":"No internet service","Contract":"Month-to-month","PaperlessBilling":"No","PaymentMethod":"Mailed check","MonthlyCharges":20.3,"TotalCharges":41.2}'
# → {"prediction":"Not likely to churn"}
```

Then flip `SeniorCitizen` to `1` and predict again → `{"prediction":"Likely to churn"}`.
This **SeniorCitizen flip is the canonical parity check** for the bundled model.

> Tip: open **http://localhost:8080/api/docs** (Swagger UI) to exercise the API
> interactively, including the "Authorize" button for the JWT.

### 4. In-container parity (optional, Docker only)

Confirms the embedded Python model loads and flips correctly inside the image:

```bash
docker compose exec app /opt/venv/bin/python -c "from services.ml.predictor import predict_label as p; base={'gender':'Female','SeniorCitizen':0,'Partner':'No','Dependents':'No','tenure':2,'PhoneService':'Yes','MultipleLines':'No','InternetService':'No','OnlineSecurity':'No internet service','OnlineBackup':'No internet service','DeviceProtection':'No internet service','TechSupport':'No internet service','StreamingTV':'No internet service','StreamingMovies':'No internet service','Contract':'Month-to-month','PaperlessBilling':'No','PaymentMethod':'Mailed check','MonthlyCharges':20.3,'TotalCharges':41.2}; print(p(base)); base['SeniorCitizen']=1; print(p(base))"
# Not likely to churn
# Likely to churn
```

### 5. All automated tests

See the [Tests](#tests) section below. A green run of backend + frontend + ML
parity + e2e proves the whole chain.

---

## End-to-end file reference

Every tracked file in this repository, grouped by area, with its purpose.

### Repository root

| File | Purpose |
| --- | --- |
| `README.md` | This document. |
| `Dockerfile` | **Single multi-stage image.** Stage 1 (`fe-build`) builds the React SPA with Vite; stage 2 (`runtime`) installs Python + ML deps into `/opt/venv`, copies the backend and the pinned model to `/app/model`, and copies the built SPA to `/app/web/public`. `CMD` runs `node src/server.js`, which serves the SPA and spawns the embedded ML service. |
| `docker-compose.yml` | One-command local stack: `mongo` (MongoDB 7, persistent volume, healthcheck) + `app` (the single image). Wires `ML_EMBED=1`, `MONGODB_URI`, `JWT_SECRET`, ports (`HTTP_PORT`→4000). |
| `.env.example` | Template for the Compose/root environment. Copy to `.env` and fill in. |
| `.dockerignore` | Keeps the build context small and prevents leaking local files (`.venv`, `node_modules`, `.env`, `__pycache__`, etc.). |
| `.gitignore` | Git exclusions (venvs, `node_modules`, `.env`, caches, local `mlruns/`, etc.). |
| `Jenkinsfile` | Jenkins CI/CD pipeline. Tests backend (`npm test`), builds frontend (`npm run build`), and builds the single unified application Docker image locally. |
| `CLAUDE.md` | Guidance for AI coding assistants working in this repo. |

### `Website/backend/` — Express API

| File | Purpose |
| --- | --- |
| `package.json` | Backend deps/scripts: `start`, `dev` (nodemon), `test` (`node --test`). Express 4, Mongoose, JWT, bcryptjs, helmet, cors, rate-limit, swagger-ui, google-auth-library. |
| `package-lock.json` | Locked dependency tree for reproducible `npm ci`. |
| `.env` *(local, untracked)* | Optional local backend env for running outside Docker (`PORT`, `MONGODB_URI`, `ML_SERVICE_URL`, `JWT_SECRET`, `AUTH_*`, `GOOGLE_CLIENT_ID`). Under Docker these come from the root `.env` via Compose — there is no committed backend `.env.example`. |
| `.dockerignore` / `.gitignore` | Exclude `node_modules`, `.env`, tests, coverage from the image / git. |
| `src/server.js` | **Process entrypoint.** Optionally spawns the embedded Python ML child (`ML_EMBED=1`), waits for its `/health`, creates the ML client, connects Mongo, starts Express, and handles graceful shutdown (kills the ML child on SIGINT/SIGTERM). |
| `src/app.js` | Builds the Express app: helmet, CORS, JSON limit, rate limit; mounts `/api/health`, `/api/auth`, `/api/docs`, `/api/predict` (auth-gated), `/api/predictions` (history, always auth-scoped); and — when a built SPA exists in `PUBLIC_DIR` — serves it statically with `index.html` fallback for client-side routes. |
| `src/config/env.js` | Centralised, typed env config (ports, Mongo URI, ML URL/timeout, embedded-ML flags, JWT, Google, admin login, `AUTH_REQUIRED`). |
| `src/config/db.js` | Mongoose connection helpers (`connectDb`, `disconnectDb`, `dbState`) with a 5s server-selection timeout. |
| `src/routes/health.routes.js` | `GET /api/health` route. |
| `src/routes/auth.routes.js` | `POST /api/auth/register`, `/login`, `/google`, `/refresh`, and `GET /me` (protected). |
| `src/routes/predict.routes.js` | `POST /api/predict` route (mounted behind the auth gate in `app.js`). |
| `src/routes/history.routes.js` | `GET /api/predictions` (list current user's history) and `DELETE /api/predictions/:id` (delete one), both behind `requireAuth`. |
| `src/controllers/health.controller.js` | Returns 200 when the ML service is up, else 503; includes DB state and ML metadata. |
| `src/controllers/auth.controller.js` | Register / login / Google / refresh / me logic (bcrypt hashing, JWT access + refresh token issuance, DB or break-glass admin login). |
| `src/controllers/prediction.controller.js` | Validates the request, calls the ML client, persists the prediction best-effort with the owner's `userId` (never blocks the response), returns `{ prediction }`; plus `historyController` (list) and `deletePredictionController` (delete, scoped to the owner). |
| `src/middleware/auth.js` | `requireAuth` — extracts and verifies the Bearer JWT access token, sets `req.user`, else 401. |
| `src/middleware/errorHandler.js` | `notFoundHandler` (404) and final `errorHandler` (500). |
| `src/validation/customer.js` | Request validation mirroring the ML service's Pydantic schema; returns structured 422 errors without a network round-trip. |
| `src/services/mlClient.js` | Factory for the ML HTTP client (`predict`, `health`) using global `fetch` + `AbortSignal.timeout`; throws typed `MlServiceError`. Injectable for tests. |
| `src/services/tokenService.js` | JWT access & refresh token sign/verify; requires `JWT_SECRET` in production, random per-process fallback in dev. |
| `src/services/googleAuth.js` | Verifies Google ID tokens via `google-auth-library`; reports whether Google auth is configured. |
| `src/models/User.js` | Mongoose `User` schema (email/password and/or Google; unique email). |
| `src/models/Prediction.js` | Mongoose `Prediction` schema — one auditable row per prediction (label, model id, exact customer payload, and `userId` of the authenticated caller, indexed for per-user history). |
| `src/docs/openapi.js` | Minimal OpenAPI 3 spec served at `/api/docs` and `/api/openapi.json`. |
| `tests/api.test.js` | API integration tests via `createApp` (health, predict, auth-gating, persistence). |
| `tests/auth.test.js` | Auth flow tests (register/login/admin). |
| `tests/mlClient.test.js` | ML client tests with an injected fake `fetch` (success, error, timeout). |
| `tests/validateCustomer.test.js` | Validation unit tests (valid payload, enum/numeric violations). |

### `Website/frontend/` — React + Vite + Tailwind SPA

| File | Purpose |
| --- | --- |
| `package.json` | Frontend deps/scripts: `dev` (Vite), `build`, `preview`, `test` (Vitest). React 18, `@react-oauth/google`, Tailwind v4, Vite 6, Testing Library. |
| `package-lock.json` | Locked dependency tree. |
| `index.html` | Vite HTML entry (`#root`, loads `/src/main.jsx`). |
| `vite.config.js` | Vite config: React + Tailwind plugins; dev server on **5173** with `/api` proxied to the backend (`VITE_API_TARGET`, default `http://127.0.0.1:4000`). |
| `vitest.config.js` | Vitest config (jsdom, globals) kept separate so `vite build` stays free of test settings. |
| `.env.example` | Frontend env template (`VITE_API_TARGET`, optional `VITE_GOOGLE_CLIENT_ID`). |
| `.gitignore` | Ignores `node_modules`, `dist`, `.vite`, `.env`, `*.local`. |
| `src/main.jsx` | React root; wraps `<App/>` in `AuthProvider` and (if configured) `GoogleOAuthProvider`. |
| `src/App.jsx` | App shell: health badge + auth gate; Predict/History tabs (each keyed to remount and refetch on switch). |
| `src/api.js` | Browser API client (login/register/google/me/health/predict + `getHistory`/`deletePrediction`); stores JWT in `localStorage`, attaches `Bearer` token, clears session on 401. |
| `src/constants.js` | Form field definitions + `DEFAULT_CUSTOMER` (the row-6576 baseline with `SeniorCitizen = 0`), kept in sync with the backend/ML schemas. |
| `src/auth/AuthContext.jsx` | React context providing `user`, `login`, `register`, `loginWithGoogle`, `logout`; validates an existing token on mount. |
| `src/auth/LoginPage.jsx` | Login/Register form with toggle. |
| `src/auth/GoogleLogin.jsx` | Google sign-in button (rendered only when `VITE_GOOGLE_CLIENT_ID` is set). |
| `src/auth/ProtectedRoute.jsx` | Gates children behind authentication; shows `LoginPage` when signed out. |
| `src/components/CustomerForm.jsx` | The churn input form; submits to `predict()` and renders `PredictionResult`. |
| `src/components/Field.jsx` | Reusable `Field` / `Select` / `NumberInput` form primitives. |
| `src/components/PredictionResult.jsx` | Displays idle/loading/error/success states and the churn label. |
| `src/components/HistoryPanel.jsx` | Lists the signed-in user's past predictions (newest first) via `getHistory()`, with per-row **Delete** (`deletePrediction`); shows loading/error/empty states. |
| `src/index.css` | Tailwind entry + base styles. |
| `src/test/setup.js` | Extends Vitest `expect` with jest-dom matchers. |
| `src/api.test.js` | API client tests (token handling, predict success/401, history list/delete). |
| `src/constants.test.js` | Constants test (e.g. `DEFAULT_CUSTOMER.SeniorCitizen === 0`). |
| `src/components/CustomerForm.test.jsx` | Form tests (submits payload, renders result) with a mocked API. |
| `src/components/PredictionResult.test.jsx` | Result-state rendering tests. |

### `ML Model/` — Machine learning project

| File | Purpose |
| --- | --- |
| `requirements.txt` | Full ML pipeline dependencies (mlflow, xgboost, scikit-learn, pandas, optuna, great-expectations, gradio, etc.). |
| `.dockerignore` | Context exclusions for the ML directory (keeps `__pycache__`, caches out; keeps the pinned model). |
| `notebooks/EDA.ipynb` | Exploratory data analysis notebook (IBM Telco churn dataset context, distributions, churn balance). |
| `scripts/run_pipeline.py` | End-to-end training pipeline: load → validate → preprocess → feature-engineer → train → evaluate, logging to MLflow. |
| `scripts/prepare_processed_data.py` | One-off: reads the raw CSV, preprocesses, builds features, writes `data/processed/telco_churn_processed.csv`. |
| `scripts/test_fastapi.py` | Quick manual probe that POSTs a sample customer to a running ML service at `127.0.0.1:8000/predict`. |
| `scripts/test_pipeline_phase1_data_features.py` | Phase-1 check: load → preprocess → build features. |
| `scripts/test_pipeline_phase2_modeling.py` | Phase-2 check: train XGBoost on the processed data (stratified split, target 0/1 asserts). |
| `e2e/test_e2e.py` | Selenium headless end-to-end test of the **full MERN chain** in a real browser: load app → register → predict `SeniorCitizen=0` → flip to `1` (expects "Likely to churn"). Env: `E2E_BASE_URL` (default `http://localhost:5174`). |
| `services/__init__.py` | Marks `services` as a package. |
| `services/ml/__init__.py` | Marks the ML service package. |
| `services/ml/requirements.txt` | **Serving-only** deps (fastapi, uvicorn, pydantic, mlflow, scikit-learn, xgboost, pandas, numpy). |
| `services/ml/main.py` | **FastAPI app**: defines the `CustomerData` request schema and the `GET /health` + `POST /predict` endpoints; delegates to `predictor.predict_label`. |
| `services/ml/predictor.py` | Loads the **pinned** bundled model once at import and overwrites `src.serving.inference` globals (`model`, `FEATURE_COLS`, `MODEL_DIR`) so predictions are byte-identical everywhere; exposes `predict_label`, `MODEL_ID`, `FEATURE_COUNT`, `BUNDLED_MODEL_DIR`. |
| `services/ml/tests/__init__.py` | Marks the test package. |
| `services/ml/tests/test_parity.py` | Parity tests: the HTTP `/predict` returns the same label as an independent from-scratch load of the bundled model (real parity oracle) + the `SeniorCitizen` flip fixture. |
| `src/app/main.py` | Standalone FastAPI + Gradio serving app (full-featured local demo server). |
| `src/app/app.py` | Minimal FastAPI app exposing the inference pipeline (used by `src.app.app:app`). |
| `src/data/load_data.py` | `load_data()` — reads the raw CSV into a DataFrame with existence checks. |
| `src/data/preprocess.py` | `preprocess_data()` — trims headers, drops IDs, fixes `TotalCharges` to numeric, maps `Churn` to 0/1, handles NAs. |
| `src/features/build_features.py` | Deterministic binary encoding + feature engineering shared by training and serving. |
| `src/models/train.py` | Trains an XGBoost classifier and logs params/metrics/model to MLflow. |
| `src/models/evaluate.py` | Prints classification report + confusion matrix. |
| `src/models/tune.py` | Optuna hyperparameter tuning with cross-validation. |
| `src/serving/inference.py` | **Serving pipeline (must stay byte-identical).** Loads the model at import (prefers `/app/model`, else the newest local `mlruns` model), applies the serving transform, and `predict()` returns the churn label. |
| `src/serving/model/3b1a41221fc44548aed629fa42b762e0/` | **The pinned production model** (committed on purpose). `artifacts/model/` = MLflow model (`model.pkl`, `MLmodel`, `conda.yaml`, `requirements.txt`, `metadata/`); `artifacts/feature_columns.txt` = the 30-feature order; `artifacts/preprocessing.pkl` = preprocessing; `metrics/`, `params/`, `tags/`, `meta.yaml` = training metadata. |
| `src/serving/model/2ac205f95a264d49b964ab362fe5f4e6/` | An earlier model run kept for reference/history (not the one served). |
| `src/utils/utils.py` | Logger setup helper. |
| `src/utils/validate_data.py` | Great Expectations data-quality checks run before training. |

---

## Environment variables

Root `.env` (Compose / image) — see `.env.example`:

| Variable | Default | Meaning |
| --- | --- | --- |
| `JWT_SECRET` | *(required)* | Secret used to sign JWT access tokens. Generate: `openssl rand -hex 32`. |
| `JWT_EXPIRES_IN` | `15m` | Access-token lifetime. |
| `JWT_REFRESH_SECRET` | *(empty)* | Optional distinct secret for refresh tokens (defaults to derived secret). |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh-token lifetime. |
| `CORS_ORIGIN` | `*` | Allowed CORS origin(s). |
| `GOOGLE_CLIENT_ID` | *(empty)* | Backend Google OAuth client id (blank disables Google auth). |
| `VITE_GOOGLE_CLIENT_ID` | *(empty)* | Frontend build-time Google client id (baked into the SPA). |
| `AUTH_ADMIN_EMAIL` / `AUTH_ADMIN_PASSWORD` | *(empty)* | Optional break-glass admin login (works without a DB). |
| `AUTH_REQUIRED` | `true` | Require login for `POST /api/predict`. |
| `HTTP_PORT` | `8080` | Host port the single app image is published on. |
| `IMAGE_TAG` | `latest` | Tag applied to built images. |

Backend runtime (set by Compose or `Website/backend/.env`): `PORT` (4000),
`MONGODB_URI`, `ML_SERVICE_URL`, `ML_TIMEOUT_MS`, plus embedded-ML flags
`ML_EMBED`, `ML_PORT` (8000), `ML_PYTHON`, `ML_APP_DIR`, `ML_STARTUP_TIMEOUT_MS`.

---

## Google OAuth setup (optional)

The sign-in button only appears once a real Google **OAuth Client ID** is
configured. The wiring is already in place — the button is hidden by design when
the id is blank, and email/password login keeps working regardless.

1. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   create an **OAuth client ID** of type **Web application**.
2. Under **Authorized JavaScript origins**, add the origins the SPA is served
   from, e.g. `http://localhost:8080` (Docker) and `http://localhost:5173`
   (Vite dev). Add your deployed origin too, if any.
3. Set the **same** client id in two places (root `.env`):

   | Variable | Consumed by | When |
   | --- | --- | --- |
   | `VITE_GOOGLE_CLIENT_ID` | Frontend (Google button + `GoogleOAuthProvider`) | **Build time** — baked into the SPA |
   | `GOOGLE_CLIENT_ID` | Backend (`googleAuth.js` token verification) | Runtime |

4. Rebuild so the frontend picks up the id:

   ```bash
   docker compose up --build      # Docker
   # or, local dev: restart `npm run dev` in Website/frontend
   ```

`AUTH_ADMIN_EMAIL`/`AUTH_ADMIN_PASSWORD` and email/password login are unrelated
to Google and work without any Google config.

---

## Prediction history

Every successful prediction is stored (best-effort, when a database is connected)
with the authenticated user's id. Open the **History** tab to see your past
predictions newest-first and **Delete** any row.

- `GET /api/predictions` — list the current user's history (`{ items: [...] }`).
- `DELETE /api/predictions/:id` — delete one of the current user's rows.

Both endpoints require a Bearer JWT and are scoped to the caller (`userId`), so a
user can only see and delete their own predictions. When no database is
connected, the list returns an empty array and delete returns `503` — prediction
itself is unaffected.

---

## Tests

```bash
# Backend (node:test)
cd Website/backend && npm test

# Frontend (Vitest + Testing Library) + production build
cd Website/frontend && npm test && npm run build

# ML parity (pytest, from the "ML Model/" directory with the project .venv)
cd "ML Model"
..\.venv\Scripts\python -m pytest services/ml/tests/test_parity.py

# End-to-end (Selenium headless Chrome, from repo root; app must be running)
..\.venv\Scripts\python.exe "ML Model\e2e\test_e2e.py"
```

A green run of all four proves: validation + API + auth (backend), UI + client
(frontend), model parity (ML), and the full browser chain (e2e).

---

## Model & serving notes

- The serving model is pinned to a bundled MLflow run under
  `ML Model/src/serving/model/3b1a41221fc44548aed629fa42b762e0/`, so predictions
  are identical locally and in the container. This directory is committed on purpose.
- Training/evaluation uses a decision threshold of `0.35`; the serving service
  uses the model's default `predict()` threshold. Serving behavior is preserved
  as-is.
- The model consumes **30 features**. `SeniorCitizen` is exposed as an explicit
  integer (0/1) in the UI and API.
- The `SeniorCitizen` flag flip (0 → "Not likely to churn", 1 → "Likely to churn"
  for the reference customer) is the canonical parity check.

---

## CI/CD

CI/CD is automated via **Jenkins** ([Jenkinsfile](Jenkinsfile)). The pipeline runs the test and build lifecycle and ends with creating the local Docker image:

- **Verify Docker** — Confirms the Docker daemon is accessible and running.
- **Backend Install & Test** — `npm ci && npm test` in an isolated Node 20 container.
- **Frontend Install & Build** — `npm ci && npm run build` in an isolated Node 20 container.
- **Build Docker Image** — Builds and tags the single application container (`$APP_IMAGE:$BUILD_NUMBER` and `:latest`).

No external Docker Hub credentials or remote push configurations are required.

Builds use the single root `Dockerfile`.

---

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `/api/health` returns `status: "degraded"` (503) | ML service not up. Docker: check `docker compose logs app` (embedded ML failed to start). Local: start the uvicorn ML service (step 1). |
| `POST /api/predict` returns **401** | Expected when `AUTH_REQUIRED=true` — send `Authorization: Bearer <token>` (register/login first). Set `AUTH_REQUIRED=false` to open it. |
| Predictions error with ML unreachable (502/503) | Backend can't reach the ML service. Docker: embedded ML (`ML_EMBED=1`). Local: ensure uvicorn is running and `ML_SERVICE_URL` is correct. |
| `database: "disconnected"` | MongoDB not reachable. Predictions still work; login/registration persistence needs Mongo (`MONGODB_URI`). |
| Google sign-in button missing | `VITE_GOOGLE_CLIENT_ID` (frontend) / `GOOGLE_CLIENT_ID` (backend) not set. Email/password login still works. |
| Port already in use (8080/4000/8000) | Change `HTTP_PORT` (Compose), `PORT` (backend), or the uvicorn `--port`. |
| `JWT_SECRET must be set in production` | Set `JWT_SECRET` in `.env`. |
| Frontend can't reach API in local dev | Ensure the backend (port 4000) and ML service (port 8000) are running; Vite proxies `/api` → `VITE_API_TARGET`. |
# Telco Customer Churn — MERN + ML

A full-stack customer-churn prediction application. A React SPA talks to an
Express API, which proxies to a Python (FastAPI) inference service backed by a
pinned, MLflow-tracked XGBoost model.

## Repository layout

```
.
├── Website/                 # MERN application
│   ├── backend/             # Express API (auth, validation, ML proxy)
│   └── frontend/            # React + Vite + Tailwind SPA
├── ML Model/                # Machine-learning project
│   ├── src/                 # data, features, serving (inference) packages
│   ├── services/ml/         # FastAPI inference service (serves the pinned model)
│   ├── scripts/             # training pipeline entry points
│   ├── notebooks/           # exploration notebooks
│   ├── e2e/                 # Selenium end-to-end test
│   ├── mlruns/              # local MLflow tracking (git-ignored)
│   ├── artifacts/           # shared preprocessing artifacts (git-ignored)
│   └── requirements.txt     # full ML pipeline dependencies
├── docker-compose.yml       # one-command local stack (mongo + ml + backend + frontend)
├── Jenkinsfile              # Jenkins CI/CD pipeline
├── .github/workflows/ci.yml # GitHub Actions: build & push the ML image
└── .env.example             # environment template
```

## Architecture

```
Browser ──► React SPA (nginx) ──► Express API ──► FastAPI ML service ──► pinned XGBoost model
   :8080            :80              :4000            :8000
```

- **Frontend** — React + Vite + Tailwind. JWT + Google OAuth login, churn form,
  prediction result. nginx serves the built SPA and proxies `/api` to the backend.
- **Backend** — Express (ESM). Auth (JWT + Google OAuth), request validation,
  and a proxy to the ML service. MongoDB-backed user store.
- **ML service** — FastAPI exposing `GET /health` and `POST /predict`. Loads the
  bundled pinned production model and reuses the unchanged inference pipeline.
  Predictions return a label: `"Likely to churn"` / `"Not likely to churn"`.

## Quick start (Docker — recommended)

```bash
cp .env.example .env        # set JWT_SECRET (and optionally Google OAuth vars)
docker compose up --build
# open http://localhost:8080
```

## Local development

```bash
# 1. ML service (from repo root)
.venv/Scripts/python -m uvicorn services.ml.main:app --host 127.0.0.1 --port 8000   # run inside ML Model/

# 2. Backend
cd Website/backend && npm install && npm run dev

# 3. Frontend
cd Website/frontend && npm install && npm run dev
```

## Tests

```bash
# Backend (node:test)
cd Website/backend && npm test

# Frontend (Vitest + Testing Library)
cd Website/frontend && npm test && npm run build

# ML parity (pytest, from ML Model/ with the project .venv)
.venv/Scripts/python -m pytest services/ml/tests/test_parity.py

# End-to-end (Selenium headless Chrome, from repo root)
.venv/Scripts/python "ML Model/e2e/test_e2e.py"
```

## Model & serving notes

- The serving model is pinned to a bundled MLflow run under
  `ML Model/src/serving/model/`, so predictions are identical locally and in the
  container. This directory is committed on purpose.
- Training/evaluation uses a decision threshold of `0.35`; the serving service
  uses the model's default `predict()` threshold. Serving behavior is preserved
  as-is.
- The `SeniorCitizen` flag is exposed in the UI; flipping it changes the
  prediction for the reference customer (a useful parity check).

## CI/CD

- **GitHub Actions** (`.github/workflows/ci.yml`): on push to `main`, builds and
  pushes the ML service image to Docker Hub.
- **Jenkins** (`Jenkinsfile`): runs backend tests + frontend build, builds the
  three MERN images, and (on `main`) pushes to Docker Hub and optionally runs
  `docker compose up`.
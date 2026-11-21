# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Repository layout

- `Website/backend/` — Express (ESM) API: auth (JWT + Google OAuth), validation,
  MongoDB user store, proxy to the ML service.
- `Website/frontend/` — React + Vite + Tailwind SPA (JavaScript).
- `ML Model/` — ML project:
  - `src/` — `data`, `features`, `serving` (inference) packages
  - `services/ml/` — FastAPI inference service (`main.py`, `predictor.py`)
  - `scripts/` — `run_pipeline.py` (training), `prepare_processed_data.py`
  - `e2e/` — Selenium end-to-end test
  - `mlruns/`, `artifacts/`, `data/` — local, git-ignored
  - `src/serving/model/` — **committed** pinned production model (do not remove)

## Commands

All Python commands use the project venv at repo root (`.venv/`), Python 3.11.

### ML service (run from `ML Model/`)
```bash
# from repo root:
.venv/Scripts/python -m uvicorn services.ml.main:app --host 127.0.0.1 --port 8000   # (cwd = ML Model)
```
Serves `GET /health` and `POST /predict` on port 8000.

### Training pipeline (from `ML Model/`)
```bash
.venv/Scripts/python scripts/run_pipeline.py --input data/raw/Telco-Customer-Churn.csv --target Churn
```

### Tests
```bash
# Backend (node:test)
cd Website/backend && npm test

# Frontend (Vitest)
cd Website/frontend && npm test        # npm run build to typecheck/build

# ML parity (pytest) — from ML Model/
.venv/Scripts/python -m pytest services/ml/tests/test_parity.py

# End-to-end (Selenium) — from repo root
.venv/Scripts/python "ML Model/e2e/test_e2e.py"
```

### Local dev servers
```bash
cd Website/backend  && npm run dev     # Express on :4000
cd Website/frontend && npm run dev     # Vite on :5174
```

### Docker
```bash
cp .env.example .env                 # set JWT_SECRET
docker compose up --build            # mongo + single app image, http://localhost:8080
docker compose config --quiet        # validate compose file
```

The **root `Dockerfile`** builds one image (React SPA + Express API + Python ML
model) tagged `udaynaik07/capstone-2`. Inside it the backend runs from
`/app/web` (serving the SPA from `/app/web/public`), the ML code from `/app/ml`,
and the pinned model from `/app/model` (the absolute path `inference.py` tries
first). `ML_EMBED=1` makes `server.js` start `uvicorn` as a child on
`127.0.0.1:8000`. Keep those paths in sync if you touch the Dockerfile,
`server.js`, or `inference.py`.

## Architecture notes

- **ML pipeline** (`ML Model/scripts/run_pipeline.py`): load → validate
  (Great Expectations) → preprocess → feature engineering → XGBoost train →
  MLflow logging. Tracking is file-based at `ML Model/mlruns`.
- **Serving** (`ML Model/services/ml/`): FastAPI service. `predictor.py` pins the
  bundled model (`ML Model/src/serving/model/<run>/artifacts/model`) and reuses
  the **unchanged** `src/serving/inference.py` so predictions match training.
  - `src/serving/inference.py` resolves the project root via
    `Path(__file__).resolve().parents[2]` → `ML Model/`; keep `src/` and
    `mlruns/` as siblings under `ML Model/`.
- **Feature consistency**: training and serving must use identical transforms
  (binary Yes/No→0/1, one-hot `drop_first=True`, feature order from
  `feature_columns.txt`). Do not change serving transforms.
- **Thresholds**: training/eval uses `0.35`; serving uses the model's default
  `predict()` threshold. Do not "fix" serving to use 0.35 — serving behavior is
  preserved intentionally.
- **Single-row vs batch**: serving builds a 1-row DataFrame, so `get_dummies`
  drops all one-hots; this matches the deployed behavior and is preserved.
- **`SeniorCitizen`** is exposed in the UI; flipping it flips the prediction for
  the reference customer (parity fixture).

## API

- ML service: `GET /health`, `POST /predict` (19-field payload → label
  `"Likely to churn"` / `"Not likely to churn"`).
- Backend: `POST /api/...` auth + predict proxy; `GET /api/health` returns 503
  when the ML service is down.

## Conventions

- Frontend is JavaScript (not TypeScript).
- Never commit secrets (`.env` is git-ignored; use `.env.example`).
- The committed model under `ML Model/src/serving/model/` is required for the app
  image to build and run from a fresh clone — keep it tracked.
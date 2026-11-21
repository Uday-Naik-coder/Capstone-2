# syntax=docker/dockerfile:1
#
# Single-image build for the Telco Churn app.
# ----------------
# Ships everything in ONE container:
#   * React SPA  -> built with Vite, served by Express from ./public
#   * Express API (Node 20) -> auth, validation, static SPA, /api/*
#   * Python ML model (MLflow/scikit-learn) -> runs as a child process on
#     127.0.0.1:8000 (started by the Node server when ML_EMBED=1)
#
# Build from the repository root (context = .):
#   docker build -t udaynaik07/capstone-2:latest .
# Run:
#   docker run -p 4000:4000 -e JWT_SECRET=... udaynaik07/capstone-2:latest

# ---------------------------------------------------------------------------
# Stage 1: build the React SPA
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS fe-build
WORKDIR /fe
COPY Website/frontend/package.json Website/frontend/package-lock.json ./
RUN npm ci
COPY Website/frontend/ ./
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: runtime (Node + Python + model + SPA)
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=4000 \
    ML_EMBED=1 \
    ML_PORT=8000 \
    ML_SERVICE_URL=http://127.0.0.1:8000 \
    ML_APP_DIR=/app/ml \
    ML_PYTHON=/opt/venv/bin/python \
    PUBLIC_DIR=/app/web/public

# Python runtime + native libs needed by the ML wheels (xgboost/libgomp).
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv python3-pip libgomp1 \
 && rm -rf /var/lib/apt/lists/*

# Python ML dependencies (cached until requirements.txt changes).
COPY ["ML Model/services/ml/requirements.txt", "/tmp/requirements.txt"]
RUN python3 -m venv /opt/venv \
 && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
 && /opt/venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt

# Node backend (runtime deps only).
WORKDIR /app/web
COPY Website/backend/package.json Website/backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY Website/backend/src ./src

# Python ML source + pinned model.
# NOTE: JSON COPY form is used for "ML Model" paths so the space in the
# directory name is handled unambiguously.
COPY ["ML Model/src", "/app/ml/src"]
COPY ["ML Model/services", "/app/ml/services"]
COPY ["ML Model/src/serving/model/3b1a41221fc44548aed629fa42b762e0/artifacts/model", "/app/model"]
COPY ["ML Model/src/serving/model/3b1a41221fc44548aed629fa42b762e0/artifacts/feature_columns.txt", "/app/model/feature_columns.txt"]
COPY ["ML Model/src/serving/model/3b1a41221fc44548aed629fa42b762e0/artifacts/preprocessing.pkl", "/app/model/preprocessing.pkl"]

# Built SPA served by Express.
COPY --from=fe-build /fe/dist /app/web/public

WORKDIR /app/web
EXPOSE 4000

# /api/health returns 200 only once the embedded ML model is reachable.
HEALTHCHECK --interval=30s --timeout=6s --start-period=60s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
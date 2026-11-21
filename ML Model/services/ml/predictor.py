"""
Pinned-model predictor for the Telco Churn ML service.
=====================================================

This module wraps the EXISTING, unchanged inference pipeline
(``src.serving.inference``) but pins it to the bundled production model
(``3b1a41221fc44548aed629fa42b762e0``) so that predictions are byte-for-byte
identical in local development and in the container.

Why pin?
--------
``src.serving.inference`` loads a model at import time:

    1. ``/app/model`` (Docker) -> the bundled production model, OR
    2. the most-recently-modified model under ``./mlruns/*/artifacts/model``
       (local dev) -> a DIFFERENT run (fdb34ea3) whose predictions differ.

To remove that environment-dependent ambiguity we re-load the bundled model
explicitly and overwrite the inference module's globals. The transformation
logic (``_serve_transform``) and prediction contract (``predict``) are reused
verbatim so there is a single source of truth for serving behavior.
"""

import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Make the project root importable so ``src.serving.inference`` resolves,
# regardless of the current working directory.
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[2]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import mlflow  # noqa: E402  (import after sys.path mutation)
import src.serving.inference as _inf  # noqa: E402


# ---------------------------------------------------------------------------
# Bundled production model (the single source of truth for serving).
# ---------------------------------------------------------------------------

MODEL_RUN_ID = "3b1a41221fc44548aed629fa42b762e0"

_MODEL_ARTIFACTS = (
    PROJECT_ROOT / "src" / "serving" / "model" / MODEL_RUN_ID / "artifacts"
)
BUNDLED_MODEL_DIR = _MODEL_ARTIFACTS / "model"
FEATURE_COLUMNS_FILE = _MODEL_ARTIFACTS / "feature_columns.txt"


def _load_pinned_model():
    """Load the bundled model artifact and its canonical feature schema."""

    if not BUNDLED_MODEL_DIR.exists():
        raise FileNotFoundError(
            f"Bundled model not found at {BUNDLED_MODEL_DIR}"
        )

    if not FEATURE_COLUMNS_FILE.exists():
        raise FileNotFoundError(
            f"Feature columns file not found at {FEATURE_COLUMNS_FILE}"
        )

    model = mlflow.pyfunc.load_model(str(BUNDLED_MODEL_DIR))

    with open(FEATURE_COLUMNS_FILE, "r") as f:
        feature_cols = [line.strip() for line in f if line.strip()]

    if not feature_cols:
        raise ValueError(
            f"No feature columns parsed from {FEATURE_COLUMNS_FILE}"
        )

    return model, feature_cols


# Load once at import and PIN the inference module's globals so that both
# ``_serve_transform`` (which reads ``FEATURE_COLS``) and ``predict`` (which
# reads ``model``) use the bundled production model.
_PINNED_MODEL, PINNED_FEATURE_COLS = _load_pinned_model()

_inf.model = _PINNED_MODEL
_inf.FEATURE_COLS = PINNED_FEATURE_COLS
_inf.MODEL_DIR = BUNDLED_MODEL_DIR

# Public metadata for health/reporting endpoints.
MODEL_ID = MODEL_RUN_ID
FEATURE_COUNT = len(PINNED_FEATURE_COLS)


def predict_label(payload: dict) -> str:
    """
    Predict the churn label for one customer.

    Reuses ``src.serving.inference.predict`` unchanged (now pinned to the
    bundled model) so the serving transformation and output contract stay
    identical to the rest of the project.

    Returns:
        "Likely to churn" or "Not likely to churn"
    """

    return _inf.predict(payload)
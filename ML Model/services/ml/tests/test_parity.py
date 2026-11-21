"""
Parity + behavior tests for the pinned-model ML service.

Run from the project root with the project virtualenv:

    .venv\\Scripts\\python.exe -m services.ml.tests.test_parity
    .venv\\Scripts\\python.exe services\\ml\\tests\\test_parity.py

These tests prove that:
  1. The HTTP /predict endpoint returns the SAME label as an INDEPENDENT
     from-scratch load of the bundled model artifact (real parity oracle).
  2. Exposing SeniorCitizen changes predictions where expected.
  3. /health reports the pinned model and feature count.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import pandas as pd  # noqa: E402
import mlflow  # noqa: E402
from starlette.testclient import TestClient  # noqa: E402

from services.ml.main import app  # noqa: E402
from services.ml.predictor import (  # noqa: E402
    BUNDLED_MODEL_DIR,
    FEATURE_COLUMNS_FILE,
    FEATURE_COUNT,
    MODEL_ID,
)

# ---------------------------------------------------------------------------
# Independent oracle: fresh model + fresh feature list + faithful transform
# (a self-contained copy of src.serving.inference._serve_transform logic).
# ---------------------------------------------------------------------------

BINARY_MAP = {
    "gender": {"Female": 0, "Male": 1},
    "Partner": {"No": 0, "Yes": 1},
    "Dependents": {"No": 0, "Yes": 1},
    "PhoneService": {"No": 0, "Yes": 1},
    "PaperlessBilling": {"No": 0, "Yes": 1},
}
NUMERIC_COLS = ["tenure", "MonthlyCharges", "TotalCharges"]


def _load_oracle():
    model = mlflow.pyfunc.load_model(str(BUNDLED_MODEL_DIR))
    with open(FEATURE_COLUMNS_FILE, "r") as f:
        cols = [ln.strip() for ln in f if ln.strip()]
    return model, cols


_ORACLE_MODEL, _ORACLE_COLS = _load_oracle()
# sklearn flavor exposes predict_proba (pyfunc wrapper does not).
_ORACLE_SK = mlflow.sklearn.load_model(str(BUNDLED_MODEL_DIR))


def _oracle_transform(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = df.columns.str.strip()
    for c in NUMERIC_COLS:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0)
    for c, mapping in BINARY_MAP.items():
        if c in df.columns:
            df[c] = (
                df[c].astype(str).str.strip().map(mapping)
                .astype("Int64").fillna(0).astype(int)
            )
    obj_cols = list(df.select_dtypes(include=["object"]).columns)
    if obj_cols:
        df = pd.get_dummies(df, columns=obj_cols, drop_first=True)
    bool_cols = df.select_dtypes(include=["bool"]).columns
    if len(bool_cols) > 0:
        df[bool_cols] = df[bool_cols].astype(int)
    df = df.reindex(columns=_ORACLE_COLS, fill_value=0)
    return df


def _oracle_predict(payload: dict) -> str:
    df_enc = _oracle_transform(pd.DataFrame([payload]))
    preds = _ORACLE_MODEL.predict(df_enc)
    r = preds.tolist()[0] if hasattr(preds, "tolist") else preds[0]
    return "Likely to churn" if r == 1 else "Not likely to churn"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

CLIENT = TestClient(app)

_HIGH_RISK_SC0 = {
    "gender": "Male", "SeniorCitizen": 0, "Partner": "No", "Dependents": "No",
    "PhoneService": "Yes", "MultipleLines": "No", "InternetService": "Fiber optic",
    "OnlineSecurity": "No", "OnlineBackup": "No", "DeviceProtection": "No",
    "TechSupport": "No", "StreamingTV": "Yes", "StreamingMovies": "Yes",
    "Contract": "Month-to-month", "PaperlessBilling": "Yes",
    "PaymentMethod": "Electronic check",
    "tenure": 5, "MonthlyCharges": 85.0, "TotalCharges": 85.0,
}

_HIGH_RISK_SC1 = dict(_HIGH_RISK_SC0, SeniorCitizen=1)

# A real SeniorCitizen label-flip, validated under SINGLE-ROW serving semantics
# (the exact path inference.predict uses: pd.DataFrame([payload]) then
# get_dummies(drop_first=True)). Source: Telco-Customer-Churn.csv row 6576.
#   SeniorCitizen=0 -> proba 0.3724 -> "Not likely to churn"
#   SeniorCitizen=1 -> proba 0.6237 -> "Likely to churn"
# Both probabilities sit far from the 0.5 boundary (margin 0.124), so this
# fixture is stable across runs. Toggling only SeniorCitizen flips the label.
_SC_FLIP = {
    "gender": "Female", "SeniorCitizen": 0, "Partner": "No", "Dependents": "No",
    "PhoneService": "Yes", "MultipleLines": "No", "InternetService": "No",
    "OnlineSecurity": "No internet service", "OnlineBackup": "No internet service",
    "DeviceProtection": "No internet service", "TechSupport": "No internet service",
    "StreamingTV": "No internet service", "StreamingMovies": "No internet service",
    "Contract": "Month-to-month", "PaperlessBilling": "No",
    "PaymentMethod": "Mailed check",
    "tenure": 2, "MonthlyCharges": 20.3, "TotalCharges": 41.2,
}

_LOW_RISK = {
    "gender": "Male", "SeniorCitizen": 0, "Partner": "Yes", "Dependents": "Yes",
    "PhoneService": "Yes", "MultipleLines": "Yes", "InternetService": "DSL",
    "OnlineSecurity": "Yes", "OnlineBackup": "Yes", "DeviceProtection": "Yes",
    "TechSupport": "Yes", "StreamingTV": "No", "StreamingMovies": "No",
    "Contract": "Two year", "PaperlessBilling": "No",
    "PaymentMethod": "Credit card (automatic)",
    "tenure": 60, "MonthlyCharges": 45.0, "TotalCharges": 2700.0,
}


def _api_predict(payload: dict) -> str:
    resp = CLIENT.post("/predict", json=payload)
    assert resp.status_code == 200, f"{resp.status_code}: {resp.text}"
    return resp.json()["prediction"]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_health():
    resp = CLIENT.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["model"] == MODEL_ID
    assert body["features"] == FEATURE_COUNT == 30


def test_parity_matches_independent_oracle():
    for name, payload in [
        ("high_risk_sc0", _HIGH_RISK_SC0),
        ("high_risk_sc1", _HIGH_RISK_SC1),
        ("low_risk", _LOW_RISK),
    ]:
        expected = _oracle_predict(payload)
        actual = _api_predict(payload)
        assert actual == expected, (
            f"[{name}] API='{actual}' != oracle='{expected}'"
        )
        print(f"[OK] parity {name}: {actual}")


def test_senior_citizen_is_exposed():
    # End-to-end: identical payload except SeniorCitizen must flip the label,
    # proving the signal is wired all the way through the API to the model.
    sc0 = _api_predict(dict(_SC_FLIP, SeniorCitizen=0))
    sc1 = _api_predict(dict(_SC_FLIP, SeniorCitizen=1))
    print(f"[INFO] SeniorCitizen 0 -> {sc0!r}; 1 -> {sc1!r}")
    assert sc0 == "Not likely to churn", f"SC=0 expected 'Not likely to churn', got {sc0!r}"
    assert sc1 == "Likely to churn", f"SC=1 expected 'Likely to churn', got {sc1!r}"

    # White-box: SeniorCitizen must move the churn probability by a clear,
    # deterministic margin (not a boundary fluke). Measured delta ~0.25.
    p0 = _ORACLE_SK.predict_proba(_oracle_transform(pd.DataFrame([dict(_SC_FLIP, SeniorCitizen=0)])))[0][1]
    p1 = _ORACLE_SK.predict_proba(_oracle_transform(pd.DataFrame([dict(_SC_FLIP, SeniorCitizen=1)])))[0][1]
    print(f"[INFO] proba SC=0 -> {p0:.4f}; SC=1 -> {p1:.4f}; delta={p1 - p0:.4f}")
    assert p1 > p0 + 0.10, (
        f"SeniorCitizen should raise churn probability by >0.10, got {p0:.4f}->{p1:.4f}"
    )


def test_senior_citizen_required():
    payload = dict(_HIGH_RISK_SC0)
    del payload["SeniorCitizen"]
    resp = CLIENT.post("/predict", json=payload)
    assert resp.status_code == 422, (
        f"SeniorCitizen should be required, got {resp.status_code}"
    )


def main():
    tests = [
        test_health,
        test_parity_matches_independent_oracle,
        test_senior_citizen_is_exposed,
        test_senior_citizen_required,
    ]
    failures = 0
    for t in tests:
        try:
            t()
            print(f"[PASS] {t.__name__}")
        except AssertionError as e:
            failures += 1
            print(f"[FAIL] {t.__name__}: {e}")
        except Exception as e:
            failures += 1
            print(f"[ERROR] {t.__name__}: {type(e).__name__}: {e}")
    print("-" * 60)
    if failures:
        print(f"RESULT: {failures} test(s) failed")
        sys.exit(1)
    print(f"RESULT: all {len(tests)} tests passed")


if __name__ == "__main__":
    main()
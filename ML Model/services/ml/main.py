"""
ML Service API (FastAPI)
========================

A thin serving wrapper around the pinned bundled Telco Churn model.

Endpoints
---------
GET  /health  -> liveness + model/feature metadata (for ALB/K8s probes)
POST /predict -> {"prediction": "Likely to churn" | "Not likely to churn"}

The prediction contract matches the existing API. The only schema change is
that ``SeniorCitizen`` is now an explicit integer input (0 or 1) instead of
being silently defaulted to 0, so the model can actually use that signal.
"""

from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from services.ml.predictor import (
    FEATURE_COUNT,
    MODEL_ID,
    predict_label,
)

app = FastAPI(
    title="Telco Customer Churn Prediction API",
    description=(
        "ML API for predicting customer churn. Backed by the pinned "
        f"production model ({MODEL_ID})."
    ),
    version="1.0.0",
)


# ---------------------------------------------------------------------------
# Request schema
# ---------------------------------------------------------------------------

class CustomerData(BaseModel):
    """Customer feature schema for churn prediction (18 base + SeniorCitizen)."""

    # Demographics
    gender: Literal["Male", "Female"]
    SeniorCitizen: Literal[0, 1] = Field(
        ...,
        description="1 if the customer is 65 or older, else 0.",
    )
    Partner: Literal["Yes", "No"]
    Dependents: Literal["Yes", "No"]

    # Phone services
    PhoneService: Literal["Yes", "No"]
    MultipleLines: Literal["Yes", "No", "No phone service"]

    # Internet services
    InternetService: Literal["DSL", "Fiber optic", "No"]
    OnlineSecurity: Literal["Yes", "No", "No internet service"]
    OnlineBackup: Literal["Yes", "No", "No internet service"]
    DeviceProtection: Literal["Yes", "No", "No internet service"]
    TechSupport: Literal["Yes", "No", "No internet service"]
    StreamingTV: Literal["Yes", "No", "No internet service"]
    StreamingMovies: Literal["Yes", "No", "No internet service"]

    # Account information
    Contract: Literal["Month-to-month", "One year", "Two year"]
    PaperlessBilling: Literal["Yes", "No"]
    PaymentMethod: Literal[
        "Electronic check",
        "Mailed check",
        "Bank transfer (automatic)",
        "Credit card (automatic)",
    ]

    # Numeric features
    tenure: int = Field(..., ge=0, description="Months with the company.")
    MonthlyCharges: float = Field(..., ge=0, description="Monthly charges ($).")
    TotalCharges: float = Field(..., ge=0, description="Total charges to date ($).")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/")
@app.get("/health")
def health():
    """Health check for load balancer / orchestrator probes."""

    return {
        "status": "ok",
        "model": MODEL_ID,
        "features": FEATURE_COUNT,
    }


@app.post("/predict")
def get_prediction(data: CustomerData):
    """Predict the churn label for a single customer."""

    try:
        result = predict_label(data.model_dump())
        return {"prediction": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
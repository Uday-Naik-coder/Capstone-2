# ML Service image: thin FastAPI wrapper over the pinned bundled model.
FROM python:3.11-slim

WORKDIR /app

# Install dependencies first for Docker layer caching.
COPY services/ml/requirements.txt ./services/ml/requirements.txt
RUN pip install --upgrade pip \
    && pip install -r services/ml/requirements.txt \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy the inference package (unchanged) and the service wrapper.
COPY src ./src
COPY services ./services

# Provide the bundled model at the flat /app/model convenience path that
# src.serving.inference.load_model() expects, so importing the inference
# module inside the container resolves to the pinned production model.
COPY src/serving/model/3b1a41221fc44548aed629fa42b762e0/artifacts/model /app/model
COPY src/serving/model/3b1a41221fc44548aed629fa42b762e0/artifacts/feature_columns.txt /app/model/feature_columns.txt
COPY src/serving/model/3b1a41221fc44548aed629fa42b762e0/artifacts/preprocessing.pkl /app/model/preprocessing.pkl

# Make both "services" and "src" importable; unbuffered logs for real-time output.
ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "services.ml.main:app", "--host", "0.0.0.0", "--port", "8000"]
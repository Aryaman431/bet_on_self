# Build with: docker build -f ml/Dockerfile -t grade-ml .
# (Run the build command from the repository root so the context includes requirements.txt, model files, etc.)
# If your checkpoint file is named differently (e.g. lstm_reg.pt), set MODEL_CKPT accordingly at runtime.

FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install minimal system deps (extend if you add SciPy stack needing build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements (full and minimal) and install
ARG REQ_FILE=requirements.inference.txt
COPY requirements.txt ./requirements.txt
COPY requirements.inference.txt ./requirements.inference.txt
RUN pip install --upgrade pip \
    && if [ -f "$REQ_FILE" ]; then echo "Using requirements file: $REQ_FILE"; pip install -r $REQ_FILE; else echo "Missing $REQ_FILE"; exit 1; fi

 # Copy application code (ml package)
COPY ml ./ml

# Build ARG allows selecting which checkpoint to bake (defaults to lstm_reg.pt if present)
ARG MODEL_FILE=lstm_reg.pt

# Copy the specified model file if it exists in build context (will fail build if missing)
COPY ${MODEL_FILE} /app/${MODEL_FILE}

# Set runtime env var to that baked checkpoint (can be overridden at deploy time)
ENV MODEL_CKPT=/app/${MODEL_FILE}

# Expose API port
EXPOSE 8000

# MODEL_CKPT now defaults to baked file; override with --env or containerapp update if needed.

# Set python path so `ml` is importable
ENV PYTHONPATH=/app

# Start FastAPI with Uvicorn
CMD ["uvicorn", "ml.serve:app", "--host", "0.0.0.0", "--port", "8000"]

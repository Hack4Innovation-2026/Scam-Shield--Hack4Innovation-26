# Scam Shield API
#   docker build -t scam-shield-api backend
#   docker run -p 8000:8000 --env-file backend/.env scam-shield-api
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8000

# Tesseract for screenshot OCR (English language data is included in the package)
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first so code changes don't invalidate this layer
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY main.py .
COPY app ./app
COPY models ./models

RUN useradd --create-home --uid 1000 appuser && chown -R appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", \"8000\")}/', timeout=3)" || exit 1

# WEB_CONCURRENCY: uvicorn worker processes (1 fits free-tier hosts with 512 MB RAM)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers ${WEB_CONCURRENCY:-1}"]

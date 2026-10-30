"""Runtime configuration, read once from environment variables (and an optional .env file)."""
import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")


def _csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


# Empty MONGO_URI disables persistence; the API works without a database.
MONGO_URI = os.getenv("MONGO_URI", "").strip()
MONGO_DB = os.getenv("MONGO_DB", "scam_detection_db")

CORS_ORIGINS = _csv(os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"))

MODELS_DIR = Path(os.getenv("MODELS_DIR", BACKEND_DIR / "models"))

# Optional explicit path to the tesseract binary (otherwise it is looked up on PATH).
TESSERACT_CMD = os.getenv("TESSERACT_CMD", "").strip()

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(5 * 1024 * 1024)))

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

"""Runtime configuration, read once from environment variables (and an optional .env file)."""
import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")


def _env(name: str, default: str = "") -> str:
    """Environment value, with blank values (as in a copied .env.example) treated as unset."""
    value = os.getenv(name, "").strip()
    return value or default


def _csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


# Empty MONGO_URI disables persistence; the API works without a database.
MONGO_URI = _env("MONGO_URI")
MONGO_DB = _env("MONGO_DB", "scam_detection_db")

CORS_ORIGINS = _csv(_env("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"))

MODELS_DIR = Path(_env("MODELS_DIR", str(BACKEND_DIR / "models")))

# Optional explicit path to the tesseract binary (otherwise it is looked up on PATH).
TESSERACT_CMD = _env("TESSERACT_CMD")

MAX_UPLOAD_BYTES = int(_env("MAX_UPLOAD_BYTES", str(5 * 1024 * 1024)))

LOG_LEVEL = _env("LOG_LEVEL", "INFO").upper()

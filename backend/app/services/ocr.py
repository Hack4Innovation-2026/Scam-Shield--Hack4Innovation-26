"""Screenshot text extraction with Tesseract (via pytesseract)."""
import io
import shutil
from functools import lru_cache

import pytesseract
from PIL import Image, ImageOps, UnidentifiedImageError

from app import config

# Default install location used by the UB-Mannheim Windows installer.
_WINDOWS_DEFAULT = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


class InvalidImageError(ValueError):
    pass


@lru_cache(maxsize=1)
def _tesseract_cmd() -> str | None:
    for candidate in (config.TESSERACT_CMD, shutil.which("tesseract"), _WINDOWS_DEFAULT):
        if candidate and shutil.which(candidate):
            return candidate
    return None


def is_available() -> bool:
    return _tesseract_cmd() is not None


def load_image(data: bytes) -> Image.Image:
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
        return image
    except (UnidentifiedImageError, OSError) as e:
        raise InvalidImageError("File is not a readable image") from e


def extract_text(image: Image.Image) -> str:
    # Grayscale + upscale small screenshots: noticeably better Tesseract accuracy on phone UI text.
    image = ImageOps.exif_transpose(image).convert("L")
    if image.width < 1000:
        scale = 1000 / image.width
        image = image.resize((1000, int(image.height * scale)))

    pytesseract.pytesseract.tesseract_cmd = _tesseract_cmd()
    text = pytesseract.image_to_string(image, config="--psm 6")
    return " ".join(text.split())

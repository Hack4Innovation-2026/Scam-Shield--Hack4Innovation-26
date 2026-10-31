import logging

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.concurrency import run_in_threadpool

from app import config
from app.schemas.models import AnalysisResponse, ImageForensics
from app.services import image_forensics, ocr
from app.services.unified_analyzer import pipeline_analyze_input
from app.dependencies import get_optional_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/analyze/image", tags=["Image Analysis"])


@router.post("", response_model=AnalysisResponse)
@router.post("/", response_model=AnalysisResponse, include_in_schema=False)
async def analyze_image(file: UploadFile = File(...), user: dict | None = Depends(get_optional_user)):
    """
    Extracts text from a screenshot with Tesseract OCR and analyzes it like a message.
    Also returns heuristic tampering hints (Error Level Analysis for JPEGs, metadata checks).
    """
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=415, detail="Upload must be an image (PNG, JPEG, ...)")

    data = await file.read(config.MAX_UPLOAD_BYTES + 1)
    if len(data) > config.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"Image larger than {config.MAX_UPLOAD_BYTES} bytes")

    try:
        image = ocr.load_image(data)
    except ocr.InvalidImageError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not ocr.is_available():
        raise HTTPException(status_code=503,
                            detail="OCR unavailable: tesseract is not installed on the server (set TESSERACT_CMD)")

    try:
        extracted_text = await run_in_threadpool(ocr.extract_text, image)
    except Exception:
        logger.exception("OCR failed")
        raise HTTPException(status_code=500, detail="OCR failed")

    if len(extracted_text) < 3:
        raise HTTPException(status_code=422, detail="No readable text found in the image")

    # A failed tampering check must not cost the user their scam analysis.
    try:
        forensics = ImageForensics(**await run_in_threadpool(image_forensics.analyze, image))
    except Exception:
        logger.exception("Image forensics failed")
        forensics = None

    metadata = {"filename": file.filename, "content_type": file.content_type}
    if forensics:
        metadata["forensics"] = {"verdict": forensics.verdict, "method": forensics.method, "score": forensics.score,
                                 "flags": forensics.flags}
    try:
        response = await pipeline_analyze_input(
            text=extracted_text,
            source="image",
            metadata=metadata,
            user_id=user and user["id"],
        )
    except Exception:
        logger.exception("Image analysis failed")
        raise HTTPException(status_code=500, detail="Analysis failed")

    response.extracted_text = extracted_text
    response.forensics = forensics
    return response

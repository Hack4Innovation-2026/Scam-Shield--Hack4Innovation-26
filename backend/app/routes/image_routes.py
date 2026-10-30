import logging

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.concurrency import run_in_threadpool

from app import config
from app.schemas.models import AnalysisResponse
from app.services import ocr
from app.services.unified_analyzer import pipeline_analyze_input

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/analyze/image", tags=["Image Analysis"])


@router.post("", response_model=AnalysisResponse)
@router.post("/", response_model=AnalysisResponse, include_in_schema=False)
async def analyze_image(file: UploadFile = File(...)):
    """
    Extracts text from a screenshot with Tesseract OCR and analyzes it like a message.
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

    try:
        response = await pipeline_analyze_input(
            text=extracted_text,
            source="image",
            metadata={"filename": file.filename, "content_type": file.content_type},
        )
    except Exception:
        logger.exception("Image analysis failed")
        raise HTTPException(status_code=500, detail="Analysis failed")

    response.extracted_text = extracted_text
    return response

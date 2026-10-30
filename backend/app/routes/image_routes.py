from fastapi import APIRouter, UploadFile, File, HTTPException
from app.schemas.models import AnalysisResponse
from app.services.unified_analyzer import pipeline_analyze_input

router = APIRouter(prefix="/api/v1/analyze/image", tags=["Image Analysis"])

@router.post("/", response_model=AnalysisResponse)
async def analyze_image(file: UploadFile = File(...)):
    """
    Simulates extracting text from an image via OCR and analyzing it.
    """
    try:
        # MOCK OCR processing
        extracted_text = "SIMULATED OCR TEXT: Urgent: Your account has been compromised. Verify here: http://bit.ly/secure-acc"
        
        meta = {"filename": file.filename, "content_type": file.content_type}
        
        response = await pipeline_analyze_input(
            text=extracted_text,
            source="image",
            metadata=meta
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

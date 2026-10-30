from fastapi import APIRouter, HTTPException
from app.schemas.models import AnalysisRequest, AnalysisResponse
from app.services.unified_analyzer import pipeline_analyze_input

router = APIRouter(prefix="/api/v1/analyze", tags=["General Analysis"])

@router.post("/", response_model=AnalysisResponse)
async def analyze_text(request: AnalysisRequest):
    """
    Analyzes standard text inputs like SMS, notifications, or generic messages.
    """
    try:
        response = await pipeline_analyze_input(
            text=request.text,
            source=request.source,
            metadata=request.metadata or {}
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

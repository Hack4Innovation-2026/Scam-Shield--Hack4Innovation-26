import logging

from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_optional_user
from app.schemas.models import AnalysisRequest, AnalysisResponse
from app.services.unified_analyzer import pipeline_analyze_input

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/analyze", tags=["General Analysis"])


@router.post("", response_model=AnalysisResponse)
@router.post("/", response_model=AnalysisResponse, include_in_schema=False)
async def analyze_text(request: AnalysisRequest, user: dict | None = Depends(get_optional_user)):
    """
    Analyzes standard text inputs like SMS, WhatsApp/Telegram messages or notifications.
    """
    try:
        return await pipeline_analyze_input(
            text=request.text,
            source=request.source,
            metadata=request.metadata or {},
            user_id=user and user["id"],
        )
    except Exception:
        logger.exception("Text analysis failed")
        raise HTTPException(status_code=500, detail="Analysis failed")

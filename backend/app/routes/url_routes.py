import logging

from fastapi import APIRouter, HTTPException
from app.schemas.models import UrlAnalysisRequest, AnalysisResponse
from app.services.unified_analyzer import pipeline_analyze_input

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/analyze/url", tags=["URL Analysis"])


@router.post("", response_model=AnalysisResponse)
@router.post("/", response_model=AnalysisResponse, include_in_schema=False)
async def analyze_url(request: UrlAnalysisRequest):
    """
    Analyzes a single link: shorteners, suspicious TLDs, raw IPs, punycode and crafted domains.
    """
    try:
        return await pipeline_analyze_input(text=request.url, source="url", metadata={})
    except Exception:
        logger.exception("URL analysis failed")
        raise HTTPException(status_code=500, detail="Analysis failed")

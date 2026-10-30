import logging

from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_optional_user
from app.schemas.models import EmailAnalysisRequest, AnalysisResponse
from app.services.unified_analyzer import pipeline_analyze_input

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/analyze/email", tags=["Email Analysis"])


@router.post("", response_model=AnalysisResponse)
@router.post("/", response_model=AnalysisResponse, include_in_schema=False)
async def analyze_email(request: EmailAnalysisRequest, user: dict | None = Depends(get_optional_user)):
    """
    Analyzes email payload. Combines subject and body, and checks the sender's domain.
    """
    try:
        combined_text = f"Subject: {request.subject}\n\n{request.body}"

        meta = request.metadata or {}
        meta["sender_email"] = request.sender_email

        return await pipeline_analyze_input(
            text=combined_text,
            source="email",
            metadata=meta,
            user_id=user and user["id"],
        )
    except Exception:
        logger.exception("Email analysis failed")
        raise HTTPException(status_code=500, detail="Analysis failed")

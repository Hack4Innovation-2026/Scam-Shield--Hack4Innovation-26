from fastapi import APIRouter, HTTPException
from app.schemas.models import EmailAnalysisRequest, AnalysisResponse
from app.services.unified_analyzer import pipeline_analyze_input

router = APIRouter(prefix="/api/v1/analyze/email", tags=["Email Analysis"])

@router.post("/", response_model=AnalysisResponse)
async def analyze_email(request: EmailAnalysisRequest):
    """
    Analyzes email payload. Combines subject and body, and checks sender trust.
    """
    try:
        # Combine subject and body for analysis
        combined_text = f"Subject: {request.subject}\n\n{request.body}"
        
        # Enrich metadata
        meta = request.metadata or {}
        meta["sender_email"] = request.sender_email
        
        response = await pipeline_analyze_input(
            text=combined_text,
            source="email",
            metadata=meta
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

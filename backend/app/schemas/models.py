from pydantic import BaseModel, HttpUrl
from typing import Optional, List, Dict, Any

class AnalysisRequest(BaseModel):
    text: str
    source: str  # e.g., 'sms', 'email', 'notifications', 'image'
    metadata: Optional[Dict[str, Any]] = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "text": "Urgent! Click here to verify your account.",
                "source": "sms",
                "metadata": {}
            }
        }
    }

class EmailAnalysisRequest(BaseModel):
    subject: str
    body: str
    sender_email: str
    metadata: Optional[Dict[str, Any]] = None

class ReportDetails(BaseModel):
    report_recommended: bool
    report_link: str
    report_summary: str

class AnalysisResponse(BaseModel):
    risk_score: int
    level: str
    scam_type: str
    intent: str
    confidence: str
    reason: str
    advice: str
    action: str
    urls: List[str]
    url_flags: List[str]
    source: str
    report: ReportDetails

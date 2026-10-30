from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any

MAX_TEXT_LENGTH = 20_000


class AnalysisRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TEXT_LENGTH)
    source: str = "sms"  # e.g. 'sms', 'whatsapp', 'notifications'
    metadata: Optional[Dict[str, Any]] = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "text": "Urgent! Your account is blocked. Verify at http://bit.ly/secure-acc",
                "source": "sms",
                "metadata": {}
            }
        }
    }


class EmailAnalysisRequest(BaseModel):
    subject: str = Field(default="", max_length=1_000)
    body: str = Field(max_length=MAX_TEXT_LENGTH)
    sender_email: str = Field(min_length=3, max_length=320)
    metadata: Optional[Dict[str, Any]] = None


class UrlAnalysisRequest(BaseModel):
    url: str = Field(min_length=4, max_length=2_048)

    @field_validator("url")
    @classmethod
    def must_look_like_url(cls, v: str) -> str:
        from app.services.url_analyzer import extract_urls
        v = v.strip()
        if " " in v or not extract_urls(v):
            raise ValueError("Not a valid URL")
        return v

    model_config = {"json_schema_extra": {"example": {"url": "http://sbi-kyc-update.xyz/login"}}}


class ReportDetails(BaseModel):
    report_recommended: bool
    report_link: str
    report_summary: str


class SignalScores(BaseModel):
    url: Optional[float] = None
    behavioral: Optional[float] = None
    ml: Optional[float] = None


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
    signals: SignalScores
    ml_category: Optional[str] = None
    extracted_text: Optional[str] = None


# ---------------------------------------------------------------- accounts
_EMAIL_RE = r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$"


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(max_length=254, pattern=_EMAIL_RE)
    # bcrypt uses at most 72 bytes of a password
    password: str = Field(min_length=8, max_length=72)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        return v

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return v.strip().lower()


class LoginRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=72)

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return v.strip().lower()


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    created_at: str


class AuthResponse(BaseModel):
    token: str
    user: UserOut

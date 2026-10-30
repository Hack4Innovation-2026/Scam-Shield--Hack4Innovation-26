import datetime

from app.schemas.models import AnalysisResponse, ReportDetails, SignalScores
from app.services.url_analyzer import get_url_risk, get_sender_risk
from app.services.behavioral_engine import analyze_intent
from app.services.ml_engine import get_ml_prediction
from app.services.risk_scorer import calculate_final_risk, generate_decision
from app.services.explanation_engine import generate_explanation
from app.services.advice_engine import generate_advice
from app.utils.preprocessing import process_and_mask_pii
from app.database.connection import store_analyzed_message


def _scam_type(risk_score: int, intent: str, urls: list, ml_category: str | None) -> str:
    if risk_score <= 39:
        return "none"
    if ml_category == "digital_arrest":
        return "digital_arrest"
    if "reward" in intent:
        return "lottery_prize"
    if urls:
        return "phishing"
    return "social_engineering"


async def pipeline_analyze_input(text: str, source: str, metadata: dict) -> AnalysisResponse:
    source = source.strip().lower() or "sms"
    is_bare_url = source == "url"

    # 1. Extract and evaluate URLs (and the sender domain for email)
    url_data = get_url_risk(text)
    url_flags = list(url_data["flags"])
    url_score = url_data["score"] if url_data["urls"] else None
    if metadata.get("sender_email"):
        sender = get_sender_risk(metadata["sender_email"])
        url_flags += sender["flags"]
        if sender["score"]:
            url_score = max(url_score or 0, sender["score"])

    # 2. Behavioural intent and 3. ML. Analysis runs on the raw text: the models never saw
    # masked placeholders, and masking digits breaks URLs. Masking is applied only for storage.
    intent_data = analyze_intent(text)
    if is_bare_url:
        ml_data = {"ml_category": None, "ml_risk_score": None}
        behavioral_score = None
    else:
        ml_data = get_ml_prediction(text, source)
        behavioral_score = intent_data["score"]

    # 4. Risk score and decision
    risk_info = calculate_final_risk(url_score=url_score, behavioral_score=behavioral_score,
                                     ml_score=ml_data["ml_risk_score"])
    risk_score = risk_info["final_score"]
    decision = generate_decision(risk_score, source)

    # 5. Explanation + advice
    explanation = generate_explanation(risk_score, url_data["urls"], intent_data["intent"], url_flags)
    advice = generate_advice(url_data["urls"], intent_data["intent"], text)

    response = AnalysisResponse(
        risk_score=risk_score,
        level=risk_info["level"],
        scam_type=_scam_type(risk_score, intent_data["intent"], url_data["urls"], ml_data["ml_category"]),
        intent=intent_data["intent"],
        confidence=risk_info["confidence"],
        reason=explanation,
        advice=advice,
        action=decision["action"],
        urls=url_data["urls"],
        url_flags=url_flags,
        source=source,
        report=ReportDetails(
            report_recommended=decision["report_recommended"],
            report_link=decision["report_link"],
            report_summary=decision["report_summary"]
        ),
        signals=SignalScores(url=url_score, behavioral=behavioral_score, ml=ml_data["ml_risk_score"]),
        ml_category=ml_data["ml_category"],
    )

    # 6. Store a PII-masked copy (no-op when MongoDB is not configured)
    log_data = response.model_dump()
    log_data["timestamp"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    log_data["metadata"] = {k: v for k, v in metadata.items() if k != "sender_email"}
    log_data["original_text_masked"] = process_and_mask_pii(text)
    await store_analyzed_message(log_data)

    return response

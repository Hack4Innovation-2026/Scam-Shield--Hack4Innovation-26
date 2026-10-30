import datetime
from app.schemas.models import AnalysisResponse, ReportDetails
from app.services.url_analyzer import get_url_risk
from app.services.behavioral_engine import analyze_intent
from app.services.ml_engine import get_ml_prediction
from app.services.risk_scorer import calculate_final_risk, generate_decision
from app.services.explanation_engine import generate_explanation
from app.services.advice_engine import generate_advice
from app.utils.preprocessing import process_and_mask_pii
from app.database.connection import store_analyzed_message
import asyncio

async def pipeline_analyze_input(text: str, source: str, metadata: dict) -> AnalysisResponse:
    # 1. Preprocess input (mask sensitive data)
    cleaned_text = process_and_mask_pii(text)
    
    # 2. Extract and evaluate URLs
    url_data = get_url_risk(cleaned_text)
    
    # 3. Analyze behavioral intent
    intent_data = analyze_intent(cleaned_text)
    
    # 4. Run ML model
    ml_data = get_ml_prediction(cleaned_text, source)
    
    # 5. Calculate risk score
    risk_info = calculate_final_risk(
        url_score=url_data["score"],
        behavioral_score=intent_data["score"],
        ml_score=ml_data["ml_risk_score"]
    )
    
    risk_score = risk_info["final_score"]
    
    # 6. Generate action decision
    decision = generate_decision(risk_score, source)
    
    # 7. Generate explanation + advice
    explanation = generate_explanation(risk_score, url_data["urls"], intent_data["intent"], url_data["flags"])
    advice = generate_advice(url_data["urls"], intent_data["intent"], cleaned_text)

    # 8. Define Scam Type conceptually
    scam_type = "phishing" if url_data["urls"] else "social_engineering"
    if risk_score <= 39:
        scam_type = "none"

    response = AnalysisResponse(
        risk_score=risk_score,
        level=risk_info["level"],
        scam_type=scam_type,
        intent=intent_data["intent"],
        confidence=risk_info["confidence"],
        reason=explanation,
        advice=advice,
        action=decision["action"],
        urls=url_data["urls"],
        url_flags=url_data["flags"],
        source=source,
        report=ReportDetails(
            report_recommended=decision["report_recommended"],
            report_link=decision["report_link"],
            report_summary=decision["report_summary"]
        )
    )
    
    # 9. Store analyzed message in Database (Async)
    log_data = response.model_dump()
    log_data["timestamp"] = datetime.datetime.utcnow().isoformat()
    log_data["metadata"] = metadata
    log_data["original_text_masked"] = cleaned_text
    log_data["raw_scores"] = {
        "url_score": url_data["score"],
        "intent_score": intent_data["score"],
        "ml_score": ml_data["ml_risk_score"]
    }
    
    await store_analyzed_message(log_data)
    
    return response


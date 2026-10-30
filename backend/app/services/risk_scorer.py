def calculate_final_risk(url_score: float, behavioral_score: float, ml_score: float) -> dict:
    """
    Calculates final risk score using weighted average.
    url_score: 40%
    behavioral_score: 30%
    ml_score: 30%
    """
    final_score = (url_score * 0.40) + (behavioral_score * 0.30) + (ml_score * 0.30)
    final_score = int(min(final_score, 100))

    if final_score <= 39:
        level = "safe"
        confidence = "high" if final_score < 20 else "medium"
    elif final_score <= 69:
        level = "suspicious"
        confidence = "medium"
    else:
        level = "scam"
        confidence = "high"

    return {
        "final_score": final_score,
        "level": level,
        "confidence": confidence
    }

def generate_decision(risk_score: int, source: str) -> dict:
    alert = False
    action = "None"
    
    if risk_score >= 70:
        alert = True
        action = "Block sender"
    elif risk_score >= 40:
        alert = True
        action = "Alert user"

    report_recommended = risk_score >= 95
    report_link = "https://cybercrime.gov.in" if report_recommended else ""
    report_summary = ""

    if report_recommended:
        report_summary = f"This {source} appears to be a high-confidence phishing attempt using suspicious patterns. We recommend reporting to National Cyber Crime Reporting Portal."

    return {
        "alert": alert,
        "action": action,
        "report_recommended": report_recommended,
        "report_link": report_link,
        "report_summary": report_summary
    }

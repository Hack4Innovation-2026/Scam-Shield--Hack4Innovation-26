"""
Combines the three signals into one 0-100 risk score.

Each signal is 0-100 or None when it does not apply (no URL in the message; no text model for a bare
URL). The final score is a weighted average over the signals that apply, so a link-free "digital
arrest" SMS can still reach the scam band. When two or more signals independently look bad, a
corroboration bonus is added, because agreement between unrelated detectors is strong evidence.
"""

WEIGHTS = {"url": 0.35, "behavioral": 0.30, "ml": 0.35}

CORROBORATION_THRESHOLD = 50   # a signal "looks bad" at or above this
CORROBORATION_BONUS = 10

SAFE_MAX = 39                  # 0-39 safe, 40-69 suspicious, 70-100 scam
SUSPICIOUS_MAX = 69
REPORT_THRESHOLD = 85
REPORT_LINK = "https://cybercrime.gov.in"


def calculate_final_risk(url_score, behavioral_score, ml_score) -> dict:
    signals = {"url": url_score, "behavioral": behavioral_score, "ml": ml_score}
    present = {k: float(v) for k, v in signals.items() if v is not None}

    if not present:
        final = 0.0
    else:
        total_weight = sum(WEIGHTS[k] for k in present)
        final = sum(WEIGHTS[k] * v for k, v in present.items()) / total_weight
        if sum(v >= CORROBORATION_THRESHOLD for v in present.values()) >= 2:
            final += CORROBORATION_BONUS

    final_score = int(round(max(0.0, min(final, 100.0))))

    if final_score <= SAFE_MAX:
        level = "safe"
        confidence = "high" if final_score < 20 else "medium"
    elif final_score <= SUSPICIOUS_MAX:
        level = "suspicious"
        confidence = "medium"
    else:
        level = "scam"
        confidence = "high" if final_score >= 80 else "medium"

    return {
        "final_score": final_score,
        "level": level,
        "confidence": confidence
    }


def generate_decision(risk_score: int, source: str) -> dict:
    alert = False
    action = "None"

    if risk_score > SUSPICIOUS_MAX:
        alert = True
        action = "Block sender"
    elif risk_score > SAFE_MAX:
        alert = True
        action = "Alert user"

    report_recommended = risk_score >= REPORT_THRESHOLD
    report_link = REPORT_LINK if report_recommended else ""
    report_summary = ""

    if report_recommended:
        report_summary = (f"This {source} appears to be a high-confidence scam attempt. "
                          "We recommend reporting it to the National Cyber Crime Reporting Portal (1930).")

    return {
        "alert": alert,
        "action": action,
        "report_recommended": report_recommended,
        "report_link": report_link,
        "report_summary": report_summary
    }

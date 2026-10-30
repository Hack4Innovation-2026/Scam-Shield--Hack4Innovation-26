def generate_explanation(risk_score: int, urls: list, intent: str, url_flags: list) -> str:
    """Generates a human-readable explanation based on detected signals."""
    if risk_score <= 39:
        return "This message shows no significant signs of malicious intent or suspicious URLs."

    reasons = []
    
    if urls and url_flags:
        reasons.append("contains suspicious or uncommon URLs")
    elif urls and not url_flags:
        reasons.append("contains links that should be treated with caution")

    if intent != "neutral":
        if "urgency" in intent or "fear" in intent:
            reasons.append("uses pressure tactics (urgency/fear)")
        elif "reward" in intent:
            reasons.append("uses reward bait (lottery/prize)")
        elif "authority" in intent:
            reasons.append("attempts to impersonate authority figures")

    if not reasons:
        return "This message was flagged based on generic machine learning patterns."

    explanation = "This message " + " and ".join(reasons) + ", which is a common phishing tactic."
    return explanation.capitalize()

import re

PATTERNS = {
    "urgency": r"\b(act now|immediate action|urgent|soon|limited time|hurry|final notice|expires)\b",
    "fear": r"\b(police|blocked|suspended|compromised|arrest|fraud|illegal|fine|court|lawsuit)\b",
    "reward": r"\b(lottery|prize|winner|free|bonus|gift|cash prize|jackpot|claim|crypto|giveaway)\b",
    "authority": r"\b(bank|irs|tax|gov|government|support|security|officer|manager|official)\b"
}

def analyze_intent(text: str) -> dict:
    """Detects behavioral intent from text."""
    text_lower = text.lower()
    
    detected = {
        "urgency": [],
        "fear": [],
        "reward": [],
        "authority": []
    }
    
    for category, regex in PATTERNS.items():
        matches = re.finditer(regex, text_lower)
        detected[category] = list(set([match.group() for match in matches]))

    highest_intent = "neutral"
    max_count = 0
    intent_score = 0
    
    for category, terms in detected.items():
        if len(terms) > 0:
            if len(terms) > max_count or (len(terms) == max_count and category in ["urgency", "fear"]):
                highest_intent = category
                max_count = len(terms)

    # Score logic
    for category, terms in detected.items():
        if terms:
            if category == "fear":
                intent_score += len(terms) * 35
            elif category == "urgency":
                intent_score += len(terms) * 30
            elif category == "reward":
                intent_score += len(terms) * 35
            elif category == "authority":
                intent_score += len(terms) * 20

    final_score = min(intent_score, 100)
    
    # Check for combined suspicious patterns
    if (detected["urgency"] and detected["fear"]) or (detected["urgency"] and detected["reward"]):
        highest_intent = f"{highest_intent} / urgency" if highest_intent != "urgency" else highest_intent
        final_score = min(final_score + 20, 100)
    
    return {
        "intent": highest_intent,
        "score": final_score,
        "patterns_detected": {k: v for k, v in detected.items() if v}
    }

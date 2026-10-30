def generate_advice(urls: list, intent: str, text: str) -> str:
    """Generates actionable advice based on threat vector."""
    text_lower = text.lower()
    
    # Specific context checks
    if "otp" in text_lower or "code" in text_lower or "pin" in text_lower:
        return "Do not share OTP or PIN with anyone."
        
    if "fear" in intent or "urgency" in intent:
        if "bank" in text_lower or "account" in text_lower:
            return "Contact your bank directly using official numbers. Do not click provided links."
            
        if "police" in text_lower or "arrest" in text_lower:
            return "Verify with local authorities. Legitimate organizations do not demand immediate payment via phone/SMS."

    if "reward" in intent:
        return "Remember: If it's too good to be true, it probably is. Avoid paying fees to claim a prize."

    if urls:
        return "Do not click unknown links. Verify the sender's identity first."

    return "Stay vigilant and do not provide personal information to untrusted sources."

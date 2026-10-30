import re

def process_and_mask_pii(text: str) -> str:
    """
    Masks sensitive data such as OTPs, phone numbers, bank accounts, and emails.
    """
    if not text:
        return ""

    # Mask OTP (4-8 digit numbers often preceded by 'OTP', 'code', 'pin')
    # Simplified regex: 4 to 8 consecutive digits
    text = re.sub(r'\b\d{4,8}\b', '******', text)

    # Mask Email Addresses
    text = re.sub(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', '[EMAIL]', text)

    # Mask Phone Numbers (simple pattern matching 10-14 digits possibly with dashes or plus)
    text = re.sub(r'\+?\b\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b', '[PHONE]', text)

    # Note: Bank account masking can be complex, often mimicking long strings of digits (10-18 length)
    text = re.sub(r'\b\d{9,18}\b', '[ACCOUNT]', text)
    
    return text

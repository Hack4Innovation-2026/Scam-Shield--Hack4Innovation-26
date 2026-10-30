import re

from app.services.url_analyzer import URL_PATTERN

IPV4_PATTERN = re.compile(r'\b\d{1,3}(?:\.\d{1,3}){3}\b')


def _mask_segment(text: str) -> str:
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


def process_and_mask_pii(text: str) -> str:
    """
    Masks sensitive data such as OTPs, phone numbers, bank accounts, and emails.

    Links and IP addresses are kept intact: they are the evidence a stored scan is reviewed for,
    and the digit patterns above would otherwise mangle them (192.168.10.5 -> "[PHONE].5").
    """
    if not text:
        return ""

    protected = sorted(
        (m.span() for pattern in (URL_PATTERN, IPV4_PATTERN) for m in pattern.finditer(text)),
    )
    parts, pos = [], 0
    for start, end in protected:
        if start < pos:            # overlaps a span already kept (an IP inside a URL)
            continue
        parts.append(_mask_segment(text[pos:start]))
        parts.append(text[start:end])
        pos = end
    parts.append(_mask_segment(text[pos:]))
    return "".join(parts)

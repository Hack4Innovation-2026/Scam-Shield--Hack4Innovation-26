import re
from urllib.parse import urlparse

# Shortening services pattern
SHORTENER_DOMAINS = {
    'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'owl.li', 'is.gd', 'buff.ly', 
    'adf.ly', 'cutt.ly', 'lnkd.in'
}

UNCOMMON_TLDS = {
    '.xyz', '.top', '.club', '.online', '.site', '.click', '.pw', '.vip', 
    '.win', '.gq', '.ml', '.cf', '.tk'
}

def extract_urls(text: str) -> list:
    """Extracts all URLs from the text using a generic regex."""
    url_pattern = re.compile(
        r'(?:(?:https?|ftp):\/\/)?[\w/\-?=%.]+\.[\w/\-&?=%.]+'
    )
    urls = url_pattern.findall(text)
    # clean trailing punctuation
    return [u.rstrip('.,;!?') for u in urls if u.strip()]

def get_url_risk(text: str) -> dict:
    """
    Analyzes URLs in text and returns risk score and flags.
    Risk score: 0 to 100.
    """
    urls = extract_urls(text)
    if not urls:
        return {"score": 0, "urls": [], "flags": []}

    flags = []
    base_score = 0
    
    for u in urls:
        # Prepend http to handle parsing easily if scheme is missing
        if not u.startswith(('http://', 'https://')):
            u_parsed = urlparse('http://' + u)
        else:
            u_parsed = urlparse(u)
            
        domain = u_parsed.netloc.lower()
        if not domain:
            continue
            
        # Check shortened links
        if any(sd in domain for sd in SHORTENER_DOMAINS):
            flags.append(f"Shortened URL detected: {domain}")
            base_score += 60
            
        # Check uncommon TLD
        if any(domain.endswith(tld) for tld in UNCOMMON_TLDS):
            flags.append(f"Uncommon/suspicious TLD: {domain}")
            base_score += 80
            
        # Check suspicious patterns (raw IPs, multiple hyphens)
        if re.match(r'^\d{1,3}(\.\d{1,3}){3}$', domain):
            flags.append(f"IP address domain: {domain}")
            base_score += 90
            
        if domain.count('-') > 2:
            flags.append(f"Suspiciously crafted domain: {domain}")
            base_score += 50

    # Ensure max cap is 100
    risk_score = min(base_score, 100)
    
    # If URLs are present but no bad flags, give slight base risk
    if risk_score == 0 and urls:
        risk_score = 10
        
    return {
        "score": risk_score,
        "urls": urls,
        "flags": list(set(flags))
    }

import re
from urllib.parse import urlparse

# Shortening services pattern
SHORTENER_DOMAINS = {
    'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly', 'owl.li', 'is.gd', 'buff.ly',
    'adf.ly', 'cutt.ly', 'lnkd.in', 'rb.gy', 'shorturl.at', 'tiny.cc'
}

UNCOMMON_TLDS = {
    '.xyz', '.top', '.club', '.online', '.site', '.click', '.pw', '.vip',
    '.win', '.gq', '.ml', '.cf', '.tk', '.buzz', '.rest', '.icu'
}

# Words that phishing domains use to look official ("sbi-kyc-update", "paypal-secure-verify")
LURE_WORDS = ('login', 'verify', 'secure', 'update', 'kyc', 'account', 'wallet', 'support', 'reward', 'claim')

# scheme://..., www...., or bare domain.tld[/path]. TLD must be 2+ letters, so "Rs.500", "e.g." and
# "3.5" are not URLs. The lookbehind skips the domain part of email addresses.
URL_PATTERN = re.compile(
    r'(?<![@\w.-])'
    r'(?:(?:https?|ftp)://[^\s<>"\']+'
    r'|www\.[^\s<>"\']+'
    r'|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,24}(?![\w@-])(?:/[^\s<>"\']*)?)',
    re.IGNORECASE,
)


def extract_urls(text: str) -> list:
    """Extracts all URLs from the text."""
    urls = []
    for u in URL_PATTERN.findall(text):
        u = u.rstrip('.,;:!?)]}\'"')
        explicit = '://' in u or u.lower().startswith('www.')
        host = u.split('/')[0]
        # In bare matches, single-letter labels ("U.S", "e.g") are abbreviations, not domains.
        if explicit or all(len(label) > 1 for label in host.split('.')[-2:]):
            urls.append(u)
    return urls


def _domain_of(url: str) -> str:
    parsed = urlparse(url if url.startswith(('http://', 'https://', 'ftp://')) else 'http://' + url)
    return (parsed.hostname or '').lower()


def domain_flags(domain: str) -> tuple[int, list]:
    """Heuristic risk for one domain. Returns (score, flags)."""
    score, flags = 0, []

    if any(domain == sd or domain.endswith('.' + sd) for sd in SHORTENER_DOMAINS):
        flags.append(f"Shortened URL detected: {domain}")
        score += 60

    if any(domain.endswith(tld) for tld in UNCOMMON_TLDS):
        flags.append(f"Uncommon/suspicious TLD: {domain}")
        score += 80

    if re.fullmatch(r'\d{1,3}(\.\d{1,3}){3}', domain):
        flags.append(f"IP address domain: {domain}")
        score += 90

    if domain.count('-') > 2:
        flags.append(f"Suspiciously crafted domain: {domain}")
        score += 50

    if 'xn--' in domain:
        flags.append(f"Punycode (look-alike characters) domain: {domain}")
        score += 70

    lures = [w for w in LURE_WORDS if w in domain]
    if len(lures) >= 2:
        flags.append(f"Domain stuffed with lure words ({', '.join(lures)}): {domain}")
        score += 40

    return score, flags


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
        domain = _domain_of(u)
        if not domain:
            continue
        score, url_flags = domain_flags(domain)
        if '@' in u.split('://')[-1].split('/')[0]:
            url_flags.append(f"Credentials/redirect trick ('@') in URL: {u}")
            score += 60
        base_score += score
        flags.extend(url_flags)

    # Ensure max cap is 100
    risk_score = min(base_score, 100)

    # If URLs are present but no bad flags, give slight base risk
    if risk_score == 0:
        risk_score = 10

    return {
        "score": risk_score,
        "urls": urls,
        "flags": list(dict.fromkeys(flags))
    }


def get_sender_risk(sender_email: str) -> dict:
    """Applies the same domain heuristics to an email sender's domain."""
    domain = sender_email.rsplit('@', 1)[-1].strip().lower() if '@' in sender_email else ''
    if not domain:
        return {"score": 0, "flags": []}
    score, flags = domain_flags(domain)
    return {"score": min(score, 100), "flags": [f"Sender domain - {f}" for f in flags]}

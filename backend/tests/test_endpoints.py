import io
import shutil

import pytest
from PIL import Image, ImageDraw, ImageFont

from app.services import ocr
from conftest import BENIGN_SMS, BENIGN_SMS_2, DIGITAL_ARREST_SMS, KYC_SMS, LOTTERY_SMS

RESPONSE_KEYS = {
    "risk_score", "level", "scam_type", "intent", "confidence", "reason", "advice",
    "action", "urls", "url_flags", "source", "report",
}


def _sms(client, text, source="sms", path="/api/v1/analyze"):
    return client.post(path, json={"text": text, "source": source})


# ---------------------------------------------------------------- health
def test_health(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["models_loaded"] is True


def test_docs_page_loads(client):
    assert client.get("/docs").status_code == 200


# ---------------------------------------------------------------- SMS / text
def test_sms_response_schema(client):
    r = _sms(client, BENIGN_SMS)
    assert r.status_code == 200
    body = r.json()
    assert RESPONSE_KEYS <= body.keys()
    assert 0 <= body["risk_score"] <= 100
    assert body["level"] in {"safe", "suspicious", "scam"}


@pytest.mark.parametrize("path", ["/api/v1/analyze", "/api/v1/analyze/"])
def test_sms_path_with_and_without_trailing_slash(client, path):
    r = client.post(path, json={"text": BENIGN_SMS, "source": "sms"}, follow_redirects=False)
    assert r.status_code == 200


@pytest.mark.parametrize("text", [DIGITAL_ARREST_SMS, LOTTERY_SMS, KYC_SMS])
def test_sms_scams_are_flagged_as_scam(client, text):
    body = _sms(client, text).json()
    assert body["level"] == "scam", body
    assert body["risk_score"] >= 70


def test_digital_arrest_without_link_can_reach_scam(client):
    # Regression: with a fixed 40% URL weight, link-free messages were capped at 60.
    body = _sms(client, DIGITAL_ARREST_SMS).json()
    assert body["urls"] == []
    assert body["scam_type"] == "digital_arrest"


@pytest.mark.parametrize("text", [BENIGN_SMS, BENIGN_SMS_2])
def test_benign_sms_is_safe(client, text):
    body = _sms(client, text).json()
    assert body["level"] == "safe", body
    assert body["action"] == "None"


def test_frontend_source_labels_are_accepted(client):
    # The app sends display names such as "WhatsApp"; they should use the SMS model.
    assert _sms(client, LOTTERY_SMS, source="WhatsApp").json()["level"] == "scam"


def test_notifications_source_is_deterministic(client):
    scores = {_sms(client, BENIGN_SMS, source="notifications").json()["risk_score"] for _ in range(5)}
    assert len(scores) == 1


@pytest.mark.parametrize("payload", [{}, {"text": "", "source": "sms"}, {"source": "sms"}])
def test_sms_invalid_payload_is_422(client, payload):
    assert client.post("/api/v1/analyze", json=payload).status_code == 422


# ---------------------------------------------------------------- Email
def _email(client, subject, body, sender):
    return client.post("/api/v1/analyze/email",
                       json={"subject": subject, "body": body, "sender_email": sender})


def test_phishing_email_is_not_safe(client):
    r = _email(
        client, "Account suspended",
        "Dear customer, your PayPal account has been suspended due to unauthorized access. "
        "Verify your identity immediately at http://paypal-secure-verify.xyz/login or your account will be closed.",
        "support@paypal-secure-verify.xyz",
    )
    assert r.status_code == 200
    assert r.json()["level"] == "scam"


def test_suspicious_sender_domain_is_flagged(client):
    body = _email(client, "Hello", "Please see the update.", "admin@secure-login-verify-account.top").json()
    assert any("sender" in f.lower() for f in body["url_flags"])


def test_benign_email_is_safe(client):
    body = _email(
        client, "Meeting notes",
        "Hi team, attached are the notes from today's meeting. Please review the action items "
        "and let me know if I missed anything. Thanks, Priya",
        "priya@company.com",
    ).json()
    assert body["level"] == "safe", body


def test_email_missing_sender_is_422(client):
    r = client.post("/api/v1/analyze/email", json={"subject": "x", "body": "y"})
    assert r.status_code == 422


# ---------------------------------------------------------------- URL
def _url(client, url):
    return client.post("/api/v1/analyze/url", json={"url": url})


def test_url_endpoint_exists_and_returns_schema(client):
    r = _url(client, "https://www.google.com")
    assert r.status_code == 200
    assert RESPONSE_KEYS <= r.json().keys()
    assert r.json()["source"] == "url"


def test_legit_url_is_safe(client):
    assert _url(client, "https://www.google.com/search?q=weather").json()["level"] == "safe"


@pytest.mark.parametrize("url,flag", [
    ("http://bit.ly/3xYz", "Shortened"),
    ("http://192.168.10.5/login", "IP address"),
    ("http://sbi-kyc-update-now.xyz", "TLD"),
])
def test_risky_urls_are_flagged(client, url, flag):
    body = _url(client, url).json()
    assert body["level"] in {"suspicious", "scam"}, body
    assert any(flag in f for f in body["url_flags"]), body["url_flags"]


def test_url_invalid_is_422(client):
    assert _url(client, "").status_code == 422
    assert _url(client, "not a url at all").status_code == 422


# ---------------------------------------------------------------- Image
def _png_with_text(text: str) -> bytes:
    img = Image.new("RGB", (1400, 260), "white")
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 40)
    except OSError:
        font = ImageFont.load_default(size=40)
    y = 20
    for line in text.split("\n"):
        draw.text((20, y), line, fill="black", font=font)
        y += 60
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _image(client, data, name="shot.png", ctype="image/png"):
    return client.post("/api/v1/analyze/image", files={"file": (name, data, ctype)})


requires_tesseract = pytest.mark.skipif(not ocr.is_available(), reason="tesseract binary not installed")


@requires_tesseract
def test_image_ocr_scam_screenshot(client):
    png = _png_with_text("URGENT: Your account is blocked.\nVerify immediately at http://bit.ly/secure-acc\nor face police action.")
    r = _image(client, png)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "bit.ly" in body["extracted_text"].lower()
    assert body["level"] in {"suspicious", "scam"}


@requires_tesseract
def test_image_result_depends_on_image_content(client):
    # Regression: OCR used to be a hard-coded sentence, so every image scored the same.
    safe = _image(client, _png_with_text("See you at lunch tomorrow, bring the notes.")).json()
    assert safe["level"] == "safe", safe


@requires_tesseract
def test_image_without_text_is_422(client):
    blank = io.BytesIO()
    Image.new("RGB", (200, 200), "white").save(blank, format="PNG")
    assert _image(client, blank.getvalue()).status_code == 422


def test_image_rejects_non_image(client):
    assert _image(client, b"hello", name="a.txt", ctype="text/plain").status_code == 415


def test_image_rejects_corrupt_image(client):
    assert _image(client, b"not really a png").status_code in {400, 415}


def test_image_rejects_oversized_upload(client, monkeypatch):
    from app import config
    monkeypatch.setattr(config, "MAX_UPLOAD_BYTES", 10)
    assert _image(client, _png_with_text("x")).status_code == 413


def test_image_returns_503_when_tesseract_missing(client, monkeypatch):
    monkeypatch.setattr(ocr, "is_available", lambda: False)
    r = _image(client, _png_with_text("hello"))
    assert r.status_code == 503
    assert "tesseract" in r.json()["detail"].lower()

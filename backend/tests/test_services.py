"""Unit tests for the individual analysis engines (no HTTP)."""
import pytest

from app.services import ml_engine
from app.services.behavioral_engine import analyze_intent
from app.services.risk_scorer import calculate_final_risk
from app.services.url_analyzer import extract_urls, get_url_risk
from app.utils.preprocessing import process_and_mask_pii
from conftest import BENIGN_SMS, DIGITAL_ARREST_SMS


@pytest.fixture(scope="module", autouse=True)
def _models():
    ml_engine.load_models()


# ---------------------------------------------------------------- ML engine
def test_sms_scam_probability_includes_digital_arrest_class():
    # Regression for reading probs[1] (= general_spam) as the scam probability.
    result = ml_engine.get_ml_prediction(DIGITAL_ARREST_SMS, "sms")
    assert result["ml_risk_score"] > 50
    assert result["ml_category"] == "digital_arrest"
    assert result["ml_prediction"] == "scam"


def test_ml_score_is_pure_model_output():
    # No keyword boosts: the score equals 100 * (1 - P(safe)).
    model = ml_engine._cache["sms_model"]
    vec = ml_engine._cache["sms_vectorizer"]
    probs = dict(zip(model.classes_, model.predict_proba(vec.transform([BENIGN_SMS]))[0]))
    expected = round((1 - probs["safe"]) * 100, 2)
    assert ml_engine.get_ml_prediction(BENIGN_SMS, "sms")["ml_risk_score"] == expected


def test_email_model_uses_training_preprocessing():
    # The email model was trained on stemmed, stop-word-free text; the engine must feed it the same.
    text = "Subject: Meeting notes\n\nHi team, attached are the notes from today's meeting."
    cleaned = ml_engine.clean_email_text(text)
    assert cleaned == "subject meet note hi team attach note today meet"
    model, vec = ml_engine._cache["email_model"], ml_engine._cache["email_vectorizer"]
    expected = round(model.predict_proba(vec.transform([cleaned]))[0][1] * 100, 2)
    assert ml_engine.get_ml_prediction(text, "email")["ml_risk_score"] == expected


# ---------------------------------------------------------------- URL analyzer
@pytest.mark.parametrize("text", ["Pay Rs.500 today", "e.g. tomorrow", "version 3.5 is out", "U.S. office"])
def test_extract_urls_ignores_non_urls(text):
    assert extract_urls(text) == []


def test_extract_urls_finds_bare_and_schemed_urls():
    urls = extract_urls("Go to http://bit.ly/abc or www.example.com/path, then sbi-kyc.xyz.")
    assert urls == ["http://bit.ly/abc", "www.example.com/path", "sbi-kyc.xyz"]


def test_extract_urls_ignores_email_addresses():
    assert extract_urls("Mail me at someone@example.com") == []


def test_shortener_match_is_exact_domain():
    # "microsoft.com" contains the substring "t.co" and was flagged as a shortener.
    assert not any("Shortened" in f for f in get_url_risk("https://microsoft.com")["flags"])
    assert any("Shortened" in f for f in get_url_risk("https://t.co/abc")["flags"])


def test_url_risk_capped_at_100():
    assert get_url_risk("http://1.2.3.4 http://bit.ly/a http://a-b-c-d.xyz")["score"] == 100


# ---------------------------------------------------------------- behavioural
def test_behavioral_detects_fear_and_urgency():
    result = analyze_intent(DIGITAL_ARREST_SMS)
    assert "fear" in result["patterns_detected"]
    assert "urgency" in result["patterns_detected"]
    assert result["score"] >= 70


def test_behavioral_neutral_message():
    assert analyze_intent(BENIGN_SMS)["score"] == 0


# ---------------------------------------------------------------- risk scorer
def test_scorer_ignores_missing_url_signal():
    # Without URLs, behaviour + ML alone must be able to reach the scam band.
    result = calculate_final_risk(url_score=None, behavioral_score=100, ml_score=80)
    assert result["level"] == "scam"


def test_scorer_bounds_and_levels():
    assert calculate_final_risk(0, 0, 0)["level"] == "safe"
    assert calculate_final_risk(100, 100, 100)["final_score"] == 100


def test_scorer_url_only():
    assert calculate_final_risk(url_score=90, behavioral_score=None, ml_score=None)["final_score"] == 90


# ---------------------------------------------------------------- preprocessing
def test_pii_masking():
    masked = process_and_mask_pii("OTP 482913, mail a.b@x.com, call 9876543210")
    assert "482913" not in masked
    assert "a.b@x.com" not in masked
    assert "9876543210" not in masked


# ---------------------------------------------------------------- advice
def test_advice_handles_combined_intents():
    # Combined intents look like "fear / urgency"; they used to fall through to generic advice.
    from app.services.advice_engine import generate_advice
    advice = generate_advice([], "fear / urgency", DIGITAL_ARREST_SMS)
    assert "authorities" in advice.lower()


@pytest.mark.parametrize("text", [
    "Login at http://192.168.10.5/login now",
    "Server 10.0.0.12 is down",
    "Track at https://track.example.com/order/123456789 today",
])
def test_pii_masking_leaves_links_and_ips_intact(text):
    # Regression: the phone pattern turned 192.168.10.5 into "[PHONE].5" in stored records.
    assert process_and_mask_pii(text) == text


def test_pii_masking_still_masks_numbers_next_to_links():
    masked = process_and_mask_pii("Call 9876543210 or visit http://bit.ly/x, OTP 482913")
    assert "http://bit.ly/x" in masked
    assert "9876543210" not in masked and "482913" not in masked

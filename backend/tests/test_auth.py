"""Accounts: password hashing, tokens, and the register/login/history flow."""
import datetime

import jwt
import pytest

from app import config
from app.services import auth
from conftest import BENIGN_SMS, DIGITAL_ARREST_SMS, requires_mongo


# ---------------------------------------------------------------- unit: hashing and tokens
def test_password_hash_roundtrip():
    h = auth.hash_password("correct horse")
    assert h != "correct horse"
    assert auth.verify_password("correct horse", h)
    assert not auth.verify_password("wrong horse", h)


def test_verify_password_with_garbage_hash_is_false():
    assert not auth.verify_password("x", "not-a-bcrypt-hash")


def test_token_roundtrip():
    assert auth.decode_token(auth.create_token("abc123")) == "abc123"


@pytest.mark.parametrize("make_token", [
    lambda: jwt.encode({"sub": "u", "exp": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(seconds=1)},
                       config.JWT_SECRET, algorithm="HS256"),                                   # expired
    lambda: jwt.encode({"sub": "u", "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1)},
                       "some-other-secret-that-is-long-enough-1234", algorithm="HS256"),        # forged
    lambda: "not.a.token",
])
def test_invalid_tokens_are_rejected(make_token):
    with pytest.raises(auth.InvalidToken):
        auth.decode_token(make_token())


# ---------------------------------------------------------------- without a database
def test_accounts_unavailable_without_database(client):
    r = client.post("/api/v1/auth/register", json={"name": "A", "email": "a@b.co", "password": "password1"})
    assert r.status_code == 503
    assert client.post("/api/v1/auth/login", json={"email": "a@b.co", "password": "password1"}).status_code == 503
    assert client.get("/api/v1/history").status_code == 503


@pytest.mark.parametrize("payload", [
    {"name": "A", "email": "not-an-email", "password": "password1"},
    {"name": "A", "email": "a@b.co", "password": "short"},
    {"name": "   ", "email": "a@b.co", "password": "password1"},
    {"name": "A", "email": "a@b.co", "password": "x" * 73},
])
def test_register_validation(payload):
    from pydantic import ValidationError
    from app.schemas.models import RegisterRequest
    with pytest.raises(ValidationError):
        RegisterRequest(**payload)


# ---------------------------------------------------------------- live database
def _register(c, email="priya@example.com", password="s3cure-pass", name="Priya"):
    return c.post("/api/v1/auth/register", json={"name": name, "email": email, "password": password})


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@requires_mongo
def test_register_login_and_me(mongo_client):
    r = _register(mongo_client, email="Priya@Example.com")
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["user"]["email"] == "priya@example.com"          # normalised
    assert "password" not in str(body) and "hash" not in str(body)

    assert _register(mongo_client).status_code == 409                # duplicate email

    bad = mongo_client.post("/api/v1/auth/login", json={"email": "priya@example.com", "password": "wrong-pass"})
    unknown = mongo_client.post("/api/v1/auth/login", json={"email": "nobody@example.com", "password": "wrong-pass"})
    assert bad.status_code == unknown.status_code == 401
    assert bad.json()["detail"] == unknown.json()["detail"]          # no account enumeration

    ok = mongo_client.post("/api/v1/auth/login", json={"email": "PRIYA@example.com", "password": "s3cure-pass"})
    assert ok.status_code == 200
    me = mongo_client.get("/api/v1/auth/me", headers=_auth(ok.json()["token"]))
    assert me.status_code == 200 and me.json()["name"] == "Priya"


@requires_mongo
def test_history_is_per_user(mongo_client):
    a = _register(mongo_client, email="a@example.com").json()["token"]
    b = _register(mongo_client, email="b@example.com").json()["token"]

    mongo_client.post("/api/v1/analyze", json={"text": DIGITAL_ARREST_SMS, "source": "sms"}, headers=_auth(a))
    mongo_client.post("/api/v1/analyze/url", json={"url": "http://bit.ly/x"}, headers=_auth(a))
    mongo_client.post("/api/v1/analyze", json={"text": BENIGN_SMS, "source": "sms"}, headers=_auth(b))
    mongo_client.post("/api/v1/analyze", json={"text": BENIGN_SMS, "source": "sms"})          # guest

    hist_a = mongo_client.get("/api/v1/history", headers=_auth(a)).json()
    hist_b = mongo_client.get("/api/v1/history", headers=_auth(b)).json()
    assert [h["source"] for h in hist_a] == ["url", "sms"]                                     # newest first
    assert hist_a[1]["scam_type"] == "digital_arrest"
    assert len(hist_b) == 1 and hist_b[0]["level"] == "safe"
    assert "original_text_masked" not in hist_a[0]
    assert hist_a[0]["timestamp"].endswith("+00:00")                    # explicit UTC for clients


@requires_mongo
def test_metadata_cannot_spoof_another_user(mongo_client):
    victim = _register(mongo_client, email="victim@example.com")
    victim_id, victim_token = victim.json()["user"]["id"], victim.json()["token"]
    mongo_client.post("/api/v1/analyze", json={"text": BENIGN_SMS, "source": "sms", "metadata": {"user_id": victim_id}})
    assert mongo_client.get("/api/v1/history", headers=_auth(victim_token)).json() == []


@requires_mongo
def test_invalid_token_is_401_not_silent_guest(mongo_client):
    r = mongo_client.post("/api/v1/analyze", json={"text": BENIGN_SMS, "source": "sms"}, headers=_auth("garbage"))
    assert r.status_code == 401
    assert mongo_client.get("/api/v1/history").status_code == 401


@requires_mongo
def test_background_scans_are_flagged_in_history(mongo_client):
    token = _register(mongo_client, email="bg@example.com").json()["token"]
    mongo_client.post("/api/v1/analyze", headers=_auth(token), json={
        "text": DIGITAL_ARREST_SMS, "source": "sms",
        "metadata": {"channel": "background", "app": "SMS from VM-SBIBNK"}})
    mongo_client.post("/api/v1/analyze", headers=_auth(token), json={"text": BENIGN_SMS, "source": "sms"})
    manual, background = mongo_client.get("/api/v1/history", headers=_auth(token)).json()
    assert background["background"] is True and background["app"] == "SMS from VM-SBIBNK"
    assert "background" not in manual

"""Persistence tests. The live-database tests run only when MONGO_URI points at a reachable MongoDB."""
import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app import config
from app.database import connection
from conftest import DIGITAL_ARREST_SMS


def test_stats_unavailable_without_database(client, monkeypatch):
    monkeypatch.setattr(connection, "db", None)
    r = client.get("/api/v1/stats")
    assert r.status_code == 503
    assert "MONGO_URI" in r.json()["detail"]


def test_health_reports_database_status(client):
    assert "database" in client.get("/").json()


requires_mongo = pytest.mark.skipif(not os.getenv("TEST_MONGO_URI"), reason="TEST_MONGO_URI not set")


@pytest.fixture
def mongo_client(monkeypatch):
    # Separate throwaway database per test run so real data is never touched.
    monkeypatch.setattr(config, "MONGO_URI", os.environ["TEST_MONGO_URI"])
    monkeypatch.setattr(config, "MONGO_DB", f"scam_shield_test_{uuid.uuid4().hex[:8]}")
    import main
    with TestClient(main.app) as c:
        yield c
    from pymongo import MongoClient
    MongoClient(os.environ["TEST_MONGO_URI"]).drop_database(config.MONGO_DB)


@requires_mongo
def test_scan_is_persisted_masked_and_counted(mongo_client):
    assert mongo_client.get("/").json()["database"] is True
    mongo_client.post("/api/v1/analyze", json={"text": DIGITAL_ARREST_SMS + " Call 9876543210", "source": "sms"})
    mongo_client.post("/api/v1/analyze", json={"text": "See you at lunch tomorrow", "source": "sms"})

    from pymongo import MongoClient
    docs = list(MongoClient(os.environ["TEST_MONGO_URI"])[config.MONGO_DB].analyzed_messages.find())
    assert len(docs) == 2
    assert all("9876543210" not in d["original_text_masked"] for d in docs)   # PII masked
    assert all(d["timestamp"].year >= 2024 for d in docs)                     # stored as a date

    stats = mongo_client.get("/api/v1/stats?days=1").json()
    assert stats["total_scans"] == 2
    assert stats["by_level"].get("scam") == 1
    assert stats["top_scam_types"].get("digital_arrest") == 1

"""Persistence tests. The live-database tests run only when MONGO_URI points at a reachable MongoDB."""
import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app import config
from app.database import connection
from conftest import DIGITAL_ARREST_SMS, requires_mongo


def test_stats_unavailable_without_database(client, monkeypatch):
    monkeypatch.setattr(connection, "db", None)
    r = client.get("/api/v1/stats")
    assert r.status_code == 503
    assert "MONGO_URI" in r.json()["detail"]


def test_health_reports_database_status(client):
    assert "database" in client.get("/").json()


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


# ---------------------------------------------------------------- scan expiry (TTL index)
def _timestamp_index(db):
    return next(info for info in db.analyzed_messages.index_information().values()
                if info["key"] == [("timestamp", -1)])


def _ensure_expiry(days):
    """Run the startup index setup against the test database, in its own client and event loop."""
    import asyncio
    from pymongo import AsyncMongoClient

    async def run():
        client = AsyncMongoClient(os.environ["TEST_MONGO_URI"])
        try:
            return await connection.ensure_scan_expiry(client[config.MONGO_DB].analyzed_messages, days)
        finally:
            await client.close()
    return asyncio.run(run())


@pytest.fixture
def keep_scans_forever(monkeypatch):
    monkeypatch.setattr(config, "SCAN_RETENTION_DAYS", 0)


@requires_mongo
def test_startup_creates_ttl_index_on_scans_only(mongo_client):
    assert mongo_client.get("/").json()["database"] is True
    from pymongo import MongoClient
    db = MongoClient(os.environ["TEST_MONGO_URI"])[config.MONGO_DB]
    assert _timestamp_index(db)["expireAfterSeconds"] == config.SCAN_RETENTION_DAYS * 86400
    assert all("expireAfterSeconds" not in info for info in db.users.index_information().values())


@requires_mongo
def test_retention_zero_means_no_ttl(keep_scans_forever, mongo_client):
    from pymongo import MongoClient
    db = MongoClient(os.environ["TEST_MONGO_URI"])[config.MONGO_DB]
    assert "expireAfterSeconds" not in _timestamp_index(db)


@requires_mongo
def test_expiry_setup_is_idempotent_and_converts_old_index(mongo_client):
    from pymongo import MongoClient
    db = MongoClient(os.environ["TEST_MONGO_URI"])[config.MONGO_DB]
    mongo_client.post("/api/v1/analyze", json={"text": DIGITAL_ARREST_SMS, "source": "sms"})

    # The index as databases created before this feature have it: same key, no TTL.
    db.analyzed_messages.drop_index("timestamp_-1")
    db.analyzed_messages.create_index([("timestamp", -1)])

    assert _ensure_expiry(90) in ("converted with collMod", "dropped and recreated")
    assert _timestamp_index(db)["expireAfterSeconds"] == 90 * 86400
    assert _ensure_expiry(90) == "unchanged"                                  # second startup
    assert _ensure_expiry(30) != "failed"                                     # setting changed
    assert _timestamp_index(db)["expireAfterSeconds"] == 30 * 86400
    assert _ensure_expiry(0) == "dropped and recreated"                       # TTL removed
    assert "expireAfterSeconds" not in _timestamp_index(db)
    assert _ensure_expiry(0) == "unchanged"
    assert db.analyzed_messages.count_documents({}) == 1                      # no scans lost on the way

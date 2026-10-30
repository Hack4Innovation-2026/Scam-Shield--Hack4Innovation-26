import datetime
import logging

from pymongo import AsyncMongoClient

from app import config

logger = logging.getLogger(__name__)

client = None
db = None


async def connect_to_mongo():
    """Connect if MONGO_URI is set. Never blocks startup for long or crashes the API."""
    global client, db
    if not config.MONGO_URI:
        logger.info("MONGO_URI not set - analysis results will not be persisted")
        return
    try:
        client = AsyncMongoClient(config.MONGO_URI, serverSelectionTimeoutMS=2000)
        await client.admin.command("ping")
        db = client[config.MONGO_DB]
        # Indexes for the queries the stats endpoint runs (newest first, group by verdict).
        await db.analyzed_messages.create_index([("timestamp", -1)])
        await db.analyzed_messages.create_index([("level", 1), ("timestamp", -1)])
        logger.info("Connected to MongoDB database '%s'", config.MONGO_DB)
    except Exception as e:
        logger.warning("MongoDB unavailable (%s) - continuing without persistence", e)
        if client is not None:
            await client.close()
        client = None
        db = None


async def close_mongo_connection():
    global client, db
    if client is not None:
        await client.close()
        logger.info("Closed MongoDB connection")
    client = None
    db = None


def is_connected() -> bool:
    return db is not None


async def store_analyzed_message(data: dict):
    if db is None:
        return
    try:
        await db.analyzed_messages.insert_one(data)
    except Exception as e:
        logger.warning("Failed to store analyzed message: %s", e)


async def get_scan_stats(days: int) -> dict:
    """Aggregate stored scans from the last `days` days: totals by verdict, scam type and source."""
    since = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)
    pipeline = [
        {"$match": {"timestamp": {"$gte": since}}},
        {"$facet": {
            "total": [{"$count": "n"}],
            "by_level": [{"$group": {"_id": "$level", "n": {"$sum": 1}}}],
            "by_scam_type": [{"$match": {"scam_type": {"$ne": "none"}}},
                             {"$group": {"_id": "$scam_type", "n": {"$sum": 1}}},
                             {"$sort": {"n": -1}}],
            "by_source": [{"$group": {"_id": "$source", "n": {"$sum": 1}}}, {"$sort": {"n": -1}}],
            "avg_risk": [{"$group": {"_id": None, "v": {"$avg": "$risk_score"}}}],
        }},
    ]
    result = await (await db.analyzed_messages.aggregate(pipeline)).to_list(length=1)
    facets = result[0] if result else {}

    def counts(key):
        return {row["_id"]: row["n"] for row in facets.get(key, [])}

    total = facets.get("total", [{}])[0].get("n", 0) if facets.get("total") else 0
    avg = facets.get("avg_risk", [{}])[0].get("v") if facets.get("avg_risk") else None
    return {
        "days": days,
        "total_scans": total,
        "by_level": counts("by_level"),
        "top_scam_types": counts("by_scam_type"),
        "by_source": counts("by_source"),
        "average_risk_score": round(avg, 1) if avg is not None else None,
    }

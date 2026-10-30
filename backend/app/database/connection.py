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
        # Accounts: one user per email; each user's history newest first.
        await db.users.create_index("email", unique=True)
        await db.analyzed_messages.create_index([("user_id", 1), ("timestamp", -1)])
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


# ---------------------------------------------------------------- accounts
def _as_utc(ts: datetime.datetime) -> datetime.datetime:
    """MongoDB returns naive datetimes (stored in UTC). Mark them UTC so clients convert to local time."""
    return ts.replace(tzinfo=datetime.timezone.utc) if ts.tzinfo is None else ts


class EmailAlreadyRegistered(Exception):
    pass


def _public_user(doc: dict) -> dict:
    return {"id": str(doc["_id"]), "name": doc["name"], "email": doc["email"],
            "created_at": _as_utc(doc["created_at"]).isoformat()}


async def create_user(name: str, email: str, password_hash: str) -> dict:
    from pymongo.errors import DuplicateKeyError
    doc = {"name": name, "email": email, "password_hash": password_hash,
           "created_at": datetime.datetime.now(datetime.timezone.utc)}
    try:
        result = await db.users.insert_one(doc)
    except DuplicateKeyError as e:
        raise EmailAlreadyRegistered(email) from e
    doc["_id"] = result.inserted_id
    return _public_user(doc)


async def find_user_with_hash(email: str) -> tuple[dict, str] | None:
    doc = await db.users.find_one({"email": email})
    return (_public_user(doc), doc["password_hash"]) if doc else None


async def find_user_by_id(user_id: str) -> dict | None:
    from bson import ObjectId
    from bson.errors import InvalidId
    try:
        doc = await db.users.find_one({"_id": ObjectId(user_id)})
    except InvalidId:
        return None
    return _public_user(doc) if doc else None


async def get_user_history(user_id: str, limit: int) -> list[dict]:
    cursor = db.analyzed_messages.find(
        {"user_id": user_id},
        {"original_text_masked": 0, "metadata": 0, "user_id": 0},
    ).sort("timestamp", -1).limit(limit)
    items = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        doc["timestamp"] = _as_utc(doc["timestamp"]).isoformat()
        items.append(doc)
    return items

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


async def store_analyzed_message(data: dict):
    if db is None:
        return
    try:
        await db.analyzed_messages.insert_one(data)
    except Exception as e:
        logger.warning("Failed to store analyzed message: %s", e)

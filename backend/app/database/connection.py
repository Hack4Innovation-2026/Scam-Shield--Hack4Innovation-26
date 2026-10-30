from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = None
db = None

async def connect_to_mongo():
    global client, db
    client = AsyncIOMotorClient(MONGO_URI)
    db = client.scam_detection_db
    print("Connected to MongoDB")

async def close_mongo_connection():
    global client
    if client:
        client.close()
        print("Closed MongoDB connection")

async def store_analyzed_message(data: dict):
    if db is not None:
        try:
            await db.analyzed_messages.insert_one(data)
        except Exception as e:
            print(f"Failed to store message: {e}")

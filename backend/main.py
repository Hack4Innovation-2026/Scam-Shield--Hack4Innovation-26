from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.database.connection import connect_to_mongo, close_mongo_connection
from app.routes.analysis_routes import router as analysis_router
from app.routes.email_routes import router as email_router
from app.routes.image_routes import router as image_router
import os
import sys

# Ensure backend root is in PYTHON PATH to fix absolute imports implicitly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    await connect_to_mongo()
    yield
    # Shutdown actions
    await close_mongo_connection()

app = FastAPI(
    title="CyberGuard Scam Detection API",
    description="A production-grade scam detection backend prioritizing URL and behavioral intel.",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(analysis_router)
app.include_router(email_router)
app.include_router(image_router)

@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "message": "CyberGuard Scam Detection Engine is online."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

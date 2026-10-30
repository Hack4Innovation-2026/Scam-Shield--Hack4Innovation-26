import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.database.connection import connect_to_mongo, close_mongo_connection
from app.routes.analysis_routes import router as analysis_router
from app.routes.email_routes import router as email_router
from app.routes.image_routes import router as image_router
from app.routes.url_routes import router as url_router
from app.routes.stats_routes import router as stats_router
from app.routes.auth_routes import router as auth_router
from app.routes.history_routes import router as history_router
from app.database import connection
from app.services import ml_engine

logging.basicConfig(level=config.LOG_LEVEL, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load models up front so a missing file fails at startup, not on the first request.
    ml_engine.load_models()
    if config.JWT_SECRET_IS_EPHEMERAL:
        logging.getLogger(__name__).warning("JWT_SECRET not set - using a temporary key; users are signed out on every restart")
    await connect_to_mongo()
    yield
    await close_mongo_connection()


app = FastAPI(
    title="Scam Shield Detection API",
    description="Scam detection for SMS, email, URLs and screenshots: URL heuristics, behavioural "
                "patterns and ML text classifiers combined into one risk score.",
    version="1.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],  # Authorization header allowed via allow_headers
    allow_headers=["*"],
)

app.include_router(analysis_router)
app.include_router(email_router)
app.include_router(image_router)
app.include_router(url_router)
app.include_router(stats_router)
app.include_router(auth_router)
app.include_router(history_router)


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "models_loaded": ml_engine.models_loaded(), "database": connection.is_connected()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

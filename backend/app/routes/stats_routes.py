import logging

from fastapi import APIRouter, HTTPException, Query

from app.database import connection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/stats", tags=["Statistics"])


@router.get("")
@router.get("/", include_in_schema=False)
async def scan_statistics(days: int = Query(30, ge=1, le=365, description="Look-back window in days")):
    """
    Aggregated statistics over all scans stored in MongoDB: totals by verdict, most common scam
    types and input channels. Requires MONGO_URI; returns 503 when persistence is disabled.
    """
    if not connection.is_connected():
        raise HTTPException(status_code=503, detail="Statistics unavailable: MongoDB is not configured (set MONGO_URI)")
    try:
        return await connection.get_scan_stats(days)
    except Exception:
        logger.exception("Stats query failed")
        raise HTTPException(status_code=500, detail="Stats query failed")

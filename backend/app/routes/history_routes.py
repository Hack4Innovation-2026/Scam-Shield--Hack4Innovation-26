from fastapi import APIRouter, Depends, Query

from app.database import connection
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/history", tags=["Accounts"])


@router.get("")
@router.get("/", include_in_schema=False)
async def scan_history(limit: int = Query(100, ge=1, le=500), user: dict = Depends(get_current_user)):
    """The signed-in user's scans, newest first. Scans are saved automatically when an
    analyze request carries the user's token."""
    return await connection.get_user_history(user["id"], limit)


@router.delete("")
@router.delete("/", include_in_schema=False)
async def delete_history(user: dict = Depends(get_current_user)):
    """Permanently delete all of the signed-in user's saved scans. The user comes from the token,
    so nobody can delete another user's history."""
    return {"deleted": await connection.delete_user_history(user["id"])}

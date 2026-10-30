"""Shared request dependencies: who is calling."""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.database import connection
from app.services.auth import InvalidToken, decode_token

_bearer = HTTPBearer(auto_error=False)


def require_database():
    if not connection.is_connected():
        raise HTTPException(status_code=503, detail="Accounts unavailable: MongoDB is not configured (set MONGO_URI)")


async def get_optional_user(credentials: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> dict | None:
    """The signed-in user, or None for guests. A token that is present but invalid is an error,
    so the client can sign the user out instead of silently scanning anonymously."""
    if credentials is None:
        return None
    if not connection.is_connected():
        return None
    try:
        user_id = decode_token(credentials.credentials)
    except InvalidToken:
        raise HTTPException(status_code=401, detail="Session expired - please log in again",
                            headers={"WWW-Authenticate": "Bearer"})
    user = await connection.find_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Account no longer exists", headers={"WWW-Authenticate": "Bearer"})
    return user


async def get_current_user(user: dict | None = Depends(get_optional_user)) -> dict:
    require_database()
    if user is None:
        raise HTTPException(status_code=401, detail="Not logged in", headers={"WWW-Authenticate": "Bearer"})
    return user

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.database import connection
from app.dependencies import get_current_user, require_database
from app.schemas.models import AuthResponse, LoginRequest, RegisterRequest, UserOut
from app.services.auth import create_token, hash_password, verify_password

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["Accounts"])

# Verifying against a real hash when the email is unknown keeps response times the same,
# so the endpoint does not reveal which emails are registered.
_DUMMY_HASH = hash_password("timing-equaliser-not-a-real-password")


@router.post("/register", response_model=AuthResponse, status_code=201, dependencies=[Depends(require_database)])
async def register(request: RegisterRequest):
    """Create an account and return a login token."""
    try:
        user = await connection.create_user(request.name, request.email, hash_password(request.password))
    except connection.EmailAlreadyRegistered:
        raise HTTPException(status_code=409, detail="An account with this email already exists - log in instead")
    logger.info("New account registered")
    return {"token": create_token(user["id"]), "user": user}


@router.post("/login", response_model=AuthResponse, dependencies=[Depends(require_database)])
async def login(request: LoginRequest):
    """Exchange email + password for a login token."""
    found = await connection.find_user_with_hash(request.email)
    password_hash = found[1] if found else _DUMMY_HASH
    if not verify_password(request.password, password_hash) or not found:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return {"token": create_token(found[0]["id"]), "user": found[0]}


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    """The account the token belongs to."""
    return user

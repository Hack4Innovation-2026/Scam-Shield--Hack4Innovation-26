"""Password hashing and login tokens (bcrypt + JWT)."""
import datetime

import bcrypt
import jwt

from app import config

JWT_ALGORITHM = "HS256"


class InvalidToken(Exception):
    pass


def hash_password(password: str) -> str:
    # bcrypt only uses the first 72 bytes; longer passwords are rejected at the schema level.
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("ascii"))
    except ValueError:
        return False


def create_token(user_id: str) -> str:
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {"sub": user_id, "iat": now, "exp": now + datetime.timedelta(days=config.JWT_EXPIRE_DAYS)}
    return jwt.encode(payload, config.JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> str:
    """Return the user id in a valid token; raise InvalidToken otherwise (bad signature, expired)."""
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=[JWT_ALGORITHM], options={"require": ["sub", "exp"]})
    except jwt.PyJWTError as e:
        raise InvalidToken(str(e)) from e
    return payload["sub"]

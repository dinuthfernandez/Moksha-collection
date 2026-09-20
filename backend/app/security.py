from datetime import datetime, timedelta, timezone
from secrets import randbelow
from typing import Any

import jwt
from passlib.context import CryptContext

from .config import get_settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def generate_reset_code() -> str:
    """Returns a random 6-digit password reset code, zero-padded (e.g. '004821')."""
    return f"{randbelow(1_000_000):06d}"


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _pwd_context.verify(password, password_hash)


def create_access_token(customer_id: str) -> str:
    settings = get_settings()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expires_minutes)
    payload: dict[str, Any] = {"sub": customer_id, "exp": expires_at}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str | None:
    """Returns the customer id from a valid token, or None if invalid/expired."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None
    return payload.get("sub")


ADMIN_TOKEN_SUBJECT = "admin"


def create_admin_token() -> str:
    settings = get_settings()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.admin_jwt_expires_minutes)
    payload: dict[str, Any] = {"sub": ADMIN_TOKEN_SUBJECT, "role": "admin", "exp": expires_at}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def is_valid_admin_token(token: str) -> bool:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return False
    return payload.get("sub") == ADMIN_TOKEN_SUBJECT and payload.get("role") == "admin"

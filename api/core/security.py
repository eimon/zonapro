import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Union
from jose import jwt
from passlib.context import CryptContext
from core.config import settings
from exceptions.general import UnauthorizedException

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    subject: Union[str, Any],
    expires_delta: timedelta = None,
    claims: dict[str, Any] = None,
    issued_at: datetime = None,
) -> str:
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    # `iat` marks the start of the session (not this specific token) so refresh()
    # can enforce an absolute session lifetime independent of how often it's renewed.
    payload = {"exp": expire, "iat": issued_at or now, "sub": str(subject)}
    if claims:
        payload.update(claims)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def generate_refresh_token() -> tuple[str, str]:
    """Retorna (token_opaco, hash_sha256). El token va al cliente, el hash a la DB."""
    token = secrets.token_urlsafe(48)
    return token, hashlib.sha256(token.encode()).hexdigest()


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.JWTError:
        raise UnauthorizedException("No se pudieron validar las credenciales")


def decode_token_allow_expired(token: str) -> dict:
    """Like decode_token, but accepts an already-expired token (signature is still checked).
    Used by the silent-refresh flow: an expired access token can still prove who the
    user is, as long as the session hasn't exceeded its absolute lifetime."""
    try:
        return jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_exp": False},
        )
    except jwt.JWTError:
        raise UnauthorizedException("No se pudieron validar las credenciales")

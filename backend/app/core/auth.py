"""Clerk JWT verification — FastAPI dependency."""

from __future__ import annotations

import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

_bearer = HTTPBearer()
_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(settings.clerk_jwks_url, cache_keys=True)
    return _jwks_client


async def require_auth(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """Verify a Clerk session JWT and return its claims.

    Raises 401 if the token is missing, expired, or invalid.
    The returned dict always contains ``sub`` (Clerk user ID).
    """
    token = creds.credentials
    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"require": ["sub", "exp", "iat"]},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
        )


async def get_current_user_id(
    claims: dict = Depends(require_auth),
) -> str:
    """Convenience dependency — returns just the Clerk user ID (``sub``)."""
    return claims["sub"]

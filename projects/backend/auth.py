from __future__ import annotations

import re
from datetime import datetime, timezone
from threading import Lock
from typing import Annotated
from uuid import NAMESPACE_URL, uuid5

from fastapi import Header, HTTPException, status

from .config import get_settings
from .models import User

try:
    import jwt
    from jwt import PyJWKClient
except ImportError:  # pragma: no cover - optional until hosted deps are installed
    jwt = None
    PyJWKClient = None


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_jwks_clients: dict[str, object] = {}
_jwks_lock = Lock()


def _unauthorized(detail: str = "Authentication required.") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _normalize_email(email: str | None, *, fallback_subject: str, auth_mode: str) -> str:
    if email:
        normalized = email.strip().lower()
        if EMAIL_RE.match(normalized):
            return normalized
    derived_id = str(uuid5(NAMESPACE_URL, f"handwriting:{auth_mode}:{fallback_subject}"))
    return f"{derived_id}@{auth_mode}.auth.local"


def _external_user_id(auth_mode: str, subject: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"handwriting:{auth_mode}:{subject}"))


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise _unauthorized()
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise _unauthorized("Send a valid Bearer token.")
    return token.strip()


def get_current_access_token(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> str:
    return _extract_bearer_token(authorization)


def _get_jwks_client(jwks_url: str):
    if PyJWKClient is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "PyJWT with crypto support is required for hosted JWT verification. "
                "Install the production backend requirements."
            ),
        )

    with _jwks_lock:
        client = _jwks_clients.get(jwks_url)
        if client is None:
            client = PyJWKClient(jwks_url)
            _jwks_clients[jwks_url] = client
    return client


def _decode_external_token(token: str) -> dict:
    settings = get_settings()
    if jwt is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "PyJWT with crypto support is required for hosted JWT verification. "
                "Install the production backend requirements."
            ),
        )

    decode_kwargs: dict[str, object] = {
        "algorithms": settings.auth_jwt_algorithms or ["RS256", "ES256", "HS256"],
    }
    options: dict[str, bool] = {}

    if settings.auth_jwt_audience:
        decode_kwargs["audience"] = settings.auth_jwt_audience
    else:
        options["verify_aud"] = False

    if settings.auth_jwt_issuer:
        decode_kwargs["issuer"] = settings.auth_jwt_issuer
    else:
        options["verify_iss"] = False

    if options:
        decode_kwargs["options"] = options

    try:
        if settings.auth_jwt_secret:
            return jwt.decode(token, settings.auth_jwt_secret, **decode_kwargs)

        if not settings.auth_jwt_jwks_url:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(
                    "Set HANDWRITING_AUTH_JWT_JWKS_URL or HANDWRITING_AUTH_JWT_SECRET "
                    "to verify hosted provider tokens."
                ),
            )

        signing_key = _get_jwks_client(
            settings.auth_jwt_jwks_url
        ).get_signing_key_from_jwt(token)
        return jwt.decode(token, signing_key.key, **decode_kwargs)
    except HTTPException:
        raise
    except Exception as exc:
        message = str(exc).lower()
        if "expired" in message:
            raise _unauthorized("Your session token has expired. Please sign in again.")
        raise _unauthorized("Invalid hosted auth token.")


def _claims_created_at(claims: dict) -> str:
    issued_at = claims.get("iat")
    if isinstance(issued_at, (int, float)):
        return datetime.fromtimestamp(float(issued_at), timezone.utc).isoformat()
    return datetime.now(timezone.utc).isoformat()


def _user_from_external_token(token: str) -> User:
    settings = get_settings()
    claims = _decode_external_token(token)
    subject = claims.get(settings.auth_subject_claim)
    if not isinstance(subject, str) or not subject.strip():
        raise _unauthorized("Hosted auth token is missing a valid subject.")

    email_claim = claims.get(settings.auth_email_claim)
    email = email_claim if isinstance(email_claim, str) else None
    return User(
        id=_external_user_id(settings.auth_mode, subject.strip()),
        email=_normalize_email(
            email,
            fallback_subject=subject.strip(),
            auth_mode=settings.auth_mode,
        ),
        auth_mode=settings.auth_mode,
        created_at=_claims_created_at(claims),
    )


def signup_local_user(email: str, password: str) -> tuple[User, str, str]:
    del email, password
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=(
            "Local signup is disabled in the ephemeral workspace build. "
            "Use Supabase authentication instead."
        ),
    )


def login_local_user(email: str, password: str) -> tuple[User, str, str]:
    del email, password
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=(
            "Local login is disabled in the ephemeral workspace build. "
            "Use Supabase authentication instead."
        ),
    )


def logout_access_token(token: str) -> None:
    del token


def get_current_user(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
    x_dev_user_id: Annotated[str | None, Header(alias="X-Dev-User-Id")] = None,
    x_dev_user_email: Annotated[str | None, Header(alias="X-Dev-User-Email")] = None,
) -> User:
    # Authentication is disabled. Always return a default anonymous user.
    return User(
        id="anonymous-user",
        email="anonymous@local.dev",
        auth_mode="none",
        created_at=datetime.now(timezone.utc).isoformat(),
    )

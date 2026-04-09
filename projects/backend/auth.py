from __future__ import annotations

import hashlib
import hmac
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import uuid4

from fastapi import Header, HTTPException, status
from sqlalchemy import text

from .config import get_settings
from .database import connection_scope
from .models import User


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _unauthorized(detail: str = "Authentication required.") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if not EMAIL_RE.match(normalized):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enter a valid email address.",
        )
    return normalized


def _hash_password(password: str, salt_hex: str) -> str:
    settings = get_settings()
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt_hex),
        settings.password_hash_iterations,
    )
    return digest.hex()


def _hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _row_to_user(row) -> User:
    return User(
        id=row["id"],
        email=row["email"],
        auth_mode=row["auth_mode"],
        created_at=row["created_at"],
    )


def _create_session(connection, user_id: str) -> tuple[str, str]:
    settings = get_settings()
    session_id = str(uuid4())
    token = secrets.token_urlsafe(32)
    created_at = datetime.now(timezone.utc)
    expires_at = created_at + timedelta(hours=settings.session_ttl_hours)
    connection.execute(
        text(
            """
            INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, created_at)
            VALUES (:id, :user_id, :token_hash, :expires_at, :created_at)
            """
        ),
        {
            "id": session_id,
            "user_id": user_id,
            "token_hash": _hash_session_token(token),
            "expires_at": expires_at.isoformat(),
            "created_at": created_at.isoformat(),
        },
    )
    return token, expires_at.isoformat()


def ensure_local_auth_enabled() -> None:
    settings = get_settings()
    if settings.auth_mode != "local":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Local email/password auth is disabled. "
                "Set HANDWRITING_AUTH_MODE=local to use signup and login."
            ),
        )


def _upsert_dev_user(user_id: str, email: str) -> User:
    created_at = datetime.now(timezone.utc).isoformat()
    with connection_scope() as connection:
        connection.execute(
            text(
                """
                INSERT INTO users (id, email, auth_mode, created_at)
                VALUES (:id, :email, 'dev', :created_at)
                ON CONFLICT(id) DO UPDATE SET email = excluded.email
                """
            ),
            {"id": user_id, "email": email, "created_at": created_at},
        )
        row = (
            connection.execute(
                text(
                    "SELECT id, email, auth_mode, created_at FROM users WHERE id = :id"
                ),
                {"id": user_id},
            )
            .mappings()
            .first()
        )

    return _row_to_user(row)


def signup_local_user(email: str, password: str) -> tuple[User, str, str]:
    ensure_local_auth_enabled()
    normalized_email = _normalize_email(email)
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long.",
        )

    user_id = str(uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    salt_hex = secrets.token_hex(16)
    password_hash = _hash_password(password, salt_hex)

    with connection_scope() as connection:
        existing = (
            connection.execute(
                text("SELECT id FROM users WHERE email = :email"),
                {"email": normalized_email},
            )
            .mappings()
            .first()
        )
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with that email already exists.",
            )

        connection.execute(
            text(
                """
                INSERT INTO users (id, email, password_hash, password_salt, auth_mode, created_at)
                VALUES (:id, :email, :password_hash, :password_salt, 'local', :created_at)
                """
            ),
            {
                "id": user_id,
                "email": normalized_email,
                "password_hash": password_hash,
                "password_salt": salt_hex,
                "created_at": created_at,
            },
        )
        row = (
            connection.execute(
                text(
                    """
                    SELECT id, email, auth_mode, created_at
                    FROM users
                    WHERE id = :id
                    """
                ),
                {"id": user_id},
            )
            .mappings()
            .first()
        )
        token, expires_at = _create_session(connection, user_id)

    return _row_to_user(row), token, expires_at


def login_local_user(email: str, password: str) -> tuple[User, str, str]:
    ensure_local_auth_enabled()
    normalized_email = _normalize_email(email)
    with connection_scope() as connection:
        row = (
            connection.execute(
                text(
                    """
                    SELECT id, email, password_hash, password_salt, auth_mode, created_at
                    FROM users
                    WHERE email = :email
                    """
                ),
                {"email": normalized_email},
            )
            .mappings()
            .first()
        )
        if row is None or not row["password_hash"] or not row["password_salt"]:
            raise _unauthorized("Incorrect email or password.")

        candidate_hash = _hash_password(password, row["password_salt"])
        if not hmac.compare_digest(candidate_hash, row["password_hash"]):
            raise _unauthorized("Incorrect email or password.")

        token, expires_at = _create_session(connection, row["id"])

    return _row_to_user(row), token, expires_at


def logout_access_token(token: str) -> None:
    if not token:
        return

    with connection_scope() as connection:
        connection.execute(
            text("DELETE FROM auth_sessions WHERE token_hash = :token_hash"),
            {"token_hash": _hash_session_token(token)},
        )


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
    settings = get_settings()
    if settings.auth_mode == "dev":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Access tokens are not used while HANDWRITING_AUTH_MODE=dev.",
        )
    return _extract_bearer_token(authorization)


def _user_from_access_token(token: str) -> User:
    token_hash = _hash_session_token(token)
    with connection_scope() as connection:
        row = (
            connection.execute(
                text(
                    """
                    SELECT u.id, u.email, u.auth_mode, u.created_at, s.id AS session_id, s.expires_at
                    FROM auth_sessions s
                    JOIN users u ON u.id = s.user_id
                    WHERE s.token_hash = :token_hash
                    """
                ),
                {"token_hash": token_hash},
            )
            .mappings()
            .first()
        )
        if row is None:
            raise _unauthorized()

        expires_at = datetime.fromisoformat(row["expires_at"])
        if expires_at <= datetime.now(timezone.utc):
            connection.execute(
                text("DELETE FROM auth_sessions WHERE token_hash = :token_hash"),
                {"token_hash": token_hash},
            )
            raise _unauthorized("Your session has expired. Please sign in again.")

    return _row_to_user(row)


def get_current_user(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
    x_dev_user_id: Annotated[str | None, Header(alias="X-Dev-User-Id")] = None,
    x_dev_user_email: Annotated[str | None, Header(alias="X-Dev-User-Email")] = None,
) -> User:
    settings = get_settings()

    if settings.auth_mode == "dev":
        user_id = x_dev_user_id or settings.dev_user_id
        email = x_dev_user_email or settings.dev_user_email
        return _upsert_dev_user(user_id, email)

    if settings.auth_mode == "local":
        token = _extract_bearer_token(authorization)
        return _user_from_access_token(token)

    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=(
            "Configured auth mode is not implemented yet in this scaffold. "
            "Switch HANDWRITING_AUTH_MODE=dev for local development, then wire "
            "your hosted auth provider here."
        ),
    )

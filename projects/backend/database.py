from __future__ import annotations

import shutil
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.engine import Connection, Engine

from .config import get_settings


_SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        password_hash TEXT,
        password_salt TEXT,
        external_subject TEXT,
        auth_mode TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_mode_email_unique
    ON users(auth_mode, email)
    """,
    """
    CREATE TABLE IF NOT EXISTS datasets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        dataset_type TEXT NOT NULL CHECK(dataset_type IN ('alphabet', 'coding')),
        display_name TEXT NOT NULL,
        source_image_path TEXT NOT NULL,
        glyph_root TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        error_message TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_datasets_user_type
    ON datasets(user_id, dataset_type)
    """,
    """
    CREATE TABLE IF NOT EXISTS backgrounds (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        source_image_path TEXT NOT NULL,
        status TEXT NOT NULL,
        is_selected INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        error_message TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_backgrounds_user
    ON backgrounds(user_id, created_at DESC)
    """,
    """
    CREATE TABLE IF NOT EXISTS render_jobs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        text_content TEXT NOT NULL,
        options_json TEXT NOT NULL,
        output_path TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        error_message TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_render_jobs_user
    ON render_jobs(user_id, created_at DESC)
    """,
    """
    CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_sessions_token_hash
    ON auth_sessions(token_hash)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user
    ON auth_sessions(user_id, created_at DESC)
    """,
]

_engine: Engine | None = None
_schema_initialized = False


def ensure_runtime_dirs() -> None:
    settings = get_settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.temp_dir.mkdir(parents=True, exist_ok=True)
    if settings.storage_backend == "local":
        settings.uploads_dir.mkdir(parents=True, exist_ok=True)
        settings.glyph_sets_dir.mkdir(parents=True, exist_ok=True)
        settings.renders_dir.mkdir(parents=True, exist_ok=True)


def _build_engine() -> Engine:
    settings = get_settings()
    connect_args: dict[str, object] = {}
    if settings.uses_sqlite:
        connect_args["check_same_thread"] = False

    engine = create_engine(
        settings.database_url,
        future=True,
        pool_pre_ping=True,
        connect_args=connect_args,
    )

    if settings.uses_sqlite:
        @event.listens_for(engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, _connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys = ON")
            cursor.close()

    return engine


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        ensure_runtime_dirs()
        _engine = _build_engine()
    return _engine


def _column_names(connection: Connection, table_name: str) -> set[str]:
    inspector = inspect(connection)
    if table_name not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def _apply_runtime_migrations(connection: Connection) -> None:
    user_columns = _column_names(connection, "users")
    if "password_hash" not in user_columns:
        connection.execute(text("ALTER TABLE users ADD COLUMN password_hash TEXT"))
    if "password_salt" not in user_columns:
        connection.execute(text("ALTER TABLE users ADD COLUMN password_salt TEXT"))
    if "external_subject" not in user_columns:
        connection.execute(text("ALTER TABLE users ADD COLUMN external_subject TEXT"))
    connection.execute(
        text("DROP INDEX IF EXISTS idx_users_email_unique")
    )
    connection.execute(
        text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_mode_email_unique
            ON users(auth_mode, email)
            """
        )
    )
    connection.execute(
        text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_subject_unique
            ON users(auth_mode, external_subject)
            WHERE external_subject IS NOT NULL
            """
        )
    )

    dataset_columns = _column_names(connection, "datasets")
    if "updated_at" not in dataset_columns:
        connection.execute(text("ALTER TABLE datasets ADD COLUMN updated_at TEXT"))
    if "error_message" not in dataset_columns:
        connection.execute(text("ALTER TABLE datasets ADD COLUMN error_message TEXT"))
    connection.execute(
        text(
            """
            UPDATE datasets
            SET updated_at = COALESCE(updated_at, created_at)
            """
        )
    )

    render_columns = _column_names(connection, "render_jobs")
    if "updated_at" not in render_columns:
        connection.execute(text("ALTER TABLE render_jobs ADD COLUMN updated_at TEXT"))
    if "error_message" not in render_columns:
        connection.execute(text("ALTER TABLE render_jobs ADD COLUMN error_message TEXT"))
    connection.execute(
        text(
            """
            UPDATE render_jobs
            SET updated_at = COALESCE(updated_at, created_at)
            """
        )
    )

    connection.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS auth_sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                token_hash TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
    )
    connection.execute(
        text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_sessions_token_hash
            ON auth_sessions(token_hash)
            """
        )
    )
    connection.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS idx_auth_sessions_user
            ON auth_sessions(user_id, created_at DESC)
            """
        )
    )

    background_columns = _column_names(connection, "backgrounds")
    if "updated_at" not in background_columns:
        connection.execute(text("ALTER TABLE backgrounds ADD COLUMN updated_at TEXT"))
    if "error_message" not in background_columns:
        connection.execute(text("ALTER TABLE backgrounds ADD COLUMN error_message TEXT"))
    if "is_selected" not in background_columns:
        connection.execute(
            text("ALTER TABLE backgrounds ADD COLUMN is_selected INTEGER NOT NULL DEFAULT 0")
        )
    connection.execute(
        text(
            """
            UPDATE backgrounds
            SET updated_at = COALESCE(updated_at, created_at)
            """
        )
    )
    connection.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS idx_backgrounds_user
            ON backgrounds(user_id, created_at DESC)
            """
        )
    )

    _migrate_legacy_runtime_layout(connection)


def _move_directory_contents(source: Path, target: Path) -> None:
    if not source.exists():
        return

    target.mkdir(parents=True, exist_ok=True)
    for child in source.iterdir():
        destination = target / child.name
        if destination.exists():
            if child.is_dir() and destination.is_dir():
                _move_directory_contents(child, destination)
                if child.exists():
                    try:
                        child.rmdir()
                    except OSError:
                        pass
            continue

        shutil.move(str(child), str(destination))

    try:
        source.rmdir()
    except OSError:
        pass


def _migrate_legacy_runtime_layout(connection: Connection) -> None:
    settings = get_settings()
    if settings.storage_backend != "local":
        return

    legacy_users_root = settings.data_dir / "users"
    if not legacy_users_root.exists():
        return

    for user_dir in legacy_users_root.iterdir():
        if not user_dir.is_dir():
            continue

        user_id = user_dir.name
        legacy_uploads = user_dir / "uploads"
        legacy_glyphs = user_dir / "glyph_sets"
        legacy_renders = user_dir / "renders"

        current_uploads = settings.uploads_dir / user_id
        current_glyphs = settings.glyph_sets_dir / user_id
        current_renders = settings.renders_dir / user_id

        _move_directory_contents(legacy_uploads, current_uploads)
        _move_directory_contents(legacy_glyphs, current_glyphs)
        _move_directory_contents(legacy_renders, current_renders)

        connection.execute(
            text(
                """
                UPDATE datasets
                SET source_image_path = REPLACE(source_image_path, :legacy_uploads, :current_uploads),
                    glyph_root = REPLACE(glyph_root, :legacy_glyphs, :current_glyphs)
                WHERE user_id = :user_id
                """
            ),
            {
                "legacy_uploads": str(legacy_uploads),
                "current_uploads": str(current_uploads),
                "legacy_glyphs": str(legacy_glyphs),
                "current_glyphs": str(current_glyphs),
                "user_id": user_id,
            },
        )
        connection.execute(
            text(
                """
                UPDATE render_jobs
                SET output_path = REPLACE(output_path, :legacy_renders, :current_renders)
                WHERE user_id = :user_id
                """
            ),
            {
                "legacy_renders": str(legacy_renders),
                "current_renders": str(current_renders),
                "user_id": user_id,
            },
        )

        try:
            user_dir.rmdir()
        except OSError:
            pass

    try:
        legacy_users_root.rmdir()
    except OSError:
        pass


@contextmanager
def connection_scope():
    engine = get_engine()
    with engine.begin() as connection:
        yield connection


def init_db() -> None:
    global _schema_initialized
    ensure_runtime_dirs()
    with connection_scope() as connection:
        for statement in _SCHEMA_STATEMENTS:
            connection.execute(text(statement))
        _apply_runtime_migrations(connection)
    _schema_initialized = True

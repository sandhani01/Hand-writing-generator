from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from .api.routes.auth import router as auth_router
from .api.routes.backgrounds import router as backgrounds_router
from .api.routes.datasets import router as datasets_router
from .api.routes.defaults import router as defaults_router
from .api.routes.health import router as health_router
from .api.routes.renders import router as renders_router
from .api.routes.users import router as users_router
from .config import get_settings
from .workspace import cleanup_stale_workspaces, prepare_workspace_runtime


settings = get_settings()

app = FastAPI(
    title=settings.api_title,
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    prepare_workspace_runtime()
    cleanup_stale_workspaces()


@app.on_event("shutdown")
def on_shutdown() -> None:
    pass


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse(url="/docs", status_code=307)


app.include_router(health_router, prefix="/api/v1")
app.include_router(defaults_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(backgrounds_router, prefix="/api/v1")
app.include_router(datasets_router, prefix="/api/v1")
app.include_router(renders_router, prefix="/api/v1")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.projects import router as projects_router
from app.config import get_settings
from app.database import Base, engine
from app import models as _models  # noqa: F401


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="PySizer API", version="0.1.0")
    Base.metadata.create_all(bind=engine)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(projects_router)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI

from app.db import SessionLocal
from app.routers import auth, board, cruxes, gym, setting, training
from app.setting_library import sync_library


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # Bring the built-in route templates up to date.
    with SessionLocal() as db:
        sync_library(db)
    yield


app = FastAPI(title="CruxCast API", lifespan=lifespan)

api = APIRouter(prefix="/api")
api.include_router(auth.router)
api.include_router(cruxes.router)
api.include_router(gym.router)
api.include_router(board.router)
api.include_router(training.router)
api.include_router(setting.router)


@api.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api)

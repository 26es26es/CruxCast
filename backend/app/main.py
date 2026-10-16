from fastapi import APIRouter, FastAPI

from app.routers import auth, board, cruxes, gym, training

app = FastAPI(title="CruxCast API")

api = APIRouter(prefix="/api")
api.include_router(auth.router)
api.include_router(cruxes.router)
api.include_router(gym.router)
api.include_router(board.router)
api.include_router(training.router)


@api.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api)

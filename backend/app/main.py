from fastapi import APIRouter, FastAPI

from app.routers import auth, cruxes, gym

app = FastAPI(title="CruxCast API")

api = APIRouter(prefix="/api")
api.include_router(auth.router)
api.include_router(cruxes.router)
api.include_router(gym.router)


@api.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api)

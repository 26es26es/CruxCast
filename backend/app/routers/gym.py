from fastapi import APIRouter, HTTPException, Response, status

from app import toplogger
from app.config import settings
from app.security import CurrentUser

router = APIRouter(prefix="/gym", tags=["gym"])


@router.get("/map")
def gym_map(_: CurrentUser) -> toplogger.GymMap:
    try:
        return toplogger.get_gym_map(settings.toplogger_gym_slug)
    except toplogger.GymMapUnavailable:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "gym_map_unavailable")


@router.get("/floorplan.svg")
def floorplan(_: CurrentUser) -> Response:
    try:
        svg = toplogger.get_floorplan_svg(settings.toplogger_gym_slug)
    except toplogger.GymMapUnavailable:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "gym_map_unavailable")
    return Response(
        svg,
        media_type="image/svg+xml",
        headers={
            # It's third-party content: never let it run script if opened directly.
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, max-age=3600",
        },
    )

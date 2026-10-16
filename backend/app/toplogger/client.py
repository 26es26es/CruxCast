"""Talks to TopLogger's GraphQL API (the one its own web app uses).

There is no official public API, so every response is validated against the shape
we expect; a mismatch raises GymMapUnavailable instead of producing bad data.
"""

from datetime import UTC, datetime

import httpx
from pydantic import BaseModel

from app.config import settings
from app.gym_areas import GYM_AREAS
from app.toplogger.conversions import colour_key, grade_name
from app.toplogger.floorplan import prepare_floorplan
from app.toplogger.models import GymMap, GymMapUnavailable, MapClimb, Option, Tag, Wall

_GYM_QUERY = """
query gymMap($slug: String!) {
  gym(nameSlug: $slug) {
    id
    name
    floorplanPath
    markBoulderNewDays
    markBoulderOutSoonDays
    walls { id nameLoc labelX labelY }
    holdColors { id nameLoc color }
    climbGroups { id nameLoc climbType }
    climbTags { id type nameLoc icon }
    setters { id name }
  }
}
"""

_CLIMBS_QUERY = """
query gymMapClimbs($gymId: ID!) {
  climbs(gymId: $gymId, climbType: boulder) {
    data {
      id
      grade
      positionX
      positionY
      ticksCountLabel
      ratingsAverage
      suitableForKids
      inAt
      outPlannedAt
      holdColorId
      wall { id nameLoc }
      holdColor { nameLoc color }
      climbGroupClimbs { climbGroupId }
      climbTagClimbs { climbTagId }
      climbSetters { gymAdminId }
    }
  }
}
"""


# ---------- TopLogger's response format ----------
# Only the fields we use. If TopLogger renames or removes one, validation fails.


class _TLWall(BaseModel):
    id: str
    nameLoc: str
    labelX: float | None = None
    labelY: float | None = None


class _TLHoldColorOption(BaseModel):
    id: str
    nameLoc: str
    color: str | None = None


class _TLClimbGroup(BaseModel):
    id: str
    nameLoc: str
    climbType: str


class _TLClimbTag(BaseModel):
    id: str
    type: str
    nameLoc: str
    icon: str | None = None


class _TLSetter(BaseModel):
    id: str
    name: str


class _TLGym(BaseModel):
    id: str
    name: str
    floorplanPath: str
    markBoulderNewDays: int | None = None
    markBoulderOutSoonDays: int | None = None
    walls: list[_TLWall]
    holdColors: list[_TLHoldColorOption] = []
    climbGroups: list[_TLClimbGroup] = []
    climbTags: list[_TLClimbTag] = []
    setters: list[_TLSetter] = []


class _TLRef(BaseModel):
    id: str
    nameLoc: str | None = None


class _TLHoldColor(BaseModel):
    nameLoc: str | None = None
    color: str | None = None


class _TLGroupLink(BaseModel):
    climbGroupId: str


class _TLTagLink(BaseModel):
    climbTagId: str


class _TLSetterLink(BaseModel):
    gymAdminId: str


class _TLClimb(BaseModel):
    id: str
    grade: float | None = None
    positionX: float | None = None
    positionY: float | None = None
    ticksCountLabel: str | None = None
    ratingsAverage: float | None = None
    suitableForKids: bool | None = None
    inAt: datetime | None = None
    outPlannedAt: datetime | None = None
    holdColorId: str | None = None
    wall: _TLRef | None = None
    holdColor: _TLHoldColor | None = None
    climbGroupClimbs: list[_TLGroupLink] = []
    climbTagClimbs: list[_TLTagLink] = []
    climbSetters: list[_TLSetterLink] = []


class TopLoggerClient:
    """Fetches a gym's map, climbs and floor plan and maps them to a GymMap."""

    def __init__(
        self,
        api_url: str = settings.toplogger_api_url,
        uploads_url: str = settings.toplogger_uploads_url,
        timeout: float = 15,
    ) -> None:
        self.api_url = api_url
        self.uploads_url = uploads_url
        self.timeout = timeout
        self.headers = {"User-Agent": "CruxCast (personal climbing logbook)"}

    def _query(self, client: httpx.Client, query: str, variables: dict) -> dict:
        response = client.post(self.api_url, json={"query": query, "variables": variables})
        response.raise_for_status()
        body = response.json()
        if body.get("errors") or body.get("data") is None:
            raise GymMapUnavailable(str(body.get("errors")))
        return body["data"]

    def fetch(self, slug: str) -> tuple[GymMap, str]:
        """The gym's map and its prepared floor-plan SVG."""
        with httpx.Client(timeout=self.timeout, headers=self.headers) as client:
            gym_data = self._query(client, _GYM_QUERY, {"slug": slug})["gym"]
            if gym_data is None:
                raise GymMapUnavailable(f"TopLogger has no gym {slug!r}")
            gym = _TLGym.model_validate(gym_data)
            climbs_data = self._query(client, _CLIMBS_QUERY, {"gymId": gym.id})["climbs"]["data"]
            climbs = [_TLClimb.model_validate(climb) for climb in climbs_data]
            plan = client.get(f"{self.uploads_url}/{gym.floorplanPath}")
            plan.raise_for_status()

        floorplan, width, height = prepare_floorplan(plan.text)
        gym_map = GymMap(
            name=gym.name,
            updated_at=datetime.now(UTC),
            floorplan_url="/api/gym/floorplan.svg",
            floorplan_width=width,
            floorplan_height=height,
            walls=[
                Wall(id=w.id, name=w.nameLoc.strip(), label_x=w.labelX, label_y=w.labelY)
                for w in gym.walls
            ],
            climbs=[self._map_climb(c) for c in climbs if c.positionX is not None and c.positionY is not None],
            hold_colours=[
                Option(id=h.id, name=h.nameLoc.strip(), colour_hex=(h.color or "#9ca3af")[:7])
                for h in gym.holdColors
            ],
            circuits=[
                Option(id=g.id, name=g.nameLoc.strip())
                for g in gym.climbGroups
                if g.climbType == "boulder"
            ],
            styles=[
                Tag(id=t.id, name=t.nameLoc.strip(), icon=t.icon)
                for t in gym.climbTags
                if t.type == "CLIMB"
            ],
            holds=[
                Tag(id=t.id, name=t.nameLoc.strip(), icon=t.icon)
                for t in gym.climbTags
                if t.type == "HOLD"
            ],
            setters=[Option(id=s.id, name=s.name.strip()) for s in gym.setters],
            areas=GYM_AREAS.get(slug, []),
            new_days=gym.markBoulderNewDays or 7,
            out_soon_days=gym.markBoulderOutSoonDays or 7,
        )
        return gym_map, floorplan

    @staticmethod
    def _map_climb(c: _TLClimb) -> MapClimb:
        return MapClimb(
            id=c.id,
            wall_id=c.wall.id if c.wall else None,
            wall_name=((c.wall.nameLoc or "").strip() or None) if c.wall else None,
            colour=colour_key(
                c.holdColor.nameLoc if c.holdColor else None,
                c.holdColor.color if c.holdColor else None,
            ),
            colour_hex=((c.holdColor.color if c.holdColor else None) or "#9ca3af")[:7],
            grade=grade_name(c.grade),
            x=c.positionX,
            y=c.positionY,
            hold_colour_id=c.holdColorId,
            soft_hard=c.ticksCountLabel if c.ticksCountLabel in ("soft", "hard") else None,
            rating=c.ratingsAverage,
            short_friendly=bool(c.suitableForKids),
            in_at=c.inAt,
            out_planned_at=c.outPlannedAt,
            circuit_ids=[link.climbGroupId for link in c.climbGroupClimbs],
            tag_ids=[link.climbTagId for link in c.climbTagClimbs],
            setter_ids=[link.gymAdminId for link in c.climbSetters],
        )

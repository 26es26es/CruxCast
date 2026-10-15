"""Reads a gym's floor plan and current boulders from TopLogger.

TopLogger has no official public API; this uses the GraphQL endpoint its own web app
calls. Results are cached so we make at most one request per gym every few minutes.

Because that API can change without notice, every response is validated against the
shape we expect. If a refresh fails for any reason, the last good copy (kept in memory)
keeps being served, marked as stale, and the reason is logged. When TopLogger changes
its format, the fix belongs in this file; tests/test_toplogger_live.py detects it.
"""

import logging
import re
import threading
import time
from dataclasses import dataclass
from datetime import UTC, datetime

import httpx
from pydantic import BaseModel, ValidationError

from app.config import settings
from app.constants import COLOURS
from app.gym_areas import GYM_AREAS, Area

logger = logging.getLogger(__name__)

# How long a good copy is used before asking TopLogger again.
_REFRESH_SECONDS = 10 * 60
# After a failed refresh, wait this long before trying again.
_RETRY_SECONDS = 2 * 60

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

# Hex values of our colour keys, for matching TopLogger colours we have no name for.
_COLOUR_HEX = {
    "red": "#ef4444",
    "orange": "#f97316",
    "yellow": "#facc15",
    "green": "#22c55e",
    "mint": "#9bf4ff",
    "blue": "#3b82f6",
    "purple": "#a855f7",
    "pink": "#ec4899",
    "black": "#18181b",
    "white": "#fafafa",
    "grey": "#9ca3af",
    "brown": "#92400e",
}


class GymMapUnavailable(Exception):
    pass


class Wall(BaseModel):
    id: str
    name: str
    label_x: float | None
    label_y: float | None


class Option(BaseModel):
    """Something climbs can be filtered by: a circuit, setter or hold colour."""

    id: str
    name: str
    colour_hex: str | None = None


class Tag(BaseModel):
    """A style ("Dyno") or hold type ("Crimps"), with TopLogger's 24×24 icon path."""

    id: str
    name: str
    icon: str | None


class MapClimb(BaseModel):
    id: str
    wall_id: str | None
    wall_name: str | None
    colour: str
    colour_hex: str
    grade: str | None
    x: float
    y: float
    hold_colour_id: str | None = None
    # "soft" or "hard" when climbers voted it off its grade.
    soft_hard: str | None = None
    # Average community rating, 0–100 (TopLogger shows it as 1–5 stars).
    rating: float | None = None
    short_friendly: bool = False
    in_at: datetime | None = None
    out_planned_at: datetime | None = None
    circuit_ids: list[str] = []
    tag_ids: list[str] = []
    setter_ids: list[str] = []


class GymMap(BaseModel):
    name: str
    # When this data was fetched from TopLogger.
    updated_at: datetime
    # True when the latest refresh failed and this is the last good copy.
    stale: bool = False
    floorplan_url: str
    # The plan's size in SVG units; climb and label positions are fractions of it.
    floorplan_width: float
    floorplan_height: float
    walls: list[Wall]
    climbs: list[MapClimb]
    # Labelled non-climbing areas (front desk, changing rooms, ...).
    areas: list[Area] = []
    hold_colours: list[Option] = []
    circuits: list[Option] = []
    styles: list[Tag] = []
    holds: list[Tag] = []
    setters: list[Option] = []
    # A climb is "new" for this many days after it's set, and "almost removed"
    # this many days before its planned removal.
    new_days: int = 7
    out_soon_days: int = 7


# ---------- TopLogger's response format ----------
# Only the fields we use. If TopLogger renames or removes one, validation fails and
# the last good copy keeps being served.


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


# ---------- Floor plan ----------

_PATH_TOKEN = re.compile(r"[A-Za-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?")


def _path_bounds(d: str) -> tuple[float, float, float, float]:
    """Bounding box of an SVG path made of straight lines (M, L, H, V, Z)."""
    tokens = _PATH_TOKEN.findall(d)
    x = y = 0.0
    xs: list[float] = []
    ys: list[float] = []
    command = ""
    i = 0
    while i < len(tokens):
        if tokens[i].isalpha():
            command = tokens[i]
            i += 1
            if command in "Zz":
                continue
        lower = command.lower()
        relative = command.islower()
        if lower in ("m", "l"):
            dx, dy = float(tokens[i]), float(tokens[i + 1])
            x, y = (x + dx, y + dy) if relative else (dx, dy)
            i += 2
            # Extra pairs after a move are implicit line-tos.
            command = "l" if relative else "L"
        elif lower == "h":
            value = float(tokens[i])
            x = x + value if relative else value
            i += 1
        elif lower == "v":
            value = float(tokens[i])
            y = y + value if relative else value
            i += 1
        else:
            raise GymMapUnavailable(f"unsupported path command {command!r} in floor plan")
        xs.append(x)
        ys.append(y)
    if not xs:
        raise GymMapUnavailable("empty floor plan background")
    return min(xs), min(ys), max(xs), max(ys)


def _prepare_floorplan(svg: str) -> tuple[str, float, float]:
    """Gives the plan a real size and strips anything that could run as script.

    TopLogger's SVGs have no viewBox; its app sizes them from the "background" shape.
    """
    match = re.search(r"<path\b[^>]*\bid=\"background\"[^>]*>", svg)
    d = re.search(r"\sd=\"([^\"]+)\"", match.group(0)) if match else None
    if d is None:
        raise GymMapUnavailable("floor plan has no background shape")
    min_x, min_y, max_x, max_y = (round(value, 3) for value in _path_bounds(d.group(1)))
    width, height = max_x - min_x, max_y - min_y

    svg = re.sub(r"<script\b.*?</script\s*>", "", svg, flags=re.S | re.I)
    svg = re.sub(r"\son[a-z]+\s*=\s*(\"[^\"]*\"|'[^']*')", "", svg, flags=re.I)
    root = re.search(r"<svg\b[^>]*>", svg)
    if root is None:
        raise GymMapUnavailable("floor plan is not an SVG")
    attributes = re.sub(r"\s(width|height|viewBox|class)=\"[^\"]*\"", "", root.group(0)[4:-1])
    new_root = (
        f'<svg{attributes} viewBox="{min_x:g} {min_y:g} {width:g} {height:g}" '
        f'width="{width:g}" height="{height:g}">'
    )
    return svg[: root.start()] + new_root + svg[root.end() :], width, height


def grade_name(value: float | None) -> str | None:
    """Converts TopLogger's numeric French grade (e.g. 617) to ours (e.g. "6A+")."""
    if value is None or not 300 <= value <= 900:
        return None
    number, rest = divmod(round(value), 100)
    if number < 5:
        # Below 5A TopLogger uses thirds: 300 = 3A, 333 = 3B, 367 = 3C.
        steps = [(0, "A"), (33, "B"), (67, "C")]
    else:
        steps = [(0, "A"), (17, "A+"), (33, "B"), (50, "B+"), (67, "C"), (83, "C+")]
    _, letter = min(steps, key=lambda step: abs(step[0] - rest))
    return f"{number}{letter}"


def _rgb(hex_colour: str) -> tuple[int, int, int]:
    digits = hex_colour.lstrip("#")[:6]
    return int(digits[0:2], 16), int(digits[2:4], 16), int(digits[4:6], 16)


def colour_key(name: str | None, hex_colour: str | None) -> str:
    """Maps a TopLogger hold colour to one of our colour keys."""
    normalised = (name or "").strip().lower()
    if normalised in COLOURS:
        return normalised
    if not hex_colour:
        return "grey"
    target = _rgb(hex_colour)
    return min(
        _COLOUR_HEX,
        key=lambda key: sum((a - b) ** 2 for a, b in zip(_rgb(_COLOUR_HEX[key]), target)),
    )


def _query(client: httpx.Client, query: str, variables: dict) -> dict:
    response = client.post(
        settings.toplogger_api_url, json={"query": query, "variables": variables}
    )
    response.raise_for_status()
    body = response.json()
    if body.get("errors") or body.get("data") is None:
        raise GymMapUnavailable(str(body.get("errors")))
    return body["data"]


def _fetch(slug: str) -> tuple[GymMap, str]:
    headers = {"User-Agent": "CruxCast (personal climbing logbook)"}
    with httpx.Client(timeout=15, headers=headers) as client:
        gym_data = _query(client, _GYM_QUERY, {"slug": slug})["gym"]
        if gym_data is None:
            raise GymMapUnavailable(f"TopLogger has no gym {slug!r}")
        gym = _TLGym.model_validate(gym_data)
        climbs_data = _query(client, _CLIMBS_QUERY, {"gymId": gym.id})["climbs"]["data"]
        climbs = [_TLClimb.model_validate(climb) for climb in climbs_data]
        plan = client.get(f"{settings.toplogger_uploads_url}/{gym.floorplanPath}")
        plan.raise_for_status()

    floorplan, width, height = _prepare_floorplan(plan.text)
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
        climbs=[
            MapClimb(
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
            for c in climbs
            if c.positionX is not None and c.positionY is not None
        ],
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


# ---------- Cache with last-good fallback ----------


@dataclass
class _Snapshot:
    gym_map: GymMap
    floorplan: str
    fetched_at: float  # time.monotonic() of the successful fetch


_snapshots: dict[str, _Snapshot] = {}
_failed_at: dict[str, float] = {}
# Held while talking to TopLogger so concurrent requests share one fetch.
_fetch_lock = threading.Lock()


def _load(slug: str) -> tuple[GymMap, str]:
    with _fetch_lock:
        now = time.monotonic()
        snapshot = _snapshots.get(slug)
        if snapshot and now - snapshot.fetched_at < _REFRESH_SECONDS:
            return snapshot.gym_map, snapshot.floorplan
        failed_at = _failed_at.get(slug)
        if snapshot and failed_at is not None and now - failed_at < _RETRY_SECONDS:
            return _stale(snapshot)

        try:
            gym_map, floorplan = _fetch(slug)
            if snapshot and snapshot.gym_map.climbs and not gym_map.climbs:
                # More likely a format change than the whole gym being stripped.
                raise GymMapUnavailable("TopLogger returned no climbs")
        except (GymMapUnavailable, httpx.HTTPError, ValidationError, KeyError, TypeError, ValueError) as error:
            _failed_at[slug] = now
            if snapshot is None:
                logger.error("Could not load the TopLogger map for %s: %s", slug, error)
                raise GymMapUnavailable(str(error)) from error
            logger.warning(
                "TopLogger refresh failed for %s, serving the copy from %s: %s",
                slug,
                snapshot.gym_map.updated_at.isoformat(timespec="minutes"),
                error,
            )
            return _stale(snapshot)

        _snapshots[slug] = _Snapshot(gym_map, floorplan, now)
        _failed_at.pop(slug, None)
        return gym_map, floorplan


def _stale(snapshot: _Snapshot) -> tuple[GymMap, str]:
    return snapshot.gym_map.model_copy(update={"stale": True}), snapshot.floorplan


def get_gym_map(slug: str) -> GymMap:
    return _load(slug)[0]


def get_floorplan_svg(slug: str) -> str:
    """The gym's floor plan with a viewBox, safe to show in an <img>."""
    return _load(slug)[1]

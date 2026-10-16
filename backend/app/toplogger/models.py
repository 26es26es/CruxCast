"""The gym map as CruxCast uses it, independent of TopLogger's own format."""

from datetime import datetime

from pydantic import BaseModel

from app.gym_areas import Area


class GymMapUnavailable(Exception):
    """TopLogger could not be reached, or answered in an unexpected format."""


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

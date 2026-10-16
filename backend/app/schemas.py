from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app import board, setting, training
from app.constants import COLOURS, GRADES

Colour = Literal[COLOURS]
Grade = Literal[GRADES]


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=30, pattern=r"^[A-Za-z0-9_]+$")
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    username: str = Field(max_length=30)
    password: str = Field(max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str


MapCoordinate = Annotated[float, Field(ge=0, le=1)]


def reject_null(value: object) -> object:
    """For partial updates: a field may be left out, but not set to null."""
    if value is None:
        raise ValueError("may not be null")
    return value


def check_location(climb_id: str, map_x: float | None, map_y: float | None) -> None:
    """A crux needs a climb ID, a spot on the gym map, or both."""
    if (map_x is None) != (map_y is None):
        raise ValueError("map_x and map_y must be set together")
    if not climb_id and map_x is None:
        raise ValueError("climb_id is required when no map position is set")


class CruxCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    climb_id: str = Field("", max_length=50)
    colour: Colour
    area: str = Field("", max_length=100)
    # Empty when TopLogger lists the climb without a grade ("?").
    gym_grade: Grade | None = None
    personal_grade: Grade | None = None
    description: str = Field("", max_length=5000)
    experience: str = Field("", max_length=5000)
    tips: str = Field("", max_length=5000)
    map_x: MapCoordinate | None = None
    map_y: MapCoordinate | None = None
    toplogger_climb_id: str | None = Field(None, max_length=40)
    is_favorite: bool = False

    @model_validator(mode="after")
    def location(self) -> "CruxCreate":
        check_location(self.climb_id, self.map_x, self.map_y)
        return self


class CruxUpdate(BaseModel):
    """Partial update: only the fields sent are changed."""

    model_config = ConfigDict(str_strip_whitespace=True)

    climb_id: str | None = Field(None, max_length=50)
    colour: Colour | None = None
    area: str | None = Field(None, max_length=100)
    gym_grade: Grade | None = None
    personal_grade: Grade | None = None
    description: str | None = Field(None, max_length=5000)
    experience: str | None = Field(None, max_length=5000)
    tips: str | None = Field(None, max_length=5000)
    map_x: MapCoordinate | None = None
    map_y: MapCoordinate | None = None
    toplogger_climb_id: str | None = Field(None, max_length=40)
    is_favorite: bool | None = None

    # personal_grade, gym_grade and the map fields are the only ones that may be cleared with null.
    _not_null = field_validator(
        "climb_id", "colour", "area", "description", "experience", "tips", "is_favorite"
    )(reject_null)


class CruxOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    climb_id: str
    colour: str
    area: str
    gym_grade: str | None
    personal_grade: str | None
    description: str
    experience: str
    tips: str
    map_x: float | None
    map_y: float | None
    toplogger_climb_id: str | None
    is_favorite: bool
    has_video: bool
    created_at: datetime
    updated_at: datetime



# ---------- Board cruxes ----------


class BoardHold(BaseModel):
    id: int
    role: board.HoldRole


def check_board_holds(holds: list[BoardHold]) -> list[BoardHold]:
    ids = [hold.id for hold in holds]
    if len(set(ids)) != len(ids):
        raise ValueError("a hold can only be used once")
    unknown = set(ids) - board.hold_ids()
    if unknown:
        raise ValueError(f"unknown holds: {sorted(unknown)}")
    starts = sum(hold.role == "start" for hold in holds)
    finishes = sum(hold.role == "finish" for hold in holds)
    if not 1 <= starts <= board.MAX_START_HOLDS:
        raise ValueError("a crux needs one or two start holds")
    if not 1 <= finishes <= board.MAX_FINISH_HOLDS:
        raise ValueError("a crux needs one or two finish holds")
    return holds


def check_angle(angle: int) -> int:
    if angle not in board.ANGLES:
        raise ValueError(f"angle must be one of {board.ANGLES}")
    return angle


class BoardCruxCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=60)
    angle: int
    grade: Grade
    description: str = Field("", max_length=2000)
    is_public: bool = False
    holds: list[BoardHold] = Field(min_length=2, max_length=60)

    _angle = field_validator("angle")(check_angle)
    _holds = field_validator("holds")(check_board_holds)


class BoardCruxUpdate(BaseModel):
    """Partial update: only the fields sent are changed."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(None, min_length=1, max_length=60)
    angle: int | None = None
    grade: Grade | None = None
    description: str | None = Field(None, max_length=2000)
    is_public: bool | None = None
    holds: list[BoardHold] | None = Field(None, min_length=2, max_length=60)

    # Declared before the checks below, so null is rejected before they run.
    _not_null = field_validator("name", "angle", "grade", "description", "is_public", "holds")(reject_null)
    _angle = field_validator("angle")(check_angle)
    _holds = field_validator("holds")(check_board_holds)


class BoardCruxOut(BaseModel):
    id: int
    name: str
    angle: int
    grade: str
    description: str
    is_public: bool
    holds: list[BoardHold]
    setter: str
    is_mine: bool
    created_at: datetime
    updated_at: datetime



# ---------- Training sessions ----------


class SessionClimbIn(BaseModel):
    grade: Grade | None = None
    sent: bool = False
    attempts: int = Field(1, ge=1, le=99)
    crux_id: int | None = None
    board_crux_id: int | None = None

    @model_validator(mode="after")
    def one_link(self) -> "SessionClimbIn":
        if self.crux_id is not None and self.board_crux_id is not None:
            raise ValueError("link a climb to a gym crux or a board crux, not both")
        return self


class TrainingSessionIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    session_type: training.SessionType
    status: Literal["planned", "done"]
    date: date
    start_time: str | None = Field(None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    duration_min: int | None = Field(None, ge=5, le=600)
    effort: int | None = Field(None, ge=1, le=10)
    notes: str = Field("", max_length=2000)
    climbs: list[SessionClimbIn] = Field([], max_length=100)

    @model_validator(mode="after")
    def complete_when_done(self) -> "TrainingSessionIn":
        if self.status == "done" and (self.duration_min is None or self.effort is None):
            raise ValueError("a logged session needs its duration and effort")
        if self.status == "planned" and (self.effort is not None or self.climbs):
            raise ValueError("effort and climbs are only for logged sessions")
        return self


class LinkedCrux(BaseModel):
    id: int
    climb_id: str
    colour: str
    gym_grade: str | None


class LinkedBoardCrux(BaseModel):
    id: int
    name: str
    grade: str


class SessionClimbOut(BaseModel):
    grade: str | None
    sent: bool
    attempts: int
    crux: LinkedCrux | None
    board_crux: LinkedBoardCrux | None


class TrainingSessionOut(BaseModel):
    id: int
    session_type: str
    status: str
    date: date
    start_time: str | None
    duration_min: int | None
    effort: int | None
    notes: str
    climbs: list[SessionClimbOut]
    created_at: datetime



# ---------- Route templates (Crux setting) ----------


def check_template_holds(holds: list[setting.RouteHold]) -> list[setting.RouteHold]:
    starts = sum(hold.role == "start" for hold in holds)
    finishes = sum(hold.role == "finish" for hold in holds)
    if not 1 <= starts <= 2:
        raise ValueError("a route needs one or two start holds")
    if finishes != 1:
        raise ValueError("a route needs exactly one top hold, matched with both hands")
    return holds


def check_template_angle(angle: int) -> int:
    if angle not in setting.ANGLES:
        raise ValueError("angle must be a multiple of 5 between -20 and 90")
    return angle


class RouteTemplateIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=60)
    wall_type: setting.WallType
    angle: int
    gym_wall: str | None = Field(None, max_length=60)
    grade: Grade
    styles: list[setting.Style] = Field([], max_length=4)
    colour: Colour
    description: str = Field("", max_length=2000)
    inspired_by: str | None = Field(None, max_length=120)
    inspired_by_url: str | None = Field(None, max_length=300, pattern=r"^https?://\S+$")
    is_public: bool = False
    holds: list[setting.RouteHold] = Field(min_length=2, max_length=80)

    _angle = field_validator("angle")(check_template_angle)
    _holds = field_validator("holds")(check_template_holds)


class RouteTemplateOut(BaseModel):
    id: int
    name: str
    wall_type: str
    angle: int
    gym_wall: str | None
    grade: str
    styles: list[str]
    colour: str
    description: str
    inspired_by: str | None
    inspired_by_url: str | None
    is_public: bool
    holds: list[setting.RouteHold]
    # None for library templates.
    setter: str | None
    is_library: bool
    is_mine: bool
    created_at: datetime

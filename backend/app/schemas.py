from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app import board
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
    @field_validator(
        "climb_id",
        "colour",
        "area",
        "description",
        "experience",
        "tips",
        "is_favorite",
    )
    @classmethod
    def not_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("may not be null")
        return value


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

    @field_validator("name", "angle", "grade", "description", "is_public", "holds")
    @classmethod
    def not_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("may not be null")
        return value

    @field_validator("angle")
    @classmethod
    def valid_angle(cls, value: int) -> int:
        return check_angle(value)

    @field_validator("holds")
    @classmethod
    def valid_holds(cls, value: list[BoardHold]) -> list[BoardHold]:
        return check_board_holds(value)


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

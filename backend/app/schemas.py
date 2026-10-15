from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

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

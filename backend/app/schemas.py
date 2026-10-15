from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

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


class CruxCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    climb_id: str = Field(min_length=1, max_length=50)
    colour: Colour
    area: str = Field(min_length=1, max_length=100)
    gym_grade: Grade
    personal_grade: Grade | None = None
    description: str = Field("", max_length=5000)
    experience: str = Field("", max_length=5000)
    tips: str = Field("", max_length=5000)
    is_favorite: bool = False


class CruxUpdate(BaseModel):
    """Partial update: only the fields sent are changed."""

    model_config = ConfigDict(str_strip_whitespace=True)

    climb_id: str | None = Field(None, min_length=1, max_length=50)
    colour: Colour | None = None
    area: str | None = Field(None, min_length=1, max_length=100)
    gym_grade: Grade | None = None
    personal_grade: Grade | None = None
    description: str | None = Field(None, max_length=5000)
    experience: str | None = Field(None, max_length=5000)
    tips: str | None = Field(None, max_length=5000)
    is_favorite: bool | None = None

    # personal_grade is the only field that may be cleared with null.
    @field_validator(
        "climb_id",
        "colour",
        "area",
        "gym_grade",
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
    gym_grade: str
    personal_grade: str | None
    description: str
    experience: str
    tips: str
    is_favorite: bool
    has_video: bool
    created_at: datetime
    updated_at: datetime

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    false,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Stored lowercase so usernames are case-insensitive.
    username: Mapped[str] = mapped_column(String(30), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    cruxes: Mapped[list["Crux"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    board_cruxes: Mapped[list["BoardCrux"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Crux(Base):
    __tablename__ = "cruxes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # The identifier the gym gives the climb, e.g. the number on its tag. Not unique:
    # friends log the same climb, and gyms reuse numbers after a reset. May be empty
    # when the climb was picked on the gym map instead.
    climb_id: Mapped[str] = mapped_column(String(50))
    colour: Mapped[str] = mapped_column(String(20))
    # The wall picked on the gym map; empty when the crux has no map position.
    area: Mapped[str] = mapped_column(String(100))
    gym_grade: Mapped[str | None] = mapped_column(String(5))
    personal_grade: Mapped[str | None] = mapped_column(String(5))
    description: Mapped[str] = mapped_column(Text, server_default="")
    experience: Mapped[str] = mapped_column(Text, server_default="")
    tips: Mapped[str] = mapped_column(Text, server_default="")
    video_filename: Mapped[str | None] = mapped_column(String(255))
    video_content_type: Mapped[str | None] = mapped_column(String(100))
    # Where the climb is on the gym floor plan, as fractions of its width and height.
    # Copied from TopLogger so the pin survives the climb being reset there.
    map_x: Mapped[float | None] = mapped_column(Float)
    map_y: Mapped[float | None] = mapped_column(Float)
    toplogger_climb_id: Mapped[str | None] = mapped_column(String(40))
    is_favorite: Mapped[bool] = mapped_column(Boolean, server_default=false())
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="cruxes")

    @property
    def has_video(self) -> bool:
        return self.video_filename is not None


class BoardCrux(Base):
    """A climb set on the Kilter Board: which holds, for what, at which angle."""

    __tablename__ = "board_cruxes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    board: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(60))
    angle: Mapped[int] = mapped_column(Integer)
    grade: Mapped[str] = mapped_column(String(5))
    description: Mapped[str] = mapped_column(Text, server_default="")
    # Public cruxes are visible to everyone; private ones only to their setter.
    is_public: Mapped[bool] = mapped_column(Boolean, server_default=false(), index=True)
    # [{"id": <hold id>, "role": "start" | "hand" | "finish" | "foot"}, ...]
    holds: Mapped[list[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="board_cruxes", lazy="joined")

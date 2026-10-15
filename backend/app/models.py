from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
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


class Crux(Base):
    __tablename__ = "cruxes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # The identifier the gym gives the climb, e.g. the number on its tag. Not unique:
    # friends log the same climb, and gyms reuse numbers after a reset.
    climb_id: Mapped[str] = mapped_column(String(50))
    colour: Mapped[str] = mapped_column(String(20))
    area: Mapped[str] = mapped_column(String(100))
    gym_grade: Mapped[str] = mapped_column(String(5))
    personal_grade: Mapped[str | None] = mapped_column(String(5))
    description: Mapped[str] = mapped_column(Text, server_default="")
    experience: Mapped[str] = mapped_column(Text, server_default="")
    tips: Mapped[str] = mapped_column(Text, server_default="")
    video_filename: Mapped[str | None] = mapped_column(String(255))
    video_content_type: Mapped[str | None] = mapped_column(String(100))
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

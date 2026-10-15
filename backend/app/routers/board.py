from typing import Literal

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import or_, select

from app import board
from app.db import DbSession
from app.models import BoardCrux, User
from app.schemas import BoardCruxCreate, BoardCruxOut, BoardCruxUpdate
from app.security import CurrentUser

router = APIRouter(prefix="/board", tags=["board"])


def _out(crux: BoardCrux, user: User) -> BoardCruxOut:
    return BoardCruxOut(
        id=crux.id,
        name=crux.name,
        angle=crux.angle,
        grade=crux.grade,
        description=crux.description,
        is_public=crux.is_public,
        holds=crux.holds,
        setter=crux.user.username,
        is_mine=crux.user_id == user.id,
        created_at=crux.created_at,
        updated_at=crux.updated_at,
    )


def _visible_crux(db: DbSession, user: User, crux_id: int) -> BoardCrux:
    crux = db.get(BoardCrux, crux_id)
    # Someone else's private crux is reported as missing so ids don't leak.
    if crux is None or (not crux.is_public and crux.user_id != user.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "board_crux_not_found")
    return crux


def _own_crux(db: DbSession, user: User, crux_id: int) -> BoardCrux:
    crux = _visible_crux(db, user, crux_id)
    if crux.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not_your_crux")
    return crux


@router.get("/layout")
def get_layout(_: CurrentUser, response: Response) -> dict:
    response.headers["Cache-Control"] = "private, max-age=86400"
    return {**board.layout(), "angles": list(board.ANGLES)}


@router.get("/cruxes")
def list_cruxes(
    user: CurrentUser,
    db: DbSession,
    scope: Literal["mine", "public"] = "mine",
    angle: int | None = None,
    q: str | None = None,
) -> list[BoardCruxOut]:
    query = select(BoardCrux).where(BoardCrux.board == board.BOARD_ID)
    if scope == "mine":
        query = query.where(BoardCrux.user_id == user.id)
    else:
        query = query.where(BoardCrux.is_public)
    if angle is not None:
        query = query.where(BoardCrux.angle == angle)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        query = query.join(BoardCrux.user).where(
            or_(BoardCrux.name.ilike(pattern), User.username.ilike(pattern))
        )
    cruxes = db.scalars(query.order_by(BoardCrux.created_at.desc(), BoardCrux.id.desc()))
    return [_out(crux, user) for crux in cruxes.unique()]


@router.post("/cruxes", status_code=status.HTTP_201_CREATED)
def create_crux(payload: BoardCruxCreate, user: CurrentUser, db: DbSession) -> BoardCruxOut:
    crux = BoardCrux(**payload.model_dump(), user_id=user.id, board=board.BOARD_ID)
    db.add(crux)
    db.commit()
    db.refresh(crux)
    return _out(crux, user)


@router.get("/cruxes/{crux_id}")
def get_crux(crux_id: int, user: CurrentUser, db: DbSession) -> BoardCruxOut:
    return _out(_visible_crux(db, user, crux_id), user)


@router.patch("/cruxes/{crux_id}")
def update_crux(
    crux_id: int, payload: BoardCruxUpdate, user: CurrentUser, db: DbSession
) -> BoardCruxOut:
    crux = _own_crux(db, user, crux_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(crux, field, value)
    db.commit()
    db.refresh(crux)
    return _out(crux, user)


@router.delete("/cruxes/{crux_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_crux(crux_id: int, user: CurrentUser, db: DbSession) -> None:
    db.delete(_own_crux(db, user, crux_id))
    db.commit()

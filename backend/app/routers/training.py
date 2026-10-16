from datetime import date as Date

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app import training
from app.db import DbSession
from app.models import BoardCrux, Crux, SessionClimb, TrainingSession, User
from app.schemas import (
    LinkedBoardCrux,
    LinkedCrux,
    SessionClimbOut,
    TrainingSessionIn,
    TrainingSessionOut,
)
from app.security import CurrentUser

router = APIRouter(prefix="/training", tags=["training"])


def _out(session: TrainingSession) -> TrainingSessionOut:
    climbs = []
    for climb in session.climbs:
        crux, board_crux = climb.crux, climb.board_crux
        climbs.append(
            SessionClimbOut(
                grade=climb.grade,
                sent=climb.sent,
                attempts=climb.attempts,
                crux=LinkedCrux(id=crux.id, climb_id=crux.climb_id, colour=crux.colour, gym_grade=crux.gym_grade)
                if crux
                else None,
                board_crux=LinkedBoardCrux(id=board_crux.id, name=board_crux.name, grade=board_crux.grade)
                if board_crux
                else None,
            )
        )
    return TrainingSessionOut(
        id=session.id,
        session_type=session.session_type,
        status=session.status,
        date=session.date,
        start_time=session.start_time,
        duration_min=session.duration_min,
        effort=session.effort,
        notes=session.notes,
        climbs=climbs,
        created_at=session.created_at,
    )


def _own_session(db: DbSession, user: User, session_id: int) -> TrainingSession:
    session = db.get(TrainingSession, session_id)
    if session is None or session.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "session_not_found")
    return session


def _apply(db: DbSession, user: User, session: TrainingSession, payload: TrainingSessionIn) -> None:
    session.session_type = payload.session_type
    session.status = payload.status
    session.date = payload.date
    session.start_time = payload.start_time
    session.duration_min = payload.duration_min
    session.effort = payload.effort
    session.notes = payload.notes
    climbs = []
    for position, climb in enumerate(payload.climbs):
        # Only your own gym cruxes, and board cruxes you can see, can be linked.
        if climb.crux_id is not None:
            crux = db.get(Crux, climb.crux_id)
            if crux is None or crux.user_id != user.id:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "invalid_input")
        if climb.board_crux_id is not None:
            board_crux = db.get(BoardCrux, climb.board_crux_id)
            if board_crux is None or (not board_crux.is_public and board_crux.user_id != user.id):
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "invalid_input")
        climbs.append(SessionClimb(position=position, **climb.model_dump()))
    session.climbs = climbs


def _history(db: DbSession, user: User, on: Date, exclude_id: int | None = None) -> list[training.PastSession]:
    """The user's last two logged sessions on or before a date."""
    query = select(TrainingSession).where(
        TrainingSession.user_id == user.id,
        TrainingSession.status == "done",
        TrainingSession.date <= on,
    )
    if exclude_id is not None:
        query = query.where(TrainingSession.id != exclude_id)
    rows = db.scalars(query.order_by(TrainingSession.date.desc(), TrainingSession.id.desc()).limit(2))
    return [
        training.PastSession(
            session_type=row.session_type,
            date=row.date,
            duration_min=row.duration_min,
            effort=row.effort,
            climbs=[training.PastClimb(grade=c.grade, sent=c.sent, attempts=c.attempts) for c in row.climbs],
        )
        for row in rows
    ]


@router.get("/sessions")
def list_sessions(
    user: CurrentUser,
    db: DbSession,
    start: Date | None = None,
    end: Date | None = None,
    status_filter: str | None = None,
    limit: int = 200,
) -> list[TrainingSessionOut]:
    query = select(TrainingSession).where(TrainingSession.user_id == user.id)
    if start is not None:
        query = query.where(TrainingSession.date >= start)
    if end is not None:
        query = query.where(TrainingSession.date <= end)
    if status_filter in ("planned", "done"):
        query = query.where(TrainingSession.status == status_filter)
    query = query.order_by(TrainingSession.date.desc(), TrainingSession.start_time, TrainingSession.id.desc())
    return [_out(s) for s in db.scalars(query.limit(min(limit, 500))).unique()]


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
def create_session(payload: TrainingSessionIn, user: CurrentUser, db: DbSession) -> TrainingSessionOut:
    session = TrainingSession(user_id=user.id)
    _apply(db, user, session, payload)
    db.add(session)
    db.commit()
    db.refresh(session)
    return _out(session)


@router.get("/sessions/{session_id}")
def get_session(session_id: int, user: CurrentUser, db: DbSession) -> TrainingSessionOut:
    return _out(_own_session(db, user, session_id))


@router.put("/sessions/{session_id}")
def replace_session(
    session_id: int, payload: TrainingSessionIn, user: CurrentUser, db: DbSession
) -> TrainingSessionOut:
    session = _own_session(db, user, session_id)
    _apply(db, user, session, payload)
    db.commit()
    db.refresh(session)
    return _out(session)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: int, user: CurrentUser, db: DbSession) -> None:
    db.delete(_own_session(db, user, session_id))
    db.commit()


@router.get("/advice")
def get_advice(
    user: CurrentUser,
    db: DbSession,
    session_type: training.SessionType,
    on: Date | None = None,
    exclude_id: int | None = None,
) -> training.Advice:
    day = on or Date.today()
    return training.advise(session_type, day, _history(db, user, day, exclude_id))

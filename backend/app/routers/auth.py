from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db import DbSession
from app.models import User
from app.schemas import LoginRequest, RegisterRequest, UserOut
from app.security import (
    CurrentUser,
    clear_session_cookie,
    password_hasher,
    set_session_cookie,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, response: Response, db: DbSession) -> UserOut:
    user = User(
        username=payload.username.lower(),
        password_hash=password_hasher.hash(payload.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "username_taken")
    set_session_cookie(response, user)
    return UserOut.model_validate(user)


@router.post("/login")
def login(payload: LoginRequest, response: Response, db: DbSession) -> UserOut:
    user = db.scalar(select(User).where(User.username == payload.username.lower()))
    if user is None or not password_hasher.verify(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid_credentials")
    set_session_cookie(response, user)
    return UserOut.model_validate(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    clear_session_cookie(response)


@router.get("/me")
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)

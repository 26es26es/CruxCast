from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import Cookie, Depends, HTTPException, Response, status
from pwdlib import PasswordHash

from app.config import settings
from app.db import DbSession
from app.models import User

SESSION_COOKIE = "cruxcast_session"
_ALGORITHM = "HS256"

password_hasher = PasswordHash.recommended()


def set_session_cookie(response: Response, user: User) -> None:
    expires = datetime.now(UTC) + timedelta(days=settings.session_days)
    token = jwt.encode(
        {"sub": str(user.id), "exp": expires}, settings.jwt_secret, _ALGORITHM
    )
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=settings.session_days * 24 * 60 * 60,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE)


def get_current_user(
    db: DbSession,
    session: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> User:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "not_authenticated")
    if session is None:
        raise unauthorized
    try:
        payload = jwt.decode(session, settings.jwt_secret, algorithms=[_ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise unauthorized
    user = db.get(User, user_id)
    if user is None:
        raise unauthorized
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]

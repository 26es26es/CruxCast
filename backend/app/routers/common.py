from fastapi import HTTPException, status

from app.db import DbSession
from app.models import Base, User


def get_owned[M: Base](db: DbSession, model: type[M], item_id: int, user: User, not_found: str) -> M:
    """Loads one of the user's own rows. Someone else's is reported as missing, so ids don't leak."""
    item = db.get(model, item_id)
    if item is None or item.user_id != user.id:  # type: ignore[attr-defined]
        raise HTTPException(status.HTTP_404_NOT_FOUND, not_found)
    return item

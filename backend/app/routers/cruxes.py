from fastapi import APIRouter, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select

from app import storage
from app.db import DbSession
from app.models import Crux, User
from app.schemas import CruxCreate, CruxOut, CruxUpdate, check_location
from app.security import CurrentUser

router = APIRouter(prefix="/cruxes", tags=["cruxes"])


def _get_owned_crux(db: DbSession, user: User, crux_id: int) -> Crux:
    crux = db.get(Crux, crux_id)
    # Someone else's crux is reported as missing so ids don't leak.
    if crux is None or crux.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "crux_not_found")
    return crux


@router.get("")
def list_cruxes(user: CurrentUser, db: DbSession, favorites: bool = False) -> list[CruxOut]:
    query = select(Crux).where(Crux.user_id == user.id)
    if favorites:
        query = query.where(Crux.is_favorite)
    cruxes = db.scalars(query.order_by(Crux.created_at.desc(), Crux.id.desc()))
    return [CruxOut.model_validate(crux) for crux in cruxes]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_crux(payload: CruxCreate, user: CurrentUser, db: DbSession) -> CruxOut:
    crux = Crux(**payload.model_dump(), user_id=user.id)
    db.add(crux)
    db.commit()
    db.refresh(crux)
    return CruxOut.model_validate(crux)


@router.get("/{crux_id}")
def get_crux(crux_id: int, user: CurrentUser, db: DbSession) -> CruxOut:
    return CruxOut.model_validate(_get_owned_crux(db, user, crux_id))


@router.patch("/{crux_id}")
def update_crux(
    crux_id: int, payload: CruxUpdate, user: CurrentUser, db: DbSession
) -> CruxOut:
    crux = _get_owned_crux(db, user, crux_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(crux, field, value)
    try:
        check_location(crux.climb_id, crux.map_x, crux.map_y)
    except ValueError as error:
        db.rollback()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error))
    db.commit()
    db.refresh(crux)
    return CruxOut.model_validate(crux)


@router.delete("/{crux_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_crux(crux_id: int, user: CurrentUser, db: DbSession) -> None:
    crux = _get_owned_crux(db, user, crux_id)
    video_filename = crux.video_filename
    db.delete(crux)
    db.commit()
    storage.delete_video(video_filename)


@router.put("/{crux_id}/video")
def upload_video(
    crux_id: int, file: UploadFile, user: CurrentUser, db: DbSession
) -> CruxOut:
    crux = _get_owned_crux(db, user, crux_id)
    if not (file.content_type or "").startswith("video/"):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "not_a_video")
    try:
        filename = storage.save_video(file.file, file.filename)
    except storage.VideoTooLarge:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "video_too_large")

    old_filename = crux.video_filename
    crux.video_filename = filename
    crux.video_content_type = file.content_type
    db.commit()
    db.refresh(crux)
    storage.delete_video(old_filename)
    return CruxOut.model_validate(crux)


@router.get("/{crux_id}/video")
def get_video(crux_id: int, user: CurrentUser, db: DbSession) -> FileResponse:
    crux = _get_owned_crux(db, user, crux_id)
    if crux.video_filename is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "video_not_found")
    # no-cache makes the browser revalidate, so a replaced video is never stale.
    return FileResponse(
        storage.video_path(crux.video_filename),
        media_type=crux.video_content_type,
        headers={"Cache-Control": "private, no-cache"},
    )


@router.delete("/{crux_id}/video")
def delete_video(crux_id: int, user: CurrentUser, db: DbSession) -> CruxOut:
    crux = _get_owned_crux(db, user, crux_id)
    old_filename = crux.video_filename
    crux.video_filename = None
    crux.video_content_type = None
    db.commit()
    db.refresh(crux)
    storage.delete_video(old_filename)
    return CruxOut.model_validate(crux)

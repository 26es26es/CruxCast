from typing import Literal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app import setting
from app.db import DbSession
from app.models import RouteTemplate, User
from app.routers.common import get_owned
from app.schemas import RouteTemplateIn, RouteTemplateOut
from app.security import CurrentUser

router = APIRouter(prefix="/setting", tags=["setting"])


def _out(template: RouteTemplate, user: User) -> RouteTemplateOut:
    return RouteTemplateOut(
        id=template.id,
        name=template.name,
        wall_type=template.wall_type,
        angle=template.angle,
        gym_wall=template.gym_wall,
        grade=template.grade,
        styles=template.styles,
        colour=template.colour,
        description=template.description,
        inspired_by=template.inspired_by,
        inspired_by_url=template.inspired_by_url,
        is_public=template.is_public,
        holds=template.holds,
        setter=template.user.username if template.user else None,
        is_library=template.user_id is None,
        is_mine=template.user_id == user.id,
        created_at=template.created_at,
    )


def _visible(db: DbSession, user: User, template_id: int) -> RouteTemplate:
    template = db.get(RouteTemplate, template_id)
    visible = template is not None and (
        template.user_id is None or template.is_public or template.user_id == user.id
    )
    if not visible:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "template_not_found")
    return template


@router.get("/templates")
def list_templates(
    user: CurrentUser,
    db: DbSession,
    scope: Literal["library", "shared", "mine"] = "library",
    wall_type: setting.WallType | None = None,
    style: setting.Style | None = None,
    q: str | None = None,
) -> list[RouteTemplateOut]:
    query = select(RouteTemplate)
    if scope == "library":
        query = query.where(RouteTemplate.user_id.is_(None))
    elif scope == "shared":
        query = query.where(RouteTemplate.user_id.is_not(None), RouteTemplate.is_public)
    else:
        query = query.where(RouteTemplate.user_id == user.id)
    if wall_type:
        query = query.where(RouteTemplate.wall_type == wall_type)
    templates = db.scalars(query.order_by(RouteTemplate.created_at.desc(), RouteTemplate.id)).unique().all()
    # Style and text filters run here: styles is a JSON list.
    if style:
        templates = [t for t in templates if style in t.styles]
    if q and q.strip():
        needle = q.strip().lower()
        templates = [
            t for t in templates
            if needle in t.name.lower()
            or needle in t.description.lower()
            or (t.inspired_by and needle in t.inspired_by.lower())
            or (t.user and needle in t.user.username)
        ]
    return [_out(t, user) for t in templates]


@router.get("/templates/{template_id}")
def get_template(template_id: int, user: CurrentUser, db: DbSession) -> RouteTemplateOut:
    return _out(_visible(db, user, template_id), user)


def _apply(template: RouteTemplate, payload: RouteTemplateIn) -> None:
    data = payload.model_dump()
    data["holds"] = [hold.model_dump() for hold in payload.holds]
    for field, value in data.items():
        setattr(template, field, value)


@router.post("/templates", status_code=status.HTTP_201_CREATED)
def create_template(payload: RouteTemplateIn, user: CurrentUser, db: DbSession) -> RouteTemplateOut:
    template = RouteTemplate(user_id=user.id)
    _apply(template, payload)
    db.add(template)
    db.commit()
    db.refresh(template)
    return _out(template, user)


@router.put("/templates/{template_id}")
def replace_template(
    template_id: int, payload: RouteTemplateIn, user: CurrentUser, db: DbSession
) -> RouteTemplateOut:
    template = get_owned(db, RouteTemplate, template_id, user, "template_not_found")
    _apply(template, payload)
    db.commit()
    db.refresh(template)
    return _out(template, user)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(template_id: int, user: CurrentUser, db: DbSession) -> None:
    db.delete(get_owned(db, RouteTemplate, template_id, user, "template_not_found"))
    db.commit()


@router.post("/generate")
def generate_route(spec: setting.GenerateSpec, _: CurrentUser) -> list[setting.RouteHold]:
    return setting.generate(spec)

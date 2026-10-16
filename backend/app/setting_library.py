"""The route templates that come with the app, kept in setting_library.json.

They are copied into the database when the app starts (matched by slug), so editing
the JSON file updates them. Several are inspired by photos of real gym problems;
they are drawings of the ideas, not copies of the photos.
"""

import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import RouteTemplate
from app.schemas import RouteTemplateIn

_LIBRARY_FILE = Path(__file__).parent / "setting_library.json"


def library() -> list[dict]:
    return json.loads(_LIBRARY_FILE.read_text())


def sync_library(db: Session) -> None:
    """Adds new library templates and updates changed ones."""
    existing = {t.slug: t for t in db.scalars(select(RouteTemplate).where(RouteTemplate.user_id.is_(None)))}
    for entry in library():
        payload = RouteTemplateIn(**{k: v for k, v in entry.items() if k != "slug"}, is_public=True)
        template = existing.get(entry["slug"]) or RouteTemplate(slug=entry["slug"])
        data = payload.model_dump()
        data["holds"] = [hold.model_dump() for hold in payload.holds]
        for field, value in data.items():
            setattr(template, field, value)
        db.add(template)
    db.commit()

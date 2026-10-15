"""Checks TopLogger's real API still returns what CruxCast expects.

Talks to TopLogger over the internet, so it only runs when asked:

    TOPLOGGER_LIVE=1 uv run pytest tests/test_toplogger_live.py

If this fails, TopLogger has changed its API and app/toplogger.py needs updating.
The app keeps serving its last good copy in the meantime.
"""

import os

import pytest

from app import toplogger
from app.config import settings

pytestmark = pytest.mark.skipif(
    os.environ.get("TOPLOGGER_LIVE") != "1", reason="set TOPLOGGER_LIVE=1 to run"
)


def test_toplogger_still_matches_our_format():
    gym_map, floorplan = toplogger._fetch(settings.toplogger_gym_slug)

    assert gym_map.walls, "no walls returned"
    assert gym_map.climbs, "no climbs with a map position returned"
    assert gym_map.floorplan_width > 0 and gym_map.floorplan_height > 0
    assert "viewBox=" in floorplan

    assert all(0 <= c.x <= 1 and 0 <= c.y <= 1 for c in gym_map.climbs), "positions out of range"
    graded = [c for c in gym_map.climbs if c.grade is not None]
    assert len(graded) >= 0.9 * len(gym_map.climbs), "most grades no longer convert"
    wall_names = {w.name for w in gym_map.walls}
    assert all(c.wall_name in wall_names for c in gym_map.climbs if c.wall_name), "unknown walls"

    # Filters: every reference on a climb must point at something the gym lists.
    assert gym_map.circuits and gym_map.styles and gym_map.holds and gym_map.setters
    known = {
        "circuit_ids": {o.id for o in gym_map.circuits},
        "tag_ids": {t.id for t in gym_map.styles + gym_map.holds},
        "setter_ids": {o.id for o in gym_map.setters},
    }
    for field, ids in known.items():
        assert all(set(getattr(c, field)) <= ids for c in gym_map.climbs), f"unknown {field}"
    colour_ids = {o.id for o in gym_map.hold_colours}
    assert all(c.hold_colour_id in colour_ids for c in gym_map.climbs), "unknown hold colours"
    ratings = [c.rating for c in gym_map.climbs if c.rating is not None]
    assert ratings and all(0 <= r <= 100 for r in ratings), "ratings no longer 0-100"

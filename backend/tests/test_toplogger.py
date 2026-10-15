from datetime import UTC, datetime

import httpx
import pytest

from app import toplogger
from app.toplogger import GymMap, GymMapUnavailable, MapClimb


@pytest.fixture(autouse=True)
def empty_cache():
    toplogger._snapshots.clear()
    toplogger._failed_at.clear()
    yield
    toplogger._snapshots.clear()
    toplogger._failed_at.clear()


def make_map(climb_count: int = 2) -> GymMap:
    climbs = [
        MapClimb(
            id=f"c{i}",
            wall_id="w1",
            wall_name="Atlas",
            colour="red",
            colour_hex="#E60000",
            grade="6A",
            x=0.1 * (i + 1),
            y=0.5,
        )
        for i in range(climb_count)
    ]
    return GymMap(
        name="Test Gym",
        updated_at=datetime.now(UTC),
        floorplan_url="/api/gym/floorplan.svg",
        floorplan_width=100,
        floorplan_height=200,
        walls=[],
        climbs=climbs,
    )


class FakeTopLogger:
    """Stands in for _fetch; each call returns or raises the next queued result."""

    def __init__(self, monkeypatch, *results):
        self.results = list(results)
        self.calls = 0
        monkeypatch.setattr(toplogger, "_fetch", self)

    def __call__(self, slug):
        self.calls += 1
        result = self.results.pop(0)
        if isinstance(result, Exception):
            raise result
        return result, "<svg/>"


def expire_cache(monkeypatch):
    monkeypatch.setattr(toplogger, "_REFRESH_SECONDS", -1)
    monkeypatch.setattr(toplogger, "_RETRY_SECONDS", -1)


# ---------- Fallback ----------


def test_serves_cached_copy_without_refetching(monkeypatch):
    fake = FakeTopLogger(monkeypatch, make_map())
    toplogger.get_gym_map("gym")
    toplogger.get_gym_map("gym")
    assert fake.calls == 1


def test_failed_refresh_serves_last_good_copy(monkeypatch):
    good = make_map()
    FakeTopLogger(monkeypatch, good, httpx.ConnectError("down"))
    toplogger.get_gym_map("gym")
    expire_cache(monkeypatch)

    result = toplogger.get_gym_map("gym")

    assert result.stale is True
    assert result.climbs == good.climbs


def test_format_change_serves_last_good_copy(monkeypatch):
    good = make_map()
    FakeTopLogger(monkeypatch, good, KeyError("climbs"))
    toplogger.get_gym_map("gym")
    expire_cache(monkeypatch)

    assert toplogger.get_gym_map("gym").stale is True


def test_empty_climb_list_does_not_replace_good_copy(monkeypatch):
    good = make_map(climb_count=3)
    FakeTopLogger(monkeypatch, good, make_map(climb_count=0))
    toplogger.get_gym_map("gym")
    expire_cache(monkeypatch)

    result = toplogger.get_gym_map("gym")

    assert result.stale is True
    assert len(result.climbs) == 3


def test_recovers_after_toplogger_comes_back(monkeypatch):
    FakeTopLogger(monkeypatch, make_map(2), httpx.ConnectError("down"), make_map(5))
    toplogger.get_gym_map("gym")
    expire_cache(monkeypatch)
    toplogger.get_gym_map("gym")

    result = toplogger.get_gym_map("gym")

    assert result.stale is False
    assert len(result.climbs) == 5


def test_waits_before_retrying_after_a_failure(monkeypatch):
    fake = FakeTopLogger(monkeypatch, make_map(), httpx.ConnectError("down"))
    toplogger.get_gym_map("gym")
    monkeypatch.setattr(toplogger, "_REFRESH_SECONDS", -1)
    toplogger.get_gym_map("gym")  # fails, falls back

    toplogger.get_gym_map("gym")  # within the retry window: no new request

    assert fake.calls == 2


def test_no_copy_yet_and_failure_raises(monkeypatch):
    FakeTopLogger(monkeypatch, httpx.ConnectError("down"))
    with pytest.raises(GymMapUnavailable):
        toplogger.get_gym_map("gym")


# ---------- Conversions ----------


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (300, "3A"),
        (333, "3B"),
        (367, "3C"),
        (433, "4B"),
        (500, "5A"),
        (517, "5A+"),
        (583, "5C+"),
        (617, "6A+"),
        (683, "6C+"),
        (750, "7B+"),
        (900, "9A"),
        (616.7, "6A+"),
        (200, None),
        (None, None),
    ],
)
def test_grade_name(value, expected):
    assert toplogger.grade_name(value) == expected


@pytest.mark.parametrize(
    ("name", "hex_colour", "expected"),
    [
        ("Blue ", "#0026E6", "blue"),
        ("Mint", "#9BF4FF", "mint"),
        ("Rood", "#E60000FF", "red"),
        (None, None, "grey"),
    ],
)
def test_colour_key(name, hex_colour, expected):
    assert toplogger.colour_key(name, hex_colour) == expected


def test_prepare_floorplan_sizes_and_sanitises():
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" onload="alert(1)">'
        '<path id="background" d="m0 200 100 0v-200l-100 0z"/>'
        "<script>alert(1)</script>"
        "</svg>"
    )

    result, width, height = toplogger._prepare_floorplan(svg)

    assert (width, height) == (100, 200)
    assert 'viewBox="0 0 100 200"' in result
    assert "script" not in result
    assert "onload" not in result


def test_prepare_floorplan_without_background_fails():
    with pytest.raises(GymMapUnavailable):
        toplogger._prepare_floorplan('<svg xmlns="http://www.w3.org/2000/svg"></svg>')

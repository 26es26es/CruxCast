from datetime import UTC, datetime

import httpx
import pytest

from app.toplogger import GymMap, GymMapService, GymMapUnavailable, MapClimb
from app.toplogger.conversions import colour_key, grade_name
from app.toplogger.floorplan import prepare_floorplan


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
    """Stands in for TopLoggerClient.fetch; each call returns or raises the next queued result."""

    def __init__(self, *results):
        self.results = list(results)
        self.calls = 0

    def __call__(self, slug):
        self.calls += 1
        result = self.results.pop(0)
        if isinstance(result, Exception):
            raise result
        return result, "<svg/>"


class Clock:
    """A clock the tests move forward by hand."""

    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now


def service(*results):
    """A service over a fake TopLogger, refreshing after 600 s and retrying after 120 s."""
    fake, clock = FakeTopLogger(*results), Clock()
    return GymMapService(fake, refresh_seconds=600, retry_seconds=120, clock=clock), fake, clock


# ---------- Fallback ----------


def test_serves_cached_copy_without_refetching():
    maps, fake, _ = service(make_map())
    maps.get_map("gym")
    maps.get_map("gym")
    assert fake.calls == 1


def test_failed_refresh_serves_last_good_copy():
    good = make_map()
    maps, _, clock = service(good, httpx.ConnectError("down"))
    maps.get_map("gym")
    clock.now += 601

    result = maps.get_map("gym")

    assert result.stale is True
    assert result.climbs == good.climbs


def test_format_change_serves_last_good_copy():
    maps, _, clock = service(make_map(), KeyError("climbs"))
    maps.get_map("gym")
    clock.now += 601

    assert maps.get_map("gym").stale is True


def test_empty_climb_list_does_not_replace_good_copy():
    maps, _, clock = service(make_map(climb_count=3), make_map(climb_count=0))
    maps.get_map("gym")
    clock.now += 601

    result = maps.get_map("gym")

    assert result.stale is True
    assert len(result.climbs) == 3


def test_recovers_after_toplogger_comes_back():
    maps, _, clock = service(make_map(2), httpx.ConnectError("down"), make_map(5))
    maps.get_map("gym")
    clock.now += 601
    maps.get_map("gym")
    clock.now += 121

    result = maps.get_map("gym")

    assert result.stale is False
    assert len(result.climbs) == 5


def test_waits_before_retrying_after_a_failure():
    maps, fake, clock = service(make_map(), httpx.ConnectError("down"))
    maps.get_map("gym")
    clock.now += 601
    maps.get_map("gym")  # fails, falls back
    clock.now += 60

    maps.get_map("gym")  # within the retry window: no new request

    assert fake.calls == 2


def test_no_copy_yet_and_failure_raises():
    maps, _, _ = service(httpx.ConnectError("down"))
    with pytest.raises(GymMapUnavailable):
        maps.get_map("gym")


def test_floorplan_comes_from_the_same_copy():
    maps, fake, _ = service(make_map())
    maps.get_map("gym")
    assert maps.get_floorplan("gym") == "<svg/>"
    assert fake.calls == 1


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
    assert grade_name(value) == expected


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
    assert colour_key(name, hex_colour) == expected


def test_prepare_floorplan_sizes_and_sanitises():
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" onload="alert(1)">'
        '<path id="background" d="m0 200 100 0v-200l-100 0z"/>'
        "<script>alert(1)</script>"
        "</svg>"
    )

    result, width, height = prepare_floorplan(svg)

    assert (width, height) == (100, 200)
    assert 'viewBox="0 0 100 200"' in result
    assert "script" not in result
    assert "onload" not in result


def test_prepare_floorplan_without_background_fails():
    with pytest.raises(GymMapUnavailable):
        prepare_floorplan('<svg xmlns="http://www.w3.org/2000/svg"></svg>')

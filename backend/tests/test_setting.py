import math
import statistics
from itertools import pairwise

import pytest
from pydantic import ValidationError

from app.schemas import RouteTemplateIn
from app.setting import (
    FACE_ASPECT,
    GRADES,
    RADIUS,
    STYLES,
    WALL_TYPES,
    GenerateSpec,
    generate,
)
from app.setting_library import library


def spec(**overrides):
    data = {"wall_type": "vertical", "angle": 0, "grade": "6B", "style": "crimpy", "moves": 6, "seed": 1}
    data.update(overrides)
    return GenerateSpec(**data)


def count(holds, role):
    return sum(h.role == role for h in holds)


@pytest.mark.parametrize("style", STYLES)
@pytest.mark.parametrize("wall_type", WALL_TYPES)
def test_every_combination_gives_a_climbable_route(style, wall_type):
    holds = generate(spec(style=style, wall_type=wall_type))
    assert count(holds, "start") == 2
    assert count(holds, "finish") == 1
    assert count(holds, "hand") >= 2
    assert all(0 <= h.x <= 1 and 0 <= h.y <= 1 for h in holds)
    # The route goes upwards: the top is above the start.
    assert min(h.y for h in holds if h.role == "finish") < min(h.y for h in holds if h.role == "start")


def test_same_seed_same_route_new_seed_new_route():
    assert generate(spec(seed=3)) == generate(spec(seed=3))
    assert generate(spec(seed=3)) != generate(spec(seed=4))


@pytest.mark.parametrize("seed", range(10))
def test_holds_do_not_overlap(seed):
    holds = generate(spec(style="compression", angle=20, wall_type="overhang", seed=seed))
    for i, a in enumerate(holds):
        for b in holds[i + 1:]:
            gap = math.hypot(a.x - b.x, (a.y - b.y) * FACE_ASPECT)
            assert gap >= (RADIUS[a.size] + RADIUS[b.size]) * 0.9


def test_only_available_hold_types_are_used():
    holds = generate(spec(style="slopey", hold_types=["jug", "foot_chip"]))
    assert {h.type for h in holds} <= {"jug", "foot_chip"}


def test_at_most_two_big_features():
    for seed in range(20):
        holds = generate(spec(wall_type="slab", angle=-10, style="balance", seed=seed))
        assert sum(h.type in ("volume", "macro") for h in holds) <= 2


def test_harder_grades_have_wider_moves():
    def spread(grade):
        widths = []
        for seed in range(15):
            hands = sorted((h for h in generate(spec(grade=grade, seed=seed)) if h.role in ("hand", "finish")), key=lambda h: -h.y)
            widths += [abs(a.x - b.x) for a, b in pairwise(hands)]
        return statistics.mean(widths)

    assert spread("7B") > spread("4C")


def test_more_moves_more_hand_holds():
    assert count(generate(spec(moves=10)), "hand") > count(generate(spec(moves=4)), "hand")


def test_invalid_spec_is_rejected():
    with pytest.raises(ValidationError):
        spec(moves=1)
    with pytest.raises(ValidationError):
        spec(grade="V5")


@pytest.mark.parametrize("style", STYLES)
@pytest.mark.parametrize("seed", range(5))
def test_routes_finish_matched_on_one_big_enough_top_hold(style, seed):
    tops = [h for h in generate(spec(style=style, seed=seed)) if h.role == "finish"]
    assert len(tops) == 1
    assert tops[0].type in ("jug", "sloper", "edge", "macro")
    assert tops[0].size in ("m", "l", "xl")


def test_top_falls_back_when_no_matchable_holds_are_available():
    tops = [h for h in generate(spec(hold_types=["crimp", "pinch", "foot_chip"])) if h.role == "finish"]
    assert len(tops) == 1 and tops[0].size in ("m", "l", "xl")


def test_template_with_two_tops_is_rejected():
    hold = {"x": 0.5, "y": 0.5, "type": "jug", "size": "m", "rotation": 0}
    holds = [{**hold, "role": "start", "x": 0.4, "y": 0.8}, {**hold, "role": "finish", "x": 0.4, "y": 0.1}]
    base = {"name": "Two tops", "wall_type": "vertical", "angle": 0, "grade": "6A", "styles": [], "colour": "red"}
    RouteTemplateIn(**base, holds=holds)
    with pytest.raises(ValidationError):
        RouteTemplateIn(**base, holds=[*holds, {**hold, "role": "finish", "x": 0.6, "y": 0.1}])


def test_library_templates_are_valid_and_unique():
    entries = library()
    assert len({e["slug"] for e in entries}) == len(entries) == 22
    for entry in entries:
        template = RouteTemplateIn(**{k: v for k, v in entry.items() if k != "slug"})
        assert template.grade in GRADES


def test_fontainebleau_classics_credit_the_original():
    classics = [e for e in library() if e["slug"].startswith("bleau-")]
    assert len(classics) == 10
    for entry in classics:
        assert entry["inspired_by"] and "Fontainebleau" in entry["inspired_by"]
        assert entry["inspired_by_url"].startswith("https://www.fontainebleau.rocks/")


def hand_span(holds):
    hands = [h for h in holds if h.role != "foot"]
    width = (max(h.x for h in hands) - min(h.x for h in hands)) * 6.0
    height = (max(h.y for h in hands) - min(h.y for h in hands)) * 4.5
    return width, height


@pytest.mark.parametrize("seed", range(5))
def test_traverse_goes_sideways(seed):
    width, height = hand_span(generate(spec(path="traverse", seed=seed)))
    assert width > height


def test_slab_goes_sideways_by_default():
    width, height = hand_span(generate(spec(wall_type="slab", angle=-10, style="crimpy", path="auto")))
    assert width > height


@pytest.mark.parametrize("seed", range(5))
def test_diagonal_ends_on_the_other_side(seed):
    holds = generate(spec(path="diagonal", seed=seed))
    start = statistics.mean(h.x for h in holds if h.role == "start")
    top = statistics.mean(h.x for h in holds if h.role == "finish")
    assert abs(top - start) > 0.4


@pytest.mark.parametrize("path", ["up", "diagonal", "traverse", "zigzag"])
def test_every_path_finishes_higher_than_it_starts(path):
    holds = generate(spec(path=path))
    assert min(h.y for h in holds if h.role == "finish") < min(h.y for h in holds if h.role == "start")

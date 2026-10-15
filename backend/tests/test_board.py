import pytest
from pydantic import ValidationError

from app import board
from app.schemas import BoardCruxCreate, BoardCruxUpdate


def crux(**overrides):
    data = {
        "name": "Skype jump",
        "angle": 40,
        "grade": "6C+",
        "holds": [
            {"id": 400, "role": "start"},
            {"id": 200, "role": "hand"},
            {"id": 20, "role": "finish"},
            {"id": 470, "role": "foot"},
        ],
    }
    data.update(overrides)
    return data


def test_layout_has_unique_hold_ids():
    ids = [hold["id"] for hold in board.layout()["holds"]]
    assert len(ids) == len(set(ids)) == 476


def test_valid_crux_defaults_to_private():
    assert BoardCruxCreate(**crux()).is_public is False


@pytest.mark.parametrize(
    ("holds", "message"),
    [
        ([{"id": 1, "role": "hand"}, {"id": 2, "role": "finish"}], "start"),
        ([{"id": 1, "role": "start"}, {"id": 2, "role": "hand"}], "finish"),
        ([{"id": 1, "role": "start"}, {"id": 2, "role": "start"}, {"id": 3, "role": "start"}, {"id": 4, "role": "finish"}], "start"),
        ([{"id": 1, "role": "start"}, {"id": 1, "role": "finish"}], "only be used once"),
        ([{"id": 1, "role": "start"}, {"id": 9999, "role": "finish"}], "unknown holds"),
        ([{"id": 1, "role": "start"}, {"id": 2, "role": "crimp"}], "role"),
    ],
)
def test_invalid_holds(holds, message):
    with pytest.raises(ValidationError, match=message):
        BoardCruxCreate(**crux(holds=holds))


@pytest.mark.parametrize("angle", [-5, 33, 75])
def test_invalid_angle(angle):
    with pytest.raises(ValidationError, match="angle"):
        BoardCruxCreate(**crux(angle=angle))


def test_two_start_and_two_finish_holds_are_fine():
    holds = [
        {"id": 400, "role": "start"},
        {"id": 401, "role": "start"},
        {"id": 20, "role": "finish"},
        {"id": 21, "role": "finish"},
    ]
    assert len(BoardCruxCreate(**crux(holds=holds)).holds) == 4


def test_update_checks_only_what_is_sent():
    assert BoardCruxUpdate(is_public=True).model_dump(exclude_unset=True) == {"is_public": True}
    with pytest.raises(ValidationError):
        BoardCruxUpdate(angle=33)
    with pytest.raises(ValidationError):
        BoardCruxUpdate(name=None)

"""The climbing board (Kilter Board Original) that board cruxes are set on.

The hold layout was traced from a screenshot of the board at the gym: positions and
outlines are fractions of the board's width and height.
"""

import json
from functools import cache
from pathlib import Path
from typing import Literal

BOARD_ID = "kilter-original"
_LAYOUT_FILE = Path(__file__).parent / "boards" / "kilter_original.json"

# The Kilter Board Original tilts from vertical to 70° overhang in 5° steps.
ANGLES = tuple(range(0, 75, 5))

# What a hold is used for in a crux, matching the Kilter app's colours:
# start = green, hand = cyan, finish ("top") = magenta, foot = yellow.
HoldRole = Literal["start", "hand", "finish", "foot"]

MAX_START_HOLDS = 2
MAX_FINISH_HOLDS = 2


@cache
def layout() -> dict:
    return json.loads(_LAYOUT_FILE.read_text())


@cache
def hold_ids() -> frozenset[int]:
    return frozenset(hold["id"] for hold in layout()["holds"])

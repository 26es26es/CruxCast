"""Route setting: the wall and hold catalogue, and a rule-based route generator.

A route is a list of holds on a generic wall section, 6 m wide and 4.5 m high. Positions
are stored as fractions of the face (x from the left, y from the top), so the same route
can be drawn at any size; the generator itself works in metres.

The generator takes the setter's choices (wall, angle, grade, style, path, number of
moves, which hold types are available) and places holds with simple setting rules:
hand holds spaced along the chosen path (straight up, diagonal, traverse or zig-zag),
moves that get wider and holds that get smaller as the grade rises, hold types that
suit the style and the steepness, and feet about a metre below every move. The hold
types arrive as a list, so a gym's real hold inventory can replace the generic
catalogue later, and an AI layer could fill in the same choices from text.
"""

import itertools
import math
import random
from typing import Literal

from pydantic import BaseModel, Field

from app.board import HoldRole
from app.constants import GRADES

WallType = Literal["slab", "vertical", "overhang", "steep", "roof", "arete", "dihedral"]
WALL_TYPES: tuple[str, ...] = ("slab", "vertical", "overhang", "steep", "roof", "arete", "dihedral")
# Typical angle per wall type; negative is a slab, 90 a horizontal roof.
DEFAULT_ANGLES = {"slab": -10, "vertical": 0, "overhang": 20, "steep": 40, "roof": 90, "arete": 15, "dihedral": 0}
ANGLES = tuple(range(-20, 95, 5))

HoldType = Literal[
    "jug", "crimp", "edge", "sloper", "pinch", "pocket", "sidepull", "undercling", "foot_chip", "volume", "macro"
]
HOLD_TYPES: tuple[str, ...] = (
    "jug", "crimp", "edge", "sloper", "pinch", "pocket", "sidepull", "undercling", "foot_chip", "volume", "macro",
)
HoldSize = Literal["xs", "s", "m", "l", "xl"]
SIZES: tuple[str, ...] = ("xs", "s", "m", "l", "xl")

Path = Literal["auto", "up", "diagonal", "traverse", "zigzag"]
PATHS: tuple[str, ...] = ("auto", "up", "diagonal", "traverse", "zigzag")

Style = Literal["crimpy", "slopey", "compression", "dyno", "balance", "power", "technical", "coordination", "juggy"]
STYLES: tuple[str, ...] = (
    "crimpy", "slopey", "compression", "dyno", "balance", "power", "technical", "coordination", "juggy",
)


class RouteHold(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    type: HoldType
    size: HoldSize
    # Degrees clockwise.
    rotation: int = Field(0, ge=-180, le=180)
    role: HoldRole


class GenerateSpec(BaseModel):
    wall_type: WallType
    angle: int = Field(ge=-20, le=90)
    grade: Literal[GRADES]  # type: ignore[valid-type]
    style: Style
    # Where the route goes; "auto" picks one that suits the style and wall.
    path: Path = "auto"
    # Hand moves from the start holds to the top.
    moves: int = Field(6, ge=3, le=12)
    # Hold types the setter has available; empty means all of them.
    hold_types: list[HoldType] = []
    seed: int = Field(0, ge=0)


# ---------- Geometry (metres) ----------

WALL_WIDTH_M = 6.0
WALL_HEIGHT_M = 4.5
# The face is drawn 0.75 times as high as it is wide; distances use the width as unit.
FACE_ASPECT = WALL_HEIGHT_M / WALL_WIDTH_M
# Rough radius of each hold size in metres: a foot chip ~7 cm across, a jug ~17 cm, a volume ~45 cm.
RADIUS_M = {"xs": 0.035, "s": 0.055, "m": 0.085, "l": 0.12, "xl": 0.22}
# The same as a fraction of the wall's width (what the frontend draws with).
RADIUS = {size: round(r / WALL_WIDTH_M, 4) for size, r in RADIUS_M.items()}
# Crash mats cover the bottom of the wall.
MAT_M = 0.35
START_HEIGHT_M = 1.45
TOP_HEIGHT_M = 4.15

# Which hold types each style is built from, with relative weights.
_STYLE_WEIGHTS: dict[str, dict[str, float]] = {
    "crimpy": {"crimp": 5, "edge": 4, "pocket": 1, "sidepull": 1},
    "slopey": {"sloper": 5, "volume": 2, "pinch": 1},
    "compression": {"pinch": 4, "sloper": 3, "volume": 2, "macro": 2},
    "dyno": {"jug": 3, "edge": 2, "macro": 2, "pinch": 1},
    "balance": {"edge": 3, "crimp": 2, "sloper": 2, "volume": 2},
    "power": {"pinch": 3, "sloper": 2, "jug": 2, "macro": 2, "undercling": 1},
    "technical": {"sidepull": 3, "undercling": 3, "crimp": 2, "pinch": 2, "edge": 1},
    "coordination": {"macro": 3, "sloper": 2, "jug": 2, "volume": 2},
    "juggy": {"jug": 6, "macro": 1, "pocket": 1},
}
# Usual size per hold type, before adjusting for the grade.
_BASE_SIZE = {
    "jug": "m", "crimp": "s", "edge": "s", "sloper": "l", "pinch": "m", "pocket": "m",
    "sidepull": "m", "undercling": "m", "foot_chip": "xs", "volume": "xl", "macro": "xl",
}
_FIXED_SIZE = {"volume", "macro", "foot_chip"}
# Big features that would crowd a route if used too often.
_BIG = {"volume", "macro"}
# A boulder finishes with both hands matched on one top hold, so it has to be a hold you can match.
_MATCHABLE = ("jug", "sloper", "edge", "macro")
_MIN_TOP_SIZE = "m"
MAX_BIG = 2
# Path chosen for "auto": slabs travel sideways, balance goes diagonally, technical zig-zags.
_AUTO_PATH = {"balance": "diagonal", "technical": "zigzag", "coordination": "diagonal"}

Point = tuple[float, float]


def _path_points(path: str, rng: random.Random) -> list[Point]:
    """Waypoints (x, height above the floor) in metres that the hand holds follow."""
    flip = rng.random() < 0.5

    def x(value: float) -> float:
        return WALL_WIDTH_M - value if flip else value

    lo, hi = START_HEIGHT_M, TOP_HEIGHT_M
    if path == "diagonal":
        return [(x(1.0), lo), (x(4.9), hi)]
    if path == "traverse":
        # Mostly sideways at about chest-to-head height, then up to the top hold.
        return [(x(0.7), lo + 0.1), (x(4.3), lo + 0.75), (x(5.2), hi - 0.6)]
    if path == "zigzag":
        middle = WALL_WIDTH_M / 2 + rng.uniform(-0.4, 0.4)
        return [(middle, lo), (x(middle + 1.5), lo + 0.9), (x(middle - 1.4), lo + 1.8), (middle, hi)]
    start = WALL_WIDTH_M / 2 + rng.uniform(-0.9, 0.9)
    return [(start, lo), (start + rng.uniform(-0.7, 0.7), hi)]


def _along(points: list[Point], fraction: float) -> tuple[Point, Point]:
    """The point at `fraction` of the polyline's length, and the direction there."""
    lengths = [math.dist(a, b) for a, b in itertools.pairwise(points)]
    target = fraction * sum(lengths)
    for (a, b), length in zip(itertools.pairwise(points), lengths, strict=True):
        if target <= length or (a, b) == (points[-2], points[-1]):
            t = min(target / length, 1.0) if length else 0.0
            direction = ((b[0] - a[0]) / length, (b[1] - a[1]) / length) if length else (0.0, 1.0)
            return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), direction
        target -= length
    raise AssertionError("unreachable")


class _Setter:
    """Places the holds for one route. Randomness comes only from the seed."""

    def __init__(self, spec: GenerateSpec) -> None:
        self.spec = spec
        self.rng = random.Random(spec.seed)
        self.difficulty = GRADES.index(spec.grade) / (len(GRADES) - 1)
        self.steepness = max(0.0, min(spec.angle, 60)) / 60
        self.available = set(spec.hold_types) or set(HOLD_TYPES)
        # Holds placed so far, in metres: (x, height, radius).
        self.placed: list[tuple[float, float, float]] = []
        self.holds: list[RouteHold] = []

    @property
    def path(self) -> str:
        if self.spec.path != "auto":
            return self.spec.path
        if self.spec.wall_type == "slab":
            return "traverse"
        return _AUTO_PATH.get(self.spec.style, "up")

    # ---- choosing holds ----

    def _weights(self, grabbable: bool) -> dict[str, float]:
        weights = dict(_STYLE_WEIGHTS[self.spec.style])
        d, s = self.difficulty, self.steepness
        for kind in list(weights):
            if kind == "jug":
                weights[kind] *= 1.5 - 1.4 * d
            if kind in ("crimp", "pocket", "edge"):
                weights[kind] *= (0.5 + d) * (1 - 0.6 * s)
            if kind in ("jug", "pinch", "macro"):
                weights[kind] *= 1 + s
            if kind == "volume" and self.spec.wall_type == "slab":
                weights[kind] *= 1.5
        usable = {kind: w for kind, w in weights.items() if kind in self.available and w > 0}
        if not usable:
            # None of the style's holds are available: use what there is.
            usable = {kind: 1.0 for kind in self.available if kind != "foot_chip"} or {"jug": 1.0}
        if grabbable or sum(h.type in _BIG for h in self.holds) >= MAX_BIG:
            usable = {kind: w for kind, w in usable.items() if kind not in _BIG} or {"jug": 1.0}
        return usable

    def _pick_type(self, grabbable: bool = False) -> str:
        weights = self._weights(grabbable)
        return self.rng.choices(list(weights), weights=list(weights.values()))[0]

    def _top_type(self) -> str:
        weights = {kind: weight for kind, weight in self._weights(True).items() if kind in _MATCHABLE}
        if not weights:
            return self._pick_type(grabbable=True)
        return self.rng.choices(list(weights), weights=list(weights.values()))[0]

    def _size(self, kind: str) -> str:
        size = _BASE_SIZE[kind]
        if kind in _FIXED_SIZE:
            return size
        index = SIZES.index(size)
        if self.difficulty > 0.6:
            index -= 1
        if self.steepness > 0.6 and kind in ("jug", "pinch", "sloper"):
            index += 1
        return SIZES[max(1, min(index, len(SIZES) - 2))]

    def _rotation(self, kind: str, side: int) -> int:
        if kind == "sidepull":
            degrees = 90 * side
        elif kind == "undercling":
            degrees = 180 + self.rng.randint(-20, 20)
        else:
            degrees = self.rng.randint(-25, 25)
        # Keep it within -180..180.
        return (degrees + 180) % 360 - 180

    # ---- placing holds (in metres) ----

    def _fits(self, x: float, h: float, radius: float) -> bool:
        return all(math.hypot(x - px, h - ph) >= radius + pr + 0.06 for px, ph, pr in self.placed)

    def _clear(self, x: float, h: float, radius: float) -> Point:
        """The nearest free spot on the wall, searching outwards in rings."""
        def inside(px: float, ph: float) -> Point:
            return min(max(px, 0.25), WALL_WIDTH_M - 0.25), min(max(ph, MAT_M + 0.15), WALL_HEIGHT_M - 0.2)

        x, h = inside(x, h)
        if self._fits(x, h, radius):
            return x, h
        for ring in range(1, 12):
            distance = ring * 0.1
            for step in range(12):
                angle = step * math.pi / 6
                px, ph = inside(x + distance * math.cos(angle), h + distance * math.sin(angle))
                if self._fits(px, ph, radius):
                    return px, ph
        return x, h

    def _place(self, x: float, h: float, kind: str, role: HoldRole, side: int = 1) -> None:
        size = self._size(kind)
        if role == "finish" and SIZES.index(size) < SIZES.index(_MIN_TOP_SIZE):
            size = _MIN_TOP_SIZE  # big enough for both hands
        x, h = self._clear(x, h, RADIUS_M[size])
        self.placed.append((x, h, RADIUS_M[size]))
        self.holds.append(
            RouteHold(
                x=round(x / WALL_WIDTH_M, 4),
                y=round(1 - h / WALL_HEIGHT_M, 4),
                type=kind,
                size=size,
                rotation=self._rotation(kind, side),
                role=role,
            )
        )

    def _foot(self, x: float, h: float) -> None:
        kind = "foot_chip" if "foot_chip" in self.available else self._pick_type(grabbable=True)
        room_for_big = sum(hold.type in _BIG for hold in self.holds) < MAX_BIG
        if self.spec.wall_type == "slab" and "volume" in self.available and room_for_big and self.rng.random() < 0.15:
            kind = "volume"
        self._place(x, max(h, MAT_M + 0.2), kind, "foot")

    def set_route(self) -> list[RouteHold]:
        spec, rng, d = self.spec, self.rng, self.difficulty
        style = spec.style
        wide = style == "compression"
        points = _path_points(self.path, rng)

        # Where along the path each hand move lands; a dyno gets one long move near the top.
        gaps = [1.0] * spec.moves
        if style == "dyno":
            gaps[max(1, spec.moves - 2)] = 2.6
        total = sum(gaps)
        fractions = list(itertools.accumulate(gap / total for gap in gaps))

        # Start holds: matched, or wide apart for compression.
        (sx, sh), direction = _along(points, 0.0)
        split = 0.55 if wide else 0.22
        normal = (-direction[1], direction[0])
        for side in (-1, 1):
            self._place(sx + side * split * normal[0], sh + side * split * normal[1] * 0.3, self._pick_type(grabbable=True), "start", side)
        self._foot(sx - 0.25, sh - 0.85)
        self._foot(sx + 0.3, sh - 0.95)

        # Hands step along the path, swinging out to alternate sides of it.
        swing = 0.15 + 0.45 * d + (0.15 if style in ("dyno", "power") else 0)
        side = rng.choice((-1, 1))
        for index, fraction in enumerate(fractions):
            last = index == len(fractions) - 1
            (px, ph), direction = _along(points, fraction)
            normal = (-direction[1], direction[0])
            offset = (0.65 + 0.2 * d) if wide else swing * rng.uniform(0.5, 1.1)
            x = px + side * offset * normal[0]
            h = ph + side * offset * normal[1] * 0.4
            if last:
                # One top hold, matched with both hands; it sits on the path rather than out to a side.
                kind = "jug" if style in ("dyno", "juggy", "coordination") and "jug" in self.available else self._top_type()
                self._place(px, ph, kind, "finish", side)
                break
            kind = self._pick_type()
            self._place(x, h, kind, "hand", side)
            skip_feet = style == "power" and self.steepness > 0.5 and rng.random() < 0.4
            if not skip_feet:
                self._foot(x - side * 0.2 + rng.uniform(-0.15, 0.15), h - rng.uniform(0.85, 1.1))
            if spec.wall_type == "slab" or style == "balance":
                self._foot(x + side * 0.45, h - rng.uniform(0.6, 0.8))
            # Technical routes sometimes cross through on the same side.
            if not (style == "technical" and rng.random() < 0.3):
                side = -side
        return self.holds


def generate(spec: GenerateSpec) -> list[RouteHold]:
    return _Setter(spec).set_route()

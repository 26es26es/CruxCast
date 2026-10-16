"""Converting TopLogger's grades and hold colours to CruxCast's."""

from app.constants import COLOURS

# Hex values of our colour keys, for matching TopLogger colours we have no name for.
_COLOUR_HEX = {
    "red": "#ef4444",
    "orange": "#f97316",
    "yellow": "#facc15",
    "green": "#22c55e",
    "mint": "#9bf4ff",
    "blue": "#3b82f6",
    "purple": "#a855f7",
    "pink": "#ec4899",
    "black": "#18181b",
    "white": "#fafafa",
    "grey": "#9ca3af",
    "brown": "#92400e",
}


def grade_name(value: float | None) -> str | None:
    """Converts TopLogger's numeric French grade (e.g. 617) to ours (e.g. "6A+")."""
    if value is None or not 300 <= value <= 900:
        return None
    number, rest = divmod(round(value), 100)
    if number < 5:
        # Below 5A TopLogger uses thirds: 300 = 3A, 333 = 3B, 367 = 3C.
        steps = [(0, "A"), (33, "B"), (67, "C")]
    else:
        steps = [(0, "A"), (17, "A+"), (33, "B"), (50, "B+"), (67, "C"), (83, "C+")]
    _, letter = min(steps, key=lambda step: abs(step[0] - rest))
    return f"{number}{letter}"


def _rgb(hex_colour: str) -> tuple[int, int, int]:
    digits = hex_colour.lstrip("#")[:6]
    return int(digits[0:2], 16), int(digits[2:4], 16), int(digits[4:6], 16)


def colour_key(name: str | None, hex_colour: str | None) -> str:
    """Maps a TopLogger hold colour to one of our colour keys."""
    normalised = (name or "").strip().lower()
    if normalised in COLOURS:
        return normalised
    if not hex_colour:
        return "grey"
    target = _rgb(hex_colour)
    return min(
        _COLOUR_HEX,
        key=lambda key: sum((a - b) ** 2 for a, b in zip(_rgb(_COLOUR_HEX[key]), target)),
    )

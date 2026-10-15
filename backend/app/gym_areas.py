"""Labels for the non-climbing parts of a gym's floor plan.

TopLogger only names the climbing walls. Positions are fractions of the plan's width
and height, measured from the named shapes in the gym's TopLogger SVG (noted per
area), so they line up with the plan the app shows.
"""

from pydantic import BaseModel


class Area(BaseModel):
    # Translation key in the frontend (map.areas.<key>).
    key: str
    # Where the label goes, as fractions of the plan.
    x: float
    y: float
    # How wide the area is, as a fraction of the plan's width.
    width: float
    # The SVG shape the position was measured from.
    svg_id: str


GYM_AREAS: dict[str, list[Area]] = {
    "beest-boulders-delft": [
        # Below the middle of the area, so the map's zoom buttons don't cover it.
        Area(key="training", x=0.931, y=0.21, width=0.137, svg_id="training"),
        Area(key="changing", x=0.91, y=0.447, width=0.18, svg_id="inner-walls-dressing-rooms"),
        Area(key="reception", x=0.902, y=0.816, width=0.137, svg_id="check-in"),
    ],
}

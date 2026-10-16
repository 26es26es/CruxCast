"""Preparing TopLogger's floor-plan SVG for display in an <img>."""

import re

from app.toplogger.models import GymMapUnavailable

_PATH_TOKEN = re.compile(r"[A-Za-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?")


def path_bounds(d: str) -> tuple[float, float, float, float]:
    """Bounding box of an SVG path made of straight lines (M, L, H, V, Z)."""
    tokens = _PATH_TOKEN.findall(d)
    x = y = 0.0
    xs: list[float] = []
    ys: list[float] = []
    command = ""
    i = 0
    while i < len(tokens):
        if tokens[i].isalpha():
            command = tokens[i]
            i += 1
            if command in "Zz":
                continue
        lower = command.lower()
        relative = command.islower()
        if lower in ("m", "l"):
            dx, dy = float(tokens[i]), float(tokens[i + 1])
            x, y = (x + dx, y + dy) if relative else (dx, dy)
            i += 2
            # Extra pairs after a move are implicit line-tos.
            command = "l" if relative else "L"
        elif lower == "h":
            value = float(tokens[i])
            x = x + value if relative else value
            i += 1
        elif lower == "v":
            value = float(tokens[i])
            y = y + value if relative else value
            i += 1
        else:
            raise GymMapUnavailable(f"unsupported path command {command!r} in floor plan")
        xs.append(x)
        ys.append(y)
    if not xs:
        raise GymMapUnavailable("empty floor plan background")
    return min(xs), min(ys), max(xs), max(ys)


def prepare_floorplan(svg: str) -> tuple[str, float, float]:
    """Gives the plan a real size and strips anything that could run as script.

    TopLogger's SVGs have no viewBox; its app sizes them from the "background" shape.
    """
    match = re.search(r"<path\b[^>]*\bid=\"background\"[^>]*>", svg)
    d = re.search(r"\sd=\"([^\"]+)\"", match.group(0)) if match else None
    if d is None:
        raise GymMapUnavailable("floor plan has no background shape")
    min_x, min_y, max_x, max_y = (round(value, 3) for value in path_bounds(d.group(1)))
    width, height = max_x - min_x, max_y - min_y

    svg = re.sub(r"<script\b.*?</script\s*>", "", svg, flags=re.DOTALL | re.IGNORECASE)
    svg = re.sub(r"\son[a-z]+\s*=\s*(\"[^\"]*\"|'[^']*')", "", svg, flags=re.IGNORECASE)
    root = re.search(r"<svg\b[^>]*>", svg)
    if root is None:
        raise GymMapUnavailable("floor plan is not an SVG")
    attributes = re.sub(r"\s(width|height|viewBox|class)=\"[^\"]*\"", "", root.group(0)[4:-1])
    new_root = (
        f'<svg{attributes} viewBox="{min_x:g} {min_y:g} {width:g} {height:g}" '
        f'width="{width:g}" height="{height:g}">'
    )
    return svg[: root.start()] + new_root + svg[root.end() :], width, height

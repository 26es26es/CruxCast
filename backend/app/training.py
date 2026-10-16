"""Rule-based advice for a training session: warm-up, main session and cool-down.

The plan starts from a template per session type and is adjusted by the climber's
last two logged sessions (how recent, how hard, how long, what grades they sent).
Every adjustment adds a reason, so the app can explain the advice.

Output is structured (step keys, minutes and parameters) rather than prose, so the
frontend can show it in English or Dutch, and an AI layer could rewrite it later.
"""

from dataclasses import dataclass, field
from datetime import date
from typing import Literal

from pydantic import BaseModel

from app.constants import GRADES

SessionType = Literal["gym_workout", "power_bouldering", "calm_bouldering", "board", "rest"]
SESSION_TYPES: tuple[str, ...] = ("gym_workout", "power_bouldering", "calm_bouldering", "board", "rest")

# How taxing each type is, 0 (rest) to 3 (limit climbing).
INTENSITY = {"power_bouldering": 3, "board": 3, "gym_workout": 2, "calm_bouldering": 1, "rest": 0}
# Types that load the fingers hardest.
FINGER_HEAVY = {"power_bouldering", "board"}
CLIMBING = {"power_bouldering", "board", "calm_bouldering"}
# Load at or above this counts as a hard session (e.g. power bouldering at effort 7+).
HARD_LOAD = 2.1
DEFAULT_EFFORT = 7


@dataclass
class PastClimb:
    grade: str | None
    sent: bool
    attempts: int


@dataclass
class PastSession:
    session_type: str
    date: date
    duration_min: int | None
    effort: int | None
    climbs: list[PastClimb] = field(default_factory=list)

    @property
    def load(self) -> float:
        """Intensity scaled by how hard it felt, 0 to 3."""
        return INTENSITY[self.session_type] * (self.effort or DEFAULT_EFFORT) / 10


class Step(BaseModel):
    # Translation key for the step (training.steps.<key>).
    key: str
    minutes: int
    params: dict[str, str | int] = {}


class Reason(BaseModel):
    # Translation key explaining an adjustment (training.reasons.<code>).
    code: str
    params: dict[str, str | int] = {}


class Advice(BaseModel):
    session_type: str
    intensity: Literal["low", "medium", "high"]
    total_minutes: int
    warm_up: list[Step]
    main: list[Step]
    cool_down: list[Step]
    reasons: list[Reason]
    # A different session type that would suit better today, if any.
    suggest_instead: list[str] = []


# Template per type: warm-up, main and cool-down steps as (key, minutes).
_TEMPLATES: dict[str, tuple[list[tuple[str, int]], list[tuple[str, int]], list[tuple[str, int]]]] = {
    "power_bouldering": (
        [("pulse", 5), ("mobility", 5), ("easy_climbs", 10), ("ramp_up", 5)],
        [("limit_boulders", 50)],
        [("flush_climbing", 5), ("stretch_upper", 8)],
    ),
    "calm_bouldering": (
        [("pulse", 5), ("mobility", 5), ("easy_climbs", 8)],
        [("volume_climbs", 45), ("technique_drills", 15)],
        [("stretch_full", 8)],
    ),
    "board": (
        [("pulse", 5), ("mobility", 5), ("finger_warmup", 8), ("easy_climbs", 7), ("board_ramp", 5)],
        [("board_limit", 45)],
        [("flush_climbing", 5), ("stretch_upper", 8)],
    ),
    "gym_workout": (
        [("light_cardio", 8), ("dynamic_mobility", 6)],
        [("strength_pull", 15), ("strength_push", 15), ("core", 10), ("legs", 10)],
        [("stretch_full", 10)],
    ),
    "rest": (
        [],
        [("mobility_flow", 15), ("antagonist_bands", 10), ("easy_cardio", 15)],
        [],
    ),
}


def _grade_range(low: int, high: int) -> str:
    low = max(0, min(low, len(GRADES) - 1))
    high = max(0, min(high, len(GRADES) - 1))
    return GRADES[low] if low == high else f"{GRADES[low]}–{GRADES[high]}"


def _best_grade(history: list[PastSession]) -> int | None:
    """Index of the hardest grade sent recently, else the hardest tried."""
    sent = [GRADES.index(c.grade) for s in history for c in s.climbs if c.grade and c.sent]
    if sent:
        return max(sent)
    tried = [GRADES.index(c.grade) for s in history for c in s.climbs if c.grade]
    return max(tried) - 1 if tried else None


def _round5(minutes: float) -> int:
    return max(5, int(round(minutes / 5)) * 5)


def advise(session_type: str, on: date, history: list[PastSession]) -> Advice:
    """Plan a session of `session_type` on date `on`, given the last logged sessions
    (most recent first; only the last two are used)."""
    history = sorted((s for s in history if s.date <= on), key=lambda s: s.date, reverse=True)[:2]
    warm, main, cool = (list(part) for part in _TEMPLATES[session_type])
    warm_extra = 0
    main_factor = 1.0
    reasons: list[Reason] = []
    suggest: list[str] = []
    params: dict[str, dict[str, str | int]] = {}

    hard_type = session_type in FINGER_HEAVY
    days = [(on - s.date).days for s in history]

    if not history:
        reasons.append(Reason(code="no_history"))
    else:
        last, last_days = history[0], days[0]
        recent_hard = [s for s, d in zip(history, days) if d <= 3 and s.load >= HARD_LOAD]

        if hard_type and last_days <= 1 and last.load >= HARD_LOAD:
            main_factor *= 0.6
            suggest = ["calm_bouldering", "rest"]
            reasons.append(Reason(code="hard_yesterday", params={"type": last.session_type, "days": last_days}))
        elif hard_type and len(recent_hard) == 2:
            main_factor *= 0.75
            suggest = ["calm_bouldering", "rest"]
            reasons.append(Reason(code="two_hard_in_a_row"))
        elif session_type == "calm_bouldering" and recent_hard:
            reasons.append(Reason(code="good_recovery_choice"))
        elif session_type == "rest" and recent_hard:
            reasons.append(Reason(code="rest_well_timed"))

        if session_type in CLIMBING and last.session_type in FINGER_HEAVY and last_days <= 2:
            warm_extra += 5
            reasons.append(Reason(code="fingers_recent", params={"type": last.session_type, "days": last_days}))

        if session_type == "gym_workout" and last.session_type in FINGER_HEAVY and last_days <= 1:
            # Back and forearms are still tired: lighter pulling, more push and legs.
            main = [(key, round(m * 0.6) if key == "strength_pull" else m) for key, m in main]
            reasons.append(Reason(code="upper_body_tired", params={"type": last.session_type}))

        if last_days >= 7:
            warm_extra += 5
            main_factor *= 0.85
            reasons.append(Reason(code="long_break", params={"days": last_days}))
        elif last_days >= 3 and not recent_hard and session_type != "rest":
            main_factor *= 1.1
            reasons.append(Reason(code="fresh", params={"days": last_days}))

        if any((s.duration_min or 0) >= 120 and (s.effort or 0) >= 8 for s in history):
            main_factor = min(main_factor, 0.8)
            reasons.append(Reason(code="long_hard_sessions"))

        if hard_type and len(history) == 2 and all(s.session_type == session_type for s in history):
            reasons.append(Reason(code="add_variety", params={"type": session_type}))

        tries = [c for c in last.climbs]
        if len(tries) >= 4 and sum(c.sent for c in tries) / len(tries) < 0.3 and session_type in CLIMBING:
            params.setdefault("limit_boulders", {})["rest"] = 5
            params.setdefault("board_limit", {})["rest"] = 5
            reasons.append(Reason(code="low_send_rate", params={"sent": sum(c.sent for c in tries), "tried": len(tries)}))

    best = _best_grade(history)
    if best is not None and session_type in CLIMBING:
        params.setdefault("easy_climbs", {})["grades"] = _grade_range(best - 9, best - 6)
        params.setdefault("volume_climbs", {})["grades"] = _grade_range(best - 4, best - 2)
        params.setdefault("limit_boulders", {})["grades"] = _grade_range(best - 1, best + 1)
        params.setdefault("board_limit", {})["grades"] = _grade_range(best - 2, best)
        reasons.append(Reason(code="grades_from_history", params={"grade": GRADES[best]}))

    if warm_extra:
        # Spend the extra warm-up time on the step that prepares the fingers.
        target = next((k for k in ("finger_warmup", "ramp_up", "easy_climbs") if any(k == w for w, _ in warm)), None)
        warm = [(key, m + warm_extra if key == target else m) for key, m in warm]

    steps = lambda part, scale=1.0: [  # noqa: E731
        Step(key=key, minutes=_round5(m * scale), params=params.get(key, {})) for key, m in part
    ]
    warm_steps, main_steps, cool_steps = steps(warm), steps(main, main_factor), steps(cool)
    total = sum(s.minutes for s in warm_steps + main_steps + cool_steps)

    base = INTENSITY[session_type]
    intensity = "high" if base >= 3 and main_factor >= 0.75 else "low" if base <= 1 or main_factor < 0.75 else "medium"
    return Advice(
        session_type=session_type,
        intensity=intensity,
        total_minutes=total,
        warm_up=warm_steps,
        main=main_steps,
        cool_down=cool_steps,
        reasons=reasons,
        suggest_instead=suggest,
    )

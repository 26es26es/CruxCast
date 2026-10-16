"""Rule-based advice for a training session: warm-up, main session and cool-down.

The plan starts from a template per session type and is adjusted by the climber's
last two logged sessions (how recent, how hard, how long, what grades they sent).
Every adjustment adds a reason, so the app can explain the advice.

Output is structured (step keys, minutes and parameters) rather than prose, so the
frontend can show it in English or Dutch, and an AI layer could rewrite it later.
"""

from collections.abc import Callable
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


def _round5(minutes: float) -> int:
    return max(5, round(minutes / 5) * 5)


# ---------- Planning ----------


@dataclass
class PlanContext:
    """What the rules know: the requested session and the recent history."""

    session_type: str
    on: date
    # The last logged sessions, most recent first (at most two).
    history: list[PastSession]

    @property
    def hard_type(self) -> bool:
        return self.session_type in FINGER_HEAVY

    @property
    def climbing(self) -> bool:
        return self.session_type in CLIMBING

    @property
    def last(self) -> PastSession:
        return self.history[0]

    def days_since(self, session: PastSession) -> int:
        return (self.on - session.date).days

    @property
    def last_days(self) -> int:
        return self.days_since(self.last)

    @property
    def recent_hard(self) -> list[PastSession]:
        return [s for s in self.history if self.days_since(s) <= 3 and s.load >= HARD_LOAD]

    def best_grade(self) -> int | None:
        """Index of the hardest grade sent recently, else just below the hardest tried."""
        sent = [GRADES.index(c.grade) for s in self.history for c in s.climbs if c.grade and c.sent]
        if sent:
            return max(sent)
        tried = [GRADES.index(c.grade) for s in self.history for c in s.climbs if c.grade]
        return max(tried) - 1 if tried else None


class PlanDraft:
    """A session plan being adjusted by the rules, turned into Advice at the end."""

    def __init__(self, session_type: str) -> None:
        warm, main, cool = _TEMPLATES[session_type]
        self.session_type = session_type
        self.warm = list(warm)
        self.main = list(main)
        self.cool = list(cool)
        self.warm_extra = 0
        self.main_factor = 1.0
        self.reasons: list[Reason] = []
        self.suggest: list[str] = []
        self.params: dict[str, dict[str, str | int]] = {}

    def because(self, code: str, **params: str | int) -> None:
        self.reasons.append(Reason(code=code, params=params))

    def set_param(self, step: str, name: str, value: str | int) -> None:
        self.params.setdefault(step, {})[name] = value

    def scale_step(self, step: str, factor: float) -> None:
        self.main = [(key, round(m * factor) if key == step else m) for key, m in self.main]

    def to_advice(self) -> Advice:
        warm = self.warm
        if self.warm_extra:
            # Spend the extra warm-up time on the step that prepares the fingers.
            keys = [key for key, _ in warm]
            target = next((k for k in ("finger_warmup", "ramp_up", "easy_climbs") if k in keys), None)
            warm = [(key, m + self.warm_extra if key == target else m) for key, m in warm]

        def steps(part: list[tuple[str, int]], scale: float = 1.0) -> list[Step]:
            return [Step(key=key, minutes=_round5(m * scale), params=self.params.get(key, {})) for key, m in part]

        warm_steps, main_steps, cool_steps = steps(warm), steps(self.main, self.main_factor), steps(self.cool)
        base = INTENSITY[self.session_type]
        if base >= 3 and self.main_factor >= 0.75:
            intensity = "high"
        elif base <= 1 or self.main_factor < 0.75:
            intensity = "low"
        else:
            intensity = "medium"
        return Advice(
            session_type=self.session_type,
            intensity=intensity,
            total_minutes=sum(s.minutes for s in warm_steps + main_steps + cool_steps),
            warm_up=warm_steps,
            main=main_steps,
            cool_down=cool_steps,
            reasons=self.reasons,
            suggest_instead=self.suggest,
        )


# ---------- Rules ----------
# Each rule looks at the context and may adjust the draft, adding a reason when it does.
# They run in order, only when there is history to go on.

Rule = Callable[[PlanContext, PlanDraft], None]


def recovery(ctx: PlanContext, draft: PlanDraft) -> None:
    """Shorter hard sessions straight after hard climbing; praise for resting."""
    if ctx.hard_type and ctx.last_days <= 1 and ctx.last.load >= HARD_LOAD:
        draft.main_factor *= 0.6
        draft.suggest = ["calm_bouldering", "rest"]
        draft.because("hard_yesterday", type=ctx.last.session_type, days=ctx.last_days)
    elif ctx.hard_type and len(ctx.recent_hard) == 2:
        draft.main_factor *= 0.75
        draft.suggest = ["calm_bouldering", "rest"]
        draft.because("two_hard_in_a_row")
    elif ctx.session_type == "calm_bouldering" and ctx.recent_hard:
        draft.because("good_recovery_choice")
    elif ctx.session_type == "rest" and ctx.recent_hard:
        draft.because("rest_well_timed")


def tired_fingers(ctx: PlanContext, draft: PlanDraft) -> None:
    """A longer finger warm-up after a finger-heavy session in the last two days."""
    if ctx.climbing and ctx.last.session_type in FINGER_HEAVY and ctx.last_days <= 2:
        draft.warm_extra += 5
        draft.because("fingers_recent", type=ctx.last.session_type, days=ctx.last_days)


def tired_back(ctx: PlanContext, draft: PlanDraft) -> None:
    """Less pulling in the gym the day after hard climbing."""
    if ctx.session_type == "gym_workout" and ctx.last.session_type in FINGER_HEAVY and ctx.last_days <= 1:
        draft.scale_step("strength_pull", 0.6)
        draft.because("upper_body_tired", type=ctx.last.session_type)


def time_since_last(ctx: PlanContext, draft: PlanDraft) -> None:
    """Ease back in after a long break; do a bit more when well rested."""
    if ctx.last_days >= 7:
        draft.warm_extra += 5
        draft.main_factor *= 0.85
        draft.because("long_break", days=ctx.last_days)
    elif ctx.last_days >= 3 and not ctx.recent_hard and ctx.session_type != "rest":
        draft.main_factor *= 1.1
        draft.because("fresh", days=ctx.last_days)


def long_hard_sessions(ctx: PlanContext, draft: PlanDraft) -> None:
    if any((s.duration_min or 0) >= 120 and (s.effort or 0) >= 8 for s in ctx.history):
        draft.main_factor = min(draft.main_factor, 0.8)
        draft.because("long_hard_sessions")


def variety(ctx: PlanContext, draft: PlanDraft) -> None:
    if ctx.hard_type and len(ctx.history) == 2 and all(s.session_type == ctx.session_type for s in ctx.history):
        draft.because("add_variety", type=ctx.session_type)


def send_rate(ctx: PlanContext, draft: PlanDraft) -> None:
    """More rest between attempts after a session with few sends."""
    tries = ctx.last.climbs
    if ctx.climbing and len(tries) >= 4 and sum(c.sent for c in tries) / len(tries) < 0.3:
        draft.set_param("limit_boulders", "rest", 5)
        draft.set_param("board_limit", "rest", 5)
        draft.because("low_send_rate", sent=sum(c.sent for c in tries), tried=len(tries))


HISTORY_RULES: tuple[Rule, ...] = (
    recovery,
    tired_fingers,
    tired_back,
    time_since_last,
    long_hard_sessions,
    variety,
    send_rate,
)


def target_grades(ctx: PlanContext, draft: PlanDraft) -> None:
    """Grade ranges for each kind of climbing, from the hardest recent send."""
    best = ctx.best_grade()
    if best is None or not ctx.climbing:
        return
    draft.set_param("easy_climbs", "grades", _grade_range(best - 9, best - 6))
    draft.set_param("volume_climbs", "grades", _grade_range(best - 4, best - 2))
    draft.set_param("limit_boulders", "grades", _grade_range(best - 1, best + 1))
    draft.set_param("board_limit", "grades", _grade_range(best - 2, best))
    draft.because("grades_from_history", grade=GRADES[best])


def advise(session_type: str, on: date, history: list[PastSession]) -> Advice:
    """Plan a session of `session_type` on date `on`, given the last logged sessions
    (most recent first; only the last two up to that date are used)."""
    recent = sorted((s for s in history if s.date <= on), key=lambda s: s.date, reverse=True)[:2]
    ctx = PlanContext(session_type, on, recent)
    draft = PlanDraft(session_type)
    if recent:
        for rule in HISTORY_RULES:
            rule(ctx, draft)
    else:
        draft.because("no_history")
    target_grades(ctx, draft)
    return draft.to_advice()

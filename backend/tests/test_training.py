from datetime import date, timedelta

import pytest

from app.training import PastClimb, PastSession, advise

TODAY = date(2026, 10, 16)


def past(kind, days_ago, effort=7, duration=90, climbs=()):
    return PastSession(kind, TODAY - timedelta(days=days_ago), duration, effort, list(climbs))


def codes(advice):
    return [r.code for r in advice.reasons]


def minutes(steps, key):
    return next(s.minutes for s in steps if s.key == key)


@pytest.mark.parametrize("kind", ["gym_workout", "power_bouldering", "calm_bouldering", "board", "rest"])
def test_every_type_has_a_plan(kind):
    advice = advise(kind, TODAY, [])
    assert advice.main and advice.total_minutes == sum(s.minutes for s in advice.warm_up + advice.main + advice.cool_down)
    assert codes(advice) == ["no_history"]


def test_hard_session_yesterday_shortens_power_and_suggests_easier():
    fresh = advise("power_bouldering", TODAY, [])
    tired = advise("power_bouldering", TODAY, [past("board", 1, effort=8)])
    assert minutes(tired.main, "limit_boulders") < minutes(fresh.main, "limit_boulders")
    assert "hard_yesterday" in codes(tired)
    assert tired.suggest_instead == ["calm_bouldering", "rest"]
    assert tired.intensity == "low"


def test_two_hard_sessions_in_a_row():
    advice = advise("board", TODAY, [past("power_bouldering", 2, 8), past("board", 3, 8)])
    assert "two_hard_in_a_row" in codes(advice)
    assert advice.suggest_instead


def test_recent_finger_load_lengthens_finger_warm_up():
    fresh = advise("board", TODAY, [])
    after = advise("board", TODAY, [past("power_bouldering", 2, effort=5)])
    assert minutes(after.warm_up, "finger_warmup") == minutes(fresh.warm_up, "finger_warmup") + 5
    assert "fingers_recent" in codes(after)


def test_calm_session_after_hard_days_is_praised():
    assert "good_recovery_choice" in codes(advise("calm_bouldering", TODAY, [past("board", 1, 9)]))


def test_gym_after_board_goes_easy_on_pulling():
    fresh = advise("gym_workout", TODAY, [])
    after = advise("gym_workout", TODAY, [past("board", 0, 8)])
    assert minutes(after.main, "strength_pull") < minutes(fresh.main, "strength_pull")
    assert "upper_body_tired" in codes(after)


def test_long_break_means_longer_warm_up_and_shorter_session():
    fresh = advise("calm_bouldering", TODAY, [])
    back = advise("calm_bouldering", TODAY, [past("calm_bouldering", 10)])
    assert "long_break" in codes(back)
    assert sum(s.minutes for s in back.warm_up) > sum(s.minutes for s in fresh.warm_up)
    assert minutes(back.main, "volume_climbs") < minutes(fresh.main, "volume_climbs")


def test_rested_climber_gets_a_bit_more():
    rested = advise("power_bouldering", TODAY, [past("rest", 3, effort=2), past("calm_bouldering", 5, effort=4)])
    assert "fresh" in codes(rested)
    assert minutes(rested.main, "limit_boulders") > minutes(advise("power_bouldering", TODAY, []).main, "limit_boulders")


def test_grades_come_from_recent_sends():
    climbs = [PastClimb("6C", True, 2), PastClimb("7A", True, 4), PastClimb("7A+", False, 6)]
    advice = advise("power_bouldering", TODAY, [past("calm_bouldering", 4, climbs=climbs)])
    limit = next(s for s in advice.main if s.key == "limit_boulders")
    assert limit.params["grades"] == "6C+–7A+"
    assert "grades_from_history" in codes(advice)


def test_low_send_rate_adds_rest_between_attempts():
    climbs = [PastClimb("7A", False, 5)] * 5
    advice = advise("power_bouldering", TODAY, [past("calm_bouldering", 4, climbs=climbs)])
    assert "low_send_rate" in codes(advice)
    assert next(s for s in advice.main if s.key == "limit_boulders").params["rest"] == 5


def test_only_last_two_sessions_and_not_future_ones_count():
    history = [past("board", 1, 9), past("rest", 3), past("rest", 4), PastSession("board", TODAY + timedelta(days=1), 60, 9)]
    advice = advise("calm_bouldering", TODAY, history)
    assert "good_recovery_choice" in codes(advice)

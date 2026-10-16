"""A gym's floor plan and current boulders, read from TopLogger.

When TopLogger changes its API format, the fix belongs in client.py;
tests/test_toplogger_live.py detects it.
"""

from app.toplogger.client import TopLoggerClient
from app.toplogger.conversions import colour_key, grade_name
from app.toplogger.models import GymMap, GymMapUnavailable, MapClimb, Option, Tag, Wall
from app.toplogger.service import GymMapService

# The app's shared service; tests build their own with a fake fetcher.
gym_maps = GymMapService(TopLoggerClient().fetch)

__all__ = [
    "GymMap",
    "GymMapService",
    "GymMapUnavailable",
    "MapClimb",
    "Option",
    "Tag",
    "TopLoggerClient",
    "Wall",
    "colour_key",
    "grade_name",
    "gym_maps",
]

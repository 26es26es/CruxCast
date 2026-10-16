"""Serves gym maps from a cache, falling back to the last good copy.

A good copy is reused for a few minutes. If a refresh fails for any reason, the last
good copy keeps being served (marked stale) and the reason is logged; retries are
spaced out while TopLogger is failing. Copies live in memory only.
"""

import logging
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass

import httpx
from pydantic import ValidationError

from app.toplogger.models import GymMap, GymMapUnavailable

logger = logging.getLogger(__name__)

Fetcher = Callable[[str], tuple[GymMap, str]]

# Everything a failing or changed TopLogger API can raise while fetching.
_FETCH_ERRORS = (GymMapUnavailable, httpx.HTTPError, ValidationError, KeyError, TypeError, ValueError)


@dataclass
class _Snapshot:
    gym_map: GymMap
    floorplan: str
    fetched_at: float


class GymMapService:
    def __init__(
        self,
        fetch: Fetcher,
        refresh_seconds: float = 10 * 60,
        retry_seconds: float = 2 * 60,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._fetch = fetch
        self.refresh_seconds = refresh_seconds
        self.retry_seconds = retry_seconds
        self._clock = clock
        self._snapshots: dict[str, _Snapshot] = {}
        self._failed_at: dict[str, float] = {}
        # Held while talking to TopLogger so concurrent requests share one fetch.
        self._lock = threading.Lock()

    def get_map(self, slug: str) -> GymMap:
        return self._load(slug)[0]

    def get_floorplan(self, slug: str) -> str:
        """The gym's floor plan with a viewBox, safe to show in an <img>."""
        return self._load(slug)[1]

    def _load(self, slug: str) -> tuple[GymMap, str]:
        with self._lock:
            now = self._clock()
            snapshot = self._snapshots.get(slug)
            if snapshot and now - snapshot.fetched_at < self.refresh_seconds:
                return snapshot.gym_map, snapshot.floorplan
            failed_at = self._failed_at.get(slug)
            if snapshot and failed_at is not None and now - failed_at < self.retry_seconds:
                return self._stale(snapshot)

            try:
                gym_map, floorplan = self._fetch(slug)
                if snapshot and snapshot.gym_map.climbs and not gym_map.climbs:
                    # More likely a format change than the whole gym being stripped.
                    raise GymMapUnavailable("TopLogger returned no climbs")
            except _FETCH_ERRORS as error:
                self._failed_at[slug] = now
                if snapshot is None:
                    logger.error("Could not load the TopLogger map for %s: %s", slug, error)
                    raise GymMapUnavailable(str(error)) from error
                logger.warning(
                    "TopLogger refresh failed for %s, serving the copy from %s: %s",
                    slug,
                    snapshot.gym_map.updated_at.isoformat(timespec="minutes"),
                    error,
                )
                return self._stale(snapshot)

            self._snapshots[slug] = _Snapshot(gym_map, floorplan, now)
            self._failed_at.pop(slug, None)
            return gym_map, floorplan

    @staticmethod
    def _stale(snapshot: _Snapshot) -> tuple[GymMap, str]:
        return snapshot.gym_map.model_copy(update={"stale": True}), snapshot.floorplan

import re
from pathlib import Path
from typing import BinaryIO
from uuid import uuid4

from app.config import settings

_CHUNK_SIZE = 1024 * 1024
_SAFE_SUFFIX = re.compile(r"^\.[a-z0-9]{1,5}$")


class VideoTooLarge(Exception):
    pass


def _videos_dir() -> Path:
    path = settings.upload_dir / "videos"
    path.mkdir(parents=True, exist_ok=True)
    return path


def video_path(filename: str) -> Path:
    return _videos_dir() / filename


def save_video(source: BinaryIO, original_name: str | None) -> str:
    """Copy an uploaded video to disk and return its stored filename."""
    suffix = Path(original_name or "").suffix.lower()
    if not _SAFE_SUFFIX.match(suffix):
        suffix = ""
    filename = f"{uuid4().hex}{suffix}"
    destination = video_path(filename)
    max_bytes = settings.max_video_mb * 1024 * 1024
    written = 0
    try:
        with destination.open("wb") as out:
            while chunk := source.read(_CHUNK_SIZE):
                written += len(chunk)
                if written > max_bytes:
                    raise VideoTooLarge
                out.write(chunk)
    except BaseException:
        destination.unlink(missing_ok=True)
        raise
    return filename


def delete_video(filename: str | None) -> None:
    if filename:
        video_path(filename).unlink(missing_ok=True)


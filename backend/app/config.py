from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://cruxcast:cruxcast@localhost:5432/cruxcast"
    jwt_secret: str = "dev-secret-change-me"
    session_days: int = 30
    # Set to true when the app is served over HTTPS.
    cookie_secure: bool = False
    upload_dir: Path = Path("uploads")
    max_video_mb: int = 500


settings = Settings()

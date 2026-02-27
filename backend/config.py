from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = ""

    # Google Gemini AI
    google_api_key: str = ""

    # NextAuth JWT validation
    nextauth_secret: str = ""

    # ServiceNow
    servicenow_base_url: str = ""
    servicenow_user_id: str = ""
    servicenow_password: str = ""

    # SharePoint
    sharepoint_tenant_id: str = ""
    sharepoint_client_id: str = ""
    sharepoint_client_secret: str = ""
    sharepoint_site: str = ""

    # CORS
    frontend_url: str = "http://localhost:3000"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }

    @property
    def async_database_url(self) -> str:
        """Convert postgres:// to postgresql+asyncpg:// for async SQLAlchemy."""
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        # Remove sslmode query param (asyncpg uses ssl= instead)
        if "?sslmode=" in url:
            url = url.split("?sslmode=")[0] + "?ssl=require"
        elif "&sslmode=" in url:
            url = url.replace("&sslmode=require", "&ssl=require")
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()

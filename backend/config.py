"""
Central settings — reads from .env via pydantic-settings.
Import `settings` everywhere; never use os.getenv() directly.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./grabinsurance.db"

    # OpenAI — used for LLM scoring via LangChain
    OPENAI_API_KEY: str = ""

    # Anthropic (kept for backwards compat, no longer used for scoring)
    ANTHROPIC_API_KEY: str = ""

    # LangSmith (leave blank → tracing disabled)
    LANGCHAIN_API_KEY: str = ""
    LANGCHAIN_TRACING_V2: bool = False
    LANGCHAIN_PROJECT: str = "grabinsurance-dev"

    # Mock insurer behaviour
    MOCK_INSURER_SCENARIO: str = "normal"  # normal | timeout | decline | policy_fail
    WEBHOOK_BASE_URL: str = "http://localhost:8000"

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://frontend:3000"

    # Server
    BACKEND_PORT: int = 8000

    class Config:
        env_file = (".env", "../.env")  # backend/ for Docker, project root for local dev
        extra = "ignore"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def llm_enabled(self) -> bool:
        return bool(self.OPENAI_API_KEY)


settings = Settings()

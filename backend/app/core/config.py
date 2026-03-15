from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_anon_key: str = ""

    # Clerk
    clerk_secret_key: str = ""
    clerk_publishable_key: str = ""
    clerk_jwks_url: str = ""

    # Gemini
    gemini_api_key: str = ""

    # GitHub
    github_webhook_secret: str = ""
    github_access_token: str = ""

    # Moorcheh
    moorcheh_api_key: str = ""

    # AI Settings
    confidence_threshold: float = 0.82
    embedding_model: str = "text-embedding-004"

    # App
    app_base_url: str = "http://localhost:8000"


settings = Settings()
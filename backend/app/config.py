from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: str = ""
    supabase_schema: str = "moksha_collection"
    supabase_db_password: str = ""

    zoho_client_id: str = ""
    zoho_client_secret: str = ""
    zoho_refresh_token: str = ""
    zoho_organization_id: str = ""
    zoho_inventory_sync_interval_seconds: int = 3600
    zoho_offline_sale_webhook_secret: str = ""

    jwt_secret_key: str = "dev-only-insecure-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60 * 24 * 14  # 14 days

    admin_password: str = "admin"
    admin_jwt_expires_minutes: int = 60 * 12  # 12 hours

    # Dedicated Zoho Mail OAuth app for info@ transactional emails.
    info_zoho_client_id: str = ""
    info_zoho_client_secret: str = ""
    info_zoho_refresh_token: str = ""
    info_zoho_accounts_url: str = "https://accounts.zoho.com"
    info_zoho_mail_api_url: str = "https://mail.zoho.com"
    info_zoho_from_email: str = ""

    # Dedicated Zoho Mail OAuth app for sales@ order and campaign emails.
    sales_zoho_client_id: str = ""
    sales_zoho_client_secret: str = ""
    sales_zoho_refresh_token: str = ""
    sales_zoho_accounts_url: str = "https://accounts.zoho.com"
    sales_zoho_mail_api_url: str = "https://mail.zoho.com"
    sales_zoho_from_email: str = ""

    password_reset_code_expires_minutes: int = 15

    frontend_base_url: str = "https://mokshacollections.com"

    port: int = 8000
    allowed_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

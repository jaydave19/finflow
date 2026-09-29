import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "FinFlow API"
    PROJECT_VERSION: str = "1.0.0"
    
    # Database URL: Supports PostgreSQL (Neon, Supabase, Render, Railway, AWS RDS)
    # Default fallback to SQLite if no external PostgreSQL is provided
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./finflow.db")
    
    # JWT Secrets
    JWT_ACCESS_SECRET: str = os.getenv("JWT_ACCESS_SECRET", "finflow-jwt-access-secret-2026")
    JWT_REFRESH_SECRET: str = os.getenv("JWT_REFRESH_SECRET", "finflow-jwt-refresh-secret-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()

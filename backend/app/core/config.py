from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "LoongChip-Maintain"
    DEBUG: bool = True

    # JWT
    JWT_SECRET: str = "change-me-in-prod"
    JWT_ALG: str = "HS256"
    JWT_EXPIRE_MIN: int = 60 * 24

    # DB
    DB_URL: str = "sqlite:///./loongchip.db"

    # DashScope (通义千问)
    DASHSCOPE_API_KEY: str = ""
    LLM_TEXT_MODEL: str = "qwen-plus"
    LLM_VL_MODEL: str = "qwen-vl-max"
    EMB_MODEL: str = "text-embedding-v3"

    # Vector DB
    CHROMA_DIR: str = "./chroma_db"
    COLLECTION: str = "maintenance_kb"

    UPLOAD_DIR: str = "./uploads"

    class Config:
        env_file = ".env"


settings = Settings()

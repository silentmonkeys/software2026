from pydantic_settings import BaseSettings


import warnings

class Settings(BaseSettings):
    APP_NAME: str = "LoongChip-Maintain"
    DEBUG: bool = False

    # JWT
    JWT_SECRET: str = "change-me-in-prod"
    JWT_ALG: str = "HS256"
    JWT_EXPIRE_MIN: int = 60 * 24

    # DB
    DB_URL: str = "sqlite:///./loongchip.db"

    # CORS
    CORS_ORIGINS: str = "*"

    # DashScope (通义千问)
    DASHSCOPE_API_KEY: str = ""
    LLM_TEXT_MODEL: str = "qwen-plus"
    LLM_VL_MODEL: str = "qwen-vl-max"
    EMB_MODEL: str = "text-embedding-v3"

    # Vector DB
    CHROMA_DIR: str = "./chroma_db"
    COLLECTION: str = "maintenance_kb"

    UPLOAD_DIR: str = "./uploads"
    EXTRACTED_IMAGE_DIR: str = "./uploads/extracted_images"

    class Config:
        env_file = ".env"


settings = Settings()

# 生产环境安全检查
if settings.JWT_SECRET == "change-me-in-prod":
    warnings.warn(
        "\n⚠️  安全警告：JWT_SECRET 仍为默认值 'change-me-in-prod'！\n"
        "   生产部署前请在 .env 文件中设置强随机 JWT_SECRET。\n"
        "   生成随机密钥：python -c \"import secrets; print(secrets.token_hex(32))\"",
        RuntimeWarning
    )
if settings.DEBUG:
    import logging
    logging.warning("DEBUG 模式已开启，生产环境请设置 DEBUG=false")

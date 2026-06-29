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

# 将相对路径目录统一解析为绝对路径（避免 CWD 不一致导致文件找不到）
# __file__ = backend/app/core/config.py → 往上 3 层到 backend/
import os as _os
_base = _os.path.dirname(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))))
for _key in ("UPLOAD_DIR", "EXTRACTED_IMAGE_DIR", "CHROMA_DIR"):
    _val = getattr(settings, _key, "")
    if isinstance(_val, str) and _val and not _os.path.isabs(_val):
        setattr(settings, _key, _os.path.abspath(_os.path.join(_base, _val)))
# DB_URL 用绝对路径 + 正斜杠（避免 Windows 反斜杠被 SQLAlchemy 误解析）
_val = settings.DB_URL
if _val.startswith("sqlite:///"):
    _path = _val[len("sqlite:///"):].lstrip("./\\")
    _abs = _os.path.abspath(_os.path.join(_base, _path)).replace("\\", "/")
    settings.DB_URL = f"sqlite:///{_abs}"

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

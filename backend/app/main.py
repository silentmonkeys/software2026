from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.db import Base, engine, SessionLocal
from app.core.config import settings
from app.api import auth, kb, chat, ticket, kg, admin
from app import models  # noqa: register

Base.metadata.create_all(bind=engine)

# FIX4 第 4 项：启动时确保有默认 admin 账号（admin / admin123）
def _seed_default_admin():
    db = SessionLocal()
    try:
        admin.ensure_default_admin(db)
    finally:
        db.close()
_seed_default_admin()

app = FastAPI(title=settings.APP_NAME)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(kb.router)
app.include_router(chat.router)
app.include_router(ticket.router)
app.include_router(ticket.workflow_router)
app.include_router(kg.router)
app.include_router(admin.router)


@app.get("/api/health")
def health():
    return {"ok": True, "app": settings.APP_NAME}

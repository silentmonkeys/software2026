from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.db import Base, engine
from app.core.config import settings
from app.api import auth, kb, chat, ticket
from app import models  # noqa: register

Base.metadata.create_all(bind=engine)

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


@app.get("/api/health")
def health():
    return {"ok": True, "app": settings.APP_NAME}

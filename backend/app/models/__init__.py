from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from app.core.db import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    password_hash = Column(String(256), nullable=False)
    role = Column(String(16), default="worker")  # worker / leader / admin
    created_at = Column(DateTime, default=datetime.utcnow)


class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True)
    title = Column(String(256), nullable=False)
    file_path = Column(String(512), nullable=False)
    type = Column(String(16))  # pdf / docx / image
    status = Column(String(16), default="ready")  # ready / parsing / failed
    uploader_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)


class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(Integer, primary_key=True)
    device = Column(String(128))
    fault = Column(String(512))
    steps = Column(JSON)
    status = Column(String(16), default="open")  # open / doing / done
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)


class QALog(Base):
    __tablename__ = "qa_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    question = Column(Text)
    answer = Column(Text)
    sources = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

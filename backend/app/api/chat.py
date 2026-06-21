import os, shutil, uuid
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, Depends
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.config import settings
from app.core.security import get_current_user
from app.services.llm import vl_describe
from app.services.rag import rag_answer
from app.models import QALog, Ticket, UserTicketProgress, User
from difflib import SequenceMatcher

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _recommend_tickets(db: Session, user_id: int, question: str, img_desc: str = ""):
    """在工单库中按相似度推荐工单（FIX5 第 13 项）。"""
    query = f"{question} {img_desc}".strip()
    if not query:
        return []
    tickets = db.query(Ticket).order_by(Ticket.id.desc()).limit(200).all()
    my_ids = {p.ticket_id for p in db.query(UserTicketProgress).filter(
        UserTicketProgress.user_id == user_id,
        UserTicketProgress.status != "deleted").all()}
    scored = []
    for t in tickets:
        target = f"{t.device} {t.fault}".strip()
        if not target:
            continue
        score = SequenceMatcher(None, query, target).ratio()
        for kw in (t.device or "", t.fault or ""):
            if kw and kw in query:
                score += 0.2
        if score >= 0.3:
            scored.append({
                "id": t.id,
                "device": t.device,
                "fault": t.fault,
                "summary": (t.fault or "")[:60],
                "added": t.id in my_ids,
                "score": round(min(score, 1.0), 3),
            })
    scored.sort(key=lambda x: -x["score"])
    return scored[:4]


@router.post("/query")
async def query(
    question: str = Form(...),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    img_desc = ""
    if image is not None:
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        ext = image.filename.split(".")[-1]
        local = os.path.join(settings.UPLOAD_DIR, f"q_{uuid.uuid4().hex}.{ext}")
        with open(local, "wb") as f:
            shutil.copyfileobj(image.file, f)
        img_desc = vl_describe(f"file://{os.path.abspath(local)}")

    answer, hits = rag_answer(question, img_desc)
    log = QALog(question=question, answer=answer, sources=[h["metadata"] for h in hits], user_id=user.id)
    db.add(log); db.commit()
    return {
        "answer": answer,
        "image_observation": img_desc,
        "sources": [{"title": h["metadata"].get("title"), "snippet": h["content"][:120]} for h in hits],
        "recommended_tickets": _recommend_tickets(db, user.id, question, img_desc),
    }

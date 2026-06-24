import os, shutil, uuid, re
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


# FIX7 续：用提问中的关键字在 chunk 中定位"相关窗口"作为引用 snippet，
# 而不是粗暴截取 chunk[:150]——否则首句很可能是无关过渡文字，用户看了会觉得"引用与问题不搭边"
_STOPWORDS = {
    "的", "了", "和", "是", "在", "我", "你", "他", "她", "它", "怎么", "如何", "什么",
    "怎样", "为什么", "为何", "请问", "请", "吗", "吧", "啊", "也", "都", "就", "还",
    "有", "没", "没有", "不", "会", "能", "可以", "需要", "要"
}


def _extract_keywords(text: str) -> list[str]:
    """从提问里抽出粗粒度关键词：中文 2 字及以上连续片段 + 英文/数字 token。"""
    if not text:
        return []
    cn = re.findall(r"[一-鿿]{2,}", text)
    en = re.findall(r"[A-Za-z0-9_\-]{2,}", text)
    keywords: list[str] = []
    seen: set[str] = set()
    for tok in cn + en:
        if tok in _STOPWORDS or tok in seen:
            continue
        seen.add(tok)
        keywords.append(tok)
    return keywords[:8]


def _build_snippet(content: str, keywords: list[str], window: int = 80, max_len: int = 220) -> str:
    """围绕命中的关键词截取上下文窗口；找不到关键词时退回到首段。"""
    if not content:
        return ""
    text = content.strip()
    # 找到第一个命中的关键词位置
    best_pos = -1
    for kw in keywords:
        idx = text.find(kw)
        if idx >= 0 and (best_pos < 0 or idx < best_pos):
            best_pos = idx
    if best_pos < 0:
        # 无命中关键词，退回到 chunk 开头
        return text[:max_len] + ("…" if len(text) > max_len else "")
    start = max(0, best_pos - window)
    end = min(len(text), best_pos + window + max_len // 2)
    chunk = text[start:end]
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(text) else ""
    return f"{prefix}{chunk}{suffix}"


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
    # FIX7 续：用提问关键词定位 chunk 内的相关窗口作为 snippet，避免首段无关
    keywords = _extract_keywords(f"{question} {img_desc}")
    return {
        "answer": answer,
        "image_observation": img_desc,
        # FIX7 第 1 项：sources 携带 doc_id，前端折叠面板据此跳转原文
        "sources": [
            {
                "index": i,
                "doc_id": h["metadata"].get("doc_id"),
                "title": h["metadata"].get("title"),
                "snippet": _build_snippet(h["content"] or "", keywords),
            }
            for i, h in enumerate(hits, start=1)
        ],
        "recommended_tickets": _recommend_tickets(db, user.id, question, img_desc),
    }

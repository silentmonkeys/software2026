import os, shutil, io
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.db import get_db
from app.core.config import settings
from app.core.security import get_current_user, require_auditor, _is_auditor
from app.models import Document, User
from app.services.parser import read_any
from app.services.rag import ingest_document, remove_document

router = APIRouter(prefix="/api/kb", tags=["knowledge"])

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

# 允许上传的扩展名（FIX5 第 18 项：拒绝可执行文件）
ALLOWED_EXT = (".pdf", ".docx", ".txt", ".md")
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50MB


def _doc_out(d: Document, uploader_name: Optional[str] = None) -> dict:
    return {
        "id": d.id,
        "title": d.title,
        "type": d.type,
        "category": d.category or "manual",
        "status": d.status,
        "reason": d.review_reason,
        "uploaderId": d.uploader_id,
        "uploader": uploader_name,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


def _uploader_name_map(db: Session, docs) -> dict:
    ids = {d.uploader_id for d in docs if d.uploader_id}
    if not ids:
        return {}
    rows = db.query(User).filter(User.id.in_(ids)).all()
    return {u.id: u.username for u in rows}


@router.post("/upload")
async def upload(file: UploadFile = File(...), db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    fname = file.filename or ""
    if not fname.lower().endswith(ALLOWED_EXT):
        raise HTTPException(400, "仅支持 PDF / DOCX / TXT / MD 文件")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, "文件大小超过 50MB 限制")
    path = os.path.join(settings.UPLOAD_DIR, fname)
    with open(path, "wb") as f:
        f.write(data)
    text = read_any(path)
    # 管理员/审查员上传直接入库（approved）；员工上传进入待审（pending）
    approved = _is_auditor(user.role)
    doc = Document(
        title=fname, file_path=path, type=fname.split(".")[-1].lower(),
        category="manual", content=text[:20000] if text else "",
        status="approved" if approved else "pending",
        uploader_id=user.id,
    )
    db.add(doc); db.commit(); db.refresh(doc)
    n = 0
    if approved:
        n = ingest_document(doc.id, doc.title, text)
    return {"doc_id": doc.id, "chunks": n, "status": doc.status}


class TextDocIn(BaseModel):
    title: str
    content: str
    category: Optional[str] = "experience"


@router.post("/text")
def upload_text(body: TextDocIn, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    """员工经验分享 / 文本知识录入。员工 → pending；审查员/管理员 → approved。"""
    title = (body.title or "").strip()
    content = (body.content or "").strip()
    if not title or not content:
        raise HTTPException(400, "标题和正文不能为空")
    approved = _is_auditor(user.role)
    # 员工只能创建经验分享类目；审查员/管理员可指定类目
    category = (body.category or "experience") if approved else "experience"
    doc = Document(
        title=title, file_path=None, type="experience",
        category=category, content=content,
        status="approved" if approved else "pending",
        uploader_id=user.id,
    )
    db.add(doc); db.commit(); db.refresh(doc)
    n = 0
    if approved:
        n = ingest_document(doc.id, doc.title, content)
    return {"doc_id": doc.id, "chunks": n, "status": doc.status}


@router.get("/list")
def list_docs(status: Optional[str] = Query(None), uploader: Optional[str] = Query(None),
              db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Document)
    if uploader == "me":
        q = q.filter(Document.uploader_id == user.id)
    if status:
        q = q.filter(Document.status == status)
    # 普通员工浏览列表时仅可见已入库文档（除非查自己的上传）
    elif uploader != "me" and not _is_auditor(user.role):
        q = q.filter(Document.status.in_(["approved", "ready"]))
    docs = q.order_by(Document.id.desc()).all()
    names = _uploader_name_map(db, docs)
    return [_doc_out(d, names.get(d.uploader_id)) for d in docs]


@router.get("/{doc_id}")
def get_doc(doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    d = db.query(Document).get(doc_id)
    if not d:
        raise HTTPException(404, "文档不存在")
    if d.status not in ("approved", "ready") and not _is_auditor(user.role) and d.uploader_id != user.id:
        raise HTTPException(403, "无权查看该文档")
    names = _uploader_name_map(db, [d])
    out = _doc_out(d, names.get(d.uploader_id))
    out["content"] = d.content or ""
    return out


class ReviewIn(BaseModel):
    action: str            # approve / reject / take_down
    reason: Optional[str] = None


@router.post("/review/{doc_id}")
def review_doc(doc_id: int, body: ReviewIn, db: Session = Depends(get_db),
               user: User = Depends(require_auditor)):
    d = db.query(Document).get(doc_id)
    if not d:
        raise HTTPException(404, "文档不存在")
    action = (body.action or "").lower()
    if action == "approve":
        d.status = "approved"
        d.review_reason = None
        text = d.content or (read_any(d.file_path) if d.file_path else "")
        if text:
            remove_document(d.id)
            ingest_document(d.id, d.title, text)
    elif action in ("reject", "take_down"):
        if not (body.reason or "").strip():
            raise HTTPException(400, "请填写理由")
        d.status = "rejected" if action == "reject" else "taken_down"
        d.review_reason = body.reason.strip()
        remove_document(d.id)
    else:
        raise HTTPException(400, f"非法操作：{body.action}")
    d.reviewer_id = user.id
    d.reviewed_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "status": d.status}


@router.delete("/{doc_id}")
def delete_doc(doc_id: int, db: Session = Depends(get_db), _user: User = Depends(require_auditor)):
    d = db.query(Document).get(doc_id)
    if not d:
        raise HTTPException(404, "文档不存在")
    remove_document(d.id)
    db.delete(d); db.commit()
    return {"ok": True}


def _doc_full_text(d: Document) -> str:
    if d.content:
        return d.content
    if d.file_path and os.path.exists(d.file_path):
        return read_any(d.file_path)
    return ""


@router.get("/{doc_id}/export")
def export_doc(doc_id: int, format: str = Query("md"), db: Session = Depends(get_db),
               user: User = Depends(get_current_user)):
    d = db.query(Document).get(doc_id)
    if not d:
        raise HTTPException(404, "文档不存在")
    if d.status not in ("approved", "ready") and not _is_auditor(user.role) and d.uploader_id != user.id:
        raise HTTPException(403, "无权导出该文档")
    text = _doc_full_text(d)
    fmt = (format or "md").lower()
    safe_title = "".join(c for c in d.title if c not in '\\/:*?"<>|').strip() or f"doc-{d.id}"

    if fmt == "md":
        body = f"# {d.title}\n\n{text}\n"
        return StreamingResponse(
            io.BytesIO(body.encode("utf-8")),
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{safe_title}.md"},
        )
    if fmt == "pdf":
        pdf_bytes = _render_pdf(d.title, text)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{safe_title}.pdf"},
        )
    raise HTTPException(400, "format 仅支持 md / pdf")


def _render_pdf(title: str, text: str) -> bytes:
    """用 reportlab 生成 PDF；使用内置 CJK 字体 STSong-Light 支持中文，无需外部字体文件。"""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.cidfonts import UnicodeCIDFont
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

    try:
        pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
        font_name = "STSong-Light"
    except Exception:
        font_name = "Helvetica"

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20 * mm, bottomMargin=20 * mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("CJKTitle", parent=styles["Title"], fontName=font_name, fontSize=18, leading=24)
    body_style = ParagraphStyle("CJKBody", parent=styles["Normal"], fontName=font_name, fontSize=11, leading=18)

    def esc(s: str) -> str:
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    flow = [Paragraph(esc(title), title_style), Spacer(1, 8 * mm)]
    for line in (text or "").split("\n"):
        flow.append(Paragraph(esc(line) if line.strip() else "&nbsp;", body_style))
    doc.build(flow)
    return buf.getvalue()

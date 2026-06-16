import os, shutil, uuid
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, Depends
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.config import settings
from app.core.security import get_current_user
from app.services.llm import vl_describe
from app.services.rag import rag_answer
from app.models import QALog

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/query")
async def query(
    question: str = Form(...),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
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
    log = QALog(question=question, answer=answer, sources=[h["metadata"] for h in hits])
    db.add(log); db.commit()
    return {
        "answer": answer,
        "image_observation": img_desc,
        "sources": [{"title": h["metadata"].get("title"), "snippet": h["content"][:120]} for h in hits],
    }

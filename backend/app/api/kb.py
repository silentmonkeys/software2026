import os, shutil
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.config import settings
from app.models import Document
from app.services.parser import read_any
from app.services.rag import ingest_document

router = APIRouter(prefix="/api/kb", tags=["knowledge"])

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)


@router.post("/upload")
async def upload(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.lower().endswith((".pdf", ".docx", ".txt", ".md")):
        raise HTTPException(400, "仅支持 PDF / DOCX / TXT / MD")
    path = os.path.join(settings.UPLOAD_DIR, file.filename)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    doc = Document(title=file.filename, file_path=path, type=file.filename.split(".")[-1])
    db.add(doc); db.commit(); db.refresh(doc)
    text = read_any(path)
    n = ingest_document(doc.id, doc.title, text)
    return {"doc_id": doc.id, "chunks": n}


@router.get("/list")
def list_docs(db: Session = Depends(get_db)):
    return [
        {"id": d.id, "title": d.title, "type": d.type, "status": d.status, "created_at": d.created_at}
        for d in db.query(Document).order_by(Document.id.desc()).all()
    ]


@router.delete("/{doc_id}")
def delete_doc(doc_id: int, db: Session = Depends(get_db)):
    d = db.query(Document).get(doc_id)
    if not d: raise HTTPException(404)
    db.delete(d); db.commit()
    return {"ok": True}

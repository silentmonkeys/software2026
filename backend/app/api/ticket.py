from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.models import Ticket
from app.services.llm import chat_text

router = APIRouter(prefix="/api/ticket", tags=["ticket"])


class TicketStatusIn(BaseModel):
    status: str


class TicketIn(BaseModel):
    device: str
    fault: str


@router.post("")
def create(body: TicketIn, db: Session = Depends(get_db)):
    sys = "你是检修作业指引专家。请按【风险预检/工具准备/检修步骤/验收标准】四段输出，使用 JSON 数组返回 steps。"
    prompt = f"设备：{body.device}\n故障：{body.fault}\n请生成标准化检修步骤。"
    steps_text = chat_text(sys, prompt)
    t = Ticket(device=body.device, fault=body.fault, steps={"raw": steps_text})
    db.add(t); db.commit(); db.refresh(t)
    return {"id": t.id, "steps": t.steps}


@router.get("")
def list_(db: Session = Depends(get_db)):
    return [{"id": t.id, "device": t.device, "fault": t.fault, "status": t.status} for t in db.query(Ticket).all()]


@router.patch("/{tid}")
def update(tid: int, body: TicketStatusIn, db: Session = Depends(get_db)):
    t = db.query(Ticket).get(tid)
    if not t: raise HTTPException(404)
    t.status = body.status; db.commit()
    return {"ok": True, "status": t.status}


@router.get("/{tid}")
def detail(tid: int, db: Session = Depends(get_db)):
    t = db.query(Ticket).get(tid)
    if not t: raise HTTPException(404, detail="工单不存在")
    return {"id": t.id, "device": t.device, "fault": t.fault, "steps": t.steps, "status": t.status, "created_at": t.created_at.isoformat()}

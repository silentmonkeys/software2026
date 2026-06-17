from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.security import get_current_user
from app.models import Ticket
from app.services.llm import chat_text
import json, re

router = APIRouter(prefix="/api/ticket", tags=["ticket"])


class TicketStatusIn(BaseModel):
    status: str


class TicketIn(BaseModel):
    device: str
    fault: str


# FIX4 第 2 项：返回大步骤+子步骤的结构化 JSON
SOP_SYSTEM = (
    "你是设备检修标准作业流程（SOP）专家。"
    "请按【风险预检 → 工具准备 → 检修步骤 → 验收标准】四段输出，"
    "每个大步骤可以含若干必须按顺序完成的子步骤；同时给出该步骤需要的工具清单。"
    "严格输出 **JSON 数组**（不要包含 markdown ``` 代码块包裹），每个元素如下：\n"
    "{\n"
    "  \"id\": \"step-1\",\n"
    "  \"title\": \"风险预检\",\n"
    "  \"description\": \"在开始拆卸之前完成的安全预检步骤的简介\",\n"
    "  \"safetyNote\": \"涉及电气、压力或腐蚀介质时的安全提醒（可选）\",\n"
    "  \"subSteps\": [\n"
    "    { \"id\": \"sub-1-1\", \"content\": \"具体子步骤 1（必须按顺序完成）\" },\n"
    "    { \"id\": \"sub-1-2\", \"content\": \"具体子步骤 2\" }\n"
    "  ],\n"
    "  \"tools\": [\"验电器\", \"挂牌锁具\"],\n"
    "  \"acceptance\": \"验收标准（仅最后一段需要，可选）\"\n"
    "}\n"
    "约束：\n"
    "1) JSON 必须是合法的、可被 json.loads 解析；不要在外层加任何说明文字或代码块标记；\n"
    "2) 至少返回 3 个大步骤；每个大步骤至少 2 个子步骤；\n"
    "3) tools 字段使用名词短语；\n"
    "4) 一律使用中文。"
)


def _parse_steps(raw: str):
    """尽力把 LLM 返回的 JSON 字符串解析成数组；失败返回 None，由前端按 raw 文本继续兼容。"""
    if not raw:
        return None
    s = raw.strip()
    # 去掉常见的 ```json ... ``` 包裹
    s = re.sub(r"^```(?:json)?\s*", "", s)
    s = re.sub(r"\s*```$", "", s)
    # 截取首个 [ 到末尾的 ]
    lb = s.find("[")
    rb = s.rfind("]")
    if lb >= 0 and rb > lb:
        s = s[lb : rb + 1]
    try:
        data = json.loads(s)
        if isinstance(data, list):
            return data
    except Exception:
        return None
    return None


@router.post("")
def create(body: TicketIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    prompt = (
        f"设备：{body.device}\n"
        f"故障描述：{body.fault}\n\n"
        "请生成标准化检修方案；按上面要求返回 JSON 数组。"
    )
    raw = chat_text(SOP_SYSTEM, prompt)
    parsed = _parse_steps(raw)
    # 解析成功就把结构化数组直接落库；解析失败保留 raw 文本由前端兜底
    steps = parsed if parsed is not None else {"raw": raw}
    t = Ticket(device=body.device, fault=body.fault, steps=steps, owner_id=_.id)
    db.add(t); db.commit(); db.refresh(t)
    return {"id": t.id, "steps": t.steps}


@router.get("")
def list_(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return [{"id": t.id, "device": t.device, "fault": t.fault, "status": t.status} for t in db.query(Ticket).all()]


@router.patch("/{tid}")
def update(tid: int, body: TicketStatusIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    t = db.query(Ticket).get(tid)
    if not t: raise HTTPException(404)
    t.status = body.status; db.commit()
    return {"ok": True, "status": t.status}


@router.get("/{tid}")
def detail(tid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    t = db.query(Ticket).get(tid)
    if not t: raise HTTPException(404, detail="工单不存在")
    return {"id": t.id, "device": t.device, "fault": t.fault, "steps": t.steps, "status": t.status, "created_at": t.created_at.isoformat()}


# FIX4 第 2 项：工具清单 + 关联手册（同时挂在 /api/ticket 与 /api/workflow 下，兼容前端旧路径）
def _get_ticket_or_404(tid: int, db: Session):
    t = db.query(Ticket).get(tid)
    if not t:
        raise HTTPException(404, detail="工单不存在")
    return t


def _list_tools_for(t):
    out, seen = [], set()
    steps = t.steps if isinstance(t.steps, list) else []
    for st in steps:
        for name in (st.get("tools") or []):
            key = str(name).strip()
            if key and key not in seen:
                seen.add(key)
                out.append({"name": key, "qty": 1})
    return out


def _list_manuals_for(t):
    try:
        from app.services.rag import search
        query = f"{t.device} {t.fault}".strip() or t.fault
        hits = search(query, k=5)
    except Exception:
        return []
    out, seen = [], set()
    for h in hits:
        meta = h.get("metadata") or {}
        doc_id = meta.get("doc_id")
        if doc_id is None or doc_id in seen:
            continue
        seen.add(doc_id)
        dist = h.get("distance")
        score = max(0.0, 1.0 - dist) if isinstance(dist, (int, float)) else 0.0
        out.append({
            "docId": str(doc_id),
            "title": meta.get("title") or f"doc-{doc_id}",
            "matchedSection": (h.get("content") or "")[:80],
            "score": round(score, 3),
        })
    return out


@router.get("/{tid}/tools")
def list_tools(tid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return _list_tools_for(_get_ticket_or_404(tid, db))


@router.get("/{tid}/manuals")
def list_manuals(tid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return _list_manuals_for(_get_ticket_or_404(tid, db))


# 同时挂 /api/workflow/{id}/(tools|manuals) 给前端使用
workflow_router = APIRouter(prefix="/api/workflow", tags=["workflow"])


@workflow_router.get("/{tid}/tools")
def wf_list_tools(tid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return _list_tools_for(_get_ticket_or_404(tid, db))


@workflow_router.get("/{tid}/manuals")
def wf_list_manuals(tid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return _list_manuals_for(_get_ticket_or_404(tid, db))

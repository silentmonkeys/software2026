"""
管理员接口（FIX4 第 4 项）

- GET /api/admin/users  —— 列出用户（仅 admin）
- PUT /api/admin/users/{user_id}/role  —— 修改用户角色（仅 admin）
- 启动时若用户表为空或不存在 admin，则创建默认 admin / admin123 账号
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user, hash_password
from app.models import User

router = APIRouter(prefix="/api/admin", tags=["admin"])

# 后端实际存储的合法角色（前端 role 映射在 src/api/auth.ts mapBackendRole）
VALID_ROLES = {"worker", "leader", "auditor", "admin"}


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(403, detail="需要管理员权限")
    return user


@router.get("/users")
def list_users(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    rows = db.query(User).order_by(User.id.desc()).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "role": u.role,
            "createdAt": u.created_at.isoformat() if u.created_at else None,
        }
        for u in rows
    ]


class RoleIn(BaseModel):
    role: str


@router.put("/users/{user_id}/role")
def update_role(
    user_id: int,
    body: RoleIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    role = (body.role or "").strip().lower()
    if role not in VALID_ROLES:
        raise HTTPException(400, detail=f"非法角色：{body.role}")
    u = db.query(User).get(user_id)
    if not u:
        raise HTTPException(404, detail="用户不存在")
    if u.id == admin.id and role != "admin":
        # 防止管理员把自己降级，导致没人管这个系统
        raise HTTPException(400, detail="不能降级当前登录的管理员账号")
    u.role = role
    db.commit()
    return {"ok": True, "id": u.id, "role": u.role}


def ensure_default_admin(db: Session) -> None:
    """启动时调用：保证存在至少一个 admin 账号（默认 admin / admin123）。"""
    has_admin = db.query(User).filter(User.role == "admin").first()
    if has_admin:
        return
    existing = db.query(User).filter(User.username == "admin").first()
    if existing:
        # 已有同名账号但角色不是 admin → 改成 admin
        existing.role = "admin"
        db.commit()
        return
    seed = User(
        username="admin",
        password_hash=hash_password("admin123"),
        role="admin",
    )
    db.add(seed)
    db.commit()

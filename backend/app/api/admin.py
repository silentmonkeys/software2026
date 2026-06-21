"""
管理员接口（FIX5 第 1/3 部分）

- GET    /api/admin/users                      列出用户
- POST   /api/admin/users                      创建账户（员工/审查员/管理员）
- PUT    /api/admin/users/{id}                 修改用户名 / 角色
- PUT    /api/admin/users/{id}/role            修改角色（兼容旧前端）
- PUT    /api/admin/users/{id}/reset-password  重置密码为 123456
- DELETE /api/admin/users/{id}                 删除账户（默认 admin 不可删）

启动时确保存在默认 admin / 123456（is_default_admin=True）。
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user, hash_password, require_admin
from app.models import User

router = APIRouter(prefix="/api/admin", tags=["admin"])

DEFAULT_PASSWORD = "123456"
# 后端实际存储的合法角色（前端映射见 src/constants/roles.ts）
VALID_ROLES = {"worker", "leader", "auditor", "admin"}


def _is_protected_admin(u: User) -> bool:
    return bool(u.is_default_admin) or u.username == "admin"


def _user_out(u: User) -> dict:
    return {
        "id": u.id,
        "username": u.username,
        "role": u.role,
        "isDefaultAdmin": _is_protected_admin(u),
        "createdAt": u.created_at.isoformat() if u.created_at else None,
    }


@router.get("/users")
def list_users(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    rows = db.query(User).order_by(User.id.desc()).all()
    return [_user_out(u) for u in rows]


class CreateUserIn(BaseModel):
    username: str
    password: Optional[str] = None
    role: str = "worker"


@router.post("/users")
def create_user(body: CreateUserIn, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    username = (body.username or "").strip()
    if not username:
        raise HTTPException(400, "用户名不能为空")
    role = (body.role or "worker").strip().lower()
    if role not in VALID_ROLES:
        raise HTTPException(400, f"非法角色：{body.role}")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(400, "用户名已存在")
    pw = body.password or DEFAULT_PASSWORD
    if len(pw) < 6:
        raise HTTPException(400, "密码长度不少于 6 位")
    u = User(username=username, password_hash=hash_password(pw), role=role)
    db.add(u); db.commit(); db.refresh(u)
    return _user_out(u)


class UpdateUserIn(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None


@router.put("/users/{user_id}")
def update_user(user_id: int, body: UpdateUserIn, db: Session = Depends(get_db),
                admin: User = Depends(require_admin)):
    u = db.query(User).get(user_id)
    if not u:
        raise HTTPException(404, "用户不存在")
    if body.role is not None:
        role = body.role.strip().lower()
        if role not in VALID_ROLES:
            raise HTTPException(400, f"非法角色：{body.role}")
        if u.id == admin.id and role != "admin":
            raise HTTPException(400, "不能降级当前登录的管理员账号")
        if _is_protected_admin(u) and role != "admin":
            raise HTTPException(403, "默认管理员账户角色不可变更")
        u.role = role
    if body.username is not None:
        new_name = body.username.strip()
        if not new_name:
            raise HTTPException(400, "用户名不能为空")
        if _is_protected_admin(u) and new_name != u.username:
            raise HTTPException(403, "默认管理员账户用户名不可变更")
        dup = db.query(User).filter(User.username == new_name, User.id != u.id).first()
        if dup:
            raise HTTPException(400, "用户名已存在")
        u.username = new_name
    db.commit()
    return _user_out(u)


class RoleIn(BaseModel):
    role: str


@router.put("/users/{user_id}/role")
def update_role(user_id: int, body: RoleIn, db: Session = Depends(get_db),
                admin: User = Depends(require_admin)):
    return update_user(user_id, UpdateUserIn(role=body.role), db, admin)


@router.put("/users/{user_id}/reset-password")
def reset_password(user_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    u = db.query(User).get(user_id)
    if not u:
        raise HTTPException(404, "用户不存在")
    u.password_hash = hash_password(DEFAULT_PASSWORD)
    db.commit()
    return {"ok": True, "password": DEFAULT_PASSWORD}


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    u = db.query(User).get(user_id)
    if not u:
        raise HTTPException(404, "用户不存在")
    if _is_protected_admin(u):
        raise HTTPException(403, "默认管理员账户不可删除")
    if u.id == admin.id:
        raise HTTPException(400, "不能删除当前登录的账号")
    db.delete(u); db.commit()
    return {"ok": True}


def ensure_default_admin(db: Session) -> None:
    """启动时调用：保证存在默认 admin / 123456，且标记 is_default_admin。"""
    existing = db.query(User).filter(User.username == "admin").first()
    if existing:
        existing.role = "admin"
        if not existing.is_default_admin:
            existing.is_default_admin = True
        db.commit()
        return
    seed = User(
        username="admin",
        password_hash=hash_password(DEFAULT_PASSWORD),
        role="admin",
        is_default_admin=True,
    )
    db.add(seed)
    db.commit()

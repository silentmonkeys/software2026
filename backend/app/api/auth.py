from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.security import hash_password, verify_password, create_token, get_current_user
from app.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])

MIN_PASSWORD_LEN = 6


def _check_password(pw: str) -> None:
    if not pw or len(pw) < MIN_PASSWORD_LEN:
        raise HTTPException(400, f"密码长度不少于 {MIN_PASSWORD_LEN} 位")


class LoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    role: str
    username: str


class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str


@router.post("/register", response_model=TokenOut)
def register(body: LoginIn, db: Session = Depends(get_db)):
    """FIX5：注册一律创建员工账户（worker），忽略前端传入的任何角色字段。"""
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(400, "用户名已存在")
    _check_password(body.password)
    u = User(username=body.username, password_hash=hash_password(body.password), role="worker")
    db.add(u); db.commit(); db.refresh(u)
    return TokenOut(access_token=create_token(u.username, u.role), role=u.role, username=u.username)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.username == body.username).first()
    if not u or not verify_password(body.password, u.password_hash):
        raise HTTPException(401, "账号或密码错误")
    return TokenOut(access_token=create_token(u.username, u.role), role=u.role, username=u.username)


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    """根据 token 回填当前用户信息（前端不再把用户资料写入 localStorage）。"""
    return {"id": user.id, "username": user.username, "role": user.role,
            "isDefaultAdmin": bool(user.is_default_admin)}


@router.put("/change-password")
def change_password(body: ChangePasswordIn, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    if not verify_password(body.old_password, user.password_hash):
        raise HTTPException(400, "原密码不正确")
    _check_password(body.new_password)
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True}

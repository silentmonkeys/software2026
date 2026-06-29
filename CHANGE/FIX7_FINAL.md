# FIX7 终修变更记录

> 日期：2026-06-28  
> 分支：main

---

## 已修复项

### 1. FIX7-1：引用来源面板 → 已复查，代码已完整修复
- `rag.py` SYSTEM_PROMPT 已排除 `[N]` 内联引用
- `chat.py` 返回 `doc_id` + 关键词定位 snippet
- Pc.vue / Mobile.vue 引用面板 per-message 绑定，含"查看原文→"链接

### 2. FIX7-2：知识图谱筛选 + 连线错位 → 已复查，代码已完整修复
- `filteredNodes` / `visibleEdges` 响应式计算
- `renderChart()` 使用 `notMerge=true` 替换
- ResizeObserver + rendered 事件处理初始错位

### 3. FIX7-3：管理员/审查员移动端上传权限 → 已复查，代码已完整修复
- 路由 `roles: ['frontline', 'auditor', 'admin']`
- 后端按 `_is_auditor()` 决定 `approved` / `pending`
- Upload.vue 根据角色显示不同提示文案
- BottomTabBar 上传入口对全部角色可见

### 4. FIX7-4：AI 引擎状态卡片 → 已删除，无残留

---

## 本次额外修复

### Bug：知识图谱准入检查允许未审核文档
**文件：** `backend/app/api/kg.py:129`

```diff
- if d.status in ("ready", "approved", None):
+ if d.status in ("ready", "approved"):
```
`None` 状态文档（未设置审核状态）会绕过检查进入图谱，修正为仅允许 `ready` / `approved`。

### 安全加固

**文件：** `backend/app/core/config.py`
- `DEBUG` 默认值 `True` → `False`
- 新增 `CORS_ORIGINS` 配置项（默认 `"*"`），可通过 `.env` 限制为具体域名
- `JWT_SECRET` 若为默认值，启动时打印 RuntimeWarning 提醒

**文件：** `backend/app/main.py`
- CORS `allow_origins` 改为从 `settings.CORS_ORIGINS` 读取

**文件：** `backend/.env.example`
- 新增 `DEBUG=false` 和 `CORS_ORIGINS=*` 配置

---

## 验证结果
```
vue-tsc --noEmit  →  0 errors
Python py_compile →  all OK
```

---

## 部署说明（龙芯麒麟 VM）

在已部署的虚拟机上更新：

```bash
cd ~/software2026
git pull

# 如果 .env 中没设置过，加上：
echo "DEBUG=false" >> backend/.env
echo "CORS_ORIGINS=*" >> backend/.env

# 重启后端
sudo systemctl restart software2026
# 或手动：
# cd ~/software2026/backend && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

# FIX9 — 2026-07-01 设计缺陷审计与修复（安全/数据/可运维/流式/内存）

> 日期：2026-07-01
> 分支：main
> 背景：对全项目做了一次跨后端/前端/跨切面的设计缺陷审计，共识别约 39 项缺陷。本次修复其中全部 **Critical 5 项 + 核心 High 6 项**，并在验证时顺带修掉一个潜在 DB 路径解析 bug。其余 Medium/Low 作为 backlog 留存。

---

## 修复项总览

| 编号 | 严重度 | 缺陷 | 涉及文件 |
|------|--------|------|---------|
| C1 | Critical | JWT 默认密钥仅警告不中止启动 | `app/core/config.py` |
| C2 | Critical | 文件上传路径穿越 | `app/api/kb.py` |
| C3 | Critical | CORS `*` + 凭据放行 | `app/main.py`、`app/core/config.py`、`.env.example` |
| C4 | Critical | `chat_text` 零错误处理，DashScope 抖动即 500 堆栈泄露 | `app/services/llm.py`、`app/api/ticket.py` |
| C5 | Critical | 口令重置恒为 123456 且明文回显 | `app/api/admin.py` |
| H1 | High | 编辑已通过文档时 `except:pass` 静默吞错，向量丢失但 status=approved | `app/api/kb.py` |
| H3 | High | `/api/health` 恒返回 ok，不探活依赖 | `app/main.py` |
| H5 | High | LLM 非流式，违反 NEEDS「打字机流式」 | `app/services/llm.py`、`app/services/rag.py`、`app/api/chat.py`、`src/api/search.ts`、`src/views/search/{Pc,Mobile}.vue` |
| H15 | High | ECharts 实例 + ResizeObserver 未 dispose，内存泄漏 | `src/views/kg/Pc.vue` |
| H16 | High | Blob URL 泄漏（移除/清空时不 revoke） | `src/components/mobile/MobileInputBar.vue`、`src/views/search/Pc.vue` |
| H2 | High | 零自动化测试 / 无 linter / 无 CI | `backend/tests/`、`backend/requirements-dev.txt`、`.github/workflows/ci.yml` |
| 附 | — | `config.py` 绝对 DB 路径被 `lstrip("./\\")` 剥掉前导 `/` 静默失效 | `app/core/config.py` |

---

## 详细修改

### C1：JWT 默认密钥强制校验
- **现象**：`JWT_SECRET` 默认值 `"change-me-in-prod"`，启动仅 `warnings.warn`，不中止。掌握本代码的人可伪造任意用户/角色 JWT。
- **修改文件**：`backend/app/core/config.py`
- **修改内容**：默认值未被覆盖时 `raise SystemExit`；新增 `ALLOW_INSECURE_JWT` 开关（默认 `false`），开发/测试可置 `true` 或 `DEBUG=true` 绕过（仅警告）。
- **生产注意**：部署前**必须**在 `.env` 设置强随机 `JWT_SECRET`，否则后端拒绝启动。

### C2：文件上传路径穿越
- **现象**：`os.path.join(UPLOAD_DIR, file.filename)`，仅校验扩展名。`file.filename=../../etc/x` 或绝对路径可逃逸 UPLOAD_DIR 写任意文件。
- **修改文件**：`backend/app/api/kb.py`（`upload` 与 `upload_text_with_files` 两处）
- **修改内容**：统一 `os.path.basename(file.filename or "")`，空名时回退 `uuid`。

### C3：CORS 收紧
- **现象**：`allow_origins=["*"]` + `allow_methods/headers=["*"]`，任意网站可携带 localStorage 中的 token 跨域请求。
- **修改文件**：`backend/app/core/config.py`、`backend/app/main.py`、`backend/.env.example`
- **修改内容**：
  - `CORS_ORIGINS` 默认改为 `http://localhost:5173,http://127.0.0.1:5173`（仅放行本地前端）
  - 新增 `cors_origins_list` 属性解析逗号分隔来源
  - Bearer token（非 cookie）场景用 `allow_credentials=False`，使 `allow_headers=["*"]` 能直接覆盖 `Authorization` 而不被浏览器拒绝
  - 仅当显式配置 `CORS_ORIGINS=*` 时退化为完全开放模式
  - `.env.example` 同步更新并注释生产配置方式

### C4：`chat_text` 错误处理
- **现象**：`rsp.output.choices[0].message.content` 无 None 检查（同文件 `vl_describe`/`embed` 都有），DashScope 异常即 `AttributeError` → 500 + 堆栈泄露。
- **修改文件**：`backend/app/services/llm.py`、`backend/app/api/ticket.py`
- **修改内容**：`chat_text` 补 `rsp.output is None or not choices` 检查并抛 `RuntimeError`；ticket SOP 生成处 `try/except` 转 `HTTPException(502)`（chat `/query` 的包裹见 H5）。

### C5：口令重置改随机一次性
- **现象**：`reset_password` 恒置 `123456` 且在响应体明文回显，恶意 admin 可静默重置任意用户口令并冒名登录。
- **修改文件**：`backend/app/api/admin.py`
- **修改内容**：
  - 新增 `_generate_one_time_password()`（`secrets.token_urlsafe(9)[:12]`）
  - `reset_password` 改为生成随机一次性口令 + `bump token_version`（失效旧会话），响应附 `note` 提示转交用户并尽快改密
  - `create_user` 未指定密码时同样生成随机口令（仅生成时回显，不写入通用默认值）

### H1：向量重建原子性
- **现象**：编辑已通过文档时先 `remove_document` 再 `ingest_document`，失败被 `except Exception: pass` 静默——文档 `status=approved` 但 Chroma 零向量，RAG 永久检索不到且无任何提示。
- **修改文件**：`backend/app/api/kb.py`（`update_doc`、`review_doc` approve 路径）
- **修改内容**：
  - `update_doc`：向量重建移到 `db.commit()` **之前**；失败时尝试用旧 content 恢复旧向量 + `db.rollback()` + 抛 `HTTPException(500)`，避免不一致
  - `review_doc` approve 路径：`ingest_document` 失败转 `HTTPException(502)`（未 commit 故状态仍为 pending）

### H3：深度健康检查
- **现象**：`/api/health` 恒返回 `{ok:true}`，DashScope 不可达或 Chroma 损坏时编排器仍报健康，不重启。
- **修改文件**：`backend/app/main.py`
- **修改内容**：逐项探活 DB（`SELECT 1`）、Chroma（`_col.count()`）、DashScope（仅检查 key 是否配置，避免探活产生计费）；返回 `{ok, app, db, chroma, dashscope}`。

### H5：LLM 流式输出（打字机效果）
- **现象**：`Generation.call` 阻塞非流式，长答案需数秒空等，违反 NEEDS「AI 输出用打字机流式」。
- **修改文件**：`backend/app/services/llm.py`、`backend/app/services/rag.py`、`backend/app/api/chat.py`、`src/api/search.ts`、`src/views/search/Pc.vue`、`src/views/search/Mobile.vue`
- **修改内容**：
  - **后端**：
    - 新增 `chat_text_stream()`（DashScope `stream=True, incremental_output=True`，逐段 yield 增量，含 None 检查）
    - `rag.py` 拆分为 `rag_retrieve()`（检索+关键词兜底）+ `build_user_prompt()` + `rag_answer()`（保留非流式供兼容/测试）；抽出 `_NO_HIT_ANSWER` 常量
    - `chat.py` `/query` 改为 `StreamingResponse` + SSE（`text/event-stream`）：事件类型 `token`(增量)/`meta`(qa_log_id+answer+sources+recommended_tickets)/`error`/`done`；检索/推荐/引用在流式开始前用请求级 db 算，`QALog` 在生成完成后用**独立 session** 写入（请求级 Depends session 在 endpoint 返回后已关闭）
    - SSE helper `_sse(event, data)` 统一格式
  - **前端**：
    - `search.ts` 新增 `multimodalSearchStream()`：用 `fetch` + `ReadableStream` 手动解析 SSE（`EventSource` 不支持 POST/multipart），`onToken` 回调逐 token 累加，最终 resolve 出与 `multimodalSearch` 相同结构的 `SearchResult`；401 时复用 `clearActiveToken` + 跳登录语义
    - `Pc.vue`/`Mobile.vue` 改用流式版本，`onToken` 实时 `updateMessage(content: acc)` 渲染打字机效果

### H15：ECharts 内存泄漏
- **现象**：`kg/Pc.vue` 模块级 `let inst` + `onMounted` 注册 `window.resize` 与 `ResizeObserver`，但无 `onBeforeUnmount`，导航往返累积内存与监听。
- **修改文件**：`src/views/kg/Pc.vue`
- **修改内容**：抽出具名 `onResize` + `resizeObserver` 变量；`onBeforeUnmount` 中 `removeEventListener` + `ro.disconnect()` + `inst.dispose()` + 置 `null`。

### H16：Blob URL 泄漏
- **现象**：`URL.createObjectURL` 后移除/清空不 `revokeObjectURL`，长会话累积内存。
- **修改文件**：`src/components/mobile/MobileInputBar.vue`、`src/views/search/Pc.vue`
- **修改内容**：`MobileInputBar.removeImg` 移除时 revoke 该 URL；`search/Pc.vue` 新增 `removeImage()`/`clearImages()`（revoke 后再 splice/清空），模板 `@click` 与发送后清空改用这两个函数。

### H2：测试基建 + CI
- **现象**：无测试、无 linter、无 CI，仅 `npm run typecheck`；FIX1–8 共数千行修复史全靠手测，回归风险高。
- **新增文件**：`backend/requirements-dev.txt`、`backend/tests/conftest.py`、`backend/tests/test_auth.py`、`backend/tests/test_security.py`、`backend/tests/test_health.py`、`.github/workflows/ci.yml`
- **修改内容**：
  - `requirements-dev.txt`：`pytest>=8.0`、`httpx>=0.27`
  - `conftest.py`：测试专用环境变量（`ALLOW_INSECURE_JWT=true`、stub DashScope key、临时 DB/Chroma/Uploads 路径，每次清库）、`client`/`admin_token`/`worker_token` fixture
  - `test_auth.py`：登录、错密拒、注册角色锁（worker）、`token_version` 单点登录失效旧 token
  - `test_security.py`：C1 默认 JWT_SECRET 拒绝启动（子进程断言）、C2 路径穿越落盘在 UPLOAD_DIR 内、C5 重置口令随机且可登录
  - `test_health.py`：H3 三项依赖探活均 ok
  - `ci.yml`：push/PR 触发两 job——前端 `npm install` + `npm run typecheck`；后端 `pip install -r requirements.txt -r requirements-dev.txt` + `pytest -q`

### 附：绝对 DB 路径解析 bug（验证时发现）
- **现象**：`config.py` 用 `_path.lstrip("./\\")` 把 `DB_URL` 的路径前导字符集剥掉，会把**绝对路径**的前导 `/` 也剥掉（如 `/tmp/.../s.db` → `tmp/.../s.db`），导致测试用绝对临时路径时 SQLite 报 `unable to open database file`。生产相对路径 `./loongchip.db` 因无前导 `/` 不受影响，故长期未暴露。
- **修改文件**：`backend/app/core/config.py`
- **修改内容**：改为只剥 `./` / `.\\` 前缀；绝对路径原样保留，仅相对路径才拼 `_base` 转绝对。

---

## 验证结果

```
前端 npm run typecheck       →  0 errors（exit 0）
后端 py_compile（全部改动）  →  all OK
后端 import 自检              →  IMPORT OK，/api/chat/query(POST) + /api/health 已注册，_sse 输出正确
后端 pytest -q                →  8 passed（auth×4、security×3、health×1）
```

测试用 conda env：`software`（`/home/chen/anaconda3/envs/software`），已补装 `pytest httpx`。

---

## 部署说明（龙芯麒麟 VM）

```bash
cd ~/software2026
git pull

# 1) 必须设置 JWT_SECRET，否则后端拒绝启动（C1）
#    生成强随机密钥：
python -c "import secrets; print(secrets.token_hex(32))"
#    写入 backend/.env：
echo "JWT_SECRET=<上面生成的串>" >> backend/.env

# 2) 收紧 CORS（C3）：改为前端实际域名，逗号分隔
echo "CORS_ORIGINS=https://maintain.example.com" >> backend/.env
#    本地开发默认已放行 5173，无需改

# 3) （可选）开发/测试绕过 JWT 强制：
# echo "ALLOW_INSECURE_JWT=true" >> backend/.env

# 4) 重启后端
sudo systemctl restart software2026
# 或手动：cd backend && /home/chen/anaconda3/envs/software/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**行为变化提醒**：
- 管理员重置用户口令后，得到的是随机一次性口令（不再是 123456），需转交用户并提示尽快改密；旧会话立即失效。
- 管理员创建用户未填密码时，返回随机一次性口令（仅本次回显）。
- AI 回答改为流式输出，前端逐字渲染；网络面板可见 `/api/chat/query` 为 `text/event-stream`。
- `/api/health` 现返回 `{ok, app, db, chroma, dashscope}`，任一依赖异常 `ok=false`。

---

## Backlog：本次未改的缺陷

完整审计清单与证据见 `/home/chen/.claude/plans/wiggly-wandering-cookie.md`，约 25 项，按组：

- **性能/可扩展**：H4 知识图谱全量重算无缓存、H6 SQLite→Postgres、H7 热路径缺索引、H8 工单 /history N+1、H14 列表接口无分页、M1 RAG 无重排、M2 context 无 token 上限、M4 VL 描述不缓存
- **数据完整性/级联**：H9 KGOverride 删文档悬空、H10 工单无平台硬删 + FK 无 ON DELETE CASCADE、M3 抽取图片端点免认证
- **可运维性**：H11 无备份策略、H12 日志随意密钥可能泄露、H13 LLM 端点无限流/无 token 预算
- **前端**：H17 双 token `#/admin` 竞态误踢、H18 `mobileReadonly` 守卫只 toast 不阻断、H19 Pc/Mobile 重复逻辑已漂移、M5–M12 各项体验/状态问题
- **需求缺口**：M13 NEEDS 未实现项（企业 SSO、离线缓存、语音输入、扫码登录、步骤语音播报）
- **Low**：L1 登录页「忘记密码」死链、L2 双文件 vs 单文件模式混用无规范

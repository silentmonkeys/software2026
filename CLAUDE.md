# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A 设备检修知识检索与作业系统 (equipment-maintenance knowledge retrieval & work-guidance system) for industrial sites — multimodal RAG over maintenance docs. Two parts in one repo:

- **Frontend** (`/`, `src/`): Vue 3 + Vite + TypeScript SPA. One codebase serves a **PC industrial-display** form factor (≥ 1024 px) and a **mobile/tablet** form factor.
- **Backend** (`backend/`): FastAPI + SQLAlchemy + Chroma vector DB; calls Alibaba DashScope (Qwen) for text / multimodal / embeddings.

Build output is arch-independent static files; no UI is branded with 信创 / LoongArch labels (removed in FIX5 第 15 项 — only the brand string `龙芯智修` remains as the RAG system-prompt persona).

## Commands

Frontend (run from repo root):
```bash
npm install
npm run dev          # vite dev → http://localhost:5173 (proxies /api → 127.0.0.1:8000)
npm run build        # vue-tsc --noEmit type check THEN vite build → dist/
npm run typecheck    # type check only — the frontend gate
npm run preview      # serve the production build
```
No frontend linter. `npm run typecheck` is the gate to run after any TS/Vue change.

Backend (run from `backend/`):
```bash
pip install -r requirements.txt -r requirements-dev.txt   # -dev adds pytest + httpx
cp .env.example .env          # set DASHSCOPE_API_KEY / JWT_SECRET / CORS_ORIGINS etc.
uvicorn app.main:app --reload # → http://127.0.0.1:8000
python -m pytest -q tests     # backend gate: auth / security / health
```
**FIX9 C1 — `JWT_SECRET` must be set.** If it is still the default (`please-change-me` / `change-me-in-prod`), the backend `raise SystemExit` on import and refuses to boot. Generate one with `python -c "import secrets; print(secrets.token_hex(32))"`, or set `ALLOW_INSECURE_JWT=true` / `DEBUG=true` to bypass (dev/test only). **FIX9 C3 — CORS** defaults to `http://localhost:5173,http://127.0.0.1:5173`; set `CORS_ORIGINS` in `.env` for other origins (comma-separated; `*` = fully open).

On startup the backend (a) auto-creates tables (SQLite `loongchip.db`), (b) runs `run_migrations()` to add FIX5 / FIX6 columns on existing DBs (`token_version`, `parent_id`, `kg_overrides` table, …), and (c) seeds default admin **`admin` / `123456`** — protected by `is_default_admin` (cannot be deleted, renamed, or demoted).

### CI & tests (FIX9 H2)
`.github/workflows/ci.yml` runs on push/PR to `main` with two jobs:
- **frontend** — `npm ci` + `npm run typecheck`.
- **backend** — `pip install -r requirements.txt -r requirements-dev.txt` + `python -m pytest -q tests`, with `ALLOW_INSECURE_JWT=true`, a stub `DASHSCOPE_API_KEY`, and `PYTHONPATH=.` (working-directory `backend`). Tests use a temp DB/Chroma/Uploads (`backend/tests/conftest.py`) and clear between runs.

`backend/tests/`: `test_auth.py` (login, wrong-password reject, register role-lock, `token_version` SSO kill), `test_security.py` (C1 default-JWT refuse-to-start via subprocess, C2 path-traversal confined to UPLOAD_DIR, C5 reset-password random + login), `test_health.py` (H3 three-dependency probe). Run them in the conda env `software` (see memory `backend-python-env`).

## Architecture

### Frontend dual form-factor (the core pattern)
`App.vue` reads `useDevice().isPC` and mounts either `PCLayout` or `MobileLayout`, both rendering the same `<router-view>`. Most business modules under `src/views/<module>/` use a three-file pattern:
- `index.vue` — entry that delegates to PC or Mobile via `useDevice`
- `Pc.vue` — PC implementation
- `Mobile.vue` — mobile implementation

**When changing a feature, edit both `Pc.vue` and `Mobile.vue`.** A few newer pages (`knowledge/Browse.vue`, `knowledge/KnowledgeManage.vue`, `audit/KnowledgeReview.vue`, `admin/UserManagement.vue`) are single-file and adapt internally with Tailwind responsive classes.

The router (`src/router/index.ts`) is a single flat table in **hash mode** with `meta.layout`, `meta.roles` (role guard with toast + redirect), and `meta.mobileReadonly` (admin module is read-only on mobile). Always use `location.hash = '#/...'` for programmatic navigation outside Vue Router context — never `location.pathname`.

### API layer — no mock fallbacks
`src/api/request.ts` defines the axios instance and two wrappers used everywhere:
- `safeCall(fn)` — for endpoints returning `{code,msg,data}` envelope; returns `data.data` on success, **throws** on failure.
- `rawCall(fn)` — for endpoints returning the JSON body directly; **throws** on failure.

**FIX5 第 16 项 removed all mock fallback data.** Views now use try/catch + error UI (`EmptyState` / `AlertTriangle` banners) when the backend is unreachable. Do not re-introduce typed fallbacks — they previously masked real integration failures.

**FIX6 第 11 项 — token storage is split per context to prevent cross-tab token clobber.** The interceptor calls `readActiveToken()` which inspects `location.hash`: routes under `#/admin*` read/write `localStorage.admin_token`; everything else uses `user_token`. Legacy `app:token` is auto-migrated to `user_token` on first read. Always go through `readActiveToken / writeActiveToken / clearActiveToken` (exported from `src/api/request.ts`) — **never** touch the raw key, and **never** call `localStorage.clear()` on logout (it would nuke the other context's session). A 401 on a non-auth endpoint clears only the active context's token and redirects via `location.hash = '#/login'`; if the response `detail` contains "其他设备" (single-sign-on bumped your token version), a dedicated toast fires before the redirect.

`VITE_API_BASE` (default `/api` in `.env.development`) points the SPA at the backend; Vite proxies `/api` to `127.0.0.1:8000` without path rewrite.

### Single-sign-on via `token_version` (FIX6 第 10 项)
`User.token_version` is bumped on every successful login and on `change-password`. `create_token` embeds it in the JWT as `tv`; `get_current_user` rejects any token whose `tv` no longer matches the DB row with `401 "账号已在其他设备登录"`. This makes JWTs effectively revocable without a blacklist — a fresh login on any device kills all older sessions.

### Roles — single source of truth
`src/constants/roles.ts` is the **single source** for both sides of the front/back mismatch:
- Frontend roles: `frontline | auditor | admin`
- Backend roles: `worker | leader | admin`
- `mapBackendRole()` (`worker→frontline`, `leader→auditor`) and `mapFrontendRole()` (the inverse) live here.
- `ROLE_LABEL`, `ASSIGNABLE_ROLES`, `isAuditorRole()` are also exported here.

`src/utils/permission.ts` re-exports these and defines `MENU_ITEMS` + `getVisibleMenuItems(role)` used by both layouts. Touching auth on either side → update `roles.ts` first.

### Registration is locked to worker
`POST /api/auth/register` ignores any `role` field and hardcodes `worker`. The register form has no role selector. Non-employee accounts must be created by an admin at `/admin/user`.

### Tickets — platform-level, per-user progress
Tickets are platform-shared resources; per-user progress lives in a separate `UserTicketProgress` row (UniqueConstraint on `user_id` + `ticket_id`). Adding someone else's ticket creates a fresh progress row with `status=open`, `step_done=[]`. Every state transition (`created`/`added`/`step_completed`/`completed`/`deleted` with reason) appends to `TicketEvent` for the timeline view (`GET /api/ticket/{id}/timeline` — workers see own events, auditor/admin see all users grouped). The workflow page (`src/views/workflow/WorkList.vue`) splits the UI into "我的工单" vs. "推荐工单" (created-by-others-not-yet-added), and creation flows through `POST /api/ticket/recommend` first — only if the user rejects all matches does the new-ticket form open.

Delete logic: completed tickets delete without a reason (default `"已完成"`); incomplete tickets require a reason from `需求错误 / 误触 / 其他(text)`. Rows are soft-deleted (`deleted_at` + `delete_reason` set) so the profile's "历史工单" tab can show them with a "重新添加" button.

**FIX6 第 3 项 — soft-deleted progress no longer permanently hides a ticket.** `GET /api/ticket` now drops `progress.status == "deleted"` rows back into the `recommended` bucket (instead of nowhere), and `POST /api/ticket/recommend` filters `my_ids` only on non-deleted progress. So "delete from my list" is a per-user view toggle, never a platform-level removal.

**FIX6 第 4 项 — timeline events carry richer detail.** `step_completed` events now include `stepIndex` alongside `stepId` so `TicketTimeline.vue` can render "第 N 步：标题" using the `steps` prop passed in from `workflow/Pc.vue` and `Mobile.vue`. Each event type has a distinct icon/colour pair (`PlusCircle` / `UserPlus` / `CheckCircle` / `Award` / `Trash2`) — **note the lucide-vue-next export is `PlusCircle`, not `CirclePlus`** (the latter doesn't exist; using it will fail typecheck).

### Knowledge base — preview, edit, attachments
- **FIX6 第 2 项 — binary preview.** `GET /api/kb/{id}/download` streams the original file inline (correct MIME for PDF/DOCX/TXT/MD). `Preview.vue` and `Browse.vue` detect `type === 'pdf' | 'docx'` and render `<iframe :src="blobUrl">` via `fetchDocBlobUrl()`; text/experience entries keep the markdown render path. The Blob URL is `URL.revokeObjectURL`-ed on unmount / detail-panel-close to avoid leaks.
- **FIX6 第 5 项 — attachments bound to a parent.** `Document.parent_id` is a self-FK. `POST /api/kb/upload` accepts `parent_id` as **form field** (not query), so frontline workers must submit the text experience first (gets `latestDocId`), then upload supporting files which attach to it. `GET /api/kb` rolls children under `attachments[]` on each parent so they don't appear as orphan rows. Approve/reject on the parent cascades to all attachments in `POST /api/kb/review/{id}`.
- **FIX6 第 6 项 — auditor/admin can edit docs.** `PUT /api/kb/{id}` accepts partial `{title?, content?, category?, status?}`; if content changed AND status is `approved`/`ready`, the document is re-ingested (`remove_document` + `ingest_document`). The edit dialog lives in `KnowledgeManage.vue` and works for any doc including AI-generated ones — there's no separate "AI-source-only" gate.
- **FIX6 第 7 项 — PDF export font chain.** `_render_pdf()` tries `STSong-Light` (built-in CIDFont) → system CJK TTFs (`NotoSansCJK`, `wqy-microhei`, `simsun.ttc`, `PingFang.ttc`, …) → Helvetica with ASCII-replace fallback. Any failure in `_render_pdf` is wrapped to `HTTPException(500)` rather than a 500-stacktrace leak.

### Knowledge graph — overrides + source docs
`KGOverride` (`kg_overrides` table, kind=`node`/`edge`, op=`update`/`delete`) persists auditor edits on top of the dynamically-computed graph (FIX6 第 6 项). `_load_overrides()` merges them in `get_graph()` after node/edge construction.

`GET /api/kg/graph` now accepts `filter_doc_id` and attaches `source_docs: [{id, title, doc_type}, …]` to every node (FIX6 第 8 项), built from the `sourceDocIds` set tracked during entity extraction. The PC view (`src/views/kg/Pc.vue`) exposes a doc-filter `<select>` and renders the source list in the right panel; clicking an entry jumps to `/kb/preview/:id`.

CRUD endpoints (`require_auditor`): `PUT/DELETE /api/kg/node/{node_id}` and `PUT/DELETE /api/kg/edge/{edge_id}` where `edge_id` is `"{minSource}|{maxTarget}"` (sorted). The frontend wraps these in `src/api/kg.ts` (`updateNode / deleteNode / updateEdge / deleteEdge`).

### Drafts persist across navigation (FIX6 第 9 项)
`src/stores/search.ts` exposes `draft` (search question + image URLs/files) and `uploadDraft` (title/content/tags). Search Pc/Mobile and `knowledge/Upload.vue` call `setDraft / setUploadDraft` in `onBeforeUnmount` and read on mount; successful submission calls `clearDraft / clearUploadDraft`. Image `File` objects live in memory only (`draftImages` ref); their preview URLs persist via `localStorage` for restoration UX, but those URLs go stale on full reload.

### XSS — DOMPurify hardening
`src/utils/markdown.ts` renders markdown via `markdown-it { html: false }` and then **always** passes the result through `DOMPurify.sanitize` with an allowlist that forbids `<script>`, `<iframe>`, `<style>`, inline `style`, and all `on*` handlers (FIX5 第 18 项). Use `renderMarkdown(src)` from this file for any `v-html` of user-derived content — never bind raw strings.

### Search streaming & memory hygiene (FIX9 H5 / H15 / H16)
- `/api/chat/query` is SSE. `src/api/search.ts` exposes `multimodalSearchStream()` — `fetch` + `ReadableStream` (not `EventSource`, which can't POST/multipart), `onToken` accumulates per token; resolves to the same `SearchResult` shape as the legacy `multimodalSearch`. 401 reuses `clearActiveToken` + redirect. `Pc.vue`/`Mobile.vue` call `updateMessage(content: acc)` on each token for the typewriter effect.
- `kg/Pc.vue` keeps a module-level ECharts `inst`; `onBeforeUnmount` must `removeEventListener('resize')` + `ResizeObserver.disconnect()` + `inst.dispose()` + null it (FIX9 H15) — navigation thrash leaks otherwise.
- Blob URLs from `URL.createObjectURL` must be `revokeObjectURL`-ed on remove/clear: `MobileInputBar.removeImg` and `search/Pc.vue` `removeImage()`/`clearImages()` (FIX9 H16). The KB preview Blob URL is revoked on unmount / detail-panel-close (FIX6 第 2 项).

### Backend
- `app/main.py` — wires routers (`auth`, `kb`, `chat`, `ticket` + `workflow_router`, `kg`, `admin`); CORS from `settings.cors_origins_list` (default `localhost:5173` only, **not** `*` — FIX9 C3; `allow_credentials=False` so `Authorization` is covered by `allow_headers=["*"]`); `/api/health` is a **deep probe** returning `{ok, app, db, chroma, dashscope}` (FIX9 H3). Runs `Base.metadata.create_all` and `run_migrations()` on startup, then seeds the default admin.
- `app/core/config.py` — `Settings` + path resolution. **FIX9 C1: if `JWT_SECRET` is the default, `raise SystemExit` on import** (bypass via `ALLOW_INSECURE_JWT=true` / `DEBUG=true`). `CORS_ORIGINS` is comma-separated (`*` = fully open). DB/Chroma/Uploads relative paths are resolved absolute against `backend/` (FIX8: forward-slash DB_URL; FIX9 附: don't `lstrip` leading `/` off absolute paths).
- `app/services/llm.py` — thin DashScope wrapper (`chat_text`, **`chat_text_stream`** SSE generator, `vl_describe`, `embed`). All LLM access goes through here; `chat_text` has None-check + `RuntimeError` (FIX9 C4).
- `app/services/parser.py` — PDF/DOCX/TXT/MD parsing; PDF image extraction via `pypdf page.images` → `uploads/extracted_images/...`, text marked `[图片文件] {path}` (FIX8).
- `app/services/rag.py` — Chroma persistent client; `ingest_document` (split → embed → add), `search` (cosine-distance threshold `MAX_SEARCH_DISTANCE=0.65`, neighbors for context only, images from main chunk only), split into `rag_retrieve` (+ keyword fallback) / `build_user_prompt` / `rag_answer` (non-stream, kept for compat/tests). System prompt persona "龙芯智修"; `_NO_HIT_ANSWER` constant.
- `app/api/chat.py` — `/api/chat/query` accepts `question` + optional `image`; VL describes the image, then **streams the answer as SSE** (`text/event-stream`, events `token`/`meta`/`error`/`done` — FIX9 H5). Retrieve/recommend/sources computed with the request-level db before streaming; `QALog` written in an independent session after generation (the Depends session is closed once the `StreamingResponse` starts). `/api/chat/correct` saves a manual correction to a `QALog`.
- `app/api/ticket.py` — workflow + ticket CRUD, `POST /recommend`, `/timeline`, `/history`, `/{tid}/tools`, `/{tid}/manuals` (+ `/api/workflow/{tid}/...` aliases). Per-user progress + event log enforced here. `PATCH /{tid}/progress` advances a step (carries `stepIndex`); `PATCH /{tid}` is a legacy compat shim → `update_progress`.
- `app/api/kb.py` — upload (role-gated: worker uploads land `pending`, auditor/admin land `approved`; **`os.path.basename(file.filename)` + uuid fallback — FIX9 C2 path-traversal fix**), `/text`, `/text-with-files` (text + attachments bound via `parent_id`), list (parents + `attachments[]`), `/image/{image_name}` (serve extracted image), export `?format=pdf|md` (PDF via reportlab with CJK), download binary `/{id}/download`, update `/{id}` (auditor/edit, **vector rebuild is atomic — moved before `commit`, rollback on failure — FIX9 H1**), review cascade to attachments.
- `app/api/admin.py` — user CRUD, **password reset → random one-time password (`secrets.token_urlsafe`) + `bump token_version` (FIX9 C5, no longer `123456`)**; `create_user` with no password also generates a random one-time password (returned once). `is_default_admin` protection.
- `app/api/kg.py` — graph (dynamic entity extraction + KGOverride overlay + source_docs + filter), node/edge CRUD (auditor).
- Routers are prefixed `/api/...` (`kg` has no prefix but decorators inline the full `/api/kg/...` path). Auth via JWT (`app/core/security.py`), bcrypt password hashing, `get_current_user` dependency on protected routes.

### Knowledge graph animation
`src/views/kg/Pc.vue` pre-positions nodes on a circular layout with deterministic micro-jitter, sets `force.layoutAnimation:false` so the force simulation settles in one frame, and uses ECharts `elasticOut` easing with a `series.animationDelay` callback to fade edges in ~200 ms after nodes (FIX5 第 14 项). Don't replace this with a from-center force-init — that's the explicit anti-pattern this fixes.

## Project tracking docs
`NEEDS/` holds the original requirements (`NEEDS.md`, `后端环境搭建及接口文档.md`) and fix lists (`FIX1..7.md`); `CHANGE/` holds change logs including the design-hardening audits `2026-06-30-fix8.md` and `2026-07-01-FIX9-design-hardening.md` (FIX9 covers C1–C5 critical security + H1–H16 high; its full backlog lives at `~/.claude/plans/wiggly-wandering-cookie.md`). Code comments reference these (e.g. `"FIX5 第 13 项"`, `"FIX6 第 11 项"`, `"FIX9 C5"`) — consult them to understand why a piece of behavior exists.

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
npm run typecheck    # type check only — the only automated gate in this repo
npm run preview      # serve the production build
```
No test runner, no linter. `npm run typecheck` is the gate to run after any TS/Vue change.

Backend (run from `backend/`):
```bash
pip install -r requirements.txt
cp .env.example .env          # set DASHSCOPE_API_KEY etc.
uvicorn app.main:app --reload # → http://127.0.0.1:8000
```
On startup the backend (a) auto-creates tables (SQLite `loongchip.db`), (b) runs `run_migrations()` to add FIX5 columns on existing DBs, and (c) seeds default admin **`admin` / `123456`** — protected by `is_default_admin` (cannot be deleted, renamed, or demoted).

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

**FIX5 第 16 项 removed all mock fallback data.** Views now use try/catch + error UI (`EmptyState` / `AlertTriangle` banners) when the backend is unreachable. Do not re-introduce typed fallbacks — they previously masked real integration failures. Auth token is stored under `app:token` in localStorage and injected as a Bearer header; a 401 on a non-auth endpoint clears it and redirects via `location.hash = '#/login'`.

`VITE_API_BASE` (default `/api` in `.env.development`) points the SPA at the backend; Vite proxies `/api` to `127.0.0.1:8000` without path rewrite.

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

### XSS — DOMPurify hardening
`src/utils/markdown.ts` renders markdown via `markdown-it { html: false }` and then **always** passes the result through `DOMPurify.sanitize` with an allowlist that forbids `<script>`, `<iframe>`, `<style>`, inline `style`, and all `on*` handlers (FIX5 第 18 项). Use `renderMarkdown(src)` from this file for any `v-html` of user-derived content — never bind raw strings.

### Backend
- `app/main.py` — wires routers (`auth`, `kb`, `chat`, `ticket` + `workflow_router`, `kg`, `admin`), CORS `*`, `/api/health`. Runs `Base.metadata.create_all` and `run_migrations()` on startup, then seeds the default admin.
- `app/services/llm.py` — thin DashScope wrapper (`chat_text`, `vl_describe`, `embed`). All LLM access goes through here.
- `app/services/rag.py` — Chroma persistent client; `ingest_document` (split → embed → add), `search`, `rag_answer` (system prompt persona "龙芯智修").
- `app/api/chat.py` — `/api/chat/query` accepts `question` + optional `image`; image is described by Qwen-VL then fed into RAG.
- `app/api/ticket.py` — workflow + ticket CRUD, `POST /recommend`, `/timeline`, `/history`. Per-user progress + event log enforced here.
- `app/api/kb.py` — upload (role-gated: worker uploads land `pending`, auditor/admin land `approved`), list, export `?format=pdf|md` (PDF via reportlab with CJK).
- `app/api/admin.py` — user CRUD, password reset (always to `123456`), `is_default_admin` protection.
- Routers are prefixed `/api/...` (except `kg`). Auth via JWT (`app/core/security.py`), bcrypt password hashing, `get_current_user` dependency on protected routes.

### Knowledge graph animation
`src/views/kg/Pc.vue` pre-positions nodes on a circular layout with deterministic micro-jitter, sets `force.layoutAnimation:false` so the force simulation settles in one frame, and uses ECharts `elasticOut` easing with a `series.animationDelay` callback to fade edges in ~200 ms after nodes (FIX5 第 14 项). Don't replace this with a from-center force-init — that's the explicit anti-pattern this fixes.

## Project tracking docs
`NEEDS/` holds the original requirements (`NEEDS.md`, `后端环境搭建及接口文档.md`) and fix lists (`FIX1..5.md`); `CHANGE/` holds change logs. Code comments frequently reference these (e.g. `"FIX5 第 13 项"`) — consult them to understand why a piece of behavior exists.

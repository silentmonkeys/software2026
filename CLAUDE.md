# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A 设备检修知识检索与作业系统 (equipment-maintenance knowledge retrieval & work-guidance system) for industrial sites — multimodal RAG over maintenance docs. Two parts in one repo:

- **Frontend** (`/`, `src/`): Vue 3 + Vite + TypeScript SPA. Serves both a **PC industrial-display** form factor and a **mobile/tablet** form factor from one codebase.
- **Backend** (`backend/`): FastAPI + SQLAlchemy + Chroma vector DB, calls Alibaba DashScope (Qwen) for text/multimodal/embeddings.

Targets 信创 (domestic-stack) deployment: LoongArch CPU + 银河麒麟 V11. Build output is arch-independent static files.

## Commands

Frontend (run from repo root):
```bash
npm install
npm run dev          # vite dev server → http://localhost:5173 (proxies /api → 127.0.0.1:8000)
npm run build        # vue-tsc --noEmit type check THEN vite build → dist/
npm run typecheck    # type check only (vue-tsc --noEmit) — run this to validate TS/Vue changes
npm run preview      # serve the production build
```
There is no test runner and no linter configured. `npm run typecheck` is the only automated gate.

Backend (run from `backend/`):
```bash
pip install -r requirements.txt
cp .env.example .env          # set DASHSCOPE_API_KEY etc.
uvicorn app.main:app --reload # → http://127.0.0.1:8000
```
On startup the backend auto-creates tables (SQLite `loongchip.db`) and seeds a default admin account `admin / admin123`.

## Architecture

### Frontend dual form-factor (the core pattern)
`App.vue` reads `useDevice().isPC` and mounts either `PCLayout` or `MobileLayout`, both rendering the same `<router-view>`. Each business module under `src/views/<module>/` follows a three-file convention:
- `index.vue` — entry that delegates to PC or Mobile variant via `useDevice`
- `Pc.vue` — PC implementation
- `Mobile.vue` — mobile implementation

When changing a feature, you usually edit **both** `Pc.vue` and `Mobile.vue`. The router (`src/router/index.ts`) is a single flat table (hash mode) with `meta.layout`, `meta.roles` role guards, and `meta.mobileReadonly` (admin module is read-only on mobile).

### API layer & demo-fallback (important)
`src/api/request.ts` defines the axios instance and two wrappers used everywhere:
- `safeCall(fn, fallback)` — for endpoints returning `{code,msg,data}`; returns `data.data` on success, else `fallback`.
- `rawCall(fn, fallback?)` — for FastAPI endpoints returning the JSON body directly.

Both swallow network/backend errors and return typed **mock fallback data** so the UI is always demonstrable without a running backend. Each `src/api/<domain>.ts` ships its own mock fallbacks. To wire a real backend you point `VITE_API_BASE` (`.env.development`, default `/api`) at it; fallbacks can be removed incrementally. Auth token is stored under `app:token` in localStorage and injected as a Bearer header; a 401 (non-auth endpoint) clears it and redirects via `location.hash = '#/login'` (hash router — never use pathname).

### Roles — front/back mismatch to watch
Frontend roles (`src/utils/permission.ts`): `frontline | auditor | admin | guest`.
Backend roles: `worker | leader | admin`.
`src/api/auth.ts` `mapBackendRole()` bridges them (`worker→frontline`, `leader→auditor`). Keep this mapping in sync when touching auth on either side. `MENU_ITEMS` + `getVisibleMenuItems(role)` derive nav for both layouts from a single list.

### Backend
- `app/main.py` — wires routers (`auth`, `kb`, `chat`, `ticket` + `workflow_router`, `kg`, `admin`), CORS `*`, `/api/health`.
- `app/services/llm.py` — thin DashScope wrapper (`chat_text`, `vl_describe`, `embed`). All LLM access goes through here.
- `app/services/rag.py` — Chroma persistent client; `ingest_document` (split→embed→add), `search`, `rag_answer` (the system prompt is "龙芯智修").
- `app/api/chat.py` — `/api/chat/query` accepts `question` + optional `image`; image is described by Qwen-VL then fed into RAG.
- Routers are prefixed `/api/...` (except `kg`); the Vite proxy forwards `/api` untouched (no path rewrite).
- Auth via JWT (`app/core/security.py`), bcrypt password hashing, `get_current_user` dependency.

## Project tracking docs
`NEEDS/` holds the original requirements (`NEEDS.md`, `后端环境搭建及接口文档.md`) and fix lists (`FIX1..4.md`); `CHANGE/` holds change logs. Code comments frequently reference these (e.g. "FIX3 第 7 项") — consult them to understand why a piece of behavior exists.

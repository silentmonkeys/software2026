# 设备检修知识检索与作业系统

> 面向工业现场的多模态 RAG 设备检修助手。前端 Vue 3 + Vite，后端 FastAPI + SQLAlchemy + Chroma。
> 一套代码同时服务 **PC 工业大屏（1920×1080 / 2K）** 与 **车间手机 / 平板移动端**。

---

## 项目内容

整体由 **前端 SPA** 与 **后端 API 服务** 两部分组成，共用一个仓库；产线检修人员、知识审查员、系统管理员三类角色围绕"找答案 → 跟着做 → 沉淀经验"的闭环协作。

### 核心模块

| 模块 | 路径 | 简介 |
| --- | --- | --- |
| **多模态检索** | `/search` | 文本 + 图片输入，调用 Qwen 视觉理解 + Chroma 向量检索 + LLM 摘要；结果默认折叠引用材料，自动展开"推荐工单"卡片便于一键添加。 |
| **知识库浏览** | `/knowledge/browse` | 所有登录用户均可查看已入库文档，支持类型过滤、全文预览、**PDF / Markdown 导出**（reportlab 含中日韩字体）。 |
| **知识上传** | `/knowledge/upload` | 一线员工提交"经验分享"，提交后进入待审；管理员 / 审查员则在知识库管理页直接入库。 |
| **作业指引（工单）** | `/workflow` | 平台级工单 + 每用户独立进度（`user_ticket_progress`）；"我的工单" / "推荐工单"双栏；创建前优先相似度推荐，避免重复；按步骤推进、记录每步时间戳。 |
| **工单时间线** | 内嵌组件 | 完整记录 创建 / 加入 / 步骤完成 / 整体完成 / 删除（理由）；员工只看自己，审查员 / 管理员可看一条工单下所有用户的轨迹。 |
| **审查工作台** | `/auditor/review` | 知识条目通过 / 驳回 / 下架，所有变更走二次确认对话框，不可逆操作使用警示样式。 |
| **知识库管理** | `/auditor/knowledge` | 审查员 / 管理员对已入库文档增删改，配合 AI 助手快速分析。 |
| **知识图谱** | `/kg` | ECharts 力图（PC）/ 卡片流（Mobile）。PC 端节点按环形 + 微抖动预放置、`elasticOut` 弹性入场、边延迟分层渐入（FIX5 第 14 项）。 |
| **个人中心** | `/profile` | 资料、安全（修改自己的密码）、**历史工单 Tab**（已完成 / 已删除带理由，支持"重新添加到作业指引"）。 |
| **用户管理** | `/admin/user` | 管理员独占。任意角色账户增 / 改 / 删 / 重置密码（重置为 `123456`）。默认 `admin` 账号受 `is_default_admin` 保护，不可删除、不可改名、不可降权。 |

### 角色与权限

前端角色：`frontline`（一线检修员）/ `auditor`（审查员）/ `admin`（管理员）；后端枚举：`worker` / `leader` / `admin`。两者通过 `src/constants/roles.ts` **单一来源**统一管理，`mapBackendRole()` / `mapFrontendRole()` 负责互转，菜单 `MENU_ITEMS` 和路由 `meta.roles` 共用一套定义。

注册接口固定写入 `worker`，前端注册页不暴露角色字段；新增账户的初始密码统一为 `123456`，登录后可在个人中心自行修改。

---

## 技术栈

### 前端（仓库根目录）

| 维度 | 选型 |
| --- | --- |
| 框架 | Vue 3 + `<script setup>` + TypeScript |
| 构建 | Vite 5 |
| PC UI | Element Plus 2 |
| 移动 UI | Vant 4 |
| 样式 | Tailwind CSS 3 + CSS Variables 设计令牌 |
| 路由 | Vue Router 4（Hash 模式） |
| 状态 | Pinia 2 |
| HTTP | Axios + 类型化封装（`safeCall` / `rawCall`） |
| 图表 | ECharts 5 |
| Markdown / XSS | markdown-it + **DOMPurify 白名单二次净化** |
| 图标 | lucide-vue-next |

### 后端（`backend/`）

| 维度 | 选型 |
| --- | --- |
| Web 框架 | FastAPI |
| 数据库 | SQLAlchemy + SQLite (`loongchip.db`) |
| 向量库 | Chroma（本地持久化） |
| 大模型 | 阿里云 DashScope —— Qwen 文本 / Qwen-VL 视觉 / 文本 Embedding |
| 鉴权 | JWT + bcrypt |
| 启动迁移 | `Base.metadata.create_all` + 轻量 `run_migrations()` 补列 |

---

## 仓库结构

```
software2026/
├── src/                       前端源码
│   ├── api/                   axios 实例 + 各域接口（auth / kb / ticket / chat / kg / admin / search ...）
│   ├── components/
│   │   ├── common/            跨端通用：TicketTimeline / EmptyState / SimilarityBar / ConfidenceMeter ...
│   │   ├── pc/                PC 专用：TopBar / SideNav / CommandPalette(⌘K)
│   │   └── mobile/            Mobile 专用：AppBar / BottomTabBar / SwipeableCard ...
│   ├── composables/           useDevice / useTheme / useShortcut / useStreamText
│   ├── constants/roles.ts     ★ 角色枚举唯一来源
│   ├── layouts/               PCLayout / MobileLayout
│   ├── router/                单一路由表 + 角色守卫 + 移动端只读
│   ├── stores/                Pinia：user / search / workflow / ui
│   ├── utils/
│   │   ├── markdown.ts        markdown-it + DOMPurify 净化
│   │   ├── permission.ts      菜单可见性 + 角色映射 re-export
│   │   └── format / storage ...
│   ├── views/                 业务页面，多数遵循 index.vue + Pc.vue + Mobile.vue
│   │   ├── login/             登录 + 注册（仅员工）
│   │   ├── search/            多模态检索 + 详情
│   │   ├── workflow/          作业指引主页 + WorkList + 详情
│   │   ├── knowledge/         Browse / Preview / Upload / KnowledgeManage
│   │   ├── audit/             KnowledgeReview
│   │   ├── kg/                知识图谱 PC 力图 / Mobile 卡片
│   │   ├── history/           历史检索
│   │   ├── profile/           个人中心（资料 / 安全 / 历史工单）
│   │   └── admin/             用户管理
│   └── assets/styles/         tokens.css / globals.css / industrial.css / tailwind.css
├── backend/
│   └── app/
│       ├── main.py            FastAPI 入口 + 启动 seed 默认 admin
│       ├── api/               auth / kb / chat / ticket / kg / admin
│       ├── core/              db / config / security(JWT, bcrypt, get_current_user) / migrate
│       ├── models/            User / KbDoc / Ticket / UserTicketProgress / TicketEvent / KGNode ...
│       └── services/
│           ├── llm.py         DashScope 封装：chat_text / vl_describe / embed
│           └── rag.py         Chroma 持久化客户端 + ingest / search / rag_answer
├── NEEDS/                     需求与历次修复清单（NEEDS.md / FIX1..5.md）
├── CHANGE/                    变更记录
├── CLAUDE.md                  对 Claude Code 的工程上下文说明
├── public/  index.html
├── vite.config.ts  tailwind.config.js  tsconfig.json  package.json
```

---

## 快速开始

### 前端

```bash
npm install
npm run dev        # → http://localhost:5173 ，/api 自动代理到 127.0.0.1:8000
npm run typecheck  # 仅类型检查（vue-tsc --noEmit）
npm run build      # 类型检查 + 生产构建 → dist/
npm run preview    # 预览生产包
```

### 后端

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env       # 填入 DASHSCOPE_API_KEY 等
uvicorn app.main:app --reload   # → http://127.0.0.1:8000
```

启动时后端会自动创建表、补迁移、播种默认管理员。

### 默认账户

| 用户名 | 密码 | 角色 |
| --- | --- | --- |
| `admin` | `123456` | 管理员（不可删除） |

注册页只能创建一线员工账户；其他角色由管理员在 `/admin/user` 中创建。

---

## API 层约定

`src/api/request.ts` 提供两个统一封装：

- `safeCall(fn)` —— 处理 `{code,msg,data}` 信封，成功返回 `data.data`，失败 **抛错**。
- `rawCall(fn)` —— 处理 FastAPI 直接返回 JSON 的接口，失败抛错。

> **FIX5 第 16 项**：所有 mock 兜底数据已移除，接口失败时各视图统一用 `EmptyState` / `AlertTriangle` 错误态展示，避免"假数据兜底"造成误导。
> Token 存于 `localStorage` 键 `app:token`，按 Bearer 注入；401（非登录接口）会清除 token 并 `location.hash = '#/login'`。

后端路由除 `/api/kg` 外均带 `/api` 前缀，Vite 代理不重写路径。

---

## 安全

- **XSS**：`utils/markdown.ts` = `markdown-it { html:false }` + **DOMPurify** 白名单二次净化；禁用 `<script>` / `<iframe>` / 内联 `style` / `on*` 事件，URL 仅放行 `https?:` / `mailto:` / `#` / `/`。
- **本地存储**：只保存 token，不存明文用户资料；401 自动清除。
- **路由守卫**：`beforeEach` 验证 token，调用 `/api/auth/me` 拉取实体后再渲染；`meta.roles` 缺权限弹 toast 跳回。
- **后端鉴权**：所有受限路由依赖 `get_current_user` + 角色检查；默认 admin 受 `is_default_admin` 双重保护（用户名 + 标记列）。
- **密码**：bcrypt 哈希，注册 / 修改 / 重置统一校验长度 ≥ 6。
- **上传**：仅放行 `.pdf / .docx / .txt / .md`，单文件 ≤ 50 MB。
- **数据访问**：全 ORM 查询，无字符串拼 SQL。

---

## 设计系统

### 配色

| 名称 | 值 | 用途 |
| --- | --- | --- |
| Primary 深空蓝 | `#0B2545` | 顶栏、标题、关键操作 |
| Accent 机械橙 | `#F26B1F` | 主按钮、高亮、进度、警示 |
| AI 青 | `#00B7C2` | 多模态 / AI 入口 |
| Success / Warning / Danger | `#2E7D32` / `#ED6C02` / `#C62828` | 状态语义 |

支持 **暗色模式**、**高对比度模式**（强光下产线）、**字号档位**（base / lg / xl）、**手套模式**（1.3× 触控区）。

### 响应式断点

- `< 640px` → mobile（底部 Tab + 固定输入区）
- `640–1024px` → tablet（mobile 布局，组件略放宽）
- `≥ 1024px` → pc（完整三栏）

### 关键交互

- **⌘K / Ctrl+K** 命令面板（PC）
- **拖拽 / 粘贴** 上传图片，缩略图条带
- **AI 打字机** 流式输出诊断结论（`useStreamText`）
- **左滑驳回 / 右滑通过**（审核移动端 `SwipeableCard`）
- **长按麦克风** 模拟语音输入
- **震动反馈** 移动端步骤完成 / 错误时触发 `navigator.vibrate`

---

## 主要后端接口（节选）

| Method | Path | 说明 |
| --- | --- | --- |
| POST | `/api/auth/register` | 注册（强制 worker） |
| POST | `/api/auth/login` | 登录 → JWT |
| GET | `/api/auth/me` | 当前用户 |
| PUT | `/api/auth/change-password` | 修改自己的密码 |
| GET/POST/PUT/DELETE | `/api/admin/users` | 管理员账户 CRUD |
| PUT | `/api/admin/users/{id}/reset-password` | 重置为 `123456` |
| POST | `/api/kb/upload` / `/api/kb/text` | 文档 / 经验上传（员工进待审，管理员直入库） |
| GET | `/api/kb/list` `/api/kb/{id}` | 浏览 / 详情 |
| GET | `/api/kb/{id}/export?format=pdf\|md` | 导出 |
| POST | `/api/kb/{id}/review` | 审核通过 / 驳回 |
| POST | `/api/chat/query` | 多模态问答（文本 + 可选图片） |
| GET / POST | `/api/ticket` | 列出 / 创建工单 |
| POST | `/api/ticket/recommend` | 相似工单推荐 |
| POST | `/api/ticket/{id}/add` | 加入他人工单（新建独立进度） |
| PUT | `/api/ticket/{id}/progress` | 推进步骤 |
| DELETE | `/api/ticket/{id}` | 删除（未完成需理由） |
| GET | `/api/ticket/{id}/timeline` | 时间线（审查员 / 管理员可看所有用户） |
| GET | `/api/ticket/history` | 个人历史工单 |
| GET | `/api/kg/graph` | 知识图谱节点 + 边 |
| GET | `/api/kb/{docId}/chunk/{chunkId}` | 节点对应原文片段 |

---

## 验收快查

| 项 | 状态 |
| --- | --- |
| `npm run typecheck` | ✅ 0 错误 |
| 注册仅创建员工账户 | ✅ |
| 默认管理员 `admin / 123456`，不可删除 | ✅ |
| 个人改密 + 管理员重置 | ✅ |
| 审查员 `/auditor/review` + `/auditor/knowledge`，操作前二次确认 | ✅ |
| 知识库导出 PDF / Markdown | ✅ |
| 工单：完成可直接删，未完成需理由；他人工单可"添加到我的" | ✅ |
| 工单时间线（员工只看自己 / 审查员 admin 看全部） | ✅ |
| 多模态检索：引用折叠，推荐工单自动展示 | ✅ |
| 知识图谱弹性入场动画 | ✅ |
| 全站无 Mock 兜底数据 | ✅ |
| 角色枚举单一来源（`src/constants/roles.ts`） | ✅ |
| XSS：markdown-it + DOMPurify | ✅ |
| 全部信创 / LoongArch / 银河麒麟 UI 标签已移除（FIX5 第 15 项） | ✅ |

---

## 部署

前端构建产物 `dist/` 为标准静态文件，可由 nginx / Apache 托管；后端任意能跑 Python 3.10+ 的服务器即可。

```nginx
server {
  listen 80;
  root /var/www/maintenance;
  location / { try_files $uri $uri/ /index.html; }
  location /api/ { proxy_pass http://backend:8000/; }
}
```

后端首次启动会创建 `loongchip.db` 与 Chroma 持久化目录；如需重置，直接删除即可重新播种。

---

## License

仅用于评审与演示。© 2026

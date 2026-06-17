> 在前一轮（2026-06-17 09:57 交付的 7 项修复：401 鉴权/假数据清理/注册/管理员知识库/对话式检索/首页重心/上传简化）的基础上，本轮再迭代 8 个新问题。
> 将本文件完整粘贴给 Claude，让其按顺序逐项修复。每完成一个大项，运行 `npx vue-tsc --noEmit` 确认类型无误后再进入下一项；所有 PC 端改动必须同步移动端，移动端以 Vant 组件为准，PC 端以 Element Plus 为准。

---

## 项目背景

- 第十五届中国软件杯 A1 赛题——「基于多模态大模型技术的设备检修知识检索与作业系统」
- 前端：Vue 3 + TypeScript + Vite，PC 端 Element Plus，移动端 Vant
- 后端：FastAPI（`http://127.0.0.1:8000`），JWT 鉴权
- 部署要求：LoongArch64 + 银河麒麟 V10/V11
- 用户角色：`worker`（一线检修员）/ `auditor`（审核员）/ `admin`（管理员）

后端接口（来自 `NEEDS/后端环境搭建及接口文档.md`）需要新增/确认的能力：

- `/api/chat/history` `GET/DELETE` —— 按用户隔离的检索历史
- `/api/kb/pending` `GET` + `/api/kb/review/{id}` `POST` —— 知识审批
- `/api/workflow/{id}/steps` —— 步骤化作业指引
- `/api/workflow/{id}/tools` —— 工具清单
- `/api/workflow/{id}/manuals` —— 关联手册（真实 doc_id）
- `/api/kg/graph?doc_ids=...` —— 基于已审文档的知识图谱
- 现有 `/api/chat/query` 保持单轮检索语义，禁止把多轮历史拼接进 query

---

## 修复总览

| 序号 | 问题                                                        | 影响面          | 严重度 |
| :--: | ----------------------------------------------------------- | --------------- | :----: |
|  1   | 工作台界面（`/workspace`）存在假数据                        | 全端            |   P0   |
|  2   | 历史与收藏假数据；AI 回答不持久；无内容                     | 全端            |   P0   |
|  3   | 检索：MD 未渲染 / 来源错位 / 用户间串数据                   | 全端            |   P0   |
|  4   | 作业指引：步骤无勾选、工具空、关联手册假数据                | 全端            |   P0   |
|  5   | 知识图谱为硬编码，与文档脱节，只看标题                      | 全端            |   P1   |
|  6   | 删除"试试这些问题"入口与示例提示气泡                        | 检索页          |   P1   |
|  7   | 员工上传需审批；员工页只显示本人记录；管理员/审核员有"审查" | 知识上传+管理员 |   P0   |
|  8   | 删除"检修中"状态；已完成工单默认折叠                        | 工单/作业       |   P2   |

---

## 问题 1：删除工作台（dashboard）页面

### 现象

`/workspace`（`src/views/dashboard/*`）下展示的工单、待办、统计卡等全部是写死的 mock，且不能由用户数据填充。

### 修复要求

1. **直接删除整个工作台模块**，不在 UI 中再以任何形式暴露：
   - `src/views/dashboard/Pc.vue`
   - `src/views/dashboard/Mobile.vue`
   - `src/views/dashboard/index.vue`（如存在）
   - `src/api/dashboard.ts`（如存在）
2. **路由清理**：
   - 删除 `router/index.ts` 中所有 `path: '/workspace'`、`path: '/dashboard'` 的注册
   - 删除 `name: 'Workspace'` / `name: 'Dashboard'` 相关 redirect
3. **导航清理**：
   - `src/components/pc/SideNav.vue` / `TopBar.vue`：删除"工作台"入口
   - `src/components/mobile/BottomTabBar.vue` / `MobileSideDrawer.vue`：删除"工作台"入口
4. **回归检查**：
   - 启动 dev server，确认侧边栏/底栏已无工作台入口
   - 直接访问 `/workspace` 或 `/dashboard` 应跳转到 `/search`（首页）

---

## 问题 2：历史与收藏假数据 + AI 回答不持久

### 现象

- "历史记录"列表是 `localStorage` 中的几条固定标题
- 进入历史点击某条，只显示标题，没有 AI 生成的具体回答内容
- 关闭检索页后，重新进入历史，回答内容丢失
- 收藏同样问题

### 修复要求

#### 2.1 检索页本地自动保存会话

文件：`src/views/search/Pc.vue`、`src/views/search/Mobile.vue`

每次 `POST /api/chat/query` 成功后（无论是否收藏），把整条会话**完整**落盘：

```ts
interface ChatSession {
  id: string; // nanoid
  userId: string; // 当前用户 id（来自 user store）
  title: string; // 首条 user 消息的前 30 字
  createdAt: number; // Date.now()
  updatedAt: number;
  starred: boolean; // 是否收藏
  messages: ChatMessage[]; // 完整消息流
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string; // assistant 此处保留 markdown 原文
  sources?: SourceItem[]; // 来源引用（与渲染时一致）
  createdAt: number;
}
```

落盘 key：`chat:sessions:<userId>`（按用户隔离）。**严禁使用全局 key**。结构：

```ts
// stores/chatHistory.ts (新增)
const STORAGE_KEY = computed(() => `chat:sessions:${userStore.id}`);

const sessions = ref<ChatSession[]>(loadFromStorage(STORAGE_KEY.value));

watch(sessions, (val) => saveToStorage(STORAGE_KEY.value, val), { deep: true });
```

#### 2.2 历史列表展示真内容

文件：`src/views/history/*`（PC + 移动端）

- 列表项右侧增加"摘要预览"：取该会话前两条 user + assistant 消息，截断到 60 字，纯文本
- 点击进入历史详情（`/history/:id`）需**完整渲染原消息流**，包括 markdown 文本与来源引用
- 收藏 / 取消收藏：通过 `sessions.find(s => s.id === id).starred = !...` 切换并立即落盘
- 列表项需要二次确认删除（`showConfirmDialog`）

#### 2.3 持久化策略

- 每次 `messages.push` 之后整体保存（用 deep watch 节流到 300ms）
- 提供"清空全部历史"按钮，二次确认后清空
- 切换用户时强制重新加载（监听 userId 变化）

#### 2.4 离线兼容

- 后端不可达时，**不**写入历史（避免保存空内容）。但已存在的本地历史仍可读。

---

## 问题 3：检索渲染与用户隔离

### 现象

- AI 返回的 markdown 文本在前端**没有渲染**（直接当纯文本显示）
- 来源引用卡片里的"来源文档 / 页码"与**当前回答内容不对应**（错位、串号）
- 不同账号登录后，看到的"历史记录"和"收藏"是同一份

### 修复要求

#### 3.1 正确渲染 Markdown

文件：`src/views/search/Pc.vue`、`src/views/search/Mobile.vue`

- 引入 `markdown-it`（PC 端）+ `vant-markdown` 或 `md-editor-v3` 的只读渲染模式（移动端）
- assistant 消息体渲染时用 `<div class="md-body" v-html="render(content)" />`
- 注意 XSS：使用 `markdown-it` 时开启 `html: false`、关闭 `linkify`，并白名单 `a` 的 `href` 协议为 `https:`
- 表格、列表、代码块、引用块需有基础样式
- 代码块使用 highlight.js 着色（颜色主题与项目一致）

#### 3.2 来源引用与回答强绑定

- 后端 `/api/chat/query` 返回结构必须包含 `sources: [{ id, docId, title, snippet, page? }]`
- 前端 assistant 消息保存时**连同 sources 一并写入**会话（参见 2.1 的 `ChatMessage.sources`）
- 渲染时，来源卡片**只显示当前消息自带的 sources**，不再使用全局变量或上一次的结果
- 来源卡片在"折叠"状态默认收起，点击"查看 N 条引用"展开

#### 3.3 按用户隔离

- 历史 / 收藏 / 上传记录 / 工单 全部按 `userId` 隔离
- 历史 key 形如 `chat:sessions:<userId>`（已在 2.1 完成）
- 收藏 key 形如 `chat:starred:<userId>`
- 后端历史接口如果新增，**必须带 token**，后端用 JWT sub 过滤

#### 3.4 退出登录清理

- `stores/user.ts` 的 `logout()` 中清空 pinia 中所有会话相关的内存缓存（localStorage 留作用户本人离线用，但下次同账号登录会重新校验签名）
- 不要在 logout 中删除**别的用户**的数据

---

## 问题 4：作业指引结构化与真实引用

### 现象

- 作业步骤是纯文本，每步没有勾选框，无法标记完成
- "所需工具"页是空白
- "关联手册"列出的是固定几条假手册
- 进入作业后无法回到列表

### 修复要求

#### 4.1 步骤化结构与勾选

文件：`src/views/workflow/detail/Pc.vue`（或现有 `Pc.vue` 内的 step 组件）

后端响应应改为：

```ts
interface WorkOrderStep {
  index: number; // 1-based
  title: string; // 步骤名称
  description: string; // 详细操作（markdown）
  safetyNote?: string; // 安全提醒（高亮色）
  tools?: ToolItem[]; // 步骤用到的工具
  acceptance?: string; // 验收标准
  done: boolean; // 由前端本地保存
}
```

前端：

- 每一步渲染为独立 `<el-card>` 或 `<van-card>`，左侧有 `<el-checkbox>` / `<van-checkbox>`
- 勾选状态存到 `localStorage`：`workorder:steps:<orderId>` 存 `{ [index]: boolean }`
- 顶部展示进度条：`doneSteps / totalSteps`

#### 4.2 工具清单

- 新增"工具"页签或步骤内嵌区
- 后端 `/api/workflow/{id}/tools` 返回真实工具：
  ```ts
  interface ToolItem {
    name: string;
    spec?: string;
    qty: number;
    imageUrl?: string;
  }
  ```
- 若后端暂无此接口，前端 `workflowApi.getTools(id)` 必须先打接口，失败时显示"暂未提供工具清单"，**禁止回退到假数据**

#### 4.3 关联手册必须真实

- 删除 `src/api/workflow.ts` 中所有写死的 `mockManuals`、`mockWorkOrders`（保留仅 1 条标 `示例` 的兜底，且在 UI 上明确"示例工单"，不可被勾选完成）
- 后端 `/api/workflow/{id}/manuals` 返回：
  ```ts
  interface ManualRef {
    docId: string;
    title: string;
    matchedSection?: string;
    score: number;
  }
  ```
- 关联手册点击跳到"知识库"对应文档详情（路由 `/kb/preview/:docId`）
- 没有手册时显示"暂未关联到任何手册"，不要回退到默认列表

#### 4.4 返回列表

- 顶部增加面包屑：`工单列表 / 当前作业名`
- 面包屑第一级可点击回 `WorkList.vue`

---

## 问题 5：知识图谱去假数据

### 现象

`src/views/kg/Pc.vue` 和 `Mobile.vue` 中的图谱是写死的若干节点/边，跟用户已上传的文档毫无关系。点击节点只看到标题，看不到内容。

### 修复要求

#### 5.1 数据源必须是真实文档

- 新增 `/api/kg/graph?doc_ids=...`（按已审核入库的文档过滤）
- 前端 `kgApi.getGraph()` 调用时**必须传**已通过审核的 `doc_id` 列表（从 `kbApi.list({ status: 'approved' })` 取）
- 严禁在前端硬编码任何 `mockGraphNodes` / `mockGraphEdges`；如果后端尚未实现，前端允许显示"暂无可视化的图谱数据"，不可再渲染假图

#### 5.2 节点与文档内容联动

- 每个节点附带 `docId` 与 `chunkId`
- 节点详情面板（ECharts tooltip 或右侧 drawer）展示：
  - 节点名称（实体）
  - 实体类型（设备 / 故障 / 案例 / 手册）
  - **对应原文片段**（从后端 `/api/kb/{docId}/chunk/{chunkId}` 拉取真实文本）
  - 跳转链接 → 知识库对应文档预览

#### 5.3 移动端

- 用 `<van-collapse>` 卡片流
- 每个卡片只展示该文档下"被识别出的实体"列表，名称可点击展开原文
- 顶部有"已选文档"筛选器

#### 5.4 性能

- ECharts 用 `echarts.getInstanceByDom` 避免重复初始化
- 节点 > 200 时开启 `large: true` 模式
- 增加"重置视图"和"导出 PNG"按钮

---

## 问题 6：删除"试试这些问题"入口

### 现象

`src/views/search/Pc.vue` 初始状态下方有"试试这些问题"区块 + 4 条示例问题卡片，移动端同理。

### 修复要求

- 删除"试试这些问题"标题、4 个示例 `<el-card>` / `<van-cell>` 区块
- 初始页面**只保留**：标题、居中输入框、可选附件按钮
- 移动端对应同步删除（`Mobile.vue` + `MobileInputBar.vue`）
- 检索完成后展示的"建议追问"也一并删除（避免类似问题再现）
- **保留**功能：用户点击输入框聚焦、附件按钮、发送按钮
- 保留"清空对话"按钮（放右上角小图标）

---

## 问题 7：知识上传引入审批流 + 按用户隔离

### 现象

- 所有员工上传的文档都直接入库
- 员工界面看到的"已上传"列表里能看到别人的记录
- 管理员/审核员没有任何"审查"入口

### 修复要求

#### 7.1 三种角色的上传界面权限

| 角色      | 上传页可见内容                              |
| --------- | ------------------------------------------- |
| `worker`  | 上传组件 + **仅本人**上传记录               |
| `auditor` | 上传组件 + 全部待审列表 + "通过 / 驳回"按钮 |
| `admin`   | 同 auditor + 已通过列表 + 强制下架按钮      |

#### 7.2 上传状态机

- 文档新增字段 `status: 'pending' | 'approved' | 'rejected' | 'taken_down'`
- worker 上传后默认 `pending`，**不入知识图谱、不进入 RAG 检索**
- auditor/admin 审核后改为 `approved`，才可被检索 / 出现在图谱
- 后端需新增：
  - `GET /api/kb/list?status=pending&uploader=<id>`
  - `POST /api/kb/review/{doc_id}` body `{ action: 'approve' | 'reject' | 'take_down', reason?: string }`
- 知识图谱接口 `GET /api/kg/graph` **只取 status=approved** 的文档

#### 7.3 员工端"上传记录"列表

- 文件：`src/views/knowledge/Upload.vue`
- 调用 `/api/kb/list?uploader=me` 拉本人记录
- 每行展示：文档名 / 上传时间 / 状态（待审 / 已通过 / 已驳回）/ 驳回原因
- 不显示"删除"按钮（一旦上传不可自行删除，只能联系审核员下架）
- 驳回后允许"重新提交"——重新走上传流程

#### 7.4 审核员/管理员"审查"页

- 新增 `src/views/audit/KnowledgeReview.vue`（路由 `/audit/knowledge`）
- 仅 `auditor` / `admin` 可访问（路由守卫 `meta.roles`）
- 列表按"待审" / "已通过" / "已驳回" 三个 Tab
- 每行右侧操作：
  - 待审：通过 / 驳回（驳回弹窗填原因）
  - 已通过：下架（弹窗填原因）
- 通过后立即触发后端向量化、加入 Chroma 集合、加入图谱索引

#### 7.5 管理员知识库管理页（已存在的 `KnowledgeAdmin.vue`）改造

- 增加 status 筛选器（全部 / 待审 / 已通过 / 已驳回）
- 上传按钮仅 `admin` 可见
- 删除按钮（已通过）触发下架流程而不是物理删除

#### 7.6 员工 vs 管理员视觉差异

- worker 顶栏**不显示**"知识审查" / "系统管理"入口
- auditor 顶栏显示"知识审查"
- admin 顶栏显示"知识审查" + "系统管理"

---

## 问题 8：删除"检修中"状态 + 已完成折叠

### 现象

- 工单状态有"待办 / 检修中 / 已完成"等
- "检修中"作为独立 tab/筛选存在，演示时实际是空数据
- 已完成工单默认铺在列表中

### 修复要求

#### 8.1 移除"检修中"状态

- `src/api/ticket.ts` 中工单状态枚举改为：`pending` / `done`（中文 `待办` / `已完成`）
- 工单列表组件删除"检修中"tab
- 后端响应过滤 `status != 'in_progress'`（如果后端还返回，统一映射到 `pending`）

#### 8.2 已完成默认折叠

- `src/views/workflow/WorkList.vue`：
  - 状态筛选默认勾选 `pending`（待办）
  - "已完成"作为次级折叠区，默认收起
  - 折叠区标题显示数量：`已完成（3）`
- PC 端用 `<el-collapse>`，移动端用 `<van-collapse>`

#### 8.3 完结工单自动归档

- 用户在作业详情页点击"完成工单" → 调 `POST /api/ticket/{id}/complete` → 工单 `status` 变 `done` → 自动从默认列表消失，落入"已完成"折叠区

#### 8.4 移动端 BottomTabBar 适配

- 工单 Tab 内也按相同逻辑（默认只看待办，"已完成"折叠）

---

## 修复顺序与验收标准

按以下顺序逐项修复，每项完成后运行：

```bash
npx vue-tsc --noEmit
npx vite build
# 启动 dev server，手动按角色（worker/auditor/admin）走一遍核心流程
```

| 顺序 | 问题             | 验收标准                                                                     |
| :--: | ---------------- | ---------------------------------------------------------------------------- |
|  1   | 删除工作台       | 侧边栏/底栏无工作台入口；直接访问 URL 跳 `/search`                           |
|  2   | 历史与收藏持久化 | 关闭页再开能恢复完整 markdown 内容；按用户隔离；不同账号互不可见             |
|  3   | 检索渲染与隔离   | markdown 正确渲染；来源卡片与回答一一对应；用户间数据独立                    |
|  4   | 作业指引结构化   | 每步可勾选；工具页有真实清单（接口无则提示）；关联手册可跳转                 |
|  5   | 知识图谱真实化   | 节点来自已审文档；点击看真实原文；无假数据                                   |
|  6   | 删除示例问题     | 初始页只剩标题+输入框+附件                                                   |
|  7   | 知识审批         | worker 上传=pending；auditor/admin 可通过/驳回；通过后才入图谱；员工只看本人 |
|  8   | 工单状态简化     | 无"检修中"；已完成默认折叠在折叠区                                           |

---

## 注意事项

1. **不要破坏已有移动端适配**——所有修改需同时改 PC + Mobile 两套
2. **mock 兜底逻辑**——只在工单列表保留 1 条"示例工单"，其它页面**一律不允许回退到假数据**
3. **类型安全**——所有新增/修改的代码必须通过 `vue-tsc --noEmit`
4. **后端接口格式**——以 `NEEDS/后端环境搭建及接口文档.md` 为准；不确定时先用 curl 测试，缺接口就在 prompt 里写出预期契约请后端补
5. **权限控制**——前端 UI 隐藏不等于后端鉴权；所有 admin/auditor 接口必须带 token，后端二次校验
6. **按用户隔离**——所有本地存储的 key 必须包含 `userId`；所有列表接口必须带 `userId`/`uploader` 过滤
7. **可回滚**——每个问题独立 commit，避免一次性大改

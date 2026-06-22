# FIX6 — 问题修复清单

> 参照 `problem_fix5.md` 中检查出的 11 项问题，给出每一项的定位分析与修复指令。
> 下发给 Claude Code 直接执行。

---

## 第 1 项：一线员工（worker / frontline）无法访问知识库浏览页

**问题描述**  
角色为 `frontline` 的工人登录后，无法进入 `/knowledge/browse`，菜单项不可见或路由被拦截。

**定位**

- `src/utils/permission.ts` → `MENU_ITEMS` 中知识库条目的 `roles` 数组可能遗漏了 `frontline`。
- `src/router/index.ts` → 对应路由的 `meta.roles` 同样可能只含 `auditor | admin`。

**修复指令**

```
1. 打开 src/utils/permission.ts，找到 MENU_ITEMS 中 path 为 /knowledge/browse 的条目，
   将其 roles 数组改为 ['frontline', 'auditor', 'admin']。

2. 打开 src/router/index.ts，找到路由 /knowledge/browse，
   将 meta.roles 改为 ['frontline', 'auditor', 'admin']。

3. 同步检查 /knowledge/preview 和 /knowledge/upload 路由：
   - /knowledge/preview：同上，三种角色均可读。
   - /knowledge/upload：frontline 可以上传（上传后进入 pending 审核态，已有逻辑）。

4. 执行 npm run typecheck，确认 0 错误。
```

---

## 第 2 项：知识库文档无法预览、无法删除；部分 PDF 预览空白

**问题描述**

- 知识库列表页，点击文档后预览弹窗内容为空（尤其是 PDF）。
- 审查员 / 管理员在知识库管理页找不到删除按钮，或点击无响应。

**定位**

- **PDF 预览空白**：`src/views/knowledge/Preview.vue`（或 Browse 中内嵌预览）使用 `<iframe>` 或 `<object>` 渲染 `/api/kb/{id}` 返回的二进制流；可能缺少 `Content-Type: application/pdf` 响应头，或前端未正确传递 `Authorization` header 导致后端 401 后返回空内容。
- **删除按钮缺失 / 无响应**：`src/views/knowledge/KnowledgeManage.vue` 中删除操作的角色守卫或按钮渲染条件有误；后端 `DELETE /api/kb/{id}` 端点可能未实现或路由未注册。

**修复指令**

```
1. 后端 backend/app/api/kb.py：
   a. 确认存在 GET /api/kb/{id}/download（或直接由 GET /api/kb/{id} 返回文档内容）且
      响应头含 Content-Type: application/pdf（对 .pdf 文件）及
      Content-Disposition: inline; filename="xxx.pdf"。
   b. 确认存在 DELETE /api/kb/{id} 端点，角色守卫允许 leader / admin，
      执行软删除（设置 deleted_at）并从 Chroma 中删除对应向量（rag.py delete_document）。
   c. 若 rag.py 中没有 delete_document，新增：
      collection.delete(where={"doc_id": doc_id})

2. 前端 src/views/knowledge/Preview.vue（或 Browse.vue 内的预览组件）：
   a. 对 PDF 文件，改用带 token 的 Blob URL 预览方式：
      const resp = await axios.get(`/api/kb/${id}/download`, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` }
      })
      const url = URL.createObjectURL(resp.data)
      // 赋给 <iframe src> 或 <embed src>
   b. 释放时调用 URL.revokeObjectURL(url)。

3. 前端 src/views/knowledge/KnowledgeManage.vue：
   a. 删除按钮的 v-if 条件改为 isAuditorRole(role) || role === 'admin'（从 roles.ts 导入）。
   b. 点击删除后弹二次确认对话框（与 FIX5 审核确认保持一致），确认后调用
      DELETE /api/kb/{id}，成功后从列表中移除该条目并 ElMessage.success('已删除')。

4. npm run typecheck。
```

# 修正后完整需求描述+修复指令（需求逻辑纠正：用户删除工单后，该工单仍需正常出现在推荐列表，仅当前用户本次已删除记录不影响后续再次推荐）

## 第 3 项：用户删除工单后，工单仍正常展示在「推荐工单」列表

### 问题描述

用户对工单执行软删除操作后，该工单永久不再出现在此用户的「推荐工单」栏目；预期逻辑为：用户仅隐藏本次工单，工单仍需持续参与推荐，后续依旧能被该用户刷到、重新看到。
根因定位：`backend/app/api/ticket.py` 中推荐工单、工单列表查询逻辑使用全局 `deleted_at IS NULL` 过滤，只要用户在 `user_ticket_progress` 存在任意删除记录，就永久过滤该工单，导致用户删除一次后永久看不到对应工单。

### 修复指令

```
1. 打开 backend/app/api/ticket.py，定位 GET /api/ticket 与 POST /api/ticket/recommend 接口查询逻辑。

2. 「推荐工单」查询逻辑改造（核心：删除记录不永久屏蔽工单，工单持续可推荐）：
   - Ticket 主表不增加全局 deleted_at 过滤，工单为平台公共资源，单个用户操作不影响全局展示；
   - 移除原有「存在user_ticket_progress删除记录则过滤工单」的永久屏蔽逻辑；
   - 查询条件仅过滤：当前用户已领取/参与（有效进行中）的工单，软删除记录不纳入推荐过滤条件；
   - 子查询规则调整：仅排除 user_ticket_progress 内 status=参与中、deleted_at 为空的工单，用户仅做过删除标记的工单仍参与推荐。

3. 「我的工单」查询逻辑保持不变：
   仅查询 UserTicketProgress.user_id = 当前用户 AND UserTicketProgress.deleted_at IS NULL 的有效工单；
   /profile 历史工单Tab展示已删除工单，原有逻辑无需改动。

4. 数据层约束修正：
   普通用户仅操作 UserTicketProgress 做行级软删除，禁止普通用户修改 Ticket 主表 deleted_at；
   Ticket 主表下架/删除权限仅开放给管理员、审核人员。

5. 执行类型校验：npm run typecheck
```

---

## 第 4 项：工单时间线未完成

**问题描述**  
工单详情页的时间线组件展示不完整，缺少部分事件类型或渲染异常。

**定位**

- `src/components/common/TicketTimeline.vue` 可能未处理全部 `TicketEvent.event_type` 枚举值（`created / added / step_completed / completed / deleted`）。
- 后端 `GET /api/ticket/{id}/timeline` 可能没有完整记录所有事件，或返回结构与前端期望不一致。

**修复指令**

```
1. 后端 backend/app/api/ticket.py 确认以下所有状态转换都写入 TicketEvent：
   - created：POST /api/ticket 创建时
   - added：POST /api/ticket/{id}/add 加入他人工单时
   - step_completed：PUT /api/ticket/{id}/progress 每一步完成时，event_data 含 step_index
   - completed：UserTicketProgress.status 变为 completed 时
   - deleted：UserTicketProgress.deleted_at 被设置时，event_data 含 delete_reason
   每条 TicketEvent 需含字段：ticket_id, user_id, event_type, event_data(JSON), created_at。

2. GET /api/ticket/{id}/timeline 返回格式：
   {
     "events": [
       {
         "id": int,
         "event_type": str,
         "event_data": dict,
         "created_at": ISO8601,
         "user": { "id": int, "username": str, "role": str }
       }
     ]
   }
   worker 只返回自己的事件；auditor / admin 返回所有用户事件并按 created_at 升序。

3. 前端 src/components/common/TicketTimeline.vue：
   为每种 event_type 定义 icon、颜色和文案映射：
   - created → CirclePlus，蓝色，"创建了工单"
   - added → UserPlus，绿色，"加入了工单"
   - step_completed → CheckCircle，橙色，"完成第 N 步：{step_title}"（从 event_data.step_index 取）
   - completed → Award，金色，"完成工单"
   - deleted → Trash2，红色，"删除工单：{event_data.reason}"
   对未知类型 fallback 到 Info 图标。

4. 在工单详情页（Pc.vue / Mobile.vue）加载时调用 GET /api/ticket/{id}/timeline，
   将结果传给 <TicketTimeline :events="events" /> 组件。

5. npm run typecheck。
```

---

## 第 5 项：经验上传的附件被单独提交为独立审核条目

**问题描述**  
员工在"经验上传"页同时填写文本描述和上传附件时，附件被当作独立知识条目进入审核队列，而非与文本作为同一案例绑定。

**定位**

- `src/views/knowledge/Upload.vue`（或 Mobile 版）可能对文本和附件分别调用了两次 `/api/kb/text` 和 `/api/kb/upload`，未将它们关联为同一条知识条目。
- 后端 `/api/kb/upload` 接口可能未接受 `parent_id` 字段以关联主条目。

**修复指令**

```
1. 后端 backend/app/api/kb.py：
   a. POST /api/kb/upload 接受可选字段 parent_id: int | None。
      若 parent_id 有值，则新建的 KbDoc 的 parent_id 字段设为该值，
      并在 KbDoc 模型（models/）中添加 parent_id 外键列（ForeignKey('kb_docs.id')）。
   b. run_migrations() 中补迁移：ALTER TABLE kb_docs ADD COLUMN parent_id INTEGER REFERENCES kb_docs(id)。
   c. GET /api/kb/list 返回时将附件文档内嵌在主文档的 attachments 字段中，而非单独列出：
      对 parent_id IS NULL 的文档列出，同时 eager load parent_id == id 的子文档。

2. 前端 src/views/knowledge/Upload.vue（Pc.vue / Mobile.vue）：
   a. 上传流程改为：
      Step1：调用 POST /api/kb/text 提交文本经验，获得返回的 doc_id（主条目 ID）。
      Step2：若用户同时上传了附件，循环调用 POST /api/kb/upload 并在表单中带上 parent_id=doc_id。
   b. 若用户只上传附件（无文字）：先创建一个空文本主条目（title 取文件名，content 为空），
      再上传附件并关联该主条目。

3. 审核页 src/views/audit/KnowledgeReview.vue：
   a. 列表中对有 attachments 的主条目展示附件数量徽标。
   b. 审核通过主条目时，同步将其 attachments（子文档）也变更为 approved；
      驳回主条目时，子文档同步变为 rejected。

4. npm run typecheck。
```

---

## 第 6 项：知识图谱及大模型生成的知识无法被审查员/管理员调整

**问题描述**  
审查员和管理员在知识图谱页无法编辑节点/边，也无法对 AI 自动生成并入库的知识条目进行修改。

**定位**

- `src/views/kg/Pc.vue` 图谱节点缺少编辑入口，无右键菜单或编辑按钮。
- `backend/app/api/kg.py`（或类似文件）可能未提供 PUT/DELETE 端点来修改节点和边。
- 知识库管理页 `KnowledgeManage.vue` 可能未展示 AI 自动入库的条目。

**修复指令**

```
1. 后端 backend/app/api/kg.py（若不存在则新建）：
   PUT /api/kg/node/{id}   — 修改节点 label / properties；角色守卫 leader / admin。
   DELETE /api/kg/node/{id} — 删除节点（级联删除关联边）；角色守卫 leader / admin。
   PUT /api/kg/edge/{id}   — 修改边 relation；角色守卫 leader / admin。
   DELETE /api/kg/edge/{id} — 删除边；角色守卫 leader / admin。
   在 main.py 中注册该路由（若已有则补充缺失端点）。

2. 前端 src/views/kg/Pc.vue：
   a. 对 isAuditorRole(role) || role==='admin' 的用户，节点点击时弹出操作菜单（EditDialog）：
      - 编辑标签 / 属性 → PUT /api/kg/node/{id}
      - 删除节点 → 二次确认 → DELETE /api/kg/node/{id}
   b. 边也同理，点击边显示编辑 / 删除操作。
   c. 操作后调用 GET /api/kg/graph 刷新图谱。

3. 前端 src/views/knowledge/KnowledgeManage.vue：
   a. 列表查询 GET /api/kb/list 不加 source 过滤，确保 AI 自动生成并入库的条目（source='ai'）
      也出现在列表中。
   b. 为每条 AI 来源的条目加"AI 生成"徽标以区分人工上传。
   c. 编辑表单允许修改 title、content、tags；提交到 PUT /api/kb/{id}（若无则后端新增）。

4. 后端 backend/app/api/kb.py 补充 PUT /api/kb/{id}：
   允许 leader / admin 修改 title、content、tags、status。

5. npm run typecheck。
```

---

## 第 7 项：文件无法导出

**问题描述**  
知识库详情页"导出 PDF"或"导出 Markdown"点击后无响应或报错，文件未下载。

**定位**

- `backend/app/api/kb.py` → `GET /api/kb/{id}/export?format=pdf|md`：
  - reportlab CJK 字体文件路径在当前部署环境中不存在，导致 PDF 生成抛异常。
  - 或响应头缺少 `Content-Disposition: attachment`，浏览器未触发下载。
- 前端调用该接口时未使用 `responseType: 'blob'`，导致二进制内容被当字符串处理。

**修复指令**

```
1. 后端 backend/app/api/kb.py → export 端点：
   a. PDF 生成时对字体路径做 try/except：
      - 优先从项目内嵌字体目录 backend/app/assets/fonts/ 加载 NotoSansSC-Regular.ttf。
      - 若不存在，fallback 到系统字体（Linux：/usr/share/fonts/ 递归查找 .ttf）。
      - 若均不存在，以纯 ASCII 模式生成 PDF（CJK 字符替换为拼音或跳过），不抛异常。
   b. 响应头必须含：
      Content-Type: application/pdf  （PDF）或 text/markdown  （MD）
      Content-Disposition: attachment; filename="{title}.pdf"（或 .md）
   c. Markdown 导出直接返回 doc.content 字符串，无需 reportlab。

2. 前端 src/api/kb.ts（或对应 API 文件）导出接口：
   export const exportDoc = (id: number, format: 'pdf' | 'md') =>
     axios.get(`/api/kb/${id}/export`, {
       params: { format },
       responseType: 'blob',
       headers: { Authorization: `Bearer ${getToken()}` }
     })

3. 前端调用处（KnowledgeManage.vue / Preview.vue）：
   const res = await exportDoc(id, format)
   const url = URL.createObjectURL(new Blob([res.data]))
   const a = document.createElement('a')
   a.href = url
   a.download = `${title}.${format}`
   a.click()
   URL.revokeObjectURL(url)

4. npm run typecheck。
```

---

## 第 8 项：知识图谱节点标签不显示关联案例和手册；无法按案例/手册筛选图谱

**问题描述**  
点击知识图谱节点时，弹出详情不包含该节点关联的知识库文档（案例 / 手册）链接；也没有"按文档筛选图谱"的入口。

**定位**

- `backend/app/api/kg.py` → `GET /api/kg/graph` 返回的节点数据缺少 `source_docs` 字段。
- 后端构建图谱时未将 `KbDoc` 与 `KGNode` 建立关联（无外键或中间表）。
- 前端节点详情弹窗未渲染 `source_docs` 字段。

**修复指令**

```
1. 后端模型 backend/app/models/（KGNode 或相关模型文件）：
   a. 确认 KGNode 有字段 source_doc_ids: JSON（存储关联的 KbDoc id 列表）。
      若无，添加该列并在 run_migrations() 补迁移：
      ALTER TABLE kg_nodes ADD COLUMN source_doc_ids TEXT DEFAULT '[]';
   b. 知识入库（rag.py ingest_document）时，在图谱构建/更新逻辑中，
      将新文档 id 追加到相关节点的 source_doc_ids 里。

2. 后端 GET /api/kg/graph 返回格式中节点增加：
   "source_docs": [
     { "id": int, "title": str, "doc_type": str }
   ]
   通过 source_doc_ids 批量查询 KbDoc 并内嵌。

3. 前端 src/views/kg/Pc.vue 节点详情弹窗：
   a. 在弹窗底部展示"关联文档"区块，列出 source_docs 列表，
      每条为可点击链接，跳转到 /knowledge/preview?id={doc_id}。
   b. 若 source_docs 为空显示"暂无关联文档"。

4. 前端 src/views/kg/Pc.vue 侧边栏（或顶部工具栏）增加"按文档筛选"下拉：
   a. 调用 GET /api/kb/list 获取已入库文档列表作为选项。
   b. 选中某文档后，过滤图谱：只显示 source_doc_ids 含该文档 id 的节点及其一阶关系边。
   c. 清空筛选时恢复完整图谱。

5. Mobile 版 src/views/kg/Mobile.vue 卡片流同步显示关联文档信息。

6. npm run typecheck。
```

---

## 第 9 项：切换页面后表单内容丢失（主界面 / 知识上传页）

**问题描述**  
在"多模态检索"主界面填写问题、上传图片，或在"经验上传"页填写内容后，跳转到其他路由再返回，表单内容全部清空。

**定位**  
表单状态保存在组件本地 `ref` / `reactive`，组件随路由卸载被销毁。需将关键草稿状态持久化到 Pinia store。

**修复指令**

```
1. src/stores/search.ts（已存在）：
   新增 draft 状态：
   draft: {
     question: string,
     images: File[] | null,
     imageUrls: string[]   // 预览 URL
   }
   提供 setDraft(q, imgs) 和 clearDraft() action。

2. src/views/search/Pc.vue 和 Mobile.vue：
   a. onBeforeUnmount → store.setDraft(question.value, images.value)
   b. onMounted → 若 store.draft.question 非空则恢复表单（question、imageUrls 预览）。
   c. 提交成功后调用 store.clearDraft()。

3. src/stores/ui.ts（或新建 src/stores/uploadDraft.ts）：
   新增上传草稿状态：
   uploadDraft: {
     title: string,
     content: string,
     tags: string[],
     files: null   // File 不序列化，只保留 title/content/tags
   }

4. src/views/knowledge/Upload.vue（Pc.vue / Mobile.vue）：
   a. onBeforeUnmount → 保存 title / content / tags 到 store.uploadDraft。
   b. onMounted → 若 store.uploadDraft.title 非空则恢复表单。
   c. 提交成功后调用 store.clearUploadDraft()。
   注意：File 对象不可序列化到 localStorage，只恢复文字字段，附件提示用户重新选择。

5. npm run typecheck。
```

---

## 第 10 项：同一账号可同时在多台设备登录，应限制为单点登录

**问题描述**  
同一账号在手机和 PC 端同时登录均有效，应当新登录使旧登录失效。

**定位**  
当前 JWT 无状态，无法主动吊销。需引入 session 版本号或 token 黑名单机制。

**修复指令**

```
1. 后端数据库模型 backend/app/models/（User 模型）：
   a. 新增字段 token_version: int，默认值 1，随每次登录 +1。
   b. run_migrations() 补迁移：
      ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 1;

2. 后端 backend/app/core/security.py：
   a. 生成 JWT 时在 payload 中加入 token_version: user.token_version。
   b. get_current_user 依赖中：解码 JWT 后，查询数据库用户的当前 token_version，
      若 payload.token_version != user.token_version，
      抛出 HTTP 401 {"detail": "账号已在其他设备登录，请重新登录"}。

3. 后端 backend/app/api/auth.py → POST /api/auth/login：
   登录成功时执行 user.token_version += 1 并 db.commit()，
   再生成含新 token_version 的 JWT 返回。

4. 前端：已有 401 → 清除 token → 跳转 /login 的逻辑（FIX5 第 16 项），无需额外修改。
   可选：在 401 toast 中区分"登录已过期"和"账号在其他设备登录"两种提示语：
   若响应 detail 含"其他设备"字样，显示专属提示。

5. npm run typecheck。
```

---

## 第 11 项：普通用户修改自己密码时意外覆盖了管理员账户的密码

**问题描述**  
在同一浏览器中同时打开用户端和管理员端时，普通用户在"个人中心"修改自己的密码，
导致管理员账户的密码也被同时修改。

**根因分析**  
后端"修改个人密码"接口（`PUT /api/user/me/password` 或 `PUT /api/auth/change-password`）
中用于确认身份的 `current_user` 依赖注入，来自请求头 `Authorization: Bearer <token>`。
两个浏览器 Tab 同时登录不同账号时，若前端 Axios 实例共用同一个 token 变量，
则普通用户发起请求时携带的 token 可能已被管理员登录覆盖（或反之），
导致后端以管理员身份执行了改密操作。

**可能的具体位置**

1. `src/utils/request.ts`（或 `src/utils/http.ts`）：全局 Axios 实例的请求拦截器从
   `localStorage.getItem('token')` 或 Pinia userStore 读取 token，
   而两个 Tab 共享同一 `localStorage` key，后登录者的 token 会覆盖先登录者的。
2. `backend/app/api/user.py`（或 auth.py）中 `change-password` 端点使用了正确的
   `current_user` 依赖，但 `current_user` 实际已是被覆盖后的管理员对象。

**修复指令**

```
1. 【根治方案】前端：为用户端和管理员端使用各自隔离的 token 存储 key。
   a. 打开 src/utils/auth.ts（或 src/utils/token.ts），找到 getToken / setToken 实现。
      修改存储 key 区分角色：
        - 普通用户 token 存为 localStorage.setItem('user_token', ...)
        - 管理员 token 存为 localStorage.setItem('admin_token', ...)
      或更简洁地：将 key 参数化，不同入口（src/views/login/UserLogin.vue vs AdminLogin.vue）
      调用时传入不同的 key 名称。

   b. 对应地，Axios 请求拦截器中，根据当前路由前缀（/admin 开头用 admin_token，
      其余用 user_token）读取不同 key：
        const isAdmin = window.location.pathname.startsWith('/admin')
        const token = localStorage.getItem(isAdmin ? 'admin_token' : 'user_token')
        if (token) config.headers.Authorization = `Bearer ${token}`

   c. 退出登录时只清除对应 key（不要用 localStorage.clear()）。

2. 【后端加固】backend/app/api/user.py，PUT /api/user/me/password（或 change-password）：
   a. 在执行修改密码前，必须先验证旧密码正确：
      if not verify_password(body.old_password, current_user.hashed_password):
          raise HTTPException(400, "旧密码不正确")
   b. 验证通过后，只允许修改 current_user 自身的密码：
      current_user.hashed_password = get_password_hash(body.new_password)
      db.commit()
   c. 日志记录：logger.info(f"[change-password] user_id={current_user.id} username={current_user.username}")
      便于事后审计是否发生了错误的写入。

3. 【后端加固】backend/app/api/admin.py，PUT /api/admin/users/{id}/reset-password（管理员重置他人密码）：
   a. 严格用路径参数 id 查询目标用户，不允许使用 current_user：
      target_user = db.query(User).filter(User.id == id).first()
      if not target_user: raise HTTPException(404, "用户不存在")
   b. 写入哈希时确认写入 target_user.hashed_password，不是 current_user.hashed_password。
   c. 不允许通过此接口重置 admin 自身密码（用个人中心修改）。

4. 前端 src/views/profile/ChangePassword.vue（用户端改密页）：
   a. 确认调用的是 /api/user/me/password 而非 /api/admin/... 端点。
   b. 请求体应包含 old_password 和 new_password，由后端验证旧密码。

5. npm run typecheck，重点检查 getToken / setToken 的所有调用方。
```

---

## 执行顺序建议

| 优先级     | 项目          | 原因                                                              |
| ---------- | ------------- | ----------------------------------------------------------------- |
| P0（立刻） | 第 11 项      | 数据安全：用户改密覆盖管理员密码（localStorage token 被共享覆盖） |
| P0（立刻） | 第 10 项      | 安全：账号可多端同时在线                                          |
| P1（尽快） | 第 1 项       | 工人无法使用知识库核心功能                                        |
| P1（尽快） | 第 2 项       | PDF 预览和删除完全不可用                                          |
| P1（尽快） | 第 7 项       | 导出功能完全不可用                                                |
| P2         | 第 3、4、5 项 | 工单逻辑完善                                                      |
| P2         | 第 6、8 项    | 图谱管理与关联增强                                                |
| P3         | 第 9 项       | 体验优化，不影响功能                                              |

---

> 每项修复完成后请执行 `npm run typecheck`（前端）确认 0 错误。
> 后端变更需重启 `uvicorn app.main:app --reload` 以触发 `run_migrations()` 补列。

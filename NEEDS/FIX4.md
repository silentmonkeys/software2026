# 修复提示词 — 基于多模态大模型技术的设备检修知识检索与作业系统

> 本文档供投喂给 Claude 继续完成剩余修复工作。背景：项目前端 Vue 3 + TypeScript，已按 FIX3 契约完成 8 项修复（见下文），但 Claude 实现返回后仍存在 4 个问题。请逐一修复。

---

## 项目背景

- 项目：第十五届中国软件杯 A1 赛题 — 基于多模态大模型技术的设备检修知识检索与作业系统
- 前端：Vue 3 + TypeScript + Pinia + Vant/Element Plus
- 后端契约：遵循 FIX3 接口约定，任一接口未实现时 UI 一律显示空态/原因文案，绝不回退到假数据
- 硬性约束：所有假数据必须彻底清除，后端不具备的能力前端必须优雅降级而非伪造

---

## 已完成的修复（勿动）

以下 8 项修复已完成且验证通过，本次仅处理下面的 4 个剩余问题，**不要回退已有修复**：

| #   | 模块                                | 简要                                                                                                                                                                                                                                                                                                                                                            |
| --- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | 删除工作台                          | views/dashboard/\* 已删；/workspace、/dashboard 重定向到 /search；MENU_ITEMS/SideNav/BottomTabBar/MobileSideDrawer/CommandPalette 均已移除入口                                                                                                                                                                                                                  |
| 2   | 历史与收藏持久化                    | stores/chatHistory.ts（按 chat:sessions:<userId> 隔离 + deep watch 持久化）；views/history/Detail.vue；history/Pc.vue 已重写；logout 时清内存缓存                                                                                                                                                                                                               |
| 3   | markdown 渲染 + 来源绑定 + 用户隔离 | utils/markdown.ts（markdown-it html:false + 链接白名单 + .md-body 样式）；search.ts 透传 doc_id/page；SourceItem 与每条 ChatMessage 独立绑定 expandedSources；后端不可达抛错不写假数据                                                                                                                                                                          |
| 4   | 作业指引结构化                      | stores/workflow.ts 有 stepDone + 校验点持久化（workorder:steps:<id>）；workflow/Pc.vue + Mobile.vue 三个 Tab（步骤/工具/手册）；api/workflow.ts 有 getWorkflowTools/getWorkflowManuals（接口缺失返回空数组）；面包屑回列表；completeTicket 完成工单                                                                                                             |
| 5   | 知识图谱去假数据                    | api/kg.ts 已重写（先 kbApi.listDocs 取已审 docIds → /api/kg/graph?doc_ids=…）；节点带 docId/chunkId；详情面板调 /api/kb/{docId}/chunk/{chunkId}；移动端 van-collapse 风格 + 文档多选筛选；ECharts 复用实例 + 节点 >200 开启 large                                                                                                                               |
| 6   | 删除示例问题                        | search/Pc.vue + Mobile.vue 已移除 SAMPLES 数组与"试试这些问题"区块                                                                                                                                                                                                                                                                                              |
| 7   | 知识上传审批流                      | api/kb.ts 已重写（status: pending/approved/rejected/taken_down）；listDocs({status, uploader})；reviewDoc(id, action, reason?)；knowledge/Upload.vue 已重写（员工只看本人记录、不可自删、驳回可重提）；audit/KnowledgeReview.vue 已新建（三 Tab）；admin/KnowledgeAdmin.vue 有状态筛选+下架按钮；MENU_ITEMS/BottomTabBar 有"知识审查"入口（auditor/admin 可见） |
| 8   | 工单状态简化                        | api/ticket.ts 已重写（TicketStatus = pending                                                                                                                                                                                                                                                                                                                    | done，normalizeStatus 兼容旧值）；api/workflow.ts WorkItemStatus = 待办 | 已完成；WorkList.vue 已重写（默认待办，已完成进折叠区） |

---

## 剩余问题（必须修复）

### 问题 1：个人中心界面依然存在占位的假数据

**现象**：个人中心页面（Profile/User Center）显示了硬编码的假数据，如假用户名、假统计数据、假工单数量等。

**修复要求**：

1. 遍历 `views/profile/`（或 `views/user/`、`views/settings/` 等个人中心相关目录）下所有 .vue 文件
2. 删除所有硬编码的假数据（如 `const stats = ref({ total: 100, ... })`、写死的 `张三`、`138xxxx` 等）
3. 所有数据必须从已有的 API/Store 获取：
   - 用户信息 → 调用 `/api/user/profile` 或已有的 auth store
   - 工单统计 → 调用 `/api/tickets?status=...` 统计 count
   - 知识条目数 → 调用 `/api/kb/docs?uploader=<userId>` 统计
   - 收藏/历史条目数 → 从 chatHistory store 读取
4. 若后端接口尚未实现，**显示"加载失败"或"暂无数据"空态**，不允许硬编码填充
5. 加载状态用骨架屏或 loading 状态，不可瞬间显示 0 然后闪烁数据

**关键检查点**：

- Profile.vue / UserCenter.vue / Mine.vue / Settings.vue 等文件
- 所有 `ref({...})` 初始化为假数据的地方
- 统计数字、头像 URL、昵称、手机号、邮箱等字段

---

### 问题 2：作业指引页面回退 — 需要重建步骤-子步骤结构

**现象**：作业指引（Workflow）页面在 Claude 实现后回退到了旧版，未实现你要求的"大步骤 → 小步骤"层级结构，也未提取工具到工具列表 Tab。

**你的原文要求**：

> 我需要的是生成操作步骤后的每一个步骤中都应当会有一个小步骤，只有完成每一个步骤中的小步骤才能下一步。

**数据结构要求**（后端接口可能需要同步修改）：

期望 `/api/workflow/{id}` 返回结构：

```json
{
  "ticketId": "xxx",
  "title": "水泵检修标准作业流程",
  "steps": [
    {
      "id": "step-1",
      "title": "风险预检",
      "description": "在开始拆卸水泵之前，必须完成以下安全预检步骤",
      "subSteps": [
        {
          "id": "sub-1-1",
          "content": "确认水泵所在系统已完全停机，切断主电源并挂牌上锁（LOTO），验证无残余电压（使用验电器）"
        },
        {
          "id": "sub-1-2",
          "content": "关闭进、出口阀门及旁通阀，泄压并排空泵腔及管道内介质（水/液体），确认压力表归零"
        },
        {
          "id": "sub-1-3",
          "content": "检查作业环境：通风良好、无积水、防滑措施到位；高温或密闭空间需评估气体检测与监护要求"
        },
        {
          "id": "sub-1-4",
          "content": "识别介质特性：若为腐蚀性、有毒或含杂质介质，须穿戴耐腐蚀手套、护目镜、围裙等PPE，并准备应急冲洗设施"
        },
        {
          "id": "sub-1-5",
          "content": "核查水泵基础、联轴器防护罩、地脚螺栓状态，防止拆卸过程中倾倒或机械伤害"
        }
      ],
      "tools": [
        "验电器",
        "万用表",
        "挂牌/锁具",
        "防腐蚀手套",
        "护目镜",
        "围裙",
        "气体检测仪"
      ]
    }
    // ...更多步骤
  ],
  "toolList": [
    { "name": "验电器", "type": "电气安全", "image": "https://..." },
    { "name": "万用表", "type": "电气安全", "image": "https://..." }
  ]
}
```

**前端修复要求**：

**A. 步骤面板（"步骤" Tab）**：

1. 每个大步骤是一张独立的可折叠卡片（van-collapse-item / el-collapse-item），标题显示步骤标题（如"风险预检"）
2. 展开后显示该步骤下的所有子步骤，**每条子步骤是一个独立的 checkbox item**
3. 子步骤的完成状态持久化到 `workorder:steps:<ticketId>`（已有 stores/workflow.ts 的 stepDone 机制），确保刷新不丢失
4. **严格顺序约束**：
   - 子步骤必须按顺序完成：只有当前面所有子步骤都勾选后，才能勾选下一个
   - 大步骤之间也必须按顺序：只有当前面所有大步骤的所有子步骤都完成后，下一个大步骤才能展开/操作
   - 未满足条件的子步骤/步骤显示为 disabled/灰态，hover 提示"请先完成上一步"
5. 每个大步骤卡片底部显示完成进度（如 "3/5 已完成"）

**B. 工具 Tab**：

1. 从每个步骤的 `tools` 字段**自动归并去重**，汇总成全局工具清单
2. 如果后端提供了 `toolList` 则直接使用（含图片等元数据）；否则从 steps 中提取纯名称列表展示
3. 工具列表支持搜索过滤
4. 接口缺失时显示"暂未提供工具清单"

**后端注意**：

- 如果当前 `/api/workflow/{id}` 接口不支持返回带 subSteps 的结构，需要同步修改后端
- `/api/workflow/{id}/tools` 和 `/api/workflow/{id}/manuals` 接口需确保返回真实数据

---

### 问题 3：知识图谱没有具体呈现

**现象**：知识图谱（Knowledge Graph）页面渲染为空或仅展示节点但没有连线/内容，需要完善后端程序来实现知识图谱的数据供给。

**当前的修复（#5 已完成）**：前端已按契约调用：

- `GET /api/kg/graph?doc_ids=...`（传入 kbApi.listDocs 取到的已审 docIds）
- `GET /api/kb/{docId}/chunk/{chunkId}`（详情面板拉真实片段）

**根因分析**：`/api/kg/graph` 接口可能返回了空数据或不完整的图结构，导致前端 ECharts 渲染为空。

**后端修复要求**：

`GET /api/kg/graph?doc_ids=id1,id2,id3` 需要返回：

```json
{
  "nodes": [
    {
      "id": "n1",
      "label": "离心泵",
      "category": "设备",
      "docId": "doc-001",
      "chunkId": "chunk-a1"
    },
    {
      "id": "n2",
      "label": "机械密封",
      "category": "部件",
      "docId": "doc-001",
      "chunkId": "chunk-a2"
    },
    {
      "id": "n3",
      "label": "振动超标",
      "category": "故障",
      "docId": "doc-002",
      "chunkId": "chunk-b1"
    },
    {
      "id": "n4",
      "label": "更换轴承",
      "category": "维修方案",
      "docId": "doc-003",
      "chunkId": "chunk-c1"
    }
  ],
  "edges": [
    { "source": "n1", "target": "n2", "label": "包含" },
    { "source": "n3", "target": "n1", "label": "发生于" },
    { "source": "n4", "target": "n3", "label": "解决" }
  ]
}
```

**关键约束**：

1. 图谱必须基于**已审核通过的知识文档**构建（status=approved），不允许对 pending/rejected 的文档建图
2. 节点附带 `docId` 和 `chunkId`，前端点击节点时调用 `/api/kb/{docId}/chunk/{chunkId}` 获取详情片段
3. 如果没有任何已审核的文档，返回 `{ nodes: [], edges: [] }` 而非报错
4. 图谱算法建议：
   - 从已审文档中提取实体（设备名、部件名、故障名、维修方案等）
   - 通过共现关系或预定义关系生成边
   - 或用 LLM 对文档片段做实体关系抽取后入图

**前端无需改动**（#5 已修复），仅需确保后端提供有效数据即可。

---

### 问题 4：权限分级存在问题，无法创建审查员账户和管理员账户

**现象**：系统缺少审查员（auditor）和管理员（admin）角色的创建与管理功能。目前所有用户可能都是普通用户（employee），无法执行知识审查、用户管理等高级操作。

**修复要求**：

**A. 角色体系**：
系统至少支持三种角色，存储在用户表/令牌中：

| 角色     | 标识       | 权限范围                                              |
| -------- | ---------- | ----------------------------------------------------- |
| 普通员工 | `employee` | 搜索、对话、上传知识、查看本人上传记录、查图谱        |
| 审查员   | `auditor`  | 员工权限 + 审查知识（通过/驳回）、查看已审记录        |
| 管理员   | `admin`    | 审查员权限 + 用户管理（角色分配）、知识下架、系统配置 |

**B. 前后端需实现的接口**：

1. **用户管理（仅 admin）**：
   - `GET /api/admin/users` — 用户列表（分页、搜索、按角色筛选）
   - `PUT /api/admin/users/{userId}/role` — 修改用户角色（body: `{ "role": "auditor" }`）

2. **角色信息**：
   - 登录接口返回的 token/userInfo 中必须包含 `role` 字段
   - 前端已有的 auth store 应已存储 role，确保能用于权限判断

3. **前端页面**：
   - 新建 `views/admin/UserManagement.vue`（仅 admin 可见）
     - 用户列表表格（用户名、手机号、角色、注册时间）
     - 角色下拉切换（employee ↔ auditor ↔ admin），仅 admin 可操作
     - 建议集成到已有的 `admin/KnowledgeAdmin.vue` 同级目录
   - 菜单入口：MENU_ITEMS 和 BottomTabBar 中已有"知识审查"入口（auditor/admin 可见，修复 #7 已完成）；新增"用户管理"入口（仅 admin 可见）

**C. 权限守卫**：

- 前端路由守卫：非对应角色访问管理页面时重定向到首页并 toast 提示
- 后端中间件：接口层面校验角色，非 admin 调用用户管理接口返回 403

**D. 初始化**：

- 需要一个初始化脚本或首次启动时的逻辑，创建默认 admin 账户（如 admin / admin123）
- 或在注册接口中允许通过邀请码/密钥来注册为特定角色

---

## 交付检查清单

任务完成后请确认：

- [ ] **问题1**：个人中心页面无任何硬编码假数据，所有字段来自 API/Store，接口缺失时显示空态文案
- [ ] **问题2**：作业指引页面的步骤面板按"大步骤可折叠 → 内部子步骤可勾选"结构渲染，子步骤有顺序约束，工具 Tab 自动汇总工具清单
- [ ] **问题2**：`/api/workflow/{id}` 接口已按 subSteps 结构返回数据（或前端兼容新旧两种结构）
- [ ] **问题3**：`/api/kg/graph?doc_ids=...` 接口基于已审文档返回真实图谱数据（nodes + edges）
- [ ] **问题4**：用户表有 role 字段，登录/注册流程正确分发角色
- [ ] **问题4**：`/api/admin/users` 和角色修改接口可用
- [ ] **问题4**：管理员可创建/修改审查员和管理员账户
- [ ] **问题4**：前端用户管理页面已创建，仅 admin 可见
- [ ] **总体**：所有接口缺失场景均优雅降级，绝不回退到假数据

---

## 开发原则重申

1. **假数据零容忍**：任何地方发现了假数据都是 bug，必须清除
2. **接口缺失必须显式处理**：try-catch 或 if (!res) 后显示"加载失败"/"暂未提供"等文案
3. **状态覆盖**：loading → 数据 → empty → error 四种状态在关键页面都要覆盖
4. **不改已完成修复**：只改上述 4 个问题涉及的文件，不要回退 #1~#8 的任何改动

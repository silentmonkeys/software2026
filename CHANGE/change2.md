修复汇总

#: 1
问题: 删除工作台
主要改动: 删除 views/dashboard/*；/workspace /dashboard 改为 redirect→/search；MENU_ITEMS / SideNav / BottomTabBar /
MobileSideDrawer / CommandPalette 都移除入口

────────────────────────────────────────

#: 2
问题: 历史与收藏持久化
主要改动: 新建 stores/chatHistory.ts，按 chat:sessions:<userId> 隔离 + deep watch 持久化；新建
history/Detail.vue；history/Pc.vue 重写；logout 时清空内存缓存（保留本地数据）

────────────────────────────────────────

#: 3
问题: markdown 渲染 + 来源绑定 + 用户隔离
主要改动: 新建 utils/markdown.ts（markdown-it html:false + 链接白名单 + 全局 .md-body 样式）；search.ts 透传 doc_id /
page 到 meta；SourceItem 与每条 ChatMessage 绑定，独立 expandedSources[m.id]；后端不可达时抛错而非写假数据

────────────────────────────────────────

#: 4
问题: 作业指引结构化
主要改动: stores/workflow.ts 加 stepDone + 校验点持久化（workorder:steps:<id>）；workflow/Pc.vue + Mobile.vue 三个
Tab（步骤 / 工具 / 手册），每步独立卡片可勾选；api/workflow.ts 新增 getWorkflowTools /
getWorkflowManuals（接口缺失时返回空数组，UI 显示"暂未提供…"，绝不回退到假数据）；面包屑回列表；completeTicket
完成工单

────────────────────────────────────────

#: 5
问题: 知识图谱去假数据
主要改动: api/kg.ts 重写：先从 kbApi.listDocs 取已审 docIds，传给
/api/kg/graph?doc_ids=…，无文档/接口缺失时返回空图；节点附带 docId/chunkId；详情面板调用
/api/kb/{docId}/chunk/{chunkId} 拉真实片段；移动端按 <van-collapse> 风格 + 文档多选筛选；ECharts 复用实例 + 节点 >
200 开启 large

────────────────────────────────────────

#: 6
问题: 删除示例问题
主要改动: search/Pc.vue + Mobile.vue 移除 SAMPLES 数组与"试试这些问题"区块；保留输入框、附件、新建对话按钮

────────────────────────────────────────

#: 7
问题: 知识上传审批流
主要改动: api/kb.ts 重写（status: pending/approved/rejected/taken_down，listDocs({status, uploader})，reviewDoc(id,
action, reason?)）；knowledge/Upload.vue 重写（员工只看本人记录、不可自删、驳回可重提）；新建
audit/KnowledgeReview.vue（待审 / 已通过 / 已驳回三 Tab，含驳回 / 下架原因）；admin/KnowledgeAdmin.vue 加状态筛选 +
下架按钮（区分硬删除）；MENU_ITEMS / BottomTabBar 加"知识审查"入口（仅 auditor/admin 可见）

────────────────────────────────────────

#: 8
问题: 工单状态简化
主要改动: api/ticket.ts 重写 TicketStatus = pending|done（含 normalizeStatus 兼容旧 open/doing）；api/workflow.ts
WorkItemStatus = 待办|已完成；WorkList.vue 重写（默认显示待办，已完成进 <el-collapse> / <van-collapse>
折叠区且标题显示数量）；完成工单 → completeTicket 自动归档

新增文件：stores/chatHistory.ts、utils/markdown.ts、views/history/Detail.vue、views/audit/KnowledgeReview.vue、views/k
nowledge/Preview.vue。

/api/chat/history /api/kb/review/{id} /api/workflow/{id}/tools|manuals /api/kg/graph?doc_ids
/api/kb/{docId}/chunk/{chunkId} 这些后端接口前端已按 FIX3 的契约调用；任一接口未实现时 UI
一律显示空态/原因，不再退回到假数据。
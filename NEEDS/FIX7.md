## 第 1 项：折叠引用面板内容与问题无关，且引用条目缺少跳转链接

**问题描述**  
多模态检索页 AI 回答下方有一个可折叠的"引用来源"面板（Collapse 组件），存在两个问题：

1. 面板内按序排列的引用条目显示的文档摘要与本次提问内容无关（疑似历史残留或错误数据源）。
2. 每条引用条目只有标题和摘要文字，无跳转链接，用户无法查看原文。

**决策：保留折叠面板，删除 AI 正文中的 `[N]` 内联引用标注**，统一由折叠面板承载所有引用展示。

**根因分析**

- 折叠面板绑定了独立的状态变量（如 `refList` / `searchStore.references`），未随新查询重置，
  或由独立接口（非本次 RAG 检索结果）填充，与实际命中 chunks 不对应。
- 引用条目模板只渲染了 `doc_title` + `snippet` 文字，未生成跳转链接；
  后端 `sources` 可能也未返回 `doc_id`。

**修复指令**

```
【第一步 — 删除 AI 正文中的内联引用标注 [N]】

1. 打开 backend/app/services/rag.py，找到 rag_answer() 中构建 system prompt 的部分。
   删除 prompt 中要求 LLM 在回答里插入 [N] 引用编号的指令，例如：
   - 删除类似 "在回答中用[1][2]等标注引用来源" 的 prompt 文字。
   - 修改后 prompt 指令应为：直接回答，不在正文中插入任何 [数字] 引用编号。

2. 打开 src/views/search/Pc.vue 和 Mobile.vue，找到渲染 AI 回答正文的区块。
   删除将 [N] 替换为上角标或链接的后处理逻辑（如有）。
   确保 AI 回答正文只纯文本渲染，不显示任何 [N] 标注。

【第二步 — 修复折叠面板数据来源，使其绑定本次查询结果】

3. 在 src/views/search/Pc.vue 和 Mobile.vue 中，找到折叠面板绑定的数据变量
   （关键词：el-collapse / van-collapse / refList / references / "引用"）。

4. 将折叠面板统一绑定到 sources 变量（来自本次查询响应），删除 refList / references
   等独立变量及其所有赋值逻辑（包括独立的接口调用）：
   <el-collapse v-if="sources.length" class="references-collapse">
     <el-collapse-item
       v-for="(item, idx) in sources"
       :key="idx"
       :title="`[${idx + 1}] ${item.doc_title}`"
     >
       <p class="ref-snippet">{{ item.snippet }}</p>
       <router-link
         v-if="item.doc_id"
         :to="{ path: '/knowledge/preview', query: { id: item.doc_id } }"
         class="ref-link"
       >查看原文 →</router-link>
     </el-collapse-item>
   </el-collapse>

5. 每次发起新查询时，立即清空 sources，防止旧数据残留：
   sources.value = []
   aiAnswer.value = ''

6. 赋值时机：
   - 若使用 SSE 流式响应：在 useStreamText 流处理函数中，
     监听到 type === 'sources' 事件时写入：sources.value = event.data
   - 若非流式：在 POST /api/chat/query 响应回调中：sources.value = res.data.sources ?? []

【第三步 — 后端确保 sources 包含 doc_id】

7. 打开 backend/app/services/rag.py，rag_answer() 中构建 sources 列表时，
   确保每条包含 doc_id 字段：
   sources = [
     {
       "index": i,
       "doc_id": chunk["doc_id"],        # ← 必须有此字段
       "doc_title": chunk["doc_title"],
       "snippet": chunk["content"][:150]
     }
     for i, chunk in enumerate(chunks, start=1)
   ]

8. 样式：ref-link 使用 AI 青色 #00B7C2，下划线，hover 加深；
   ref-snippet 字号比正文小一号，灰色（#666）。

9. 验证：
   a. AI 回答正文中不出现任何 [1][2] 等编号标注。
   b. 折叠面板展开后显示本次查询命中的文档，内容与问题相关。
   c. 每条引用均有"查看原文 →"链接，点击跳转到 /knowledge/preview?id=xxx。
   d. 发起第二次不同问题的查询，折叠面板内容完全替换，无旧数据残留。

10. npm run typecheck。
```

---

## 第 2 项：知识图谱切换案例/手册筛选时节点不消失，且节点与连线错位

**问题描述**

- 点击"按案例筛选"或"按手册筛选"后，另一类型来源的节点没有从图谱中移除，
  两类节点叠加在一起。
- 部分节点与其连线（边）在初始渲染时位置错位，拖动节点后才能恢复对齐。

**根因分析**

- **节点不消失**：筛选切换时直接修改了 ECharts `series[0].data` 但没有同步更新
  `series[0].links`（edges），旧节点仍被边引用，ECharts 内部不会自动剔除孤立节点；
  或者筛选逻辑只是修改了节点的 `itemStyle.opacity` 而非真正过滤数组，
  导致视觉上可见或部分 z-index 层叠。
- **节点与线错位**：ECharts force graph 在 `setOption` 后若没有调用 `chart.resize()`
  或 layout 尚未稳定就强行调用了 `chart.setOption({animation: false})`，
  初始位置由物理引擎计算，节点坐标未同步到边的锚点，拖动后重新计算才对齐。

**修复指令**

```
1. 打开 src/views/kg/Pc.vue，找到筛选切换逻辑（watch 筛选条件或按钮 click handler）。

2. 每次切换筛选后，重新构建 nodes 和 links 两个数组（不复用旧引用）：

   function applyFilter(sourceType: 'all' | 'case' | 'manual') {
     const filteredNodes = allNodes.filter(n =>
       sourceType === 'all' || n.source_type === sourceType
     )
     const nodeIdSet = new Set(filteredNodes.map(n => n.id))
     const filteredLinks = allLinks.filter(l =>
       nodeIdSet.has(l.source) && nodeIdSet.has(l.target)
     )
     chart.setOption({
       series: [{
         type: 'graph',
         data: filteredNodes,
         links: filteredLinks,
         // 重置布局让物理引擎重新计算
         force: { initLayout: 'circular', repulsion: 300 }
       }]
     }, /* notMerge = */ true)   // ← 第二个参数 true 表示完全替换，不合并旧数据
     // 等待一帧后 resize，解决初始坐标未同步问题
     nextTick(() => chart.resize())
   }

3. 初始化图谱时同样使用 notMerge=true：
   chart.setOption(option, true)

4. 解决节点与线初始错位问题：
   在 onMounted 的 chart.setOption 之后，监听 ECharts 的 'rendered' 事件触发一次 resize：
   chart.on('rendered', () => {
     chart.resize()
     chart.off('rendered')  // 只触发一次
   })

5. 若图谱容器父元素有 CSS transition（宽高动画），确保动画结束后再初始化 ECharts：
   使用 ResizeObserver 监听容器尺寸稳定后再调用 chart.init()，
   或在容器的 transitionend 事件回调中调用 chart.resize()。

6. Mobile 端 src/views/kg/Mobile.vue 若使用卡片流，筛选时重建 filteredNodes 数组即可，无 ECharts 相关问题。

7. npm run typecheck。
```

---

## 第 3 项：管理员/审查员切换到移动端时"上传"按钮提示权限不足

**问题描述**  
以管理员（`admin`）或审查员（`auditor`/`leader`）账号登录后，切换到手机视图，
底部 TabBar 多出的"上传"按钮点击后提示"权限不足"，无法完成知识上传操作。

**根因分析**

- `src/components/mobile/BottomTabBar.vue` 中上传 Tab 项的渲染条件可能只允许 `frontline`，
  或者该 Tab 对 `auditor`/`admin` 显示但路由 `meta.roles` 或上传 API 的角色守卫不含这两个角色。
- README 中明确写明"管理员 / 审查员则在知识库管理页直接入库"，
  但移动端底部 Tab 指向的可能是同一个"待审上传"路由（`/knowledge/upload`），
  该路由的后端接口或前端守卫只给 `frontline`。

**修复指令**

```
1. 打开 src/router/index.ts，找到 /knowledge/upload 路由：
   将 meta.roles 改为 ['frontline', 'auditor', 'admin']。
   （三种角色都可进入上传页；进入后由页面自身根据角色决定是否走审核流程。）

2. 打开 backend/app/api/kb.py，找到 POST /api/kb/upload 和 POST /api/kb/text 的角色守卫：
   a. 若使用了 require_role(['worker']) 或类似限制，改为允许所有已登录用户：
      current_user: User = Depends(get_current_user)  # 不限角色，仅要求登录
   b. 入库流程根据角色决定状态：
      if current_user.role in ('leader', 'admin'):
          doc.status = 'approved'   # 直接入库，无需审核
          doc.reviewed_by = current_user.id
      else:
          doc.status = 'pending'    # 一线员工走审核队列

3. 打开 src/views/knowledge/Upload.vue（Mobile.vue 或 Pc.vue，二者共用同一逻辑）：
   a. 提交成功后的提示文案根据角色区分：
      - frontline：ElMessage.success('经验已提交，等待审查员审核')
      - auditor / admin：ElMessage.success('知识已直接入库')
   b. 不需要在前端额外做角色判断决定是否显示上传入口——
      只要路由权限放行即可，入口对三种角色均可见。

4. 打开 src/components/mobile/BottomTabBar.vue，确认上传 Tab 项的渲染条件：
   - 若有 v-if="role === 'frontline'" 或 isWorkerRole(role)，改为 v-if="true"（始终显示）
     或去掉该条件（所有已登录用户均可见上传入口）。

5. npm run typecheck。
```

---

## 第 4 项：删除左下角"AI 引擎在线"状态卡片

**问题描述**  
PC 端左下角（或 Mobile 端某位置）有一个"AI 引擎在线"的状态卡片 / 浮层，
需要完全移除，不保留任何占位元素。

**定位**  
通常实现为 `src/components/pc/SideNav.vue` 底部固定区域，
或 `src/layouts/PCLayout.vue` 中单独的 status badge 组件，
也可能是 `src/components/common/AiStatusBadge.vue`（或类似命名）。

**修复指令**

```
1. 全局搜索关键词定位组件：
   搜索 "AI 引擎" 或 "ai-status" 或 "engine" 或 "online" 或 "AiStatus"
   于 src/ 目录下（grep -r "AI 引擎\|ai.status\|AiStatus\|engine.*online" src/）

2. 找到渲染该卡片的模板代码后，直接删除对应的 <template> 块（含外层容器 div）。
   不要仅添加 v-if="false" 或 display:none，需彻底移除 DOM 结构。

3. 若该卡片是独立组件文件（如 AiStatusBadge.vue / AiEngineStatus.vue）：
   a. 删除组件文件。
   b. 在所有 import 该组件的文件中删除 import 语句和 <AiStatusBadge /> 使用处。

4. 若底层有定时轮询 AI 健康检查的 composable（如 useAiHealth.ts）或 setInterval，
   同步删除，避免残留后台请求。

5. npm run typecheck，确认无悬空 import 或未使用变量警告。
```

---

## 执行顺序建议

| 优先级     | 项目    | 原因                                                     |
| ---------- | ------- | -------------------------------------------------------- |
| P1（尽快） | 第 1 项 | 引用错乱导致用户对 AI 回答失去信任，核心功能体验严重受损 |
| P1（尽快） | 第 3 项 | 管理员 / 审查员无法在移动端上传知识，基础权限缺失        |
| P2         | 第 2 项 | 图谱筛选错误 + 渲染错位，功能可用但结果不可信            |
| P3         | 第 4 项 | UI 清洁，不影响功能                                      |

---

> 每项修复完成后执行 `npm run typecheck` 确认 0 错误。  
> 后端变更需重启 `uvicorn app.main:app --reload`。

# 设备检修知识检索与作业系统 - 问题修复指南

> 基于Claude工具生成的网页系统检测报告
> 
> 生成时间：2026年6月16日

## 问题概览

| 序号 | 问题类型 | 严重程度 | 影响范围 |
|------|----------|----------|----------|
| 1 | 权限控制缺失 | 高 | 移动端/PC端 |
| 2 | 演示账户不足 | 中 | 登录系统 |
| 3 | 知识图谱简陋 | 中 | 知识图谱页面 |
| 4 | 导航逻辑缺陷 | 高 | 作业指引模块 |
| 5 | 功能按钮不完整 | 中 | PC端/移动端 |
| 6 | 移动端布局问题 | 高 | 移动端工作台 |

---

## 问题1：移动端与PC端功能不同步（权限控制问题）

### 问题描述
切换到手机比例后，移动端多了"案例审核"和"系统管理"按钮，但PC端没有显示这些按钮。这应该是根据权限分发的，而不是全部展示。

### 根本原因
权限控制逻辑未统一，移动端和PC端使用了不同的渲染逻辑。

### 修复方案

**修改文件：**
- `src/components/mobile/MobileSideDrawer.vue` 或 `src/components/mobile/BottomTabBar.vue`
- `src/components/pc/PCSideBar.vue` 或 `src/components/pc/TopBar.vue`
- 新建 `src/utils/permission.ts`（统一权限判断）

**修复提示词：**
```
在移动端和PC端布局中，菜单需要根据用户角色动态渲染。
当前移动端显示了"案例审核"和"系统管理"按钮，但PC端没有，这说明权限控制逻辑不统一。

请修复以下内容：
1. 创建 `src/utils/permission.ts` 统一权限判断逻辑
   - 导出函数 `hasPermission(role: string, requiredRoles: string[]): boolean`
   - 导出函数 `getVisibleMenuItems(userRole: string): MenuItem[]`

2. 修改 `src/stores/user.ts`
   - 确保用户信息包含 `role` 字段（'worker' | 'auditor' | 'admin' | 'guest'）
   - 提供 `get currentRole()` getter

3. 修改移动端组件 `src/components/mobile/BottomTabBar.vue`：
   - 从 Pinia store 获取当前用户角色
   - 根据角色过滤显示的菜单项：
     - 一线检修员(worker)：工作台、检索、作业指引、提交案例、历史、个人中心
     - 审核员(auditor)：额外显示"案例审核"
     - 管理员(admin)：额外显示"系统管理"
   - 使用 `v-if` 或计算属性控制显示

4. 修改PC端组件 `src/components/pc/SideNav.vue`：
   - 应用相同的权限逻辑
   - 确保移动端和PC端的权限控制完全一致

5. 更新路由守卫 `src/router/index.ts`：
   - 在路由跳转前检查权限
   - 无权限时弹 toast 并跳转回 `/dashboard`
```

**验证方法：**
- 以不同角色登录，检查移动端和PC端菜单项是否一致
- 尝试直接访问 `/audit` 和 `/admin`，验证路由守卫是否生效

---

## 问题2：缺少管理员权限的演示账户

### 问题描述
当前登录逻辑使用Mock数据，任意用户名密码都能登录，但无法区分角色，导致无法演示管理员和审核员的权限功能。

### 修复方案

**修改文件：**
- `src/views/login/index.vue`
- `src/api/auth.ts`
- `src/stores/user.ts`

**修复提示词：**
```
当前登录逻辑使用 Mock 数据，任意用户名密码都能登录，但无法区分角色。
请修改登录系统，增加角色选择或预设账户功能：

方案A（推荐）：在登录页增加角色选择器
1. 修改 `src/views/login/index.vue`：
   - 在登录表单中增加"演示角色"下拉框
   - 选项：一线检修员、审核员、管理员、访客
   - 使用 Element Plus 的 `<el-select>` 组件
   - 添加提示文字："请选择演示角色（Mock模式）"

2. 修改 `src/api/auth.ts` 的 Mock 登录逻辑：
   ```typescript
   // Mock 登录响应
   const mockUsers = {
     worker: { role: 'worker', name: '检修员演示', ... },
     auditor: { role: 'auditor', name: '审核员演示', ... },
     admin: { role: 'admin', name: '管理员演示', ... },
     guest: { role: 'guest', name: '访客演示', ... }
   }
   ```

3. 修改 `src/stores/user.ts`：
   - 正确存储用户角色信息
   - 提供 `isAdmin`、`isAuditor`、`isWorker` 等便捷 getter

4. 在登录页底部添加演示账户说明：
   ```
   演示模式：选择角色后，输入任意用户名和密码即可登录
   ```

方案B：预设演示账户（备选）
- admin / admin123 → 管理员
- auditor / audit123 → 审核员  
- worker / work123 → 一线检修员
- guest / guest123 → 访客

选择方案A并修改相应文件。
```

**验证方法：**
- 选择不同角色登录，检查菜单项是否正确显示
- 验证权限相关的路由守卫是否正常工作

---

## 问题3：知识图谱部分过于简易，需要优化

### 问题描述
知识图谱功能较为简陋，可视化效果差，交互性不足，无法满足演示和评审要求。

### 修复方案

**修改文件：**
- `src/views/kg/Pc.vue`
- `src/views/kg/Mobile.vue`
- `src/api/kg.ts`（Mock数据）
- `src/components/common/`（可能的共用组件）

**修复提示词：**
```
当前知识图谱（`/src/views/kg/`）使用简单的 SVG 力图，功能较差。
请增强知识图谱的可视化和交互效果：

1. **Mock 数据增强** - 修改 `src/api/kg.ts`：
   ```typescript
   // 创建丰富的知识图谱数据
   const mockGraphData = {
     nodes: [
       { id: 'dev1', label: '主轴电机', type: 'device', properties: { status: '运行中', ... } },
       { id: 'fault1', label: '轴承过热', type: 'fault', properties: { severity: '高', ... } },
       { id: 'case1', label: '20240610-001', type: 'case', properties: { result: '已解决', ... } },
       // ... 更多节点
     ],
     edges: [
       { source: 'dev1', target: 'fault1', relation: '可能发生', weight: 0.8 },
       { source: 'fault1', target: 'case1', relation: '已有案例', weight: 0.9 },
       // ... 更多关系
     ]
   }
   ```

2. **PC端可视化增强** - 修改 `src/views/kg/Pc.vue`：
   - 使用 ECharts 5 的 `graph` 图表类型替换 SVG
   - 配置项：
     ```typescript
     const option = {
       series: [{
         type: 'graph',
         layout: 'force',
         data: formattedNodes,  // 节点
         edges: formattedEdges,  // 边
         categories: [            // 节点分类（决定颜色）
           { name: '设备', itemStyle: { color: '#0B2545' } },
           { name: '故障', itemStyle: { color: '#F26B1F' } },
           { name: '案例', itemStyle: { color: '#00B7C2' } },
           { name: '手册', itemStyle: { color: '#2E7D32' } }
         ],
         roam: true,  // 允许缩放和拖拽
         force: {
           repulsion: 200,  // 节点斥力
           edgeLength: 100   // 边长度
         },
         label: { show: true, position: 'right' },
         tooltip: {
           formatter: (params) => {
             // 显示节点详细信息
           }
         }
       }]
     }
     ```
   - 不同节点类型使用不同图标（使用 ECharts symbol）
   - 增加图例说明（legend）
   - 增加搜索框，支持节点名称搜索和定位

3. **移动端优化** - 修改 `src/views/kg/Mobile.vue`：
   - 当前是"实体卡片流"，改为可展开的卡片列表
   - 使用 Vant 的 `<van-collapse>` 组件
   - 每个卡片显示：实体名称、类型、关联关系数量
   - 点击卡片展开，显示关联的实体列表
   - 支持简单的筛选（使用 `<van-dropdown-menu>`）

4. **交互功能增强**：
   - 点击节点：显示悬浮卡片，展示详细信息（使用 ECharts tooltip）
   - 双击节点：高亮与之关联的节点和边（修改节点样式）
   - 增加"重置视图"按钮：恢复初始缩放和位置
   - 增加"导出图片"按钮：导出当前图谱为PNG

5. **性能优化**：
   - 节点过多时使用懒加载
   - 使用 `echarts.getInstanceByDom()` 避免重复初始化

请按照以上方案修改代码，并确保PC端和移动端都有良好的用户体验。
```

**验证方法：**
- PC端：检查知识图谱是否使用ECharts渲染，交互是否正常
- 移动端：检查卡片列表是否可展开，筛选功能是否可用
- 检查Mock数据是否丰富，包含多种类型的节点和关系

---

## 问题4：作业指引缺少退出和选择作业选项

### 问题描述
演示部分的作业指引直接显示一个作业，没有退出机制和选择其他作业的选项，用户体验差。

### 修复方案

**修改文件：**
- `src/views/workflow/index.vue`
- `src/views/workflow/WorkList.vue`（新建）
- `src/views/workflow/Pc.vue`
- `src/views/workflow/Mobile.vue`
- `src/router/index.ts`
- `src/api/workflow.ts`（Mock数据）

**修复提示词：**
```
当前 `/workflow` 页面直接进入某个作业指引，缺少作业列表和退出机制。
请修改作业指引模块，增加作业列表和导航功能：

1. **创建作业列表页** - 新建 `src/views/workflow/WorkList.vue`：
   - PC端布局：
     - 使用 Element Plus 的 `<el-card>` 或 `<el-table>` 显示作业列表
     - 每个作业卡片包含：作业名称、设备类型、难度、预计时长、状态
     - 支持按状态筛选（未开始/进行中/已完成）
     - 点击作业卡片进入作业指引
   
   - 移动端布局：
     - 使用 Vant 的 `<van-card>` 或 `<van-list>` 显示作业列表
     - 卡片样式适配移动端
     - 支持下拉刷新和上拉加载

2. **修改路由配置** - 更新 `src/router/index.ts`：
   ```typescript
   {
     path: '/workflow',
     name: 'WorkflowList',
     component: () => import('@/views/workflow/index.vue'),
     meta: { title: '作业指引', requiresAuth: true }
   },
   {
     path: '/workflow/:id',
     name: 'WorkflowDetail',
     component: () => import('@/views/workflow/detail.vue'),
     meta: { title: '作业指引详情', requiresAuth: true }
   }
   ```

3. **修改 `src/views/workflow/index.vue`**：
   - 根据设备类型加载对应的列表视图
   - PC端：`<WorkflowListPc />`
   - 移动端：`<WorkflowListMobile />`

4. **在作业指引详情页增加导航** - 修改 `src/views/workflow/Pc.vue` 和 `Mobile.vue`：
   - PC端：
     - 顶部增加面包屑导航：`<el-breadcrumb>`，显示"作业列表 > 当前作业名"
     - 左上角增加"返回"按钮，点击返回作业列表
     - 增加"退出作业"按钮（可选，与返回按钮功能相同）
   
   - 移动端：
     - 顶部 AppBar 显示返回按钮 "< 作业列表"
     - 显示当前作业名称
     - 增加"更多"菜单（可选），包含"退出作业"选项

5. **Mock 数据增强** - 修改 `src/api/workflow.ts`：
   ```typescript
   const mockWorkList = [
     { id: '1', name: '主轴电机更换作业', deviceType: 'CNC-3000', difficulty: '中级', estimatedTime: 45, status: '未开始' },
     { id: '2', name: '液压系统检修', deviceType: 'PRESS-500', difficulty: '高级', estimatedTime: 90, status: '进行中' },
     // ... 3-5个示例作业
   ]
   ```

6. **修改 `src/views/workflow/detail.vue`**（或合并到 Pc.vue/Mobile.vue）：
   - 从路由参数获取作业ID：`const workId = route.params.id`
   - 根据ID加载对应的作业指引数据
   - 确保返回按钮正确导航到 `/workflow`

请按照以上方案修改代码，确保用户可以先选择作业，然后在作业指引中能够方便退出。
```

**验证方法：**
- 访问 `/workflow`，检查是否显示作业列表
- 点击某个作业，检查是否正确进入作业指引
- 在作业指引页面，检查返回按钮是否正常工作
- 检查面包屑导航是否正确显示

---

## 问题5：字号调节按钮不完整，需要统一安排

### 问题描述
PC端有个增加字号的按钮，但是没有减小字号的按钮，且调节按钮位置不合理，需要统一安排这些调节功能。

### 修复方案

**修改文件：**
- `src/components/pc/TopBar.vue`
- `src/composables/useTheme.ts`
- `src/assets/styles/tokens.css`
- `src/components/mobile/MobileSideDrawer.vue`（移动端适配）

**修复提示词：**
```
当前PC端只有"增加字号"按钮，缺少"减小字号"按钮，且调节按钮位置不合理。
请修改字号调节功能，并统一安排显示设置相关的控制项：

1. **增强 `useTheme.ts` 功能** - 修改 `src/composables/useTheme.ts`：
   ```typescript
   // 字号档位定义
   const fontSizeLevels = [
     { key: 'sm', label: '小', size: '14px' },
     { key: 'base', label: '标准', size: '16px' },
     { key: 'lg', label: '大', size: '18px' },
     { key: 'xl', label: '特大', size: '20px' }
   ]
   
   // 当前字号索引
   const currentFontSizeIndex = ref(1)  // 默认 base
   
   // 增加字号
   function increaseFontSize() {
     if (currentFontSizeIndex.value < fontSizeLevels.length - 1) {
       currentFontSizeIndex.value++
       applyFontSize()
     }
   }
   
   // 减小字号
   function decreaseFontSize() {
     if (currentFontSizeIndex.value > 0) {
       currentFontSizeIndex.value--
       applyFontSize()
     }
   }
   
   // 重置字号
   function resetFontSize() {
     currentFontSizeIndex.value = 1
     applyFontSize()
   }
   
   // 应用字号
   function applyFontSize() {
     const level = fontSizeLevels[currentFontSizeIndex.value]
     document.documentElement.style.setProperty('--font-size-base', level.size)
     localStorage.setItem('font-size-level', currentFontSizeIndex.value.toString())
   }
   
   // 初始化时从 localStorage 读取
   onMounted(() => {
     const saved = localStorage.getItem('font-size-level')
     if (saved) {
       currentFontSizeIndex.value = parseInt(saved)
       applyFontSize()
     }
   })
   
   return {
     currentFontSize: computed(() => fontSizeLevels[currentFontSizeIndex.value]),
     increaseFontSize,
     decreaseFontSize,
     resetFontSize
   }
   ```

2. **创建统一的显示设置面板**：
   - 方案A（推荐）：修改 `src/components/pc/TopBar.vue`
     - 在顶栏右侧增加"显示设置"下拉菜单（使用 Element Plus 的 `<el-dropdown>`）
     - 下拉菜单包含：
       - 暗色模式开关（`<el-switch>`）
       - 高对比度开关
       - 分隔线
       - 字号调节：`<` 减小 | 重置 | 增大 `>`  （或显示为 A- / A / A+）
       - 当前字号档位显示
       - 分隔线
       - 手套模式开关
   
   - 方案B：创建独立的设置面板
     - 新建 `src/components/common/SettingsPanel.vue`
     - 点击顶栏的设置图标时显示侧边抽屉或对话框
     - 面板中包含上述所有设置项

3. **修改 `src/assets/styles/tokens.css`**：
   ```css
   :root {
     --font-size-base: 16px;
     --font-size-sm: 14px;
     --font-size-lg: 18px;
     --font-size-xl: 20px;
   }
   
   /* 字号应用 */
   body {
     font-size: var(--font-size-base);
   }
   
   .text-sm { font-size: var(--font-size-sm); }
   .text-lg { font-size: var(--font-size-lg); }
   .text-xl { font-size: var(--font-size-xl); }
   ```

4. **移动端适配** - 修改 `src/components/mobile/MobileSideDrawer.vue`：
   - 在侧边栏底部增加"显示设置"区域
   - 使用 Vant 的 `<van-cell>` 和 `<van-switch>` 等组件
   - 包含：暗色模式、高对比度、字号调节、手套模式
   - 确保设置能跨端同步（使用 localStorage）

5. **删除原有的单独按钮**：
   - 如果之前有单独的字号增大按钮，删除它
   - 确保所有显示设置都通过新的统一面板访问

请按照方案A修改代码，确保用户能够方便地调节字号和其他显示设置。
```

**验证方法：**
- PC端：点击顶栏的"显示设置"下拉菜单，检查所有设置项是否可用
- 测试字号调节：减小、增大、重置，检查页面文字是否相应变化
- 移动端：打开侧边栏，检查设置项是否可用
- 刷新页面，检查设置是否持久化（localStorage）

---

## 问题6：移动端工作台界面的"指引、审核、通知"三个模块横向排列显示不全

### 问题描述
移动端工作台界面的"指引、审核、通知"三个模块是横向排列的，在小屏幕设备上显示不全，影响用户体验。

### 修复方案

**修改文件：**
- `src/views/dashboard/Mobile.vue`
- 可能涉及的组件：`src/components/mobile/` 下的相关组件

**修复提示词：**
```
移动端工作台（`/dashboard` 移动端）的"指引、审核、通知"三个模块横向排列导致显示不全。
请修改移动端工作台的布局，改为更合适的显示方式：

方案A（推荐）：垂直滚动布局
1. 修改 `src/views/dashboard/Mobile.vue`：
   - 三个模块改为上下排列（垂直布局）
   - 使用 `<van-cell-group>` 或自定义卡片样式
   - 每个模块占据独立的卡片区域，包含：
     - 模块标题（如"作业指引"）
     - 简要统计信息（如"进行中 2 个"）
     - 可折叠/展开的内容区域（使用 `<van-collapse>`）
   
   - 示例结构：
     ```vue
     <template>
       <div class="dashboard-mobile">
         <!-- 指引模块 -->
         <van-collapse v-model="activeModules" accordion>
           <van-collapse-item title="作业指引" name="guide">
             <div class="module-content">
               <!-- 指引内容 -->
             </div>
           </van-collapse-item>
           
           <van-collapse-item title="案例审核" name="audit">
             <div class="module-content">
               <!-- 审核内容 -->
             </div>
           </van-collapse-item>
           
           <van-collapse-item title="通知公告" name="notification">
             <div class="module-content">
               <!-- 通知内容 -->
             </div>
           </van-collapse-item>
         </van-collapse>
       </div>
     </template>
     ```
   
   - 默认展开第一个模块，其他模块可手动展开
   - 支持滚动查看所有模块

2. 样式调整：
   ```css
   .dashboard-mobile {
     padding: 16px;
     padding-bottom: 60px;  /* 为底部TabBar留空间 */
   }
   
   .module-content {
     padding: 12px;
     background: #fff;
     border-radius: 8px;
   }
   ```

方案B：使用横向滑动 Tab
1. 修改 `src/views/dashboard/Mobile.vue`：
   - 顶部增加 Tab 栏：`<van-tabs>`
   - Tab 选项："指引 | 审核 | 通知"
   - 滑动或点击切换显示对应模块内容
   - 当前选中状态高亮显示（使用 Vant 主题色）
   
   - 示例结构：
     ```vue
     <template>
       <div class="dashboard-mobile">
         <van-tabs v-model:active="activeTab" swipeable>
           <van-tab title="作业指引" name="guide">
             <div class="tab-content">
               <!-- 指引内容 -->
             </div>
           </van-tab>
           <van-tab title="案例审核" name="audit">
             <div class="tab-content">
               <!-- 审核内容 -->
             </div>
           </van-tab>
           <van-tab title="通知公告" name="notification">
             <div class="tab-content">
               <!-- 通知内容 -->
             </div>
           </van-tab>
         </van-tabs>
       </div>
     </template>
     ```

方案C：使用卡片式布局
1. 修改 `src/views/dashboard/Mobile.vue`：
   - 三个模块显示为卡片列表（`<van-card>`）
   - 每个卡片显示模块名称和简要信息
   - 点击卡片进入对应模块的详情页（路由跳转）

请选择方案A（垂直折叠布局）并修改 `src/views/dashboard/Mobile.vue`，确保移动端用户体验良好。
```

**验证方法：**
- 在移动端视图（393px宽度）查看工作台页面
- 检查三个模块是否都能完整显示
- 测试折叠/展开功能（方案A）或 Tab 切换功能（方案B）
- 检查滚动是否流畅

---

## 综合修复提示词

如果需要一次性修复所有问题，可以使用以下综合提示词（适合直接提供给AI工具）：

```
请修复设备检修知识检索与作业系统的以下6个问题：

【问题1 - 权限控制】
移动端底部TabBar/侧边栏需要根据用户角色动态显示菜单项，
确保与PC端权限逻辑一致，使用统一的权限判断函数。
- 创建 `src/utils/permission.ts` 统一权限逻辑
- 修改移动端和PC端的菜单组件，根据角色过滤菜单项
- 一线检修员、审核员、管理员看到的菜单不同

【问题2 - 演示账户】
登录页增加角色选择器，使评审人员可以体验不同角色的权限和功能。
- 在登录表单增加"演示角色"下拉框
- 修改 Mock 登录逻辑，根据选择的角色返回对应用户信息
- 更新用户 store，正确存储角色信息

【问题3 - 知识图谱】
使用 ECharts 5 增强知识图谱可视化，增加节点类型、颜色区分、交互功能。
- PC端：使用 ECharts graph 图表，支持缩放、拖拽、点击详情
- 移动端：改为可展开的卡片列表，支持筛选
- 增强 Mock 数据，包含多种类型的节点和关系
- 增加搜索、高亮、重置视图等功能

【问题4 - 作业指引】
增加作业列表页作为默认视图，在作业指引页面增加返回按钮和面包屑导航。
- 创建 `src/views/workflow/WorkList.vue`
- 修改路由配置：`/workflow` 显示列表，`/workflow/:id` 显示详情
- 在作业指引页面增加返回按钮和面包屑导航
- 增加丰富的 Mock 作业数据

【问题5 - 字号调节】
补全字号调节功能（增加减小按钮），在顶栏或设置面板统一安排显示调节、暗色模式等设置项。
- 增强 `useTheme.ts`，增加 decreaseFontSize 和 resetFontSize
- 在PC端顶栏增加"显示设置"下拉菜单
- 包含：暗色模式、高对比度、字号调节、手套模式
- 移动端在侧边栏增加相同的设置项
- 使用 localStorage 持久化设置

【问题6 - 移动端布局】
修复工作台页面模块横向排列显示不全的问题，改为垂直折叠布局或Tab切换布局。
- 修改 `src/views/dashboard/Mobile.vue`
- 三个模块改为垂直排列，使用 `<van-collapse>` 实现可折叠卡片
- 或改为 `<van-tabs>` 实现横向滑动Tab
- 确保小屏幕设备上所有内容都能完整显示

请逐个修复并验证每个功能，确保PC端和移动端体验一致且完整。
修改后请提供修改的文件列表和简要说明。
```

---

## 修复优先级建议

| 优先级 | 问题编号 | 理由 |
|--------|----------|------|
| P0 | 问题1、问题4 | 影响核心功能和用户体验，属于功能性缺陷 |
| P1 | 问题6 | 影响移动端可用性，属于UI/UX问题 |
| P2 | 问题2、问题3、问题5 | 影响演示效果和完整性，属于增强型需求 |

**建议修复顺序：**
1. 问题1（权限控制）- 基础功能
2. 问题4（作业指引导航）- 核心流程
3. 问题6（移动端布局）- 移动端可用性
4. 问题2（演示账户）- 演示准备
5. 问题3（知识图谱）- 功能增强
6. 问题5（字号调节）- 体验优化

---

## 附录：相关文件清单

### 需要修改的文件
- `src/views/login/index.vue` - 问题2
- `src/api/auth.ts` - 问题2
- `src/stores/user.ts` - 问题1、问题2
- `src/utils/permission.ts` - 问题1（新建）
- `src/components/mobile/BottomTabBar.vue` - 问题1
- `src/components/mobile/MobileSideDrawer.vue` - 问题1、问题5
- `src/components/pc/SideNav.vue` - 问题1
- `src/components/pc/TopBar.vue` - 问题5
- `src/views/kg/Pc.vue` - 问题3
- `src/views/kg/Mobile.vue` - 问题3
- `src/api/kg.ts` - 问题3
- `src/views/workflow/index.vue` - 问题4
- `src/views/workflow/WorkList.vue` - 问题4（新建）
- `src/views/workflow/Pc.vue` - 问题4
- `src/views/workflow/Mobile.vue` - 问题4
- `src/router/index.ts` - 问题4
- `src/api/workflow.ts` - 问题4
- `src/views/dashboard/Mobile.vue` - 问题6
- `src/composables/useTheme.ts` - 问题5
- `src/assets/styles/tokens.css` - 问题5

### 可能需要创建的共用组件
- `src/components/common/SettingsPanel.vue` - 显示设置面板（问题5）
- `src/components/common/KnowledgeGraph.vue` - 知识图谱组件（问题3，可选）

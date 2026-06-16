# 迭代修复工作总结文档
## 一、整体说明
本次迭代严格依据 `NEEDS/FIX1.md` 需求清单完成共计6项核心问题修复，项目静态类型校验 `npm run typecheck` 与打包构建 `npm run build` 执行全部通过，无编译、类型报错。
本次改动覆盖权限体系、登录角色、知识图谱可视化、作业流程模块、全局主题字号、移动端工作台布局六大模块，同步配套完成多端菜单、角色权限、全局工具类一致性优化，统一PC端与移动端交互逻辑、数据来源与配置入口。

## 二、六项核心修复明细
### 1. 统一权限控制体系
#### 修复目标
全站PC侧边菜单、移动端底部导航、移动端侧边抽屉三套菜单实现同源权限渲染，基于统一菜单数据源+当前用户角色过滤可见菜单。
#### 改动文件
1. `src/utils/permission.ts`：新增核心常量与工具方法
    - 常量：`MENU_ITEMS`、`DEMO_ACCOUNTS`
    - 工具函数：`hasPermission`、`getVisibleMenuItems`
2. `src/stores/user.ts`：新增角色判断标识 `isAdmin`、`isAuditor`、`isWorker`
3. 页面组件：
    - PC菜单：`src/components/pc/SideNav.vue`
    - 移动端导航：`src/components/mobile/BottomTabBar.vue`、`src/components/mobile/MobileSideDrawer.vue`
#### 实现逻辑
三套菜单不再维护独立数据源，统一读取 `MENU_ITEMS` 基础菜单配置，结合当前登录角色通过权限工具过滤生成页面可见菜单，保证多端菜单权限表现完全一致。

### 2. 登录页角色选择器功能
#### 修复目标
登录页面支持手动选择角色登录，接口根据账号+所选角色返回对应模拟用户数据。
#### 改动文件
1. 登录页面：`src/views/login/Pc.vue`、`src/views/login/Mobile.vue`
    - 新增角色下拉选择框，可选角色：一线人员frontline、审核员auditor、管理员admin、访客guest
2. 接口层：`src/api/auth.ts`
    - 改造登录mock逻辑，接收角色参数，按用户名+选中角色匹配返回对应用户信息

### 3. ECharts 知识图谱可视化改造
#### 修复目标
PC端使用ECharts Graph力导向图实现图谱交互，移动端适配窄屏改为卡片列表模式，统一节点数据结构与筛选能力。
#### 改动文件
1. 接口：`src/api/kg.ts`
    - 节点数据扩容至6大类、共22个节点，新增`desc`描述、`status`状态、`manualRef`参考文档字段
2. PC图谱页面：`src/views/kg/Pc.vue`
    - 替换渲染方案为ECharts graph力导向布局
    - 配套能力：画布漫游、悬浮提示Tooltip、PNG导出、画布重置、节点类型筛选、关键字搜索
3. 移动端图谱页面：`src/views/kg/Mobile.vue`
    - 移除大图，改为可折叠卡片列表
    - 支持按节点类型筛选，点击卡片展开展示一级关联邻居节点

### 4. 作业指引列表与完整导航链路搭建
#### 修复目标
新建作业流程模块，完善列表、详情页面，配套路由、面包屑、返回、未保存确认等导航交互。
#### 改动文件
1. 接口：`src/api/workflow.ts`，新增`listFlows`接口，预置6套作业数据
2. 页面组件：
    - 作业列表 `src/views/workflow/WorkList.vue`：PC卡片网格布局、移动端列表布局，支持状态筛选、关键词搜索
    - 作业详情分发页 `src/views/workflow/Detail.vue`（新建）
    - PC详情页 `src/views/workflow/Pc.vue`：增加面包屑导航、返回列表按钮、退出作业弹窗（未完成数据二次确认）
    - 移动端详情页 `src/views/workflow/Mobile.vue`：顶部返回按钮、右上角更多操作菜单
3. 路由配置 `src/router/index.ts`
    - 新增路由规则：`/workflow` 指向作业列表，`/workflow/:id` 指向作业详情

### 5. 全局字号调节与统一显示设置
#### 修复目标
全局统一字体大小切换能力，PC/移动端共用一套显示配置入口，通过CSS变量控制全局样式。
#### 改动文件
1. 组合式工具 `src/composables/useTheme.ts`
    - 提供字号增减、重置方法，支持4档字号：sm / base / lg / xl
2. PC顶部栏 `src/components/pc/TopBar.vue`
    - 统一设置入口（齿轮图标下拉面板），包含字号减小/重置/增大、深色模式、高对比度、手套模式，已启用配置带勾选标记
3. 移动端侧边抽屉 `src/components/mobile/MobileSideDrawer.vue`
    - 同步复刻全套显示配置，与PC端状态互通
4. 全局样式 `src/assets/styles/tokens.css`
    - 新增 `data-fontsize="sm/base/lg/xl"` 属性选择器，绑定字号样式变量

### 6. 移动端工作台垂直布局重构
#### 修复目标
移动端首页工作台模块重构为可折叠分区，按角色控制模块可见，顶部欢迎区展示业务计数。
#### 改动文件
`src/views/dashboard/Mobile.vue`
- 页面拆分为「作业指引」「审核」「通知」三块独立可折叠卡片
- 默认仅展开「作业指引」板块，「审核」板块仅管理员、审核员可见
- 顶部欢迎条同步展示指引、审核、通知三类数据统计数量

## 三、全局配套一致性优化
为保证多端逻辑统一，同步完成通用底层改造：
1. 用户状态库 `user store`：登录方法新增 `roleHint` 角色标识入参，支持角色预传入
2. 权限工具类统一导出：`permission utils` 集中对外暴露 `ROLE_LABEL`、`DEMO_ACCOUNTS`，避免重复定义
3. 移动端底部Tab栏权限裁剪：根据当前角色自动过滤导航项，最大展示5个入口
    - 管理员：可见「系统」菜单
    - 审核员：可见「审核」菜单
    - 一线人员：可见「指引」菜单

## 四、验收结果
1. 全部6项修复需求开发完成，覆盖接口、工具类、路由、PC/移动端页面、全局样式；
2. 静态类型校验 `npm run typecheck` 无类型错误；
3. 项目打包 `npm run build` 构建成功，产物可正常部署；
4. PC端、移动端权限、交互、配置、数据渲染逻辑保持统一，角色差异化展示逻辑符合预期。
# 设备检修知识检索与作业系统

> 基于多模态大模型技术的设备检修知识检索与作业系统 · 前端
> **信创认证 · LoongArch + 银河麒麟高级服务器操作系统 V11**

面向钢铁、汽车制造等行业产线设备检修现场,服务一线检修员、知识审核员、系统管理员、访客四类角色,覆盖 **PC 工业大屏 (1920×1080 / 2K)** 与 **车间手机/平板移动端** 两套形态。

---

## 技术栈

| 维度       | 选型                                            |
| ---------- | ----------------------------------------------- |
| 框架       | Vue 3 + `<script setup>` + TypeScript           |
| 构建       | Vite 5                                          |
| PC UI 库   | Element Plus 2                                  |
| 移动 UI 库 | Vant 4                                          |
| 样式       | Tailwind CSS 3 + CSS Variables 设计令牌         |
| 路由       | Vue Router 4(Hash 模式)                         |
| 状态       | Pinia 2                                         |
| HTTP       | Axios + 类型化封装                              |
| 图表       | ECharts 5                                       |
| 图标       | lucide-vue-next + 自带 SVG                      |
| 字体       | Inter / 思源黑体 / JetBrains Mono(等宽设备型号) |

---

## 快速开始

```bash
npm install                # 安装依赖
npm run dev                # 启动开发服务器 → http://localhost:5173
npm run build              # 类型检查 + 生产构建,产物在 dist/
npm run preview            # 预览生产包
npm run typecheck          # 仅类型检查
```

> 演示账号:任意用户名 + 任意密码即可登录(后端未对接,前端使用 Mock 数据兜底)。

---

## 目录结构

```
software2026/
├── index.html                  # 入口 + 启动屏 + 信创 meta
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── package.json
├── public/
│   └── favicon.svg
└── src/
    ├── main.ts                 # 入口:全局注册 ElementPlus / Vant / Pinia / Router
    ├── App.vue                 # 根组件:按 useDevice() 切换 PC/Mobile 布局
    ├── env.d.ts
    ├── api/                    # API 层:axios 实例 + 7 个域 + 类型化方法 + 演示态兜底
    │   ├── request.ts
    │   ├── auth.ts / search.ts / workflow.ts
    │   ├── knowledge.ts / audit.ts / kg.ts / admin.ts
    ├── assets/styles/
    │   ├── tokens.css          # Design Tokens(CSS Vars,含 dark / contrast / glove)
    │   ├── globals.css         # 全局样式 + Element/Vant 主题覆盖
    │   ├── industrial.css      # 工业感装饰 SVG 背景与纹理
    │   └── tailwind.css
    ├── components/
    │   ├── common/             # 跨端通用:SimilarityBar / StatusTag /
    │   │                       #   ConfidenceMeter / EmptyState / AIAssistant
    │   ├── pc/                 # PC 专用:TopBar / SideNav / CommandPalette(⌘K)
    │   └── mobile/             # Mobile 专用:MobileAppBar / BottomTabBar /
    │                           #   MobileSideDrawer / MobileInputBar /
    │                           #   MobileWorkflowStep / SwipeableCard / VoiceInputButton
    ├── composables/
    │   ├── useDevice.ts        # 媒体查询 → 'pc' | 'tablet' | 'mobile'
    │   ├── useTheme.ts         # 暗色 / 高对比度 / 字号 / 手套模式
    │   ├── useShortcut.ts      # ⌘K / Esc 等快捷键
    │   └── useStreamText.ts    # AI 打字机流式输出
    ├── layouts/
    │   ├── PCLayout.vue        # 顶栏 56 + 侧栏 220 + 工作区 + 底部信创条
    │   └── MobileLayout.vue    # AppBar 48 + 内容 + BottomTabBar 56 + 安全区
    ├── router/index.ts         # 单一路由表 + 角色守卫 + 移动端只读提示
    ├── stores/                 # Pinia: user / search / workflow / ui
    ├── utils/                  # storage / permission / format
    └── views/                  # 11 个业务模块,每个含 Pc.vue + Mobile.vue + index.vue
        ├── login/
        ├── dashboard/
        ├── search/        (含 Detail.vue 详情页)
        ├── workflow/
        ├── knowledge/Upload.vue
        ├── audit/
        ├── kg/
        ├── history/
        ├── profile/
        └── admin/
```

---

## 路由与页面

| 路由                | 名称              | PC             | Mobile         | 角色   |
| ------------------- | ----------------- | -------------- | -------------- | ------ |
| `/login`            | 登录              | ✅ 高保真      | ✅ 高保真      | 全部   |
| `/dashboard`        | 主控台/工作台     | ✅ 高保真      | ✅ 高保真      | 全部   |
| `/search`           | 多模态检索 ⭐     | ✅ 高保真      | ✅ 高保真      | 全部   |
| `/search/:id`       | 检索详情          | ✅             | ✅ 全屏页      | 全部   |
| `/workflow`         | 标准化作业指引 ⭐ | ✅ 高保真      | ✅ 高保真      | 一线   |
| `/knowledge/upload` | 案例提交          | ✅ 多步表单    | ✅ 多步表单    | 一线   |
| `/audit`            | 案例审核          | ✅ 表格 + 详情 | ✅ 滑动卡片    | 审核员 |
| `/kg`               | 知识图谱          | ✅ SVG 力图    | ✅ 实体卡片流  | 全部   |
| `/history`          | 历史与收藏        | ✅ Tab 列表    | ✅ Tab 列表    | 全部   |
| `/profile`          | 用户中心          | ✅ Tab         | ✅ Tab         | 全部   |
| `/admin/:sub?`      | 系统管理          | ✅ CRUD        | ⚠️ 只读 + 提示 | 管理员 |

---

## 设计系统

### 配色(NEEDS.md 第二节)

| 名称                       | 值                                | 用途                       |
| -------------------------- | --------------------------------- | -------------------------- |
| Primary 深空蓝             | `#0B2545`                         | 顶栏、标题、关键操作       |
| Accent 机械橙              | `#F26B1F`                         | 主按钮、高亮、警示、进度   |
| AI 青                      | `#00B7C2`                         | 多模态 / AI 入口、模型徽标 |
| Success / Warning / Danger | `#2E7D32` / `#ED6C02` / `#C62828` | 状态                       |

支持 **暗色模式**、**高对比度模式**(强光下)、**字号档位** (base / lg / xl)、**手套模式** (1.3× 触控区)。

### 响应式断点(NEEDS.md 第八节)

- **< 640px** → mobile(底部 Tab,固定输入区)
- **640–1024px** → tablet(走 mobile 布局,组件略放宽)
- **≥ 1024px** → pc(完整三栏)

### 信创身份

- 登录页右上角:`信创认证 · LoongArch + 银河麒麟 V11`
- PC 顶栏 / 移动端侧栏:`LoongArch | 银河麒麟` 徽标
- PC 底部固定栏 + 启动屏:全标识
- 浏览器标题、meta、theme-color 全部体现

---

## 关键交互

- **⌘K / Ctrl+K** 唤起命令面板,Esc 关闭(PC)
- **拖拽 / 粘贴** 上传图片,缩略图条带显示
- **AI 打字机** 流式输出诊断结论,`<span class="typing-cursor">` 闪烁光标
- **震动反馈** 移动端勾选完成 / 错误时调用 `navigator.vibrate`
- **左滑驳回 / 右滑通过**(审核移动端,SwipeableCard 组件)
- **长按麦克风** 模拟语音输入(VoiceInputButton)
- **8 倍数节奏** 间距(`var(--space-1..6)`)
- **无 emoji 滥用**,工业克制点缀

---

## API 层约定

`src/api/request.ts` 创建 axios 实例,`baseURL = import.meta.env.VITE_API_BASE`(默认 `/api`)。

所有域方法统一返回 `Promise<T>`,内部使用 `safeCall(fn, fallback)` 包装:

- 后端可达 → 返回 `data.data`
- 后端不可达 / 字段错误 → 返回类型对的兜底数据,**保证页面始终可演示**

要对接真实后端,只需:

1. 修改 `.env.development` 中 `VITE_API_BASE`
2. 部署 `/api/*` 到对应 endpoint
3. 兜底数据可逐步移除

---

## 部署

构建产物 `dist/` 为纯静态文件,可直接部署到:

- 银河麒麟 V11 上的 nginx / Apache
- LoongArch 架构服务器(Vue/Vite 产物为标准 ES 模块,与 CPU 架构无关)
- Chrome 100+ / 麒麟自带浏览器

```nginx
server {
  listen 80;
  root /var/www/maintenance;
  location / { try_files $uri $uri/ /index.html; }
  location /api/ { proxy_pass http://backend:8080/; }
}
```

PWA / 离线包等加分项可按需启用 `vite-plugin-pwa`。

---

## 验证清单

| 项             | 说明                                                                  |
| -------------- | --------------------------------------------------------------------- |
| ✅ 类型检查    | `npm run typecheck` 无错误                                            |
| ✅ 生产构建    | `npm run build` 通过(`dist/index.html` 1.97 kB,gzip 后总 JS ≈ 600 kB) |
| ✅ 路由完整    | 11 个页面 + 1 个详情 = 12 路由可达                                    |
| ✅ 响应式      | 浏览器从 1920px 缩到 393px,布局自动切换                               |
| ✅ 角色守卫    | 非管理员访问 `/admin` 弹 toast 跳回                                   |
| ✅ 移动只读    | 手机访问 `/admin` 提示"前往 PC 端"                                    |
| ✅ 暗色 / 字号 | PC TopBar 切换可见,localStorage 持久化                                |
| ✅ ⌘K          | PC 顶栏点击或按键唤起                                                 |

---

## License

仅用于评审与演示。© 2026

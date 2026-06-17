import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { showToast } from 'vant'

const routes: RouteRecordRaw[] = [
  { path: '/login',     component: () => import('@/views/login/index.vue'),     meta: { layout: 'blank', title: '登录' } },

  // 首页 = 多模态检索（FIX2 第 6 项）
  { path: '/',          redirect: '/search' },

  // 检索
  { path: '/search',    component: () => import('@/views/search/index.vue'),    meta: { layout: 'app', title: '多模态检索' } },
  { path: '/search/:id',component: () => import('@/views/search/Detail.vue'),   meta: { layout: 'app', title: '检索详情' } },

  // 工单 / 作业指引
  { path: '/workflow',  component: () => import('@/views/workflow/index.vue'),  meta: { layout: 'app', title: '作业指引' } },
  { path: '/workflow/:id', component: () => import('@/views/workflow/Detail.vue'), meta: { layout: 'app', title: '作业指引详情' } },

  // 知识库
  { path: '/knowledge/upload', component: () => import('@/views/knowledge/Upload.vue'), meta: { layout: 'app', title: '知识上传' } },

  // 管理员-知识库管理（FIX2 第 4 项）
  { path: '/admin/knowledge', component: () => import('@/views/admin/KnowledgeAdmin.vue'),
    meta: { layout: 'app', title: '知识库管理', roles: ['admin'] } },

  // 审核
  { path: '/audit',     component: () => import('@/views/audit/index.vue'),     meta: { layout: 'app', title: '案例审核', roles: ['auditor', 'admin'] } },

  // 知识图谱
  { path: '/kg',        component: () => import('@/views/kg/index.vue'),        meta: { layout: 'app', title: '知识图谱' } },

  // 历史 / 我的
  { path: '/history',   component: () => import('@/views/history/index.vue'),   meta: { layout: 'app', title: '历史与收藏' } },
  { path: '/profile',   component: () => import('@/views/profile/index.vue'),   meta: { layout: 'app', title: '用户中心' } },

  // 旧"工作台"降级为次级入口（FIX2 第 6 项）
  { path: '/workspace', component: () => import('@/views/dashboard/index.vue'), meta: { layout: 'app', title: '工作台' } },
  // 兼容旧 /dashboard 链接
  { path: '/dashboard', redirect: '/workspace' },

  // 系统管理
  { path: '/admin/:sub?', component: () => import('@/views/admin/index.vue'),   meta: { layout: 'app', title: '系统管理', roles: ['admin'], mobileReadonly: true } },

  { path: '/:pathMatch(.*)*', redirect: '/search' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

router.beforeEach((to, _from, next) => {
  const u = useUserStore()
  document.title = `${to.meta?.title || ''} · 设备检修知识检索系统`

  if (to.path !== '/login' && !u.isLoggedIn) {
    return next('/login')
  }
  // 角色守卫
  const allowed = (to.meta?.roles as string[]) || []
  if (allowed.length && !allowed.includes(u.role)) {
    showToast('权限不足,无法访问该模块')
    return next('/')
  }
  if (to.meta?.mobileReadonly && window.innerWidth < 1024) {
    showToast({ message: '该模块在移动端仅可只读浏览,完整操作请前往 PC 端', duration: 2500 })
  }
  next()
})

export default router

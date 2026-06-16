import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { showToast } from 'vant'

const routes: RouteRecordRaw[] = [
  { path: '/login',     component: () => import('@/views/login/index.vue'),     meta: { layout: 'blank', title: '登录' } },
  { path: '/',          redirect: '/dashboard' },
  { path: '/dashboard', component: () => import('@/views/dashboard/index.vue'), meta: { layout: 'app', title: '工作台' } },
  { path: '/search',    component: () => import('@/views/search/index.vue'),    meta: { layout: 'app', title: '多模态检索' } },
  { path: '/search/:id',component: () => import('@/views/search/Detail.vue'),   meta: { layout: 'app', title: '检索详情' } },
  { path: '/workflow',  component: () => import('@/views/workflow/index.vue'),  meta: { layout: 'app', title: '作业指引' } },
  { path: '/workflow/:id', component: () => import('@/views/workflow/Detail.vue'), meta: { layout: 'app', title: '作业指引详情' } },
  { path: '/knowledge/upload', component: () => import('@/views/knowledge/Upload.vue'), meta: { layout: 'app', title: '知识上传' } },
  { path: '/audit',     component: () => import('@/views/audit/index.vue'),     meta: { layout: 'app', title: '案例审核', roles: ['auditor', 'admin'] } },
  { path: '/kg',        component: () => import('@/views/kg/index.vue'),        meta: { layout: 'app', title: '知识图谱' } },
  { path: '/history',   component: () => import('@/views/history/index.vue'),   meta: { layout: 'app', title: '历史与收藏' } },
  { path: '/profile',   component: () => import('@/views/profile/index.vue'),   meta: { layout: 'app', title: '用户中心' } },
  { path: '/admin/:sub?', component: () => import('@/views/admin/index.vue'),   meta: { layout: 'app', title: '系统管理', roles: ['admin'], mobileReadonly: true } },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
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
  // 移动端只读路由提示
  const allowed = (to.meta?.roles as string[]) || []
  if (allowed.length && !allowed.includes(u.role)) {
    showToast('权限不足,无法访问该模块')
    return next('/dashboard')
  }
  if (to.meta?.mobileReadonly && window.innerWidth < 1024) {
    showToast({ message: '该模块在移动端仅可只读浏览,完整操作请前往 PC 端', duration: 2500 })
  }
  next()
})

export default router

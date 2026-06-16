<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Home, Search, ListChecks, ShieldCheck, Cog, User } from 'lucide-vue-next'
import { useUserStore } from '@/stores/user'
import { hasPermission } from '@/utils/permission'

const route = useRoute()
const router = useRouter()
const user = useUserStore()

/**
 * 移动端底部导航与 PC 保持一致的权限规则。
 * - 一线检修员/访客:首页 / 检索 / 指引 / 我的
 * - 审核员:首页 / 检索 / 审核 / 指引 / 我的
 * - 管理员:首页 / 检索 / 审核 / 系统 / 我的
 *
 * 移动端最多显示 5 个 Tab,其余功能通过侧边抽屉访问。
 */
const tabs = computed(() => {
  const role = user.role
  const all = [
    { path: '/dashboard', icon: Home,        label: '首页', roles: undefined },
    { path: '/search',    icon: Search,      label: '检索', roles: undefined },
    { path: '/audit',     icon: ShieldCheck, label: '审核', badge: 5, roles: ['auditor', 'admin'] as const },
    { path: '/admin',     icon: Cog,         label: '系统',  roles: ['admin'] as const },
    { path: '/workflow',  icon: ListChecks,  label: '指引', badge: 1, roles: undefined },
    { path: '/profile',   icon: User,        label: '我的', roles: undefined }
  ]
  // 过滤可见
  const visible = all.filter(t => hasPermission(role, t.roles as any))
  // 仅取前 5 个,保证最后一项是"我的"
  if (visible.length <= 5) return visible
  return [...visible.filter(t => t.path !== '/profile').slice(0, 4),
          visible.find(t => t.path === '/profile')!]
})

const active = computed(() => tabs.value.findIndex(t => route.path.startsWith(t.path)))
</script>

<template>
  <nav class="h-14 flex-shrink-0 bg-card border-t border-border flex items-stretch safe-bottom z-30">
    <button v-for="(t, i) in tabs" :key="t.path"
            @click="router.push(t.path)"
            class="flex-1 flex flex-col items-center justify-center gap-0.5 relative transition active:scale-95"
            :class="active === i ? 'text-accent' : 'text-text-2'">
      <component :is="t.icon" class="w-5 h-5" :stroke-width="active === i ? 2.4 : 1.8" />
      <span class="text-[11px]" :class="active === i ? 'font-semibold' : ''">{{ t.label }}</span>
      <span v-if="t.badge && active !== i"
            class="absolute top-1.5 right-1/4 px-1 h-4 min-w-4 rounded-full bg-accent text-white text-[10px] font-semibold mono flex items-center justify-center">
        {{ t.badge }}
      </span>
    </button>
  </nav>
</template>

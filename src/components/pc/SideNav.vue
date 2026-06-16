<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LayoutDashboard, Search, ListChecks, BookOpen, ShieldCheck, Network, Cog, History, User, ChevronRight } from 'lucide-vue-next'
import { useUserStore } from '@/stores/user'
import { getVisibleMenuItems } from '@/utils/permission'

const route = useRoute()
const router = useRouter()
const user = useUserStore()

const ICONS: Record<string, any> = {
  '/dashboard':        LayoutDashboard,
  '/search':           Search,
  '/workflow':         ListChecks,
  '/knowledge/upload': BookOpen,
  '/audit':            ShieldCheck,
  '/kg':               Network,
  '/history':          History,
  '/profile':          User,
  '/admin':            Cog
}

const items = computed(() =>
  getVisibleMenuItems(user.role).map(it => ({ ...it, icon: ICONS[it.path] }))
)

const isActive = (p: string) => route.path === p || route.path.startsWith(p + '/')
</script>

<template>
  <aside class="w-[220px] flex-shrink-0 bg-card border-r border-border flex flex-col">
    <nav class="p-3 space-y-0.5 flex-1 overflow-auto">
      <button v-for="it in items" :key="it.path"
              @click="router.push(it.path)"
              :class="[
                'w-full h-10 px-3 rounded-btn flex items-center gap-3 text-sm transition group',
                isActive(it.path)
                  ? 'bg-accent/10 text-accent font-semibold'
                  : 'text-text hover:bg-bg'
              ]">
        <component :is="it.icon" class="w-4 h-4" :class="isActive(it.path) ? '' : 'text-text-2 group-hover:text-text'" />
        <span class="flex-1 text-left">{{ it.label }}</span>
        <span v-if="it.badge"
              class="px-1.5 h-5 min-w-5 rounded-full bg-accent text-white text-xs font-semibold flex items-center justify-center mono">
          {{ it.badge }}
        </span>
        <ChevronRight v-if="isActive(it.path)" class="w-3.5 h-3.5" />
      </button>
    </nav>

    <!-- 底部信创信息卡 -->
    <div class="p-3 border-t border-border">
      <div class="bg-gradient-to-br from-primary to-primary-2 text-on-dark p-3 rounded-card text-xs">
        <div class="flex items-center gap-1 font-semibold mb-1">
          <span class="w-1.5 h-1.5 rounded-full bg-ai inline-block animate-pulse"></span>
          AI 引擎 在线
        </div>
        <div class="opacity-70 mono">multimodal-v2.4 · 2.1ms</div>
      </div>
    </div>
  </aside>
</template>

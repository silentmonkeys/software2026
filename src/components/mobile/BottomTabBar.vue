<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Home, Search, ListChecks, User } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const tabs = [
  { path: '/dashboard', icon: Home,      label: '首页' },
  { path: '/search',    icon: Search,    label: '检索' },
  { path: '/workflow',  icon: ListChecks,label: '指引', badge: 1 },
  { path: '/profile',   icon: User,      label: '我的' }
]

const active = computed(() => tabs.findIndex(t => route.path.startsWith(t.path)))
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

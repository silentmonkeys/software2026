<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Bell, Command as CmdIcon, Sun, Moon, ZoomIn, LogOut, User } from 'lucide-vue-next'
import { useUserStore } from '@/stores/user'
import { useUiStore } from '@/stores/ui'
import { useTheme } from '@/composables/useTheme'

const router = useRouter()
const user = useUserStore()
const ui = useUiStore()
const { theme, fontSize, toggleDark, setFontSize } = useTheme()

const showUser = ref(false)
const onLogout = async () => {
  await user.logout()
  router.push('/login')
}
const cycleFont = () => {
  const order = ['base', 'lg', 'xl'] as const
  const i = order.indexOf(fontSize.value as typeof order[number])
  setFontSize(order[(i + 1) % order.length])
}
</script>

<template>
  <header class="h-14 flex-shrink-0 bg-primary text-on-dark flex items-center px-4 gap-4 shadow-card relative z-30">
    <!-- Logo -->
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center">
        <svg viewBox="0 0 24 24" class="w-5 h-5 text-white"><path fill="currentColor" d="M12 4l8 4.5v7L12 20l-8-4.5v-7L12 4zm0 2.3L6 9.7v4.6l6 3.4l6-3.4V9.7L12 6.3z"/></svg>
      </div>
      <div class="font-semibold tracking-wide">检修助手</div>
      <span class="xinchuang-badge !bg-white/10 !border-white/30">
        <span class="dot"></span>
        LoongArch | 银河麒麟
      </span>
    </div>

    <!-- 全局搜索 / ⌘K 触发 -->
    <button
      @click="ui.cmdPaletteOpen = true"
      class="flex-1 max-w-2xl mx-auto h-9 px-3 rounded-btn bg-white/10 hover:bg-white/15 transition flex items-center gap-2 text-sm text-on-dark/70 border border-white/10">
      <Search class="w-4 h-4" />
      <span>搜索设备 / 故障 / 案例…</span>
      <span class="ml-auto flex items-center gap-1 mono text-xs opacity-70">
        <CmdIcon class="w-3 h-3" />K
      </span>
    </button>

    <!-- 工具区 -->
    <div class="flex items-center gap-2">
      <button class="w-9 h-9 rounded-btn hover:bg-white/10 flex items-center justify-center mono text-xs" @click="cycleFont" title="字号">
        +A
      </button>
      <button class="w-9 h-9 rounded-btn hover:bg-white/10 flex items-center justify-center" @click="toggleDark" title="深浅切换">
        <Moon v-if="theme === 'light'" class="w-4 h-4" />
        <Sun v-else class="w-4 h-4" />
      </button>
      <button class="w-9 h-9 rounded-btn hover:bg-white/10 flex items-center justify-center relative" title="通知">
        <Bell class="w-4 h-4" />
        <span class="absolute top-2 right-2 w-1.5 h-1.5 bg-accent rounded-full"></span>
      </button>
      <div class="relative">
        <button class="flex items-center gap-2 h-9 px-2 rounded-btn hover:bg-white/10" @click="showUser = !showUser">
          <div class="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-white text-xs font-semibold">
            {{ (user.info?.name || '游').slice(0, 1) }}
          </div>
          <span class="text-sm">{{ user.info?.name || '访客' }}</span>
        </button>
        <transition name="fade">
          <div v-if="showUser"
               class="absolute right-0 top-full mt-2 w-56 industrial-card text-text shadow-float overflow-hidden">
            <div class="p-3 border-b border-border">
              <div class="font-semibold">{{ user.info?.name }}</div>
              <div class="text-xs text-text-2 mt-0.5">{{ user.info?.workshop }}</div>
            </div>
            <button @click="router.push('/profile'); showUser = false"
                    class="w-full text-left px-3 h-10 hover:bg-bg flex items-center gap-2 text-sm">
              <User class="w-4 h-4" /> 个人中心
            </button>
            <button @click="onLogout"
                    class="w-full text-left px-3 h-10 hover:bg-bg flex items-center gap-2 text-sm text-danger">
              <LogOut class="w-4 h-4" /> 退出登录
            </button>
          </div>
        </transition>
      </div>
    </div>
  </header>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity .15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

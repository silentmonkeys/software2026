<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { Lock, User, Cog, QrCode, ChevronDown } from 'lucide-vue-next'
import { showToast } from 'vant'
import { ROLE_LABEL, DEMO_ACCOUNTS, type Role } from '@/utils/permission'

const router = useRouter()
const user = useUserStore()
const username = ref('lishifu')
const password = ref('demo123')
const loading = ref(false)
const role = ref<Role>('frontline')
const showRoleMenu = ref(false)

const roles: Role[] = ['frontline', 'auditor', 'admin', 'guest']

const currentDemo = computed(() => DEMO_ACCOUNTS[role.value])

const onLogin = async () => {
  if (!username.value || !password.value) { showToast('请填写账号和密码'); return }
  loading.value = true
  try {
    await user.login(username.value, password.value, false, role.value)
    showToast({ type: 'success', message: '登录成功 · ' + ROLE_LABEL[role.value] })
    router.push('/dashboard')
  } finally { loading.value = false }
}

const pickRole = (r: Role) => {
  role.value = r
  username.value = r
  showRoleMenu.value = false
}
</script>

<template>
  <div class="min-h-screen bg-card flex flex-col safe-top safe-bottom">
    <!-- 顶部品牌 -->
    <div class="bg-industrial-hero px-6 pt-12 pb-10 text-on-dark relative">
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center">
          <Cog class="w-6 h-6 text-white" />
        </div>
        <div>
          <div class="font-bold text-lg leading-tight">检修助手</div>
          <div class="text-[11px] opacity-70 mono">Equipment Maintenance · Mobile</div>
        </div>
      </div>
      <div class="mt-6 text-2xl font-bold leading-tight">欢迎使用</div>
      <div class="mt-1 text-sm opacity-80">车间现场 · 多模态检索 · 标准化作业</div>
      <div class="mt-4">
        <span class="xinchuang-badge"><span class="dot"></span>信创认证 · LoongArch + 银河麒麟 V11</span>
      </div>
    </div>

    <!-- 表单 -->
    <form @submit.prevent="onLogin" class="px-6 pt-6 space-y-4 flex-1">
      <!-- 演示角色 -->
      <div>
        <div class="text-xs text-text-2 mb-1.5 flex items-center gap-1">
          演示角色
          <span class="px-1.5 py-0.5 rounded bg-ai/10 text-ai text-[10px] mono">MOCK</span>
        </div>
        <div class="relative">
          <button type="button" @click="showRoleMenu = !showRoleMenu"
                  class="w-full h-14 px-4 rounded-btn border border-border bg-bg text-left flex items-center gap-3">
            <span class="w-9 h-9 rounded-full bg-accent/10 text-accent text-sm font-bold flex items-center justify-center">
              {{ ROLE_LABEL[role].slice(0,1) }}
            </span>
            <div class="flex-1 min-w-0">
              <div class="text-base font-medium">{{ ROLE_LABEL[role] }}</div>
              <div class="text-xs text-text-2 truncate">{{ currentDemo.workshop }}</div>
            </div>
            <ChevronDown class="w-5 h-5 text-text-2" :class="{ 'rotate-180': showRoleMenu }" />
          </button>
          <transition name="fade">
            <div v-if="showRoleMenu" class="absolute z-20 left-0 right-0 mt-1 bg-card rounded-btn border border-border shadow-float overflow-hidden">
              <button v-for="r in roles" :key="r" type="button"
                      @click="pickRole(r)"
                      class="w-full h-14 px-4 flex items-center gap-3 text-left active:bg-bg"
                      :class="r === role ? 'bg-accent/5 text-accent' : ''">
                <span class="w-9 h-9 rounded-full bg-accent/10 text-accent text-sm font-bold flex items-center justify-center">
                  {{ ROLE_LABEL[r].slice(0,1) }}
                </span>
                <div class="flex-1 min-w-0">
                  <div class="text-base font-medium">{{ ROLE_LABEL[r] }}</div>
                  <div class="text-xs text-text-2 truncate">{{ DEMO_ACCOUNTS[r].workshop }}</div>
                </div>
              </button>
            </div>
          </transition>
        </div>
      </div>

      <div class="relative">
        <User class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-2" />
        <input v-model="username" placeholder="工号 / 用户名"
               class="w-full h-14 pl-12 pr-3 rounded-btn border border-border bg-bg text-base outline-none focus:border-accent focus:bg-card" />
      </div>
      <div class="relative">
        <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-2" />
        <input v-model="password" type="password" placeholder="密码"
               class="w-full h-14 pl-12 pr-3 rounded-btn border border-border bg-bg text-base outline-none focus:border-accent focus:bg-card" />
      </div>

      <button type="submit" :disabled="loading"
              class="w-full h-14 rounded-btn bg-accent text-white text-base font-semibold ai-shine active:bg-accent-2 disabled:opacity-60">
        {{ loading ? '登录中…' : '登 录' }}
      </button>

      <button type="button" class="w-full h-12 rounded-btn border border-border text-text-2 flex items-center justify-center gap-2">
        <QrCode class="w-5 h-5" /> 扫一扫登录(扫 PC 端二维码)
      </button>

      <div class="px-3 py-2 bg-bg rounded-btn text-xs text-text-2">
        演示模式:选择角色后,输入任意用户名密码即可登录,不同角色菜单不同
      </div>

      <div class="flex justify-between text-sm text-text-2 pt-2">
        <a class="hover:text-accent">忘记密码?</a>
        <a class="hover:text-accent">注册新账号 →</a>
      </div>
    </form>

    <div class="text-center text-xs text-text-2 px-6 pb-4 pt-4 mono">
      © 2026 设备检修知识检索系统
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity .15s, transform .15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }
.rotate-180 { transform: rotate(180deg); }
</style>

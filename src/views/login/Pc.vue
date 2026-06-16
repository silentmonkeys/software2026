<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Lock, User, Loader, Cog, ChevronDown } from 'lucide-vue-next'
import { useUserStore } from '@/stores/user'
import { showToast } from 'vant'
import { ROLE_LABEL, DEMO_ACCOUNTS, type Role } from '@/utils/permission'

const router = useRouter()
const user = useUserStore()

const username = ref('lishifu')
const password = ref('demo123')
const remember = ref(true)
const loading = ref(false)
const role = ref<Role>('frontline')
const showRoleMenu = ref(false)

const roles: Role[] = ['frontline', 'auditor', 'admin', 'guest']

const currentDemo = computed(() => DEMO_ACCOUNTS[role.value])

const onLogin = async () => {
  if (!username.value || !password.value) { showToast('请填写账号和密码'); return }
  loading.value = true
  try {
    await user.login(username.value, password.value, remember.value, role.value)
    showToast({ type: 'success', message: '登录成功 · ' + ROLE_LABEL[role.value] })
    router.push('/dashboard')
  } finally { loading.value = false }
}

const pickRole = (r: Role) => {
  role.value = r
  username.value = r          // 同步用户名,与 mock 匹配
  showRoleMenu.value = false
}
</script>

<template>
  <div class="h-screen w-screen bg-industrial-hero flex items-center justify-center relative overflow-hidden">
    <!-- 顶部信创条 -->
    <div class="absolute top-0 inset-x-0 h-12 px-6 flex items-center justify-between text-on-dark z-10">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center">
          <Cog class="w-5 h-5 text-white" />
        </div>
        <div>
          <div class="font-semibold tracking-wide">设备检修知识检索与作业系统</div>
          <div class="text-[11px] opacity-60 mono">Equipment Maintenance · Multimodal AI</div>
        </div>
      </div>
      <span class="xinchuang-badge"><span class="dot"></span>信创认证 · LoongArch + 银河麒麟 V11</span>
    </div>

    <!-- 装饰齿轮 -->
    <svg viewBox="0 0 200 200" class="absolute -left-20 -bottom-20 w-[420px] h-[420px] text-white/5">
      <g fill="currentColor">
        <circle cx="100" cy="100" r="60" />
        <circle cx="100" cy="100" r="40" fill="#0B2545" />
        <g v-for="i in 12" :key="i" :transform="`rotate(${i * 30} 100 100)`">
          <rect x="96" y="20" width="8" height="20" />
        </g>
      </g>
    </svg>

    <!-- 登录卡 -->
    <div class="w-[420px] industrial-card p-8 relative z-10 shadow-float">
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-primary mb-1">欢迎回来</h1>
        <div class="text-sm text-text-2">登录后开始检修工作</div>
      </div>

      <form @submit.prevent="onLogin" class="space-y-4">
        <!-- 演示角色选择 -->
        <div>
          <div class="text-xs text-text-2 mb-1.5 flex items-center gap-1">
            <span>演示角色</span>
            <span class="px-1.5 py-0.5 rounded bg-ai/10 text-ai text-[10px] mono">MOCK</span>
          </div>
          <div class="relative">
            <button type="button" @click="showRoleMenu = !showRoleMenu"
                    class="w-full h-11 px-3 rounded-btn border border-border bg-bg text-left flex items-center gap-2 hover:border-accent transition">
              <span class="w-7 h-7 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center justify-center">
                {{ ROLE_LABEL[role].slice(0,1) }}
              </span>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium">{{ ROLE_LABEL[role] }}</div>
                <div class="text-[11px] text-text-2 truncate">{{ currentDemo.workshop }}</div>
              </div>
              <ChevronDown class="w-4 h-4 text-text-2" :class="{ 'rotate-180': showRoleMenu }" />
            </button>
            <transition name="fade">
              <div v-if="showRoleMenu"
                   class="absolute z-20 left-0 right-0 mt-1 industrial-card shadow-float overflow-hidden">
                <button v-for="r in roles" :key="r" type="button"
                        @click="pickRole(r)"
                        class="w-full h-11 px-3 flex items-center gap-2 text-left hover:bg-bg"
                        :class="r === role ? 'bg-accent/5 text-accent' : ''">
                  <span class="w-7 h-7 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center justify-center">
                    {{ ROLE_LABEL[r].slice(0,1) }}
                  </span>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium">{{ ROLE_LABEL[r] }}</div>
                    <div class="text-[11px] text-text-2 truncate">{{ DEMO_ACCOUNTS[r].workshop }}</div>
                  </div>
                </button>
              </div>
            </transition>
          </div>
        </div>

        <div class="relative">
          <User class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-2" />
          <input v-model="username" type="text" placeholder="工号 / 用户名"
                 class="w-full h-11 pl-10 pr-3 rounded-btn border border-border bg-bg outline-none focus:border-accent focus:bg-card transition" />
        </div>
        <div class="relative">
          <Lock class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-2" />
          <input v-model="password" type="password" placeholder="密码"
                 class="w-full h-11 pl-10 pr-3 rounded-btn border border-border bg-bg outline-none focus:border-accent focus:bg-card transition" />
        </div>
        <div class="flex items-center justify-between text-sm">
          <label class="flex items-center gap-2 cursor-pointer text-text-2">
            <input v-model="remember" type="checkbox" class="accent-accent" />
            <span>记住我</span>
          </label>
          <a class="text-accent hover:text-accent-2">忘记密码?</a>
        </div>
        <button type="submit" :disabled="loading"
                class="w-full h-11 rounded-btn bg-accent hover:bg-accent-2 text-white font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60 ai-shine">
          <Loader v-if="loading" class="w-4 h-4 animate-spin" />
          <span>{{ loading ? '正在登录…' : '登 录' }}</span>
        </button>
      </form>

      <div class="mt-6 pt-4 border-t border-border flex items-center justify-between text-sm">
        <a class="text-text-2 hover:text-accent">企业 SSO 单点登录</a>
        <a class="text-text-2 hover:text-accent">注册新账号 →</a>
      </div>

      <div class="mt-6 px-3 py-2 bg-bg rounded-btn text-xs text-text-2">
        <div class="font-medium text-text mb-1">演示模式</div>
        <div>选择角色后,输入任意用户名和密码即可登录;不同角色看到的菜单不同</div>
        <div class="mt-1 mono text-[11px] opacity-70">
          admin / auditor / worker / guest · 任意密码
        </div>
      </div>
    </div>

    <!-- 底部 -->
    <div class="absolute bottom-4 inset-x-0 text-center text-on-dark/60 text-xs mono">
      © 2026 设备检修知识检索系统 · 推荐 Chrome 100+ / 麒麟自带浏览器
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity .15s, transform .15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }
.rotate-180 { transform: rotate(180deg); }
</style>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Lock, User, Loader, Cog } from 'lucide-vue-next'
import { useUserStore } from '@/stores/user'
import { showToast } from 'vant'

const router = useRouter()
const user = useUserStore()

const username = ref('lishifu')
const password = ref('demo123')
const remember = ref(true)
const loading = ref(false)

const onLogin = async () => {
  if (!username.value || !password.value) { showToast('请填写账号和密码'); return }
  loading.value = true
  try {
    await user.login(username.value, password.value, remember.value)
    showToast({ type: 'success', message: '登录成功' })
    router.push('/dashboard')
  } finally { loading.value = false }
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
        <div class="font-medium text-text mb-1">演示账号</div>
        <div class="mono">lishifu / demo123 (任意均可)</div>
      </div>
    </div>

    <!-- 底部 -->
    <div class="absolute bottom-4 inset-x-0 text-center text-on-dark/60 text-xs mono">
      © 2026 设备检修知识检索系统 · 推荐 Chrome 100+ / 麒麟自带浏览器
    </div>
  </div>
</template>

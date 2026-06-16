<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { Lock, User, Cog, QrCode } from 'lucide-vue-next'
import { showToast } from 'vant'

const router = useRouter()
const user = useUserStore()
const username = ref('lishifu')
const password = ref('demo123')
const loading = ref(false)

const onLogin = async () => {
  if (!username.value || !password.value) { showToast('请填写账号和密码'); return }
  loading.value = true
  try {
    await user.login(username.value, password.value)
    showToast({ type: 'success', message: '登录成功' })
    router.push('/dashboard')
  } finally { loading.value = false }
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
    <form @submit.prevent="onLogin" class="px-6 pt-8 space-y-4 flex-1">
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

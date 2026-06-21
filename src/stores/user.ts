import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as authApi from '@/api/auth'
import { storage } from '@/utils/storage'
import type { Role } from '@/constants/roles'
import { TOKEN_STORAGE_KEY } from '@/api/request'

interface UserInfo {
  id: string
  name: string
  role: Role
  isDefaultAdmin?: boolean
}

export const useUserStore = defineStore('user', () => {
  // FIX5 第 18 项：localStorage 只保存 token，不保存明文用户资料
  const token = ref<string>(storage.get<string>(TOKEN_STORAGE_KEY) || '')
  const info = ref<UserInfo | null>(null)

  const isLoggedIn = computed(() => !!token.value)
  const role = computed<Role>(() => info.value?.role || 'guest')
  const isAdmin = computed(() => role.value === 'admin')
  const isAuditor = computed(() => role.value === 'auditor' || role.value === 'admin')
  const isWorker = computed(() => role.value === 'frontline')
  const isGuest = computed(() => role.value === 'guest')
  const isDefaultAdmin = computed(() => !!info.value?.isDefaultAdmin)

  const login = async (username: string, password: string, _remember = false) => {
    const res = await authApi.login({ username, password })
    token.value = res.token
    storage.set(TOKEN_STORAGE_KEY, res.token)
    // 用 token 拉取权威用户信息（含 isDefaultAdmin）
    await hydrate()
    if (!info.value) info.value = { ...res.user }
    return res
  }

  /** 注册：成功后不自动登录（跳回登录页） */
  const register = async (username: string, password: string) => {
    return authApi.register({ username, password })
  }

  /** 用已存的 token 回填当前用户（页面刷新后调用） */
  const hydrate = async () => {
    if (!token.value) return
    try {
      const me = await authApi.fetchMe()
      info.value = { id: me.id, name: me.name, role: me.role, isDefaultAdmin: me.isDefaultAdmin }
    } catch {
      // token 失效：清理（路由守卫会跳登录）
      token.value = ''
      info.value = null
      storage.remove(TOKEN_STORAGE_KEY)
    }
  }

  const logout = async () => {
    try { await authApi.logout() } catch {}
    token.value = ''
    info.value = null
    storage.remove(TOKEN_STORAGE_KEY)
    try {
      const { useChatHistoryStore } = await import('@/stores/chatHistory')
      useChatHistoryStore().reset()
    } catch {}
  }

  return {
    token, info, isLoggedIn, role, isAdmin, isAuditor, isWorker, isGuest, isDefaultAdmin,
    login, register, hydrate, logout
  }
})

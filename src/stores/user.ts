import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as authApi from '@/api/auth'
import { storage } from '@/utils/storage'
import type { Role } from '@/utils/permission'
import { TOKEN_STORAGE_KEY } from '@/api/request'

interface UserInfo {
  id: string
  name: string
  role: Role
  workshop?: string
  avatar?: string
}

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(storage.get<string>(TOKEN_STORAGE_KEY) || '')
  const info = ref<UserInfo | null>(storage.get<UserInfo>('app:user') || null)

  const isLoggedIn = computed(() => !!token.value)
  const role = computed<Role>(() => info.value?.role || 'guest')
  const isAdmin = computed(() => role.value === 'admin')
  const isAuditor = computed(() => role.value === 'auditor' || role.value === 'admin')
  const isWorker = computed(() => role.value === 'frontline')
  const isGuest = computed(() => role.value === 'guest')

  const login = async (username: string, password: string, remember = false, roleHint?: Role) => {
    const res = await authApi.login({ username, password, remember, role: roleHint })
    token.value = res.token
    info.value = res.user
    storage.set(TOKEN_STORAGE_KEY, res.token)
    storage.set('app:user', res.user)
    return res
  }

  /** 注册：成功后只保存账号回显，不自动登录（按 FIX2 要求注册成功 → 跳回登录） */
  const register = async (username: string, password: string, _role?: Role) => {
    return authApi.register({ username, password })
  }

  const logout = async () => {
    try { await authApi.logout() } catch {}
    token.value = ''
    info.value = null
    storage.remove(TOKEN_STORAGE_KEY)
    storage.remove('app:user')
  }

  return { token, info, isLoggedIn, role, isAdmin, isAuditor, isWorker, isGuest, login, register, logout }
})

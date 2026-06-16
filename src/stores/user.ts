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

  const login = async (username: string, password: string, remember = false) => {
    const res = await authApi.login({ username, password, remember })
    token.value = res.token
    info.value = res.user
    storage.set(TOKEN_STORAGE_KEY, res.token)
    storage.set('app:user', res.user)
    return res
  }

  const logout = async () => {
    try { await authApi.logout() } catch {}
    token.value = ''
    info.value = null
    storage.remove(TOKEN_STORAGE_KEY)
    storage.remove('app:user')
  }

  return { token, info, isLoggedIn, role, login, logout }
})

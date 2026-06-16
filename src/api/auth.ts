import { post, safeCall } from './request'
import type { Role } from '@/utils/permission'
import { DEMO_ACCOUNTS } from '@/utils/permission'

export interface LoginPayload { username: string; password: string; remember?: boolean; role?: Role }
export interface LoginResult {
  token: string
  user: { id: string; name: string; role: Role; workshop?: string; avatar?: string }
}

/**
 * Mock 登录:
 * 1. 若显式传入 role,使用对应预设账户;
 * 2. 否则按用户名匹配预设账户(admin/auditor/worker/guest);
 * 3. 仍匹配不上则按 frontline 默认登录。
 */
function pickRole(p: LoginPayload): Role {
  if (p.role) return p.role
  const u = (p.username || '').toLowerCase().trim()
  if (u.startsWith('admin'))   return 'admin'
  if (u.startsWith('auditor')) return 'auditor'
  if (u.startsWith('guest'))   return 'guest'
  if (u.startsWith('worker') || u.startsWith('frontline') || u === 'lishifu') return 'frontline'
  return 'frontline'
}

export const login = (p: LoginPayload) => {
  const role = pickRole(p)
  const demo = DEMO_ACCOUNTS[role]
  return safeCall<LoginResult>(() => post('/auth/login', p), {
    token: 'mock-token-' + role + '-' + Date.now(),
    user: {
      id: 'u-' + role,
      name: p.username && p.username !== 'lishifu' ? p.username : demo.name,
      role,
      workshop: demo.workshop
    }
  })
}

export const logout = () => post('/auth/logout')
export const ssoLogin = () => post('/auth/sso')
export const register = (p: LoginPayload & { phone?: string }) =>
  safeCall(() => post('/auth/register', p), { ok: true })

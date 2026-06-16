import { post, safeCall } from './request'
import type { Role } from '@/utils/permission'

export interface LoginPayload { username: string; password: string; remember?: boolean }
export interface LoginResult {
  token: string
  user: { id: string; name: string; role: Role; workshop?: string; avatar?: string }
}

export const login = (p: LoginPayload) =>
  safeCall<LoginResult>(() => post('/auth/login', p), {
    token: 'mock-token-' + Date.now(),
    user: { id: 'u-001', name: p.username || '李师傅', role: 'frontline', workshop: '一号车间·热轧线' }
  })

export const logout = () => post('/auth/logout')
export const ssoLogin = () => post('/auth/sso')
export const register = (p: LoginPayload & { phone?: string }) =>
  safeCall(() => post('/auth/register', p), { ok: true })

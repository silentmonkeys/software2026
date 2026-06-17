import { AxiosError } from 'axios'
import { request } from './request'
import type { Role } from '@/utils/permission'
import { DEMO_ACCOUNTS } from '@/utils/permission'

export interface LoginPayload { username: string; password: string; remember?: boolean; role?: Role }
export interface LoginResult {
  token: string
  user: { id: string; name: string; role: Role; workshop?: string; avatar?: string }
}

/** 后端 access_token / role 响应体 */
interface BackendTokenOut {
  access_token: string
  role: string  // worker / leader / admin
}

/** 后端 role 字段 → 前端权限角色 */
const mapBackendRole = (r: string | undefined): Role => {
  switch ((r || '').toLowerCase()) {
    case 'admin':   return 'admin'
    case 'leader':  return 'auditor'
    case 'auditor': return 'auditor'
    case 'guest':   return 'guest'
    case 'worker':
    case 'frontline':
    default:        return 'frontline'
  }
}

/** 没拿到真实后端时的本地 fallback —— 用预设账户撑起演示态 */
function pickRole(p: LoginPayload): Role {
  if (p.role) return p.role
  const u = (p.username || '').toLowerCase().trim()
  if (u.startsWith('admin'))   return 'admin'
  if (u.startsWith('auditor') || u.startsWith('leader')) return 'auditor'
  if (u.startsWith('guest'))   return 'guest'
  if (u.startsWith('worker') || u.startsWith('frontline') || u === 'lishifu') return 'frontline'
  return 'frontline'
}

function buildMockResult(p: LoginPayload): LoginResult {
  const role = pickRole(p)
  const demo = DEMO_ACCOUNTS[role]
  return {
    token: 'mock-token-' + role + '-' + Date.now(),
    user: {
      id: 'u-' + role,
      name: p.username && p.username !== 'lishifu' ? p.username : demo.name,
      role,
      workshop: demo.workshop
    }
  }
}

/**
 * 错误归一化：
 * - 网络错误 / 后端不可达：抛 NETWORK 标志，调用方决定是否降级 mock
 * - HTTP 业务错误（如 401 / 400）：抛后端 detail 文本，UI 直接展示
 */
class ApiError extends Error {
  isNetwork: boolean
  status?: number
  constructor(msg: string, isNetwork: boolean, status?: number) {
    super(msg)
    this.isNetwork = isNetwork
    this.status = status
  }
}

function normalizeError(e: unknown): ApiError {
  if (e instanceof AxiosError) {
    if (!e.response) return new ApiError('后端不可达', true)
    const data = e.response.data as any
    const detail = (data && (data.detail || data.message)) || `请求失败（${e.response.status}）`
    return new ApiError(String(detail), false, e.response.status)
  }
  return new ApiError((e as Error)?.message || '未知错误', false)
}

/**
 * 登录：先打真实后端；
 * - 后端 401 / 400 → 抛后端 message，UI 显示"账号或密码错误"
 * - 网络不可达 → 静默降级 mock，让演示态可用
 */
export const login = async (p: LoginPayload): Promise<LoginResult> => {
  try {
    const { data } = await request.post<BackendTokenOut>('/auth/login', {
      username: p.username, password: p.password
    })
    const role = mapBackendRole(data.role)
    const demo = DEMO_ACCOUNTS[role]
    return {
      token: data.access_token,
      user: {
        id: 'u-' + p.username,
        name: p.username || demo.name,
        role,
        workshop: demo?.workshop
      }
    }
  } catch (e) {
    const err = normalizeError(e)
    if (err.isNetwork) {
      if (import.meta.env.DEV) console.warn('[auth.login] backend unreachable, fallback to mock')
      return buildMockResult(p)
    }
    throw err
  }
}

/** 注册：HTTP 错误（用户名已存在等）抛给 UI；网络不可达走 mock */
export const register = async (p: LoginPayload & { phone?: string }): Promise<LoginResult> => {
  try {
    const { data } = await request.post<BackendTokenOut>('/auth/register', {
      username: p.username, password: p.password
    })
    const role = mapBackendRole(data.role)
    const demo = DEMO_ACCOUNTS[role]
    return {
      token: data.access_token,
      user: { id: 'u-' + p.username, name: p.username, role, workshop: demo?.workshop }
    }
  } catch (e) {
    const err = normalizeError(e)
    if (err.isNetwork) {
      if (import.meta.env.DEV) console.warn('[auth.register] backend unreachable, fallback to mock')
      return buildMockResult(p)
    }
    throw err
  }
}

/** 后端没有登出接口，纯前端清 token 即可（store 已经处理） */
export const logout = async () => ({ ok: true })

/** SSO 接口：后端尚未实现，保留空实现便于后续替换 */
export const ssoLogin = async () => ({ ok: true })

export { ApiError }

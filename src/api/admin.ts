import { request, rawCall, safeCall, get, post } from './request'
import type { Role } from '@/utils/permission'

/**
 * 后端用户角色（与数据库一致）
 *  - worker / leader / auditor / admin
 */
export type BackendRole = 'worker' | 'leader' | 'auditor' | 'admin'

export interface SysUser {
  id: number
  username: string
  role: BackendRole
  createdAt: string | null
}

/** 前端 Role → 后端角色（提交时用） */
export function frontendRoleToBackend(r: Role): BackendRole {
  switch (r) {
    case 'admin':     return 'admin'
    case 'auditor':   return 'auditor'
    case 'frontline': return 'worker'
    case 'guest':     return 'worker'
  }
}

/** 后端 → 前端角色（展示时用） */
export function backendRoleToFrontend(r: string): Role {
  switch ((r || '').toLowerCase()) {
    case 'admin':   return 'admin'
    case 'auditor': return 'auditor'
    case 'leader':  return 'auditor'
    default:        return 'frontline'
  }
}

/**
 * GET /api/admin/users（仅 admin）
 *  - 后端 401/403/网络错误 → rawCall 兜底为空数组（UI 自行渲染空态）
 *  - 不再返回任何业务 mock 数据
 */
export const listUsers = async (): Promise<SysUser[]> => {
  return rawCall<SysUser[]>(() => request.get<SysUser[]>('/admin/users'), [])
}

/**
 * PUT /api/admin/users/{userId}/role
 *  - body: { role: 'worker' | 'auditor' | 'admin' | 'leader' }
 */
export const updateUserRole = (userId: number, role: BackendRole) =>
  request.put<{ ok: boolean; id: number; role: BackendRole }>(
    `/admin/users/${userId}/role`,
    { role }
  ).then(r => r.data)

/* ===== 兼容旧接口（设备库 / SOP 模板 占位）===== */
export interface DeviceModel { id: string; model: string; vendor: string; category: string; updatedAt: string }
export interface SopTpl { id: string; name: string; deviceModel: string; level: number; steps: number; updatedAt: string }

export const listDevices = () => safeCall<DeviceModel[]>(() => get('/admin/devices'), [])
export const listSops    = () => safeCall<SopTpl[]>(() => get('/admin/sops'),       [])
export const saveSop     = (p: object) => safeCall(() => post('/admin/sop', p), { ok: true })

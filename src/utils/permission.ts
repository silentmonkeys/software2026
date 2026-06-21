import {
  type FrontendRole,
  type Role,
  ROLE_LABEL,
  mapBackendRole,
  mapFrontendRole,
  ASSIGNABLE_ROLES,
  isAuditorRole,
} from '@/constants/roles'

// 兼容旧引用：从单一来源 re-export（FIX5 第 17 项）
export type { Role, FrontendRole }
export { ROLE_LABEL, mapBackendRole, mapFrontendRole, ASSIGNABLE_ROLES, isAuditorRole }

export interface MenuItem {
  path: string
  label: string
  roles?: Role[]
  badge?: number
  highlight?: boolean
}

/** 全局菜单清单,移动端与 PC 端通过该清单 + 当前角色派生可见项 */
export const MENU_ITEMS: MenuItem[] = [
  { path: '/search',            label: '多模态检索', highlight: true },
  { path: '/workflow',          label: '作业指引' },
  { path: '/knowledge/browse',  label: '知识库' },
  { path: '/knowledge/upload',  label: '经验分享',   roles: ['frontline'] },
  { path: '/auditor/review',    label: '待审核',     roles: ['auditor', 'admin'] },
  { path: '/auditor/knowledge', label: '知识库管理', roles: ['auditor', 'admin'] },
  { path: '/admin/user',        label: '用户管理',   roles: ['admin'] },
  { path: '/kg',                label: '知识图谱' },
  { path: '/history',           label: '历史与收藏' },
  { path: '/profile',           label: '个人中心' },
]

/** 权限判断:无 allow 视为公共菜单 */
export function hasPermission(current: Role | undefined, allow?: Role[]): boolean {
  if (!allow || allow.length === 0) return true
  if (!current) return false
  return allow.includes(current)
}

export function hasRole(current: Role | undefined, allow: Role[]): boolean {
  return hasPermission(current, allow)
}

/** 根据当前角色获取可见菜单 */
export function getVisibleMenuItems(role: Role | undefined): MenuItem[] {
  return MENU_ITEMS.filter(it => hasPermission(role, it.roles))
}

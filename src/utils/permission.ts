export type Role = 'frontline' | 'auditor' | 'admin' | 'guest'

export const ROLE_LABEL: Record<Role, string> = {
  frontline: '一线检修员',
  auditor:   '知识审核员',
  admin:     '系统管理员',
  guest:     '访客'
}

export interface MenuItem {
  path: string
  label: string
  roles?: Role[]
  badge?: number
  highlight?: boolean
}

/** 全局菜单清单,移动端与 PC 端通过该清单 + 当前角色派生可见项 */
export const MENU_ITEMS: MenuItem[] = [
  { path: '/dashboard',        label: '工作台' },
  { path: '/search',           label: '多模态检索', highlight: true },
  { path: '/workflow',         label: '作业指引' },
  { path: '/knowledge/upload', label: '知识上传' },
  { path: '/audit',            label: '案例审核', badge: 5, roles: ['auditor', 'admin'] },
  { path: '/kg',               label: '知识图谱' },
  { path: '/history',          label: '历史与收藏' },
  { path: '/profile',          label: '个人中心' },
  { path: '/admin',            label: '系统管理', roles: ['admin'] }
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

/** 演示用预设账户(同时支持登录页"角色选择"快速切换) */
export const DEMO_ACCOUNTS: Record<Role, { name: string; workshop: string; avatar?: string }> = {
  frontline: { name: '李师傅 · 检修员演示', workshop: '一号车间·热轧线' },
  auditor:   { name: '王工 · 审核员演示',   workshop: '设备技术部' },
  admin:     { name: '张主管 · 管理员演示', workshop: '系统管理中心' },
  guest:     { name: '访客演示',            workshop: '访客通道' }
}

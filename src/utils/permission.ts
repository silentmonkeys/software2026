export type Role = 'frontline' | 'auditor' | 'admin' | 'guest'

export const ROLE_LABEL: Record<Role, string> = {
  frontline: '一线检修员',
  auditor:   '知识审核员',
  admin:     '系统管理员',
  guest:     '访客'
}

export function hasRole(current: Role | undefined, allow: Role[]): boolean {
  if (!current) return false
  return allow.includes(current)
}

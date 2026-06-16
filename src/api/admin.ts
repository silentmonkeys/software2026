import { get, post, safeCall } from './request'

export interface SysUser { id: string; name: string; role: string; workshop: string; status: 'active' | 'disabled'; createdAt: string }
export interface DeviceModel { id: string; model: string; vendor: string; category: string; updatedAt: string }
export interface SopTpl { id: string; name: string; deviceModel: string; level: number; steps: number; updatedAt: string }

const USERS: SysUser[] = Array.from({ length: 15 }).map((_, i) => ({
  id: 'u-' + (1000 + i),
  name: ['李师傅', '王工程师', '张组长', '赵主管', '钱审核'][i % 5],
  role: ['frontline', 'auditor', 'admin', 'frontline', 'frontline'][i % 5],
  workshop: ['一号车间·热轧线', '二号车间·冷轧线', '三号车间·镀锌线'][i % 3],
  status: i % 7 === 0 ? 'disabled' : 'active',
  createdAt: new Date(Date.now() - i * 86400000).toISOString()
}))

export const listUsers = () => safeCall<SysUser[]>(() => get('/admin/users'), USERS)
export const listDevices = () => safeCall<DeviceModel[]>(() => get('/admin/devices'),
  Array.from({ length: 8 }).map((_, i) => ({
    id: 'd-' + i,
    model: ['YKK630-4', 'CT-2400', 'HP-180', 'INV-5500'][i % 4] + '-' + i,
    vendor: ['上海电气', '西门子', 'ABB'][i % 3],
    category: ['电机', '泵类', '变频器'][i % 3],
    updatedAt: new Date().toISOString()
  })))
export const listSops = () => safeCall<SopTpl[]>(() => get('/admin/sops'),
  Array.from({ length: 6 }).map((_, i) => ({
    id: 's-' + i,
    name: ['主电机检修', '冷却泵检修', '减速机润滑'][i % 3] + ` 模板 v${(i % 3) + 1}.0`,
    deviceModel: ['YKK630-4', 'CT-2400', 'HP-180'][i % 3],
    level: ((i % 3) + 1),
    steps: 5 + i,
    updatedAt: new Date().toISOString()
  })))

export const saveSop = (p: object) => safeCall(() => post('/admin/sop', p), { ok: true })

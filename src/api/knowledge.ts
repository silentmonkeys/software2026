import { get, post, safeCall } from './request'

export interface CaseSummary {
  id: string
  title: string
  device: string
  level: 1 | 2 | 3
  submitter: string
  status: 'pending' | 'approved' | 'rejected' | 'draft'
  submittedAt: string
  aiPreview?: string
}

const MOCK_CASES: CaseSummary[] = Array.from({ length: 12 }).map((_, i) => ({
  id: 'c-' + (i + 1),
  title: ['液压站压力波动排查', '冷却塔风机轴承更换', '主辊轴端密封漏油处理', '变频器 IGBT 模块烧毁'][i % 4] + ` #${1000 + i}`,
  device: ['YKK630-4', 'CT-2400', 'HP-180', 'INV-5500'][i % 4],
  level: ((i % 3) + 1) as 1 | 2 | 3,
  submitter: ['李师傅', '王工', '张组长', '赵师傅'][i % 4],
  status: (['pending', 'pending', 'approved', 'rejected'] as const)[i % 4],
  submittedAt: new Date(Date.now() - i * 3600 * 1000 * 6).toISOString(),
  aiPreview: i % 2 === 0 ? '✓ 结构完整 / 关键步骤齐全' : '⚠ 缺少处理后验证步骤'
}))

export const listCases = (params?: { keyword?: string; status?: string }) =>
  safeCall<CaseSummary[]>(() => get('/knowledge/cases', params), MOCK_CASES)

export const submitCase = (payload: object) =>
  safeCall(() => post('/knowledge/cases', payload), { id: 'c-' + Date.now() })

export const saveDraft = (payload: object) =>
  safeCall(() => post('/knowledge/draft', payload), { id: 'd-' + Date.now() })

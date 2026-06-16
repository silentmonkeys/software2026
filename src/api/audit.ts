import { get, post, safeCall } from './request'
import type { CaseSummary } from './knowledge'
import { listCases } from './knowledge'

export const auditList = (status: 'pending' | 'approved' | 'rejected' = 'pending') =>
  listCases({ status })

export const approve = (ids: string[], comment?: string) =>
  safeCall(() => post('/audit/approve', { ids, comment }), { ok: true })

export const reject = (ids: string[], comment?: string) =>
  safeCall(() => post('/audit/reject', { ids, comment }), { ok: true })

export const auditDetail = (id: string) =>
  safeCall<CaseSummary | null>(() => get('/audit/' + id), null)

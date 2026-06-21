import { request, rawCall } from './request'

/**
 * 知识库文档（FIX5）
 * - status: pending / approved / rejected / taken_down
 * - 兼容旧后端 ready 字面量（视为 approved）
 */
export type KbStatus =
  | 'pending'      // 待审
  | 'approved'     // 已通过
  | 'rejected'     // 已驳回
  | 'taken_down'   // 已下架
  | 'ready'        // 旧后端「已就绪」=> 视为 approved
  | string

export interface KbDoc {
  id: number
  title: string
  type: string
  category?: string
  status: KbStatus
  created_at: string
  uploaderId?: number
  uploader?: string
  reason?: string
}

export interface KbDocDetail extends KbDoc {
  content: string
}

export interface KbUploadResult {
  doc_id: number
  chunks: number
  status?: KbStatus
}

/** 上传文件：员工 → pending；管理员/审查员 → approved（后端按 JWT 角色判定） */
export const uploadDoc = (file: File): Promise<KbUploadResult> => {
  const form = new FormData()
  form.append('file', file)
  return rawCall<KbUploadResult>(() =>
    request.post<KbUploadResult>('/kb/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000
    })
  )
}

/** 文本知识 / 员工经验分享录入 */
export const uploadText = (body: { title: string; content: string; category?: string }) =>
  rawCall<KbUploadResult>(() => request.post<KbUploadResult>('/kb/text', body))

/** 文档列表 */
export const listDocs = (params?: {
  status?: 'pending' | 'approved' | 'rejected' | 'taken_down'
  uploader?: string
}): Promise<KbDoc[]> =>
  rawCall<KbDoc[]>(() => request.get<KbDoc[]>('/kb/list', { params }))

/** 文档详情（含正文） */
export const getDoc = (id: number) =>
  rawCall<KbDocDetail>(() => request.get<KbDocDetail>(`/kb/${id}`))

/** 删除文档（hard delete，仅 admin/auditor） */
export const deleteDoc = (id: number) =>
  rawCall<{ ok: boolean }>(() => request.delete<{ ok: boolean }>(`/kb/${id}`))

export type ReviewAction = 'approve' | 'reject' | 'take_down'

/** 知识审批 POST /api/kb/review/{doc_id} */
export const reviewDoc = (id: number, action: ReviewAction, reason?: string) =>
  rawCall<{ ok: boolean; status: KbStatus }>(() =>
    request.post<{ ok: boolean; status: KbStatus }>(`/kb/review/${id}`, { action, reason }))

/** 导出文档为 PDF / Markdown，触发浏览器下载 */
export const exportDoc = async (id: number, format: 'pdf' | 'md', filename: string) => {
  const res = await request.get(`/kb/${id}/export`, {
    params: { format },
    responseType: 'blob'
  })
  const blob = new Blob([res.data as BlobPart], {
    type: format === 'pdf' ? 'application/pdf' : 'text/markdown'
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.${format}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const STATUS_LABEL: Record<string, string> = {
  pending: '待审',
  approved: '已通过',
  rejected: '已驳回',
  taken_down: '已下架',
  ready: '已通过'
}

export const isApprovedStatus = (s: KbStatus) => s === 'approved' || s === 'ready'

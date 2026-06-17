import { request, rawCall } from './request'

/**
 * 知识库文档（FIX3 第 7 项扩展）
 * - 新增 status: pending / approved / rejected / taken_down 审批语义
 * - 兼容旧后端 ready / parsing / failed 字面量
 */
export type KbStatus =
  | 'pending'      // 待审
  | 'approved'     // 已通过
  | 'rejected'     // 已驳回
  | 'taken_down'   // 已下架
  | 'ready'        // 旧后端「已就绪」=> 视为 approved
  | 'parsing'      // 解析中
  | 'failed'       // 解析失败
  | string

export interface KbDoc {
  id: number
  title: string
  type: string
  status: KbStatus
  created_at: string
  /** 上传人（FIX3 第 7.3 项要求按 uploader 过滤） */
  uploader?: string
  /** 驳回原因 / 下架原因 */
  reason?: string
}

export interface KbUploadResult {
  doc_id: number
  chunks: number
  status?: KbStatus
}

/**
 * 上传文档：worker 角色上传后默认 status=pending（后端落库时由 JWT 角色判定）
 */
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

/**
 * 文档列表（FIX3 第 7.2 项）
 *  - status：可选筛选条件
 *  - uploader：传 'me' 后端按 token 内的 sub 自动过滤；也可显式传用户 id
 */
export const listDocs = (params?: {
  status?: 'pending' | 'approved' | 'rejected' | 'taken_down' | 'all'
  uploader?: string
}): Promise<KbDoc[]> =>
  rawCall<KbDoc[]>(() =>
    request.get<KbDoc[]>('/kb/list', { params }), []
  )

/** 删除文档（hard delete，仅 admin） */
export const deleteDoc = (id: number) =>
  rawCall<{ ok: boolean }>(() =>
    request.delete<{ ok: boolean }>(`/kb/${id}`), { ok: false }
  )

/**
 * 知识审批（FIX3 第 7.2 项）
 *  POST /api/kb/review/{doc_id}
 *  body { action, reason? }
 */
export type ReviewAction = 'approve' | 'reject' | 'take_down'

export const reviewDoc = (id: number, action: ReviewAction, reason?: string) =>
  rawCall<{ ok: boolean; status: KbStatus }>(() =>
    request.post<{ ok: boolean; status: KbStatus }>(`/kb/review/${id}`, { action, reason }),
    { ok: false, status: 'pending' }
  )

/** 显示语义化文案（FIX3 第 7.3 项） */
export const STATUS_LABEL: Record<string, string> = {
  pending: '待审',
  approved: '已通过',
  rejected: '已驳回',
  taken_down: '已下架',
  ready: '已通过',
  parsing: '解析中',
  failed: '解析失败'
}

export const isApprovedStatus = (s: KbStatus) =>
  s === 'approved' || s === 'ready'

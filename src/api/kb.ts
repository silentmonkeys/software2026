import { request, rawCall } from './request'

/** 知识库文档（与后端 /api/kb/list 字段对齐） */
export interface KbDoc {
  id: number
  title: string
  type: string                                 // pdf / docx / txt / md
  status: 'ready' | 'parsing' | 'failed' | string
  created_at: string
}

export interface KbUploadResult {
  doc_id: number
  chunks: number
}

/**
 * 上传文档到知识库：multipart/form-data，字段名固定为 file。
 * 调用前请校验扩展名（pdf / docx / txt / md），后端会再次拒绝非法文件。
 */
export const uploadDoc = (file: File): Promise<KbUploadResult> => {
  const form = new FormData()
  form.append('file', file)
  return rawCall<KbUploadResult>(() =>
    request.post<KbUploadResult>('/kb/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000   // 解析 + 向量化耗时较长，单独放宽
    })
  )
}

/** 文档列表 */
export const listDocs = (): Promise<KbDoc[]> =>
  rawCall<KbDoc[]>(() => request.get<KbDoc[]>('/kb/list'), [])

/** 删除文档 */
export const deleteDoc = (id: number): Promise<{ ok: boolean }> =>
  rawCall<{ ok: boolean }>(() => request.delete<{ ok: boolean }>(`/kb/${id}`), { ok: false })

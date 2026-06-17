import { post, get, request, rawCall, safeCall } from './request'

export type SearchMode = 'precise' | 'smart' | 'explore'
export type SourceType = 'manual' | 'case' | 'graph'

export interface SearchPayload {
  text?: string
  /** 缩略图 URL，仅前端展示用 */
  images?: string[]
  /** 真正发给后端的图片文件（多模态时必传一张，会取第一个） */
  imageFile?: File | null
  deviceModel?: string
  mode?: SearchMode
  filters?: Record<string, unknown>
}

export interface SearchHit {
  id: string
  type: SourceType
  title: string
  snippet: string
  similarity: number          // 0~1
  source: string
  highlights?: string[]
  meta?: Record<string, unknown>
}

export interface SearchResult {
  summary: string
  /** 后端目前不返回原因 Top3，前端根据问题展示空数组或保留默认 */
  causes: { name: string; confidence: number }[]
  hits: SearchHit[]
  /** 多模态场景下后端返回的图片观察文本（无图为空） */
  imageObservation?: string
}

/** 后端 /api/chat/query 返回结构（FIX3 第 3.2 项：sources 与回答强绑定） */
interface BackendChatResp {
  answer: string
  image_observation: string
  sources: { id?: string; doc_id?: string | number; title: string; snippet: string; page?: number; score?: number }[]
}

const FALLBACK: SearchResult = {
  summary: '',
  causes: [],
  hits: [],
  imageObservation: ''
}
void FALLBACK

/**
 * 多模态检索：实际调用 /api/chat/query。
 * - question 取自 text + deviceModel 拼接
 * - image 字段取 imageFile（前端图片管理保留 File 引用，URL 只用于预览）
 * - sources → hits（带 docId/page 元数据，确保和回答强绑定）
 *
 * FIX3 第 2.4 项：后端不可达时**抛错**，由 UI 展示失败态、不写入历史。
 */
export const multimodalSearch = async (p: SearchPayload): Promise<SearchResult> => {
  const question = [p.text || '', p.deviceModel ? `设备型号：${p.deviceModel}` : '']
    .filter(Boolean)
    .join('\n')
    .trim()

  if (!question && !p.imageFile) {
    throw new Error('请输入问题或上传图片')
  }

  const form = new FormData()
  form.append('question', question || '请描述设备图片中的故障')
  if (p.imageFile) form.append('image', p.imageFile)

  const data = await rawCall<BackendChatResp>(() =>
    request.post<BackendChatResp>('/chat/query', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 90_000
    })
  )
  const hits: SearchHit[] = (data.sources || []).map((s, i) => ({
    id: String(s.id ?? 'src-' + i),
    type: 'manual',
    title: s.title || `引用 ${i + 1}`,
    snippet: s.snippet || '',
    similarity: typeof s.score === 'number' ? Math.max(0, Math.min(1, s.score)) : Math.max(0.55, 0.92 - i * 0.07),
    source: '知识库 · ' + (s.title || ''),
    highlights: [],
    meta: { docId: s.doc_id != null ? String(s.doc_id) : undefined, page: s.page }
  }))
  return {
    summary: data.answer || '',
    causes: [],
    hits,
    imageObservation: data.image_observation || ''
  }
}

export const suggest = (q: string) =>
  safeCall<string[]>(() => get('/search/suggest', { q }), [
    `${q}-振动异常`, `${q}-温度过高`, `${q}-异响排查`
  ])

export const feedback = (id: string, useful: boolean) =>
  safeCall(() => post('/search/feedback', { id, useful }), { ok: true })

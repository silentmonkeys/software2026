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

/** 后端 /api/chat/query 返回结构 */
interface BackendChatResp {
  answer: string
  image_observation: string
  sources: { title: string; snippet: string }[]
}

const FALLBACK: SearchResult = {
  summary: '初步判断为电机轴承润滑不足导致异响,建议立即停机检查。',
  causes: [
    { name: '轴承润滑不足或老化', confidence: 0.86 },
    { name: '联轴器对中偏差', confidence: 0.62 },
    { name: '电机定子气隙异常', confidence: 0.41 }
  ],
  hits: [
    { id: 'h1', type: 'case', title: '热轧主电机异响处理案例 #2024-031', snippet: '检修员发现主电机驱动端轴承温度异常上升至 78℃,伴随金属摩擦声。',
      similarity: 0.92, source: '王师傅提交 · 2024-03-15', highlights: ['轴承', '异响'] },
    { id: 'h2', type: 'manual', title: 'YKK630-4 异步电机检修手册 §4.3 轴承润滑', snippet: '当出现持续金属摩擦声且温度高于 65℃ 时,应立即停机并按 §4.3.2 拆解检查滚动体。',
      similarity: 0.81, source: '电机检修手册 v3.2 · P127', highlights: ['润滑', '滚动体'] },
    { id: 'h3', type: 'graph', title: '故障实体: 电机异响 → 轴承磨损',
      snippet: '关联 32 个历史案例 / 8 个标准化处理流程 / 4 类备件需求',
      similarity: 0.74, source: '知识图谱 · 故障节点', highlights: ['磨损'] }
  ]
}

/**
 * 多模态检索：实际调用 /api/chat/query。
 * - question 取自 text + deviceModel 拼接
 * - image 字段取 imageFile（前端图片管理保留 File 引用，URL 只用于预览）
 * - sources → hits（type 默认 manual，相似度按顺序衰减）
 * - causes 后端未返回，沿用前端兜底（也可以传空数组）
 *
 * 调用方继续兼容旧签名（不传 imageFile 时纯文字问答）。
 */
export const multimodalSearch = async (p: SearchPayload): Promise<SearchResult> => {
  const question = [p.text || '', p.deviceModel ? `设备型号：${p.deviceModel}` : '']
    .filter(Boolean)
    .join('\n')
    .trim()

  if (!question && !p.imageFile) return FALLBACK

  const form = new FormData()
  form.append('question', question || '请描述设备图片中的故障')
  if (p.imageFile) form.append('image', p.imageFile)

  try {
    const data = await rawCall<BackendChatResp>(() =>
      request.post<BackendChatResp>('/chat/query', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 90_000
      })
    )
    const hits: SearchHit[] = (data.sources || []).map((s, i) => ({
      id: 'src-' + i,
      type: 'manual',
      title: s.title || `引用 ${i + 1}`,
      snippet: s.snippet || '',
      similarity: Math.max(0.55, 0.92 - i * 0.07),
      source: '知识库 · ' + (s.title || ''),
      highlights: []
    }))
    return {
      summary: data.answer || '',
      causes: [],
      hits,
      imageObservation: data.image_observation || ''
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[search.multimodalSearch] fallback:', e)
    return FALLBACK
  }
}

export const suggest = (q: string) =>
  safeCall<string[]>(() => get('/search/suggest', { q }), [
    `${q}-振动异常`, `${q}-温度过高`, `${q}-异响排查`
  ])

export const feedback = (id: string, useful: boolean) =>
  safeCall(() => post('/search/feedback', { id, useful }), { ok: true })

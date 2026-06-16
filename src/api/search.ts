import { post, get, safeCall } from './request'

export type SearchMode = 'precise' | 'smart' | 'explore'
export type SourceType = 'manual' | 'case' | 'graph'

export interface SearchPayload {
  text?: string
  images?: string[]
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
  causes: { name: string; confidence: number }[]
  hits: SearchHit[]
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

export const multimodalSearch = (p: SearchPayload) =>
  safeCall<SearchResult>(() => post('/search/multimodal', p), FALLBACK)

export const suggest = (q: string) =>
  safeCall<string[]>(() => get('/search/suggest', { q }), [
    `${q}-振动异常`, `${q}-温度过高`, `${q}-异响排查`
  ])

export const feedback = (id: string, useful: boolean) =>
  safeCall(() => post('/search/feedback', { id, useful }), { ok: true })

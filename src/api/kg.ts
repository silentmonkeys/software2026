import { request, rawCall } from './request'
import { listDocs } from './kb'

/**
 * 知识图谱（FIX3 第 5 项）
 * - 严禁前端硬编码 mockGraphNodes / mockGraphEdges
 * - 必须传已通过审核的 doc_id 列表给后端，缺接口时返回空图（UI 显示空态）
 */
export type KGType = 'device' | 'part' | 'fault' | 'method' | 'case' | 'manual'

export interface KGNode {
  id: string
  label: string
  type: KGType
  weight: number
  desc?: string
  status?: string
  manualRef?: string
  /** 节点对应的源文档（FIX3 第 5.2 项） */
  docId?: string
  chunkId?: string
}
export interface KGEdge { source: string; target: string; rel: string }
export interface KGGraph { nodes: KGNode[]; edges: KGEdge[] }

const EMPTY_GRAPH: KGGraph = { nodes: [], edges: [] }

/**
 * 拉取图谱：把已审通过的 doc_ids 传给后端
 * - 入参缺省时自动从 /api/kb/list 取 status=ready/approved 的文档
 * - 后端不可达时返回空图（UI 提示"暂无可视化的图谱数据"）
 */
export const getGraph = async (docIds?: string[]): Promise<KGGraph> => {
  let ids = docIds
  if (!ids) {
    try {
      const docs = await listDocs()
      ids = docs
        .filter(d => d.status === 'ready' || (d as any).status === 'approved')
        .map(d => String(d.id))
    } catch {
      ids = []
    }
  }
  if (!ids.length) return EMPTY_GRAPH
  return rawCall<KGGraph>(() =>
    request.get<KGGraph>('/kg/graph', { params: { doc_ids: ids!.join(',') } }),
    EMPTY_GRAPH
  )
}

/** 拉取实体详细信息（关联节点） */
export const getEntity = (id: string) =>
  rawCall<{ id: string; props: Record<string, unknown>; related: KGNode[] }>(() =>
    request.get(`/kg/entity/${id}`),
    { id, props: {}, related: [] }
  )

/**
 * 拉取节点对应的原文片段（FIX3 第 5.2 项）
 * GET /api/kb/{docId}/chunk/{chunkId}
 */
export interface ChunkContent {
  docId: string
  chunkId: string
  text: string
  page?: number
  title?: string
}
export const getChunk = (docId: string, chunkId: string) =>
  rawCall<ChunkContent | null>(() =>
    request.get<ChunkContent>(`/kb/${docId}/chunk/${chunkId}`),
    null
  )

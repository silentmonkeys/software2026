import { get, safeCall } from './request'

export interface KGNode {
  id: string
  label: string
  type: 'device' | 'part' | 'fault' | 'method'
  weight: number   // 关联案例数
}
export interface KGEdge { source: string; target: string; rel: string }
export interface KGGraph { nodes: KGNode[]; edges: KGEdge[] }

const MOCK: KGGraph = {
  nodes: [
    { id: 'n1', label: '热轧主电机', type: 'device', weight: 12 },
    { id: 'n2', label: '驱动端轴承',  type: 'part',  weight: 8 },
    { id: 'n3', label: '电机异响',    type: 'fault', weight: 32 },
    { id: 'n4', label: '更换润滑脂',  type: 'method', weight: 22 },
    { id: 'n5', label: '联轴器',      type: 'part', weight: 6 },
    { id: 'n6', label: '振动超标',    type: 'fault', weight: 18 },
    { id: 'n7', label: '对中校正',    type: 'method', weight: 11 }
  ],
  edges: [
    { source: 'n1', target: 'n2', rel: 'has-part' },
    { source: 'n1', target: 'n5', rel: 'has-part' },
    { source: 'n2', target: 'n3', rel: 'cause' },
    { source: 'n5', target: 'n6', rel: 'cause' },
    { source: 'n3', target: 'n4', rel: 'fix-by' },
    { source: 'n6', target: 'n7', rel: 'fix-by' }
  ]
}

export const getGraph = (entity?: string) =>
  safeCall<KGGraph>(() => get('/kg/graph', { entity }), MOCK)

export const getEntity = (id: string) =>
  safeCall(() => get('/kg/entity/' + id), { id, props: {}, related: [] })

import { get, safeCall } from './request'

export type KGType = 'device' | 'part' | 'fault' | 'method' | 'case' | 'manual'

export interface KGNode {
  id: string
  label: string
  type: KGType
  weight: number   // 关联案例数 / 重要度
  desc?: string
  status?: string
  manualRef?: string
}
export interface KGEdge { source: string; target: string; rel: string }
export interface KGGraph { nodes: KGNode[]; edges: KGEdge[] }

const MOCK: KGGraph = {
  nodes: [
    // 设备
    { id: 'dev1', label: '热轧主电机',     type: 'device', weight: 12, desc: 'YKK630-4 异步电机,功率 630kW', status: '运行中', manualRef: 'YKK630-4-V3.2' },
    { id: 'dev2', label: '冷却塔风机',     type: 'device', weight: 8,  desc: 'CT-1500 冷却塔轴流风机',         status: '待检修' },
    { id: 'dev3', label: '液压站',         type: 'device', weight: 10, desc: 'PRESS-500 液压系统',             status: '运行中' },
    { id: 'dev4', label: '空压机',         type: 'device', weight: 6,  desc: 'AC-220 螺杆式空压机',             status: '运行中' },

    // 部件
    { id: 'p1',  label: '驱动端轴承',      type: 'part', weight: 8,  desc: 'SKF 6320 深沟球轴承' },
    { id: 'p2',  label: '联轴器',          type: 'part', weight: 6,  desc: '弹性柱销联轴器 ZL-280' },
    { id: 'p3',  label: '冷却风机叶轮',    type: 'part', weight: 5,  desc: '6叶片轴流叶轮' },
    { id: 'p4',  label: '溢流阀',          type: 'part', weight: 4,  desc: 'YF-32 主溢流阀' },
    { id: 'p5',  label: '油泵',            type: 'part', weight: 7,  desc: '柱塞泵 A10VSO' },

    // 故障
    { id: 'f1',  label: '电机异响',        type: 'fault', weight: 32, desc: '高发故障 · 占比 18%' },
    { id: 'f2',  label: '振动超标',        type: 'fault', weight: 28, desc: '常见原因:对中不良 / 轴承磨损' },
    { id: 'f3',  label: '温度异常',        type: 'fault', weight: 24, desc: '冷却不良或润滑失效' },
    { id: 'f4',  label: '压力波动',        type: 'fault', weight: 18, desc: '溢流阀或油液污染' },
    { id: 'f5',  label: '油液污染',        type: 'fault', weight: 16, desc: 'NAS 等级超标' },

    // 处理方法
    { id: 'm1',  label: '更换润滑脂',      type: 'method', weight: 22 },
    { id: 'm2',  label: '对中校正',        type: 'method', weight: 14 },
    { id: 'm3',  label: '更换轴承',        type: 'method', weight: 18 },
    { id: 'm4',  label: '清洗油路',        type: 'method', weight: 9 },
    { id: 'm5',  label: '更换溢流阀',      type: 'method', weight: 6 },

    // 案例
    { id: 'c1',  label: '20240610-001 主电机轴承异响', type: 'case', weight: 1, desc: '已解决 · 更换 SKF 6320 + 注脂' },
    { id: 'c2',  label: '20240603-007 冷却塔振动',      type: 'case', weight: 1, desc: '已解决 · 动平衡校验' },
    { id: 'c3',  label: '20240528-012 液压压力波动',    type: 'case', weight: 1, desc: '已解决 · 更换溢流阀' },

    // 手册
    { id: 'mn1', label: '检修手册 §4.3',   type: 'manual', weight: 1, manualRef: '检修手册 §4.3' },
    { id: 'mn2', label: '安全规程 §2.1',   type: 'manual', weight: 1, manualRef: '安全规程 §2.1' }
  ],
  edges: [
    // 设备-部件
    { source: 'dev1', target: 'p1', rel: '包含部件' },
    { source: 'dev1', target: 'p2', rel: '包含部件' },
    { source: 'dev2', target: 'p3', rel: '包含部件' },
    { source: 'dev3', target: 'p4', rel: '包含部件' },
    { source: 'dev3', target: 'p5', rel: '包含部件' },

    // 部件-故障
    { source: 'p1', target: 'f1', rel: '可能引起' },
    { source: 'p1', target: 'f2', rel: '可能引起' },
    { source: 'p2', target: 'f2', rel: '可能引起' },
    { source: 'p3', target: 'f2', rel: '可能引起' },
    { source: 'p4', target: 'f4', rel: '可能引起' },
    { source: 'p5', target: 'f4', rel: '可能引起' },
    { source: 'p1', target: 'f3', rel: '可能引起' },

    // 设备-故障 (直接)
    { source: 'dev1', target: 'f1', rel: '高发故障' },
    { source: 'dev3', target: 'f5', rel: '高发故障' },

    // 故障-方法
    { source: 'f1', target: 'm1', rel: '处理方法' },
    { source: 'f1', target: 'm3', rel: '处理方法' },
    { source: 'f2', target: 'm2', rel: '处理方法' },
    { source: 'f2', target: 'm3', rel: '处理方法' },
    { source: 'f3', target: 'm1', rel: '处理方法' },
    { source: 'f4', target: 'm5', rel: '处理方法' },
    { source: 'f4', target: 'm4', rel: '处理方法' },
    { source: 'f5', target: 'm4', rel: '处理方法' },

    // 故障-案例
    { source: 'f1', target: 'c1', rel: '已有案例' },
    { source: 'f2', target: 'c2', rel: '已有案例' },
    { source: 'f4', target: 'c3', rel: '已有案例' },

    // 方法-手册
    { source: 'm1', target: 'mn1', rel: '参考手册' },
    { source: 'm3', target: 'mn1', rel: '参考手册' },
    { source: 'm3', target: 'mn2', rel: '安全规程' }
  ]
}

export const getGraph = (entity?: string) =>
  safeCall<KGGraph>(() => get('/kg/graph', { entity }), MOCK)

export const getEntity = (id: string) =>
  safeCall(() => get('/kg/entity/' + id), { id, props: {}, related: [] })

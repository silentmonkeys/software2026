import { post, safeCall, rawCall, request } from './request'
import {
  listTickets, getTicket, completeTicket,
  type TicketSummary, type TicketDetail, type TicketStatus
} from './ticket'

export interface ToolItem {
  name: string
  spec?: string
  qty: number
  imageUrl?: string
}

export interface SopStep {
  id: string
  index?: number          // 1-based
  name: string
  desc: string
  estMinutes: number
  hazardous?: boolean
  safetyNote?: string
  tools?: string[]        // 兼容旧字段（字符串数组）
  toolItems?: ToolItem[]  // 新字段（结构化）
  materials?: string[]
  manualRef?: string
  acceptance?: string
  checkPoints: string[]
}

export interface SopFlow {
  id: string
  name: string
  deviceModel: string
  level: 1 | 2 | 3
  steps: SopStep[]
}

/**
 * 工单状态（FIX3 第 8 项）
 *  - 前端只显示「待办 / 已完成」两个语义
 */
export type WorkItemStatus = '待办' | '已完成'

export interface WorkItem {
  id: string
  name: string
  deviceModel: string
  difficulty: '初级' | '中级' | '高级'
  estimatedMinutes: number
  status: WorkItemStatus
  level: 1 | 2 | 3
  hazardous?: boolean
  updatedAt: number
  workshop?: string
  /** true = 仅作为 demo 兜底展示，UI 不允许"完成" */
  demo?: boolean
}

/**
 * 离线兜底用的示例工单（FIX3 第 4.3 项要求只保留 1 条带"示例"标记的兜底）
 */
const MOCK_LIST: WorkItem[] = [
  {
    id: 'sop-demo',
    name: '示例·热轧主电机异响二级检修',
    deviceModel: 'YKK630-4',
    difficulty: '中级',
    estimatedMinutes: 128,
    status: '待办',
    level: 2,
    hazardous: true,
    updatedAt: Date.now() - 30 * 60_000,
    workshop: '一号车间·热轧线',
    demo: true
  }
]

const TICKET_STATUS_MAP: Record<TicketStatus, WorkItemStatus> = {
  pending: '待办',
  done:    '已完成'
}

/** 真实工单 → WorkItem */
function ticketToWorkItem(t: TicketSummary): WorkItem {
  return {
    id: 't-' + t.id,
    name: t.fault || `工单 #${t.id}`,
    deviceModel: t.device || '未指定',
    difficulty: '中级',
    estimatedMinutes: 60,
    status: TICKET_STATUS_MAP[t.status] || '待办',
    level: 2,
    updatedAt: Date.now(),
    workshop: 'AI 工单'
  }
}

const SECTION_HEADERS = ['风险预检', '工具准备', '检修步骤', '验收标准']

function parseTicketSteps(raw: unknown): SopStep[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.map((s: any, i: number) => ({
      id: 's' + (i + 1),
      index: i + 1,
      name: s.name || s.title || SECTION_HEADERS[i] || `步骤 ${i + 1}`,
      desc: typeof s === 'string' ? s : (s.desc || s.description || s.content || JSON.stringify(s)),
      estMinutes: Number(s.estMinutes || s.minutes || 15),
      hazardous: s.hazardous,
      safetyNote: s.safetyNote || s.safety_note,
      tools: s.tools || [],
      toolItems: s.toolItems || s.tool_items,
      materials: s.materials || [],
      manualRef: s.manualRef || s.ref,
      acceptance: s.acceptance,
      checkPoints: s.checkPoints || s.checks || []
    }))
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parseTicketSteps(parsed)
    } catch { /* not JSON */ }

    const segments: { name: string; body: string }[] = []
    const headerRe = new RegExp(`(?:【|\\[|\\d+[\\.、])?\\s*(${SECTION_HEADERS.join('|')})\\s*(?:】|\\])?[:：\\s]*`, 'g')
    let lastIdx = 0
    let lastName = ''
    let m: RegExpExecArray | null
    while ((m = headerRe.exec(trimmed))) {
      if (lastName) segments.push({ name: lastName, body: trimmed.slice(lastIdx, m.index).trim() })
      lastName = m[1]
      lastIdx = headerRe.lastIndex
    }
    if (lastName) segments.push({ name: lastName, body: trimmed.slice(lastIdx).trim() })

    if (segments.length) {
      return segments.map((seg, i) => ({
        id: 's' + (i + 1),
        index: i + 1,
        name: seg.name,
        desc: seg.body || '（暂无内容）',
        estMinutes: 15,
        hazardous: seg.name === '风险预检',
        tools: [],
        materials: [],
        checkPoints: seg.body
          .split(/\n|[；;]/)
          .map(s => s.replace(/^[\s\-•·\d\.、]+/, '').trim())
          .filter(s => s.length >= 4)
          .slice(0, 5)
      }))
    }

    return [{
      id: 's1', index: 1, name: 'AI 生成的检修方案',
      desc: trimmed, estMinutes: 30,
      tools: [], materials: [],
      checkPoints: ['人工复核 AI 输出', '按方案完成检修', '记录处理结果']
    }]
  }

  if (typeof raw === 'object') {
    const r = raw as any
    if (typeof r.raw === 'string') return parseTicketSteps(r.raw)
    if (Array.isArray(r.steps)) return parseTicketSteps(r.steps)
  }
  return []
}

function ticketToFlow(t: TicketDetail): SopFlow {
  return {
    id: 't-' + t.id,
    name: t.fault || `工单 #${t.id}`,
    deviceModel: t.device || '未指定',
    level: 2,
    steps: parseTicketSteps(t.steps)
  }
}

/** 列表返回包：UI 据此判断"真实空" vs "离线模式"。 */
export interface FlowsResult {
  items: WorkItem[]
  /** true = 后端不可达，items 为示例 mock；false = 真实数据（可能为空数组） */
  offline: boolean
}

/**
 * 列表加载策略（FIX2/FIX3）：
 * - 后端可用 → 仅展示真实工单
 * - 后端不可用 → 退回 1 条示例 mock + offline=true
 */
export const listFlows = async (): Promise<FlowsResult> => {
  try {
    const tickets = await listTickets()
    return { items: tickets.map(ticketToWorkItem), offline: false }
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[workflow.listFlows] backend unavailable, fallback to demo:', e)
    return { items: MOCK_LIST.slice(0, 1), offline: true }
  }
}

/**
 * 详情：t- 前缀走真实工单接口；其它一律视为示例 demo。
 * 真实工单失败时给一个占位 SopFlow，避免 UI 卡死。
 */
export const getFlow = async (id?: string): Promise<SopFlow> => {
  if (id && id.startsWith('t-')) {
    const tid = id.slice(2)
    const detail = await getTicket(tid)
    if (detail) return ticketToFlow(detail)
    return {
      id, name: '工单加载失败', deviceModel: '—', level: 2,
      steps: [{ id: 's1', index: 1, name: '加载失败', desc: '无法获取工单详情，请稍后重试。', estMinutes: 0, checkPoints: [] }]
    }
  }
  // 示例工单 fallback —— 仅一条
  return {
    id: id || 'sop-demo',
    name: '示例·热轧主电机异响二级检修',
    deviceModel: 'YKK630-4',
    level: 2,
    steps: [
      { id: 's1', index: 1, name: '设备停机与挂牌锁定 (LOTO)',
        desc: '断开主电源,挂检修牌,装锁具,确认无电压。',
        estMinutes: 8, hazardous: true, manualRef: '安全规程 §2.1',
        checkPoints: ['已断开主电源开关', '已挂检修牌并装锁', '验电确认无电压'] },
      { id: 's2', index: 2, name: '冷却与降温',
        desc: '等待电机自然冷却至 40℃ 以下,严禁强制降温。',
        estMinutes: 30, manualRef: '检修手册 §4.1',
        checkPoints: ['电机外壳温度 ≤ 40℃'] }
    ]
  }
}

export const reportStep = (flowId: string, stepId: string, payload: object) =>
  safeCall(() => post('/workflow/step', { flowId, stepId, ...payload }), { ok: true })

export const submitReport = (payload: object) =>
  safeCall(() => post('/workflow/report', payload), { reportId: 'R-' + Date.now() })

/* ============================================================
 *  FIX3 第 4 项：工具清单 + 关联手册（真实接口，不回退到假数据）
 * ============================================================ */

export interface ManualRef {
  docId: string
  title: string
  matchedSection?: string
  score: number
}

/**
 * 拉取工单关联的工具清单（GET /api/workflow/{id}/tools）
 * - 接口未实现时返回空数组（UI 显示"暂未提供工具清单"）
 */
export const getWorkflowTools = async (id: string): Promise<ToolItem[]> => {
  // sop-demo 等本地示例没有真实工单 ID
  if (!id || !id.startsWith('t-')) return []
  const tid = id.slice(2)
  return rawCall<ToolItem[]>(() =>
    request.get<ToolItem[]>(`/workflow/${tid}/tools`), []
  )
}

/**
 * 拉取关联手册（GET /api/workflow/{id}/manuals）
 * - 接口未实现 / 无匹配时返回空（UI 显示"暂未关联到任何手册"）
 */
export const getWorkflowManuals = async (id: string): Promise<ManualRef[]> => {
  if (!id || !id.startsWith('t-')) return []
  const tid = id.slice(2)
  return rawCall<ManualRef[]>(() =>
    request.get<ManualRef[]>(`/workflow/${tid}/manuals`), []
  )
}

/** 重新导出，方便页面直接调用创建 / 完成工单 */
export { createTicket, updateTicketStatus, completeTicket } from './ticket'

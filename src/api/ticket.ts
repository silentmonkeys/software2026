import { request, rawCall } from './request'

/**
 * 工单状态（FIX3 第 8 项）
 * - 仅保留 `pending` / `done` 两种语义；后端若返回 `open` / `doing` 等，统一映射到 `pending`
 * - 旧 `doing`（检修中）已废弃
 */
export type TicketStatus = 'pending' | 'done'

/** 后端可能返回的旧状态字面量，仅用于反向映射 */
type RawTicketStatus = 'open' | 'doing' | 'done' | 'pending' | string

export const normalizeStatus = (s: RawTicketStatus | undefined): TicketStatus =>
  s === 'done' ? 'done' : 'pending'

/** 列表项（GET /api/ticket 返回每条的字段） */
export interface TicketSummary {
  id: number
  device: string
  fault: string
  status: TicketStatus
}

/** 详情（GET /api/ticket/{id} 返回） */
export interface TicketDetail extends TicketSummary {
  steps: { raw: string } | Record<string, unknown> | null
  created_at: string
}

/** 创建工单返回（POST /api/ticket） */
export interface TicketCreateResult {
  id: number
  steps: { raw: string } | Record<string, unknown> | null
}

export const createTicket = (body: { device: string; fault: string }) =>
  rawCall<TicketCreateResult>(() => request.post<TicketCreateResult>('/ticket', body, {
    timeout: 60_000
  }))

/**
 * 拉取真实工单列表，并把 status 映射到 `pending` / `done`。
 */
export const listTickets = async (): Promise<TicketSummary[]> => {
  const raw = await rawCall<Array<TicketSummary & { status: RawTicketStatus }>>(() =>
    request.get<TicketSummary[]>('/ticket')
  )
  return (raw || []).map(t => ({ ...t, status: normalizeStatus(t.status) }))
}

export const getTicket = async (id: number | string): Promise<TicketDetail | null> => {
  const raw = await rawCall<(TicketDetail & { status: RawTicketStatus }) | null>(() =>
    request.get<TicketDetail>(`/ticket/${id}`), null
  )
  if (!raw) return null
  return { ...raw, status: normalizeStatus(raw.status) }
}

/**
 * 更新状态：前端只允许 `pending` / `done`。
 * 后端如果不识别 `pending`，退回到 `open`（同义）。
 */
export const updateTicketStatus = (id: number | string, status: TicketStatus) =>
  rawCall<{ ok: boolean; status: TicketStatus }>(() =>
    request.patch<{ ok: boolean; status: TicketStatus }>(`/ticket/${id}`, {
      status: status === 'done' ? 'done' : 'open'
    })
  , { ok: false, status })

/** 完成工单：FIX3 第 8.3 项 */
export const completeTicket = (id: number | string) => updateTicketStatus(id, 'done')

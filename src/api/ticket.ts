import { request, rawCall } from './request'

export type TicketStatus = 'open' | 'doing' | 'done'

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
    timeout: 60_000   // 工单创建会同步调用大模型生成步骤
  }))

/**
 * 拉取真实工单列表。
 * 不再吞掉错误：401/网络异常会向上抛出，由调用方决定降级策略
 * （列表页用这个区分"真实空"和"后端不可达"）。
 */
export const listTickets = () =>
  rawCall<TicketSummary[]>(() => request.get<TicketSummary[]>('/ticket'))

export const getTicket = (id: number | string) =>
  rawCall<TicketDetail | null>(() => request.get<TicketDetail>(`/ticket/${id}`), null)

export const updateTicketStatus = (id: number | string, status: TicketStatus) =>
  rawCall<{ ok: boolean; status: TicketStatus }>(() =>
    request.patch<{ ok: boolean; status: TicketStatus }>(`/ticket/${id}`, { status })
  , { ok: false, status })

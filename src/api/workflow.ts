import { post, safeCall } from './request'
import { listTickets, getTicket, type TicketSummary, type TicketDetail, type TicketStatus } from './ticket'

export interface SopStep {
  id: string
  name: string
  desc: string
  estMinutes: number
  hazardous?: boolean
  tools?: string[]
  materials?: string[]
  manualRef?: string
  checkPoints: string[]
}

export interface SopFlow {
  id: string
  name: string
  deviceModel: string
  level: 1 | 2 | 3
  steps: SopStep[]
}

export interface WorkItem {
  id: string
  name: string
  deviceModel: string
  difficulty: '初级' | '中级' | '高级'
  estimatedMinutes: number
  status: '未开始' | '进行中' | '已完成'
  level: 1 | 2 | 3
  hazardous?: boolean
  updatedAt: number
  workshop?: string
}

const FALLBACK_FLOW: SopFlow = {
  id: 'sop-001',
  name: '热轧主电机异响二级检修',
  deviceModel: 'YKK630-4',
  level: 2,
  steps: [
    { id: 's1', name: '设备停机与挂牌锁定 (LOTO)', desc: '断开主电源,挂检修牌,装锁具,确认无电压。',
      estMinutes: 8, hazardous: true,
      tools: ['挂牌', '锁具', '验电笔'], materials: [], manualRef: '安全规程 §2.1',
      checkPoints: ['已断开主电源开关', '已挂检修牌并装锁', '验电确认无电压'] },
    { id: 's2', name: '冷却与降温', desc: '等待电机自然冷却至 40℃ 以下,严禁强制降温。',
      estMinutes: 30,
      tools: ['红外测温仪'], materials: [], manualRef: '检修手册 §4.1',
      checkPoints: ['电机外壳温度 ≤ 40℃'] },
    { id: 's3', name: '驱动端轴承拆解检查', desc: '使用专用拉马拆下驱动端端盖,目视检查滚动体与保持架。',
      estMinutes: 45, hazardous: true,
      tools: ['液压拉马', '内六角扳手套装', '丝堵螺栓'], materials: ['密封圈 ×2'], manualRef: '检修手册 §4.3.2',
      checkPoints: ['端盖螺栓按对角顺序拆卸', '保持架完整无变形', '滚动体表面无点蚀剥落'] },
    { id: 's4', name: '清洗与润滑脂更换', desc: '彻底清洗轴承腔,填充新润滑脂,容量 1/3 — 1/2。',
      estMinutes: 25,
      tools: ['清洗喷枪', '注脂枪'], materials: ['Mobil Polyrex EM 润滑脂 ×500g', '无水煤油'],
      manualRef: '检修手册 §4.3.4',
      checkPoints: ['轴承腔无残留杂质', '润滑脂填充量 1/3 — 1/2'] },
    { id: 's5', name: '装复与试运行', desc: '反向装复,通电试运行 10 分钟,记录振动与温度。',
      estMinutes: 20,
      tools: ['振动测试仪', '红外测温仪'], materials: [], manualRef: '检修手册 §4.5',
      checkPoints: ['空载振动速度 ≤ 4.5mm/s', '驱动端温升 ≤ 40K', '无异响'] }
  ]
}

const FLOW_002: SopFlow = {
  id: 'sop-002',
  name: '冷却塔风机轴承更换一级常规检修',
  deviceModel: 'CT-1500',
  level: 1,
  steps: [
    { id: 's1', name: '风机停机锁定', desc: '断开变频器电源,确认转子静止后挂牌锁定。',
      estMinutes: 5, hazardous: true,
      tools: ['挂牌', '锁具'], materials: [], manualRef: '安全规程 §1.4',
      checkPoints: ['变频器已断电', '叶片完全静止', '挂牌锁具齐全'] },
    { id: 's2', name: '叶轮拆卸', desc: '使用吊装设备拆除叶轮,做好对中标记。',
      estMinutes: 25, tools: ['吊装带', '记号笔', '套筒扳手'], materials: [], manualRef: '检修手册 §3.1',
      checkPoints: ['对中位置已标记', '叶轮无碰撞损伤'] },
    { id: 's3', name: '更换轴承', desc: '更换 SKF 6314-2RS 轴承,清洗轴承座。',
      estMinutes: 35, tools: ['液压拉马', '感应加热器'], materials: ['SKF 6314-2RS ×2'], manualRef: '检修手册 §3.2',
      checkPoints: ['新轴承编号正确', '加热温度 ≤ 110℃'] },
    { id: 's4', name: '动平衡校验', desc: '装回叶轮后做现场动平衡校验。',
      estMinutes: 20, tools: ['动平衡仪'], materials: ['平衡块若干'], manualRef: '检修手册 §3.4',
      checkPoints: ['残余不平衡 ≤ G2.5'] }
  ]
}

const FLOW_003: SopFlow = {
  id: 'sop-003',
  name: '液压站系统压力波动三级紧急检修',
  deviceModel: 'PRESS-500',
  level: 3,
  steps: [
    { id: 's1', name: '紧急泄压', desc: '关闭主泵后通过手动泄压阀缓慢释放系统压力。',
      estMinutes: 5, hazardous: true,
      tools: ['手动泄压阀'], materials: [], manualRef: '应急规程 §5.1',
      checkPoints: ['压力表归零', '管路无残压'] },
    { id: 's2', name: '溢流阀检查', desc: '拆下主溢流阀,检查阀芯磨损情况。',
      estMinutes: 20, tools: ['内六角', '游标卡尺'], materials: ['密封圈套件'], manualRef: '检修手册 §6.2',
      checkPoints: ['阀芯无明显磨损', '密封圈完好'] },
    { id: 's3', name: '油液取样化验', desc: '取主油箱油样,检测污染度等级(NAS)。',
      estMinutes: 15, tools: ['取样瓶'], materials: [], manualRef: '油液标准 §2',
      checkPoints: ['NAS 等级 ≤ 8'] },
    { id: 's4', name: '系统试压', desc: '依次启动主泵,逐级加压并记录压力波动。',
      estMinutes: 30, hazardous: true,
      tools: ['压力表', '记录仪'], materials: [], manualRef: '检修手册 §6.5',
      checkPoints: ['额定压力波动 ≤ ±0.5MPa', '无外泄漏'] }
  ]
}

const FLOWS: Record<string, SopFlow> = {
  'sop-001': FALLBACK_FLOW,
  'sop-002': FLOW_002,
  'sop-003': FLOW_003,
  'sop-demo': FALLBACK_FLOW
}

/** Mock 作业列表（演示态保留） */
/**
 * 离线兜底用的示例工单。仅当后端不可达时展示，并由 UI 标注"示例·离线模式"。
 * （FIX2 第 2.2 项：删掉虚构测试条目，只保留 1 条带"示例"标记的兜底数据）
 */
const MOCK_LIST: WorkItem[] = [
  { id: 'sop-demo', name: '示例·热轧主电机异响二级检修', deviceModel: 'YKK630-4', difficulty: '中级', estimatedMinutes: 128, status: '进行中', level: 2, hazardous: true, updatedAt: Date.now() - 30 * 60_000, workshop: '一号车间·热轧线' }
]

const TICKET_STATUS_MAP: Record<TicketStatus, WorkItem['status']> = {
  open: '未开始',
  doing: '进行中',
  done: '已完成'
}

/** 真实工单 → WorkItem（缺失字段用合理默认补齐，方便沿用现有 UI） */
function ticketToWorkItem(t: TicketSummary): WorkItem {
  return {
    id: 't-' + t.id,
    name: t.fault || `工单 #${t.id}`,
    deviceModel: t.device || '未指定',
    difficulty: '中级',
    estimatedMinutes: 60,
    status: TICKET_STATUS_MAP[t.status] || '未开始',
    level: 2,
    updatedAt: Date.now(),
    workshop: 'AI 工单'
  }
}

const SECTION_HEADERS = ['风险预检', '工具准备', '检修步骤', '验收标准']

/** 把后端 raw 文本拆成尽可能合理的 SopStep 数组 */
function parseTicketSteps(raw: unknown): SopStep[] {
  if (!raw) return []
  // 1) 如果直接是数组
  if (Array.isArray(raw)) {
    return raw.map((s: any, i: number) => ({
      id: 's' + (i + 1),
      name: s.name || s.title || SECTION_HEADERS[i] || `步骤 ${i + 1}`,
      desc: typeof s === 'string' ? s : (s.desc || s.description || s.content || JSON.stringify(s)),
      estMinutes: Number(s.estMinutes || s.minutes || 15),
      tools: s.tools || [],
      materials: s.materials || [],
      manualRef: s.manualRef || s.ref,
      checkPoints: s.checkPoints || s.checks || []
    }))
  }

  // 2) raw 是字符串 —— 先尝试 JSON 解析
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parseTicketSteps(parsed)
    } catch { /* 不是 JSON 就继续按文本切分 */ }

    // 3) 按四段表头切分
    const segments: { name: string; body: string }[] = []
    const headerRe = new RegExp(`(?:【|\\[|\\d+[\\.、])?\\s*(${SECTION_HEADERS.join('|')})\\s*(?:】|\\])?[:：\\s]*`, 'g')
    let lastIdx = 0
    let lastName = ''
    let m: RegExpExecArray | null
    while ((m = headerRe.exec(trimmed))) {
      if (lastName) {
        segments.push({ name: lastName, body: trimmed.slice(lastIdx, m.index).trim() })
      }
      lastName = m[1]
      lastIdx = headerRe.lastIndex
    }
    if (lastName) segments.push({ name: lastName, body: trimmed.slice(lastIdx).trim() })

    if (segments.length) {
      return segments.map((seg, i) => ({
        id: 's' + (i + 1),
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

    // 4) 无法切分时整体作为一步
    return [{
      id: 's1', name: 'AI 生成的检修方案',
      desc: trimmed, estMinutes: 30,
      tools: [], materials: [],
      checkPoints: ['人工复核 AI 输出', '按方案完成检修', '记录处理结果']
    }]
  }

  // 5) 对象（含 raw 字段或其他形态）
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
 * 列表加载策略（FIX2 第 2 项）：
 * - 后端可用且有工单 → 仅展示真实工单
 * - 后端可用但无工单 → 真实空数组 + offline=false（UI 自行展示空态）
 * - 后端不可用（网络/401） → 退回 1 条示例 mock + offline=true
 *
 * 不再混合展示 mock 与真实数据。
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
 * 详情：t- 前缀走真实工单接口，其它走本地 mock。
 * 真实工单失败时给一个占位 SopFlow，避免 UI 卡死。
 */
export const getFlow = async (id?: string): Promise<SopFlow> => {
  if (id && id.startsWith('t-')) {
    const tid = id.slice(2)
    const detail = await getTicket(tid)
    if (detail) return ticketToFlow(detail)
    return {
      id, name: '工单加载失败', deviceModel: '—', level: 2,
      steps: [{ id: 's1', name: '加载失败', desc: '无法获取工单详情，请稍后重试。', estMinutes: 0, checkPoints: [] }]
    }
  }
  return FLOWS[id || 'sop-001'] || FALLBACK_FLOW
}

export const reportStep = (flowId: string, stepId: string, payload: object) =>
  safeCall(() => post('/workflow/step', { flowId, stepId, ...payload }), { ok: true })

export const submitReport = (payload: object) =>
  safeCall(() => post('/workflow/report', payload), { reportId: 'R-' + Date.now() })

/** 重新导出，方便页面直接调用创建工单 */
export { createTicket, updateTicketStatus } from './ticket'

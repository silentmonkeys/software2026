import { get, post, safeCall } from './request'

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
  'sop-003': FLOW_003
}

/** Mock 作业列表 */
const MOCK_LIST: WorkItem[] = [
  { id: 'sop-001', name: '热轧主电机异响二级检修', deviceModel: 'YKK630-4',  difficulty: '中级', estimatedMinutes: 128, status: '进行中', level: 2, hazardous: true, updatedAt: Date.now() - 30 * 60_000, workshop: '一号车间·热轧线' },
  { id: 'sop-002', name: '冷却塔风机轴承更换',     deviceModel: 'CT-1500',   difficulty: '初级', estimatedMinutes: 85,  status: '未开始', level: 1, updatedAt: Date.now() - 2 * 3600_000, workshop: '动力车间' },
  { id: 'sop-003', name: '液压站系统压力波动检修', deviceModel: 'PRESS-500', difficulty: '高级', estimatedMinutes: 70,  status: '未开始', level: 3, hazardous: true, updatedAt: Date.now() - 4 * 3600_000, workshop: '冲压车间' },
  { id: 'sop-004', name: '空压机出口温度异常排查', deviceModel: 'AC-220',    difficulty: '中级', estimatedMinutes: 60,  status: '未开始', level: 2, updatedAt: Date.now() - 1 * 86400_000, workshop: '动力车间' },
  { id: 'sop-005', name: '行车制动器年度检修',     deviceModel: 'CRANE-50T', difficulty: '高级', estimatedMinutes: 180, status: '已完成', level: 2, hazardous: true, updatedAt: Date.now() - 2 * 86400_000, workshop: '装配车间' },
  { id: 'sop-006', name: '减速机润滑油更换',       deviceModel: 'GR-160',    difficulty: '初级', estimatedMinutes: 40,  status: '已完成', level: 1, updatedAt: Date.now() - 3 * 86400_000, workshop: '一号车间' }
]

export const listFlows = () =>
  safeCall<WorkItem[]>(() => get('/workflow/list'), MOCK_LIST)

export const getFlow = (id?: string) =>
  safeCall<SopFlow>(() => get('/workflow/flow', { id }), FLOWS[id || 'sop-001'] || FALLBACK_FLOW)

export const reportStep = (flowId: string, stepId: string, payload: object) =>
  safeCall(() => post('/workflow/step', { flowId, stepId, ...payload }), { ok: true })

export const submitReport = (payload: object) =>
  safeCall(() => post('/workflow/report', payload), { reportId: 'R-' + Date.now() })

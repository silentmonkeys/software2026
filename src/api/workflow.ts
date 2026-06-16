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

export const getFlow = (id?: string) =>
  safeCall<SopFlow>(() => get('/workflow/flow', { id }), FALLBACK_FLOW)

export const reportStep = (flowId: string, stepId: string, payload: object) =>
  safeCall(() => post('/workflow/step', { flowId, stepId, ...payload }), { ok: true })

export const submitReport = (payload: object) =>
  safeCall(() => post('/workflow/report', payload), { reportId: 'R-' + Date.now() })

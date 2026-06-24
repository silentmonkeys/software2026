<script setup lang="ts">
/**
 * 知识图谱 · PC（FIX3 第 5 项 / FIX6 第 6 项 + 第 8 项）
 * - 数据来源：已审入库的文档 → /api/kg/graph?doc_ids=...
 * - 严禁硬编码 mock 节点；图谱为空时显示空态
 * - 节点详情面板拉取真实原文片段（GET /api/kb/{docId}/chunk/{chunkId}）
 * - FIX6 第 6 项：审查员/管理员对节点 label/desc 做修正、删除节点或边
 * - FIX6 第 8 项：节点弹窗展示 source_docs 关联文档；侧栏支持按文档筛选
 */
import { ref, onMounted, onActivated, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import {
  getGraph, getChunk, updateNode, deleteNode, updateEdge, deleteEdge,
  type KGGraph, type KGNode, type KGType, type ChunkContent, type KGEdge
} from '@/api/kg'
import { listDocs, type KbDoc, isApprovedStatus } from '@/api/kb'
import { useUserStore } from '@/stores/user'
import { showToast, showFailToast, showConfirmDialog } from 'vant'
import { Search, RotateCcw, Download, Box, ExternalLink, Loader, AlertTriangle, Edit3, Trash2, FileText } from 'lucide-vue-next'
import * as echarts from 'echarts/core'
import { GraphChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([GraphChart, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer])

const router = useRouter()
const userStore = useUserStore()
const canEdit = computed(() => userStore.isAuditor)   // auditor 或 admin

const graph = ref<KGGraph | null>(null)
const loading = ref(false)
const errorMsg = ref('')
const selected = ref<KGNode | null>(null)
const selectedEdge = ref<KGEdge | null>(null)
const chunkLoading = ref(false)
const chunk = ref<ChunkContent | null>(null)

// FIX6-resume O1：实体过滤组 + 文档类型过滤组，两个独立的多选过滤器，都影响图谱节点
type EntityType = 'device' | 'part' | 'fault' | 'method'
type DocType = 'case' | 'manual'
const filterEntity = ref<'all' | EntityType>('all')
const filterDocType = ref<'all' | DocType>('all')
const filterDocId = ref<number | undefined>(undefined)   // FIX6 第 8 项：按文档筛选
const docOptions = ref<KbDoc[]>([])
const q = ref('')
const chartRef = ref<HTMLDivElement>()
let inst: echarts.ECharts | null = null

// FIX6 第 6 项：编辑对话框状态
const showEditNode = ref(false)
const editNodeLabel = ref('')
const editNodeDesc = ref('')
const showEditEdge = ref(false)
const editEdgeRel = ref('')

const TYPE_META: Record<KGType, { name: string; color: string; symbol: string }> = {
  device: { name: '设备', color: '#0B2545', symbol: 'roundRect' },
  part:   { name: '部件', color: '#00B7C2', symbol: 'circle' },
  fault:  { name: '故障', color: '#F26B1F', symbol: 'diamond' },
  method: { name: '处理', color: '#2E7D32', symbol: 'triangle' },
  case:   { name: '案例', color: '#15315F', symbol: 'rect' },
  manual: { name: '手册', color: '#94A3B8', symbol: 'pin' }
}

const CATEGORIES = (Object.keys(TYPE_META) as KGType[]).map(k => ({
  name: TYPE_META[k].name,
  itemStyle: { color: TYPE_META[k].color }
}))

const filteredNodes = computed(() => {
  if (!graph.value) return []
  const ENTITY_SET: KGType[] = ['device', 'part', 'fault', 'method']
  const DOC_SET: KGType[] = ['case', 'manual']
  return graph.value.nodes.filter(n => {
    // 实体组：'all' 时放行所有 4 类实体 + 不过滤文档；指定类型时只放行匹配的实体节点
    const entityOk = (() => {
      if (n.type === 'case' || n.type === 'manual') return true  // 文档类节点由第二组判定
      if (filterEntity.value === 'all') return ENTITY_SET.includes(n.type)
      return n.type === filterEntity.value
    })()
    // 文档组：'all' 时放行 case+manual；指定时只放对应类型
    const docOk = (() => {
      if (n.type !== 'case' && n.type !== 'manual') return true  // 实体节点由第一组判定
      if (filterDocType.value === 'all') return DOC_SET.includes(n.type)
      return n.type === filterDocType.value
    })()
    return entityOk && docOk && (!q.value || n.label.includes(q.value))
  })
})

const visibleEdges = computed(() => {
  if (!graph.value) return []
  const ids = new Set(filteredNodes.value.map(n => n.id))
  return graph.value.edges.filter(e => ids.has(e.source) && ids.has(e.target))
})

const renderChart = () => {
  if (!inst || !graph.value) return
  const cats = (Object.keys(TYPE_META) as KGType[])
  const isLarge = filteredNodes.value.length > 200

  // 简洁优先：节点小一点，标签一直显示，hover 不弹任何东西
  const nodes = filteredNodes.value.map((n) => {
    const baseSize = 18 + Math.min(n.weight * 1.0, 12)
    const truncLabel = n.label.length > 10 ? n.label.slice(0, 10) + '…' : n.label
    return {
      id: n.id,
      name: n.label,
      value: n.weight,
      symbolSize: baseSize,
      symbol: TYPE_META[n.type].symbol,
      category: cats.indexOf(n.type),
      itemStyle: {
        color: TYPE_META[n.type].color,
        opacity: 1,
        borderColor: '#fff',
        borderWidth: 1.5
      },
      label: {
        show: !isLarge,
        formatter: truncLabel,
        position: 'bottom',
        color: '#374151',
        fontSize: 11,
        distance: 4
      },
      raw: n
    }
  })
  const links = visibleEdges.value.map(e => ({
    source: e.source,
    target: e.target,
    value: e.rel,
    label: { show: false },
    lineStyle: {
      color: '#E5E7EB',
      curveness: 0,
      opacity: 0.6,
      width: 1
    },
    tooltip: { show: false },
    // 边不做高亮动画，避免随便扫过都"闪一下"
    emphasis: { disabled: true },
    raw: e
  }))
  inst.setOption({
    // 关键：关闭所有动画。force 也一次性稳定，避免节点抖动+边闪烁
    animation: false,
    // 全局 tooltip 直接关掉。详情走右侧面板，鼠标过去什么都不弹
    tooltip: { show: false },
    legend: [{
      data: CATEGORIES.map(c => c.name),
      bottom: 12,
      icon: 'circle',
      itemGap: 16,
      textStyle: { fontSize: 12 }
    }],
    series: [{
      type: 'graph',
      layout: 'force',
      data: nodes,
      links,
      categories: CATEGORIES,
      roam: true,
      draggable: true,
      large: isLarge,
      // 关闭"鼠标移到节点上整张图调暗其他"的动效，这就是闪烁的元凶
      focusNodeAdjacency: false,
      force: {
        repulsion: 500,
        edgeLength: [100, 160],
        gravity: 0.08,
        friction: 0.6,
        layoutAnimation: false,   // ← 直接一次性算好位置，不再持续抖
        initLayout: 'circular'
      },
      // emphasis 只在"点击选中"后生效，hover 不触发
      selectedMode: 'single',
      select: {
        itemStyle: { borderColor: '#F26B1F', borderWidth: 3 },
        label: { fontWeight: 700, color: '#0B2545' }
      },
      // 关键：把 emphasis 改成"无视觉变化"，避免 hover 全图闪
      emphasis: {
        disabled: true
      },
      labelLayout: { hideOverlap: true },
      lineStyle: { width: 1, opacity: 0.6, curveness: 0 }
    }]
  }, { notMerge: true })
}

const setup = () => {
  if (!chartRef.value) return
  const reused = echarts.getInstanceByDom(chartRef.value)
  inst = reused || echarts.init(chartRef.value)
  inst.off('click')
  inst.on('click', (p: any) => {
    if (p.dataType === 'node') {
      const n = p.data.raw as KGNode
      selected.value = n
      selectedEdge.value = null
      chunk.value = null
      if (n.docId && n.chunkId) {
        chunkLoading.value = true
        getChunk(n.docId, n.chunkId)
          .then(c => { chunk.value = c })
          .finally(() => { chunkLoading.value = false })
      }
    } else if (p.dataType === 'edge') {
      const e = p.data.raw as KGEdge
      selectedEdge.value = e
      selected.value = null
    }
  })
  renderChart()
}

const resetView = () => {
  filterEntity.value = 'all'
  filterDocType.value = 'all'
  filterDocId.value = undefined
  q.value = ''
  selected.value = null
  selectedEdge.value = null
  chunk.value = null
  reload()
}

const exportImg = () => {
  if (!inst) return
  const url = inst.getDataURL({ pixelRatio: 2, backgroundColor: '#fff' })
  const a = document.createElement('a')
  a.href = url
  a.download = `知识图谱-${Date.now()}.png`
  a.click()
}

const reload = async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    const g = await getGraph(undefined, filterDocId.value)
    graph.value = g
    if (!g.nodes.length) {
      errorMsg.value = filterDocId.value
        ? '所选文档暂无可视化的图谱实体。'
        : '暂无可视化的图谱数据。请先在「知识上传」补充已审通过的文档，或确认后端 /api/kg/graph 已实现。'
    }
  } catch (e: any) {
    graph.value = { nodes: [], edges: [] }
    errorMsg.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
  await nextTick()
  setup()
}

const loadDocOptions = async () => {
  try {
    const docs = await listDocs()
    docOptions.value = docs.filter(d => isApprovedStatus(d.status))
  } catch {
    docOptions.value = []
  }
}

onMounted(async () => {
  await loadDocOptions()
  await reload()
  window.addEventListener('resize', () => inst?.resize())
})

// keep-alive 激活时（从其它路由切回）重新 resize，避免容器尺寸变化导致图谱错位
onActivated(() => {
  nextTick(() => inst?.resize())
})

watch([filterEntity, filterDocType, q], () => renderChart())
watch(filterDocId, () => reload())

// ============ FIX6 第 6 项：编辑节点 / 删除节点 ============
const openEditNode = () => {
  if (!selected.value) return
  editNodeLabel.value = selected.value.label
  editNodeDesc.value = selected.value.desc || ''
  showEditNode.value = true
}

const submitEditNode = async () => {
  if (!selected.value) return
  try {
    await updateNode(selected.value.id, {
      label: editNodeLabel.value,
      desc: editNodeDesc.value
    })
    showToast({ type: 'success', message: '已更新节点' })
    showEditNode.value = false
    await reload()
  } catch {
    showFailToast('节点更新失败')
  }
}

const removeNode = async () => {
  if (!selected.value) return
  try {
    await showConfirmDialog({
      title: '删除节点',
      confirmButtonText: '删除',
      confirmButtonColor: '#E5484D',
      message: `确认从图谱中移除节点「${selected.value.label}」？仅图谱视图受影响，原始文档不变。`
    })
  } catch { return }
  try {
    await deleteNode(selected.value.id)
    showToast({ type: 'success', message: '已删除节点' })
    selected.value = null
    await reload()
  } catch {
    showFailToast('节点删除失败')
  }
}

// ============ FIX6 第 6 项：编辑边 / 删除边 ============
const edgeKey = (e: KGEdge) => {
  const a = e.source, b = e.target
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

const openEditEdge = () => {
  if (!selectedEdge.value) return
  editEdgeRel.value = selectedEdge.value.rel
  showEditEdge.value = true
}

const submitEditEdge = async () => {
  if (!selectedEdge.value) return
  try {
    await updateEdge(edgeKey(selectedEdge.value), { rel: editEdgeRel.value })
    showToast({ type: 'success', message: '已更新关系' })
    showEditEdge.value = false
    await reload()
  } catch {
    showFailToast('关系更新失败')
  }
}

const removeEdge = async () => {
  if (!selectedEdge.value) return
  try {
    await showConfirmDialog({
      title: '删除关系',
      confirmButtonText: '删除',
      confirmButtonColor: '#E5484D',
      message: `确认从图谱中移除关系「${selectedEdge.value.rel}」？仅图谱视图受影响。`
    })
  } catch { return }
  try {
    await deleteEdge(edgeKey(selectedEdge.value))
    showToast({ type: 'success', message: '已删除关系' })
    selectedEdge.value = null
    await reload()
  } catch {
    showFailToast('关系删除失败')
  }
}
</script>

<template>
  <div class="h-full flex flex-col">
    <header class="flex-shrink-0 px-6 py-3 bg-card border-b border-border flex items-center gap-3 flex-wrap">
      <div class="relative flex-1 max-w-md">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-2" />
        <input v-model="q" placeholder="搜索实体名称…"
               class="w-full h-9 pl-10 pr-3 rounded-btn border border-border bg-bg outline-none focus:border-accent" />
      </div>
      <!-- FIX6-resume O1：实体类型组 -->
      <div class="flex p-0.5 bg-bg rounded-btn border border-border text-xs">
        <button v-for="t in [
                  { k: 'all',    l: '全部' },
                  { k: 'device', l: '设备' },
                  { k: 'part',   l: '部件' },
                  { k: 'fault',  l: '故障' },
                  { k: 'method', l: '处理' }
                ]"
                :key="t.k" @click="filterEntity = t.k as any"
                :class="['px-3 h-7 rounded font-medium', filterEntity === t.k ? 'bg-card shadow-card text-accent' : 'text-text-2']">
          {{ t.l }}
        </button>
      </div>
      <!-- FIX6-resume O1：文档类型组（独立过滤器） -->
      <div class="flex p-0.5 bg-bg rounded-btn border border-border text-xs">
        <button v-for="t in [
                  { k: 'all',    l: '全部' },
                  { k: 'case',   l: '案例' },
                  { k: 'manual', l: '手册' }
                ]"
                :key="t.k" @click="filterDocType = t.k as any"
                :class="['px-3 h-7 rounded font-medium', filterDocType === t.k ? 'bg-card shadow-card text-accent' : 'text-text-2']">
          {{ t.l }}
        </button>
      </div>
      <!-- FIX6 第 8 项：按文档筛选 -->
      <select v-model="filterDocId"
              class="h-9 px-2 rounded-btn border border-border bg-bg text-sm outline-none focus:border-accent">
        <option :value="undefined">全部文档</option>
        <option v-for="d in docOptions" :key="d.id" :value="d.id">#{{ d.id }} · {{ d.title }}</option>
      </select>
      <div class="ml-auto flex items-center gap-2">
        <button class="h-9 px-3 rounded-btn border border-border flex items-center gap-1 text-sm hover:bg-bg" @click="resetView" title="重置视图">
          <RotateCcw class="w-4 h-4" /> 重置
        </button>
        <button class="h-9 px-3 rounded-btn border border-border flex items-center gap-1 text-sm hover:bg-bg" @click="exportImg" title="导出图片">
          <Download class="w-4 h-4" /> 导出
        </button>
      </div>
    </header>

    <div class="flex-1 grid grid-cols-12 overflow-hidden">
      <main class="col-span-9 relative bg-bg overflow-hidden">
        <div ref="chartRef" class="w-full h-full"></div>

        <div v-if="loading"
             class="absolute inset-0 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
          <div class="text-text-2">
            <Loader class="w-8 h-8 mx-auto animate-spin text-accent" />
            <div class="mt-2 text-sm">加载图谱数据…</div>
          </div>
        </div>
        <div v-else-if="!graph?.nodes.length"
             class="absolute inset-0 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
          <div class="industrial-card p-8 text-center max-w-md">
            <AlertTriangle class="w-10 h-10 mx-auto text-warning opacity-70" />
            <div class="mt-3 text-sm font-semibold">暂无可视化的图谱数据</div>
            <div class="mt-2 text-xs text-text-2">{{ errorMsg }}</div>
          </div>
        </div>

        <div class="absolute top-3 left-3 industrial-card px-3 py-2 text-xs space-y-1">
          <div class="font-semibold mb-1">操作提示</div>
          <div class="text-text-2">· 拖拽 / 滚轮缩放</div>
          <div class="text-text-2">· 点击节点 / 边查看详情</div>
          <div v-if="canEdit" class="text-text-2">· 审查员可编辑 / 删除</div>
        </div>
      </main>

      <aside class="col-span-3 border-l border-border bg-card overflow-auto">
        <!-- 节点详情 -->
        <div v-if="selected" class="p-4">
          <div class="flex items-center justify-between gap-2">
            <div class="text-xs uppercase mono px-2 py-0.5 inline-block rounded text-white"
                 :style="{ background: TYPE_META[selected.type].color }">
              {{ TYPE_META[selected.type].name }}
            </div>
            <!-- FIX6 第 6 项：节点编辑操作 -->
            <div v-if="canEdit" class="flex items-center gap-1">
              <button class="h-7 w-7 rounded hover:bg-bg flex items-center justify-center text-text-2 hover:text-accent"
                      title="编辑节点" @click="openEditNode">
                <Edit3 class="w-3.5 h-3.5" />
              </button>
              <button class="h-7 w-7 rounded hover:bg-danger/10 flex items-center justify-center text-text-2 hover:text-danger"
                      title="删除节点" @click="removeNode">
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <h3 class="text-lg font-bold mt-2">{{ selected.label }}</h3>
          <div class="text-xs text-text-2 mt-1">关联 <span class="mono">{{ selected.weight }}</span> 条</div>
          <p v-if="selected.desc" class="text-sm mt-3 text-text-2 leading-relaxed">{{ selected.desc }}</p>

          <!-- FIX6 第 8 项：关联文档列表 -->
          <div class="mt-4">
            <div class="text-xs font-semibold mb-2 text-text">关联文档</div>
            <ul v-if="selected.source_docs?.length" class="space-y-1.5">
              <li v-for="sd in selected.source_docs" :key="sd.id">
                <button class="w-full text-left h-8 px-2 rounded-btn border border-border text-xs flex items-center gap-1.5 hover:border-accent hover:text-accent"
                        @click="router.push(`/kb/preview/${sd.id}`)">
                  <FileText class="w-3.5 h-3.5 flex-shrink-0" />
                  <span class="truncate">#{{ sd.id }} · {{ sd.title }}</span>
                </button>
              </li>
            </ul>
            <div v-else class="text-xs text-text-2 italic">暂无关联文档</div>
          </div>

          <div v-if="selected.docId" class="mt-4">
            <div class="text-xs font-semibold mb-2 text-text">原文片段</div>
            <div v-if="chunkLoading" class="text-xs text-text-2 flex items-center gap-1.5">
              <Loader class="w-3.5 h-3.5 animate-spin" /> 加载中…
            </div>
            <div v-else-if="chunk" class="bg-bg rounded-btn border border-border p-3 text-xs leading-relaxed text-text-2 max-h-72 overflow-auto">
              <div v-if="chunk.title" class="font-semibold text-text mb-1">{{ chunk.title }}</div>
              <div v-if="chunk.page" class="mono text-[10px] mb-1">页码 {{ chunk.page }}</div>
              <div class="whitespace-pre-wrap">{{ chunk.text }}</div>
            </div>
            <div v-else class="text-xs text-text-2 italic">
              后端未提供 /api/kb/{docId}/chunk/{chunkId} 或该节点无对应片段。
            </div>

            <button class="mt-3 w-full h-9 rounded-btn border border-border text-sm flex items-center justify-center gap-1 hover:border-accent hover:text-accent"
                    @click="router.push(`/kb/preview/${selected.docId}`)">
              <ExternalLink class="w-4 h-4" /> 跳到文档详情
            </button>
          </div>
        </div>

        <!-- 边详情 -->
        <div v-else-if="selectedEdge" class="p-4">
          <div class="flex items-center justify-between gap-2">
            <div class="text-xs px-2 py-0.5 inline-block rounded bg-bg border border-border">关系</div>
            <div v-if="canEdit" class="flex items-center gap-1">
              <button class="h-7 w-7 rounded hover:bg-bg flex items-center justify-center text-text-2 hover:text-accent"
                      title="编辑关系" @click="openEditEdge">
                <Edit3 class="w-3.5 h-3.5" />
              </button>
              <button class="h-7 w-7 rounded hover:bg-danger/10 flex items-center justify-center text-text-2 hover:text-danger"
                      title="删除关系" @click="removeEdge">
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <h3 class="text-lg font-bold mt-2">{{ selectedEdge.rel }}</h3>
          <div class="text-xs text-text-2 mt-1 break-all">{{ selectedEdge.source }} → {{ selectedEdge.target }}</div>
        </div>

        <div v-else class="text-center text-text-2 text-sm py-12 px-4">
          <Box class="w-10 h-10 mx-auto mb-2 opacity-50" />
          <div>点击节点 / 边查看详情</div>
          <div class="mt-1 text-xs">详情面板会展示节点对应的真实原文片段</div>
        </div>
      </aside>
    </div>

    <!-- 节点编辑对话框 -->
    <div v-if="showEditNode" class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
         @click.self="showEditNode = false">
      <div class="industrial-card w-full max-w-md bg-card overflow-hidden">
        <header class="px-5 py-3 border-b border-border flex items-center gap-2">
          <Edit3 class="w-4 h-4 text-accent" />
          <span class="font-semibold flex-1">编辑节点</span>
        </header>
        <div class="p-5 space-y-3">
          <div>
            <div class="text-sm text-text-2 mb-1">名称</div>
            <input v-model="editNodeLabel"
                   class="w-full h-10 px-3 rounded-btn border border-border bg-bg outline-none focus:border-accent" />
          </div>
          <div>
            <div class="text-sm text-text-2 mb-1">描述（可选）</div>
            <textarea v-model="editNodeDesc" rows="3"
                      class="w-full px-3 py-2 rounded-btn border border-border bg-bg outline-none focus:border-accent text-sm"></textarea>
          </div>
        </div>
        <footer class="px-5 py-3 border-t border-border flex justify-end gap-2">
          <button class="h-9 px-4 rounded-btn border border-border" @click="showEditNode = false">取消</button>
          <button class="h-9 px-5 rounded-btn bg-accent hover:bg-accent-2 text-white font-semibold"
                  @click="submitEditNode">保存</button>
        </footer>
      </div>
    </div>

    <!-- 边编辑对话框 -->
    <div v-if="showEditEdge" class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
         @click.self="showEditEdge = false">
      <div class="industrial-card w-full max-w-md bg-card overflow-hidden">
        <header class="px-5 py-3 border-b border-border flex items-center gap-2">
          <Edit3 class="w-4 h-4 text-accent" />
          <span class="font-semibold flex-1">编辑关系</span>
        </header>
        <div class="p-5">
          <div class="text-sm text-text-2 mb-1">关系名</div>
          <input v-model="editEdgeRel"
                 class="w-full h-10 px-3 rounded-btn border border-border bg-bg outline-none focus:border-accent" />
        </div>
        <footer class="px-5 py-3 border-t border-border flex justify-end gap-2">
          <button class="h-9 px-4 rounded-btn border border-border" @click="showEditEdge = false">取消</button>
          <button class="h-9 px-5 rounded-btn bg-accent hover:bg-accent-2 text-white font-semibold"
                  @click="submitEditEdge">保存</button>
        </footer>
      </div>
    </div>
  </div>
</template>

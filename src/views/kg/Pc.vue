<script setup lang="ts">
/**
 * 知识图谱 · PC（FIX3 第 5 项）
 * - 数据来源：已审入库的文档 → /api/kg/graph?doc_ids=...
 * - 严禁硬编码 mock 节点；图谱为空时显示空态
 * - 节点详情面板拉取真实原文片段（GET /api/kb/{docId}/chunk/{chunkId}）
 */
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { getGraph, getChunk, type KGGraph, type KGNode, type KGType, type ChunkContent } from '@/api/kg'
import { Search, RotateCcw, Download, Box, ExternalLink, Loader, AlertTriangle } from 'lucide-vue-next'
import * as echarts from 'echarts/core'
import { GraphChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([GraphChart, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer])

const router = useRouter()

const graph = ref<KGGraph | null>(null)
const loading = ref(false)
const errorMsg = ref('')
const selected = ref<KGNode | null>(null)
const chunkLoading = ref(false)
const chunk = ref<ChunkContent | null>(null)

const filterType = ref<'all' | KGType>('all')
const q = ref('')
const chartRef = ref<HTMLDivElement>()
let inst: echarts.ECharts | null = null

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
  return graph.value.nodes.filter(n =>
    (filterType.value === 'all' || n.type === filterType.value) &&
    (!q.value || n.label.includes(q.value))
  )
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
  const nodes = filteredNodes.value.map(n => ({
    id: n.id,
    name: n.label,
    value: n.weight,
    symbolSize: 28 + Math.min(n.weight, 30),
    symbol: TYPE_META[n.type].symbol,
    category: cats.indexOf(n.type),
    itemStyle: { color: TYPE_META[n.type].color },
    label: { show: !isLarge, position: 'right', color: '#1F2937', fontSize: 12 },
    raw: n
  }))
  const links = visibleEdges.value.map(e => ({
    source: e.source, target: e.target, value: e.rel,
    label: { show: false, formatter: e.rel, fontSize: 10, color: '#6B7280' },
    lineStyle: { color: '#C2C9D6', curveness: 0.1 }
  }))
  inst.setOption({
    tooltip: {
      formatter: (p: any) => {
        if (p.dataType === 'edge') return `<div style="font-weight:600">${p.data.value}</div>`
        const n: KGNode = p.data.raw
        const lines = [
          `<div style="font-weight:600;margin-bottom:4px">${n.label}</div>`,
          `<div style="color:#6B7280;font-size:12px">类型: ${TYPE_META[n.type].name}</div>`,
          `<div style="color:#6B7280;font-size:12px">关联: ${n.weight} 条</div>`
        ]
        if (n.desc) lines.push(`<div style="margin-top:4px;font-size:12px">${n.desc}</div>`)
        return lines.join('')
      }
    },
    legend: [{ data: CATEGORIES.map(c => c.name), bottom: 12, icon: 'circle' }],
    series: [{
      type: 'graph',
      layout: 'force',
      data: nodes,
      links,
      categories: CATEGORIES,
      roam: true,
      draggable: true,
      large: isLarge,
      focusNodeAdjacency: true,
      force: { repulsion: 240, edgeLength: 110, gravity: 0.08 },
      emphasis: { focus: 'adjacency', lineStyle: { width: 3, color: '#F26B1F' }, label: { show: true, fontWeight: 700 } },
      lineStyle: { width: 1.2, opacity: 0.7 }
    }]
  })
}

const setup = () => {
  if (!chartRef.value) return
  const reused = echarts.getInstanceByDom(chartRef.value)
  inst = reused || echarts.init(chartRef.value)
  inst.off('click')
  inst.on('click', (p: any) => {
    if (p.dataType !== 'node') return
    const n = p.data.raw as KGNode
    selected.value = n
    chunk.value = null
    if (n.docId && n.chunkId) {
      chunkLoading.value = true
      getChunk(n.docId, n.chunkId)
        .then(c => { chunk.value = c })
        .finally(() => { chunkLoading.value = false })
    }
  })
  renderChart()
}

const resetView = () => {
  filterType.value = 'all'
  q.value = ''
  selected.value = null
  chunk.value = null
  nextTick(() => { inst?.dispatchAction({ type: 'restore' }); renderChart() })
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
    const g = await getGraph()
    graph.value = g
    if (!g.nodes.length) {
      errorMsg.value = '暂无可视化的图谱数据。请先在「知识上传」补充已审通过的文档，或确认后端 /api/kg/graph 已实现。'
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

onMounted(async () => {
  await reload()
  window.addEventListener('resize', () => inst?.resize())
})

watch([filterType, q], () => renderChart())
</script>

<template>
  <div class="h-full flex flex-col">
    <header class="flex-shrink-0 px-6 py-3 bg-card border-b border-border flex items-center gap-3">
      <div class="relative flex-1 max-w-md">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-2" />
        <input v-model="q" placeholder="搜索实体名称…"
               class="w-full h-9 pl-10 pr-3 rounded-btn border border-border bg-bg outline-none focus:border-accent" />
      </div>
      <div class="flex p-0.5 bg-bg rounded-btn border border-border text-xs">
        <button v-for="t in [
                  { k: 'all',    l: '全部' },
                  { k: 'device', l: '设备' },
                  { k: 'part',   l: '部件' },
                  { k: 'fault',  l: '故障' },
                  { k: 'method', l: '处理' },
                  { k: 'case',   l: '案例' },
                  { k: 'manual', l: '手册' }
                ]"
                :key="t.k" @click="filterType = t.k as any"
                :class="['px-3 h-7 rounded font-medium', filterType === t.k ? 'bg-card shadow-card text-accent' : 'text-text-2']">
          {{ t.l }}
        </button>
      </div>
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

        <!-- 加载/空态遮罩 -->
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
          <div class="text-text-2">· 点击节点查看原文片段</div>
        </div>
      </main>

      <aside class="col-span-3 border-l border-border bg-card overflow-auto">
        <div v-if="selected" class="p-4">
          <div class="text-xs uppercase mono px-2 py-0.5 inline-block rounded text-white"
               :style="{ background: TYPE_META[selected.type].color }">
            {{ TYPE_META[selected.type].name }}
          </div>
          <h3 class="text-lg font-bold mt-2">{{ selected.label }}</h3>
          <div class="text-xs text-text-2 mt-1">关联 <span class="mono">{{ selected.weight }}</span> 条</div>
          <p v-if="selected.desc" class="text-sm mt-3 text-text-2 leading-relaxed">{{ selected.desc }}</p>

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
        <div v-else class="text-center text-text-2 text-sm py-12 px-4">
          <Box class="w-10 h-10 mx-auto mb-2 opacity-50" />
          <div>点击节点查看详情</div>
          <div class="mt-1 text-xs">详情面板会展示节点对应的真实原文片段</div>
        </div>
      </aside>
    </div>
  </div>
</template>

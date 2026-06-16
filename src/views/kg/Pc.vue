<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { getGraph } from '@/api/kg'
import type { KGGraph, KGNode, KGType } from '@/api/kg'
import { Search, Maximize2, RotateCcw, Download, Box } from 'lucide-vue-next'
import * as echarts from 'echarts/core'
import { GraphChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([GraphChart, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer])

const graph = ref<KGGraph | null>(null)
const selected = ref<KGNode | null>(null)
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
  const nodes = filteredNodes.value.map(n => ({
    id: n.id,
    name: n.label,
    value: n.weight,
    symbolSize: 30 + Math.min(n.weight, 30),
    symbol: TYPE_META[n.type].symbol,
    category: cats.indexOf(n.type),
    itemStyle: { color: TYPE_META[n.type].color },
    label: {
      show: true,
      position: 'right',
      color: '#1F2937',
      fontSize: 12
    },
    raw: n
  }))

  const links = visibleEdges.value.map(e => ({
    source: e.source,
    target: e.target,
    value: e.rel,
    label: { show: false, formatter: e.rel, fontSize: 10, color: '#6B7280' },
    lineStyle: { color: '#C2C9D6', curveness: 0.1 }
  }))

  inst.setOption({
    tooltip: {
      formatter: (p: any) => {
        if (p.dataType === 'edge') {
          return `<div style="font-weight:600">${p.data.value}</div>`
        }
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
    legend: [{
      data: CATEGORIES.map(c => c.name),
      bottom: 12,
      icon: 'circle'
    }],
    series: [{
      type: 'graph',
      layout: 'force',
      data: nodes,
      links,
      categories: CATEGORIES,
      roam: true,
      draggable: true,
      focusNodeAdjacency: true,
      force: { repulsion: 240, edgeLength: 110, gravity: 0.08 },
      emphasis: {
        focus: 'adjacency',
        lineStyle: { width: 3, color: '#F26B1F' },
        label: { show: true, fontWeight: 700 }
      },
      lineStyle: { width: 1.2, opacity: 0.7 },
      label: { show: true, position: 'right' }
    }]
  })
}

const setup = () => {
  if (!chartRef.value) return
  if (inst) { inst.dispose(); inst = null }
  inst = echarts.init(chartRef.value)
  inst.on('click', (p: any) => {
    if (p.dataType === 'node') selected.value = p.data.raw as KGNode
  })
  renderChart()
}

const resetView = () => {
  filterType.value = 'all'
  q.value = ''
  selected.value = null
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

onMounted(async () => {
  graph.value = await getGraph()
  await nextTick()
  setup()
  window.addEventListener('resize', () => inst?.resize())
})

watch([filterType, q], () => renderChart())

// 关联节点
const relatedOf = (n: KGNode) => {
  if (!graph.value) return [] as KGNode[]
  const ids = new Set<string>()
  graph.value.edges.forEach(e => {
    if (e.source === n.id) ids.add(e.target)
    if (e.target === n.id) ids.add(e.source)
  })
  return graph.value.nodes.filter(x => ids.has(x.id))
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- 工具栏 -->
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

    <!-- 画布 + 详情 -->
    <div class="flex-1 grid grid-cols-12 overflow-hidden">
      <main class="col-span-9 relative bg-bg overflow-hidden">
        <div ref="chartRef" class="w-full h-full"></div>
        <div class="absolute top-3 left-3 industrial-card px-3 py-2 text-xs space-y-1">
          <div class="font-semibold mb-1">操作提示</div>
          <div class="text-text-2">· 拖拽 / 滚轮缩放</div>
          <div class="text-text-2">· 点击节点查看详情</div>
          <div class="text-text-2">· 悬停高亮关联</div>
        </div>
      </main>

      <!-- 详情 -->
      <aside class="col-span-3 border-l border-border bg-card p-4 overflow-auto">
        <div v-if="selected">
          <div class="text-xs uppercase mono px-2 py-0.5 inline-block rounded text-white"
               :style="{ background: TYPE_META[selected.type].color }">
            {{ TYPE_META[selected.type].name }}
          </div>
          <h3 class="text-lg font-bold mt-2">{{ selected.label }}</h3>
          <div class="text-xs text-text-2 mt-1">关联 <span class="mono">{{ selected.weight }}</span> 条</div>
          <p v-if="selected.desc" class="text-sm mt-3 text-text-2 leading-relaxed">{{ selected.desc }}</p>
          <div v-if="selected.status" class="mt-2 text-xs">
            状态: <span class="font-medium">{{ selected.status }}</span>
          </div>
          <div v-if="selected.manualRef" class="mt-1 text-xs text-accent">
            参考: {{ selected.manualRef }}
          </div>

          <hr class="my-3 border-border" />
          <div class="text-sm font-semibold mb-2">关联实体 ({{ relatedOf(selected).length }})</div>
          <ul class="space-y-2 text-sm">
            <li v-for="r in relatedOf(selected)" :key="r.id"
                class="industrial-card p-2 cursor-pointer hover:border-accent flex items-center gap-2"
                @click="selected = r">
              <span class="w-2 h-2 rounded-full flex-shrink-0" :style="{ background: TYPE_META[r.type].color }"></span>
              <div class="flex-1 min-w-0">
                <div class="font-medium truncate">{{ r.label }}</div>
                <div class="text-xs text-text-2 mt-0.5">{{ TYPE_META[r.type].name }}</div>
              </div>
            </li>
          </ul>
          <button class="mt-4 w-full h-9 rounded-btn bg-accent text-white text-sm font-semibold">
            生成子图
          </button>
        </div>
        <div v-else class="text-center text-text-2 text-sm py-8">
          <Box class="w-10 h-10 mx-auto mb-2 opacity-50" />
          点击节点查看详情
        </div>
      </aside>
    </div>
  </div>
</template>

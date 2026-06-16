<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { getGraph } from '@/api/kg'
import type { KGGraph, KGNode } from '@/api/kg'
import { Search, ZoomIn, ZoomOut, Layers, Download, Box } from 'lucide-vue-next'

const graph = ref<KGGraph | null>(null)
const selected = ref<KGNode | null>(null)
const filterType = ref<string>('all')
const q = ref('')

onMounted(async () => { graph.value = await getGraph() })

// 简单环形布局(占位,真实使用 G6)
const layoutNodes = computed(() => {
  if (!graph.value) return []
  const list = graph.value.nodes.filter(n =>
    (filterType.value === 'all' || n.type === filterType.value) &&
    (!q.value || n.label.includes(q.value))
  )
  const cx = 400, cy = 300, r = 200
  return list.map((n, i) => {
    const ang = (i / list.length) * Math.PI * 2 - Math.PI / 2
    return { ...n, x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r }
  })
})

const colorOf = (t: string) => ({
  device: '#0B2545', part: '#00B7C2', fault: '#F26B1F', method: '#2E7D32'
}[t] || '#6B7280')
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
        <button v-for="t in [{k:'all',l:'全部'},{k:'device',l:'设备'},{k:'part',l:'部件'},{k:'fault',l:'故障'},{k:'method',l:'处理'}]"
                :key="t.k" @click="filterType = t.k"
                :class="['px-3 h-7 rounded font-medium', filterType === t.k ? 'bg-card shadow-card text-accent' : 'text-text-2']">
          {{ t.l }}
        </button>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <button class="w-9 h-9 rounded-btn border border-border flex items-center justify-center" title="放大"><ZoomIn class="w-4 h-4" /></button>
        <button class="w-9 h-9 rounded-btn border border-border flex items-center justify-center" title="缩小"><ZoomOut class="w-4 h-4" /></button>
        <button class="w-9 h-9 rounded-btn border border-border flex items-center justify-center" title="布局"><Layers class="w-4 h-4" /></button>
        <button class="h-9 px-3 rounded-btn border border-border flex items-center gap-1 text-sm"><Download class="w-4 h-4" /> 导出</button>
      </div>
    </header>

    <!-- 画布 -->
    <div class="flex-1 grid grid-cols-12 overflow-hidden">
      <main class="col-span-9 relative bg-bg overflow-auto">
        <svg viewBox="0 0 800 600" class="w-full h-full">
          <!-- 边 -->
          <g v-if="graph" stroke="#C2C9D6" stroke-width="1">
            <line v-for="(e, i) in graph.edges" :key="i"
                  :x1="layoutNodes.find(n => n.id === e.source)?.x"
                  :y1="layoutNodes.find(n => n.id === e.source)?.y"
                  :x2="layoutNodes.find(n => n.id === e.target)?.x"
                  :y2="layoutNodes.find(n => n.id === e.target)?.y" />
          </g>
          <!-- 节点 -->
          <g>
            <g v-for="n in layoutNodes" :key="n.id"
               style="cursor:pointer" @click="selected = n">
              <circle :cx="n.x" :cy="n.y" :r="14 + Math.min(n.weight, 30)" :fill="colorOf(n.type)" opacity="0.85" />
              <text :x="n.x" :y="n.y + 4" text-anchor="middle" fill="white" font-size="11" font-weight="600">{{ n.label }}</text>
            </g>
          </g>
        </svg>
        <div class="absolute bottom-3 right-3 industrial-card px-3 py-2 text-xs space-y-1">
          <div class="font-semibold mb-1">图例</div>
          <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full" style="background:#0B2545"></span>设备</div>
          <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full" style="background:#00B7C2"></span>部件</div>
          <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full" style="background:#F26B1F"></span>故障</div>
          <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full" style="background:#2E7D32"></span>处理</div>
        </div>
      </main>

      <!-- 详情 -->
      <aside class="col-span-3 border-l border-border bg-card p-4 overflow-auto">
        <div v-if="selected">
          <div class="text-xs text-text-2 uppercase mono">{{ selected.type }}</div>
          <h3 class="text-lg font-bold mt-1">{{ selected.label }}</h3>
          <div class="text-xs text-text-2 mt-1">关联案例 {{ selected.weight }} 条</div>
          <hr class="my-3 border-border" />
          <div class="text-sm font-semibold mb-2">关联案例 Top 3</div>
          <ul class="space-y-2 text-sm">
            <li v-for="i in 3" :key="i" class="industrial-card p-2 cursor-pointer hover:border-accent">
              <div class="font-medium truncate">{{ selected.label }}案例 #{{ 100 + i }}</div>
              <div class="text-xs text-text-2 mt-0.5">YKK630-4 · 2024-03-1{{ i }}</div>
            </li>
          </ul>
          <button class="mt-4 w-full h-9 rounded-btn bg-accent text-white text-sm font-semibold">生成子图</button>
        </div>
        <div v-else class="text-center text-text-2 text-sm py-8">
          <Box class="w-10 h-10 mx-auto mb-2 opacity-50" />
          点击节点查看详情
        </div>
      </aside>
    </div>
  </div>
</template>

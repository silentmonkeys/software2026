<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getGraph } from '@/api/kg'
import type { KGGraph, KGNode, KGType } from '@/api/kg'
import { Search, ChevronDown, Filter } from 'lucide-vue-next'

const graph = ref<KGGraph | null>(null)
const q = ref('')
const filterType = ref<'all' | KGType>('all')
const expanded = ref<Set<string>>(new Set())

onMounted(async () => { graph.value = await getGraph() })

const TYPE_META: Record<KGType, { name: string; cls: string }> = {
  device: { name: '设备', cls: 'bg-primary text-white' },
  part:   { name: '部件', cls: 'bg-ai text-white' },
  fault:  { name: '故障', cls: 'bg-accent text-white' },
  method: { name: '处理', cls: 'bg-success text-white' },
  case:   { name: '案例', cls: 'bg-primary-2 text-white' },
  manual: { name: '手册', cls: 'bg-text-2 text-white' }
}

const FILTERS: Array<{ k: 'all' | KGType; l: string }> = [
  { k: 'all', l: '全部' },
  { k: 'device', l: '设备' },
  { k: 'part',   l: '部件' },
  { k: 'fault',  l: '故障' },
  { k: 'method', l: '处理' },
  { k: 'case',   l: '案例' }
]

const filtered = computed(() => {
  if (!graph.value) return []
  return graph.value.nodes.filter(n =>
    (filterType.value === 'all' || n.type === filterType.value) &&
    (!q.value || n.label.includes(q.value))
  )
})

const neighborsOf = (n: KGNode) => {
  if (!graph.value) return [] as { node: KGNode; rel: string }[]
  const out: { node: KGNode; rel: string }[] = []
  graph.value.edges.forEach(e => {
    if (e.source === n.id) {
      const t = graph.value!.nodes.find(x => x.id === e.target)
      if (t) out.push({ node: t, rel: e.rel })
    } else if (e.target === n.id) {
      const t = graph.value!.nodes.find(x => x.id === e.source)
      if (t) out.push({ node: t, rel: e.rel })
    }
  })
  return out
}

const toggle = (id: string) => {
  const s = new Set(expanded.value)
  s.has(id) ? s.delete(id) : s.add(id)
  expanded.value = s
}
</script>

<template>
  <div class="p-3 space-y-3">
    <!-- 搜索 + 筛选 -->
    <div class="space-y-2">
      <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-2" />
        <input v-model="q" placeholder="搜索实体…"
               class="w-full h-11 pl-10 pr-3 rounded-btn border border-border bg-card text-base" />
      </div>
      <div class="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1">
        <button v-for="f in FILTERS" :key="f.k" @click="filterType = f.k"
                :class="['px-4 h-8 rounded-pill text-sm flex-shrink-0',
                         filterType === f.k ? 'bg-accent text-white' : 'bg-card border border-border text-text-2']">
          {{ f.l }}
        </button>
      </div>
    </div>

    <div class="text-xs text-text-2 px-1">
      共 {{ filtered.length }} 个实体 · 点击卡片展开关联关系
    </div>

    <!-- 卡片列表 -->
    <div class="space-y-2">
      <div v-for="n in filtered" :key="n.id"
           class="industrial-card overflow-hidden">
        <button class="w-full px-4 py-3 flex items-start gap-3 active:bg-bg" @click="toggle(n.id)">
          <span class="w-10 h-10 rounded-card flex-shrink-0 flex items-center justify-center text-xs font-bold" :class="TYPE_META[n.type].cls">
            {{ TYPE_META[n.type].name }}
          </span>
          <div class="flex-1 min-w-0 text-left">
            <div class="font-semibold text-base">{{ n.label }}</div>
            <div class="text-xs text-text-2 mt-0.5 truncate">
              <span v-if="n.desc">{{ n.desc }}</span>
              <span v-else>关联案例 {{ n.weight }} 条</span>
            </div>
            <div class="text-[11px] text-text-2 mt-1">
              一级邻居 {{ neighborsOf(n).length }} 个 · 关联 <span class="mono">{{ n.weight }}</span>
            </div>
          </div>
          <ChevronDown class="w-4 h-4 text-text-2 mt-1 transition-transform"
                       :class="expanded.has(n.id) ? 'rotate-180' : ''" />
        </button>

        <transition name="collapse">
          <div v-if="expanded.has(n.id)" class="border-t border-border p-3 bg-bg/50">
            <div v-if="!neighborsOf(n).length" class="text-xs text-text-2 text-center py-2">无关联实体</div>
            <ul v-else class="space-y-2">
              <li v-for="(r, i) in neighborsOf(n)" :key="i"
                  class="flex items-center gap-2 p-2 bg-card rounded-btn">
                <span class="w-7 h-7 rounded text-[10px] font-bold flex items-center justify-center flex-shrink-0" :class="TYPE_META[r.node.type].cls">
                  {{ TYPE_META[r.node.type].name }}
                </span>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate">{{ r.node.label }}</div>
                  <div class="text-[11px] text-text-2 mt-0.5">关系: {{ r.rel }}</div>
                </div>
              </li>
            </ul>
          </div>
        </transition>
      </div>

      <div v-if="filtered.length === 0" class="industrial-card p-8 text-center text-text-2 text-sm">
        无符合条件的实体
      </div>
    </div>
  </div>
</template>

<style scoped>
.collapse-enter-active, .collapse-leave-active { transition: opacity .2s, max-height .25s ease; max-height: 600px; overflow: hidden; }
.collapse-enter-from, .collapse-leave-to { opacity: 0; max-height: 0; }
.rotate-180 { transform: rotate(180deg); }
</style>

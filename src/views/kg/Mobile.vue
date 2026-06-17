<script setup lang="ts">
/**
 * 知识图谱 · 移动端（FIX3 第 5.3 项）
 * - 用 van-collapse 风格的卡片流
 * - 顶部"已选文档"筛选器（多选已审文档）
 * - 节点详情展开时拉取真实原文片段
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getGraph, getChunk, type KGGraph, type KGNode, type KGType, type ChunkContent } from '@/api/kg'
import { listDocs, type KbDoc } from '@/api/kb'
import { Search, ChevronDown, Loader, AlertTriangle, ExternalLink, Filter } from 'lucide-vue-next'

const router = useRouter()
const graph = ref<KGGraph | null>(null)
const loading = ref(false)
const errorMsg = ref('')
const q = ref('')
const filterType = ref<'all' | KGType>('all')
const expanded = ref<Set<string>>(new Set())
const chunks = ref<Record<string, ChunkContent | null>>({})

const docs = ref<KbDoc[]>([])
const selectedDocs = ref<Set<string>>(new Set())
const showDocFilter = ref(false)

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

const reload = async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    const g = await getGraph(selectedDocs.value.size ? Array.from(selectedDocs.value) : undefined)
    graph.value = g
    if (!g.nodes.length) errorMsg.value = '暂无可视化的图谱数据'
  } catch {
    graph.value = { nodes: [], edges: [] }
    errorMsg.value = '加载失败'
  } finally {
    loading.value = false
  }
}

const toggle = async (n: KGNode) => {
  const s = new Set(expanded.value)
  if (s.has(n.id)) s.delete(n.id)
  else {
    s.add(n.id)
    if (n.docId && n.chunkId && chunks.value[n.id] === undefined) {
      chunks.value[n.id] = null  // 占位，避免重复请求
      try { chunks.value[n.id] = await getChunk(n.docId, n.chunkId) }
      catch { chunks.value[n.id] = null }
    }
  }
  expanded.value = s
}

const toggleDoc = (id: string) => {
  const s = new Set(selectedDocs.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selectedDocs.value = s
}

const applyDocFilter = async () => {
  showDocFilter.value = false
  await reload()
}

onMounted(async () => {
  try { docs.value = (await listDocs()).filter(d => d.status === 'ready') } catch {}
  await reload()
})
</script>

<template>
  <div class="p-3 space-y-3">
    <!-- 搜索 + 类型筛选 -->
    <div class="space-y-2">
      <div class="flex gap-2">
        <div class="relative flex-1">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-2" />
          <input v-model="q" placeholder="搜索实体…"
                 class="w-full h-11 pl-10 pr-3 rounded-btn border border-border bg-card text-base" />
        </div>
        <button @click="showDocFilter = !showDocFilter"
                class="h-11 px-3 rounded-btn bg-card border border-border flex items-center gap-1 text-sm"
                :class="selectedDocs.size ? 'text-accent border-accent' : 'text-text-2'">
          <Filter class="w-4 h-4" />
          <span>{{ selectedDocs.size ? `已选 ${selectedDocs.size}` : '文档' }}</span>
        </button>
      </div>
      <div class="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1">
        <button v-for="f in FILTERS" :key="f.k" @click="filterType = f.k"
                :class="['px-4 h-8 rounded-pill text-sm flex-shrink-0',
                         filterType === f.k ? 'bg-accent text-white' : 'bg-card border border-border text-text-2']">
          {{ f.l }}
        </button>
      </div>
    </div>

    <!-- 文档筛选下拉 -->
    <div v-if="showDocFilter" class="industrial-card p-3 max-h-64 overflow-auto">
      <div class="text-xs text-text-2 mb-2">勾选要查看的文档（默认全部已审通过）</div>
      <div v-if="!docs.length" class="text-center text-xs text-text-2 py-4">尚无已审通过的文档</div>
      <label v-for="d in docs" :key="d.id" class="flex items-center gap-2 px-1 py-1.5 active:bg-bg rounded">
        <input type="checkbox" :checked="selectedDocs.has(String(d.id))"
               @change="toggleDoc(String(d.id))" class="accent-accent" />
        <span class="text-sm flex-1 truncate">{{ d.title }}</span>
        <span class="mono text-[10px] text-text-2">#{{ d.id }}</span>
      </label>
      <div class="flex gap-2 mt-3">
        <button class="flex-1 h-9 rounded-btn border border-border text-sm" @click="selectedDocs = new Set(); applyDocFilter()">
          全部
        </button>
        <button class="flex-1 h-9 rounded-btn bg-accent text-white text-sm font-semibold" @click="applyDocFilter">
          应用
        </button>
      </div>
    </div>

    <div class="text-xs text-text-2 px-1">共 {{ filtered.length }} 个实体</div>

    <div v-if="loading" class="industrial-card p-8 text-center text-text-2">
      <Loader class="w-5 h-5 mx-auto animate-spin text-accent" />
      <div class="mt-2 text-sm">加载中…</div>
    </div>

    <!-- 卡片列表 -->
    <div v-else-if="filtered.length" class="space-y-2">
      <div v-for="n in filtered" :key="n.id" class="industrial-card overflow-hidden">
        <button class="w-full px-4 py-3 flex items-start gap-3 active:bg-bg" @click="toggle(n)">
          <span class="w-10 h-10 rounded-card flex-shrink-0 flex items-center justify-center text-xs font-bold" :class="TYPE_META[n.type].cls">
            {{ TYPE_META[n.type].name }}
          </span>
          <div class="flex-1 min-w-0 text-left">
            <div class="font-semibold text-base">{{ n.label }}</div>
            <div class="text-xs text-text-2 mt-0.5 truncate">
              <span v-if="n.desc">{{ n.desc }}</span>
              <span v-else>关联 {{ n.weight }} 条</span>
            </div>
          </div>
          <ChevronDown class="w-4 h-4 text-text-2 mt-1 transition-transform"
                       :class="expanded.has(n.id) ? 'rotate-180' : ''" />
        </button>

        <transition name="collapse">
          <div v-if="expanded.has(n.id)" class="border-t border-border p-3 bg-bg/50 space-y-2">
            <div v-if="n.docId" class="text-xs text-text-2 mono">来源文档 #{{ n.docId }}</div>
            <div v-if="chunks[n.id] === null && !n.docId" class="text-xs text-text-2 italic">
              该节点未关联到具体文档片段
            </div>
            <div v-else-if="!chunks[n.id] && n.docId" class="text-xs text-text-2 italic">
              暂无原文片段（可能后端未实现 /api/kb/{docId}/chunk/{chunkId}）
            </div>
            <div v-else-if="chunks[n.id]" class="bg-card rounded-btn p-3 text-xs leading-relaxed">
              <div v-if="chunks[n.id]!.page" class="mono text-[10px] text-text-2 mb-1">页码 {{ chunks[n.id]!.page }}</div>
              <div class="whitespace-pre-wrap">{{ chunks[n.id]!.text }}</div>
            </div>
            <button v-if="n.docId" class="w-full h-9 rounded-btn border border-border text-xs flex items-center justify-center gap-1"
                    @click="router.push(`/kb/preview/${n.docId}`)">
              <ExternalLink class="w-3.5 h-3.5" /> 跳到文档详情
            </button>
          </div>
        </transition>
      </div>
    </div>

    <div v-else class="industrial-card p-8 text-center">
      <AlertTriangle class="w-8 h-8 mx-auto text-warning opacity-70" />
      <div class="mt-2 text-sm text-text-2">{{ errorMsg || '无符合条件的实体' }}</div>
    </div>
  </div>
</template>

<style scoped>
.collapse-enter-active, .collapse-leave-active { transition: opacity .2s, max-height .25s ease; max-height: 600px; overflow: hidden; }
.collapse-enter-from, .collapse-leave-to { opacity: 0; max-height: 0; }
.rotate-180 { transform: rotate(180deg); }
</style>

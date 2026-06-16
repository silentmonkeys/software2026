<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getGraph } from '@/api/kg'
import type { KGGraph } from '@/api/kg'
import { Search } from 'lucide-vue-next'

const graph = ref<KGGraph | null>(null)
const q = ref('')
onMounted(async () => { graph.value = await getGraph() })

const colorOf = (t: string) => ({
  device: 'bg-primary text-white', part: 'bg-ai text-white', fault: 'bg-accent text-white', method: 'bg-success text-white'
}[t] || 'bg-text-2 text-white')
const labelOf = (t: string) => ({ device: '设备', part: '部件', fault: '故障', method: '处理' }[t] || '其他')
</script>

<template>
  <div class="p-3 space-y-3">
    <div class="relative">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-2" />
      <input v-model="q" placeholder="搜索实体…"
             class="w-full h-11 pl-10 pr-3 rounded-btn border border-border bg-card text-base" />
    </div>

    <div class="text-xs text-text-2 px-1">移动端简化为实体卡片流,点击查看一级邻居</div>

    <div v-if="graph" class="space-y-3">
      <div v-for="n in graph.nodes.filter(x => !q || x.label.includes(q))" :key="n.id"
           class="industrial-card p-4 active:bg-bg">
        <div class="flex items-start gap-3">
          <span class="w-10 h-10 rounded-card flex items-center justify-center text-xs font-bold flex-shrink-0" :class="colorOf(n.type)">
            {{ labelOf(n.type) }}
          </span>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-base">{{ n.label }}</div>
            <div class="text-xs text-text-2 mt-1">关联案例 <span class="mono">{{ n.weight }}</span> 条 · 一级邻居 {{ Math.min(n.weight, 5) }} 个</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

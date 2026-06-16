<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { listFlows, type WorkItem } from '@/api/workflow'
import { useDevice } from '@/composables/useDevice'
import {
  ListChecks, Search, AlertTriangle, Clock, Cpu, ChevronRight, Filter
} from 'lucide-vue-next'

const router = useRouter()
const { isPC } = useDevice()

const list = ref<WorkItem[]>([])
const status = ref<'all' | '未开始' | '进行中' | '已完成'>('all')
const q = ref('')

onMounted(async () => { list.value = await listFlows() })

const filtered = computed(() => list.value.filter(it =>
  (status.value === 'all' || it.status === status.value) &&
  (!q.value || it.name.includes(q.value) || it.deviceModel.includes(q.value))
))

const open = (it: WorkItem) => router.push(`/workflow/${it.id}`)

const STATUS_CLS: Record<string, string> = {
  '未开始': 'bg-bg text-text-2 border-border',
  '进行中': 'bg-accent/10 text-accent border-accent/30',
  '已完成': 'bg-success/10 text-success border-success/30'
}

const LEVEL_LABEL = ['', '一级·常规', '二级·重要', '三级·紧急']
const LEVEL_CLS = ['', 'text-success', 'text-warning', 'text-danger']

const formatMin = (m: number) => m < 60 ? `${m} 分钟` : `${Math.floor(m / 60)}h ${m % 60}m`
</script>

<template>
  <!-- ==================== PC 列表 ==================== -->
  <div v-if="isPC" class="p-6 max-w-[1400px] mx-auto">
    <header class="mb-4">
      <div class="text-xs text-text-2">作业指引 / 列表</div>
      <h1 class="text-2xl font-bold text-primary mt-1">作业指引</h1>
      <div class="text-sm text-text-2 mt-1">选择一个作业开始标准化检修流程</div>
    </header>

    <!-- 过滤区 -->
    <div class="industrial-card p-3 flex items-center gap-3 mb-4">
      <div class="relative flex-1 max-w-md">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-2" />
        <input v-model="q" placeholder="搜索作业名称或设备型号"
               class="w-full h-9 pl-10 pr-3 rounded-btn border border-border bg-bg outline-none focus:border-accent" />
      </div>
      <div class="flex p-0.5 bg-bg rounded-btn border border-border text-xs">
        <button v-for="s in [{k:'all',l:'全部'},{k:'未开始',l:'未开始'},{k:'进行中',l:'进行中'},{k:'已完成',l:'已完成'}]"
                :key="s.k" @click="status = s.k as any"
                :class="['px-3 h-7 rounded font-medium', status === s.k ? 'bg-card shadow-card text-accent' : 'text-text-2']">
          {{ s.l }}
        </button>
      </div>
      <div class="ml-auto text-sm text-text-2">共 {{ filtered.length }} / {{ list.length }} 条</div>
    </div>

    <!-- 卡片网格 -->
    <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <button v-for="it in filtered" :key="it.id"
              @click="open(it)"
              class="industrial-card p-5 text-left hover:shadow-float hover:-translate-y-0.5 transition group">
        <div class="flex items-start gap-3">
          <div class="w-11 h-11 rounded-card flex-shrink-0 flex items-center justify-center"
               :class="it.hazardous ? 'bg-warning/10 text-warning' : 'bg-accent/10 text-accent'">
            <AlertTriangle v-if="it.hazardous" class="w-5 h-5" />
            <ListChecks v-else class="w-5 h-5" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-base font-semibold leading-snug group-hover:text-accent transition">{{ it.name }}</div>
            <div class="text-xs text-text-2 mt-1 mono">{{ it.id }}</div>
          </div>
          <span class="px-2 py-0.5 rounded-pill text-xs border whitespace-nowrap" :class="STATUS_CLS[it.status]">
            {{ it.status }}
          </span>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div class="flex items-center gap-1.5 text-text-2">
            <Cpu class="w-3.5 h-3.5" /> <span class="mono">{{ it.deviceModel }}</span>
          </div>
          <div class="flex items-center gap-1.5 text-text-2">
            <Clock class="w-3.5 h-3.5" /> {{ formatMin(it.estimatedMinutes) }}
          </div>
          <div class="flex items-center gap-1.5">
            <Filter class="w-3.5 h-3.5 text-text-2" />
            <span :class="LEVEL_CLS[it.level]">{{ LEVEL_LABEL[it.level] }}</span>
          </div>
          <div class="flex items-center gap-1.5 text-text-2">
            难度 <span class="font-medium text-text">{{ it.difficulty }}</span>
          </div>
        </div>

        <div class="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-text-2">
          <span class="truncate">{{ it.workshop || '—' }}</span>
          <span class="text-accent group-hover:translate-x-0.5 transition flex items-center gap-1">
            进入 <ChevronRight class="w-3.5 h-3.5" />
          </span>
        </div>
      </button>
    </div>

    <div v-if="filtered.length === 0" class="industrial-card p-12 text-center text-text-2">
      暂无符合条件的作业
    </div>
  </div>

  <!-- ==================== 移动端列表 ==================== -->
  <div v-else class="p-3 space-y-3">
    <header class="industrial-card p-4">
      <h1 class="text-lg font-bold text-primary">作业指引</h1>
      <div class="text-xs text-text-2 mt-1">共 {{ list.length }} 个作业 · 点击进入</div>
    </header>

    <!-- 过滤 -->
    <div class="space-y-2">
      <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-2" />
        <input v-model="q" placeholder="搜索作业 / 设备型号"
               class="w-full h-11 pl-10 pr-3 rounded-btn border border-border bg-card text-base" />
      </div>
      <div class="flex gap-2 overflow-x-auto hide-scrollbar">
        <button v-for="s in [{k:'all',l:'全部'},{k:'未开始',l:'未开始'},{k:'进行中',l:'进行中'},{k:'已完成',l:'已完成'}]"
                :key="s.k" @click="status = s.k as any"
                :class="['px-4 h-8 rounded-pill text-sm flex-shrink-0',
                         status === s.k ? 'bg-accent text-white' : 'bg-card border border-border text-text-2']">
          {{ s.l }}
        </button>
      </div>
    </div>

    <!-- 列表 -->
    <ul class="space-y-3">
      <li v-for="it in filtered" :key="it.id"
          class="industrial-card p-4 active:bg-bg" @click="open(it)">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-card flex-shrink-0 flex items-center justify-center"
               :class="it.hazardous ? 'bg-warning/10 text-warning' : 'bg-accent/10 text-accent'">
            <AlertTriangle v-if="it.hazardous" class="w-5 h-5" />
            <ListChecks v-else class="w-5 h-5" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold leading-snug">{{ it.name }}</div>
            <div class="text-xs text-text-2 mt-1 flex items-center gap-2 flex-wrap">
              <span class="mono">{{ it.deviceModel }}</span>
              <span :class="LEVEL_CLS[it.level]">{{ LEVEL_LABEL[it.level] }}</span>
              <span>{{ formatMin(it.estimatedMinutes) }}</span>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded-pill text-[11px] border whitespace-nowrap flex-shrink-0" :class="STATUS_CLS[it.status]">
            {{ it.status }}
          </span>
        </div>
      </li>
      <li v-if="filtered.length === 0" class="industrial-card p-8 text-center text-text-2 text-sm">
        暂无符合条件的作业
      </li>
    </ul>
  </div>
</template>

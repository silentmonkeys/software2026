<script setup lang="ts">
import { onMounted, ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { listFlows, createTicket, type WorkItem } from '@/api/workflow'
import { useDevice } from '@/composables/useDevice'
import { showToast, showFailToast } from 'vant'
import {
  ListChecks, Search, AlertTriangle, Clock, Cpu, ChevronRight, Filter,
  Plus, Loader, X, Sparkles, WifiOff, Inbox
} from 'lucide-vue-next'

const router = useRouter()
const { isPC } = useDevice()

const list = ref<WorkItem[]>([])
const offline = ref(false)
const loaded = ref(false)
const status = ref<'all' | '未开始' | '进行中' | '已完成'>('all')
const q = ref('')

const refresh = async () => {
  const res = await listFlows()
  list.value = res.items
  offline.value = res.offline
  loaded.value = true
}
onMounted(refresh)

const filtered = computed(() => list.value.filter(it =>
  (status.value === 'all' || it.status === status.value) &&
  (!q.value || it.name.includes(q.value) || it.deviceModel.includes(q.value))
))

const open = (it: WorkItem) => router.push(`/workflow/${it.id}`)

/* —— 新建工单（POST /api/ticket，AI 同步生成检修步骤） —— */
const showCreate = ref(false)
const creating = ref(false)
const draft = reactive({ device: '', fault: '' })
const openCreate = () => { draft.device = ''; draft.fault = ''; showCreate.value = true }
const submitCreate = async () => {
  if (!draft.device.trim() || !draft.fault.trim()) {
    showFailToast('请填写设备与故障描述')
    return
  }
  creating.value = true
  try {
    const res = await createTicket({ device: draft.device.trim(), fault: draft.fault.trim() })
    showToast({ type: 'success', message: 'AI 已生成检修方案' })
    showCreate.value = false
    await refresh()
    router.push(`/workflow/t-${res.id}`)
  } catch (e) {
    showFailToast('创建失败：请确认后端已启动并已登录')
  } finally {
    creating.value = false
  }
}

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
    <header class="mb-4 flex items-end justify-between gap-4">
      <div>
        <div class="text-xs text-text-2">作业指引 / 列表</div>
        <h1 class="text-2xl font-bold text-primary mt-1">作业指引</h1>
        <div class="text-sm text-text-2 mt-1">选择一个作业开始标准化检修流程</div>
      </div>
      <button @click="openCreate"
              class="h-10 px-4 rounded-btn bg-accent hover:bg-accent-2 text-white font-semibold flex items-center gap-2 ai-shine">
        <Plus class="w-4 h-4" /> 新建 AI 工单
      </button>
    </header>

    <!-- 离线模式提示（FIX2 第 2 项） -->
    <div v-if="offline" class="mb-4 px-4 py-2 rounded-btn bg-warning/10 border border-warning/30 text-warning text-sm flex items-center gap-2">
      <WifiOff class="w-4 h-4" />
      <span>当前为离线模式，展示示例数据。请确认后端已启动并已登录。</span>
    </div>

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

    <div v-if="loaded && list.length === 0 && !offline"
         class="industrial-card p-12 text-center">
      <Inbox class="w-12 h-12 mx-auto text-text-2 opacity-60" />
      <div class="mt-3 text-base font-semibold">暂无工单</div>
      <div class="mt-1 text-sm text-text-2">点击右上角"新建 AI 工单"，让大模型为您生成检修方案</div>
      <button @click="openCreate"
              class="mt-5 h-10 px-5 rounded-btn bg-accent hover:bg-accent-2 text-white font-semibold inline-flex items-center gap-2 ai-shine">
        <Plus class="w-4 h-4" /> 新建 AI 工单
      </button>
    </div>
    <div v-else-if="filtered.length === 0" class="industrial-card p-12 text-center text-text-2">
      暂无符合条件的作业
    </div>
  </div>

  <!-- ==================== 移动端列表 ==================== -->
  <div v-else class="p-3 space-y-3">
    <header class="industrial-card p-4 flex items-center gap-3">
      <div class="flex-1 min-w-0">
        <h1 class="text-lg font-bold text-primary">作业指引</h1>
        <div class="text-xs text-text-2 mt-1">共 {{ list.length }} 个作业 · 点击进入</div>
      </div>
      <button @click="openCreate"
              class="h-9 px-3 rounded-btn bg-accent text-white text-sm font-semibold flex items-center gap-1 flex-shrink-0">
        <Plus class="w-4 h-4" /> 新建
      </button>
    </header>

    <!-- 离线模式提示（移动端） -->
    <div v-if="offline" class="px-3 py-2 rounded-btn bg-warning/10 border border-warning/30 text-warning text-xs flex items-center gap-1.5">
      <WifiOff class="w-3.5 h-3.5" />
      离线模式 · 当前为示例数据
    </div>

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
      <li v-if="loaded && list.length === 0 && !offline" class="industrial-card p-8 text-center">
        <Inbox class="w-10 h-10 mx-auto text-text-2 opacity-60" />
        <div class="mt-2 text-sm font-semibold">暂无工单</div>
        <div class="mt-1 text-xs text-text-2">点击上方"新建"，AI 会为您生成检修方案</div>
      </li>
      <li v-else-if="filtered.length === 0" class="industrial-card p-8 text-center text-text-2 text-sm">
        暂无符合条件的作业
      </li>
    </ul>
  </div>

  <!-- ==================== 新建工单弹窗 ==================== -->
  <div v-if="showCreate" class="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4"
       @click.self="!creating && (showCreate = false)">
    <div class="industrial-card w-full max-w-md bg-card overflow-hidden">
      <header class="px-5 py-3 border-b border-border flex items-center gap-2">
        <Sparkles class="w-4 h-4 text-ai" />
        <span class="font-semibold flex-1">AI 工单 · 自动生成检修步骤</span>
        <button class="text-text-2 hover:text-danger" :disabled="creating" @click="showCreate = false">
          <X class="w-4 h-4" />
        </button>
      </header>
      <div class="p-5 space-y-3">
        <div>
          <div class="text-sm text-text-2 mb-1">设备</div>
          <input v-model="draft.device" placeholder="如：空压机-XG200"
                 :disabled="creating"
                 class="w-full h-10 px-3 rounded-btn border border-border bg-bg outline-none focus:border-accent focus:bg-card mono" />
        </div>
        <div>
          <div class="text-sm text-text-2 mb-1">故障描述</div>
          <textarea v-model="draft.fault" rows="4" placeholder="一句话描述故障现象，AI 会按【风险预检/工具准备/检修步骤/验收标准】生成方案"
                    :disabled="creating"
                    class="w-full px-3 py-2 rounded-btn border border-border bg-bg outline-none focus:border-accent focus:bg-card resize-none"></textarea>
        </div>
        <div class="text-[11px] text-text-2 leading-relaxed">
          后端会同步调用大模型，单次生成约 5–30 秒，请耐心等待。
        </div>
      </div>
      <footer class="px-5 py-3 border-t border-border flex justify-end gap-2">
        <button class="h-9 px-4 rounded-btn border border-border" :disabled="creating" @click="showCreate = false">取消</button>
        <button class="h-9 px-5 rounded-btn bg-accent hover:bg-accent-2 text-white font-semibold flex items-center gap-2 disabled:opacity-60"
                :disabled="creating" @click="submitCreate">
          <Loader v-if="creating" class="w-4 h-4 animate-spin" />
          <Sparkles v-else class="w-4 h-4" />
          {{ creating ? 'AI 生成中…' : '生成检修方案' }}
        </button>
      </footer>
    </div>
  </div>
</template>

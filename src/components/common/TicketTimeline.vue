<script setup lang="ts">
/**
 * 工单时间线（FIX5 第 11 项 / FIX6 第 4 项）
 * - 员工：只看自己（events）
 * - 审查员/管理员：按用户分组（grouped）
 * - 完整覆盖 5 种事件类型（created / added / step_completed / completed / deleted）
 *   各自配独立图标与颜色，对未知类型 fallback 到 Info。
 */
import { ref, watch, computed } from 'vue'
import { getTimeline, type TicketEvent } from '@/api/ticket'
import { formatTime } from '@/utils/format'
import {
  Loader, AlertTriangle, X, Clock,
  PlusCircle, UserPlus, CheckCircle, Award, Trash2, Info
} from 'lucide-vue-next'

const props = defineProps<{ ticketId: number | string; open: boolean; steps?: any[] }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const loading = ref(false)
const error = ref<string | null>(null)
const events = ref<TicketEvent[]>([])
const grouped = ref<{ userId: number; user: string | null; events: TicketEvent[] }[]>([])

interface EventStyle {
  icon: any
  iconCls: string
  dotCls: string
  label: string
}

const EVENT_STYLES: Record<string, EventStyle> = {
  created:        { icon: PlusCircle,  iconCls: 'text-accent',  dotCls: 'bg-accent',  label: '创建了工单' },
  added:          { icon: UserPlus,    iconCls: 'text-success', dotCls: 'bg-success', label: '加入了工单' },
  step_completed: { icon: CheckCircle, iconCls: 'text-warning', dotCls: 'bg-warning', label: '完成步骤' },
  completed:      { icon: Award,       iconCls: 'text-ai',      dotCls: 'bg-ai',      label: '完成工单' },
  deleted:        { icon: Trash2,      iconCls: 'text-danger',  dotCls: 'bg-danger',  label: '删除工单' }
}
const FALLBACK_STYLE: EventStyle = {
  icon: Info, iconCls: 'text-text-2', dotCls: 'bg-text-2', label: '事件'
}

const styleFor = (type: string): EventStyle => EVENT_STYLES[type] || FALLBACK_STYLE

/** 步骤索引/ID 解析为步骤标题（如可识别） */
const stepLabel = (ev: TicketEvent): string => {
  const sid = ev.detail?.stepId
  const sIdx = ev.detail?.stepIndex
  const steps = props.steps || []
  if (typeof sIdx === 'number' && steps[sIdx]?.title) return `第 ${sIdx + 1} 步：${steps[sIdx].title}`
  if (sid != null) {
    const m = steps.find((s: any) => String(s.id) === String(sid))
    if (m?.title) return `${sid} · ${m.title}`
    return `步骤 ${sid}`
  }
  return ''
}

const describe = (ev: TicketEvent): string => {
  const base = styleFor(ev.type).label
  if (ev.type === 'step_completed') {
    const sl = stepLabel(ev)
    return sl ? `${base} · ${sl}` : base
  }
  if (ev.type === 'deleted' && ev.detail?.reason) return `${base}：${ev.detail.reason}`
  if (ev.type === 'added' && ev.detail?.from) return `${base} · 来源 ${ev.detail.from}`
  return base
}

const load = async () => {
  loading.value = true
  error.value = null
  events.value = []
  grouped.value = []
  try {
    const res = await getTimeline(props.ticketId)
    events.value = res.events || []
    grouped.value = res.grouped || []
  } catch (e: any) {
    error.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

watch(() => props.open, (v) => { if (v) load() })

const isEmpty = computed(() => !loading.value && !error.value && !grouped.value.length && !events.value.length)
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" @click.self="emit('close')">
    <div class="industrial-card w-full max-w-lg bg-card overflow-hidden flex flex-col max-h-[80vh]">
      <header class="px-5 py-3 border-b border-border flex items-center gap-2">
        <Clock class="w-4 h-4 text-accent" />
        <span class="font-semibold flex-1">工单时间线</span>
        <button class="text-text-2 hover:text-danger" @click="emit('close')"><X class="w-4 h-4" /></button>
      </header>

      <div class="p-5 overflow-y-auto">
        <div v-if="loading" class="py-10 text-center text-text-2">
          <Loader class="w-6 h-6 mx-auto animate-spin text-accent" />
          <div class="mt-2 text-sm">加载时间线…</div>
        </div>
        <div v-else-if="error" class="py-10 text-center text-warning">
          <AlertTriangle class="w-7 h-7 mx-auto" />
          <div class="mt-2 text-sm">{{ error }}</div>
          <button @click="load" class="mt-3 h-8 px-4 rounded-btn border border-border text-sm hover:bg-bg">重试</button>
        </div>

        <!-- 审查员/管理员：按用户分组 -->
        <template v-else-if="grouped.length">
          <div v-for="g in grouped" :key="g.userId" class="mb-5 last:mb-0">
            <div class="text-sm font-semibold text-text mb-2">{{ g.user || ('用户 #' + g.userId) }}</div>
            <ol class="relative pl-6 space-y-3">
              <li v-for="(ev, i) in g.events" :key="i" class="relative">
                <span class="absolute -left-6 top-0.5 w-5 h-5 rounded-full ring-2 ring-card flex items-center justify-center text-white"
                      :class="styleFor(ev.type).dotCls">
                  <component :is="styleFor(ev.type).icon" class="w-3 h-3" />
                </span>
                <span v-if="i < g.events.length - 1" class="absolute -left-[14px] top-6 w-px h-[calc(100%+0.25rem)] bg-border"></span>
                <div class="text-sm font-medium" :class="styleFor(ev.type).iconCls">
                  {{ describe(ev) }}
                </div>
                <div class="text-xs text-text-2 mono mt-0.5">{{ formatTime(ev.at) }}</div>
              </li>
            </ol>
          </div>
        </template>

        <!-- 员工：自己的时间线 -->
        <ol v-else-if="events.length" class="relative pl-6 space-y-3">
          <li v-for="(ev, i) in events" :key="i" class="relative">
            <span class="absolute -left-6 top-0.5 w-5 h-5 rounded-full ring-2 ring-card flex items-center justify-center text-white"
                  :class="styleFor(ev.type).dotCls">
              <component :is="styleFor(ev.type).icon" class="w-3 h-3" />
            </span>
            <span v-if="i < events.length - 1" class="absolute -left-[14px] top-6 w-px h-[calc(100%+0.25rem)] bg-border"></span>
            <div class="text-sm font-medium" :class="styleFor(ev.type).iconCls">
              {{ describe(ev) }}
            </div>
            <div class="text-xs text-text-2 mono mt-0.5">{{ formatTime(ev.at) }}</div>
          </li>
        </ol>

        <div v-else-if="isEmpty" class="py-10 text-center text-text-2 text-sm">暂无时间线记录</div>
      </div>
    </div>
  </div>
</template>

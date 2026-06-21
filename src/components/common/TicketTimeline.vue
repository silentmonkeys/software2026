<script setup lang="ts">
/**
 * 工单时间线（FIX5 第 11 项）
 * - 员工：只看自己（events）
 * - 审查员/管理员：按用户分组（grouped）
 * 竖向步骤条样式，复用现有设计系统。
 */
import { ref, watch } from 'vue'
import { getTimeline, type TicketEvent } from '@/api/ticket'
import { formatTime } from '@/utils/format'
import { Loader, AlertTriangle, X, Clock } from 'lucide-vue-next'

const props = defineProps<{ ticketId: number | string; open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const loading = ref(false)
const error = ref<string | null>(null)
const events = ref<TicketEvent[]>([])
const grouped = ref<{ userId: number; user: string | null; events: TicketEvent[] }[]>([])

const EVENT_LABEL: Record<string, string> = {
  created:        '创建工单',
  added:          '加入作业指引',
  step_completed: '完成步骤',
  completed:      '完成工单',
  deleted:        '删除工单'
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
            <ol class="relative pl-5 space-y-3">
              <li v-for="(ev, i) in g.events" :key="i" class="relative">
                <span class="absolute -left-5 top-1 w-2.5 h-2.5 rounded-full bg-accent ring-2 ring-card"></span>
                <span v-if="i < g.events.length - 1" class="absolute -left-[15px] top-3.5 w-px h-[calc(100%+0.75rem)] bg-border"></span>
                <div class="text-sm font-medium">
                  {{ EVENT_LABEL[ev.type] || ev.type }}
                  <span v-if="ev.detail?.stepId" class="text-text-2 font-normal">· 步骤 {{ ev.detail.stepId }}</span>
                  <span v-if="ev.detail?.reason" class="text-danger font-normal">· {{ ev.detail.reason }}</span>
                </div>
                <div class="text-xs text-text-2 mono mt-0.5">{{ formatTime(ev.at) }}</div>
              </li>
            </ol>
          </div>
        </template>

        <!-- 员工：自己的时间线 -->
        <ol v-else-if="events.length" class="relative pl-5 space-y-3">
          <li v-for="(ev, i) in events" :key="i" class="relative">
            <span class="absolute -left-5 top-1 w-2.5 h-2.5 rounded-full bg-accent ring-2 ring-card"></span>
            <span v-if="i < events.length - 1" class="absolute -left-[15px] top-3.5 w-px h-[calc(100%+0.75rem)] bg-border"></span>
            <div class="text-sm font-medium">
              {{ EVENT_LABEL[ev.type] || ev.type }}
              <span v-if="ev.detail?.stepId" class="text-text-2 font-normal">· 步骤 {{ ev.detail.stepId }}</span>
              <span v-if="ev.detail?.reason" class="text-danger font-normal">· {{ ev.detail.reason }}</span>
            </div>
            <div class="text-xs text-text-2 mono mt-0.5">{{ formatTime(ev.at) }}</div>
          </li>
        </ol>

        <div v-else class="py-10 text-center text-text-2 text-sm">暂无时间线记录</div>
      </div>
    </div>
  </div>
</template>

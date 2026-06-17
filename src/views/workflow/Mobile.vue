<script setup lang="ts">
/**
 * 作业指引 · 移动端详情（FIX3 第 4 项）
 *  - 使用 van-tabs 切换 步骤 / 工具 / 手册
 *  - 步骤独立卡片可勾选 done
 *  - 顶部"返回"回工单列表
 */
import { onMounted, computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkflowStore } from '@/stores/workflow'
import {
  getFlow, getWorkflowTools, getWorkflowManuals, completeTicket,
  type ToolItem, type ManualRef
} from '@/api/workflow'
import {
  ChevronLeft, CheckCircle2, AlertTriangle, Clock, Wrench, BookOpen,
  Loader, ExternalLink
} from 'lucide-vue-next'
import { showToast, showFailToast, showConfirmDialog } from 'vant'
import { renderMarkdown } from '@/utils/markdown'

const wf = useWorkflowStore()
const route = useRoute()
const router = useRouter()

type Tab = 'steps' | 'tools' | 'manuals'
const tab = ref<Tab>('steps')

const tools = ref<ToolItem[]>([])
const manuals = ref<ManualRef[]>([])
const toolsLoading = ref(false)
const manualsLoading = ref(false)

const orderId = computed(() => String(route.params.id || ''))
const isDemo = computed(() => !orderId.value || !orderId.value.startsWith('t-'))

const loadFlow = async () => {
  const f = await getFlow(orderId.value || undefined)
  wf.setFlow(f)
  tab.value = 'steps'
  loadTools()
  loadManuals()
}

const loadTools = async () => {
  if (isDemo.value) { tools.value = []; return }
  toolsLoading.value = true
  try { tools.value = await getWorkflowTools(orderId.value) }
  catch { tools.value = [] }
  finally { toolsLoading.value = false }
}
const loadManuals = async () => {
  if (isDemo.value) { manuals.value = []; return }
  manualsLoading.value = true
  try { manuals.value = await getWorkflowManuals(orderId.value) }
  catch { manuals.value = [] }
  finally { manualsLoading.value = false }
}

onMounted(loadFlow)
watch(() => route.params.id, loadFlow)

const back = () => router.push('/workflow')

const onToggleStep = (stepId: string, hasChecks: boolean) => {
  if (hasChecks && !wf.allChecked(stepId) && !wf.stepDone[stepId]) {
    showFailToast('请先勾选所有校验点')
    if ('vibrate' in navigator) navigator.vibrate([60, 40, 60])
    return
  }
  wf.toggleStepDone(stepId)
  if ('vibrate' in navigator) navigator.vibrate(40)
}

const allDone = computed(() => wf.flow && wf.flow.steps.length > 0 && wf.doneCount === wf.flow.steps.length)
const progressPct = computed(() => Math.round(wf.progress * 100))

const finalizeTicket = async () => {
  if (isDemo.value) { showToast({ message: '示例工单不会落库', type: 'success' }); return }
  if (!allDone.value) {
    try {
      await showConfirmDialog({ title: '尚有未完成步骤', message: '仍要标记为完成吗？' })
    } catch { return }
  }
  try {
    await completeTicket(orderId.value.slice(2))
    showToast({ type: 'success', message: '已归档至已完成' })
    router.push('/workflow')
  } catch {
    showFailToast('提交失败')
  }
}

const openManual = (m: ManualRef) => {
  if (m.docId) router.push(`/kb/preview/${m.docId}`)
}
</script>

<template>
  <div v-if="wf.flow" class="h-full flex flex-col">
    <!-- 顶部 -->
    <header class="flex-shrink-0 bg-card border-b border-border">
      <div class="h-12 flex items-center px-2 relative safe-top">
        <button @click="back" class="w-10 h-10 flex items-center justify-center" aria-label="返回">
          <ChevronLeft class="w-5 h-5" />
        </button>
        <div class="flex-1 min-w-0 px-1 text-center">
          <div class="text-[11px] text-text-2 leading-tight flex items-center justify-center gap-1.5">
            <span>工单列表 / </span>
            <span v-if="isDemo" class="px-1 py-px rounded bg-warning/10 text-warning border border-warning/30 text-[9px]">示例</span>
          </div>
          <div class="text-sm font-semibold truncate">{{ wf.flow.name }}</div>
        </div>
        <button v-if="!isDemo" @click="finalizeTicket"
                class="h-9 px-2.5 rounded-btn bg-success text-white text-xs font-semibold flex items-center gap-1 mr-1">
          <CheckCircle2 class="w-3.5 h-3.5" /> 完成
        </button>
      </div>

      <div class="px-4 pb-2">
        <div class="flex items-center justify-between text-xs text-text-2 mb-1">
          <span class="mono">{{ wf.doneCount }}/{{ wf.totalSteps }} 已完成</span>
          <span class="mono text-accent font-semibold">{{ progressPct }}%</span>
        </div>
        <div class="h-1.5 bg-border rounded-full overflow-hidden">
          <div class="h-full bg-success transition-all duration-500"
               :style="{ width: progressPct + '%' }"></div>
        </div>
      </div>

      <div class="flex border-t border-border">
        <button v-for="t in [
                  { k: 'steps', l: '步骤', n: wf.totalSteps },
                  { k: 'tools', l: '工具', n: tools.length },
                  { k: 'manuals', l: '手册', n: manuals.length }
                ]" :key="t.k" @click="tab = t.k as Tab"
                :class="['flex-1 h-10 text-sm flex items-center justify-center gap-1 border-b-2',
                         tab === t.k ? 'border-accent text-accent font-semibold' : 'border-transparent text-text-2']">
          {{ t.l }} <span class="mono text-[10px] px-1 rounded bg-bg">{{ t.n }}</span>
        </button>
      </div>
    </header>

    <main class="flex-1 overflow-auto bg-bg p-3 space-y-3">
      <!-- 步骤 -->
      <template v-if="tab === 'steps'">
        <div v-for="(s, i) in wf.flow.steps" :key="s.id"
             class="industrial-card p-3 border-l-4"
             :class="wf.stepDone[s.id] ? 'border-l-success bg-success/5' : 'border-l-accent'">
          <div class="flex items-start gap-2.5">
            <input type="checkbox"
                   :checked="!!wf.stepDone[s.id]"
                   @change="onToggleStep(s.id, !!s.checkPoints?.length)"
                   :disabled="isDemo"
                   class="w-5 h-5 mt-1 accent-success flex-shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 text-[11px] text-text-2">
                <span class="mono">{{ i + 1 }}/{{ wf.totalSteps }}</span>
                <span>·</span>
                <Clock class="w-3 h-3" /> {{ s.estMinutes }} 分钟
                <AlertTriangle v-if="s.hazardous" class="w-3 h-3 text-warning ml-auto" />
              </div>
              <h3 class="text-sm font-semibold mt-0.5"
                  :class="wf.stepDone[s.id] ? 'line-through text-text-2' : ''">{{ s.name }}</h3>
              <div v-if="s.safetyNote || s.hazardous"
                   class="mt-1.5 px-2 py-1 rounded-btn bg-warning/10 border border-warning/30 text-warning text-[11px] flex items-start gap-1">
                <AlertTriangle class="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{{ s.safetyNote || '严格执行 LOTO 与安全规程' }}</span>
              </div>
              <div v-if="s.desc" class="md-body mt-2 text-sm" v-html="renderMarkdown(s.desc)"></div>

              <div v-if="s.tools?.length" class="mt-2 flex flex-wrap gap-1 text-[11px]">
                <span v-for="t in s.tools" :key="t" class="px-1.5 py-0.5 rounded bg-bg border border-border">{{ t }}</span>
              </div>

              <div v-if="s.checkPoints?.length" class="mt-2.5 pt-2.5 border-t border-border">
                <div class="text-[11px] font-semibold mb-1">校验点</div>
                <label v-for="(cp, ci) in s.checkPoints" :key="ci"
                       class="flex items-start gap-2 px-1.5 py-1 active:bg-bg rounded text-sm">
                  <input type="checkbox"
                         :checked="!!wf.checks[s.id]?.[ci]"
                         @change="wf.checks[s.id][ci] = !wf.checks[s.id][ci]"
                         :disabled="isDemo || !!wf.stepDone[s.id]"
                         class="w-4 h-4 mt-0.5 accent-accent flex-shrink-0" />
                  <span :class="wf.checks[s.id]?.[ci] ? 'text-text-2 line-through' : ''">{{ cp }}</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- 工具 -->
      <template v-else-if="tab === 'tools'">
        <div v-if="toolsLoading" class="industrial-card p-8 text-center text-text-2">
          <Loader class="w-5 h-5 mx-auto animate-spin text-accent" />
          <div class="mt-2 text-sm">加载中…</div>
        </div>
        <div v-else-if="!tools.length" class="industrial-card p-8 text-center text-text-2">
          <Wrench class="w-8 h-8 mx-auto opacity-40" />
          <div class="mt-2 text-sm">{{ isDemo ? '示例工单暂不提供工具清单' : '暂未提供工具清单' }}</div>
        </div>
        <div v-else class="space-y-2">
          <div v-for="(t, i) in tools" :key="i" class="industrial-card p-3 flex items-start gap-3">
            <div class="w-10 h-10 rounded-card bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
              <Wrench class="w-5 h-5" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold">{{ t.name }}</div>
              <div v-if="t.spec" class="text-[11px] text-text-2 mt-0.5 mono">{{ t.spec }}</div>
            </div>
            <span class="text-sm font-semibold text-accent mono flex-shrink-0">×{{ t.qty }}</span>
          </div>
        </div>
      </template>

      <!-- 手册 -->
      <template v-else>
        <div v-if="manualsLoading" class="industrial-card p-8 text-center text-text-2">
          <Loader class="w-5 h-5 mx-auto animate-spin text-accent" />
          <div class="mt-2 text-sm">加载中…</div>
        </div>
        <div v-else-if="!manuals.length" class="industrial-card p-8 text-center text-text-2">
          <BookOpen class="w-8 h-8 mx-auto opacity-40" />
          <div class="mt-2 text-sm">{{ isDemo ? '示例工单暂不关联手册' : '暂未关联到任何手册' }}</div>
        </div>
        <ul v-else class="space-y-2">
          <li v-for="m in manuals" :key="m.docId"
              class="industrial-card p-3 flex items-start gap-2.5 active:bg-bg"
              @click="openManual(m)">
            <div class="w-9 h-9 rounded-card bg-ai/10 text-ai flex items-center justify-center flex-shrink-0">
              <BookOpen class="w-4 h-4" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold truncate">{{ m.title }}</div>
              <div class="text-[11px] text-text-2 mono">doc-{{ m.docId }}</div>
              <div v-if="m.matchedSection" class="text-[11px] text-text-2 mt-0.5 truncate">{{ m.matchedSection }}</div>
            </div>
            <ExternalLink class="w-4 h-4 text-text-2 flex-shrink-0 mt-1" />
          </li>
        </ul>
      </template>
    </main>
  </div>
  <div v-else class="p-12 text-center text-text-2">流程加载中…</div>
</template>

<script setup lang="ts">
/**
 * 作业指引 · PC 端详情（FIX3 第 4 项）
 *  - 每一步独立卡片 + checkbox 勾选 done
 *  - 三个 Tab：步骤 / 工具清单 / 关联手册
 *  - 顶部面包屑可回列表
 *  - 完成工单 → POST /api/ticket/{id} status=done
 *  - 不再使用任何写死的"工具/手册"假数据，接口失败时显示空态
 */
import { onMounted, computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkflowStore } from '@/stores/workflow'
import {
  getFlow, getWorkflowTools, getWorkflowManuals, completeTicket,
  type ToolItem, type ManualRef
} from '@/api/workflow'
import {
  AlertTriangle, Clock, Wrench, BookOpen, ChevronLeft, ChevronRight,
  CheckCircle2, X, Loader, ListChecks, ExternalLink
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
const toolsError = ref(false)
const manualsError = ref(false)

const isDemo = computed(() =>
  !route.params.id || !String(route.params.id).startsWith('t-')
)

const orderId = computed(() => String(route.params.id || ''))

const loadFlow = async () => {
  const id = orderId.value || undefined
  const f = await getFlow(id)
  wf.setFlow(f)
  tab.value = 'steps'
  // 异步加载工具与手册（仅真实工单）
  loadTools()
  loadManuals()
}

const loadTools = async () => {
  if (isDemo.value) { tools.value = []; toolsError.value = false; return }
  toolsLoading.value = true
  toolsError.value = false
  try {
    tools.value = await getWorkflowTools(orderId.value)
  } catch {
    tools.value = []
    toolsError.value = true
  } finally {
    toolsLoading.value = false
  }
}

const loadManuals = async () => {
  if (isDemo.value) { manuals.value = []; manualsError.value = false; return }
  manualsLoading.value = true
  manualsError.value = false
  try {
    manuals.value = await getWorkflowManuals(orderId.value)
  } catch {
    manuals.value = []
    manualsError.value = true
  } finally {
    manualsLoading.value = false
  }
}

onMounted(loadFlow)
watch(() => route.params.id, loadFlow)

const remainingMinFmt = computed(() => {
  const m = wf.remainingMin
  if (m < 60) return `${m} 分钟`
  return `${Math.floor(m / 60)} 时 ${m % 60} 分`
})

const back = () => router.push('/workflow')

const onToggleStep = (stepId: string, hasChecks: boolean) => {
  // 若步骤含校验点且未全部勾选，先提示
  if (hasChecks && !wf.allChecked(stepId) && !wf.stepDone[stepId]) {
    showFailToast('请先勾选该步骤的所有校验点')
    return
  }
  wf.toggleStepDone(stepId)
}

const allDone = computed(() => wf.flow && wf.flow.steps.length > 0 && wf.doneCount === wf.flow.steps.length)

const finalizeTicket = async () => {
  if (isDemo.value) {
    showToast({ message: '示例工单不会落库', type: 'success' })
    return
  }
  if (!allDone.value) {
    try {
      await showConfirmDialog({
        title: '尚有未完成步骤',
        message: '仍要将该工单标记为完成吗？已勾选的进度会保留。'
      })
    } catch { return }
  }
  try {
    const tid = orderId.value.slice(2)
    await completeTicket(tid)
    showToast({ type: 'success', message: '工单已归档至「已完成」' })
    router.push('/workflow')
  } catch {
    showFailToast('提交失败，请稍后重试')
  }
}

const openManual = (m: ManualRef) => {
  if (!m.docId) return
  router.push(`/kb/preview/${m.docId}`)
}

// 进度条颜色
const progressPct = computed(() => Math.round(wf.progress * 100))
</script>

<template>
  <div v-if="wf.flow" class="h-full flex flex-col overflow-hidden">
    <!-- 面包屑 / 顶部 -->
    <header class="flex-shrink-0 px-6 pt-3 pb-3 bg-card border-b border-border">
      <!-- 面包屑（FIX3 第 4.4 项） -->
      <div class="flex items-center gap-1 text-xs text-text-2 mb-2">
        <button class="hover:text-accent" @click="back">工单列表</button>
        <ChevronRight class="w-3 h-3" />
        <span class="text-text font-medium truncate">{{ wf.flow.name }}</span>
      </div>

      <div class="flex items-start gap-4 flex-wrap">
        <button @click="back" class="h-9 px-3 rounded-btn border border-border bg-bg hover:bg-card flex items-center gap-1.5 text-sm flex-shrink-0">
          <ChevronLeft class="w-4 h-4" /> 返回列表
        </button>

        <div class="flex-1 min-w-72">
          <div class="text-xs text-text-2 mb-1 flex items-center gap-2">
            <span class="mono">{{ wf.flow.id }}</span>
            <span v-if="isDemo" class="px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/30 text-[10px]">示例工单</span>
          </div>
          <h1 class="text-xl font-bold text-primary">{{ wf.flow.name }}</h1>
          <div class="text-sm text-text-2 mt-1 flex items-center gap-3">
            <span class="mono">{{ wf.flow.deviceModel }}</span>
            <span class="px-2 py-0.5 rounded text-xs"
                  :class="wf.flow.level === 1 ? 'bg-success/10 text-success'
                       : wf.flow.level === 2 ? 'bg-warning/10 text-warning'
                       : 'bg-danger/10 text-danger'">
              {{ ['', '一级·常规', '二级·重要', '三级·紧急'][wf.flow.level] }}
            </span>
            <span>共 {{ wf.totalSteps }} 步 · 剩余 ~{{ remainingMinFmt }}</span>
          </div>
        </div>

        <div class="flex-1 min-w-96 max-w-2xl">
          <div class="flex items-center gap-3 mb-2 text-sm">
            <div class="text-text-2">总进度</div>
            <div class="font-semibold text-accent mono">{{ progressPct }}%</div>
            <div class="text-text-2 ml-auto mono">{{ wf.doneCount }} / {{ wf.totalSteps }} 已完成</div>
          </div>
          <div class="h-2 bg-border rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r from-accent to-accent-2 transition-all"
                 :style="{ width: progressPct + '%' }"></div>
          </div>
        </div>

        <button v-if="!isDemo" @click="finalizeTicket"
                class="h-9 px-4 rounded-btn bg-success hover:bg-success/90 text-white font-semibold flex items-center gap-1.5 text-sm flex-shrink-0">
          <CheckCircle2 class="w-4 h-4" /> 完成工单
        </button>
      </div>

      <!-- Tabs -->
      <div class="mt-3 flex border-b border-border -mb-3">
        <button v-for="t in [
                  { k: 'steps',   l: '检修步骤', n: wf.totalSteps },
                  { k: 'tools',   l: '工具清单', n: tools.length },
                  { k: 'manuals', l: '关联手册', n: manuals.length }
                ]" :key="t.k" @click="tab = t.k as Tab"
                :class="['h-10 px-4 text-sm border-b-2 -mb-px flex items-center gap-2',
                         tab === t.k ? 'border-accent text-accent font-semibold' : 'border-transparent text-text-2 hover:text-text']">
          {{ t.l }}
          <span class="mono text-[10px] px-1.5 rounded" :class="tab === t.k ? 'bg-accent/10' : 'bg-bg'">{{ t.n }}</span>
        </button>
      </div>
    </header>

    <!-- 主体 -->
    <div class="flex-1 overflow-auto p-6 bg-bg">
      <!-- ============= Tab: 步骤 ============= -->
      <div v-if="tab === 'steps'" class="max-w-3xl mx-auto space-y-3">
        <div v-for="(s, i) in wf.flow.steps" :key="s.id"
             class="industrial-card p-4 border-l-4 transition"
             :class="wf.stepDone[s.id] ? 'border-l-success bg-success/5' : 'border-l-accent'">
          <div class="flex items-start gap-3">
            <input type="checkbox"
                   :checked="!!wf.stepDone[s.id]"
                   @change="onToggleStep(s.id, !!s.checkPoints?.length)"
                   :disabled="isDemo"
                   class="w-5 h-5 mt-1 accent-success flex-shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="flex items-start gap-2 flex-wrap">
                <span class="mono text-xs text-text-2">步骤 {{ i + 1 }} / {{ wf.totalSteps }}</span>
                <span class="text-xs text-text-2">·</span>
                <span class="inline-flex items-center gap-1 text-xs text-text-2">
                  <Clock class="w-3 h-3" /> {{ s.estMinutes }} 分钟
                </span>
                <span v-if="s.hazardous"
                      class="inline-flex items-center gap-1 text-xs text-warning ml-auto">
                  <AlertTriangle class="w-3 h-3" /> 危险作业
                </span>
              </div>
              <h3 class="text-base font-semibold mt-1" :class="wf.stepDone[s.id] ? 'line-through text-text-2' : ''">
                {{ s.name }}
              </h3>

              <!-- 安全提醒 -->
              <div v-if="s.safetyNote || s.hazardous"
                   class="mt-2 px-3 py-1.5 rounded-btn bg-warning/10 border border-warning/30 text-warning text-xs flex items-start gap-1.5">
                <AlertTriangle class="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>{{ s.safetyNote || '严格执行 LOTO 与安全规程' }}</span>
              </div>

              <!-- 详细描述（markdown） -->
              <div v-if="s.desc" class="md-body mt-3 text-sm" v-html="renderMarkdown(s.desc)"></div>

              <!-- 步骤工具 -->
              <div v-if="s.tools?.length || s.materials?.length" class="mt-3 flex flex-wrap gap-1.5 text-xs">
                <span v-for="t in s.tools" :key="t"
                      class="px-2 py-0.5 rounded bg-bg border border-border">
                  <Wrench class="w-3 h-3 inline -mt-0.5 mr-1" />{{ t }}
                </span>
                <span v-for="m in s.materials" :key="m"
                      class="px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/30">
                  📦 {{ m }}
                </span>
              </div>

              <!-- 校验点 -->
              <div v-if="s.checkPoints?.length" class="mt-3 pt-3 border-t border-border">
                <div class="text-xs font-semibold mb-2">校验点（必须勾选才能完成本步骤）</div>
                <div class="space-y-1.5">
                  <label v-for="(cp, ci) in s.checkPoints" :key="ci"
                         class="flex items-start gap-2 px-2 py-1.5 rounded-btn hover:bg-bg cursor-pointer transition text-sm">
                    <input type="checkbox"
                           :checked="!!wf.checks[s.id]?.[ci]"
                           @change="wf.checks[s.id][ci] = !wf.checks[s.id][ci]"
                           :disabled="isDemo || !!wf.stepDone[s.id]"
                           class="w-4 h-4 mt-0.5 accent-accent flex-shrink-0" />
                    <span :class="wf.checks[s.id]?.[ci] ? 'text-text-2 line-through' : ''">{{ cp }}</span>
                  </label>
                </div>
              </div>

              <!-- 验收标准 -->
              <div v-if="s.acceptance" class="mt-3 px-3 py-2 rounded-btn bg-bg border border-border text-xs">
                <div class="text-text-2 font-semibold mb-0.5">验收标准</div>
                <div>{{ s.acceptance }}</div>
              </div>

              <div v-if="s.manualRef" class="mt-2 text-xs text-accent">
                <BookOpen class="w-3 h-3 inline -mt-0.5 mr-1" />{{ s.manualRef }}
              </div>
            </div>
          </div>
        </div>

        <div v-if="!wf.flow.steps.length" class="industrial-card p-12 text-center text-text-2">
          <ListChecks class="w-10 h-10 mx-auto opacity-40" />
          <div class="mt-3 text-sm">尚未生成检修步骤</div>
        </div>
      </div>

      <!-- ============= Tab: 工具清单 ============= -->
      <div v-else-if="tab === 'tools'" class="max-w-3xl mx-auto">
        <div v-if="toolsLoading" class="industrial-card p-12 text-center text-text-2">
          <Loader class="w-6 h-6 mx-auto animate-spin text-accent" />
          <div class="mt-2 text-sm">加载工具清单…</div>
        </div>
        <div v-else-if="!tools.length" class="industrial-card p-12 text-center text-text-2">
          <Wrench class="w-10 h-10 mx-auto opacity-40" />
          <div class="mt-3 text-sm">
            {{ isDemo ? '示例工单暂不提供工具清单' : '暂未提供工具清单' }}
          </div>
          <div class="mt-1 text-xs">
            {{ toolsError ? '后端 /api/workflow/{id}/tools 不可达' : '后端尚未为该工单维护工具列表' }}
          </div>
        </div>
        <div v-else class="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <div v-for="(t, i) in tools" :key="i" class="industrial-card p-4">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-card bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
                <Wrench class="w-5 h-5" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold">{{ t.name }}</div>
                <div v-if="t.spec" class="text-xs text-text-2 mt-0.5 mono">{{ t.spec }}</div>
                <div class="text-xs mt-1">数量 <span class="font-semibold text-accent mono">×{{ t.qty }}</span></div>
              </div>
            </div>
            <img v-if="t.imageUrl" :src="t.imageUrl" class="mt-3 w-full aspect-video object-cover rounded-btn bg-bg" />
          </div>
        </div>
      </div>

      <!-- ============= Tab: 关联手册 ============= -->
      <div v-else class="max-w-3xl mx-auto">
        <div v-if="manualsLoading" class="industrial-card p-12 text-center text-text-2">
          <Loader class="w-6 h-6 mx-auto animate-spin text-accent" />
          <div class="mt-2 text-sm">加载关联手册…</div>
        </div>
        <div v-else-if="!manuals.length" class="industrial-card p-12 text-center text-text-2">
          <BookOpen class="w-10 h-10 mx-auto opacity-40" />
          <div class="mt-3 text-sm">
            {{ isDemo ? '示例工单暂不关联手册' : '暂未关联到任何手册' }}
          </div>
          <div class="mt-1 text-xs">
            {{ manualsError ? '后端 /api/workflow/{id}/manuals 不可达' : '可让管理员将相关手册上传到知识库' }}
          </div>
        </div>
        <ul v-else class="space-y-3">
          <li v-for="m in manuals" :key="m.docId"
              class="industrial-card p-4 flex items-start gap-3 cursor-pointer hover:border-accent transition"
              @click="openManual(m)">
            <div class="w-10 h-10 rounded-card bg-ai/10 text-ai flex items-center justify-center flex-shrink-0">
              <BookOpen class="w-5 h-5" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-base font-semibold">{{ m.title }}</div>
              <div class="text-xs text-text-2 mt-0.5 mono">doc-{{ m.docId }}</div>
              <div v-if="m.matchedSection" class="text-xs text-text-2 mt-1">匹配章节：{{ m.matchedSection }}</div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="text-xs mono text-accent">{{ Math.round((m.score || 0) * 100) }}%</span>
              <ExternalLink class="w-4 h-4 text-text-2" />
            </div>
          </li>
        </ul>
      </div>
    </div>

    <!-- 底部完成提示 -->
    <footer v-if="allDone && !isDemo" class="flex-shrink-0 px-6 py-3 border-t border-border bg-success/5 flex items-center gap-3">
      <CheckCircle2 class="w-5 h-5 text-success" />
      <span class="text-sm font-semibold text-success">所有步骤已勾选完成</span>
      <button @click="finalizeTicket"
              class="ml-auto h-9 px-5 rounded-btn bg-success hover:bg-success/90 text-white font-semibold text-sm flex items-center gap-2">
        <CheckCircle2 class="w-4 h-4" /> 提交并归档
      </button>
    </footer>
  </div>
  <div v-else class="p-12 text-center text-text-2">流程加载中…</div>
</template>

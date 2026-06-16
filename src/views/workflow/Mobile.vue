<script setup lang="ts">
import { onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkflowStore } from '@/stores/workflow'
import { getFlow, submitReport } from '@/api/workflow'
import MobileWorkflowStep from '@/components/mobile/MobileWorkflowStep.vue'
import { ChevronLeft, ArrowRight, CheckCircle2, X, MoreVertical } from 'lucide-vue-next'
import { showToast, showConfirmDialog } from 'vant'
import { ref } from 'vue'

const wf = useWorkflowStore()
const route = useRoute()
const router = useRouter()

const showMore = ref(false)

const loadFlow = async () => {
  const id = (route.params.id as string) || undefined
  const f = await getFlow(id)
  wf.setFlow(f)
}
onMounted(loadFlow)
watch(() => route.params.id, loadFlow)

const remainingMinFmt = computed(() => {
  const m = wf.remainingMin
  if (m < 60) return `${m} 分钟`
  return `${Math.floor(m / 60)} 时 ${m % 60} 分`
})

const onToggle = (i: number) => {
  if (!wf.currentStep) return
  wf.checks[wf.currentStep.id][i] = !wf.checks[wf.currentStep.id][i]
  if (wf.checks[wf.currentStep.id][i] && 'vibrate' in navigator) navigator.vibrate(40)
}

const onNext = () => {
  if (!wf.currentStep) return
  if (!wf.allChecked(wf.currentStep.id)) {
    showToast('请先勾选所有合规校验点')
    if ('vibrate' in navigator) navigator.vibrate([60, 40, 60])
    return
  }
  if (wf.currentIdx === wf.totalSteps - 1) submitReport({ flowId: wf.flow?.id })
  wf.next()
}

const completed = computed(() => wf.currentIdx >= wf.totalSteps && wf.totalSteps > 0)

const back = () => router.push('/workflow')

const exitWork = async () => {
  showMore.value = false
  if (wf.currentIdx > 0 && !completed.value) {
    try {
      await showConfirmDialog({
        title: '退出当前作业?',
        message: '检修流程未完成,退出后已勾选的校验点会保留。',
        confirmButtonText: '退出',
        cancelButtonText: '继续'
      })
    } catch { return }
  }
  back()
}
</script>

<template>
  <div v-if="wf.flow" class="h-full flex flex-col">
    <!-- 顶部:返回 + 标题 + 进度 -->
    <header class="flex-shrink-0 bg-card border-b border-border">
      <div class="h-12 flex items-center px-2 relative">
        <button @click="back" class="w-10 h-10 flex items-center justify-center" aria-label="返回">
          <ChevronLeft class="w-5 h-5" />
        </button>
        <div class="flex-1 min-w-0 px-1 text-center">
          <div class="text-[11px] text-text-2 leading-tight">作业指引 · {{ wf.flow.deviceModel }}</div>
          <div class="text-sm font-semibold truncate">{{ wf.flow.name }}</div>
        </div>
        <button @click="showMore = !showMore" class="w-10 h-10 flex items-center justify-center" aria-label="更多">
          <MoreVertical class="w-5 h-5" />
        </button>
        <transition name="fade">
          <div v-if="showMore"
               class="absolute right-2 top-12 z-30 w-44 bg-card border border-border rounded-btn shadow-float overflow-hidden">
            <button @click="back" class="w-full h-11 px-3 flex items-center gap-2 active:bg-bg text-sm">
              <ChevronLeft class="w-4 h-4" /> 返回作业列表
            </button>
            <button @click="exitWork" class="w-full h-11 px-3 flex items-center gap-2 active:bg-bg text-sm text-danger border-t border-border">
              <X class="w-4 h-4" /> 退出作业
            </button>
          </div>
        </transition>
      </div>

      <div class="px-4 pb-2">
        <div class="flex items-center justify-between text-xs text-text-2 mb-1">
          <span>{{ wf.currentIdx }}/{{ wf.totalSteps }} 步 · 剩 {{ remainingMinFmt }}</span>
          <span class="mono text-accent font-semibold">{{ Math.round(wf.progress * 100) }}%</span>
        </div>
        <div class="h-1.5 bg-border rounded-full overflow-hidden">
          <div class="h-full bg-accent transition-all duration-500"
               :style="{ width: wf.progress * 100 + '%' }"></div>
        </div>
      </div>
    </header>

    <!-- 滚动主体 -->
    <main class="flex-1 overflow-auto" @click="showMore = false">
      <div v-if="completed" class="p-6 text-center">
        <div class="w-16 h-16 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 class="w-8 h-8" />
        </div>
        <h2 class="text-xl font-bold">流程已完成</h2>
        <p class="text-sm text-text-2 mt-1">请上传现场照片并填写异常</p>
        <button class="mt-5 h-12 px-6 rounded-btn bg-accent text-white font-semibold">生成检修报告</button>
        <button @click="back" class="block mx-auto mt-3 text-sm text-text-2 hover:text-accent">返回作业列表</button>
      </div>
      <MobileWorkflowStep v-else-if="wf.currentStep"
                          :step="wf.currentStep"
                          :checks="wf.checks[wf.currentStep.id] || []"
                          :index="wf.currentIdx"
                          :total="wf.totalSteps"
                          @toggle="onToggle" />
    </main>

    <!-- 底部双按钮 -->
    <footer v-if="!completed" class="flex-shrink-0 px-3 py-3 border-t border-border bg-card flex gap-3 safe-bottom">
      <button @click="wf.prev()" :disabled="wf.currentIdx === 0"
              class="h-14 px-5 rounded-btn border border-border flex items-center gap-2 text-base disabled:opacity-50">
        <ChevronLeft class="w-5 h-5" /> 上一步
      </button>
      <button @click="onNext"
              class="flex-1 h-14 rounded-btn bg-accent text-white font-semibold text-base flex items-center justify-center gap-2 active:bg-accent-2">
        {{ wf.currentIdx === wf.totalSteps - 1 ? '完成检修' : '下一步' }}
        <ArrowRight class="w-5 h-5" />
      </button>
    </footer>
  </div>
  <div v-else class="p-12 text-center text-text-2">流程加载中…</div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity .15s, transform .15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>

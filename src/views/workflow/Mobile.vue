<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useWorkflowStore } from '@/stores/workflow'
import { getFlow, submitReport } from '@/api/workflow'
import MobileWorkflowStep from '@/components/mobile/MobileWorkflowStep.vue'
import { ChevronLeft, ArrowRight, CheckCircle2 } from 'lucide-vue-next'
import { showToast } from 'vant'

const wf = useWorkflowStore()

onMounted(async () => {
  const f = await getFlow()
  wf.setFlow(f)
})

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
</script>

<template>
  <div v-if="wf.flow" class="h-full flex flex-col">
    <!-- 顶部进度 -->
    <header class="flex-shrink-0 bg-card border-b border-border px-4 py-2">
      <div class="flex items-center justify-between text-xs text-text-2 mb-1.5">
        <span class="font-semibold text-text">{{ wf.flow.name }}</span>
        <span class="mono">{{ wf.currentIdx }}/{{ wf.totalSteps }} · 剩 {{ remainingMinFmt }}</span>
      </div>
      <div class="h-1.5 bg-border rounded-full overflow-hidden">
        <div class="h-full bg-accent transition-all duration-500"
             :style="{ width: wf.progress * 100 + '%' }"></div>
      </div>
    </header>

    <!-- 滚动主体 -->
    <main class="flex-1 overflow-auto">
      <div v-if="completed" class="p-6 text-center">
        <div class="w-16 h-16 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 class="w-8 h-8" />
        </div>
        <h2 class="text-xl font-bold">流程已完成</h2>
        <p class="text-sm text-text-2 mt-1">请上传现场照片并填写异常</p>
        <button class="mt-5 h-12 px-6 rounded-btn bg-accent text-white font-semibold">生成检修报告</button>
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

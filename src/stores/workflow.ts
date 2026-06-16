import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SopFlow } from '@/api/workflow'

export const useWorkflowStore = defineStore('workflow', () => {
  const flow = ref<SopFlow | null>(null)
  const currentIdx = ref(0)
  const checks = ref<Record<string, boolean[]>>({})

  const totalSteps = computed(() => flow.value?.steps.length || 0)
  const progress = computed(() =>
    totalSteps.value === 0 ? 0 : Math.min(1, currentIdx.value / totalSteps.value)
  )
  const currentStep = computed(() => flow.value?.steps[currentIdx.value])
  const remainingMin = computed(() => {
    if (!flow.value) return 0
    return flow.value.steps.slice(currentIdx.value).reduce((s, st) => s + st.estMinutes, 0)
  })

  const setFlow = (f: SopFlow) => {
    flow.value = f
    currentIdx.value = 0
    checks.value = {}
    f.steps.forEach(s => { checks.value[s.id] = s.checkPoints.map(() => false) })
  }

  const allChecked = (stepId: string) =>
    (checks.value[stepId] || []).every(Boolean)

  const next = () => {
    if (currentIdx.value < totalSteps.value) {
      // 震动反馈（移动端）
      if ('vibrate' in navigator) navigator.vibrate(60)
      currentIdx.value++
    }
  }
  const prev = () => { if (currentIdx.value > 0) currentIdx.value-- }

  return { flow, currentIdx, checks, totalSteps, progress, currentStep, remainingMin,
           setFlow, allChecked, next, prev }
})

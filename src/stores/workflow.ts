import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { SopFlow } from '@/api/workflow'
import { storage } from '@/utils/storage'

/**
 * 作业指引状态（FIX3 第 4 项）
 * - 步骤勾选 done 状态按 orderId 持久化到 localStorage
 * - 校验点 checks 也按 orderId 持久化（页面刷新不丢）
 */
const STEP_KEY = (orderId: string) => `workorder:steps:${orderId}`
const CHECK_KEY = (orderId: string) => `workorder:checks:${orderId}`

export const useWorkflowStore = defineStore('workflow', () => {
  const flow = ref<SopFlow | null>(null)
  const currentIdx = ref(0)
  /** 步骤校验点的勾选 */
  const checks = ref<Record<string, boolean[]>>({})
  /** 整步是否已完成（FIX3 第 4.1 项） */
  const stepDone = ref<Record<string, boolean>>({})

  const totalSteps = computed(() => flow.value?.steps.length || 0)
  const doneCount = computed(() =>
    flow.value?.steps.reduce((n, s) => n + (stepDone.value[s.id] ? 1 : 0), 0) || 0
  )
  const progress = computed(() =>
    totalSteps.value === 0 ? 0 : Math.min(1, doneCount.value / totalSteps.value)
  )
  const currentStep = computed(() => flow.value?.steps[currentIdx.value])
  const remainingMin = computed(() => {
    if (!flow.value) return 0
    return flow.value.steps
      .filter(s => !stepDone.value[s.id])
      .reduce((s, st) => s + st.estMinutes, 0)
  })

  const setFlow = (f: SopFlow) => {
    flow.value = f
    currentIdx.value = 0
    // 加载持久化的勾选
    const persistedChecks = storage.get<Record<string, boolean[]>>(CHECK_KEY(f.id)) || {}
    const persistedDone = storage.get<Record<string, boolean>>(STEP_KEY(f.id)) || {}
    const checksMap: Record<string, boolean[]> = {}
    f.steps.forEach(s => {
      const saved = persistedChecks[s.id]
      checksMap[s.id] = (s.checkPoints || []).map((_, i) =>
        Array.isArray(saved) && typeof saved[i] === 'boolean' ? saved[i] : false
      )
    })
    checks.value = checksMap
    stepDone.value = { ...persistedDone }
  }

  // 持久化（节流到 200ms）
  let saveTimer: number | null = null
  const persist = () => {
    if (!flow.value) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      if (!flow.value) return
      storage.set(CHECK_KEY(flow.value.id), checks.value)
      storage.set(STEP_KEY(flow.value.id), stepDone.value)
    }, 200)
  }
  watch(checks, persist, { deep: true })
  watch(stepDone, persist, { deep: true })

  const allChecked = (stepId: string) =>
    (checks.value[stepId] || []).every(Boolean)

  const toggleStepDone = (stepId: string) => {
    stepDone.value[stepId] = !stepDone.value[stepId]
  }

  const setStepDone = (stepId: string, done: boolean) => {
    stepDone.value[stepId] = done
  }

  const next = () => {
    if (currentIdx.value < totalSteps.value - 1) {
      if ('vibrate' in navigator) navigator.vibrate(60)
      currentIdx.value++
    }
  }
  const prev = () => { if (currentIdx.value > 0) currentIdx.value-- }

  return {
    flow, currentIdx, checks, stepDone,
    totalSteps, doneCount, progress, currentStep, remainingMin,
    setFlow, allChecked, toggleStepDone, setStepDone, next, prev
  }
})

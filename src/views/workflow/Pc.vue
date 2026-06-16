<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useWorkflowStore } from '@/stores/workflow'
import { getFlow, submitReport } from '@/api/workflow'
import { AlertTriangle, Clock, Wrench, BookOpen, ChevronLeft, CheckCircle2, Camera, ArrowRight } from 'lucide-vue-next'
import { showToast } from 'vant'

const wf = useWorkflowStore()

onMounted(async () => {
  const f = await getFlow()
  wf.setFlow(f)
})

const onNext = () => {
  if (!wf.currentStep) return
  if (!wf.allChecked(wf.currentStep.id)) {
    showToast('请先勾选所有合规校验点')
    return
  }
  if (wf.currentIdx === wf.totalSteps - 1) {
    submitReport({ flowId: wf.flow?.id })
    wf.next()
    return
  }
  wf.next()
}

const remainingMinFmt = computed(() => {
  const m = wf.remainingMin
  if (m < 60) return `${m} 分钟`
  return `${Math.floor(m / 60)} 时 ${m % 60} 分`
})

const completed = computed(() => wf.currentIdx >= wf.totalSteps && wf.totalSteps > 0)
</script>

<template>
  <div v-if="wf.flow" class="h-full flex flex-col overflow-hidden">
    <!-- 顶部 -->
    <header class="flex-shrink-0 px-6 py-4 bg-card border-b border-border">
      <div class="flex items-start gap-6 flex-wrap">
        <div class="flex-1 min-w-72">
          <div class="text-xs text-text-2 mb-1">作业指引 / 流程编号 {{ wf.flow.id }}</div>
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
            <div class="font-semibold text-accent mono">{{ Math.round(wf.progress * 100) }}%</div>
            <div class="text-text-2 ml-auto">{{ wf.currentIdx }} / {{ wf.totalSteps }}</div>
          </div>
          <div class="h-2 bg-border rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r from-accent to-accent-2 transition-all"
                 :style="{ width: wf.progress * 100 + '%' }"></div>
          </div>
        </div>
      </div>
    </header>

    <!-- 主体 -->
    <div class="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
      <!-- 流程时间线 -->
      <aside class="col-span-3 industrial-card overflow-auto">
        <div class="p-4 border-b border-border">
          <h3 class="text-sm font-semibold">流程步骤</h3>
        </div>
        <ol class="p-2">
          <li v-for="(s, i) in wf.flow.steps" :key="s.id"
              @click="wf.currentIdx = i"
              class="relative pl-10 pr-3 py-3 rounded-btn cursor-pointer hover:bg-bg transition"
              :class="i === wf.currentIdx ? 'bg-accent/10 border-l-4 border-accent !pl-9' : ''">
            <div class="absolute left-3 top-3 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mono"
                 :class="i < wf.currentIdx ? 'bg-success text-white'
                       : i === wf.currentIdx ? 'bg-accent text-white'
                       : 'bg-border text-text-2'">
              <CheckCircle2 v-if="i < wf.currentIdx" class="w-3 h-3" />
              <span v-else>{{ i + 1 }}</span>
            </div>
            <div class="text-sm font-medium" :class="i === wf.currentIdx ? 'text-accent' : ''">{{ s.name }}</div>
            <div class="text-xs text-text-2 mt-0.5 flex items-center gap-2">
              <Clock class="w-3 h-3" />{{ s.estMinutes }} 分钟
              <AlertTriangle v-if="s.hazardous" class="w-3 h-3 text-warning" />
            </div>
          </li>
        </ol>
      </aside>

      <!-- 当前步骤详情 -->
      <main class="col-span-6 overflow-auto">
        <div v-if="completed" class="industrial-card p-8 text-center">
          <div class="w-16 h-16 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 class="w-8 h-8" />
          </div>
          <h2 class="text-2xl font-bold text-primary">检修流程已完成</h2>
          <p class="text-text-2 mt-2">请上传现场照片并填写异常,系统将自动生成检修报告。</p>
          <div class="mt-6 grid grid-cols-2 gap-3 max-w-md mx-auto">
            <button class="h-11 rounded-btn border border-border bg-card hover:bg-bg flex items-center justify-center gap-2">
              <Camera class="w-4 h-4" /> 上传现场照片
            </button>
            <button class="h-11 rounded-btn bg-accent hover:bg-accent-2 text-white font-semibold">
              生成检修报告
            </button>
          </div>
        </div>

        <div v-else-if="wf.currentStep" class="industrial-card p-6">
          <div class="text-xs text-text-2 mb-1 mono">步骤 {{ wf.currentIdx + 1 }} / {{ wf.totalSteps }}</div>
          <h2 class="text-2xl font-bold text-primary">{{ wf.currentStep.name }}</h2>
          <div class="mt-2 flex items-center gap-3 text-sm text-text-2">
            <span class="inline-flex items-center gap-1"><Clock class="w-4 h-4" />预计 {{ wf.currentStep.estMinutes }} 分钟</span>
            <span v-if="wf.currentStep.manualRef" class="inline-flex items-center gap-1 text-accent cursor-pointer hover:underline">
              <BookOpen class="w-4 h-4" />{{ wf.currentStep.manualRef }}
            </span>
          </div>

          <div v-if="wf.currentStep.hazardous"
               class="hazard-stripe mt-4 px-4 py-2 rounded-card border border-warning/40 flex items-center gap-2 text-warning font-medium">
            <AlertTriangle class="w-5 h-5" /> 危险作业 · 必须严格执行 LOTO 与安全规程
          </div>

          <p class="mt-4 text-base leading-relaxed text-text">{{ wf.currentStep.desc }}</p>

          <!-- 校验点 -->
          <div class="mt-6">
            <div class="text-sm font-semibold mb-3">合规校验点 <span class="text-text-2 font-normal">(必须勾选才能下一步)</span></div>
            <div class="space-y-2">
              <label v-for="(cp, i) in wf.currentStep.checkPoints" :key="i"
                     class="flex items-start gap-3 p-3 industrial-card cursor-pointer hover:bg-bg transition">
                <input type="checkbox" :checked="wf.checks[wf.currentStep.id]?.[i]"
                       @change="wf.checks[wf.currentStep.id][i] = !wf.checks[wf.currentStep.id][i]"
                       class="w-5 h-5 mt-0.5 accent-accent flex-shrink-0" />
                <span class="text-sm leading-snug">{{ cp }}</span>
              </label>
            </div>
          </div>
        </div>
      </main>

      <!-- 工具/物料浮窗 -->
      <aside class="col-span-3 space-y-4 overflow-auto">
        <div v-if="wf.currentStep && !completed" class="industrial-card p-4">
          <h4 class="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <Wrench class="w-4 h-4 text-accent" /> 工具与物料
          </h4>
          <div v-if="wf.currentStep.tools?.length" class="mb-3">
            <div class="text-xs text-text-2 mb-1.5">所需工具</div>
            <div class="flex flex-wrap gap-1.5">
              <span v-for="t in wf.currentStep.tools" :key="t" class="px-2 py-1 rounded text-xs bg-bg border border-border">{{ t }}</span>
            </div>
          </div>
          <div v-if="wf.currentStep.materials?.length">
            <div class="text-xs text-text-2 mb-1.5">所需物料</div>
            <div class="flex flex-wrap gap-1.5">
              <span v-for="m in wf.currentStep.materials" :key="m" class="px-2 py-1 rounded text-xs bg-accent/10 text-accent border border-accent/30">{{ m }}</span>
            </div>
          </div>
        </div>

        <div class="industrial-card p-4">
          <h4 class="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <BookOpen class="w-4 h-4 text-ai" /> 关联手册
          </h4>
          <ul class="space-y-2 text-sm">
            <li class="text-accent hover:underline cursor-pointer">YKK630-4 异步电机检修手册 v3.2</li>
            <li class="text-accent hover:underline cursor-pointer">轴承拆卸安全规程 §2.1</li>
            <li class="text-accent hover:underline cursor-pointer">润滑脂使用标准 v1.4</li>
          </ul>
        </div>
      </aside>
    </div>

    <!-- 底部操作 -->
    <footer v-if="!completed" class="flex-shrink-0 h-16 px-6 border-t border-border bg-card flex items-center justify-between">
      <button @click="wf.prev()" :disabled="wf.currentIdx === 0"
              class="h-10 px-4 rounded-btn border border-border flex items-center gap-2 hover:bg-bg disabled:opacity-50 disabled:cursor-not-allowed">
        <ChevronLeft class="w-4 h-4" /> 上一步
      </button>
      <div class="text-sm text-text-2">
        提示: 危险步骤必须戴齐 PPE 并由二人以上执行
      </div>
      <button @click="onNext"
              class="h-10 px-6 rounded-btn bg-accent hover:bg-accent-2 text-white font-semibold flex items-center gap-2">
        {{ wf.currentIdx === wf.totalSteps - 1 ? '完成检修 · 生成报告' : '下一步' }}
        <ArrowRight class="w-4 h-4" />
      </button>
    </footer>
  </div>
  <div v-else class="p-12 text-center text-text-2">流程加载中…</div>
</template>

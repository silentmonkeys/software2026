<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useSearchStore } from '@/stores/search'
import { Camera, Mic, Sparkles, ListChecks, Upload, FileText, ArrowUpRight, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-vue-next'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { formatRelTime } from '@/utils/format'

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

const router = useRouter()
const user = useUserStore()
const search = useSearchStore()

const todos = [
  { id: 1, title: '主电机检修流程进行中 · 当前步骤 3/5', tag: '作业指引', urgent: true, path: '/workflow' },
  { id: 2, title: '提交的"液压站压力波动"案例待审核',  tag: '我的提交', path: '/history' },
  { id: 3, title: '冷却塔风机轴承备件已到货,可领取',    tag: '物料提醒' }
]

const quickEntries = [
  { icon: Camera, label: '拍照诊断', desc: '上传现场图,AI 多模态识别', path: '/search', color: 'from-accent to-accent-2' },
  { icon: Mic,    label: '语音输入', desc: '车间噪音环境快速描述',     path: '/search', color: 'from-ai   to-primary' },
  { icon: ListChecks, label: 'SOP 模板', desc: '标准化检修流程',         path: '/workflow', color: 'from-primary to-primary-2' },
  { icon: Upload, label: '我提交的案例', desc: '查看审核进度',           path: '/history', color: 'from-success to-success' }
]

const chartRef = ref<HTMLDivElement>()

onMounted(() => {
  if (!chartRef.value) return
  const inst = echarts.init(chartRef.value)
  inst.setOption({
    grid: { left: 8, right: 8, top: 12, bottom: 26, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: ['电机异响', '液压泄漏', '温度异常', '振动超标', '接线松动'],
      axisLine: { lineStyle: { color: '#E4E7ED' } },
      axisLabel: { color: '#6B7280', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#E4E7ED', type: 'dashed' } },
      axisLabel: { color: '#6B7280' }
    },
    series: [{
      type: 'bar',
      data: [128, 92, 76, 58, 41],
      itemStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: '#F26B1F' }, { offset: 1, color: '#FF7E36' }] },
        borderRadius: [4, 4, 0, 0]
      },
      barMaxWidth: 28
    }]
  })
  window.addEventListener('resize', () => inst.resize())
})
</script>

<template>
  <div class="p-6 max-w-[1600px] mx-auto space-y-6">
    <!-- 欢迎条 + 待办 -->
    <section class="industrial-card p-5 bg-circuit relative overflow-hidden">
      <div class="flex items-start gap-6 flex-wrap">
        <div class="flex-1 min-w-72">
          <div class="text-text-2 text-sm">{{ new Date().toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' }) }} · 早上好</div>
          <h1 class="text-2xl font-bold text-primary mt-1">{{ user.info?.name || '检修员' }} · {{ user.info?.workshop || '一号车间' }}</h1>
          <div class="mt-2 text-sm text-text-2">今日待办 <span class="text-accent font-semibold">{{ todos.length }}</span> 项,AI 已为您预排执行顺序</div>
        </div>
        <div class="flex-1 min-w-96 space-y-2">
          <div v-for="t in todos" :key="t.id"
               class="flex items-center gap-3 p-3 bg-bg rounded-card hover:bg-card hover:shadow-card transition cursor-pointer"
               @click="t.path && router.push(t.path)">
            <div class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
                 :class="t.urgent ? 'bg-warning/15 text-warning' : 'bg-ai/15 text-ai'">
              <AlertTriangle v-if="t.urgent" class="w-4 h-4" />
              <CheckCircle2 v-else class="w-4 h-4" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ t.title }}</div>
              <div class="text-xs text-text-2 mt-0.5">{{ t.tag }}</div>
            </div>
            <ArrowUpRight class="w-4 h-4 text-text-2" />
          </div>
        </div>
      </div>
    </section>

    <!-- 快捷入口 4 张卡 -->
    <section class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <button v-for="q in quickEntries" :key="q.label"
              @click="router.push(q.path)"
              class="industrial-card p-5 text-left hover:shadow-float hover:-translate-y-0.5 transition group">
        <div class="w-12 h-12 rounded-card bg-gradient-to-br text-white flex items-center justify-center mb-3"
             :class="q.color">
          <component :is="q.icon" class="w-6 h-6" />
        </div>
        <div class="text-base font-semibold text-text group-hover:text-accent transition">{{ q.label }}</div>
        <div class="text-sm text-text-2 mt-1">{{ q.desc }}</div>
      </button>
    </section>

    <!-- 最近检索 + 统计 -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="industrial-card p-5 lg:col-span-2">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-base font-semibold flex items-center gap-2">
            <FileText class="w-4 h-4" /> 最近检索记录
          </h2>
          <a class="text-sm text-accent cursor-pointer" @click="router.push('/history')">查看全部 →</a>
        </div>
        <ul class="divide-y divide-border">
          <li v-for="h in search.history.slice(0, 5)" :key="h.id"
              class="py-3 flex items-center gap-3 cursor-pointer hover:bg-bg -mx-2 px-2 rounded-btn"
              @click="router.push(`/search?q=${encodeURIComponent(h.text)}`)">
            <Sparkles class="w-4 h-4 text-ai flex-shrink-0" />
            <span class="flex-1 text-sm font-medium">{{ h.text }}</span>
            <span v-if="h.device" class="mono text-xs text-text-2 px-2 py-0.5 rounded bg-bg">{{ h.device }}</span>
            <span class="text-xs text-text-2 w-20 text-right">{{ formatRelTime(h.at) }}</span>
          </li>
        </ul>
      </div>

      <div class="industrial-card p-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-base font-semibold flex items-center gap-2">
            <TrendingUp class="w-4 h-4" /> Top 5 故障类型(本周)
          </h2>
        </div>
        <div ref="chartRef" class="h-56 w-full"></div>
        <div class="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border text-center">
          <div>
            <div class="text-2xl font-bold text-accent mono">2,481</div>
            <div class="text-xs text-text-2">总案例</div>
          </div>
          <div>
            <div class="text-2xl font-bold text-success mono">+38</div>
            <div class="text-xs text-text-2">本周新增</div>
          </div>
          <div>
            <div class="text-2xl font-bold text-ai mono">94.2%</div>
            <div class="text-xs text-text-2">AI 命中率</div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

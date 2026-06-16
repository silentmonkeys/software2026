<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useSearchStore } from '@/stores/search'
import { Camera, Mic, ListChecks, Upload, AlertTriangle, ChevronRight, Sparkles } from 'lucide-vue-next'
import { formatRelTime } from '@/utils/format'

const router = useRouter()
const user = useUserStore()
const search = useSearchStore()

const todos = [
  { id: 1, title: '主电机检修 进行中 3/5', tag: '指引', urgent: true, path: '/workflow' },
  { id: 2, title: '我的案例待审 1 条',     tag: '审核', path: '/history' },
  { id: 3, title: '备件已到货',            tag: '提醒' }
]

const quick = [
  { icon: Camera, label: '拍照诊断', desc: '调起相机',   path: '/search', cls: 'bg-gradient-to-br from-accent to-accent-2' },
  { icon: Mic,    label: '语音输入', desc: '长按说话',   path: '/search', cls: 'bg-gradient-to-br from-ai to-primary' },
  { icon: ListChecks, label: 'SOP 流程', desc: '继续检修', path: '/workflow', cls: 'bg-gradient-to-br from-primary to-primary-2' },
  { icon: Upload, label: '我的提交', desc: '查看进度',   path: '/history', cls: 'bg-gradient-to-br from-success to-success' }
]
</script>

<template>
  <div class="px-3 py-3 space-y-3">
    <!-- 欢迎条 -->
    <section class="industrial-card p-4 bg-circuit">
      <div class="text-xs text-text-2">{{ new Date().toLocaleDateString('zh-CN', { weekday: 'long' }) }} · 早上好</div>
      <h1 class="text-lg font-bold text-primary mt-1">{{ user.info?.name }} · {{ user.info?.workshop }}</h1>
      <div class="text-xs text-text-2 mt-1">今日待办 <span class="text-accent font-semibold">{{ todos.length }}</span> 项</div>
    </section>

    <!-- 横滑待办 -->
    <section class="overflow-x-auto -mx-3 px-3 hide-scrollbar">
      <div class="flex gap-3 pb-1">
        <div v-for="t in todos" :key="t.id"
             @click="t.path && router.push(t.path)"
             class="industrial-card p-3 w-64 flex-shrink-0">
          <div class="flex items-center gap-2 text-xs text-text-2">
            <span class="px-1.5 py-0.5 rounded text-[11px]"
                  :class="t.urgent ? 'bg-warning/15 text-warning' : 'bg-ai/15 text-ai'">
              {{ t.tag }}
            </span>
            <AlertTriangle v-if="t.urgent" class="w-3 h-3 text-warning" />
          </div>
          <div class="text-sm font-medium mt-2 leading-tight">{{ t.title }}</div>
        </div>
      </div>
    </section>

    <!-- 2x2 大卡片 -->
    <section class="grid grid-cols-2 gap-3">
      <button v-for="q in quick" :key="q.label" @click="router.push(q.path)"
              class="industrial-card h-28 p-4 text-left flex flex-col justify-between active:scale-95 transition">
        <div class="w-10 h-10 rounded-btn flex items-center justify-center text-white" :class="q.cls">
          <component :is="q.icon" class="w-5 h-5" />
        </div>
        <div>
          <div class="text-base font-semibold">{{ q.label }}</div>
          <div class="text-xs text-text-2">{{ q.desc }}</div>
        </div>
      </button>
    </section>

    <!-- 最近检索 -->
    <section class="industrial-card overflow-hidden">
      <div class="flex items-center justify-between px-4 h-11 border-b border-border">
        <div class="text-sm font-semibold flex items-center gap-1.5">
          <Sparkles class="w-4 h-4 text-ai" /> 最近检索
        </div>
        <button class="text-xs text-text-2" @click="router.push('/history')">全部</button>
      </div>
      <ul>
        <li v-for="h in search.history.slice(0, 5)" :key="h.id"
            class="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 active:bg-bg"
            @click="router.push(`/search?q=${encodeURIComponent(h.text)}`)">
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">{{ h.text }}</div>
            <div class="text-[11px] text-text-2 mt-0.5">
              <span v-if="h.device" class="mono mr-2">{{ h.device }}</span>
              {{ formatRelTime(h.at) }}
            </div>
          </div>
          <ChevronRight class="w-4 h-4 text-text-2" />
        </li>
      </ul>
    </section>

    <!-- 统计 -->
    <section class="grid grid-cols-3 gap-2">
      <div class="industrial-card p-3 text-center">
        <div class="text-xl font-bold text-accent mono">2,481</div>
        <div class="text-xs text-text-2">总案例</div>
      </div>
      <div class="industrial-card p-3 text-center">
        <div class="text-xl font-bold text-success mono">+38</div>
        <div class="text-xs text-text-2">本周新增</div>
      </div>
      <div class="industrial-card p-3 text-center">
        <div class="text-xl font-bold text-ai mono">94%</div>
        <div class="text-xs text-text-2">命中率</div>
      </div>
    </section>

    <button class="w-full h-9 text-xs text-text-2 hover:text-accent" @click="router.push('/dashboard')">点击查看故障 Top 5 详情 →</button>
  </div>
</template>

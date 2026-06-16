<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useSearchStore } from '@/stores/search'
import {
  Camera, Mic, ListChecks, Upload, AlertTriangle, ChevronRight, Sparkles,
  ShieldCheck, Bell, ChevronDown, Wrench, FileCheck2, Megaphone
} from 'lucide-vue-next'
import { formatRelTime } from '@/utils/format'
import { hasPermission } from '@/utils/permission'

const router = useRouter()
const user = useUserStore()
const search = useSearchStore()

// 三大模块:指引 / 审核 / 通知 —— 默认只展开"指引"
const expanded = ref<Record<string, boolean>>({ guide: true, audit: false, notice: false })
const toggleSimple = (k: string) => { expanded.value[k] = !expanded.value[k] }

const guideTasks = [
  { id: 1, title: '主电机检修流程进行中', sub: '当前 3/5 · 剩余 ~32 分钟', urgent: true, path: '/workflow' },
  { id: 2, title: '冷却塔风机轴承更换', sub: '一级·常规 · 预计 45 分钟', path: '/workflow' },
  { id: 3, title: '液压系统年度检修', sub: '三级·紧急 · 待开始', urgent: true, path: '/workflow' }
]

const auditItems = [
  { id: 'C-001', title: '液压站压力波动 异常处理', from: '李师傅', at: Date.now() - 30 * 60_000 },
  { id: 'C-002', title: '主轴电机轴承更换 案例补充', from: '陈工',   at: Date.now() - 4 * 3600_000 }
]

const notices = [
  { id: 1, level: 'urgent', title: '【安全】轴承拆卸 LOTO 必须二人作业', at: Date.now() - 2 * 3600_000 },
  { id: 2, level: 'info',   title: '【系统】知识图谱已新增 38 条故障案例', at: Date.now() - 1 * 86400_000 },
  { id: 3, level: 'info',   title: '【物料】Mobil Polyrex EM 润滑脂已到货', at: Date.now() - 2 * 86400_000 }
]

const quick = [
  { icon: Camera,     label: '拍照诊断', desc: '调起相机',   path: '/search',   cls: 'bg-gradient-to-br from-accent to-accent-2' },
  { icon: Mic,        label: '语音输入', desc: '长按说话',   path: '/search',   cls: 'bg-gradient-to-br from-ai to-primary' },
  { icon: ListChecks, label: 'SOP 流程', desc: '继续检修',   path: '/workflow', cls: 'bg-gradient-to-br from-primary to-primary-2' },
  { icon: Upload,     label: '我的提交', desc: '查看进度',   path: '/history',  cls: 'bg-gradient-to-br from-success to-success' }
]

const canAudit = hasPermission(user.role, ['auditor', 'admin'])
</script>

<template>
  <div class="px-3 py-3 space-y-3">
    <!-- 欢迎条 -->
    <section class="industrial-card p-4 bg-circuit">
      <div class="text-xs text-text-2">{{ new Date().toLocaleDateString('zh-CN', { weekday: 'long' }) }} · 早上好</div>
      <h1 class="text-lg font-bold text-primary mt-1">{{ user.info?.name }} · {{ user.info?.workshop }}</h1>
      <div class="text-xs text-text-2 mt-1">
        今日待办 <span class="text-accent font-semibold">{{ guideTasks.length }}</span> 项 ·
        待审 <span class="text-warning font-semibold">{{ canAudit ? auditItems.length : 0 }}</span> 条 ·
        通知 <span class="text-ai font-semibold">{{ notices.length }}</span> 条
      </div>
    </section>

    <!-- 2x2 大卡片(快捷入口) -->
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

    <!-- ============ 三个垂直可折叠模块 ============ -->

    <!-- 指引 -->
    <section class="industrial-card overflow-hidden">
      <button class="w-full h-12 px-4 flex items-center gap-2 active:bg-bg" @click="toggleSimple('guide')">
        <Wrench class="w-4 h-4 text-accent" />
        <span class="font-semibold text-sm">作业指引</span>
        <span class="text-xs text-text-2">进行中 1 · 待开始 {{ guideTasks.length - 1 }}</span>
        <ChevronDown class="w-4 h-4 ml-auto transition-transform" :class="expanded.guide ? 'rotate-180' : ''" />
      </button>
      <transition name="collapse">
        <ul v-show="expanded.guide" class="border-t border-border">
          <li v-for="t in guideTasks" :key="t.id"
              class="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 active:bg-bg"
              @click="router.push(t.path)">
            <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                 :class="t.urgent ? 'bg-warning/15 text-warning' : 'bg-ai/15 text-ai'">
              <AlertTriangle v-if="t.urgent" class="w-4 h-4" />
              <Wrench v-else class="w-4 h-4" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ t.title }}</div>
              <div class="text-xs text-text-2 mt-0.5">{{ t.sub }}</div>
            </div>
            <ChevronRight class="w-4 h-4 text-text-2 flex-shrink-0" />
          </li>
        </ul>
      </transition>
    </section>

    <!-- 审核(仅审核员/管理员可见) -->
    <section v-if="canAudit" class="industrial-card overflow-hidden">
      <button class="w-full h-12 px-4 flex items-center gap-2 active:bg-bg" @click="toggleSimple('audit')">
        <ShieldCheck class="w-4 h-4 text-warning" />
        <span class="font-semibold text-sm">案例审核</span>
        <span class="text-xs text-text-2">待审 {{ auditItems.length }} 条</span>
        <ChevronDown class="w-4 h-4 ml-auto transition-transform" :class="expanded.audit ? 'rotate-180' : ''" />
      </button>
      <transition name="collapse">
        <ul v-show="expanded.audit" class="border-t border-border">
          <li v-for="a in auditItems" :key="a.id"
              class="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 active:bg-bg"
              @click="router.push('/audit')">
            <div class="w-8 h-8 rounded-full bg-warning/15 text-warning flex items-center justify-center flex-shrink-0">
              <FileCheck2 class="w-4 h-4" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ a.title }}</div>
              <div class="text-xs text-text-2 mt-0.5">
                <span class="mono mr-2">{{ a.id }}</span>
                提交人: {{ a.from }} · {{ formatRelTime(a.at) }}
              </div>
            </div>
            <ChevronRight class="w-4 h-4 text-text-2 flex-shrink-0" />
          </li>
        </ul>
      </transition>
    </section>

    <!-- 通知 -->
    <section class="industrial-card overflow-hidden">
      <button class="w-full h-12 px-4 flex items-center gap-2 active:bg-bg" @click="toggleSimple('notice')">
        <Bell class="w-4 h-4 text-ai" />
        <span class="font-semibold text-sm">通知公告</span>
        <span class="text-xs text-text-2">{{ notices.length }} 条</span>
        <ChevronDown class="w-4 h-4 ml-auto transition-transform" :class="expanded.notice ? 'rotate-180' : ''" />
      </button>
      <transition name="collapse">
        <ul v-show="expanded.notice" class="border-t border-border">
          <li v-for="n in notices" :key="n.id"
              class="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
            <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                 :class="n.level === 'urgent' ? 'bg-danger/15 text-danger' : 'bg-ai/15 text-ai'">
              <Megaphone class="w-4 h-4" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ n.title }}</div>
              <div class="text-xs text-text-2 mt-0.5">{{ formatRelTime(n.at) }}</div>
            </div>
          </li>
        </ul>
      </transition>
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

    <button class="w-full h-9 text-xs text-text-2 hover:text-accent" @click="router.push('/dashboard')">
      点击查看故障 Top 5 详情 →
    </button>
  </div>
</template>

<style scoped>
.collapse-enter-active, .collapse-leave-active { transition: opacity .2s, max-height .25s ease; max-height: 800px; overflow: hidden; }
.collapse-enter-from, .collapse-leave-to { opacity: 0; max-height: 0; }
.rotate-180 { transform: rotate(180deg); }
</style>

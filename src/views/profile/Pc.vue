<script setup lang="ts">
/**
 * 个人中心（FIX4 第 1 项）—— 全部数据从 API / Store 取，零假数据
 *  - 用户信息：来自 user store / 后端 /api/auth/me（如果实现的话）
 *  - 上传统计：调用 kbApi.listDocs({ uploader: 'me' }) 实时统计
 *  - 工单统计：调用 ticket listTickets() 后按当前 ownerId 统计（后端目前不分用户，全列表统计）
 *  - 历史/收藏统计：从 chatHistory store 读取
 *  - 接口缺失时显示"加载失败"或"暂无数据"，不允许任何硬编码
 */
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { useChatHistoryStore } from '@/stores/chatHistory'
import { ROLE_LABEL } from '@/utils/permission'
import { useDevice } from '@/composables/useDevice'
import {
  Award, FileText, Sparkles, ShieldCheck, Bell, Edit, Lock,
  Loader, AlertTriangle, MessageCircle, Star, Database, ListChecks
} from 'lucide-vue-next'
import { listDocs, type KbDoc, isApprovedStatus, STATUS_LABEL } from '@/api/kb'
import { listTickets, type TicketSummary } from '@/api/ticket'
import { formatTime } from '@/utils/format'

const user = useUserStore()
const { isPC } = useDevice()
const chat = useChatHistoryStore()

const tab = ref<'basic' | 'security' | 'notif' | 'contrib'>('basic')
const tabs = [
  { k: 'basic',    l: '基本信息', icon: Edit },
  { k: 'security', l: '安全设置', icon: Lock },
  { k: 'notif',    l: '通知偏好', icon: Bell },
  { k: 'contrib',  l: '我的贡献', icon: Award }
]

// —— 真实统计 —— //
const myDocs = ref<KbDoc[]>([])
const myTickets = ref<TicketSummary[]>([])
const docsLoading = ref(false)
const ticketsLoading = ref(false)
const docsError = ref(false)
const ticketsError = ref(false)

const refreshDocs = async () => {
  docsLoading.value = true
  docsError.value = false
  try {
    myDocs.value = await listDocs({ uploader: 'me' })
  } catch {
    myDocs.value = []
    docsError.value = true
  } finally {
    docsLoading.value = false
  }
}
const refreshTickets = async () => {
  ticketsLoading.value = true
  ticketsError.value = false
  try {
    myTickets.value = await listTickets()
  } catch {
    myTickets.value = []
    ticketsError.value = true
  } finally {
    ticketsLoading.value = false
  }
}

onMounted(() => { refreshDocs(); refreshTickets() })

const stats = computed(() => ({
  docsTotal: myDocs.value.length,
  docsPending: myDocs.value.filter(d => d.status === 'pending').length,
  docsApproved: myDocs.value.filter(d => isApprovedStatus(d.status)).length,
  docsRejected: myDocs.value.filter(d => d.status === 'rejected').length,
  ticketsPending: myTickets.value.filter(t => t.status === 'pending').length,
  ticketsDone: myTickets.value.filter(t => t.status === 'done').length,
  sessions: chat.sessions.length,
  starred: chat.starredSessions.length
}))

const recentDocs = computed(() =>
  [...myDocs.value]
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, 5)
)

const STATUS_CLS: Record<string, string> = {
  pending:    'text-warning',
  approved:   'text-success',
  ready:      'text-success',
  rejected:   'text-danger',
  taken_down: 'text-text-2'
}
</script>

<template>
  <div :class="isPC ? 'p-6 max-w-6xl mx-auto grid grid-cols-12 gap-4' : 'p-3 space-y-3'">
    <!-- 头像卡 -->
    <aside :class="isPC ? 'col-span-3 industrial-card p-5' : 'industrial-card p-4'">
      <div :class="isPC ? 'text-center' : 'flex items-center gap-3'">
        <div class="w-20 h-20 rounded-full bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center text-white text-3xl font-bold flex-shrink-0"
             :class="isPC ? 'mx-auto' : ''">
          {{ (user.info?.name || '游').slice(0, 1) }}
        </div>
        <div :class="isPC ? 'mt-3' : 'flex-1 min-w-0'">
          <div class="text-lg font-bold">{{ user.info?.name || '访客' }}</div>
          <div class="text-xs text-text-2 mt-0.5">{{ ROLE_LABEL[user.role] }}</div>
          <div v-if="user.info?.workshop" class="text-xs text-text-2 mt-0.5 truncate">{{ user.info.workshop }}</div>
        </div>
      </div>

      <!-- 移动端三宫格贡献（用真实数据） -->
      <div v-if="!isPC" class="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-border text-center">
        <div>
          <div class="font-bold text-base text-accent mono">{{ stats.docsTotal }}</div>
          <div class="text-[11px] text-text-2">提交文档</div>
        </div>
        <div>
          <div class="font-bold text-base text-success mono">{{ stats.docsApproved }}</div>
          <div class="text-[11px] text-text-2">已通过</div>
        </div>
        <div>
          <div class="font-bold text-base text-ai mono">{{ stats.sessions }}</div>
          <div class="text-[11px] text-text-2">检索会话</div>
        </div>
      </div>
    </aside>

    <!-- 主内容 -->
    <main :class="isPC ? 'col-span-9 industrial-card p-5' : 'industrial-card p-3'">
      <div :class="isPC ? 'flex border-b border-border -mx-5 px-5 mb-4' : 'flex gap-1 mb-3'">
        <button v-for="t in tabs" :key="t.k" @click="tab = t.k as any"
                :class="[isPC ? 'h-10 px-4 text-sm border-b-2 -mb-px' : 'flex-1 h-9 rounded-btn text-xs',
                         tab === t.k
                           ? (isPC ? 'border-accent text-accent font-semibold' : 'bg-accent text-white font-semibold')
                           : (isPC ? 'border-transparent text-text-2' : 'bg-card border border-border text-text-2')]">
          <component :is="t.icon" class="w-4 h-4 inline mr-1" />{{ t.l }}
        </button>
      </div>

      <!-- 基本信息 -->
      <div v-if="tab === 'basic'" class="space-y-3 text-sm">
        <div class="grid grid-cols-2 gap-3">
          <div><div class="text-text-2 text-xs mb-1">用户名</div><div class="font-medium">{{ user.info?.name || '—' }}</div></div>
          <div><div class="text-text-2 text-xs mb-1">用户 ID</div><div class="font-medium mono">{{ user.info?.id || '—' }}</div></div>
          <div><div class="text-text-2 text-xs mb-1">所属车间</div><div>{{ user.info?.workshop || '未设置' }}</div></div>
          <div><div class="text-text-2 text-xs mb-1">角色</div><div>{{ ROLE_LABEL[user.role] }}</div></div>
        </div>
        <div class="text-xs text-text-2 italic mt-3">
          基本信息由登录账号决定。如需修改请联系管理员。
        </div>
      </div>

      <!-- 安全设置 -->
      <div v-if="tab === 'security'" class="space-y-2 text-sm">
        <div class="text-xs text-text-2 italic mb-2">
          后端尚未实现密码 / 设备 / 手机绑定接口；以下操作暂不可用。
        </div>
        <button disabled class="w-full h-12 px-3 rounded-btn border border-border flex items-center justify-between opacity-60 cursor-not-allowed">
          修改密码 <span class="text-text-2 text-xs">即将开放</span>
        </button>
        <button disabled class="w-full h-12 px-3 rounded-btn border border-border flex items-center justify-between opacity-60 cursor-not-allowed">
          绑定手机 <span class="text-text-2 text-xs">即将开放</span>
        </button>
        <button disabled class="w-full h-12 px-3 rounded-btn border border-border flex items-center justify-between opacity-60 cursor-not-allowed">
          登录设备管理 <span class="text-text-2 text-xs">即将开放</span>
        </button>
      </div>

      <!-- 通知偏好 -->
      <div v-if="tab === 'notif'" class="space-y-2 text-sm">
        <div class="text-xs text-text-2 italic mb-2">
          后端尚未实现通知偏好接口；当前仅作占位展示。
        </div>
        <label v-for="n in ['案例审核结果', '待办流程提醒', '系统公告', '夜间静默']" :key="n"
               class="flex items-center justify-between h-12 px-3 rounded-btn border border-border opacity-60">
          <span>{{ n }}</span>
          <input type="checkbox" disabled class="w-5 h-5 accent-accent" />
        </label>
      </div>

      <!-- 我的贡献（真实数据） -->
      <div v-if="tab === 'contrib'" class="space-y-3">
        <div v-if="docsLoading || ticketsLoading" class="py-8 text-center text-text-2">
          <Loader class="w-5 h-5 mx-auto animate-spin text-accent" />
          <div class="mt-2 text-xs">统计加载中…</div>
        </div>
        <template v-else>
          <!-- 概览 -->
          <div :class="isPC ? 'grid grid-cols-4 gap-3' : 'grid grid-cols-2 gap-2'">
            <div class="industrial-card p-4 text-center">
              <Database class="w-6 h-6 mx-auto text-accent mb-1" />
              <div class="text-2xl font-bold mono">{{ stats.docsTotal }}</div>
              <div class="text-xs text-text-2">提交文档</div>
              <div v-if="stats.docsPending" class="text-[10px] text-warning mt-0.5">待审 {{ stats.docsPending }}</div>
            </div>
            <div class="industrial-card p-4 text-center">
              <ShieldCheck class="w-6 h-6 mx-auto text-success mb-1" />
              <div class="text-2xl font-bold mono">{{ stats.docsApproved }}</div>
              <div class="text-xs text-text-2">通过审核</div>
              <div v-if="stats.docsRejected" class="text-[10px] text-danger mt-0.5">被驳回 {{ stats.docsRejected }}</div>
            </div>
            <div class="industrial-card p-4 text-center">
              <ListChecks class="w-6 h-6 mx-auto text-ai mb-1" />
              <div class="text-2xl font-bold mono">{{ stats.ticketsPending + stats.ticketsDone }}</div>
              <div class="text-xs text-text-2">关联工单</div>
              <div v-if="stats.ticketsPending" class="text-[10px] text-accent mt-0.5">待办 {{ stats.ticketsPending }}</div>
            </div>
            <div class="industrial-card p-4 text-center">
              <MessageCircle class="w-6 h-6 mx-auto text-primary mb-1" />
              <div class="text-2xl font-bold mono">{{ stats.sessions }}</div>
              <div class="text-xs text-text-2">检索会话</div>
              <div v-if="stats.starred" class="text-[10px] text-warning mt-0.5">
                <Star class="w-2.5 h-2.5 inline -mt-px" /> {{ stats.starred }}
              </div>
            </div>
          </div>

          <!-- 错误态 -->
          <div v-if="docsError || ticketsError"
               class="px-3 py-2 rounded-btn bg-warning/10 border border-warning/30 text-warning text-xs flex items-center gap-1.5">
            <AlertTriangle class="w-3.5 h-3.5" />
            部分统计数据加载失败（{{ [docsError ? '文档' : '', ticketsError ? '工单' : ''].filter(Boolean).join(' / ') }}），请确认后端可用。
          </div>

          <!-- 最近上传 -->
          <div class="industrial-card p-4 text-sm">
            <div class="font-semibold mb-2 flex items-center gap-2">
              <FileText class="w-4 h-4 text-accent" /> 最近上传
              <span class="text-xs text-text-2 font-normal mono">{{ recentDocs.length }} / {{ stats.docsTotal }}</span>
            </div>
            <ul v-if="recentDocs.length" class="divide-y divide-border">
              <li v-for="d in recentDocs" :key="d.id" class="py-2 flex items-center gap-2">
                <FileText class="w-4 h-4 text-text-2 flex-shrink-0" />
                <span class="flex-1 truncate">{{ d.title }}</span>
                <span class="text-[11px] mono text-text-2 hidden sm:inline">{{ formatTime(d.created_at) }}</span>
                <span class="text-xs flex-shrink-0" :class="STATUS_CLS[d.status] || 'text-text-2'">
                  {{ STATUS_LABEL[d.status] || d.status }}
                </span>
              </li>
            </ul>
            <div v-else class="text-center text-text-2 text-sm py-6">
              <Database class="w-8 h-8 mx-auto opacity-40" />
              <div class="mt-2">{{ docsError ? '加载失败' : '尚未上传过文档' }}</div>
            </div>
          </div>
        </template>
      </div>
    </main>
  </div>
</template>

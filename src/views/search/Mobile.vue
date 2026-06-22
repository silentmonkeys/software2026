<script setup lang="ts">
/**
 * 移动端检索 · 对话式布局（FIX3 第 2/3/6 项）
 * - 删除"试试这些问题"+ "建议追问"
 * - markdown 渲染、来源与消息绑定、按 userId 持久化
 */
import { ref, nextTick, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { Sparkles, Bot, User as UserIcon, BookOpen, Image as ImageIcon, Loader, ChevronDown, ChevronUp, Trash2, Star, ListChecks, UserPlus, Check } from 'lucide-vue-next'
import { showConfirmDialog, showSuccessToast, showFailToast } from 'vant'
import * as searchApi from '@/api/search'
import { addTicketToMine } from '@/api/ticket'
import { useSearchStore } from '@/stores/search'
import { useChatHistoryStore, nanoid, type SourceItem } from '@/stores/chatHistory'
import { renderMarkdown } from '@/utils/markdown'
import MobileInputBar from '@/components/mobile/MobileInputBar.vue'

const route = useRoute()
const store = useSearchStore()
const chat = useChatHistoryStore()

const text = ref(typeof route.query.q === 'string' ? route.query.q : '')
const images = ref<string[]>([])
const imageFiles = ref<File[]>([])
const sending = ref(false)
const scrollEl = ref<HTMLDivElement>()
const expandedSources = ref<Record<string, boolean>>({})

const sessionId = ref<string>('')
const session = computed(() => sessionId.value ? chat.getSession(sessionId.value) : null)
const messages = computed(() => session.value?.messages || [])
const hasMessages = computed(() => messages.value.length > 0)

const ensureSession = () => {
  if (!sessionId.value) {
    sessionId.value = chat.createSession().id
    store.setActiveSession(sessionId.value)  // FIX6-resume M2
  }
  return sessionId.value
}

/** 推荐工单：一键添加到我的工单（FIX5 第 13 项） */
const addingTicket = ref<Record<number, boolean>>({})
const onAddTicket = async (msgId: string, ticketId: number) => {
  addingTicket.value[ticketId] = true
  try {
    await addTicketToMine(ticketId)
    showSuccessToast('已添加到我的工单')
    const msg = messages.value.find(m => m.id === msgId)
    const rt = msg?.recommendedTickets?.find(t => t.id === ticketId)
    if (rt) rt.added = true
  } catch (e: any) {
    showFailToast(e?.message || '添加失败')
  } finally {
    addingTicket.value[ticketId] = false
  }
}

const onPickFiles = (files: File[]) => { imageFiles.value.push(...files) }

const scrollToBottom = async () => {
  await nextTick()
  scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' })
}

const onSend = async () => {
  const t = text.value.trim()
  if (!t && !images.value.length) return
  if (sending.value) return

  ensureSession()
  const sid = sessionId.value

  const userMsgId = nanoid()
  chat.appendMessage(sid, {
    id: userMsgId, role: 'user',
    content: t, images: [...images.value], createdAt: Date.now()
  })

  const aiId = nanoid()
  chat.appendMessage(sid, {
    id: aiId, role: 'assistant',
    content: '', sources: [], imageObservation: '', createdAt: Date.now()
  })

  const file = imageFiles.value[0] || null
  text.value = ''
  images.value = []
  imageFiles.value = []
  if (t) store.push(t)
  store.clearDraft()  // FIX6 第 9 项：提交成功后清除草稿
  sending.value = true
  await scrollToBottom()

  // FIX6-resume M2：异步流程登记到 store；切走时后台继续，切回时同步
  const job = (async () => {
    try {
      const res = await searchApi.multimodalSearch({ text: t, imageFile: file })
      const sources: SourceItem[] = (res.hits || []).map((h, i) => ({
        id: h.id || `src-${i}`,
        docId: (h.meta as any)?.docId,
        title: h.title,
        snippet: h.snippet || '',
        similarity: h.similarity,
        page: (h.meta as any)?.page
      }))
      chat.updateMessage(sid, aiId, {
        content: res.summary || '（后端未返回内容）',
        sources,
        imageObservation: res.imageObservation || '',
        recommendedTickets: res.recommendedTickets || []
      })
    } catch (e: any) {
      chat.updateMessage(sid, aiId, { error: e?.message || '检索失败，请稍后重试' })
    }
  })()
  store.setPending(aiId, job)
  try {
    await job
  } finally {
    if (store.pendingAssistantId === aiId) store.setPending('', null)
    sending.value = false
    await scrollToBottom()
  }
}

const onVoice = (t: string) => { text.value = t; onSend() }

const clearHistory = async () => {
  try {
    await showConfirmDialog({ title: '清空当前对话?', message: '清空后将开始新会话，已保存的历史不受影响。' })
  } catch { return }
  sessionId.value = ''
  store.clearActiveSession()  // FIX6-resume M2
}

const toggleStar = () => { if (sessionId.value) chat.toggleStar(sessionId.value) }

watch(() => route.query.session, (v) => {
  if (typeof v === 'string' && chat.getSession(v)) sessionId.value = v
}, { immediate: true })

// FIX6-resume M2：跨路由保留检索表单草稿 + 活动会话
onMounted(() => {
  if (text.value) {
    onSend()
  } else if (store.activeSessionId && chat.getSession(store.activeSessionId)) {
    sessionId.value = store.activeSessionId
    if (store.pendingAssistantId && store.pendingPromise) {
      sending.value = true
      store.pendingPromise.finally(() => {
        sending.value = false
        scrollToBottom()
      })
    }
    scrollToBottom()
  } else {
    const d = store.draft
    if (d.question) text.value = d.question
    if (store.draftImages.length) {
      imageFiles.value = [...store.draftImages]
      images.value = store.draft.imageUrls.slice()
    }
  }
})
onBeforeUnmount(() => {
  if (text.value || imageFiles.value.length) {
    store.setDraft(text.value, imageFiles.value, images.value)
  }
})
</script>

<template>
  <div class="h-full flex flex-col bg-bg">
    <!-- 初始空态（FIX3 第 6 项：去掉示例提示） -->
    <div v-if="!hasMessages" class="flex-1 overflow-auto px-4 flex flex-col items-center justify-center">
      <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white flex items-center justify-center mb-3">
        <Sparkles class="w-8 h-8" />
      </div>
      <h1 class="text-xl font-bold text-primary">设备检修智能检索</h1>
      <div class="mt-1 text-xs text-text-2 text-center max-w-xs">描述故障或拍照上传，AI 即刻给出检修建议</div>
    </div>

    <template v-else>
      <header class="flex-shrink-0 px-4 py-2.5 border-b border-border bg-card flex items-center gap-2 safe-top">
        <Sparkles class="w-4 h-4 text-accent" />
        <span class="text-sm font-semibold flex-1 truncate">{{ session?.title || '智能检索' }}</span>
        <button @click="toggleStar"
                class="h-7 px-2 rounded-btn text-xs flex items-center gap-1"
                :class="session?.starred ? 'text-warning' : 'text-text-2 active:bg-bg'">
          <Star class="w-3.5 h-3.5" :fill="session?.starred ? 'currentColor' : 'none'" />
        </button>
        <button @click="clearHistory" class="h-7 px-2 rounded-btn text-xs text-text-2 active:bg-bg flex items-center gap-1">
          <Trash2 class="w-3.5 h-3.5" /> 新建
        </button>
      </header>

      <div ref="scrollEl" class="flex-1 overflow-auto px-3 py-3 space-y-4">
        <template v-for="m in messages" :key="m.id">
          <div v-if="m.role === 'user'" class="flex justify-end">
            <div class="flex items-start gap-2 max-w-[85%]">
              <div class="bg-accent text-white px-3 py-2 rounded-2xl rounded-tr-sm shadow-card">
                <div v-if="m.images && m.images.length" class="grid grid-cols-3 gap-1 mb-1.5">
                  <img v-for="(u, j) in m.images" :key="j" :src="u" class="w-full aspect-square object-cover rounded" />
                </div>
                <p v-if="m.content" class="text-sm leading-relaxed whitespace-pre-wrap break-words">{{ m.content }}</p>
              </div>
              <div class="w-7 h-7 rounded-full bg-bg border border-border flex items-center justify-center flex-shrink-0 text-text-2">
                <UserIcon class="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          <div v-else class="flex justify-start">
            <div class="flex items-start gap-2 max-w-[88%] flex-1">
              <div class="w-7 h-7 rounded-full bg-ai/10 text-ai flex items-center justify-center flex-shrink-0">
                <Bot class="w-3.5 h-3.5" />
              </div>
              <div class="flex-1 min-w-0">
                <div v-if="!m.content && !m.error" class="industrial-card p-3 border-l-2 border-l-ai bg-ai/5">
                  <div class="flex items-center gap-2 text-text-2 text-sm">
                    <Loader class="w-3.5 h-3.5 animate-spin text-ai" /> 检索中…
                  </div>
                </div>
                <div v-else-if="m.error" class="industrial-card p-3 border-l-2 border-l-danger">
                  <div class="text-danger text-sm">⚠️ {{ m.error }}</div>
                </div>
                <div v-else class="industrial-card p-3 border-l-2 border-l-ai">
                  <div v-if="m.imageObservation" class="mb-2 px-2 py-1.5 rounded-btn bg-bg text-[11px] text-text-2 italic">
                    <ImageIcon class="w-3 h-3 inline mr-1 -mt-0.5" />
                    {{ m.imageObservation }}
                  </div>
                  <div class="md-body" v-html="renderMarkdown(m.content)"></div>

                  <!-- 推荐工单（FIX5 第 13 项） -->
                  <div v-if="m.recommendedTickets && m.recommendedTickets.length" class="mt-3 pt-2 border-t border-border">
                    <div class="text-xs font-semibold text-ai flex items-center gap-1.5 mb-2">
                      <ListChecks class="w-3.5 h-3.5" /> 相关作业工单
                    </div>
                    <div class="space-y-2">
                      <div v-for="rt in m.recommendedTickets" :key="rt.id"
                           class="px-3 py-2 rounded-btn bg-bg border border-border">
                        <div class="text-sm font-medium text-text truncate">{{ rt.fault || ('工单 #' + rt.id) }}</div>
                        <div class="text-[11px] text-text-2 mono mt-0.5 truncate">{{ rt.device }}</div>
                        <button v-if="!rt.added" @click="onAddTicket(m.id, rt.id)" :disabled="addingTicket[rt.id]"
                                class="mt-2 h-7 px-3 rounded-btn border border-accent/40 text-accent text-xs font-semibold flex items-center gap-1 disabled:opacity-60">
                          <Loader v-if="addingTicket[rt.id]" class="w-3 h-3 animate-spin" />
                          <UserPlus v-else class="w-3 h-3" /> 添加到我的工单
                        </button>
                        <div v-else class="mt-2 text-xs text-success flex items-center gap-1">
                          <Check class="w-3 h-3" /> 已在我的工单
                        </div>
                      </div>
                    </div>
                  </div>

                  <div v-if="m.sources && m.sources.length" class="mt-3 pt-2 border-t border-border">
                    <button @click="expandedSources[m.id] = !expandedSources[m.id]"
                            class="text-xs text-text-2 flex items-center gap-1">
                      <BookOpen class="w-3.5 h-3.5" />
                      查看 {{ m.sources.length }} 条引用
                      <ChevronDown v-if="!expandedSources[m.id]" class="w-3.5 h-3.5" />
                      <ChevronUp v-else class="w-3.5 h-3.5" />
                    </button>
                    <ol v-if="expandedSources[m.id]" class="mt-1.5 space-y-1.5">
                      <li v-for="(h, hi) in m.sources" :key="h.id"
                          class="text-[11px] px-2.5 py-1.5 rounded-btn bg-bg border border-border">
                        <div class="flex items-start gap-1.5">
                          <span class="mono text-text-2">[{{ hi + 1 }}]</span>
                          <div class="flex-1 min-w-0">
                            <div class="font-medium text-text">{{ h.title }}</div>
                            <div v-if="h.snippet" class="mt-0.5 text-text-2 leading-relaxed line-clamp-2">{{ h.snippet }}</div>
                          </div>
                        </div>
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>

    <MobileInputBar v-model="text" v-model:images="images"
                    @send="onSend" @voice="onVoice" @pick="onPickFiles" />
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

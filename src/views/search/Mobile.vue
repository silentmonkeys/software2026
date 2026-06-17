<script setup lang="ts">
/**
 * 移动端检索 · 对话式布局（FIX3 第 2/3/6 项）
 * - 删除"试试这些问题"+ "建议追问"
 * - markdown 渲染、来源与消息绑定、按 userId 持久化
 */
import { ref, nextTick, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Sparkles, Bot, User as UserIcon, BookOpen, Image as ImageIcon, Loader, ChevronDown, ChevronUp, Trash2, Star } from 'lucide-vue-next'
import { showConfirmDialog } from 'vant'
import * as searchApi from '@/api/search'
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
  if (!sessionId.value) sessionId.value = chat.createSession().id
  return sessionId.value
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
  sending.value = true
  await scrollToBottom()

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
      imageObservation: res.imageObservation || ''
    })
  } catch (e: any) {
    chat.updateMessage(sid, aiId, { error: e?.message || '检索失败，请稍后重试' })
  } finally {
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
}

const toggleStar = () => { if (sessionId.value) chat.toggleStar(sessionId.value) }

watch(() => route.query.session, (v) => {
  if (typeof v === 'string' && chat.getSession(v)) sessionId.value = v
}, { immediate: true })

onMounted(() => { if (text.value) onSend() })
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

<script setup lang="ts">
/**
 * PC 端检索 · 对话式布局（FIX3 第 2/3/6 项）
 *
 * - 删除"试试这些问题"区块（FIX3 第 6 项）
 * - assistant 回复用 markdown-it 渲染（FIX3 第 3.1 项）
 * - 来源引用与本条消息绑定（FIX3 第 3.2 项）
 * - 整条会话落 chatHistory store，按 userId 隔离（FIX3 第 2.1/3.3 项）
 */
import { ref, nextTick, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Sparkles, Paperclip, Send, X, Image as ImageIcon, BookOpen, Bot, User as UserIcon, ChevronDown, ChevronUp, Loader, Trash2, Star } from 'lucide-vue-next'
import * as searchApi from '@/api/search'
import { useSearchStore } from '@/stores/search'
import { useChatHistoryStore, nanoid, type SourceItem } from '@/stores/chatHistory'
import { renderMarkdown } from '@/utils/markdown'
import { showConfirmDialog } from 'vant'

const route = useRoute()
const store = useSearchStore()
const chat = useChatHistoryStore()

const input = ref(typeof route.query.q === 'string' ? route.query.q : '')
const imageList = ref<{ url: string; name: string; file: File }[]>([])
const sending = ref(false)
const dragging = ref(false)
const fileInput = ref<HTMLInputElement>()
const scrollEl = ref<HTMLDivElement>()
const expandedSources = ref<Record<string, boolean>>({})

/** 当前会话；首次发送时再创建，避免空会话被收藏 */
const sessionId = ref<string>('')
const messages = computed(() => sessionId.value ? (chat.getSession(sessionId.value)?.messages || []) : [])
const session = computed(() => sessionId.value ? chat.getSession(sessionId.value) : null)
const hasMessages = computed(() => messages.value.length > 0)

const ensureSession = () => {
  if (!sessionId.value) {
    const s = chat.createSession()
    sessionId.value = s.id
  }
  return sessionId.value
}

const onPickFiles = (files: FileList | null) => {
  if (!files) return
  Array.from(files).forEach(f => imageList.value.push({ url: URL.createObjectURL(f), name: f.name, file: f }))
}
const onDrop = (e: DragEvent) => {
  e.preventDefault(); dragging.value = false
  onPickFiles(e.dataTransfer?.files || null)
}

const scrollToBottom = async () => {
  await nextTick()
  scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' })
}

const onSend = async () => {
  const text = input.value.trim()
  if (!text && !imageList.value.length) return
  if (sending.value) return

  ensureSession()
  const sid = sessionId.value

  // 1) 投递用户消息
  const userMsgId = nanoid()
  chat.appendMessage(sid, {
    id: userMsgId,
    role: 'user',
    content: text,
    images: imageList.value.map(i => i.url),
    createdAt: Date.now()
  })

  // 2) 占位的 assistant 消息（loading）
  const aiId = nanoid()
  chat.appendMessage(sid, {
    id: aiId,
    role: 'assistant',
    content: '',
    sources: [],
    imageObservation: '',
    createdAt: Date.now()
  })

  // 3) 同步保留首张图发到后端，再清空输入区
  const file = imageList.value[0]?.file || null
  input.value = ''
  imageList.value = []
  if (text) store.push(text)
  sending.value = true
  await scrollToBottom()

  try {
    const res = await searchApi.multimodalSearch({ text, imageFile: file })
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
    expandedSources.value[aiId] = true
  } catch (e: any) {
    chat.updateMessage(sid, aiId, {
      error: e?.message || '检索失败，请稍后重试'
    })
  } finally {
    sending.value = false
    await scrollToBottom()
  }
}

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    onSend()
  }
}

const clearHistory = async () => {
  try {
    await showConfirmDialog({
      title: '清空当前对话?',
      message: '清空后将开始新会话，已保存的历史不受影响。'
    })
  } catch { return }
  sessionId.value = ''
}

const toggleStar = () => { if (sessionId.value) chat.toggleStar(sessionId.value) }

// 监听 query.session 用于"打开历史"
watch(() => route.query.session, (v) => {
  if (typeof v === 'string' && chat.getSession(v)) {
    sessionId.value = v
  }
}, { immediate: true })

onMounted(() => { if (input.value) onSend() })
</script>

<template>
  <div class="h-full flex flex-col bg-bg">
    <!-- ─────────────── 初始空态：居中大输入（FIX3 第 6 项：去掉示例提示） ─────────────── -->
    <div v-if="!hasMessages" class="flex-1 flex items-center justify-center px-6 overflow-auto">
      <div class="w-full max-w-[720px] py-12">
        <div class="text-center mb-10">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white mb-4">
            <Sparkles class="w-8 h-8" />
          </div>
          <h1 class="text-3xl font-bold text-primary">设备检修智能检索</h1>
          <div class="mt-2 text-sm text-text-2">基于多模态大模型 · 描述故障或上传现场照片，AI 会从知识库中给出答案</div>
        </div>

        <!-- 输入卡 -->
        <div
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop="onDrop"
          class="industrial-card p-3 shadow-float transition"
          :class="dragging ? 'border-accent ring-2 ring-accent/30' : ''">
          <textarea v-model="input" rows="3" @keydown="onKey"
                    placeholder="输入设备故障描述或检修问题…（Enter 发送，Shift+Enter 换行）"
                    class="w-full resize-none bg-transparent outline-none px-2 py-1 text-base leading-relaxed"></textarea>

          <!-- 图片缩略图 -->
          <div v-if="imageList.length" class="px-1 pb-2 flex flex-wrap gap-2">
            <div v-for="(img, i) in imageList" :key="i" class="relative w-14 h-14 rounded-btn overflow-hidden bg-bg group">
              <img :src="img.url" class="w-full h-full object-cover" />
              <button class="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-80"
                      @click="imageList.splice(i, 1)">
                <X class="w-3 h-3" />
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between border-t border-border pt-2 mt-1">
            <button @click="fileInput?.click()"
                    class="h-9 w-9 rounded-full hover:bg-bg flex items-center justify-center text-text-2 hover:text-accent" title="上传图片">
              <Paperclip class="w-4 h-4" />
            </button>
            <input ref="fileInput" type="file" accept="image/*" multiple class="hidden"
                   @change="e => onPickFiles((e.target as HTMLInputElement).files)" />
            <button @click="onSend" :disabled="sending || (!input.trim() && !imageList.length)"
                    class="h-9 px-4 rounded-btn bg-accent hover:bg-accent-2 text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ai-shine">
              <Send class="w-4 h-4" />
              <span>发送</span>
            </button>
          </div>
        </div>

        <div class="mt-8 text-center text-xs text-text-2">
          数据来源：本地向量知识库（/api/chat/query）· 多模态支持图片输入
        </div>
      </div>
    </div>

    <!-- ─────────────── 对话状态：消息流 + 底部输入 ─────────────── -->
    <template v-else>
      <!-- 顶部：标题 + 收藏 + 清空 -->
      <header class="flex-shrink-0 px-6 py-3 border-b border-border bg-card flex items-center gap-3">
        <Sparkles class="w-4 h-4 text-accent" />
        <h2 class="text-sm font-semibold truncate max-w-md" :title="session?.title">{{ session?.title || '新对话' }}</h2>
        <span class="text-xs text-text-2 mono">{{ messages.filter(m => m.role === 'user').length }} 条提问</span>
        <button @click="toggleStar"
                class="ml-auto h-8 px-3 rounded-btn text-xs flex items-center gap-1"
                :class="session?.starred ? 'text-warning' : 'text-text-2 hover:bg-bg hover:text-warning'">
          <Star class="w-3.5 h-3.5" :fill="session?.starred ? 'currentColor' : 'none'" />
          {{ session?.starred ? '已收藏' : '收藏' }}
        </button>
        <button @click="clearHistory" class="h-8 px-3 rounded-btn text-xs text-text-2 hover:bg-bg hover:text-danger flex items-center gap-1">
          <Trash2 class="w-3.5 h-3.5" /> 新建对话
        </button>
      </header>

      <!-- 消息区 -->
      <div ref="scrollEl" class="flex-1 overflow-auto px-6 py-6">
        <div class="max-w-[860px] mx-auto space-y-6">
          <template v-for="m in messages" :key="m.id">
            <!-- 用户消息 -->
            <div v-if="m.role === 'user'" class="flex justify-end">
              <div class="flex items-start gap-3 max-w-[75%]">
                <div class="bg-accent text-white px-4 py-3 rounded-2xl rounded-tr-sm shadow-card">
                  <div v-if="m.images && m.images.length" class="grid grid-cols-3 gap-1.5 mb-2">
                    <img v-for="(u, j) in m.images" :key="j" :src="u" class="w-full aspect-square object-cover rounded-btn" />
                  </div>
                  <p v-if="m.content" class="text-sm leading-relaxed whitespace-pre-wrap break-words">{{ m.content }}</p>
                </div>
                <div class="w-8 h-8 rounded-full bg-bg border border-border flex items-center justify-center flex-shrink-0 text-text-2">
                  <UserIcon class="w-4 h-4" />
                </div>
              </div>
            </div>

            <!-- AI 回复 -->
            <div v-else class="flex justify-start">
              <div class="flex items-start gap-3 max-w-[85%]">
                <div class="w-8 h-8 rounded-full bg-ai/10 text-ai flex items-center justify-center flex-shrink-0">
                  <Bot class="w-4 h-4" />
                </div>
                <div class="flex-1 min-w-0">
                  <!-- 加载态 -->
                  <div v-if="!m.content && !m.error" class="industrial-card p-4 border-l-2 border-l-ai bg-ai/5">
                    <div class="flex items-center gap-2 text-text-2 text-sm">
                      <Loader class="w-4 h-4 animate-spin text-ai" />
                      正在检索知识库 · 大模型推理中…
                    </div>
                  </div>

                  <!-- 错误态 -->
                  <div v-else-if="m.error" class="industrial-card p-4 border-l-2 border-l-danger">
                    <div class="text-danger text-sm">⚠️ {{ m.error }}</div>
                  </div>

                  <!-- 正常回复 -->
                  <div v-else class="industrial-card p-4 border-l-2 border-l-ai">
                    <div class="text-xs text-text-2 mb-2 flex items-center gap-2">
                      <span class="px-1.5 py-0.5 rounded bg-ai/10 text-ai mono text-[10px]">multimodal-v2.4</span>
                      <span v-if="m.imageObservation">· 已分析图片</span>
                    </div>

                    <div v-if="m.imageObservation"
                         class="mb-3 px-3 py-2 rounded-btn bg-bg text-xs text-text-2 italic">
                      <ImageIcon class="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                      图像观察：{{ m.imageObservation }}
                    </div>

                    <!-- markdown 渲染 -->
                    <div class="md-body" v-html="renderMarkdown(m.content)"></div>

                    <!-- 来源引用（与本条消息强绑定） -->
                    <div v-if="m.sources && m.sources.length" class="mt-4 pt-3 border-t border-border">
                      <button @click="expandedSources[m.id] = !expandedSources[m.id]"
                              class="text-xs text-text-2 hover:text-accent flex items-center gap-1">
                        <BookOpen class="w-3.5 h-3.5" />
                        查看 {{ m.sources.length }} 条引用
                        <ChevronDown v-if="!expandedSources[m.id]" class="w-3.5 h-3.5" />
                        <ChevronUp v-else class="w-3.5 h-3.5" />
                      </button>
                      <ol v-if="expandedSources[m.id]" class="mt-2 space-y-1.5">
                        <li v-for="(h, hi) in m.sources" :key="h.id"
                            class="text-xs px-3 py-2 rounded-btn bg-bg border border-border">
                          <div class="flex items-start gap-2">
                            <span class="mono text-text-2">[{{ hi + 1 }}]</span>
                            <div class="flex-1 min-w-0">
                              <div class="font-medium text-text">{{ h.title }}</div>
                              <div v-if="h.snippet" class="mt-0.5 text-text-2 leading-relaxed line-clamp-3">{{ h.snippet }}</div>
                              <div v-if="h.page" class="mt-0.5 text-text-2 mono text-[10px]">页码 {{ h.page }}</div>
                            </div>
                            <span v-if="typeof h.similarity === 'number'" class="mono text-text-2 flex-shrink-0">{{ Math.round(h.similarity * 100) }}%</span>
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
      </div>

      <!-- 底部固定输入条 -->
      <div class="flex-shrink-0 border-t border-border bg-card px-6 py-3">
        <div class="max-w-[860px] mx-auto">
          <div
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop="onDrop"
            class="rounded-card border bg-card transition"
            :class="dragging ? 'border-accent ring-2 ring-accent/30' : 'border-border'">
            <div v-if="imageList.length" class="px-3 pt-2 flex flex-wrap gap-2">
              <div v-for="(img, i) in imageList" :key="i" class="relative w-12 h-12 rounded-btn overflow-hidden bg-bg group">
                <img :src="img.url" class="w-full h-full object-cover" />
                <button class="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center"
                        @click="imageList.splice(i, 1)">
                  <X class="w-3 h-3" />
                </button>
              </div>
            </div>
            <div class="flex items-end gap-2 px-2 py-2">
              <button @click="fileInput?.click()"
                      class="h-9 w-9 rounded-full hover:bg-bg flex items-center justify-center text-text-2 hover:text-accent flex-shrink-0" title="上传图片">
                <Paperclip class="w-4 h-4" />
              </button>
              <textarea v-model="input" rows="1" @keydown="onKey"
                        placeholder="继续追问…"
                        class="flex-1 resize-none bg-transparent outline-none px-1 py-2 text-sm leading-relaxed max-h-32"></textarea>
              <button @click="onSend" :disabled="sending || (!input.trim() && !imageList.length)"
                      class="h-9 w-9 rounded-full bg-accent hover:bg-accent-2 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
                <Send class="w-4 h-4" />
              </button>
            </div>
          </div>
          <div class="mt-1.5 text-[11px] text-text-2 text-center">
            AI 输出仅供参考，关键检修动作请以现场实测和官方手册为准
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

<style>
/* markdown 渲染基础样式（全局生效以便嵌套 v-html） */
.md-body { font-size: 15px; line-height: 1.7; color: var(--text, #1F2937); word-break: break-word; }
.md-body h1, .md-body h2, .md-body h3, .md-body h4 { font-weight: 700; margin: 0.85em 0 0.35em; line-height: 1.35; }
.md-body h1 { font-size: 1.4em; }
.md-body h2 { font-size: 1.25em; }
.md-body h3 { font-size: 1.12em; }
.md-body h4 { font-size: 1em; }
.md-body p { margin: 0.4em 0; }
.md-body ul, .md-body ol { padding-left: 1.4em; margin: 0.4em 0; }
.md-body ul { list-style: disc; }
.md-body ol { list-style: decimal; }
.md-body li { margin: 0.2em 0; }
.md-body blockquote {
  margin: 0.6em 0; padding: 0.4em 0.9em;
  border-left: 3px solid var(--accent, #F26B1F);
  background: rgba(242, 107, 31, 0.05);
  color: var(--text-2, #6B7280);
}
.md-body code {
  background: rgba(0, 0, 0, 0.06);
  padding: 0.1em 0.35em; border-radius: 4px;
  font-family: 'Menlo', 'Consolas', monospace; font-size: 0.92em;
}
.md-body pre {
  background: #0B2545; color: #F5F7FA;
  padding: 0.85em 1em; border-radius: 8px; overflow-x: auto;
  margin: 0.6em 0; font-size: 0.9em; line-height: 1.55;
}
.md-body pre code { background: transparent; padding: 0; color: inherit; }
.md-body table { border-collapse: collapse; width: 100%; margin: 0.6em 0; font-size: 0.95em; }
.md-body th, .md-body td { border: 1px solid #E5E7EB; padding: 0.45em 0.7em; text-align: left; }
.md-body th { background: #F3F4F6; font-weight: 600; }
.md-body a { color: #00B7C2; text-decoration: underline; }
.md-body hr { border: 0; border-top: 1px solid #E5E7EB; margin: 1em 0; }
</style>

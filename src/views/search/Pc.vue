<script setup lang="ts">
/**
 * PC 端检索 · 对话式布局（FIX2 第 5 项）
 *
 * 视觉参考 ChatGPT / Kimi：
 * - 初始：页面中央一个大的输入框 + 示例提示
 * - 进入对话后：上方消息流（user / assistant 气泡）+ 底部固定输入条
 * - AI 回复带「来源引用」可折叠列表
 */
import { ref, nextTick, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Sparkles, Paperclip, Send, X, Image as ImageIcon, BookOpen, Bot, User as UserIcon, ChevronDown, ChevronUp, Loader, Trash2 } from 'lucide-vue-next'
import * as searchApi from '@/api/search'
import type { SearchHit } from '@/api/search'
import { useSearchStore } from '@/stores/search'

const route = useRoute()
const store = useSearchStore()

interface UserMsg { role: 'user'; text: string; images: string[] }
interface AiMsg { role: 'assistant'; summary: string; hits: SearchHit[]; observation: string; loading?: boolean; error?: string; expanded?: boolean }
type Msg = UserMsg | AiMsg

const input = ref(typeof route.query.q === 'string' ? route.query.q : '')
const imageList = ref<{ url: string; name: string; file: File }[]>([])
const messages = ref<Msg[]>([])
const sending = ref(false)
const dragging = ref(false)
const fileInput = ref<HTMLInputElement>()
const scrollEl = ref<HTMLDivElement>()

const SAMPLES = [
  '离心泵振动异常如何排查？',
  '电机过热保护检修流程',
  '减速箱漏油怎么处理？',
  '空压机出口温度过高的原因有哪些？'
]

const hasMessages = computed(() => messages.value.length > 0)

const onPickFiles = (files: FileList | null) => {
  if (!files) return
  Array.from(files).forEach(f => imageList.value.push({ url: URL.createObjectURL(f), name: f.name, file: f }))
}
const onDrop = (e: DragEvent) => {
  e.preventDefault(); dragging.value = false
  onPickFiles(e.dataTransfer?.files || null)
}

const useSample = (s: string) => { input.value = s }

const scrollToBottom = async () => {
  await nextTick()
  scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' })
}

const onSend = async () => {
  const text = input.value.trim()
  if (!text && !imageList.value.length) return
  if (sending.value) return

  // 1) 投递用户消息
  const usr: UserMsg = { role: 'user', text, images: imageList.value.map(i => i.url) }
  messages.value.push(usr)

  // 2) 占位的 assistant 消息（loading）
  const ai: AiMsg = { role: 'assistant', summary: '', hits: [], observation: '', loading: true, expanded: true }
  messages.value.push(ai)

  // 3) 同步保留首张图发到后端，再清空输入区
  const file = imageList.value[0]?.file || null
  input.value = ''
  imageList.value = []
  if (text) store.push(text)
  sending.value = true
  await scrollToBottom()

  try {
    const res = await searchApi.multimodalSearch({ text, imageFile: file })
    ai.summary = res.summary || '（后端未返回内容）'
    ai.hits = res.hits || []
    ai.observation = res.imageObservation || ''
    ai.loading = false
  } catch (e: any) {
    ai.loading = false
    ai.error = e?.message || '检索失败，请稍后重试'
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

const clearHistory = () => {
  messages.value = []
}
</script>

<template>
  <div class="h-full flex flex-col bg-bg">
    <!-- ─────────────── 初始空态：居中大输入 ─────────────── -->
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

        <!-- 示例提示 -->
        <div class="mt-6">
          <div class="text-xs text-text-2 mb-2">💡 试试这些问题</div>
          <div class="flex flex-wrap gap-2">
            <button v-for="s in SAMPLES" :key="s" @click="useSample(s)"
                    class="px-3 h-9 rounded-pill border border-border text-sm text-text-2 hover:border-accent hover:text-accent hover:bg-accent/5 transition">
              {{ s }}
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
      <!-- 顶部：标题 + 清空按钮 -->
      <header class="flex-shrink-0 px-6 py-3 border-b border-border bg-card flex items-center gap-3">
        <Sparkles class="w-4 h-4 text-accent" />
        <h2 class="text-sm font-semibold">设备检修智能检索</h2>
        <span class="text-xs text-text-2 mono">{{ messages.filter(m => m.role === 'user').length }} 条提问</span>
        <button @click="clearHistory" class="ml-auto h-8 px-3 rounded-btn text-xs text-text-2 hover:bg-bg hover:text-danger flex items-center gap-1">
          <Trash2 class="w-3.5 h-3.5" /> 清空对话
        </button>
      </header>

      <!-- 消息区 -->
      <div ref="scrollEl" class="flex-1 overflow-auto px-6 py-6">
        <div class="max-w-[860px] mx-auto space-y-6">
          <template v-for="(m, i) in messages" :key="i">
            <!-- 用户消息 -->
            <div v-if="m.role === 'user'" class="flex justify-end">
              <div class="flex items-start gap-3 max-w-[75%]">
                <div class="bg-accent text-white px-4 py-3 rounded-2xl rounded-tr-sm shadow-card">
                  <div v-if="m.images.length" class="grid grid-cols-3 gap-1.5 mb-2">
                    <img v-for="(u, j) in m.images" :key="j" :src="u" class="w-full aspect-square object-cover rounded-btn" />
                  </div>
                  <p v-if="m.text" class="text-sm leading-relaxed whitespace-pre-wrap break-words">{{ m.text }}</p>
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
                  <div v-if="m.loading" class="industrial-card p-4 border-l-2 border-l-ai bg-ai/5">
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
                      <span v-if="m.observation">· 已分析图片</span>
                    </div>

                    <div v-if="m.observation"
                         class="mb-3 px-3 py-2 rounded-btn bg-bg text-xs text-text-2 italic">
                      <ImageIcon class="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                      图像观察：{{ m.observation }}
                    </div>

                    <div class="text-base leading-relaxed text-text whitespace-pre-wrap break-words">{{ m.summary }}</div>

                    <!-- 来源引用 -->
                    <div v-if="m.hits.length" class="mt-4 pt-3 border-t border-border">
                      <button @click="m.expanded = !m.expanded"
                              class="text-xs text-text-2 hover:text-accent flex items-center gap-1">
                        <BookOpen class="w-3.5 h-3.5" />
                        来源引用 · {{ m.hits.length }} 条
                        <ChevronDown v-if="!m.expanded" class="w-3.5 h-3.5" />
                        <ChevronUp v-else class="w-3.5 h-3.5" />
                      </button>
                      <ol v-if="m.expanded" class="mt-2 space-y-1.5">
                        <li v-for="(h, hi) in m.hits" :key="h.id"
                            class="text-xs px-3 py-2 rounded-btn bg-bg border border-border">
                          <div class="flex items-start gap-2">
                            <span class="mono text-text-2">[{{ hi + 1 }}]</span>
                            <div class="flex-1 min-w-0">
                              <div class="font-medium text-text">{{ h.title }}</div>
                              <div v-if="h.snippet" class="mt-0.5 text-text-2 leading-relaxed line-clamp-3">{{ h.snippet }}</div>
                            </div>
                            <span class="mono text-text-2 flex-shrink-0">{{ Math.round((h.similarity || 0) * 100) }}%</span>
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

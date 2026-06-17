<script setup lang="ts">
/**
 * 移动端检索 · 对话式布局（FIX2 第 5 项）
 * - 初始：居中 LOGO + 提问示例 + 输入条贴底
 * - 进入对话：消息流（user / assistant 气泡）+ 底部输入条
 */
import { ref, nextTick, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Sparkles, Bot, User as UserIcon, BookOpen, Image as ImageIcon, Loader, ChevronDown, ChevronUp, Trash2 } from 'lucide-vue-next'
import * as searchApi from '@/api/search'
import type { SearchHit } from '@/api/search'
import { useSearchStore } from '@/stores/search'
import MobileInputBar from '@/components/mobile/MobileInputBar.vue'

const route = useRoute()
const store = useSearchStore()

interface UserMsg { role: 'user'; text: string; images: string[] }
interface AiMsg { role: 'assistant'; summary: string; hits: SearchHit[]; observation: string; loading?: boolean; error?: string; expanded?: boolean }
type Msg = UserMsg | AiMsg

const text = ref(typeof route.query.q === 'string' ? route.query.q : '')
const images = ref<string[]>([])
const imageFiles = ref<File[]>([])
const messages = ref<Msg[]>([])
const sending = ref(false)
const scrollEl = ref<HTMLDivElement>()

const SAMPLES = [
  '电机异响怎么排查',
  '减速箱漏油处理',
  '空压机过热原因',
  '泵振动异常定位'
]

const hasMessages = computed(() => messages.value.length > 0)

const onPickFiles = (files: File[]) => { imageFiles.value.push(...files) }

const scrollToBottom = async () => {
  await nextTick()
  scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' })
}

const useSample = (s: string) => { text.value = s }

const onSend = async () => {
  const t = text.value.trim()
  if (!t && !images.value.length) return
  if (sending.value) return

  const usr: UserMsg = { role: 'user', text: t, images: [...images.value] }
  messages.value.push(usr)
  const ai: AiMsg = { role: 'assistant', summary: '', hits: [], observation: '', loading: true, expanded: false }
  messages.value.push(ai)

  const file = imageFiles.value[0] || null
  text.value = ''
  images.value = []
  imageFiles.value = []
  if (t) store.push(t)
  sending.value = true
  await scrollToBottom()

  try {
    const res = await searchApi.multimodalSearch({ text: t, imageFile: file })
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

const onVoice = (t: string) => { text.value = t; onSend() }
const clearHistory = () => { messages.value = [] }
</script>

<template>
  <div class="h-full flex flex-col bg-bg">
    <!-- 初始空态 -->
    <div v-if="!hasMessages" class="flex-1 overflow-auto px-4 flex flex-col items-center justify-center">
      <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white flex items-center justify-center mb-3">
        <Sparkles class="w-8 h-8" />
      </div>
      <h1 class="text-xl font-bold text-primary">设备检修智能检索</h1>
      <div class="mt-1 text-xs text-text-2 text-center max-w-xs">描述故障或拍照上传，AI 即刻给出检修建议</div>

      <div class="mt-8 w-full max-w-sm">
        <div class="text-xs text-text-2 mb-2 px-1">💡 试试这些问题</div>
        <div class="space-y-2">
          <button v-for="s in SAMPLES" :key="s" @click="useSample(s)"
                  class="w-full text-left px-4 h-12 rounded-btn border border-border bg-card text-sm text-text active:bg-bg">
            {{ s }}
          </button>
        </div>
      </div>
    </div>

    <!-- 对话状态 -->
    <template v-else>
      <header class="flex-shrink-0 px-4 py-2.5 border-b border-border bg-card flex items-center gap-2 safe-top">
        <Sparkles class="w-4 h-4 text-accent" />
        <span class="text-sm font-semibold flex-1">智能检索</span>
        <button @click="clearHistory" class="h-7 px-2 rounded-btn text-xs text-text-2 active:bg-bg flex items-center gap-1">
          <Trash2 class="w-3.5 h-3.5" /> 清空
        </button>
      </header>

      <div ref="scrollEl" class="flex-1 overflow-auto px-3 py-3 space-y-4">
        <template v-for="(m, i) in messages" :key="i">
          <!-- 用户气泡 -->
          <div v-if="m.role === 'user'" class="flex justify-end">
            <div class="flex items-start gap-2 max-w-[85%]">
              <div class="bg-accent text-white px-3 py-2 rounded-2xl rounded-tr-sm shadow-card">
                <div v-if="m.images.length" class="grid grid-cols-3 gap-1 mb-1.5">
                  <img v-for="(u, j) in m.images" :key="j" :src="u" class="w-full aspect-square object-cover rounded" />
                </div>
                <p v-if="m.text" class="text-sm leading-relaxed whitespace-pre-wrap break-words">{{ m.text }}</p>
              </div>
              <div class="w-7 h-7 rounded-full bg-bg border border-border flex items-center justify-center flex-shrink-0 text-text-2">
                <UserIcon class="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          <!-- AI 气泡 -->
          <div v-else class="flex justify-start">
            <div class="flex items-start gap-2 max-w-[88%] flex-1">
              <div class="w-7 h-7 rounded-full bg-ai/10 text-ai flex items-center justify-center flex-shrink-0">
                <Bot class="w-3.5 h-3.5" />
              </div>
              <div class="flex-1 min-w-0">
                <div v-if="m.loading" class="industrial-card p-3 border-l-2 border-l-ai bg-ai/5">
                  <div class="flex items-center gap-2 text-text-2 text-sm">
                    <Loader class="w-3.5 h-3.5 animate-spin text-ai" />
                    检索中…
                  </div>
                </div>
                <div v-else-if="m.error" class="industrial-card p-3 border-l-2 border-l-danger">
                  <div class="text-danger text-sm">⚠️ {{ m.error }}</div>
                </div>
                <div v-else class="industrial-card p-3 border-l-2 border-l-ai">
                  <div v-if="m.observation" class="mb-2 px-2 py-1.5 rounded-btn bg-bg text-[11px] text-text-2 italic">
                    <ImageIcon class="w-3 h-3 inline mr-1 -mt-0.5" />
                    {{ m.observation }}
                  </div>
                  <div class="text-sm leading-relaxed whitespace-pre-wrap break-words">{{ m.summary }}</div>
                  <div v-if="m.hits.length" class="mt-3 pt-2 border-t border-border">
                    <button @click="m.expanded = !m.expanded"
                            class="text-xs text-text-2 flex items-center gap-1">
                      <BookOpen class="w-3.5 h-3.5" />
                      来源 · {{ m.hits.length }} 条
                      <ChevronDown v-if="!m.expanded" class="w-3.5 h-3.5" />
                      <ChevronUp v-else class="w-3.5 h-3.5" />
                    </button>
                    <ol v-if="m.expanded" class="mt-1.5 space-y-1.5">
                      <li v-for="(h, hi) in m.hits" :key="h.id"
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

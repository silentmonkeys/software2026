<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Sparkles, ChevronLeft, ChevronRight, Heart } from 'lucide-vue-next'
import * as searchApi from '@/api/search'
import type { SearchResult } from '@/api/search'
import { useStreamText } from '@/composables/useStreamText'
import { useSearchStore } from '@/stores/search'
import MobileInputBar from '@/components/mobile/MobileInputBar.vue'
import SimilarityBar from '@/components/common/SimilarityBar.vue'
import StatusTag from '@/components/common/StatusTag.vue'

const route = useRoute()
const store = useSearchStore()

const text = ref(typeof route.query.q === 'string' ? route.query.q : '')
const images = ref<string[]>([])
const loading = ref(false)
const result = ref<SearchResult | null>(null)
const idx = ref(0)
const { display, run, done } = useStreamText(20)

const onSearch = async () => {
  if (!text.value.trim() && !images.value.length) return
  loading.value = true
  try {
    const res = await searchApi.multimodalSearch({ text: text.value, images: images.value })
    result.value = res
    idx.value = 0
    run(res.summary)
    if (text.value) store.push(text.value)
  } finally { loading.value = false }
}
const onVoice = (t: string) => { text.value = t; onSearch() }

const cur = computed(() => result.value?.hits[idx.value])

onMounted(() => { if (text.value) onSearch() })
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- 结果区 -->
    <div class="flex-1 overflow-auto px-3 py-3 space-y-3">
      <!-- AI 摘要 -->
      <section v-if="result" class="industrial-card p-3 border-l-4 border-l-ai">
        <div class="flex items-center gap-2 text-xs text-text-2 mb-1">
          <Sparkles class="w-4 h-4 text-ai" /> AI 一句话诊断
        </div>
        <div class="text-base leading-relaxed font-medium" :class="!done ? 'typing-cursor' : ''">{{ display }}</div>
        <div class="mt-3 pt-3 border-t border-border">
          <div class="text-xs text-text-2 mb-2">可能原因 Top 3</div>
          <div class="space-y-2">
            <div v-for="(c, i) in result.causes" :key="i" class="flex items-center gap-2">
              <span class="mono w-5 text-center text-xs text-text-2">{{ i + 1 }}</span>
              <span class="flex-1 text-sm">{{ c.name }}</span>
              <SimilarityBar :value="c.confidence" size="sm" />
            </div>
          </div>
        </div>
      </section>

      <!-- 大卡片纵堆 -->
      <section v-if="result" class="space-y-3">
        <article v-for="h in result.hits" :key="h.id"
                 class="industrial-card p-4 active:bg-bg transition">
          <div class="flex items-center gap-2 mb-2">
            <StatusTag :type="h.type" />
            <SimilarityBar :value="h.similarity" size="sm" />
          </div>
          <h4 class="text-base font-semibold leading-snug">{{ h.title }}</h4>
          <p class="text-sm text-text-2 leading-relaxed mt-2">
            <template v-for="(seg, i) in h.snippet.split(new RegExp(`(${(h.highlights||[]).join('|')})`,'g'))" :key="i">
              <span v-if="(h.highlights||[]).includes(seg)" class="text-hl">{{ seg }}</span>
              <span v-else>{{ seg }}</span>
            </template>
          </p>
          <div class="text-[11px] text-text-2 mt-2">{{ h.source }}</div>
        </article>
      </section>

      <div v-if="loading" class="py-12 text-center text-text-2">
        <Sparkles class="w-8 h-8 mx-auto text-ai animate-pulse" />
        <div class="mt-2 text-sm">AI 正在分析…</div>
      </div>
      <div v-if="!result && !loading"
           class="py-16 text-center text-text-2 text-sm">
        请描述故障或拍照,获取智能诊断
      </div>
    </div>

    <!-- 底部操作条(单卡浏览模式时) -->
    <div v-if="result && cur" class="flex-shrink-0 h-12 border-t border-border bg-card flex items-center px-3 gap-2">
      <button @click="idx = Math.max(0, idx - 1)" :disabled="idx === 0"
              class="h-10 w-10 rounded-btn flex items-center justify-center disabled:opacity-40">
        <ChevronLeft class="w-5 h-5" />
      </button>
      <button class="h-10 flex-1 rounded-btn bg-bg flex items-center justify-center gap-1 text-sm">
        <Heart class="w-4 h-4" /> 收藏
      </button>
      <span class="px-2 text-xs text-text-2 mono">{{ idx + 1 }}/{{ result.hits.length }}</span>
      <button @click="idx = Math.min(result.hits.length - 1, idx + 1)" :disabled="idx >= result.hits.length - 1"
              class="h-10 w-10 rounded-btn flex items-center justify-center disabled:opacity-40">
        <ChevronRight class="w-5 h-5" />
      </button>
    </div>

    <MobileInputBar v-model="text" v-model:images="images" @send="onSearch" @voice="onVoice" />
  </div>
</template>

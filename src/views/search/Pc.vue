<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Sparkles, Upload, X, Heart, Eye, Lightbulb, Image as ImageIcon } from 'lucide-vue-next'
import * as searchApi from '@/api/search'
import type { SearchResult, SearchMode } from '@/api/search'
import { useSearchStore } from '@/stores/search'
import { useStreamText } from '@/composables/useStreamText'
import SimilarityBar from '@/components/common/SimilarityBar.vue'
import StatusTag from '@/components/common/StatusTag.vue'
import ConfidenceMeter from '@/components/common/ConfidenceMeter.vue'
import AIAssistant from '@/components/common/AIAssistant.vue'

const route = useRoute()
const store = useSearchStore()

const text = ref(typeof route.query.q === 'string' ? route.query.q : '电机异响')
const deviceModel = ref('YKK630-4')
const mode = ref<SearchMode>('smart')
const images = ref<{ url: string; name: string }[]>([])
const dragging = ref(false)
const loading = ref(false)
const result = ref<SearchResult | null>(null)
const tab = ref<'all' | 'manual' | 'case' | 'graph'>('all')

const filters = reactive({
  industry: ['钢铁'],
  workshop: ['一号车间'],
  device:   [] as string[],
  level:    [1, 2] as number[],
  range:    'recent-90'
})

const fileInput = ref<HTMLInputElement>()

const { display, run, done } = useStreamText(18)

const onFiles = (files: FileList | null) => {
  if (!files) return
  Array.from(files).forEach(f => images.value.push({ url: URL.createObjectURL(f), name: f.name }))
}
const onDrop = (e: DragEvent) => {
  e.preventDefault(); dragging.value = false
  onFiles(e.dataTransfer?.files || null)
}

const filteredHits = computed(() => {
  if (!result.value) return []
  if (tab.value === 'all') return result.value.hits
  return result.value.hits.filter(h => h.type === tab.value)
})

const onSearch = async () => {
  loading.value = true
  result.value = null
  try {
    const res = await searchApi.multimodalSearch({
      text: text.value, deviceModel: deviceModel.value, mode: mode.value,
      images: images.value.map(i => i.url)
    })
    result.value = res
    run(res.summary)
    if (text.value) store.push(text.value, deviceModel.value)
  } finally { loading.value = false }
}

onMounted(() => { onSearch() })
</script>

<template>
  <div class="grid grid-cols-12 gap-4 p-4 h-full overflow-hidden">
    <!-- 左侧筛选 -->
    <aside class="col-span-3 industrial-card p-4 overflow-auto">
      <h3 class="text-sm font-semibold text-text mb-3 flex items-center gap-2">
        <Lightbulb class="w-4 h-4 text-accent" /> 检索筛选
      </h3>

      <div class="space-y-5 text-sm">
        <div>
          <div class="text-text-2 mb-2">设备类型(三级)</div>
          <ul class="space-y-1">
            <li>📁 钢铁
              <ul class="ml-4 mt-1 space-y-1">
                <li>📂 一号车间·热轧线
                  <ul class="ml-4 mt-1 space-y-1 text-text-2">
                    <li class="cursor-pointer hover:text-accent">⚙ YKK630-4 主电机 ×12</li>
                    <li class="cursor-pointer hover:text-accent">⚙ HD-450 减速机 ×4</li>
                    <li class="cursor-pointer hover:text-accent">⚙ CT-2400 冷却泵 ×6</li>
                  </ul>
                </li>
                <li>📂 二号车间·冷轧线 …</li>
              </ul>
            </li>
          </ul>
        </div>

        <div>
          <div class="text-text-2 mb-2">检修等级</div>
          <div class="flex gap-2">
            <label v-for="lv in [1,2,3]" :key="lv" class="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" :checked="filters.level.includes(lv)" class="accent-accent"
                     @change="filters.level.includes(lv) ? filters.level = filters.level.filter(x=>x!==lv) : filters.level.push(lv)" />
              <span class="mono">L{{ lv }}</span>
            </label>
          </div>
        </div>

        <div>
          <div class="text-text-2 mb-2">来源类型</div>
          <div class="flex flex-wrap gap-1.5">
            <label v-for="s in ['手册','案例','图谱']" :key="s"
                   class="px-2 py-1 rounded border border-border text-xs cursor-pointer hover:border-accent hover:text-accent">{{ s }}</label>
          </div>
        </div>

        <div>
          <div class="text-text-2 mb-2">时间范围</div>
          <select v-model="filters.range" class="w-full h-8 px-2 border border-border rounded-btn bg-card text-sm">
            <option value="recent-7">最近 7 天</option>
            <option value="recent-30">最近 30 天</option>
            <option value="recent-90">最近 90 天</option>
            <option value="all">全部</option>
          </select>
        </div>

        <div>
          <div class="text-text-2 mb-2">关键词高亮</div>
          <label class="flex items-center gap-2 text-text-2">
            <input type="checkbox" checked class="accent-accent" /> 启用命中高亮
          </label>
        </div>
      </div>
    </aside>

    <!-- 主区 -->
    <section class="col-span-9 flex flex-col gap-4 overflow-hidden">
      <!-- 多模态输入条 -->
      <div class="industrial-card p-4">
        <div class="flex gap-3 items-stretch">
          <div class="flex-1 flex flex-col gap-3">
            <div class="flex gap-3">
              <textarea v-model="text" rows="2"
                        placeholder="描述故障现象,如: 电机异响、温度异常、振动超标…"
                        class="flex-1 resize-none px-3 py-2 rounded-btn border border-border bg-bg outline-none focus:border-accent focus:bg-card text-sm"></textarea>
              <select v-model="deviceModel"
                      class="w-44 px-3 rounded-btn border border-border bg-card text-sm font-mono">
                <option>YKK630-4</option>
                <option>CT-2400</option>
                <option>HP-180</option>
                <option>INV-5500</option>
              </select>
            </div>
            <div class="flex items-center gap-3">
              <div class="text-xs text-text-2">检索模式:</div>
              <div class="flex p-0.5 bg-bg rounded-btn border border-border">
                <button v-for="m in [{k:'precise',l:'精准'},{k:'smart',l:'智能(推荐)'},{k:'explore',l:'探索'}]" :key="m.k"
                        @click="mode = m.k as SearchMode"
                        :class="['px-3 h-7 rounded text-xs font-medium transition',
                                 mode === m.k ? 'bg-card shadow-card text-accent' : 'text-text-2 hover:text-text']">
                  {{ m.l }}
                </button>
              </div>
              <div class="ml-auto text-xs text-text-2">
                共 <span class="mono text-text">2,481</span> 条案例 / <span class="mono text-text">186</span> 份手册
              </div>
            </div>
          </div>

          <!-- 拖拽上传 -->
          <div
            @click="fileInput?.click()"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="onDrop"
            class="w-44 rounded-btn border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition"
            :class="dragging ? 'border-accent bg-accent/5' : 'border-border hover:border-accent text-text-2'">
            <ImageIcon class="w-6 h-6" />
            <div class="text-xs">{{ dragging ? '松手即可上传' : '拖拽 / 粘贴 / 点击' }}</div>
            <div class="text-[10px] opacity-70 mono">JPG / PNG · ≤ 10MB</div>
          </div>
          <input ref="fileInput" type="file" accept="image/*" multiple class="hidden"
                 @change="e => onFiles((e.target as HTMLInputElement).files)" />
        </div>

        <!-- 缩略图 + 大按钮 -->
        <div class="flex items-end gap-3 mt-3">
          <div class="flex-1 flex gap-2 flex-wrap">
            <div v-for="(img, i) in images" :key="i" class="relative w-16 h-16 rounded-btn overflow-hidden bg-bg group">
              <img :src="img.url" class="w-full h-full object-cover" />
              <button class="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-80 hover:opacity-100"
                      @click="images.splice(i, 1)">
                <X class="w-3 h-3" />
              </button>
              <div class="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-1 truncate">{{ img.name }}</div>
            </div>
            <button v-if="!images.length" @click="fileInput?.click()"
                    class="text-xs text-text-2 px-3 h-8 rounded border border-dashed border-border hover:border-accent hover:text-accent flex items-center gap-1">
              <Upload class="w-3 h-3" /> 添加现场照片
            </button>
          </div>
          <button @click="onSearch" :disabled="loading"
                  class="px-6 h-11 rounded-btn bg-accent hover:bg-accent-2 text-white font-semibold flex items-center gap-2 ai-shine disabled:opacity-60">
            <Sparkles class="w-4 h-4" />
            {{ loading ? 'AI 正在分析图像…' : 'AI 智能检索' }}
          </button>
        </div>
      </div>

      <!-- AI 摘要 + 可能原因 -->
      <div v-if="result" class="industrial-card p-4 border-l-4 border-l-ai">
        <div class="flex items-start gap-3">
          <div class="w-9 h-9 rounded bg-ai/10 text-ai flex items-center justify-center flex-shrink-0">
            <Sparkles class="w-5 h-5" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs text-text-2 mb-1 flex items-center gap-2">
              AI 一句话诊断
              <span class="mono text-[10px] px-1.5 py-0.5 rounded bg-ai/10 text-ai">multimodal-v2.4</span>
            </div>
            <div class="text-base leading-relaxed text-text" :class="!done ? 'typing-cursor' : ''">{{ display }}</div>

            <div class="mt-4 pt-3 border-t border-border">
              <div class="text-xs text-text-2 mb-2">可能原因 Top 3</div>
              <div class="grid grid-cols-3 gap-3">
                <div v-for="(c, i) in result.causes" :key="i"
                     class="bg-bg rounded-card p-3 flex items-center gap-3">
                  <ConfidenceMeter :value="c.confidence" :size="48" />
                  <div class="flex-1 min-w-0">
                    <div class="text-xs text-text-2">原因 {{ i + 1 }}</div>
                    <div class="text-sm font-medium leading-tight mt-0.5">{{ c.name }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 结果列表 -->
      <div class="industrial-card flex-1 overflow-hidden flex flex-col">
        <div class="flex border-b border-border px-4 flex-shrink-0">
          <button v-for="t in [
                  {k:'all',     l:'全部',     n: result?.hits.length || 0},
                  {k:'manual',  l:'手册片段', n: result?.hits.filter(h=>h.type==='manual').length || 0},
                  {k:'case',    l:'历史案例', n: result?.hits.filter(h=>h.type==='case').length || 0},
                  {k:'graph',   l:'图谱节点', n: result?.hits.filter(h=>h.type==='graph').length || 0}]"
                  :key="t.k"
                  @click="tab = t.k as any"
                  :class="['h-11 px-4 text-sm flex items-center gap-2 border-b-2 -mb-px transition',
                           tab === t.k ? 'border-accent text-accent font-semibold' : 'border-transparent text-text-2 hover:text-text']">
            {{ t.l }}
            <span class="mono text-xs px-1.5 rounded bg-bg">{{ t.n }}</span>
          </button>
        </div>

        <div v-if="loading" class="flex-1 grid place-items-center text-text-2">
          <div class="text-center">
            <Sparkles class="w-8 h-8 mx-auto text-ai animate-pulse" />
            <div class="mt-2 text-sm">AI 正在分析图像与文本…</div>
          </div>
        </div>

        <div v-else class="flex-1 overflow-auto p-4 space-y-3">
          <article v-for="h in filteredHits" :key="h.id"
                   class="industrial-card p-4 hover:shadow-float transition cursor-pointer group">
            <div class="flex items-start gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <StatusTag :type="h.type" />
                  <h4 class="text-base font-semibold text-text group-hover:text-accent transition">{{ h.title }}</h4>
                </div>
                <p class="text-sm text-text-2 leading-relaxed mt-2">
                  <template v-for="(seg, i) in h.snippet.split(new RegExp(`(${(h.highlights||[]).join('|')})`,'g'))" :key="i">
                    <span v-if="(h.highlights||[]).includes(seg)" class="text-hl">{{ seg }}</span>
                    <span v-else>{{ seg }}</span>
                  </template>
                </p>
                <div class="mt-3 flex items-center gap-3 text-xs text-text-2">
                  <span>来源: {{ h.source }}</span>
                </div>
              </div>
              <div class="w-48 flex-shrink-0 space-y-2">
                <SimilarityBar :value="h.similarity" />
                <div class="flex gap-1 justify-end">
                  <button class="w-7 h-7 rounded hover:bg-bg flex items-center justify-center text-text-2 hover:text-accent" title="查看">
                    <Eye class="w-3.5 h-3.5" />
                  </button>
                  <button class="w-7 h-7 rounded hover:bg-bg flex items-center justify-center text-text-2 hover:text-accent" title="收藏">
                    <Heart class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </article>

          <div v-if="!filteredHits.length" class="py-12 text-center text-text-2 text-sm">该 Tab 下暂无命中</div>
        </div>
      </div>
    </section>

    <AIAssistant />
  </div>
</template>

<script setup lang="ts">
/**
 * 知识库文档预览（FIX3 第 4.3 项需要的跳转目标）
 * - 后端如有 /api/kb/{id}/chunks 接口则展示分块
 * - 接口未实现时显示文档基本信息 + 提示
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { listDocs, type KbDoc } from '@/api/kb'
import { ChevronLeft, FileText, Loader, AlertTriangle } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const docId = computed(() => String(route.params.docId || ''))
const doc = ref<KbDoc | null>(null)
const loading = ref(false)
const error = ref('')

onMounted(async () => {
  loading.value = true
  try {
    const list = await listDocs()
    doc.value = list.find(d => String(d.id) === docId.value) || null
    if (!doc.value) error.value = '该文档不在已审通过的列表中（可能已被下架）'
  } catch {
    error.value = '后端不可达，无法加载文档信息'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="h-full flex flex-col">
    <header class="flex-shrink-0 px-4 py-3 border-b border-border bg-card flex items-center gap-2">
      <button @click="router.back()" class="w-9 h-9 rounded-btn hover:bg-bg flex items-center justify-center">
        <ChevronLeft class="w-5 h-5" />
      </button>
      <div class="flex-1 min-w-0">
        <div class="text-xs text-text-2">知识库 / 文档预览</div>
        <div class="text-sm font-semibold truncate">{{ doc?.title || `doc-${docId}` }}</div>
      </div>
    </header>

    <div class="flex-1 overflow-auto p-6 max-w-3xl mx-auto w-full space-y-4">
      <div v-if="loading" class="industrial-card p-12 text-center text-text-2">
        <Loader class="w-6 h-6 mx-auto animate-spin text-accent" />
        <div class="mt-2 text-sm">加载中…</div>
      </div>
      <template v-else-if="doc">
        <div class="industrial-card p-5">
          <div class="flex items-start gap-3">
            <div class="w-12 h-12 rounded-card bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
              <FileText class="w-6 h-6" />
            </div>
            <div class="flex-1 min-w-0">
              <h1 class="text-lg font-semibold">{{ doc.title }}</h1>
              <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-2">
                <span class="mono">#{{ doc.id }}</span>
                <span class="px-1.5 py-0.5 rounded mono uppercase bg-bg border border-border">{{ doc.type }}</span>
                <span class="px-1.5 py-0.5 rounded-pill border bg-success/10 text-success border-success/30">{{ doc.status }}</span>
                <span class="mono opacity-70">{{ doc.created_at }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="industrial-card p-5 text-sm text-text-2 leading-relaxed">
          <div class="text-text font-semibold mb-2">文档内容预览</div>
          <p>
            后端尚未提供 <code class="mono px-1 py-0.5 rounded bg-bg">GET /api/kb/{id}/chunks</code> 分块预览接口。
          </p>
          <p class="mt-2">
            可以在
            <button class="text-accent hover:underline" @click="router.push('/search')">多模态检索</button>
            页提问，AI 会自动检索本文档的相关片段并附在回答的"来源引用"里。
          </p>
        </div>
      </template>
      <div v-else class="industrial-card p-10 text-center text-text-2">
        <AlertTriangle class="w-8 h-8 mx-auto text-warning opacity-70" />
        <div class="mt-3 text-sm">{{ error || '文档不存在' }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 知识库文档预览（FIX5 / FIX6 第 2 项）
 * - 文本类（txt/md/experience）：getDoc 取正文 + markdown 渲染
 * - PDF 等二进制：fetchDocBlobUrl 取带 token 的 Blob URL，注入 <iframe> 预览
 * - 导出 PDF / Markdown（exportDoc）
 */
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getDoc, exportDoc, fetchDocBlobUrl, type KbDocDetail, STATUS_LABEL } from '@/api/kb'
import { renderMarkdown } from '@/utils/markdown'
import { showToast, showFailToast } from 'vant'
import { ChevronLeft, FileText, Loader, AlertTriangle, Download, FileDown } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const docId = computed(() => Number(route.params.docId || 0))
const doc = ref<KbDocDetail | null>(null)
const loading = ref(false)
const error = ref('')
const exporting = ref<'pdf' | 'md' | ''>('')
const blobUrl = ref<string>('')      // FIX6 第 2 项：PDF Blob URL
const blobErr = ref('')

const STATUS_CLS: Record<string, string> = {
  pending:    'bg-warning/10 text-warning border-warning/30',
  approved:   'bg-success/10 text-success border-success/30',
  ready:      'bg-success/10 text-success border-success/30',
  rejected:   'bg-danger/10 text-danger border-danger/30',
  taken_down: 'bg-text-2/10 text-text-2 border-border'
}

/** 是否走 iframe 预览（PDF 等二进制） */
const isBinary = computed(() => {
  const t = (doc.value?.type || '').toLowerCase()
  return t === 'pdf' || t === 'docx'
})

const loadBlob = async () => {
  if (!doc.value) return
  try {
    blobUrl.value = await fetchDocBlobUrl(doc.value.id)
  } catch {
    blobErr.value = '原始文件加载失败，请稍后重试或联系管理员'
  }
}

onMounted(async () => {
  loading.value = true
  try {
    doc.value = await getDoc(docId.value)
    if (isBinary.value) await loadBlob()
  } catch {
    error.value = '后端不可达或文档不存在，无法加载文档内容'
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  // 释放 Blob URL，避免内存泄漏
  if (blobUrl.value) URL.revokeObjectURL(blobUrl.value)
})

const doExport = async (format: 'pdf' | 'md') => {
  if (!doc.value || exporting.value) return
  exporting.value = format
  try {
    await exportDoc(doc.value.id, format, doc.value.title)
    showToast({ type: 'success', message: `已导出 ${format.toUpperCase()}` })
  } catch {
    showFailToast('导出失败，请稍后重试')
  } finally {
    exporting.value = ''
  }
}
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
      <template v-if="doc && !loading && !error">
        <button class="h-9 px-3 rounded-btn border border-border flex items-center gap-1.5 text-sm disabled:opacity-60"
                :disabled="!!exporting" @click="doExport('md')">
          <Loader v-if="exporting === 'md'" class="w-4 h-4 animate-spin" />
          <FileDown v-else class="w-4 h-4" /> <span class="hidden sm:inline">Markdown</span>
        </button>
        <button class="h-9 px-3 rounded-btn bg-accent hover:bg-accent-2 text-white font-semibold flex items-center gap-1.5 text-sm disabled:opacity-60"
                :disabled="!!exporting" @click="doExport('pdf')">
          <Loader v-if="exporting === 'pdf'" class="w-4 h-4 animate-spin" />
          <Download v-else class="w-4 h-4" /> PDF
        </button>
      </template>
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
                <span v-if="doc.category" class="px-1.5 py-0.5 rounded bg-bg border border-border">{{ doc.category }}</span>
                <span class="px-1.5 py-0.5 rounded-pill border" :class="STATUS_CLS[doc.status] || 'bg-bg border-border'">{{ STATUS_LABEL[doc.status] || doc.status }}</span>
                <span class="mono opacity-70">{{ doc.created_at }}</span>
              </div>
            </div>
          </div>
        </div>
        <!-- FIX6 第 2 项：PDF / DOCX 用 iframe Blob URL 预览原始文件 -->
        <div v-if="isBinary" class="industrial-card overflow-hidden" style="height:75vh">
          <div v-if="blobErr" class="p-10 text-center text-text-2">
            <AlertTriangle class="w-8 h-8 mx-auto text-warning opacity-70" />
            <div class="mt-3 text-sm">{{ blobErr }}</div>
          </div>
          <div v-else-if="!blobUrl" class="p-10 text-center text-text-2">
            <Loader class="w-6 h-6 mx-auto animate-spin text-accent" />
            <div class="mt-2 text-sm">正在加载原始文件…</div>
          </div>
          <iframe v-else :src="blobUrl" class="w-full h-full border-0" />
        </div>
        <div v-else class="industrial-card p-5">
          <div class="md-body" v-html="renderMarkdown(doc.content || '（暂无正文内容）')"></div>
        </div>
      </template>
      <div v-else class="industrial-card p-10 text-center text-text-2">
        <AlertTriangle class="w-8 h-8 mx-auto text-warning opacity-70" />
        <div class="mt-3 text-sm">{{ error || '文档不存在' }}</div>
      </div>
    </div>
  </div>
</template>

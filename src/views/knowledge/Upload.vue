<script setup lang="ts">
/**
 * 知识上传 · 单页拖拽（FIX2 第 7 项）
 * - 顶部：拖拽上传区 + 待上传队列（实时进度）
 * - 中部：手动录入文本（保存为 .txt 走 /api/kb/upload）
 * - 底部：已入库文档列表（来自 /api/kb/list，可删除）
 *
 * 不再使用 4 步向导。所有用户都能用；管理员还可以在 /admin/knowledge 做更细的管理。
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDevice } from '@/composables/useDevice'
import {
  ChevronLeft, FileText, Trash2, Loader, Upload, Search,
  Sparkles, Edit3, Send, X, Check, AlertTriangle, Database
} from 'lucide-vue-next'
import { showToast, showFailToast, showConfirmDialog } from 'vant'
import { uploadDoc, listDocs, deleteDoc, type KbDoc } from '@/api/kb'

const router = useRouter()
const { isPC } = useDevice()

const ALLOWED = ['pdf', 'docx', 'txt', 'md']

interface UploadItem { name: string; size: number; status: 'uploading' | 'done' | 'failed'; docId?: number; chunks?: number }
const uploads = ref<UploadItem[]>([])
const docs = ref<KbDoc[]>([])
const loading = ref(false)
const offline = ref(false)
const q = ref('')

const dragging = ref(false)
const fileInput = ref<HTMLInputElement>()

// —— 手动录入 ——
const showManual = ref(false)
const manualTitle = ref('')
const manualBody = ref('')
const manualSubmitting = ref(false)

const refresh = async () => {
  loading.value = true
  try {
    docs.value = await listDocs()
    offline.value = false
  } catch {
    docs.value = []
    offline.value = true
  } finally {
    loading.value = false
  }
}
onMounted(refresh)

const filtered = computed(() =>
  docs.value.filter(d => !q.value || d.title.toLowerCase().includes(q.value.toLowerCase()))
)

const fmtSize = (n: number) => n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`

const handleFiles = async (files: FileList | File[] | null) => {
  if (!files) return
  const arr = Array.from(files)
  if (!arr.length) return
  for (const f of arr) {
    const ext = (f.name.split('.').pop() || '').toLowerCase()
    if (!ALLOWED.includes(ext)) {
      showFailToast(`仅支持 ${ALLOWED.join(' / ')}：${f.name}`)
      continue
    }
    const item: UploadItem = { name: f.name, size: f.size, status: 'uploading' }
    uploads.value.push(item)
    try {
      const res = await uploadDoc(f)
      item.docId = res.doc_id
      item.chunks = res.chunks
      item.status = 'done'
      showToast({ type: 'success', message: `${f.name} 已入库（${res.chunks} chunks）` })
    } catch {
      item.status = 'failed'
      showFailToast(`${f.name} 上传失败`)
    }
  }
  await refresh()
}

const onPick = (e: Event) => {
  const t = e.target as HTMLInputElement
  handleFiles(t.files)
  t.value = ''
}
const onDrop = (e: DragEvent) => {
  e.preventDefault(); dragging.value = false
  handleFiles(e.dataTransfer?.files || null)
}

const removeDoc = async (d: KbDoc) => {
  try {
    await showConfirmDialog({
      title: '删除文档',
      message: `确认删除「${d.title}」？删除后向量索引也会一并清理。`
    })
  } catch { return }
  try {
    await deleteDoc(d.id)
    showToast({ type: 'success', message: '已删除' })
    await refresh()
  } catch {
    showFailToast('删除失败')
  }
}

const submitManual = async () => {
  const title = manualTitle.value.trim() || `手动录入_${new Date().toISOString().slice(0,16).replace('T','_').replace(':','')}`
  const body = manualBody.value.trim()
  if (!body) { showFailToast('请输入知识内容'); return }
  manualSubmitting.value = true
  try {
    // 把文本封装成 .txt 文件后走真实上传接口（FIX2 第 7.3 项）
    const blob = new Blob([body], { type: 'text/plain;charset=utf-8' })
    const file = new File([blob], `${title}.txt`, { type: 'text/plain' })
    const res = await uploadDoc(file)
    showToast({ type: 'success', message: `已入库（${res.chunks} chunks）` })
    showManual.value = false
    manualTitle.value = ''
    manualBody.value = ''
    await refresh()
  } catch {
    showFailToast('入库失败，请稍后重试')
  } finally {
    manualSubmitting.value = false
  }
}

const STATUS_CLS: Record<string, string> = {
  ready:   'bg-success/10 text-success border-success/30',
  parsing: 'bg-warning/10 text-warning border-warning/30',
  failed:  'bg-danger/10 text-danger border-danger/30'
}
</script>

<template>
  <div :class="isPC ? 'p-6 max-w-5xl mx-auto space-y-4' : 'h-full flex flex-col'">
    <!-- 移动端顶栏 -->
    <header v-if="!isPC" class="flex-shrink-0 h-12 bg-card border-b border-border flex items-center px-2">
      <button @click="router.back()" class="w-10 h-10 flex items-center justify-center"><ChevronLeft class="w-5 h-5" /></button>
      <span class="flex-1 text-center font-semibold">添加知识</span>
      <span class="w-10"></span>
    </header>

    <!-- PC 标题栏 -->
    <header v-if="isPC" class="flex items-end justify-between gap-4">
      <div>
        <div class="text-xs text-text-2">知识库 / 添加知识</div>
        <h1 class="text-2xl font-bold text-primary mt-1 flex items-center gap-2">
          <Upload class="w-6 h-6 text-accent" /> 添加知识
        </h1>
        <div class="text-sm text-text-2 mt-1">拖拽文件即时入库，或手动录入文本知识</div>
      </div>
      <button @click="showManual = true"
              class="h-10 px-4 rounded-btn border border-border bg-card hover:border-accent hover:text-accent flex items-center gap-2">
        <Edit3 class="w-4 h-4" /> 手动录入
      </button>
    </header>

    <div :class="isPC ? '' : 'flex-1 overflow-auto p-3 space-y-3'">
      <!-- 离线提示 -->
      <div v-if="offline" class="px-4 py-2 rounded-btn bg-warning/10 border border-warning/30 text-warning text-sm flex items-center gap-2">
        <AlertTriangle class="w-4 h-4" />
        后端不可达，无法加载知识库列表。请确认服务已启动。
      </div>

      <!-- 拖拽上传区 -->
      <section class="industrial-card p-5">
        <div @click="fileInput?.click()"
             @dragover.prevent="dragging = true"
             @dragleave.prevent="dragging = false"
             @drop="onDrop"
             class="border-2 border-dashed rounded-card py-10 flex flex-col items-center justify-center cursor-pointer transition"
             :class="dragging ? 'border-accent bg-accent/5' : 'border-border hover:border-accent'">
          <Upload class="w-10 h-10" :class="dragging ? 'text-accent' : 'text-text-2'" />
          <div class="mt-3 text-base font-medium" :class="dragging ? 'text-accent' : 'text-text'">
            {{ dragging ? '松手即可上传' : '拖拽文件到此处，或点击选择文件' }}
          </div>
          <div class="mt-1 text-xs text-text-2 mono">支持 {{ ALLOWED.map(e => '.' + e).join(' · ') }} · 单文件 ≤ 50MB · 支持多文件</div>
        </div>
        <input ref="fileInput" type="file" multiple class="hidden"
               :accept="ALLOWED.map(e => '.' + e).join(',')" @change="onPick" />

        <div v-if="!isPC" class="mt-3">
          <button @click="showManual = true"
                  class="w-full h-11 rounded-btn border border-border bg-card flex items-center justify-center gap-2 text-sm">
            <Edit3 class="w-4 h-4" /> 手动录入文本知识
          </button>
        </div>

        <!-- 上传队列 -->
        <ul v-if="uploads.length" class="mt-3 space-y-1.5">
          <li v-for="(u, i) in uploads" :key="i"
              class="flex items-center gap-2 px-3 py-2 rounded-btn border border-border bg-bg text-sm">
            <Loader v-if="u.status === 'uploading'" class="w-4 h-4 animate-spin text-accent" />
            <Check v-else-if="u.status === 'done'" class="w-4 h-4 text-success" />
            <X v-else class="w-4 h-4 text-danger" />
            <span class="flex-1 truncate">{{ u.name }}</span>
            <span class="text-xs text-text-2 mono">{{ fmtSize(u.size) }}</span>
            <span v-if="u.status === 'uploading'" class="text-xs text-text-2">上传中…</span>
            <span v-else-if="u.status === 'done'" class="text-xs text-success mono">#{{ u.docId }} · {{ u.chunks }} chunks</span>
            <span v-else class="text-xs text-danger">失败</span>
          </li>
        </ul>
      </section>

      <!-- 已入库列表 -->
      <section class="industrial-card overflow-hidden">
        <header class="px-5 py-3 border-b border-border flex items-center gap-3">
          <div class="text-sm font-semibold flex items-center gap-2">
            <Database class="w-4 h-4 text-accent" /> 已入库文档
            <span class="text-xs text-text-2 font-normal mono">{{ filtered.length }} / {{ docs.length }}</span>
          </div>
          <div class="ml-auto relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-2" />
            <input v-model="q" placeholder="搜索文档"
                   class="h-8 pl-9 pr-3 rounded-btn border border-border bg-bg outline-none focus:border-accent text-sm"
                   :class="isPC ? 'w-64' : 'w-40'" />
          </div>
        </header>

        <div v-if="loading" class="py-8 text-center text-text-2">
          <Loader class="w-5 h-5 mx-auto animate-spin text-accent" />
          <div class="mt-2 text-xs">加载中…</div>
        </div>
        <div v-else-if="!filtered.length" class="py-10 text-center text-text-2">
          <Database class="w-8 h-8 mx-auto opacity-50" />
          <div class="mt-2 text-sm">{{ docs.length === 0 ? '知识库为空，先上传一份文档吧' : '没有匹配的文档' }}</div>
        </div>
        <ul v-else class="divide-y divide-border max-h-[480px] overflow-auto">
          <li v-for="d in filtered" :key="d.id"
              class="px-5 py-3 flex items-center gap-3 hover:bg-bg/60">
            <FileText class="w-4 h-4 text-text-2 flex-shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ d.title }}</div>
              <div class="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-2 flex-wrap">
                <span class="mono">#{{ d.id }}</span>
                <span class="px-1.5 py-0.5 rounded mono uppercase bg-bg border border-border">{{ d.type }}</span>
                <span class="px-1.5 py-0.5 rounded-pill border" :class="STATUS_CLS[d.status] || 'bg-bg border-border'">{{ d.status }}</span>
                <span class="mono opacity-70 hidden sm:inline">{{ d.created_at }}</span>
              </div>
            </div>
            <button @click="removeDoc(d)"
                    class="w-8 h-8 rounded hover:bg-danger/10 flex items-center justify-center text-text-2 hover:text-danger flex-shrink-0">
              <Trash2 class="w-4 h-4" />
            </button>
          </li>
        </ul>
      </section>

      <div class="text-[11px] text-text-2 text-center pt-2">
        <Sparkles class="w-3 h-3 inline -mt-0.5" /> 上传后自动向量化，约 5 ~ 30 秒入库
      </div>
    </div>

    <!-- 手动录入对话框 -->
    <div v-if="showManual" class="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4"
         @click.self="!manualSubmitting && (showManual = false)">
      <div class="industrial-card w-full max-w-2xl bg-card overflow-hidden flex flex-col" style="max-height: 88vh;">
        <header class="px-5 py-3 border-b border-border flex items-center gap-2">
          <Edit3 class="w-4 h-4 text-accent" />
          <span class="font-semibold flex-1">手动录入文本知识</span>
          <button class="text-text-2 hover:text-danger" :disabled="manualSubmitting" @click="showManual = false">
            <X class="w-4 h-4" />
          </button>
        </header>
        <div class="p-5 space-y-3 overflow-auto">
          <div>
            <div class="text-sm text-text-2 mb-1">标题（可选，留空将自动生成）</div>
            <input v-model="manualTitle" placeholder="如：常见故障速查 / 操作要点速记"
                   :disabled="manualSubmitting"
                   class="w-full h-10 px-3 rounded-btn border border-border bg-bg outline-none focus:border-accent focus:bg-card" />
          </div>
          <div>
            <div class="text-sm text-text-2 mb-1">知识内容 <span class="text-danger">*</span></div>
            <textarea v-model="manualBody" rows="12"
                      placeholder="粘贴或输入知识文本……AI 会按段落自动切分入库。"
                      :disabled="manualSubmitting"
                      class="w-full px-3 py-2 rounded-btn border border-border bg-bg outline-none focus:border-accent focus:bg-card text-sm leading-relaxed"></textarea>
            <div class="text-[11px] text-text-2 mt-1">
              文本会被打包成 .txt 文件后走 /api/kb/upload 入库
            </div>
          </div>
        </div>
        <footer class="px-5 py-3 border-t border-border flex justify-end gap-2">
          <button class="h-9 px-4 rounded-btn border border-border" :disabled="manualSubmitting" @click="showManual = false">取消</button>
          <button class="h-9 px-5 rounded-btn bg-accent hover:bg-accent-2 text-white font-semibold flex items-center gap-2 disabled:opacity-60"
                  :disabled="manualSubmitting" @click="submitManual">
            <Loader v-if="manualSubmitting" class="w-4 h-4 animate-spin" />
            <Send v-else class="w-4 h-4" />
            {{ manualSubmitting ? '入库中…' : '提交入库' }}
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

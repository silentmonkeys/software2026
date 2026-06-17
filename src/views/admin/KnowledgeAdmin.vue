<script setup lang="ts">
/**
 * 管理员 · 知识库管理（FIX2 第 4 项）
 * - 仅 role === 'admin' 可访问（路由 meta.roles 已守卫）
 * - 列表 / 拖拽上传 / 二次确认删除 / 本地名称类型筛选
 * - 文档预览：当前后端无 /kb/{id}/chunks 接口，预览按钮先占位
 */
import { ref, computed, onMounted, reactive } from 'vue'
import { useDevice } from '@/composables/useDevice'
import { showToast, showFailToast, showConfirmDialog } from 'vant'
import {
  Database, Upload, Search, Trash2, FileText, RefreshCw,
  Loader, X, Eye, ShieldCheck, AlertTriangle, FileType2
} from 'lucide-vue-next'
import { listDocs, uploadDoc, deleteDoc, type KbDoc } from '@/api/kb'

const { isPC } = useDevice()

const docs = ref<KbDoc[]>([])
const loading = ref(false)
const offline = ref(false)
const q = ref('')
const filterType = ref<'all' | 'pdf' | 'docx' | 'txt' | 'md'>('all')

const ALLOWED = ['pdf', 'docx', 'txt', 'md']

interface UploadingItem { name: string; size: number; progress: 'uploading' | 'done' | 'failed'; docId?: number; chunks?: number; err?: string }
const uploads = reactive<UploadingItem[]>([])

const dragging = ref(false)
const fileInput = ref<HTMLInputElement>()

const refresh = async () => {
  loading.value = true
  try {
    const list = await listDocs()
    docs.value = list
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
  docs.value.filter(d =>
    (filterType.value === 'all' || d.type.toLowerCase() === filterType.value) &&
    (!q.value || d.title.toLowerCase().includes(q.value.toLowerCase()))
  )
)

const stats = computed(() => {
  const total = docs.value.length
  const ready = docs.value.filter(d => d.status === 'ready').length
  const parsing = docs.value.filter(d => d.status === 'parsing').length
  const failed = docs.value.filter(d => d.status === 'failed').length
  return { total, ready, parsing, failed }
})

const onFiles = async (files: FileList | File[] | null) => {
  if (!files) return
  const arr = Array.from(files)
  if (!arr.length) return
  for (const f of arr) {
    const ext = (f.name.split('.').pop() || '').toLowerCase()
    if (!ALLOWED.includes(ext)) {
      showFailToast(`仅支持 ${ALLOWED.join(' / ')}：${f.name}`)
      continue
    }
    const item: UploadingItem = { name: f.name, size: f.size, progress: 'uploading' }
    uploads.push(item)
    try {
      const res = await uploadDoc(f)
      item.docId = res.doc_id
      item.chunks = res.chunks
      item.progress = 'done'
      showToast({ type: 'success', message: `${f.name} 已入库（${res.chunks} chunks）` })
    } catch (e: any) {
      item.progress = 'failed'
      item.err = e?.message || '上传失败'
      showFailToast(`${f.name} 上传失败`)
    }
  }
  await refresh()
}

const onDrop = (e: DragEvent) => {
  e.preventDefault(); dragging.value = false
  onFiles(e.dataTransfer?.files || null)
}

const onPick = (e: Event) => {
  const t = e.target as HTMLInputElement
  onFiles(t.files)
  t.value = ''
}

const removeDoc = async (d: KbDoc) => {
  try {
    await showConfirmDialog({
      title: '删除确认',
      message: `确认删除文档「${d.title}」？删除后向量索引也会一并清理，无法恢复。`
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

const fmtSize = (n: number) => n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`

const STATUS_CLS: Record<string, string> = {
  ready:   'bg-success/10 text-success border-success/30',
  parsing: 'bg-warning/10 text-warning border-warning/30',
  failed:  'bg-danger/10 text-danger border-danger/30'
}

const previewDoc = (_d: KbDoc) => {
  // TODO: 等待后端提供 GET /api/kb/{id}/chunks 接口后，渲染分块内容
  showToast('文档分块预览接口待后端提供，敬请期待')
}
</script>

<template>
  <!-- ==================== PC ==================== -->
  <div v-if="isPC" class="p-6 max-w-[1400px] mx-auto space-y-4">
    <header class="flex items-end justify-between gap-4">
      <div>
        <div class="text-xs text-text-2 flex items-center gap-1">
          <ShieldCheck class="w-3.5 h-3.5 text-accent" /> 管理员 / 知识库管理
        </div>
        <h1 class="text-2xl font-bold text-primary mt-1 flex items-center gap-2">
          <Database class="w-6 h-6 text-accent" /> 知识库管理
        </h1>
        <div class="text-sm text-text-2 mt-1">管理向量化知识库文档：上传 / 删除 / 状态查看</div>
      </div>
      <button @click="refresh" :disabled="loading"
              class="h-10 px-4 rounded-btn border border-border bg-card hover:border-accent text-text-2 hover:text-accent flex items-center gap-2">
        <RefreshCw class="w-4 h-4" :class="loading ? 'animate-spin' : ''" /> 刷新
      </button>
    </header>

    <div v-if="offline" class="px-4 py-2 rounded-btn bg-warning/10 border border-warning/30 text-warning text-sm flex items-center gap-2">
      <AlertTriangle class="w-4 h-4" />
      后端不可达，无法加载知识库。请确认服务已启动并已登录管理员账号。
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-4 gap-3">
      <div class="industrial-card p-4">
        <div class="text-xs text-text-2">文档总数</div>
        <div class="text-2xl font-bold mt-1 mono">{{ stats.total }}</div>
      </div>
      <div class="industrial-card p-4">
        <div class="text-xs text-text-2 flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-success" /> 已就绪</div>
        <div class="text-2xl font-bold mt-1 mono text-success">{{ stats.ready }}</div>
      </div>
      <div class="industrial-card p-4">
        <div class="text-xs text-text-2 flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-warning" /> 解析中</div>
        <div class="text-2xl font-bold mt-1 mono text-warning">{{ stats.parsing }}</div>
      </div>
      <div class="industrial-card p-4">
        <div class="text-xs text-text-2 flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-danger" /> 失败</div>
        <div class="text-2xl font-bold mt-1 mono text-danger">{{ stats.failed }}</div>
      </div>
    </div>

    <!-- 上传区 -->
    <section class="industrial-card p-5">
      <div class="text-sm font-semibold mb-2 flex items-center gap-2">
        <Upload class="w-4 h-4 text-accent" /> 上传新文档
      </div>
      <div @click="fileInput?.click()"
           @dragover.prevent="dragging = true"
           @dragleave.prevent="dragging = false"
           @drop="onDrop"
           class="border-2 border-dashed rounded-card py-12 flex flex-col items-center justify-center cursor-pointer transition"
           :class="dragging ? 'border-accent bg-accent/5' : 'border-border hover:border-accent'">
        <FileType2 class="w-10 h-10 text-text-2" :class="dragging ? 'text-accent' : ''" />
        <div class="mt-3 text-sm font-medium" :class="dragging ? 'text-accent' : 'text-text'">
          {{ dragging ? '松手即可上传' : '拖拽文件到此处，或点击选择' }}
        </div>
        <div class="mt-1 text-xs text-text-2 mono">{{ ALLOWED.map(e => '.' + e).join(' · ') }} · 单文件 ≤ 50MB</div>
      </div>
      <input ref="fileInput" type="file" multiple class="hidden"
             :accept="ALLOWED.map(e => '.' + e).join(',')" @change="onPick" />

      <ul v-if="uploads.length" class="mt-3 space-y-1.5">
        <li v-for="(u, i) in uploads" :key="i"
            class="flex items-center gap-2 px-3 py-2 rounded-btn border border-border bg-bg text-sm">
          <Loader v-if="u.progress === 'uploading'" class="w-4 h-4 animate-spin text-accent" />
          <FileText v-else class="w-4 h-4" :class="u.progress === 'done' ? 'text-success' : 'text-danger'" />
          <span class="flex-1 truncate">{{ u.name }}</span>
          <span class="text-xs text-text-2 mono">{{ fmtSize(u.size) }}</span>
          <span v-if="u.progress === 'uploading'" class="text-xs text-text-2">上传中…</span>
          <span v-else-if="u.progress === 'done'" class="text-xs text-success mono">#{{ u.docId }} · {{ u.chunks }} chunks</span>
          <span v-else class="text-xs text-danger">失败</span>
        </li>
      </ul>
    </section>

    <!-- 列表区 -->
    <section class="industrial-card overflow-hidden">
      <header class="px-5 py-3 border-b border-border flex items-center gap-3">
        <div class="text-sm font-semibold flex items-center gap-2">
          <Database class="w-4 h-4 text-accent" /> 已入库文档
          <span class="text-xs text-text-2 font-normal mono">{{ filtered.length }} / {{ docs.length }}</span>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <div class="flex p-0.5 bg-bg rounded-btn border border-border text-xs">
            <button v-for="t in [{k:'all',l:'全部'},{k:'pdf',l:'PDF'},{k:'docx',l:'DOCX'},{k:'txt',l:'TXT'},{k:'md',l:'MD'}]"
                    :key="t.k" @click="filterType = t.k as any"
                    :class="['px-3 h-7 rounded font-medium', filterType === t.k ? 'bg-card shadow-card text-accent' : 'text-text-2']">
              {{ t.l }}
            </button>
          </div>
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-2" />
            <input v-model="q" placeholder="按文档名搜索"
                   class="h-8 pl-9 pr-3 rounded-btn border border-border bg-bg outline-none focus:border-accent text-sm w-56" />
          </div>
        </div>
      </header>

      <div v-if="loading" class="py-16 text-center text-text-2">
        <Loader class="w-6 h-6 mx-auto animate-spin text-accent" />
        <div class="mt-2 text-sm">加载中…</div>
      </div>
      <div v-else-if="!filtered.length" class="py-16 text-center text-text-2">
        <Database class="w-10 h-10 mx-auto opacity-50" />
        <div class="mt-3 text-sm">{{ docs.length === 0 ? '知识库为空，先上传一份文档吧' : '没有符合筛选条件的文档' }}</div>
      </div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="text-text-2 text-xs">
            <th class="text-left font-medium px-5 py-2 w-16">ID</th>
            <th class="text-left font-medium px-5 py-2">文档名</th>
            <th class="text-left font-medium px-5 py-2 w-20">类型</th>
            <th class="text-left font-medium px-5 py-2 w-24">状态</th>
            <th class="text-left font-medium px-5 py-2 w-44">入库时间</th>
            <th class="text-right font-medium px-5 py-2 w-32">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in filtered" :key="d.id" class="border-t border-border hover:bg-bg/60">
            <td class="px-5 py-3 mono text-text-2">#{{ d.id }}</td>
            <td class="px-5 py-3">
              <div class="flex items-center gap-2">
                <FileText class="w-4 h-4 text-text-2 flex-shrink-0" />
                <span class="font-medium truncate">{{ d.title }}</span>
              </div>
            </td>
            <td class="px-5 py-3">
              <span class="px-2 py-0.5 rounded text-[11px] mono uppercase bg-bg border border-border">{{ d.type }}</span>
            </td>
            <td class="px-5 py-3">
              <span class="px-2 py-0.5 rounded-pill text-[11px] border" :class="STATUS_CLS[d.status] || 'bg-bg border-border text-text-2'">
                {{ d.status }}
              </span>
            </td>
            <td class="px-5 py-3 text-text-2 mono text-xs">{{ d.created_at }}</td>
            <td class="px-5 py-3">
              <div class="flex justify-end gap-1">
                <button class="w-8 h-8 rounded hover:bg-bg flex items-center justify-center text-text-2 hover:text-accent"
                        title="预览分块" @click="previewDoc(d)">
                  <Eye class="w-4 h-4" />
                </button>
                <button class="w-8 h-8 rounded hover:bg-danger/10 flex items-center justify-center text-text-2 hover:text-danger"
                        title="删除" @click="removeDoc(d)">
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>

  <!-- ==================== 移动端 ==================== -->
  <div v-else class="p-3 space-y-3">
    <header class="industrial-card p-4">
      <h1 class="text-lg font-bold text-primary flex items-center gap-2">
        <Database class="w-5 h-5 text-accent" /> 知识库管理
      </h1>
      <div class="text-xs text-text-2 mt-1">{{ stats.total }} 份文档 · 就绪 {{ stats.ready }} · 解析 {{ stats.parsing }}</div>
    </header>

    <div v-if="offline" class="px-3 py-2 rounded-btn bg-warning/10 border border-warning/30 text-warning text-xs flex items-center gap-1.5">
      <AlertTriangle class="w-3.5 h-3.5" /> 后端不可达
    </div>

    <button @click="fileInput?.click()"
            class="w-full industrial-card border-2 border-dashed border-border py-8 flex flex-col items-center text-text-2 active:bg-bg">
      <FileType2 class="w-8 h-8" />
      <div class="mt-2 text-sm">点击选择文档上传</div>
      <div class="mt-0.5 text-[11px] mono">{{ ALLOWED.map(e => '.' + e).join(' / ') }}</div>
    </button>
    <input ref="fileInput" type="file" multiple class="hidden"
           :accept="ALLOWED.map(e => '.' + e).join(',')" @change="onPick" />

    <ul v-if="uploads.length" class="space-y-1.5">
      <li v-for="(u, i) in uploads" :key="i"
          class="flex items-center gap-2 px-3 py-2 rounded-btn border border-border bg-card text-xs">
        <Loader v-if="u.progress === 'uploading'" class="w-4 h-4 animate-spin text-accent" />
        <FileText v-else class="w-4 h-4" :class="u.progress === 'done' ? 'text-success' : 'text-danger'" />
        <span class="flex-1 truncate">{{ u.name }}</span>
        <span v-if="u.progress === 'done'" class="text-success mono">{{ u.chunks }}c</span>
      </li>
    </ul>

    <div class="relative">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-2" />
      <input v-model="q" placeholder="搜索文档"
             class="w-full h-11 pl-10 pr-3 rounded-btn border border-border bg-card text-sm" />
    </div>

    <ul class="space-y-2">
      <li v-for="d in filtered" :key="d.id" class="industrial-card p-3 active:bg-bg">
        <div class="flex items-start gap-2">
          <FileText class="w-4 h-4 text-text-2 mt-0.5" />
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium leading-snug truncate">{{ d.title }}</div>
            <div class="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-text-2">
              <span class="mono">#{{ d.id }}</span>
              <span class="px-1.5 py-0.5 rounded mono uppercase bg-bg border border-border">{{ d.type }}</span>
              <span class="px-1.5 py-0.5 rounded-pill border" :class="STATUS_CLS[d.status] || 'bg-bg border-border'">{{ d.status }}</span>
            </div>
          </div>
          <button class="w-8 h-8 rounded hover:bg-danger/10 flex items-center justify-center text-text-2"
                  @click="removeDoc(d)">
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </li>
      <li v-if="!filtered.length && !loading" class="industrial-card p-8 text-center text-text-2 text-sm">
        {{ docs.length === 0 ? '知识库为空，请先上传文档' : '没有符合筛选条件的文档' }}
      </li>
    </ul>
  </div>
</template>

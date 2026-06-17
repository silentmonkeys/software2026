<script setup lang="ts">
/**
 * 知识上传（FIX3 第 7 项）
 *
 * - worker：上传组件 + 仅显示本人记录（不可自行删除）
 * - auditor / admin：跳到 /audit/knowledge 做审核（这里依然展示本人上传，方便提交+追踪）
 *
 * 状态机：worker 上传 → pending；审核通过后才进入 RAG / 图谱
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDevice } from '@/composables/useDevice'
import {
  ChevronLeft, FileText, Loader, Upload, Search,
  Sparkles, Edit3, Send, X, Check, AlertTriangle, Database, ShieldCheck, RefreshCw
} from 'lucide-vue-next'
import { showToast, showFailToast } from 'vant'
import { uploadDoc, listDocs, type KbDoc, STATUS_LABEL, isApprovedStatus } from '@/api/kb'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const { isPC } = useDevice()
const user = useUserStore()

const ALLOWED = ['pdf', 'docx', 'txt', 'md']

interface UploadItem { name: string; size: number; status: 'uploading' | 'done' | 'failed'; docId?: number; chunks?: number }
const uploads = ref<UploadItem[]>([])
const docs = ref<KbDoc[]>([])
const loading = ref(false)
const offline = ref(false)
const q = ref('')

const dragging = ref(false)
const fileInput = ref<HTMLInputElement>()

const showManual = ref(false)
const manualTitle = ref('')
const manualBody = ref('')
const manualSubmitting = ref(false)

const refresh = async () => {
  loading.value = true
  try {
    // FIX3 第 7.3 项：员工端只看本人上传记录
    docs.value = await listDocs({ uploader: 'me' })
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

const stats = computed(() => ({
  total: docs.value.length,
  pending: docs.value.filter(d => d.status === 'pending').length,
  approved: docs.value.filter(d => isApprovedStatus(d.status)).length,
  rejected: docs.value.filter(d => d.status === 'rejected').length
}))

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
      showToast({ type: 'success', message: `${f.name} 已提交，等待审核` })
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

const submitManual = async () => {
  const title = manualTitle.value.trim() || `手动录入_${new Date().toISOString().slice(0,16).replace('T','_').replace(':','')}`
  const body = manualBody.value.trim()
  if (!body) { showFailToast('请输入知识内容'); return }
  manualSubmitting.value = true
  try {
    const blob = new Blob([body], { type: 'text/plain;charset=utf-8' })
    const file = new File([blob], `${title}.txt`, { type: 'text/plain' })
    const res = await uploadDoc(file)
    showToast({ type: 'success', message: `已提交（${res.chunks} chunks），等待审核` })
    showManual.value = false
    manualTitle.value = ''
    manualBody.value = ''
    await refresh()
  } catch {
    showFailToast('提交失败，请稍后重试')
  } finally {
    manualSubmitting.value = false
  }
}

const STATUS_CLS: Record<string, string> = {
  pending:    'bg-warning/10 text-warning border-warning/30',
  approved:   'bg-success/10 text-success border-success/30',
  ready:      'bg-success/10 text-success border-success/30',
  rejected:   'bg-danger/10 text-danger border-danger/30',
  taken_down: 'bg-text-2/10 text-text-2 border-border',
  parsing:    'bg-warning/10 text-warning border-warning/30',
  failed:     'bg-danger/10 text-danger border-danger/30'
}

/** 重新提交（驳回后） */
const resubmit = (d: KbDoc) => {
  manualTitle.value = `${d.title}（重提）`
  manualBody.value = ''
  showManual.value = true
}

const goReview = () => router.push('/audit/knowledge')
</script>

<template>
  <div :class="isPC ? 'p-6 max-w-5xl mx-auto space-y-4' : 'h-full flex flex-col'">
    <!-- 移动端顶栏 -->
    <header v-if="!isPC" class="flex-shrink-0 h-12 bg-card border-b border-border flex items-center px-2">
      <button @click="router.back()" class="w-10 h-10 flex items-center justify-center"><ChevronLeft class="w-5 h-5" /></button>
      <span class="flex-1 text-center font-semibold">添加知识</span>
      <button v-if="user.isAuditor" @click="goReview" class="w-10 h-10 flex items-center justify-center text-accent" title="审查">
        <ShieldCheck class="w-5 h-5" />
      </button>
      <span v-else class="w-10"></span>
    </header>

    <!-- PC 标题栏 -->
    <header v-if="isPC" class="flex items-end justify-between gap-4">
      <div>
        <div class="text-xs text-text-2">知识库 / 添加知识</div>
        <h1 class="text-2xl font-bold text-primary mt-1 flex items-center gap-2">
          <Upload class="w-6 h-6 text-accent" /> 添加知识
        </h1>
        <div class="text-sm text-text-2 mt-1">
          上传后默认进入「待审」状态，审核通过后会自动加入知识检索与图谱
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button v-if="user.isAuditor" @click="goReview"
                class="h-10 px-4 rounded-btn border border-accent text-accent hover:bg-accent/10 flex items-center gap-2">
          <ShieldCheck class="w-4 h-4" /> 进入知识审查
        </button>
        <button @click="showManual = true"
                class="h-10 px-4 rounded-btn border border-border bg-card hover:border-accent hover:text-accent flex items-center gap-2">
          <Edit3 class="w-4 h-4" /> 手动录入
        </button>
        <button @click="refresh" :disabled="loading"
                class="h-10 w-10 rounded-btn border border-border bg-card flex items-center justify-center hover:border-accent text-text-2 hover:text-accent">
          <RefreshCw class="w-4 h-4" :class="loading ? 'animate-spin' : ''" />
        </button>
      </div>
    </header>

    <div :class="isPC ? '' : 'flex-1 overflow-auto p-3 space-y-3'">
      <div v-if="offline" class="px-4 py-2 rounded-btn bg-warning/10 border border-warning/30 text-warning text-sm flex items-center gap-2">
        <AlertTriangle class="w-4 h-4" />
        后端不可达，无法加载本人上传记录。
      </div>

      <!-- 概览统计 -->
      <div class="grid grid-cols-4 gap-2 text-center">
        <div class="industrial-card p-3">
          <div class="text-[11px] text-text-2">已提交</div>
          <div class="text-lg font-bold mt-1 mono">{{ stats.total }}</div>
        </div>
        <div class="industrial-card p-3">
          <div class="text-[11px] text-text-2">待审</div>
          <div class="text-lg font-bold mt-1 mono text-warning">{{ stats.pending }}</div>
        </div>
        <div class="industrial-card p-3">
          <div class="text-[11px] text-text-2">通过</div>
          <div class="text-lg font-bold mt-1 mono text-success">{{ stats.approved }}</div>
        </div>
        <div class="industrial-card p-3">
          <div class="text-[11px] text-text-2">驳回</div>
          <div class="text-lg font-bold mt-1 mono text-danger">{{ stats.rejected }}</div>
        </div>
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

        <ul v-if="uploads.length" class="mt-3 space-y-1.5">
          <li v-for="(u, i) in uploads" :key="i"
              class="flex items-center gap-2 px-3 py-2 rounded-btn border border-border bg-bg text-sm">
            <Loader v-if="u.status === 'uploading'" class="w-4 h-4 animate-spin text-accent" />
            <Check v-else-if="u.status === 'done'" class="w-4 h-4 text-success" />
            <X v-else class="w-4 h-4 text-danger" />
            <span class="flex-1 truncate">{{ u.name }}</span>
            <span class="text-xs text-text-2 mono">{{ fmtSize(u.size) }}</span>
            <span v-if="u.status === 'uploading'" class="text-xs text-text-2">上传中…</span>
            <span v-else-if="u.status === 'done'" class="text-xs text-warning mono">#{{ u.docId }} · 待审</span>
            <span v-else class="text-xs text-danger">失败</span>
          </li>
        </ul>
      </section>

      <!-- 我的上传记录 -->
      <section class="industrial-card overflow-hidden">
        <header class="px-5 py-3 border-b border-border flex items-center gap-3">
          <div class="text-sm font-semibold flex items-center gap-2">
            <Database class="w-4 h-4 text-accent" /> 我的上传记录
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
          <div class="mt-2 text-sm">{{ docs.length === 0 ? '尚未提交过任何文档' : '没有匹配的文档' }}</div>
          <div class="mt-1 text-xs">提交后审核员会进行审核，通过后才会被检索引用</div>
        </div>
        <ul v-else class="divide-y divide-border max-h-[480px] overflow-auto">
          <li v-for="d in filtered" :key="d.id"
              class="px-5 py-3 flex items-start gap-3 hover:bg-bg/60">
            <FileText class="w-4 h-4 text-text-2 flex-shrink-0 mt-0.5" />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ d.title }}</div>
              <div class="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-2 flex-wrap">
                <span class="mono">#{{ d.id }}</span>
                <span class="px-1.5 py-0.5 rounded mono uppercase bg-bg border border-border">{{ d.type }}</span>
                <span class="px-1.5 py-0.5 rounded-pill border" :class="STATUS_CLS[d.status] || 'bg-bg border-border'">
                  {{ STATUS_LABEL[d.status] || d.status }}
                </span>
                <span class="mono opacity-70 hidden sm:inline">{{ d.created_at }}</span>
              </div>
              <div v-if="d.status === 'rejected' && d.reason" class="mt-1 text-xs text-danger">
                驳回原因：{{ d.reason }}
              </div>
            </div>
            <button v-if="d.status === 'rejected'" @click="resubmit(d)"
                    class="h-7 px-2 rounded-btn border border-accent text-accent hover:bg-accent/10 text-xs flex items-center gap-1 flex-shrink-0">
              <RefreshCw class="w-3 h-3" /> 重提
            </button>
          </li>
        </ul>
      </section>

      <div class="text-[11px] text-text-2 text-center pt-2">
        <Sparkles class="w-3 h-3 inline -mt-0.5" /> 一旦提交不可自行删除，如需下架请联系审核员
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
            <div class="text-sm text-text-2 mb-1">标题（可选）</div>
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
              提交后状态为「待审」，由审核员通过后才进入检索 / 图谱
            </div>
          </div>
        </div>
        <footer class="px-5 py-3 border-t border-border flex justify-end gap-2">
          <button class="h-9 px-4 rounded-btn border border-border" :disabled="manualSubmitting" @click="showManual = false">取消</button>
          <button class="h-9 px-5 rounded-btn bg-accent hover:bg-accent-2 text-white font-semibold flex items-center gap-2 disabled:opacity-60"
                  :disabled="manualSubmitting" @click="submitManual">
            <Loader v-if="manualSubmitting" class="w-4 h-4 animate-spin" />
            <Send v-else class="w-4 h-4" />
            {{ manualSubmitting ? '提交中…' : '提交审核' }}
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

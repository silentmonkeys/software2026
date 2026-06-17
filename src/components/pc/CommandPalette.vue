<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Search } from 'lucide-vue-next'

const props = defineProps<{ open: boolean }>()
const emit  = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const router = useRouter()
const q = ref('')

const items = [
  { keyword: '多模态检索', path: '/search',            hint: '拍照 / 文字 / 设备型号检索' },
  { keyword: '作业指引',   path: '/workflow',          hint: '标准化检修流程 SOP' },
  { keyword: '知识上传',   path: '/knowledge/upload',  hint: '提交一线检修案例' },
  { keyword: '知识审查',   path: '/audit/knowledge',   hint: '审核员 / 管理员审批文档' },
  { keyword: '案例审核',   path: '/audit',             hint: '审核员入口' },
  { keyword: '知识图谱',   path: '/kg',                hint: '故障实体关系图' },
  { keyword: '历史与收藏', path: '/history',           hint: '检索历史 / 收藏' },
  { keyword: '系统管理',   path: '/admin',             hint: '管理员入口' }
]

const list = computed(() => items.filter(i => !q.value || i.keyword.includes(q.value) || i.hint.includes(q.value)))
const idx = ref(0)

watch(() => props.open, v => { if (v) { q.value = ''; idx.value = 0 } })

const go = (p: string) => { router.push(p); emit('update:open', false) }

const onKey = (e: KeyboardEvent) => {
  if (!list.value.length) return
  if (e.key === 'ArrowDown') { idx.value = (idx.value + 1) % list.value.length; e.preventDefault() }
  else if (e.key === 'ArrowUp') { idx.value = (idx.value - 1 + list.value.length) % list.value.length; e.preventDefault() }
  else if (e.key === 'Enter') { go(list.value[idx.value].path); e.preventDefault() }
}
</script>

<template>
  <transition name="fade">
    <div v-if="open"
         class="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-32"
         @click.self="emit('update:open', false)">
      <div class="w-[600px] industrial-card shadow-float overflow-hidden">
        <div class="px-4 h-12 flex items-center gap-3 border-b border-border">
          <Search class="w-4 h-4 text-text-2" />
          <input v-model="q" @keydown="onKey" autofocus
                 placeholder="跳转到… 输入关键词,Enter 跳转,Esc 关闭"
                 class="flex-1 outline-none bg-transparent text-sm" />
          <span class="mono text-xs text-text-2 bg-bg px-1.5 py-0.5 rounded">⌘K</span>
        </div>
        <div class="max-h-80 overflow-auto py-2">
          <button v-for="(it, i) in list" :key="it.path"
                  @click="go(it.path)" @mouseenter="idx = i"
                  :class="['w-full text-left px-4 h-12 flex items-center gap-3 transition', idx === i ? 'bg-accent/10' : 'hover:bg-bg']">
            <span class="text-sm font-medium" :class="idx === i ? 'text-accent' : 'text-text'">{{ it.keyword }}</span>
            <span class="text-xs text-text-2">{{ it.hint }}</span>
            <span class="ml-auto mono text-xs text-text-2">{{ it.path }}</span>
          </button>
          <div v-if="!list.length" class="px-4 py-6 text-center text-text-2 text-sm">没有匹配项</div>
        </div>
        <div class="px-4 h-9 border-t border-border flex items-center text-xs text-text-2 mono gap-4">
          <span>↑↓ 切换</span><span>↵ 跳转</span><span>Esc 关闭</span>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity .15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

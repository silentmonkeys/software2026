<script setup lang="ts">
import { ref } from 'vue'
import { useSearchStore } from '@/stores/search'
import { useDevice } from '@/composables/useDevice'
import { History, Heart, Book, MessageCircle, Trash2 } from 'lucide-vue-next'
import { formatRelTime, formatTime } from '@/utils/format'

const store = useSearchStore()
const { isPC } = useDevice()
const tab = ref<'history' | 'fav-case' | 'fav-manual' | 'chat'>('history')

const tabs = [
  { k: 'history', l: '检索历史', icon: History, n: () => store.history.length },
  { k: 'fav-case', l: '收藏案例', icon: Heart,  n: () => 8 },
  { k: 'fav-manual', l: '收藏手册', icon: Book, n: () => 4 },
  { k: 'chat', l: '对话历史', icon: MessageCircle, n: () => 12 }
]
</script>

<template>
  <div :class="isPC ? 'p-6 max-w-5xl mx-auto' : 'p-3'">
    <header v-if="isPC" class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-bold">历史与收藏</h1>
      <button class="h-9 px-3 rounded-btn border border-border text-sm flex items-center gap-1.5"><Trash2 class="w-4 h-4" /> 批量清理</button>
    </header>

    <div :class="isPC ? 'flex gap-2 mb-3' : 'grid grid-cols-4 gap-1.5 mb-3'">
      <button v-for="t in tabs" :key="t.k" @click="tab = t.k as any"
              :class="['h-10 rounded-btn text-sm flex items-center justify-center gap-1.5 px-3',
                       tab === t.k ? 'bg-accent text-white font-semibold' : 'bg-card border border-border text-text-2']">
        <component :is="t.icon" class="w-4 h-4" />
        <span :class="isPC ? '' : 'text-xs'">{{ t.l }}</span>
        <span class="mono text-[10px] px-1 rounded" :class="tab === t.k ? 'bg-white/20' : 'bg-bg'">{{ t.n() }}</span>
      </button>
    </div>

    <div v-if="tab === 'history'" class="industrial-card overflow-hidden">
      <ul class="divide-y divide-border">
        <li v-for="h in store.history" :key="h.id" class="p-4 flex items-center gap-3 hover:bg-bg cursor-pointer">
          <History class="w-4 h-4 text-text-2 flex-shrink-0" />
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">{{ h.text }}</div>
            <div class="text-xs text-text-2 mt-0.5">
              <span v-if="h.device" class="mono mr-2">{{ h.device }}</span>
              {{ isPC ? formatTime(h.at) : formatRelTime(h.at) }}
            </div>
          </div>
          <button class="text-xs text-accent hover:underline">重跑</button>
        </li>
      </ul>
      <div v-if="!store.history.length" class="p-8 text-center text-text-2 text-sm">暂无历史</div>
    </div>

    <div v-else class="industrial-card p-8 text-center text-text-2 text-sm">
      该 Tab 内容占位中,接入后端后将自动填充
    </div>
  </div>
</template>

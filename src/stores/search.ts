import { defineStore } from 'pinia'
import { ref } from 'vue'
import { storage } from '@/utils/storage'

/**
 * 检索建议词存储（FIX3 第 2/3 项后）
 * 仅用于输入框的简单"上次提过的词"补全；真实历史已迁移到 stores/chatHistory.ts
 */
export interface SearchHistoryItem {
  id: string
  text: string
  device?: string
  at: string
}

export const useSearchStore = defineStore('search', () => {
  const history = ref<SearchHistoryItem[]>(storage.get<SearchHistoryItem[]>('search:history') || [])

  const push = (q: string, device?: string) => {
    if (!q?.trim()) return
    history.value.unshift({ id: 's' + Date.now(), text: q.trim(), device, at: new Date().toISOString() })
    if (history.value.length > 30) history.value.length = 30
    storage.set('search:history', history.value)
  }

  return { history, push }
})

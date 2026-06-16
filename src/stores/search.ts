import { defineStore } from 'pinia'
import { ref } from 'vue'
import { storage } from '@/utils/storage'

export interface SearchHistoryItem {
  id: string
  text: string
  device?: string
  at: string
}

export const useSearchStore = defineStore('search', () => {
  const history = ref<SearchHistoryItem[]>(storage.get<SearchHistoryItem[]>('search:history') || [
    { id: 's1', text: '热轧主电机异响', device: 'YKK630-4', at: new Date(Date.now() - 3600 * 1000).toISOString() },
    { id: 's2', text: '冷却泵流量波动',   device: 'CT-2400',  at: new Date(Date.now() - 7200 * 1000).toISOString() },
    { id: 's3', text: '变频器报警 E07',    device: 'INV-5500', at: new Date(Date.now() - 14400 * 1000).toISOString() }
  ])

  const favorites = ref<string[]>(storage.get<string[]>('search:fav') || [])

  const push = (q: string, device?: string) => {
    history.value.unshift({ id: 's' + Date.now(), text: q, device, at: new Date().toISOString() })
    if (history.value.length > 30) history.value.length = 30
    storage.set('search:history', history.value)
  }

  const toggleFav = (id: string) => {
    const i = favorites.value.indexOf(id)
    if (i >= 0) favorites.value.splice(i, 1)
    else favorites.value.push(id)
    storage.set('search:fav', favorites.value)
  }

  return { history, favorites, push, toggleFav }
})

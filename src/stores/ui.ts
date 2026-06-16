import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const cmdPaletteOpen = ref(false)
  const aiAssistantOpen = ref(false)
  const sideDrawerOpen = ref(false)
  const settingsDrawerOpen = ref(false)

  return { cmdPaletteOpen, aiAssistantOpen, sideDrawerOpen, settingsDrawerOpen }
})

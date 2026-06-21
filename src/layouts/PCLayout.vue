<script setup lang="ts">
import TopBar from '@/components/pc/TopBar.vue'
import SideNav from '@/components/pc/SideNav.vue'
import CommandPalette from '@/components/pc/CommandPalette.vue'
import { useUiStore } from '@/stores/ui'
import { useShortcut } from '@/composables/useShortcut'
import { storeToRefs } from 'pinia'

const ui = useUiStore()
const { cmdPaletteOpen } = storeToRefs(ui)

useShortcut([
  { combo: 'mod+k', handler: () => { cmdPaletteOpen.value = true } },
  { combo: 'esc',   handler: () => { cmdPaletteOpen.value = false } }
])
</script>

<template>
  <div class="h-screen flex flex-col bg-bg overflow-hidden">
    <TopBar />
    <div class="flex-1 flex overflow-hidden">
      <SideNav />
      <main class="flex-1 overflow-auto">
        <slot />
      </main>
    </div>
    <footer class="h-8 px-4 flex items-center justify-between bg-primary text-on-dark text-xs flex-shrink-0">
      <span class="opacity-70">© 2026 设备检修知识检索与作业系统</span>
      <span class="opacity-70 mono">Asia/Shanghai · v0.1.0</span>
    </footer>

    <CommandPalette v-model:open="cmdPaletteOpen" />
  </div>
</template>

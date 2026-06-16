<script setup lang="ts">
import { Menu, Search, Bell } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
defineProps<{ title: string }>()
defineEmits<{ (e: 'menu'): void }>()
const router = useRouter()
</script>

<template>
  <header class="h-12 flex-shrink-0 bg-primary text-on-dark flex items-center px-3 gap-2 safe-top relative z-30">
    <button @click="$emit('menu')" class="w-10 h-10 -ml-2 flex items-center justify-center" aria-label="菜单">
      <Menu class="w-5 h-5" />
    </button>
    <div class="flex-1 text-center font-semibold text-base truncate">{{ title }}</div>
    <button @click="router.push('/search')" class="w-10 h-10 flex items-center justify-center" aria-label="搜索">
      <Search class="w-5 h-5" />
    </button>
    <button class="w-10 h-10 flex items-center justify-center relative" aria-label="通知">
      <Bell class="w-5 h-5" />
      <span class="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full"></span>
    </button>
  </header>
</template>

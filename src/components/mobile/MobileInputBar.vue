<script setup lang="ts">
import { ref } from 'vue'
import { Camera, Mic, Send, X } from 'lucide-vue-next'
import VoiceInputButton from './VoiceInputButton.vue'

const props = defineProps<{ modelValue: string; images: string[] }>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'update:images', v: string[]): void
  (e: 'pick', files: File[]): void
  (e: 'send'): void
  (e: 'voice', text: string): void
}>()

const fileInput = ref<HTMLInputElement>()

const onPick = (ev: Event) => {
  const files = (ev.target as HTMLInputElement).files
  if (!files) return
  const next = [...props.images]
  const picked: File[] = []
  Array.from(files).forEach(f => {
    next.push(URL.createObjectURL(f))
    picked.push(f)
  })
  emit('update:images', next)
  if (picked.length) emit('pick', picked)
}
const removeImg = (i: number) => {
  const n = [...props.images]; n.splice(i, 1); emit('update:images', n)
}
</script>

<template>
  <div class="flex-shrink-0 bg-card border-t border-border safe-bottom">
    <!-- 缩略图横滑条 -->
    <div v-if="images.length" class="flex gap-2 overflow-x-auto px-3 pt-2 hide-scrollbar">
      <div v-for="(url, i) in images" :key="i" class="relative w-16 h-16 flex-shrink-0 rounded-btn overflow-hidden bg-bg">
        <img :src="url" class="w-full h-full object-cover" />
        <button class="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                @click="removeImg(i)">
          <X class="w-3 h-3" />
        </button>
      </div>
    </div>
    <!-- 输入区 -->
    <div class="h-20 flex items-center px-3 gap-2">
      <button @click="fileInput?.click()"
              class="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 active:scale-95 transition">
        <Camera class="w-6 h-6" />
      </button>
      <input ref="fileInput" type="file" accept="image/*" capture="environment" multiple class="hidden" @change="onPick" />

      <div class="flex-1 h-12 px-4 rounded-pill bg-bg flex items-center gap-2">
        <input :value="modelValue" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
               @keydown.enter="emit('send')"
               placeholder="描述故障…"
               class="flex-1 bg-transparent outline-none text-base" />
        <VoiceInputButton @text="t => emit('voice', t)">
          <Mic class="w-5 h-5 text-text-2" />
        </VoiceInputButton>
      </div>

      <button @click="emit('send')"
              class="w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center flex-shrink-0 active:scale-95 transition shadow-card">
        <Send class="w-5 h-5" />
      </button>
    </div>
  </div>
</template>

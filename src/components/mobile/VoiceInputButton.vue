<script setup lang="ts">
/**
 * 长按录音按钮(模拟)。真实部署接 WebSpeech API / 后端 ASR。
 */
import { ref } from 'vue'

const emit = defineEmits<{ (e: 'text', t: string): void }>()
const recording = ref(false)
let timer: number | null = null

const start = () => {
  recording.value = true
  if ('vibrate' in navigator) navigator.vibrate(30)
}
const stop = () => {
  if (!recording.value) return
  recording.value = false
  if (timer) { clearTimeout(timer); timer = null }
  // 模拟识别
  emit('text', '电机驱动端有金属摩擦声,温度持续升高')
}
</script>

<template>
  <button
    @pointerdown="start" @pointerup="stop" @pointerleave="stop" @pointercancel="stop"
    class="w-10 h-10 flex items-center justify-center rounded-full active:bg-accent/10 select-none"
    :class="recording ? 'bg-accent text-white' : ''" title="长按说话">
    <slot />
    <transition name="fade">
      <div v-if="recording"
           class="fixed inset-x-0 bottom-32 mx-auto w-44 h-44 rounded-full bg-accent text-white flex flex-col items-center justify-center shadow-float z-50 pointer-events-none">
        <div class="text-3xl">🎤</div>
        <div class="mt-2 text-sm">松开发送 · 上滑取消</div>
      </div>
    </transition>
  </button>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity .15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

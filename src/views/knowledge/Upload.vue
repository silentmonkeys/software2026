<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useDevice } from '@/composables/useDevice'
import { Camera, Mic, Save, Send, ChevronLeft, Sparkles } from 'lucide-vue-next'
import { showToast } from 'vant'
import { saveDraft, submitCase } from '@/api/knowledge'

const router = useRouter()
const { isPC } = useDevice()

const step = ref(0)
const steps = ['基本信息', '故障描述', '处理过程', '结果与反思', '附件']

const form = reactive({
  title: '', device: '', faultType: '', level: 2, occurAt: '',
  desc: '',
  process: '',
  result: '',
  attachments: [] as { url: string; name: string }[]
})

const onSave = async () => { await saveDraft(form); showToast({ type: 'success', message: '草稿已保存' }) }
const onSubmit = async () => {
  await submitCase(form)
  showToast({ type: 'success', message: '已提交审核,请在"历史"中查看进度' })
  router.push('/history')
}
</script>

<template>
  <div :class="isPC ? 'p-6 max-w-6xl mx-auto' : 'h-full flex flex-col'">
    <header v-if="!isPC" class="flex-shrink-0 h-12 bg-card border-b border-border flex items-center px-2">
      <button @click="router.back()" class="w-10 h-10 flex items-center justify-center"><ChevronLeft class="w-5 h-5" /></button>
      <span class="flex-1 text-center font-semibold">提交检修案例</span>
      <span class="w-10"></span>
    </header>

    <!-- 步骤指示 -->
    <section :class="isPC ? 'industrial-card p-4' : 'px-4 py-3 bg-card border-b border-border'">
      <div v-if="isPC" class="flex items-center">
        <template v-for="(s, i) in steps" :key="i">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mono"
                 :class="i < step ? 'bg-success text-white'
                       : i === step ? 'bg-accent text-white'
                       : 'bg-border text-text-2'">{{ i + 1 }}</div>
            <span class="text-sm" :class="i === step ? 'text-accent font-semibold' : i < step ? 'text-text' : 'text-text-2'">{{ s }}</span>
          </div>
          <div v-if="i < steps.length - 1" class="flex-1 h-px mx-3 bg-border"></div>
        </template>
      </div>
      <div v-else class="flex justify-center gap-1.5">
        <span v-for="(_, i) in steps" :key="i"
              class="h-1.5 rounded-full transition-all"
              :class="i === step ? 'w-6 bg-accent' : i < step ? 'w-1.5 bg-success' : 'w-1.5 bg-border'"></span>
      </div>
    </section>

    <!-- 表单主体 + 预览 -->
    <div :class="isPC ? 'mt-4 grid grid-cols-3 gap-4' : 'flex-1 overflow-auto p-3'">
      <main :class="isPC ? 'industrial-card p-5 col-span-2 space-y-4' : 'industrial-card p-4 space-y-4'">
        <div v-if="step === 0" class="space-y-3">
          <div><div class="text-sm text-text-2 mb-1">案例标题</div>
            <input v-model="form.title" placeholder="一句话概括故障" class="w-full h-10 px-3 rounded-btn border border-border bg-bg outline-none focus:border-accent focus:bg-card" /></div>
          <div class="grid grid-cols-2 gap-3">
            <div><div class="text-sm text-text-2 mb-1">设备型号</div>
              <input v-model="form.device" class="w-full h-10 px-3 rounded-btn border border-border bg-bg mono" /></div>
            <div><div class="text-sm text-text-2 mb-1">故障类型(自动联想)</div>
              <input v-model="form.faultType" placeholder="如: 异响 / 温度异常" class="w-full h-10 px-3 rounded-btn border border-border bg-bg" /></div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div><div class="text-sm text-text-2 mb-1">检修等级</div>
              <select v-model="form.level" class="w-full h-10 px-3 rounded-btn border border-border bg-bg">
                <option :value="1">一级 · 常规</option><option :value="2">二级 · 重要</option><option :value="3">三级 · 紧急</option>
              </select></div>
            <div><div class="text-sm text-text-2 mb-1">发生时间</div>
              <input v-model="form.occurAt" type="datetime-local" class="w-full h-10 px-3 rounded-btn border border-border bg-bg" /></div>
          </div>
        </div>

        <div v-if="step === 1" class="space-y-2">
          <div class="text-sm text-text-2">故障描述(支持图片粘贴 / 表格 / 代码块,本占位为简版)</div>
          <textarea v-model="form.desc" rows="10" placeholder="详细描述故障现象、声音、温度、振动等"
                    class="w-full px-3 py-2 rounded-btn border border-border bg-bg outline-none focus:border-accent focus:bg-card"></textarea>
        </div>

        <div v-if="step === 2" class="space-y-2">
          <div class="text-sm text-text-2">处理过程(可从 SOP 模板导入)</div>
          <textarea v-model="form.process" rows="10" placeholder="按步骤记录处理过程"
                    class="w-full px-3 py-2 rounded-btn border border-border bg-bg"></textarea>
        </div>

        <div v-if="step === 3" class="space-y-2">
          <div class="text-sm text-text-2">结果与反思</div>
          <textarea v-model="form.result" rows="10" placeholder="处理结果、耗时、经验总结"
                    class="w-full px-3 py-2 rounded-btn border border-border bg-bg"></textarea>
        </div>

        <div v-if="step === 4" class="space-y-3">
          <div class="text-sm text-text-2">附件 · 拖拽上传或点击</div>
          <div class="border-2 border-dashed border-border rounded-card py-10 flex flex-col items-center justify-center text-text-2 hover:border-accent transition cursor-pointer">
            <Camera class="w-8 h-8" />
            <div class="mt-2 text-sm">点击拍照 / 选择图片 / 视频 / PDF</div>
            <div class="text-xs opacity-70 mono mt-1">单文件 ≤ 50MB</div>
          </div>
          <div class="flex gap-2">
            <button class="flex-1 h-10 rounded-btn bg-bg border border-border flex items-center justify-center gap-1 text-sm"><Camera class="w-4 h-4" /> 拍照</button>
            <button class="flex-1 h-10 rounded-btn bg-bg border border-border flex items-center justify-center gap-1 text-sm"><Mic class="w-4 h-4" /> 语音转文字</button>
          </div>
        </div>

        <!-- 步骤切换 -->
        <div class="flex justify-between pt-3 border-t border-border">
          <button @click="step = Math.max(0, step - 1)" :disabled="step === 0"
                  class="h-10 px-4 rounded-btn border border-border disabled:opacity-50">上一步</button>
          <div class="flex gap-2">
            <button @click="onSave" class="h-10 px-4 rounded-btn border border-border flex items-center gap-1"><Save class="w-4 h-4" /> 保存草稿</button>
            <button v-if="step < steps.length - 1" @click="step++" class="h-10 px-4 rounded-btn bg-accent text-white">下一步</button>
            <button v-else @click="onSubmit" class="h-10 px-5 rounded-btn bg-accent text-white font-semibold flex items-center gap-1"><Send class="w-4 h-4" /> 提交审核</button>
          </div>
        </div>
      </main>

      <!-- 实时预览(仅 PC 宽屏) -->
      <aside v-if="isPC" class="industrial-card p-5">
        <div class="flex items-center gap-2 text-sm font-semibold mb-3">
          <Sparkles class="w-4 h-4 text-ai" /> 实时预览
        </div>
        <div class="text-xs bg-ai/5 border border-ai/30 rounded p-2 text-ai mb-3">提交前 AI 预检 · 结构完整度 78%,建议补充处理结果验证步骤</div>
        <div class="space-y-3 text-sm">
          <div><span class="text-text-2">标题:</span> {{ form.title || '—' }}</div>
          <div><span class="text-text-2">设备:</span> <span class="mono">{{ form.device || '—' }}</span></div>
          <div><span class="text-text-2">故障:</span> {{ form.faultType || '—' }}</div>
          <div><span class="text-text-2">等级:</span> L{{ form.level }}</div>
          <hr class="border-border" />
          <div><div class="text-text-2 mb-1">描述</div><div class="whitespace-pre-wrap">{{ form.desc || '—' }}</div></div>
        </div>
      </aside>
    </div>
  </div>
</template>

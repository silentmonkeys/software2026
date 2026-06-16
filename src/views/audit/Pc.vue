<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { auditList, approve, reject } from '@/api/audit'
import type { CaseSummary } from '@/api/knowledge'
import { showToast } from 'vant'
import { formatTime } from '@/utils/format'
import { Check, X, Filter, ListTodo } from 'lucide-vue-next'

const tab = ref<'pending' | 'approved' | 'rejected'>('pending')
const list = ref<CaseSummary[]>([])
const selected = ref<string[]>([])
const detailId = ref<string | null>(null)

const load = async () => { list.value = await auditList(tab.value); selected.value = [] }
onMounted(load)

const cur = computed(() => list.value.find(c => c.id === detailId.value))

const onTab = (t: typeof tab.value) => { tab.value = t; load() }
const toggleAll = (e: Event) => {
  selected.value = (e.target as HTMLInputElement).checked ? list.value.map(i => i.id) : []
}
const onApprove = async (ids: string[]) => { await approve(ids); showToast({ type: 'success', message: '已通过' }); load() }
const onReject = async (ids: string[]) => { await reject(ids); showToast({ type: 'success', message: '已驳回' }); load() }
</script>

<template>
  <div class="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
    <header class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-bold flex items-center gap-2"><ListTodo class="w-5 h-5 text-accent" />案例审核工作台</h1>
      <button class="h-9 px-3 rounded-btn border border-border flex items-center gap-1.5 text-sm"><Filter class="w-4 h-4" /> 高级筛选</button>
    </header>

    <div class="industrial-card overflow-hidden flex-1 flex flex-col">
      <!-- Tabs -->
      <div class="flex border-b border-border px-4">
        <button v-for="t in [{k:'pending',l:'待审'},{k:'approved',l:'已通过'},{k:'rejected',l:'已驳回'},{k:'mine',l:'我的审核'}]"
                :key="t.k" @click="onTab(t.k as any)"
                :class="['h-11 px-4 text-sm border-b-2 -mb-px', tab === t.k ? 'border-accent text-accent font-semibold' : 'border-transparent text-text-2']">
          {{ t.l }}
        </button>
        <div class="ml-auto flex items-center gap-2 py-2" v-if="selected.length">
          <span class="text-sm text-text-2">已选 {{ selected.length }}</span>
          <button @click="onApprove(selected)" class="h-8 px-3 rounded-btn bg-success text-white text-sm flex items-center gap-1">
            <Check class="w-4 h-4" /> 批量通过
          </button>
          <button @click="onReject(selected)" class="h-8 px-3 rounded-btn bg-danger text-white text-sm flex items-center gap-1">
            <X class="w-4 h-4" /> 批量驳回
          </button>
        </div>
      </div>

      <div class="flex-1 grid grid-cols-12 overflow-hidden">
        <!-- 列表 -->
        <div class="col-span-7 overflow-auto border-r border-border">
          <table class="w-full text-sm">
            <thead class="bg-bg sticky top-0 z-10">
              <tr class="text-text-2 text-xs">
                <th class="w-10 p-2"><input type="checkbox" :checked="selected.length === list.length && list.length > 0" @change="toggleAll" class="accent-accent" /></th>
                <th class="p-2 text-left">标题</th>
                <th class="p-2">提交人</th>
                <th class="p-2">设备</th>
                <th class="p-2">提交时间</th>
                <th class="p-2">AI 预审</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in list" :key="c.id"
                  @click="detailId = c.id"
                  class="border-t border-border cursor-pointer hover:bg-bg"
                  :class="detailId === c.id ? 'bg-accent/5' : ''">
                <td class="p-2 text-center" @click.stop>
                  <input type="checkbox" :value="c.id" v-model="selected" class="accent-accent" />
                </td>
                <td class="p-2 font-medium truncate max-w-xs">{{ c.title }}</td>
                <td class="p-2 text-center">{{ c.submitter }}</td>
                <td class="p-2 text-center mono text-xs">{{ c.device }}</td>
                <td class="p-2 text-center text-xs text-text-2">{{ formatTime(c.submittedAt) }}</td>
                <td class="p-2 text-center text-xs"
                    :class="c.aiPreview?.includes('✓') ? 'text-success' : 'text-warning'">
                  {{ c.aiPreview }}
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="!list.length" class="py-12 text-center text-text-2 text-sm">暂无{{ tab === 'pending' ? '待审' : '记录' }}</div>
        </div>

        <!-- 详情 -->
        <div class="col-span-5 overflow-auto p-5" v-if="cur">
          <h3 class="text-base font-semibold">{{ cur.title }}</h3>
          <div class="text-xs text-text-2 mt-1">{{ cur.submitter }} · {{ formatTime(cur.submittedAt) }} · {{ cur.device }}</div>
          <div class="mt-4 industrial-card p-3 text-sm leading-relaxed text-text-2">
            提交人详细描述 · 处理过程 · 结果反思 ……(占位,真实数据接入 /audit/:id)
          </div>
          <div class="mt-4">
            <textarea rows="3" placeholder="审核批注…" class="w-full px-3 py-2 rounded-btn border border-border bg-bg text-sm"></textarea>
          </div>
          <div class="mt-3 flex gap-2">
            <button @click="onApprove([cur.id])" class="flex-1 h-10 rounded-btn bg-success text-white font-semibold">通过</button>
            <button @click="onReject([cur.id])"  class="flex-1 h-10 rounded-btn bg-danger text-white font-semibold">驳回</button>
          </div>
          <button class="mt-3 w-full h-10 rounded-btn border border-border text-sm">一键抽取关键信息入图谱</button>
        </div>
        <div v-else class="col-span-5 grid place-items-center text-text-2 text-sm">点击左侧条目查看详情</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { auditList, approve, reject } from '@/api/audit'
import type { CaseSummary } from '@/api/knowledge'
import SwipeableCard from '@/components/mobile/SwipeableCard.vue'
import { formatTime } from '@/utils/format'
import { showToast } from 'vant'

const tab = ref<'pending' | 'approved' | 'rejected'>('pending')
const list = ref<CaseSummary[]>([])

const load = async () => { list.value = await auditList(tab.value) }
onMounted(load)

const onApprove = async (id: string) => { await approve([id]); showToast({ type: 'success', message: '已通过' }); load() }
const onReject = async (id: string) => { await reject([id]); showToast({ type: 'success', message: '已驳回' }); load() }
</script>

<template>
  <div class="p-3 space-y-3">
    <div class="flex gap-2">
      <button v-for="t in [{k:'pending',l:'待审'},{k:'approved',l:'已通过'},{k:'rejected',l:'已驳回'}]"
              :key="t.k" @click="tab = t.k as any; load()"
              class="flex-1 h-9 rounded-btn text-sm"
              :class="tab === t.k ? 'bg-accent text-white' : 'bg-card border border-border text-text-2'">
        {{ t.l }}
      </button>
    </div>

    <div class="text-xs text-text-2 px-1">提示: 卡片左滑驳回,右滑通过</div>

    <SwipeableCard v-for="c in list" :key="c.id"
                   left-label="✓ 通过" right-label="✕ 驳回"
                   @swipeLeft="onReject(c.id)" @swipeRight="onApprove(c.id)">
      <div class="p-3">
        <div class="font-semibold text-sm leading-snug">{{ c.title }}</div>
        <div class="text-xs text-text-2 mt-1.5 flex items-center gap-2 flex-wrap">
          <span>{{ c.submitter }}</span>
          <span class="mono">{{ c.device }}</span>
          <span>{{ formatTime(c.submittedAt) }}</span>
        </div>
        <div class="mt-2 text-xs"
             :class="c.aiPreview?.includes('✓') ? 'text-success' : 'text-warning'">
          AI 预审: {{ c.aiPreview }}
        </div>
      </div>
    </SwipeableCard>

    <div v-if="!list.length" class="py-12 text-center text-text-2 text-sm">暂无{{ tab === 'pending' ? '待审' : '记录' }}</div>
  </div>
</template>

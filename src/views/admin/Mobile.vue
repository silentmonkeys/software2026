<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { listUsers } from '@/api/admin'
import { Lock, Users } from 'lucide-vue-next'
import { ROLE_LABEL } from '@/utils/permission'

const users = ref<any[]>([])
onMounted(async () => { users.value = await listUsers() })
</script>

<template>
  <div class="p-3 space-y-3">
    <div class="industrial-card p-4 border-l-4 border-l-warning bg-warning/5 flex items-start gap-3">
      <Lock class="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
      <div>
        <div class="font-semibold text-text">移动端只读模式</div>
        <div class="text-xs text-text-2 mt-1">出于安全考虑,管理操作请前往 PC 端;此处仅展示用户列表与统计概览。</div>
      </div>
    </div>

    <div class="industrial-card overflow-hidden">
      <div class="px-4 h-11 flex items-center gap-2 border-b border-border font-semibold text-sm">
        <Users class="w-4 h-4 text-accent" /> 用户列表(只读)
      </div>
      <ul class="divide-y divide-border">
        <li v-for="u in users.slice(0, 10)" :key="u.id" class="px-4 py-3 flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-bg flex items-center justify-center text-sm font-semibold">{{ u.name.slice(0, 1) }}</div>
          <div class="flex-1 min-w-0">
            <div class="font-medium text-sm truncate">{{ u.name }}</div>
            <div class="text-xs text-text-2 truncate">{{ ROLE_LABEL[u.role as keyof typeof ROLE_LABEL] || u.role }} · {{ u.workshop }}</div>
          </div>
          <span class="text-xs px-2 py-0.5 rounded"
                :class="u.status === 'active' ? 'bg-success/10 text-success' : 'bg-text-2/10 text-text-2'">
            {{ u.status === 'active' ? '在岗' : '停用' }}
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>

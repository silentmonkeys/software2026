<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { listUsers, listDevices, listSops } from '@/api/admin'
import { Users, Cog, Box, ListChecks, Activity, FileBarChart, Plus } from 'lucide-vue-next'
import { ROLE_LABEL } from '@/utils/permission'
import { formatTime } from '@/utils/format'

const route = useRoute()
const router = useRouter()

const tabs = [
  { k: 'user',   l: '用户管理',     icon: Users },
  { k: 'role',   l: '角色权限',     icon: Cog },
  { k: 'device', l: '设备型号库',   icon: Box },
  { k: 'sop',    l: '流程模板',     icon: ListChecks },
  { k: 'health', l: '知识库健康度', icon: Activity },
  { k: 'log',    l: '系统日志',     icon: FileBarChart }
]
const tab = computed(() => (route.params.sub as string) || 'user')
const goTab = (k: string) => router.push(`/admin/${k}`)

const users = ref<any[]>([])
const devices = ref<any[]>([])
const sops = ref<any[]>([])
onMounted(async () => {
  users.value = await listUsers()
  devices.value = await listDevices()
  sops.value = await listSops()
})
</script>

<template>
  <div class="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
    <header class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-bold flex items-center gap-2"><Cog class="w-5 h-5 text-accent" /> 系统管理</h1>
      <button class="h-9 px-3 rounded-btn bg-accent text-white text-sm flex items-center gap-1.5"><Plus class="w-4 h-4" /> 新增</button>
    </header>

    <div class="industrial-card flex-1 flex overflow-hidden">
      <!-- 子菜单 -->
      <aside class="w-52 border-r border-border bg-bg p-2 space-y-0.5 flex-shrink-0">
        <button v-for="t in tabs" :key="t.k" @click="goTab(t.k)"
                :class="['w-full h-10 px-3 rounded-btn text-sm flex items-center gap-2 transition',
                         tab === t.k ? 'bg-accent text-white font-semibold' : 'hover:bg-card text-text']">
          <component :is="t.icon" class="w-4 h-4" />{{ t.l }}
        </button>
      </aside>

      <!-- 内容 -->
      <main class="flex-1 overflow-auto p-5">
        <table v-if="tab === 'user'" class="w-full text-sm">
          <thead class="text-text-2 text-xs">
            <tr><th class="p-2 text-left">姓名</th><th>工号</th><th>角色</th><th>车间</th><th>状态</th><th>创建</th></tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id" class="border-t border-border hover:bg-bg">
              <td class="p-2 font-medium">{{ u.name }}</td>
              <td class="p-2 mono text-center">{{ u.id }}</td>
              <td class="p-2 text-center">{{ ROLE_LABEL[u.role as keyof typeof ROLE_LABEL] || u.role }}</td>
              <td class="p-2 text-center">{{ u.workshop }}</td>
              <td class="p-2 text-center">
                <span class="px-2 py-0.5 rounded text-xs"
                      :class="u.status === 'active' ? 'bg-success/10 text-success' : 'bg-text-2/10 text-text-2'">
                  {{ u.status === 'active' ? '在岗' : '停用' }}
                </span>
              </td>
              <td class="p-2 text-xs text-text-2 text-center">{{ formatTime(u.createdAt) }}</td>
            </tr>
          </tbody>
        </table>

        <table v-if="tab === 'device'" class="w-full text-sm">
          <thead class="text-text-2 text-xs"><tr><th class="p-2 text-left">型号</th><th>厂商</th><th>类别</th><th>更新</th></tr></thead>
          <tbody>
            <tr v-for="d in devices" :key="d.id" class="border-t border-border hover:bg-bg">
              <td class="p-2 mono">{{ d.model }}</td>
              <td class="p-2 text-center">{{ d.vendor }}</td>
              <td class="p-2 text-center">{{ d.category }}</td>
              <td class="p-2 text-xs text-text-2 text-center">{{ formatTime(d.updatedAt) }}</td>
            </tr>
          </tbody>
        </table>

        <table v-if="tab === 'sop'" class="w-full text-sm">
          <thead class="text-text-2 text-xs"><tr><th class="p-2 text-left">名称</th><th>设备</th><th>等级</th><th>步骤</th><th>更新</th></tr></thead>
          <tbody>
            <tr v-for="s in sops" :key="s.id" class="border-t border-border hover:bg-bg">
              <td class="p-2 font-medium">{{ s.name }}</td>
              <td class="p-2 mono text-center">{{ s.deviceModel }}</td>
              <td class="p-2 text-center">L{{ s.level }}</td>
              <td class="p-2 text-center mono">{{ s.steps }}</td>
              <td class="p-2 text-xs text-text-2 text-center">{{ formatTime(s.updatedAt) }}</td>
            </tr>
          </tbody>
        </table>

        <div v-if="tab === 'role' || tab === 'health' || tab === 'log'"
             class="py-12 text-center text-text-2 text-sm">
          该子模块占位中,UI 与上方表格类似 — CRUD + 详情抽屉
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  listUsers, listDevices, listSops,
  updateUserRole, backendRoleToFrontend,
  type SysUser, type BackendRole, type DeviceModel, type SopTpl
} from '@/api/admin'
import {
  Users, Cog, Box, ListChecks, Activity, FileBarChart,
  Plus, Loader, AlertTriangle, RefreshCcw
} from 'lucide-vue-next'
import { ROLE_LABEL } from '@/utils/permission'
import { formatTime } from '@/utils/format'
import { useUserStore } from '@/stores/user'
import { showToast, showFailToast, showConfirmDialog } from 'vant'

const route = useRoute()
const router = useRouter()
const me = useUserStore()

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

/* ------- 用户管理（FIX4 第 4 项 · 真实数据 + 在线改角色） ------- */
const users = ref<SysUser[]>([])
const usersLoading = ref(false)
const usersError = ref<string | null>(null)
const filterRole = ref<'all' | BackendRole>('all')
const search = ref('')

const filteredUsers = computed(() => {
  let list = users.value
  if (filterRole.value !== 'all') list = list.filter(u => u.role === filterRole.value)
  const q = search.value.trim().toLowerCase()
  if (q) list = list.filter(u => u.username.toLowerCase().includes(q) || String(u.id).includes(q))
  return list
})

const refreshUsers = async () => {
  usersLoading.value = true
  usersError.value = null
  try {
    users.value = await listUsers()
    if (!users.value.length) usersError.value = null
  } catch (e: any) {
    users.value = []
    usersError.value = e?.message || '加载失败'
  } finally {
    usersLoading.value = false
  }
}

const ROLE_OPTIONS: { v: BackendRole; l: string }[] = [
  { v: 'worker',  l: '一线检修员' },
  { v: 'auditor', l: '知识审核员' },
  { v: 'admin',   l: '系统管理员' }
]

const onChangeRole = async (u: SysUser, ev: Event) => {
  const next = (ev.target as HTMLSelectElement).value as BackendRole
  if (next === u.role) return
  // 防止把唯一管理员降级
  if (u.role === 'admin' && next !== 'admin') {
    const adminCount = users.value.filter(x => x.role === 'admin').length
    if (adminCount <= 1) {
      showFailToast('系统至少需要保留一名管理员')
      ;(ev.target as HTMLSelectElement).value = u.role
      return
    }
  }
  try {
    await showConfirmDialog({
      title: '确认变更角色',
      message: `将 ${u.username} 的角色改为 ${ROLE_OPTIONS.find(o => o.v === next)?.l}？`
    })
  } catch {
    ;(ev.target as HTMLSelectElement).value = u.role
    return
  }
  try {
    await updateUserRole(u.id, next)
    u.role = next
    showToast({ type: 'success', message: '角色已更新' })
  } catch (e: any) {
    ;(ev.target as HTMLSelectElement).value = u.role
    showFailToast(e?.response?.data?.detail || e?.message || '更新失败')
  }
}

/* ------- 其它 Tab（设备 / SOP）保持原样占位 ------- */
const devices = ref<DeviceModel[]>([])
const sops = ref<SopTpl[]>([])
onMounted(async () => {
  refreshUsers()
  devices.value = await listDevices()
  sops.value = await listSops()
})
</script>

<template>
  <div class="p-6 max-w-[1600px] mx-auto h-full flex flex-col">
    <header class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-bold flex items-center gap-2"><Cog class="w-5 h-5 text-accent" /> 系统管理</h1>
      <button v-if="tab === 'user'" @click="refreshUsers"
              class="h-9 px-3 rounded-btn border border-border text-sm flex items-center gap-1.5 hover:bg-bg">
        <RefreshCcw class="w-4 h-4" /> 刷新
      </button>
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
        <!-- ====== 用户管理 ====== -->
        <section v-if="tab === 'user'" class="space-y-3">
          <!-- 过滤栏 -->
          <div class="flex items-center gap-2 flex-wrap">
            <input v-model="search" placeholder="按用户名 / ID 搜索…"
                   class="h-9 px-3 rounded-btn border border-border bg-bg outline-none text-sm w-64" />
            <select v-model="filterRole"
                    class="h-9 px-2 rounded-btn border border-border bg-bg text-sm">
              <option value="all">全部角色</option>
              <option v-for="r in ROLE_OPTIONS" :key="r.v" :value="r.v">{{ r.l }}</option>
            </select>
            <span class="text-xs text-text-2 ml-auto">
              共 <span class="mono text-accent">{{ filteredUsers.length }}</span> / {{ users.length }} 名用户
            </span>
          </div>

          <!-- 加载态 -->
          <div v-if="usersLoading" class="py-12 text-center text-text-2">
            <Loader class="w-6 h-6 mx-auto animate-spin text-accent" />
            <div class="mt-2 text-sm">加载用户列表…</div>
          </div>

          <!-- 错误态 -->
          <div v-else-if="usersError && !users.length"
               class="py-12 text-center text-warning">
            <AlertTriangle class="w-8 h-8 mx-auto" />
            <div class="mt-2 text-sm">{{ usersError }}</div>
            <div class="text-xs text-text-2 mt-1">需要后端 /api/admin/users 接口（仅 admin 可访问）</div>
          </div>

          <!-- 空态 -->
          <div v-else-if="!users.length" class="py-12 text-center text-text-2">
            <Users class="w-8 h-8 mx-auto opacity-40" />
            <div class="mt-2 text-sm">暂无用户</div>
          </div>

          <!-- 表格 -->
          <table v-else class="w-full text-sm">
            <thead class="text-text-2 text-xs">
              <tr>
                <th class="p-2 text-left">ID</th>
                <th class="p-2 text-left">用户名</th>
                <th class="p-2 text-left">前端角色</th>
                <th class="p-2 text-left">后端角色（可改）</th>
                <th class="p-2 text-left">注册时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in filteredUsers" :key="u.id" class="border-t border-border hover:bg-bg">
                <td class="p-2 mono">{{ u.id }}</td>
                <td class="p-2 font-medium">
                  {{ u.username }}
                  <span v-if="me.info && String(u.id) === String(me.info.id).replace(/^u-/, '') || u.username === me.info?.name"
                        class="ml-1 text-[10px] px-1 py-0.5 rounded bg-accent/10 text-accent">本人</span>
                </td>
                <td class="p-2">{{ ROLE_LABEL[backendRoleToFrontend(u.role)] }}</td>
                <td class="p-2">
                  <select :value="u.role" @change="onChangeRole(u, $event)"
                          class="h-8 px-2 rounded-btn border border-border bg-bg text-sm">
                    <option v-for="r in ROLE_OPTIONS" :key="r.v" :value="r.v">{{ r.l }}（{{ r.v }}）</option>
                    <option v-if="u.role === 'leader'" value="leader">兼容：leader</option>
                  </select>
                </td>
                <td class="p-2 text-xs text-text-2">{{ u.createdAt ? formatTime(u.createdAt) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- ====== 设备 / SOP / 占位（保持原样） ====== -->
        <table v-else-if="tab === 'device'" class="w-full text-sm">
          <thead class="text-text-2 text-xs"><tr><th class="p-2 text-left">型号</th><th>厂商</th><th>类别</th><th>更新</th></tr></thead>
          <tbody>
            <tr v-for="d in devices" :key="d.id" class="border-t border-border hover:bg-bg">
              <td class="p-2 mono">{{ d.model }}</td>
              <td class="p-2 text-center">{{ d.vendor }}</td>
              <td class="p-2 text-center">{{ d.category }}</td>
              <td class="p-2 text-xs text-text-2 text-center">{{ formatTime(d.updatedAt) }}</td>
            </tr>
            <tr v-if="!devices.length"><td colspan="4" class="p-8 text-center text-text-2 text-xs">暂无设备型号</td></tr>
          </tbody>
        </table>

        <table v-else-if="tab === 'sop'" class="w-full text-sm">
          <thead class="text-text-2 text-xs"><tr><th class="p-2 text-left">名称</th><th>设备</th><th>等级</th><th>步骤</th><th>更新</th></tr></thead>
          <tbody>
            <tr v-for="s in sops" :key="s.id" class="border-t border-border hover:bg-bg">
              <td class="p-2 font-medium">{{ s.name }}</td>
              <td class="p-2 mono text-center">{{ s.deviceModel }}</td>
              <td class="p-2 text-center">L{{ s.level }}</td>
              <td class="p-2 text-center mono">{{ s.steps }}</td>
              <td class="p-2 text-xs text-text-2 text-center">{{ formatTime(s.updatedAt) }}</td>
            </tr>
            <tr v-if="!sops.length"><td colspan="5" class="p-8 text-center text-text-2 text-xs">暂无 SOP 模板</td></tr>
          </tbody>
        </table>

        <div v-else class="py-12 text-center text-text-2 text-sm">
          该子模块占位中，UI 与上方表格类似 — CRUD + 详情抽屉
        </div>
      </main>
    </div>
  </div>
</template>

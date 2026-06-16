<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { ROLE_LABEL } from '@/utils/permission'
import { useDevice } from '@/composables/useDevice'
import { Award, FileText, Sparkles, ShieldCheck, Bell, Edit, Lock } from 'lucide-vue-next'

const user = useUserStore()
const { isPC } = useDevice()
const tab = ref<'basic' | 'security' | 'notif' | 'contrib'>('basic')

const tabs = [
  { k: 'basic',    l: '基本信息', icon: Edit },
  { k: 'security', l: '安全设置', icon: Lock },
  { k: 'notif',    l: '通知偏好', icon: Bell },
  { k: 'contrib',  l: '我的贡献', icon: Award }
]
</script>

<template>
  <div :class="isPC ? 'p-6 max-w-6xl mx-auto grid grid-cols-12 gap-4' : 'p-3 space-y-3'">
    <!-- 头像卡 -->
    <aside :class="isPC ? 'col-span-3 industrial-card p-5' : 'industrial-card p-4'">
      <div :class="isPC ? 'text-center' : 'flex items-center gap-3'">
        <div class="w-20 h-20 rounded-full bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center text-white text-3xl font-bold flex-shrink-0"
             :class="isPC ? 'mx-auto' : ''">
          {{ (user.info?.name || '游').slice(0, 1) }}
        </div>
        <div :class="isPC ? 'mt-3' : 'flex-1 min-w-0'">
          <div class="text-lg font-bold">{{ user.info?.name || '访客' }}</div>
          <div class="text-xs text-text-2 mt-0.5">{{ ROLE_LABEL[user.role] }}</div>
          <div class="text-xs text-text-2 mt-0.5 truncate">{{ user.info?.workshop }}</div>
          <div class="mt-2 flex flex-wrap gap-1">
            <span class="px-2 py-0.5 rounded text-[11px] bg-accent/10 text-accent">铜牌检修员</span>
            <span class="px-2 py-0.5 rounded text-[11px] bg-success/10 text-success">在岗</span>
          </div>
        </div>
      </div>

      <!-- 移动端三宫格贡献 -->
      <div v-if="!isPC" class="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-border text-center">
        <div><div class="font-bold text-base text-accent mono">12</div><div class="text-[11px] text-text-2">提交</div></div>
        <div><div class="font-bold text-base text-success mono">8</div><div class="text-[11px] text-text-2">采纳</div></div>
        <div><div class="font-bold text-base text-ai mono">240</div><div class="text-[11px] text-text-2">积分</div></div>
      </div>
    </aside>

    <!-- 主内容 -->
    <main :class="isPC ? 'col-span-9 industrial-card p-5' : 'industrial-card p-3'">
      <div :class="isPC ? 'flex border-b border-border -mx-5 px-5 mb-4' : 'flex gap-1 mb-3'">
        <button v-for="t in tabs" :key="t.k" @click="tab = t.k as any"
                :class="[isPC ? 'h-10 px-4 text-sm border-b-2 -mb-px' : 'flex-1 h-9 rounded-btn text-xs',
                         tab === t.k
                           ? (isPC ? 'border-accent text-accent font-semibold' : 'bg-accent text-white font-semibold')
                           : (isPC ? 'border-transparent text-text-2' : 'bg-card border border-border text-text-2')]">
          <component :is="t.icon" class="w-4 h-4 inline mr-1" />{{ t.l }}
        </button>
      </div>

      <div v-if="tab === 'basic'" class="space-y-3 text-sm">
        <div class="grid grid-cols-2 gap-3">
          <div><div class="text-text-2 text-xs mb-1">姓名</div><div class="font-medium">{{ user.info?.name }}</div></div>
          <div><div class="text-text-2 text-xs mb-1">工号</div><div class="font-medium mono">{{ user.info?.id }}</div></div>
          <div><div class="text-text-2 text-xs mb-1">所属车间</div><div>{{ user.info?.workshop }}</div></div>
          <div><div class="text-text-2 text-xs mb-1">角色</div><div>{{ ROLE_LABEL[user.role] }}</div></div>
        </div>
      </div>

      <div v-if="tab === 'security'" class="space-y-2 text-sm">
        <button class="w-full h-12 px-3 rounded-btn border border-border flex items-center justify-between hover:bg-bg">修改密码 <span class="text-text-2 text-xs">→</span></button>
        <button class="w-full h-12 px-3 rounded-btn border border-border flex items-center justify-between hover:bg-bg">绑定手机 <span class="text-text-2 text-xs">已绑定 138****8888</span></button>
        <button class="w-full h-12 px-3 rounded-btn border border-border flex items-center justify-between hover:bg-bg">登录设备管理 <span class="text-text-2 text-xs">→</span></button>
      </div>

      <div v-if="tab === 'notif'" class="space-y-2 text-sm">
        <label v-for="n in ['案例审核结果', '待办流程提醒', '系统公告', '夜间静默']" :key="n"
               class="flex items-center justify-between h-12 px-3 rounded-btn border border-border">
          <span>{{ n }}</span>
          <input type="checkbox" checked class="w-5 h-5 accent-accent" />
        </label>
      </div>

      <div v-if="tab === 'contrib'" class="space-y-3">
        <div v-if="isPC" class="grid grid-cols-3 gap-3">
          <div class="industrial-card p-4 text-center">
            <FileText class="w-6 h-6 mx-auto text-accent mb-1" />
            <div class="text-2xl font-bold mono">12</div><div class="text-xs text-text-2">提交案例</div>
          </div>
          <div class="industrial-card p-4 text-center">
            <ShieldCheck class="w-6 h-6 mx-auto text-success mb-1" />
            <div class="text-2xl font-bold mono">8</div><div class="text-xs text-text-2">被采纳</div>
          </div>
          <div class="industrial-card p-4 text-center">
            <Sparkles class="w-6 h-6 mx-auto text-ai mb-1" />
            <div class="text-2xl font-bold mono">240</div><div class="text-xs text-text-2">积分</div>
          </div>
        </div>
        <div class="industrial-card p-4 text-sm">
          <div class="font-semibold mb-2">最近提交</div>
          <ul class="divide-y divide-border">
            <li v-for="i in 3" :key="i" class="py-2 flex items-center gap-2">
              <FileText class="w-4 h-4 text-text-2" />
              <span class="flex-1 truncate">液压站压力波动排查 #{{ 1000 + i }}</span>
              <span class="text-xs text-success">已采纳</span>
            </li>
          </ul>
        </div>
      </div>
    </main>
  </div>
</template>

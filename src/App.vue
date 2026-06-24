<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useDevice } from '@/composables/useDevice'
import PCLayout from '@/layouts/PCLayout.vue'
import MobileLayout from '@/layouts/MobileLayout.vue'

const route = useRoute()
const { isPC } = useDevice()

const layout = computed(() => route.meta?.layout || 'blank')
</script>

<template>
  <template v-if="layout === 'blank'">
    <router-view />
  </template>
  <template v-else>
    <PCLayout v-if="isPC">
      <!--
        KeepAlive：缓存主业务列表页，切走再切回时输入/滚动/ECharts 实例都还在，
        彻底解决"输完字切到别的菜单再回来，文字没了"的问题。
        路由 meta.noKeep=true 的页面（详情类）通过 key=fullPath 强制重建。
      -->
      <router-view v-slot="{ Component, route: r }">
        <keep-alive :max="10">
          <component
            :is="Component"
            :key="r.meta?.noKeep ? r.fullPath : r.path.split('/').slice(0, 3).join('/')" />
        </keep-alive>
      </router-view>
    </PCLayout>
    <MobileLayout v-else>
      <router-view v-slot="{ Component, route: r }">
        <keep-alive :max="10">
          <component
            :is="Component"
            :key="r.meta?.noKeep ? r.fullPath : r.path.split('/').slice(0, 3).join('/')" />
        </keep-alive>
      </router-view>
    </MobileLayout>
  </template>
</template>

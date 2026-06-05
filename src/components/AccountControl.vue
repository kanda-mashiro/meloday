<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useSync } from '../composables/useSync'

const { user, signOut } = useAuth()
const { status } = useSync()

const menuOpen = ref(false)

const initial = computed(() => (user.value?.email?.[0] ?? '?').toUpperCase())

const statusLabel = computed(() => {
  switch (status.value) {
    case 'syncing':
      return '同步中…'
    case 'idle':
      return '已同步'
    case 'error':
      return '同步出错'
    default:
      return '未连接'
  }
})

async function onSignOut(): Promise<void> {
  menuOpen.value = false
  await signOut()
}
</script>

<template>
  <div class="acct">
    <button class="acct__avatar" type="button" :title="user?.email ?? ''" @click="menuOpen = !menuOpen">
      {{ initial }}
    </button>
    <template v-if="menuOpen">
      <div class="acct__scrim" @click="menuOpen = false" />
      <div class="acct__menu">
        <div class="acct__email">{{ user?.email }}</div>
        <div class="acct__status" :class="`-${status}`">{{ statusLabel }}</div>
        <button class="acct__signout" type="button" @click="onSignOut">退出登录</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.acct {
  position: relative;
  display: inline-flex;
}

.acct__avatar {
  width: 1.7rem;
  height: 1.7rem;
  border: none;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}

.acct__scrim {
  position: fixed;
  inset: 0;
  z-index: 45;
}

.acct__menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 46;
  width: 13rem;
  padding: 0.6rem;
  background: var(--panel-bg);
  border: 1px solid var(--main-border-light);
  border-radius: 10px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.28);
}

.acct__email {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--main-text);
  word-break: break-all;
}

.acct__status {
  margin-top: 0.2rem;
  font-size: 0.72rem;
  color: var(--aside-text);
}

.acct__status.-idle {
  color: var(--accent);
}

.acct__status.-error {
  color: var(--highlight-text);
}

.acct__signout {
  margin-top: 0.6rem;
  width: 100%;
  padding: 0.4rem;
  border: 1px solid var(--main-border-light);
  border-radius: 6px;
  background: transparent;
  color: var(--aside-text);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}

.acct__signout:hover {
  color: var(--highlight-text);
  border-color: var(--highlight-text);
}
</style>

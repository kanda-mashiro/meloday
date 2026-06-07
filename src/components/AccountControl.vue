<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useSync } from '../composables/useSync'
import { useTodoStore } from '../composables/useTodoStore'
import { useDarkMode } from '../composables/useDarkMode'
import { useHelp } from '../composables/useHelp'
import { supabase, ITEMS_TABLE } from '../lib/supabase'
import type { TodoData } from '../types/todo'

const { user, signOut } = useAuth()
const { status, lastSyncedAt } = useSync()
const store = useTodoStore()
const { isDark, toggle } = useDarkMode()
const { openHelp } = useHelp()

const emit = defineEmits<{ preferences: []; history: [] }>()

const menuOpen = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

// Cumulative completed count, fetched from Supabase on menu open. null = hide.
const completedCount = ref<number | null>(null)

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

// Relative time for the last successful sync: 刚刚 / N 分钟前 / HH:MM.
const lastSyncedLabel = computed(() => {
  const ts = lastSyncedAt.value
  if (!ts) return ''
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
})

async function fetchCompletedCount(): Promise<void> {
  completedCount.value = null
  const uid = user.value?.id
  if (!supabase || !uid) return
  try {
    const { count, error } = await supabase
      .from(ITEMS_TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('done', true)
      .is('deleted_at', null)
    if (error) return
    completedCount.value = count ?? null
  } catch {
    completedCount.value = null
  }
}

function toggleMenu(): void {
  menuOpen.value = !menuOpen.value
  if (menuOpen.value) void fetchCompletedCount()
}

function onHistory(): void {
  menuOpen.value = false
  emit('history')
}

function onPreferences(): void {
  menuOpen.value = false
  emit('preferences')
}

function onHelp(): void {
  menuOpen.value = false
  openHelp()
}

function onImportClick(): void {
  fileInput.value?.click()
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const data = JSON.parse(text) as TodoData
    store.importData(data)
    menuOpen.value = false
  } catch (err) {
    console.error('Failed to import todo data', err)
  } finally {
    input.value = ''
  }
}

function onExportClick(): void {
  store.exportData()
  menuOpen.value = false
}

async function onSignOut(): Promise<void> {
  menuOpen.value = false
  await signOut()
}
</script>

<template>
  <div class="acct">
    <button class="acct__avatar" type="button" :title="user?.email ?? ''" @click="toggleMenu">
      {{ initial }}
    </button>
    <input
      ref="fileInput"
      type="file"
      accept="application/json,.json"
      class="acct__file-input"
      @change="onFileChange"
    />
    <template v-if="menuOpen">
      <div class="acct__scrim" @click="menuOpen = false" />
      <div class="acct__menu">
        <!-- Identity -->
        <div class="acct__identity">
          <div class="acct__avatar acct__avatar--lg">{{ initial }}</div>
          <div class="acct__id-text">
            <div class="acct__email">{{ user?.email }}</div>
            <div class="acct__status" :class="`-${status}`">
              {{ statusLabel }}<span v-if="lastSyncedLabel" class="acct__synced"> · {{ lastSyncedLabel }}</span>
            </div>
          </div>
        </div>

        <div class="acct__divider" />

        <!-- App actions -->
        <button class="acct__row" type="button" @click="onHistory">
          <svg class="acct__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l3 2"/></svg>
          <span>归档历史</span>
        </button>
        <button class="acct__row" type="button" @click="onImportClick">
          <svg class="acct__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
          <span>导入</span>
        </button>
        <button class="acct__row" type="button" @click="onExportClick">
          <svg class="acct__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 8l5-5 5 5"/><path d="M12 3v12"/></svg>
          <span>导出</span>
        </button>

        <div class="acct__divider" />

        <!-- Settings -->
        <button class="acct__row" type="button" @click="onPreferences">
          <svg class="acct__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          <span>偏好设置</span>
        </button>
        <button class="acct__row" type="button" @click="toggle">
          <svg class="acct__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
          <span>深色模式</span>
          <span class="acct__toggle" :class="{ '-on': isDark }" aria-hidden="true"><span class="acct__knob" /></span>
        </button>
        <button class="acct__row" type="button" @click="onHelp">
          <svg class="acct__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7"/><path d="M12 17h.01"/></svg>
          <span>快捷键</span>
        </button>

        <template v-if="completedCount !== null">
          <div class="acct__divider" />
          <div class="acct__stat">累计完成 {{ completedCount }} 项</div>
        </template>

        <div class="acct__divider" />

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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.acct__avatar--lg {
  width: 2rem;
  height: 2rem;
  font-size: 0.92rem;
  cursor: default;
}

.acct__file-input {
  display: none;
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
  width: 14.5rem;
  padding: 0.5rem;
  background: var(--panel-bg);
  border: 1px solid var(--main-border-light);
  border-radius: 10px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.28);
}

.acct__identity {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.35rem 0.4rem 0.45rem;
}

.acct__id-text {
  min-width: 0;
}

.acct__email {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--main-text);
  word-break: break-all;
}

.acct__status {
  margin-top: 0.15rem;
  font-size: 0.72rem;
  color: var(--aside-text);
}

.acct__status.-idle {
  color: var(--accent);
}

.acct__status.-error {
  color: var(--highlight-text);
}

.acct__synced {
  color: var(--aside-text);
}

.acct__divider {
  height: 1px;
  margin: 0.35rem 0;
  background: var(--divider);
}

.acct__row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  padding: 0.4rem 0.45rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--main-text);
  font: inherit;
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.acct__row:hover {
  background: var(--accent-soft);
  color: var(--highlight-text);
}

.acct__ico {
  width: 0.95rem;
  height: 0.95rem;
  flex: none;
}

.acct__toggle {
  margin-left: auto;
  width: 1.7rem;
  height: 0.95rem;
  border-radius: 999px;
  background: var(--main-border-light);
  position: relative;
  transition: background-color 0.12s ease;
  flex: none;
}

.acct__toggle.-on {
  background: var(--accent);
}

.acct__knob {
  position: absolute;
  top: 0.1rem;
  left: 0.1rem;
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.12s ease;
}

.acct__toggle.-on .acct__knob {
  transform: translateX(0.75rem);
}

.acct__stat {
  padding: 0.2rem 0.45rem;
  font-size: 0.72rem;
  color: var(--aside-text);
}

.acct__signout {
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

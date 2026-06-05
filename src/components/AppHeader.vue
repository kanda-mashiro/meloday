<script setup lang="ts">
import { ref } from 'vue'
import { useTodoStore } from '../composables/useTodoStore'
import { useDarkMode } from '../composables/useDarkMode'
import AccountControl from './AccountControl.vue'
import type { TodoData } from '../types/todo'

const store = useTodoStore()
const { isDark, toggle } = useDarkMode()

const emit = defineEmits<{ preferences: []; history: [] }>()

const fileInput = ref<HTMLInputElement | null>(null)

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
  } catch (err) {
    console.error('Failed to import todo data', err)
  } finally {
    input.value = ''
  }
}

function onExportClick(): void {
  store.exportData()
}
</script>

<template>
  <header class="app-header">
    <div class="app-header__side app-header__side--left">
      <button
        type="button"
        class="app-header__btn"
        title="Preferences"
        aria-label="Preferences"
        @click="emit('preferences')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1.15em;height:1.15em;display:block"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </button>
    </div>

    <h1 class="app-title">MY&nbsp;TODO</h1>

    <nav class="app-header__side app-header__side--right">
      <button
        type="button"
        class="app-header__btn"
        :title="isDark ? 'Switch to light' : 'Switch to dark'"
        :aria-pressed="isDark"
        @click="toggle"
      >
        <template v-if="isDark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1.05em;height:1.05em;display:block"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/></svg></template><template v-else><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1.05em;height:1.05em;display:block"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></template>
      </button>
      <button type="button" class="app-header__btn" title="View archived (history)" @click="emit('history')">
        History
      </button>
      <button type="button" class="app-header__btn" title="Import data" @click="onImportClick">
        Import
      </button>
      <button type="button" class="app-header__btn" title="Export data" @click="onExportClick">
        Export
      </button>
      <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        class="file-input"
        @change="onFileChange"
      />
      <AccountControl />
    </nav>
  </header>
</template>

<style scoped>
.app-header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid var(--divider);
  background: var(--main-bg);
}

.app-title {
  margin: 0;
  text-align: center;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.28em;
  text-indent: 0.28em;
  text-transform: uppercase;
  color: var(--accent);
}

.app-header__side {
  display: flex;
  align-items: center;
  gap: 0.15rem;
}

.app-header__side--right {
  justify-content: flex-end;
}

.app-header__btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--button-text);
  padding: 0.35rem 0.7rem;
  font: inherit;
  font-size: 0.82rem;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.app-header__btn:hover {
  background: var(--button-active-bg);
  color: var(--button-active-text);
}

.file-input {
  display: none;
}
</style>

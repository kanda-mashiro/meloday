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
        ⚙
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
        {{ isDark ? '☀' : '☾' }}
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

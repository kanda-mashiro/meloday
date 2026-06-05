<script setup lang="ts">
import { usePreferences } from '../composables/usePreferences'
import { useDarkMode } from '../composables/useDarkMode'
import { useTodoStore } from '../composables/useTodoStore'
import { useQuickCapture } from '../composables/useQuickCapture'

const { prefs, columnOptions } = usePreferences()
const { isDark, toggle } = useDarkMode()
const store = useTodoStore()
const { openCapture } = useQuickCapture()
</script>

<template>
  <footer class="bottom-bar">
    <div class="bottom-bar__side">
      <button
        class="bottom-bar__capture"
        type="button"
        title="Quick capture to Inbox (⌘/Ctrl + K)"
        @click="openCapture()"
      >
        <span class="bottom-bar__capture-plus">✎</span>
        <span class="bottom-bar__capture-label">Capture</span>
      </button>
    </div>

    <div class="bottom-bar__center">
      <div class="bottom-bar__seg" role="group" aria-label="Columns">
        <button
          v-for="n in columnOptions"
          :key="n"
          class="bottom-bar__seg-btn"
          :class="{ '-active': prefs.columns === n }"
          type="button"
          @click="prefs.columns = n"
        >
          {{ n }}
        </button>
      </div>
      <button
        class="bottom-bar__icon"
        type="button"
        :title="isDark ? 'Switch to light' : 'Switch to dark'"
        @click="toggle"
      >
        {{ isDark ? '☀' : '☾' }}
      </button>
    </div>

    <div class="bottom-bar__side bottom-bar__side--right">
      <button class="bottom-bar__today" type="button" @click="store.seekToToday()">
        Today
      </button>
    </div>
  </footer>
</template>

<style scoped>
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1rem;
  height: var(--bottom-bar-h, 46px);
  padding: 0 1rem;
  background: var(--main-bg);
  border-top: 1px solid var(--divider);
}

.bottom-bar__side {
  display: flex;
  align-items: center;
}

.bottom-bar__side--right {
  justify-content: flex-end;
}

.bottom-bar__capture {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--main-border-light);
  border-radius: 6px;
  background: transparent;
  color: var(--button-text);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.bottom-bar__capture:hover {
  background: var(--accent-soft);
  color: var(--highlight-text);
}

.bottom-bar__capture-plus {
  font-size: 0.9rem;
}

.bottom-bar__center {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.bottom-bar__seg {
  display: inline-flex;
  border: 1px solid var(--main-border-light);
  border-radius: 7px;
  overflow: hidden;
}

.bottom-bar__seg-btn {
  min-width: 2rem;
  padding: 0.25rem 0.55rem;
  border: none;
  border-left: 1px solid var(--main-border-light);
  background: transparent;
  color: var(--aside-text);
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.bottom-bar__seg-btn:first-child {
  border-left: none;
}

.bottom-bar__seg-btn:hover {
  color: var(--main-text);
}

.bottom-bar__seg-btn.-active {
  background: var(--accent);
  color: #fff;
}

.bottom-bar__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 1.8rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--button-text);
  font-size: 0.95rem;
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.bottom-bar__icon:hover {
  background: var(--button-active-bg);
}

.bottom-bar__today {
  padding: 0.3rem 0.8rem;
  border: 1px solid var(--main-border-light);
  border-radius: 6px;
  background: transparent;
  color: var(--button-text);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.bottom-bar__today:hover {
  background: var(--button-active-bg);
  color: var(--button-active-text);
}
</style>

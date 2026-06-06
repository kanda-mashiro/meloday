<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import { usePreferences } from '../composables/usePreferences'
import { useDarkMode } from '../composables/useDarkMode'
import { useHelp } from '../composables/useHelp'
import { useDayTimer } from '../composables/useDayTimer'
import DayTimer from './DayTimer.vue'

const { prefs, columnOptions } = usePreferences()
const { isDark, toggle } = useDarkMode()
const { openHelp } = useHelp()
const { running, mmss } = useDayTimer()

// Pop-up panel anchored above the bottom-bar trigger.
const focusWrap = ref<HTMLElement | null>(null)
const focusOpen = ref(false)

function onDocClick(e: MouseEvent): void {
  if (focusWrap.value && !focusWrap.value.contains(e.target as Node)) closeFocus()
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeFocus()
}

function openFocus(): void {
  if (focusOpen.value) return
  focusOpen.value = true
  // Defer so the click that opened the panel doesn't immediately close it.
  window.setTimeout(() => {
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKeydown)
  }, 0)
}

function closeFocus(): void {
  if (!focusOpen.value) return
  focusOpen.value = false
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
}

function toggleFocus(): void {
  if (focusOpen.value) closeFocus()
  else openFocus()
}

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <footer class="bottom-bar">
    <div class="bottom-bar__side">
      <div ref="focusWrap" class="focus-pop">
        <button
          class="bottom-bar__focus"
          :class="{ '-running': running, '-open': focusOpen }"
          type="button"
          :title="running ? '专注计时 · 进行中' : '专注计时'"
          aria-label="专注计时"
          :aria-expanded="focusOpen"
          @click="toggleFocus"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1.05em;height:1.05em;display:block"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M9 2h6"/></svg>
          <span v-if="running" class="bottom-bar__focus-time">{{ mmss }}</span>
          <span v-else>专注</span>
        </button>
        <div v-if="focusOpen" class="focus-pop__panel">
          <DayTimer />
        </div>
      </div>
    </div>

    <div class="bottom-bar__center">
      <div class="bottom-bar__seg" role="group" aria-label="Columns">
        <button
          v-for="n in columnOptions"
          :key="n"
          class="bottom-bar__seg-btn"
          :class="{ '-active': prefs.columns === n }"
          type="button"
          :title="`${n} 天`"
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
        <template v-if="isDark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1.05em;height:1.05em;display:block"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/></svg></template><template v-else><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1.05em;height:1.05em;display:block"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></template>
      </button>
    </div>

    <div class="bottom-bar__side bottom-bar__side--right">
      <button
        class="bottom-bar__help"
        type="button"
        title="快捷键帮助 · ?"
        aria-label="快捷键帮助"
        @click="openHelp()"
      >
        ?
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

.bottom-bar__center {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

/* Global focus-timer trigger + its pop-up panel, anchored in the left slot. */
.focus-pop {
  position: relative;
}

.bottom-bar__focus {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  min-width: 3.4rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--main-border-light);
  border-radius: 999px;
  background: transparent;
  color: var(--aside-text);
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.bottom-bar__focus:hover {
  color: var(--main-text);
}

.bottom-bar__focus.-open {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--highlight-text);
}

/* Running state: accent fill + live countdown so it's glanceable anywhere. */
.bottom-bar__focus.-running {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.bottom-bar__focus.-running:hover {
  color: #fff;
}

.bottom-bar__focus-time {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.focus-pop__panel {
  position: absolute;
  left: 0;
  bottom: 100%;
  margin-bottom: 0.5rem;
  background: var(--panel-bg);
  border: 1px solid var(--main-border-light);
  border-radius: 12px;
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.18);
  padding: 0.3rem;
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

.bottom-bar__help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.8rem;
  height: 1.8rem;
  border: 1px solid var(--main-border-light);
  border-radius: 50%;
  background: transparent;
  color: var(--button-text);
  font: inherit;
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.bottom-bar__help:hover {
  background: var(--button-active-bg);
  color: var(--button-active-text);
}
</style>

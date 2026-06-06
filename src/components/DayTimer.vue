<script setup lang="ts">
import { useDayTimer } from '../composables/useDayTimer'
import AmbientControls from './AmbientControls.vue'

// The panel UI for the standalone day pomodoro. All timer state lives in the
// useDayTimer module singleton so this panel and the bottom-bar trigger share
// one clock.
const { presets, presetMin, running, ready, finished, mmss, setPreset, start, pause, reset } =
  useDayTimer()
</script>

<template>
  <section class="timer">
    <header class="timer__head">
      <span class="timer__title">专注计时</span>
    </header>

    <div class="timer__presets" role="group" aria-label="时长">
      <button
        v-for="p in presets"
        :key="p"
        class="timer__preset"
        :class="{ '-on': presetMin === p }"
        type="button"
        @click="setPreset(p)"
      >
        {{ p }}<span class="timer__preset-unit">分</span>
      </button>
    </div>

    <div class="timer__clock" :class="{ '-done': finished }">{{ mmss }}</div>

    <div class="timer__controls">
      <button
        v-if="!running"
        class="timer__btn -primary"
        type="button"
        :title="ready ? '开始' : '继续'"
        @click="start"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="width:1em;height:1em;display:block"><path d="M7 5l13 7-13 7z"/></svg>
        {{ ready ? '开始' : '继续' }}
      </button>
      <button v-else class="timer__btn" type="button" title="暂停" @click="pause">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="width:1em;height:1em;display:block"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
        暂停
      </button>
      <button v-if="!ready" class="timer__btn" type="button" title="重置" @click="reset">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1em;height:1em;display:block"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
        重置
      </button>
    </div>

    <AmbientControls class="timer__amb" />
  </section>
</template>

<style scoped>
.timer {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.8rem 1rem 0.9rem;
}

.timer__head {
  align-self: stretch;
}

.timer__title {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--aside-text);
}

.timer__presets {
  display: inline-flex;
  gap: 0.4rem;
}

.timer__preset {
  min-width: 2.9rem;
  padding: 0.3rem 0.55rem;
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

.timer__preset:hover {
  color: var(--main-text);
}

.timer__preset.-on {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--highlight-text);
}

.timer__preset-unit {
  margin-left: 0.1em;
  font-size: 0.7em;
  opacity: 0.7;
}

.timer__clock {
  font-size: 2rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--main-text);
}

.timer__clock.-done {
  color: var(--highlight-text);
}

.timer__controls {
  display: inline-flex;
  gap: 0.5rem;
}

.timer__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
  padding: 0.45rem 0.95rem;
  border: 1px solid var(--main-border-light);
  border-radius: 8px;
  background: transparent;
  color: var(--button-text);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.timer__btn:hover:not(:disabled) {
  background: var(--button-active-bg);
  color: var(--button-active-text);
}

.timer__btn.-primary {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

.timer__btn.-primary:hover {
  background: var(--amber-strong);
  color: #fff;
}

.timer__amb {
  margin-top: 0.1rem;
  padding-top: 0.7rem;
  border-top: 1px solid var(--divider);
}

/* Tighten the embedded ambient picker so the timer block stays compact in the
   pane (the full-screen FocusSession keeps the roomier default). */
.timer__amb :deep(.amb) {
  gap: 0.55rem;
}

.timer__amb :deep(.amb__scenes) {
  gap: 0.3rem;
}

.timer__amb :deep(.amb__scene) {
  padding: 0.28rem 0.4rem;
}
</style>

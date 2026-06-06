<script setup lang="ts">
import { computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useFocusSession } from '../composables/useFocusSession'
import { useNotes } from '../composables/useNotes'
import { useAmbientSound } from '../composables/useAmbientSound'
import { parseLabelRich, type RichSegment } from '../lib/time'
import { tagHue } from '../lib/tags'

const {
  target,
  presetMin,
  mmss,
  running,
  finished,
  ready,
  presets,
  setPreset,
  pause,
  resume,
  exit,
  complete,
} = useFocusSession()
const notes = useNotes()
const {
  playing: soundPlaying,
  scene: soundScene,
  scenes,
  volume: soundVolume,
  toggle: toggleSound,
  setScene,
  setVolume: setSoundVolume,
  stop: stopSound,
} = useAmbientSound()

function onVolume(e: Event): void {
  setSoundVolume(parseFloat((e.target as HTMLInputElement).value))
}

// Silence the ambient sound when the session closes.
watch(target, (t) => {
  if (!t) stopSound()
})

const segments = computed<RichSegment[]>(() =>
  target.value ? parseLabelRich(target.value.label).segments : [],
)

const phaseLabel = computed(() => {
  if (finished.value) return '专注结束'
  if (ready.value) return '准备专注'
  return running.value ? '正在专注' : '已暂停'
})

function openNote(): void {
  if (target.value) notes.open({ id: target.value.id, label: target.value.label })
}

// Esc leaves the session — unless a note drawer is open over it (let that close first).
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && target.value && !notes.activeItem.value) {
    e.preventDefault()
    // Don't let the focus-view's own Esc handler also fire (it would exit focus).
    e.stopImmediatePropagation()
    exit()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div v-if="target" class="fs" role="dialog" aria-modal="true" aria-label="专注">
    <!-- Backdrop is non-dismissing on purpose: a focus session is deliberate, so
         leaving is via Esc or the explicit 退出 button, not a stray blank click. -->
    <div class="fs__scrim" />

    <div class="fs__panel">
      <p class="fs__eyebrow">{{ phaseLabel }}</p>

      <h2 class="fs__task"><template v-for="(seg, i) in segments" :key="i"><span
            v-if="seg.kind === 'tag'"
            class="tag-chip"
            :style="{ '--tag-h': tagHue(seg.tag ?? '') }"
          >{{ seg.text }}</span><span
            v-else-if="seg.kind === 'time'"
            class="time-chip"
            :class="{ '-cross': seg.time?.crossMidnight }"
          >{{ seg.text }}</span><span v-else>{{ seg.text }}</span></template></h2>

      <div class="fs__clock" :class="{ '-done': finished }">
        {{ finished ? '时间到' : mmss }}
      </div>

      <!-- Duration presets: only in the ready (pre-start) state. Once the run
           begins they're hidden — you commit to a length up front. -->
      <div v-if="ready" class="fs__presets">
        <button
          v-for="p in presets"
          :key="p"
          class="fs__preset"
          :class="{ '-on': presetMin === p }"
          type="button"
          @click="setPreset(p)"
        >
          {{ p }}<span class="fs__preset-unit">分</span>
        </button>
      </div>

      <div class="fs__controls">
        <button v-if="ready" class="fs__btn -primary" type="button" @click="resume"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="width:1em;height:1em;display:block"><path d="M7 5l13 7-13 7z"/></svg>开始专注</button>
        <template v-else>
          <button v-if="running" class="fs__btn" type="button" @click="pause"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="width:1em;height:1em;display:block"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>暂停</button>
          <button v-else class="fs__btn" type="button" :disabled="finished" @click="resume"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="width:1em;height:1em;display:block"><path d="M7 5l13 7-13 7z"/></svg>继续</button>
          <button class="fs__btn -primary" type="button" @click="complete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1em;height:1em;display:block"><path d="M5 12.5l4.5 4.5L19 6.5"/></svg>完成</button>
        </template>
      </div>

      <!-- Secondary zone: deliberately quiet so the task + clock stay the focus.
           Sound controls, then a hairline, then the leave/notes links. -->
      <div class="fs__secondary">
        <div class="fs__sound">
          <button
            class="fs__sound-toggle"
            :class="{ '-on': soundPlaying }"
            type="button"
            aria-label="环境音"
            :aria-pressed="soundPlaying"
            @click="toggleSound"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1em;height:1em;display:block"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5.5a9 9 0 0 1 0 13"/></svg>
            环境音
          </button>

          <template v-if="soundPlaying">
            <div class="fs__scenes" role="group" aria-label="场景">
              <button
                v-for="s in scenes"
                :key="s.id"
                class="fs__scene"
                :class="{ '-on': soundScene === s.id }"
                type="button"
                :title="s.label"
                :aria-pressed="soundScene === s.id"
                @click="setScene(s.id)"
              >
                <span class="fs__scene-ic" aria-hidden="true">
                  <svg v-if="s.id === 'rain'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 14.5A4.5 4.5 0 0 1 7 5.6a5.5 5.5 0 0 1 10.3 1.2A3.6 3.6 0 0 1 17 14.5"/><path d="M8 17.5 7 20M12 17.5 11 20.5M16 17.5 15 20"/></svg>
                  <svg v-else-if="s.id === 'thunder'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 13A4.5 4.5 0 0 1 7 4.1a5.5 5.5 0 0 1 10.3 1.2A3.6 3.6 0 0 1 17 13"/><path d="M12 11l-2.5 4H12l-2 4.5"/></svg>
                  <svg v-else-if="s.id === 'ocean'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8.5c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 17.5c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>
                  <svg v-else-if="s.id === 'stream'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 3c-3 3.2 6 5 3 9.5s-6 5.3-3 9.5"/></svg>
                  <svg v-else-if="s.id === 'wind'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h9a2.4 2.4 0 1 0-2.4-2.4"/><path d="M3 12h13a2.6 2.6 0 1 1-2.6 2.6"/><path d="M3 16h7"/></svg>
                  <svg v-else-if="s.id === 'cafe'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h13v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3.5c-.6.8-.6 1.7 0 2.5M12 3.5c-.6.8-.6 1.7 0 2.5"/></svg>
                  <svg v-else-if="s.id === 'forest'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 7 10h3l-4 6h12l-4-6h3z"/><path d="M12 16v4.5"/></svg>
                  <svg v-else-if="s.id === 'birds'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11c1.3-1.9 2.7-1.9 4 0 1.3-1.9 2.7-1.9 4 0"/><path d="M14 7.5c1-1.4 2-1.4 3 0 1-1.4 2-1.4 3 0"/></svg>
                  <svg v-else-if="s.id === 'night'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13.5A8 8 0 1 1 10.5 4a6.2 6.2 0 0 0 9.5 9.5z"/></svg>
                  <svg v-else-if="s.id === 'fire'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c.5 3-2 4.2-2.8 6A4.8 4.8 0 0 0 12 18a4.8 4.8 0 0 0 4.5-6.5C15.3 13 14.5 12 14.8 9.5 15 7 13.5 4.5 12 3z"/></svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5.5a9 9 0 0 1 0 13"/></svg>
                </span>
                <span class="fs__scene-label">{{ s.label }}</span>
              </button>
            </div>
            <input
              class="fs__sound-vol"
              type="range"
              min="0"
              max="1"
              step="0.05"
              :value="soundVolume"
              aria-label="音量"
              @input="onVolume"
            />
          </template>
        </div>

        <div class="fs__foot">
          <button class="fs__link" type="button" @click="openNote">笔记</button>
          <span class="fs__foot-sep" aria-hidden="true">·</span>
          <button class="fs__link" type="button" @click="exit">退出 · Esc</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fs {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fs__scrim {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--main-bg) 78%, transparent);
  backdrop-filter: blur(3px);
}

.fs__panel {
  position: relative;
  width: min(540px, 92vw);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.1rem;
  padding: 2.5rem 2rem;
  text-align: center;
}

.fs__eyebrow {
  margin: 0;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--aside-text);
}

.fs__task {
  margin: 0;
  font-size: 1.45rem;
  font-weight: 700;
  line-height: 1.4;
  color: var(--main-text);
  word-break: break-word;
}

.fs__clock {
  font-size: 4.5rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--main-text);
}

.fs__clock.-done {
  font-size: 2.4rem;
  color: var(--highlight-text);
}

.fs__presets {
  display: inline-flex;
  gap: 0.4rem;
}

.fs__preset {
  min-width: 3.2rem;
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--main-border-light);
  border-radius: 999px;
  background: transparent;
  color: var(--aside-text);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.fs__preset:hover {
  color: var(--main-text);
}

.fs__preset.-on {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--highlight-text);
}

.fs__preset-unit {
  margin-left: 0.1em;
  font-size: 0.7em;
  opacity: 0.7;
}

.fs__controls {
  display: inline-flex;
  gap: 0.6rem;
  margin-top: 0.2rem;
}

.fs__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.55rem 1.2rem;
  border: 1px solid var(--main-border-light);
  border-radius: 8px;
  background: transparent;
  color: var(--button-text);
  font: inherit;
  font-size: 0.92rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.fs__btn:hover:not(:disabled) {
  background: var(--button-active-bg);
  color: var(--button-active-text);
}

.fs__btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.fs__btn.-primary {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

.fs__btn.-primary:hover {
  background: var(--amber-strong);
  color: #fff;
}

/* Secondary zone — kept visually quiet (smaller, lower-contrast, grouped behind
   a hairline) so it doesn't compete with the task + clock. */
.fs__secondary {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.85rem;
  margin-top: 0.6rem;
  padding-top: 1rem;
  border-top: 1px solid var(--divider);
  width: min(420px, 100%);
}

.fs__sound {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.55rem 0.7rem;
}

.fs__sound-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
  padding: 0.28rem 0.7rem;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--aside-text);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.fs__sound-toggle:hover {
  color: var(--main-text);
}

.fs__sound-toggle.-on {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--highlight-text);
}

.fs__scenes {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.3rem;
}

.fs__scene {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  padding: 0.28rem 0.6rem;
  border: 1px solid var(--main-border-light);
  border-radius: 999px;
  background: transparent;
  color: var(--aside-text);
  font: inherit;
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.fs__scene:hover {
  color: var(--main-text);
}

.fs__scene.-on {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--highlight-text);
}

.fs__scene-ic {
  display: inline-flex;
}

.fs__scene-ic svg {
  width: 1.05em;
  height: 1.05em;
  display: block;
}

.fs__sound-vol {
  width: 6.5rem;
  accent-color: var(--accent);
  cursor: pointer;
}

.fs__foot {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
}

.fs__foot-sep {
  color: var(--aside-text);
  opacity: 0.5;
  font-size: 0.8rem;
}

.fs__link {
  border: none;
  background: transparent;
  color: var(--aside-text);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
  transition: color 0.12s ease;
}

.fs__link:hover {
  color: var(--highlight-text);
}
</style>

<script setup lang="ts">
import { computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useFocusSession } from '../composables/useFocusSession'
import { useNotes } from '../composables/useNotes'
import { useAmbientSound } from '../composables/useAmbientSound'
import AmbientControls from './AmbientControls.vue'
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
// Ambient sound UI lives in <AmbientControls>; here we only need to silence it
// when the session closes.
const { stop: stopSound } = useAmbientSound()

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

    <!-- Overlay-level utilities pinned to the corners, out of the center's way. -->
    <button class="fs__corner -exit" type="button" @click="exit">
      <kbd class="fs__kbd">Esc</kbd>
      退出
    </button>
    <button class="fs__corner -note" type="button" @click="openNote">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1.02em;height:1.02em;display:block"><rect x="3.5" y="2.5" width="9" height="11" rx="1.5"/><path d="M5.5 6h5M5.5 8.5h5M5.5 11h3"/></svg>
      笔记
    </button>

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
        <AmbientControls />
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
  width: min(480px, 100%);
}

/* Corner utilities — exit (top-left, with an Esc hint) and note (top-right),
   kept subtle so they stay clear of the centered task + clock. */
.fs__corner {
  position: absolute;
  top: 1.25rem;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 0.45em;
  padding: 0.35rem 0.6rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--aside-text);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.12s ease, background-color 0.12s ease;
}

.fs__corner:hover {
  color: var(--highlight-text);
  background: var(--button-active-bg);
}

.fs__corner.-exit {
  left: 1.25rem;
}

.fs__corner.-note {
  right: 1.25rem;
}

.fs__kbd {
  display: inline-flex;
  align-items: center;
  padding: 0.04rem 0.38rem;
  border: 1px solid var(--main-border-light);
  border-radius: 5px;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1.5;
  color: var(--aside-text);
}
</style>

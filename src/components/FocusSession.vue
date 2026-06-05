<script setup lang="ts">
import { computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useFocusSession } from '../composables/useFocusSession'
import { useNotes } from '../composables/useNotes'
import { useAmbientSound, type NoiseType } from '../composables/useAmbientSound'
import { parseLabelRich, type RichSegment } from '../lib/time'
import { tagHue } from '../lib/tags'

const {
  target,
  presetMin,
  mmss,
  running,
  finished,
  presets,
  setPreset,
  pause,
  resume,
  exit,
  complete,
} = useFocusSession()
const notes = useNotes()
const {
  playing: noisePlaying,
  type: noiseType,
  volume: noiseVolume,
  toggle: toggleNoise,
  setType: setNoiseType,
  setVolume: setNoiseVolume,
  stop: stopNoise,
} = useAmbientSound()

const noiseTypes: { key: NoiseType; label: string }[] = [
  { key: 'brown', label: '棕' },
  { key: 'pink', label: '粉' },
  { key: 'white', label: '白' },
]

function onVolume(e: Event): void {
  setNoiseVolume(parseFloat((e.target as HTMLInputElement).value))
}

// Silence the ambient sound when the session closes.
watch(target, (t) => {
  if (!t) stopNoise()
})

const segments = computed<RichSegment[]>(() =>
  target.value ? parseLabelRich(target.value.label).segments : [],
)

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
    <div class="fs__scrim" @click="exit" />

    <div class="fs__panel">
      <p class="fs__eyebrow">正在专注</p>

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

      <div class="fs__presets">
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
        <button v-if="running" class="fs__btn" type="button" @click="pause"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="width:1em;height:1em;display:block"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>暂停</button>
        <button v-else class="fs__btn" type="button" :disabled="finished" @click="resume">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="width:1em;height:1em;display:block"><path d="M7 5l13 7-13 7z"/></svg>继续
        </button>
        <button class="fs__btn -primary" type="button" @click="complete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1em;height:1em;display:block"><path d="M5 12.5l4.5 4.5L19 6.5"/></svg>完成</button>
      </div>

      <div class="fs__noise">
        <button
          class="fs__noise-toggle"
          :class="{ '-on': noisePlaying }"
          type="button"
          aria-label="白噪音"
          @click="toggleNoise"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1.05em;height:1.05em;display:block"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5.5a9 9 0 0 1 0 13"/></svg> 白噪音
        </button>
        <template v-if="noisePlaying">
          <span class="fs__noise-types">
            <button
              v-for="n in noiseTypes"
              :key="n.key"
              class="fs__noise-type"
              :class="{ '-on': noiseType === n.key }"
              type="button"
              @click="setNoiseType(n.key)"
            >{{ n.label }}</button>
          </span>
          <input
            class="fs__noise-vol"
            type="range"
            min="0"
            max="1"
            step="0.05"
            :value="noiseVolume"
            aria-label="音量"
            @input="onVolume"
          />
        </template>
      </div>

      <div class="fs__foot">
        <button class="fs__link" type="button" @click="openNote">笔记</button>
        <button class="fs__link" type="button" @click="exit">退出 · Esc</button>
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

.fs__noise {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 0.4rem;
}

.fs__noise-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.3rem 0.85rem;
  border: 1px solid var(--main-border-light);
  border-radius: 999px;
  background: transparent;
  color: var(--aside-text);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.fs__noise-toggle.-on {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--highlight-text);
}

.fs__noise-types {
  display: inline-flex;
  gap: 0.25rem;
}

.fs__noise-type {
  min-width: 1.9rem;
  padding: 0.25rem 0.45rem;
  border: 1px solid var(--main-border-light);
  border-radius: 6px;
  background: transparent;
  color: var(--aside-text);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}

.fs__noise-type.-on {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--highlight-text);
}

.fs__noise-vol {
  width: 7rem;
  accent-color: var(--accent);
  cursor: pointer;
}

.fs__foot {
  display: inline-flex;
  gap: 1.4rem;
  margin-top: 0.3rem;
}

.fs__link {
  border: none;
  background: transparent;
  color: var(--aside-text);
  font: inherit;
  font-size: 0.82rem;
  cursor: pointer;
}

.fs__link:hover {
  color: var(--highlight-text);
}
</style>

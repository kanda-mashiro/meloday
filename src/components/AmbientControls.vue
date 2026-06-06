<script setup lang="ts">
import { useAmbientSound } from '../composables/useAmbientSound'

// Shared ambient-sound picker: an 环境音 toggle that expands into the scene
// grid + a volume slider. Backed by the useAmbientSound singleton, so it can be
// dropped into both the full-screen FocusSession and the day view's side pane
// and stays in sync.
const { playing, scene, scenes, volume, toggle, setScene, setVolume } = useAmbientSound()

function onVolume(e: Event): void {
  setVolume(parseFloat((e.target as HTMLInputElement).value))
}
</script>

<template>
  <div class="amb">
    <button
      class="amb__toggle"
      :class="{ '-on': playing }"
      type="button"
      aria-label="环境音"
      :aria-pressed="playing"
      @click="toggle"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1em;height:1em;display:block"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5.5a9 9 0 0 1 0 13"/></svg>
      环境音
    </button>

    <template v-if="playing">
      <div class="amb__scenes" role="group" aria-label="场景">
        <button
          v-for="s in scenes"
          :key="s.id"
          class="amb__scene"
          :class="{ '-on': scene === s.id }"
          type="button"
          :title="s.label"
          :aria-pressed="scene === s.id"
          @click="setScene(s.id)"
        >
          <span class="amb__scene-ic" aria-hidden="true">
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
          <span class="amb__scene-label">{{ s.label }}</span>
        </button>
      </div>
      <div class="amb__vol">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/></svg>
        <input
          class="amb__vol-range"
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="volume"
          aria-label="音量"
          @input="onVolume"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.amb {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
}

.amb__toggle {
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

.amb__toggle:hover {
  color: var(--main-text);
}

.amb__toggle.-on {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--highlight-text);
}

.amb__scenes {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.4rem;
  width: 100%;
}

.amb__scene {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3em;
  padding: 0.32rem 0.5rem;
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

.amb__scene:hover {
  color: var(--main-text);
}

.amb__scene.-on {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--highlight-text);
}

.amb__scene-ic {
  display: inline-flex;
}

.amb__scene-ic svg {
  width: 1.05em;
  height: 1.05em;
  display: block;
}

.amb__vol {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  color: var(--aside-text);
}

.amb__vol svg {
  flex: 0 0 auto;
  width: 1rem;
  height: 1rem;
  display: block;
}

.amb__vol-range {
  flex: 1 1 auto;
  accent-color: var(--accent);
  cursor: pointer;
}
</style>

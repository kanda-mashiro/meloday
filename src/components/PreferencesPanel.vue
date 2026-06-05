<script setup lang="ts">
import { usePreferences, type SizeStep } from '../composables/usePreferences'
import { useDarkMode } from '../composables/useDarkMode'
import ColorPicker from './ColorPicker.vue'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { prefs, accents, columnOptions, reset, setCustomAccent } = usePreferences()
const { isDark, setDark } = useDarkMode()

const sizes: SizeStep[] = ['S', 'M', 'L']

const DEFAULT_CUSTOM = '#d2912a'
function selectCustom(): void {
  setCustomAccent(prefs.customAccent || DEFAULT_CUSTOM)
}
</script>

<template>
  <div class="prefs" :class="{ '-open': open }">
    <div class="prefs__scrim" @click="emit('close')" />

    <aside class="prefs__panel" role="dialog" aria-label="Preferences">
      <header class="prefs__head">
        <h2 class="prefs__title">Preferences</h2>
        <button class="prefs__close" type="button" aria-label="Close" @click="emit('close')">×</button>
      </header>

      <div class="prefs__body">
        <!-- Accent color -->
        <section class="prefs__row prefs__row--accent">
          <span class="prefs__label">Accent</span>
          <div class="prefs__swatches">
            <button
              v-for="a in accents"
              :key="a.key"
              class="prefs__swatch"
              :class="{ '-active': prefs.accent === a.key }"
              :style="{ background: a.color }"
              :title="a.label"
              :aria-label="a.label"
              type="button"
              @click="prefs.accent = a.key"
            />
            <button
              class="prefs__swatch prefs__swatch--custom"
              :class="{ '-active': prefs.accent === 'custom' }"
              :style="prefs.customAccent ? { background: prefs.customAccent } : {}"
              title="自定义颜色"
              aria-label="自定义颜色"
              type="button"
              @click="selectCustom"
            >
              <svg
                v-if="!prefs.customAccent"
                class="prefs__swatch-plus"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
          <ColorPicker
            v-if="prefs.accent === 'custom'"
            class="prefs__picker"
            :model-value="prefs.customAccent || '#d2912a'"
            @update:model-value="setCustomAccent"
          />
        </section>

        <!-- Columns -->
        <section class="prefs__row">
          <span class="prefs__label">Columns</span>
          <div class="seg">
            <button
              v-for="n in columnOptions"
              :key="n"
              class="seg__btn"
              :class="{ '-active': prefs.columns === n }"
              type="button"
              @click="prefs.columns = n"
            >
              {{ n }}
            </button>
          </div>
        </section>

        <!-- Text size -->
        <section class="prefs__row">
          <span class="prefs__label">Text size</span>
          <div class="seg">
            <button
              v-for="s in sizes"
              :key="s"
              class="seg__btn"
              :class="{ '-active': prefs.textSize === s }"
              type="button"
              @click="prefs.textSize = s"
            >
              {{ s }}
            </button>
          </div>
        </section>

        <!-- Spacing -->
        <section class="prefs__row">
          <span class="prefs__label">Spacing</span>
          <div class="seg">
            <button
              v-for="s in sizes"
              :key="s"
              class="seg__btn"
              :class="{ '-active': prefs.spacing === s }"
              type="button"
              @click="prefs.spacing = s"
            >
              {{ s }}
            </button>
          </div>
        </section>

        <!-- Completed todos -->
        <section class="prefs__row">
          <span class="prefs__label">Completed</span>
          <div class="seg">
            <button class="seg__btn" :class="{ '-active': prefs.showCompleted }" type="button" @click="prefs.showCompleted = true">Show</button>
            <button class="seg__btn" :class="{ '-active': !prefs.showCompleted }" type="button" @click="prefs.showCompleted = false">Hide</button>
          </div>
        </section>

        <!-- Lines -->
        <section class="prefs__row">
          <span class="prefs__label">Lines</span>
          <div class="seg">
            <button class="seg__btn" :class="{ '-active': prefs.showLines }" type="button" @click="prefs.showLines = true">Show</button>
            <button class="seg__btn" :class="{ '-active': !prefs.showLines }" type="button" @click="prefs.showLines = false">Hide</button>
          </div>
        </section>

        <!-- Start on -->
        <section class="prefs__row">
          <span class="prefs__label">Start on</span>
          <div class="seg">
            <button class="seg__btn" :class="{ '-active': prefs.startOn === 'today' }" type="button" @click="prefs.startOn = 'today'">Today</button>
            <button class="seg__btn" :class="{ '-active': prefs.startOn === 'yesterday' }" type="button" @click="prefs.startOn = 'yesterday'">Yesterday</button>
          </div>
        </section>

        <!-- Display -->
        <section class="prefs__row">
          <span class="prefs__label">Display</span>
          <div class="seg">
            <button class="seg__btn" :class="{ '-active': !isDark }" type="button" @click="setDark(false)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1.05em;height:1.05em;display:block"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/></svg> Light</button>
            <button class="seg__btn" :class="{ '-active': isDark }" type="button" @click="setDark(true)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1.05em;height:1.05em;display:block"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg> Dark</button>
          </div>
        </section>

        <button class="prefs__reset" type="button" @click="reset">Reset to defaults</button>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.prefs {
  position: fixed;
  inset: 0;
  z-index: 50;
  pointer-events: none;
}

.prefs__scrim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.28);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.prefs__panel {
  position: absolute;
  top: 0;
  left: 0;
  width: min(340px, 86vw);
  height: 100%;
  background: var(--panel-bg);
  border-right: 1px solid var(--divider);
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.12);
  transform: translateX(-100%);
  transition: transform 0.22s ease;
  display: flex;
  flex-direction: column;
}

.prefs.-open {
  pointer-events: auto;
}

.prefs.-open .prefs__scrim {
  opacity: 1;
}

.prefs.-open .prefs__panel {
  transform: translateX(0);
}

.prefs__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.25rem 0.75rem;
}

.prefs__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--main-text);
}

.prefs__close {
  border: none;
  background: transparent;
  color: var(--aside-text);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 0.25rem;
}

.prefs__close:hover {
  color: var(--main-text);
}

.prefs__body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 0.5rem 1.25rem 2rem;
}

.prefs__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 0;
  border-bottom: 1px solid var(--divider);
}

/* The accent row stacks (label, then a full-width swatch row + inline picker)
   so all swatches fit on one line instead of wrapping awkwardly. */
.prefs__row--accent {
  flex-direction: column;
  align-items: stretch;
  gap: 0.7rem;
}

.prefs__label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--main-text);
}

.prefs__swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  justify-content: flex-start;
}

.prefs__swatch {
  width: 1.3rem;
  height: 1.3rem;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.prefs__swatch:hover {
  transform: scale(1.12);
}

.prefs__swatch.-active {
  border-color: var(--main-text);
  box-shadow: 0 0 0 2px var(--panel-bg) inset;
}

/* The custom-color swatch is a neutral "+" until a color is picked; after that
   it just shows the chosen color (no garish rainbow wheel). */
.prefs__swatch--custom {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--button-active-bg);
  color: var(--aside-text);
}

.prefs__swatch-plus {
  width: 0.8rem;
  height: 0.8rem;
}

.prefs__picker {
  margin-top: 0.1rem;
}

.seg {
  display: inline-flex;
  border: 1px solid var(--main-border-light);
  border-radius: 7px;
  overflow: hidden;
}

.seg__btn {
  min-width: 2rem;
  padding: 0.3rem 0.6rem;
  border: none;
  border-left: 1px solid var(--main-border-light);
  background: transparent;
  color: var(--aside-text);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
  justify-content: center;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.seg__btn:first-child {
  border-left: none;
}

.seg__btn:hover {
  color: var(--main-text);
}

.seg__btn.-active {
  background: var(--accent);
  color: #fff;
}

.prefs__reset {
  margin-top: 1.5rem;
  width: 100%;
  padding: 0.6rem;
  border: 1px solid var(--main-border-light);
  border-radius: 7px;
  background: transparent;
  color: var(--aside-text);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}

.prefs__reset:hover {
  color: var(--highlight-text);
  border-color: var(--highlight-text);
}
</style>

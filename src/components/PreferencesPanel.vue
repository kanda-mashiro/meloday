<script setup lang="ts">
import { usePreferences, type SizeStep } from '../composables/usePreferences'
import { useDarkMode } from '../composables/useDarkMode'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { prefs, accents, columnOptions, reset } = usePreferences()
const { isDark, setDark } = useDarkMode()

const sizes: SizeStep[] = ['S', 'M', 'L']
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
        <section class="prefs__row">
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
          </div>
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
            <button class="seg__btn" :class="{ '-active': !isDark }" type="button" @click="setDark(false)">☀ Light</button>
            <button class="seg__btn" :class="{ '-active': isDark }" type="button" @click="setDark(true)">☾ Dark</button>
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

.prefs__label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--main-text);
}

.prefs__swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  justify-content: flex-end;
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

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

// HSV is the picker's source of truth (h 0–360, s/v 0–1).
const h = ref(0)
const s = ref(0)
const v = ref(0)
const hexText = ref('')

// --- color math -------------------------------------------------------------
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const raw = hex.replace('#', '')
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0,
  }
}
function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let hh = 0
  if (d) {
    if (max === r) hh = ((g - b) / d) % 6
    else if (max === g) hh = (b - r) / d + 2
    else hh = (r - g) / d + 4
    hh *= 60
    if (hh < 0) hh += 360
  }
  return { h: hh, s: max === 0 ? 0 : d / max, v: max }
}
function hsvToRgb(hh: number, ss: number, vv: number): { r: number; g: number; b: number } {
  const c = vv * ss
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = vv - c
  let r = 0
  let g = 0
  let b = 0
  if (hh < 60) (r = c), (g = x)
  else if (hh < 120) (r = x), (g = c)
  else if (hh < 180) (g = c), (b = x)
  else if (hh < 240) (g = x), (b = c)
  else if (hh < 300) (r = c), (b = x)
  else (r = c), (b = x)
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) }
}
function rgbToHex(r: number, g: number, b: number): string {
  const two = (n: number) => n.toString(16).padStart(2, '0')
  return `#${two(r)}${two(g)}${two(b)}`
}

const currentHex = computed(() => {
  const { r, g, b } = hsvToRgb(h.value, s.value, v.value)
  return rgbToHex(r, g, b)
})

function syncFromHex(hex: string): void {
  const { r, g, b } = hexToRgb(hex)
  const hsv = rgbToHsv(r, g, b)
  h.value = hsv.h
  s.value = hsv.s
  v.value = hsv.v
  hexText.value = currentHex.value.replace('#', '')
}
syncFromHex(props.modelValue)

// External changes re-sync; the guard stops our own emits from looping back.
watch(
  () => props.modelValue,
  (nv) => {
    if (nv.toLowerCase() !== currentHex.value.toLowerCase()) syncFromHex(nv)
  },
)

function emitColor(): void {
  hexText.value = currentHex.value.replace('#', '')
  emit('update:modelValue', currentHex.value)
}

// --- drag handling ----------------------------------------------------------
const svEl = ref<HTMLElement | null>(null)
const hueEl = ref<HTMLElement | null>(null)
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

function dragSv(e: PointerEvent): void {
  const apply = (ev: PointerEvent) => {
    const el = svEl.value
    if (!el) return
    const r = el.getBoundingClientRect()
    s.value = clamp((ev.clientX - r.left) / r.width, 0, 1)
    v.value = clamp(1 - (ev.clientY - r.top) / r.height, 0, 1)
    emitColor()
  }
  apply(e)
  const move = (ev: PointerEvent) => apply(ev)
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

function dragHue(e: PointerEvent): void {
  const apply = (ev: PointerEvent) => {
    const el = hueEl.value
    if (!el) return
    const r = el.getBoundingClientRect()
    h.value = clamp((ev.clientX - r.left) / r.width, 0, 1) * 360
    emitColor()
  }
  apply(e)
  const move = (ev: PointerEvent) => apply(ev)
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

function onHexInput(e: Event): void {
  const t = (e.target as HTMLInputElement).value.trim().replace(/^#/, '')
  hexText.value = t
  if (/^[0-9a-fA-F]{6}$/.test(t)) {
    syncFromHex(`#${t}`)
    emit('update:modelValue', `#${t}`)
  }
}

const hueColor = computed(() => {
  const { r, g, b } = hsvToRgb(h.value, 1, 1)
  return rgbToHex(r, g, b)
})
const svHandleStyle = computed(() => ({ left: `${s.value * 100}%`, top: `${(1 - v.value) * 100}%` }))
const hueHandleStyle = computed(() => ({ left: `${(h.value / 360) * 100}%` }))
</script>

<template>
  <div class="cp">
    <div
      ref="svEl"
      class="cp__sv"
      :style="{ backgroundColor: hueColor }"
      @pointerdown="dragSv"
    >
      <div class="cp__sv-white" />
      <div class="cp__sv-black" />
      <div class="cp__handle" :style="svHandleStyle" />
    </div>

    <div ref="hueEl" class="cp__hue" @pointerdown="dragHue">
      <div class="cp__hue-handle" :style="hueHandleStyle" />
    </div>

    <label class="cp__hex">
      <span class="cp__hash">#</span>
      <input
        class="cp__hex-input"
        :value="hexText"
        maxlength="6"
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        @input="onHexInput"
      />
    </label>
  </div>
</template>

<style scoped>
.cp {
  width: 100%;
}

.cp__sv {
  position: relative;
  width: 100%;
  height: 140px;
  border-radius: 8px;
  overflow: hidden;
  cursor: crosshair;
  touch-action: none;
}

.cp__sv-white {
  position: absolute;
  inset: 0;
  background: linear-gradient(to right, #fff, rgba(255, 255, 255, 0));
}

.cp__sv-black {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, #000, rgba(0, 0, 0, 0));
}

.cp__handle {
  position: absolute;
  width: 14px;
  height: 14px;
  border: 2px solid #fff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45);
  pointer-events: none;
}

.cp__hue {
  position: relative;
  height: 14px;
  margin-top: 0.7rem;
  border-radius: 7px;
  cursor: pointer;
  touch-action: none;
  background: linear-gradient(
    to right,
    #f00 0%,
    #ff0 17%,
    #0f0 33%,
    #0ff 50%,
    #00f 67%,
    #f0f 83%,
    #f00 100%
  );
}

.cp__hue-handle {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  border: 2px solid #fff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45);
  pointer-events: none;
}

.cp__hex {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  margin-top: 0.7rem;
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--main-border-light);
  border-radius: 6px;
  color: var(--main-text);
}

.cp__hash {
  color: var(--disabled-text);
  font-size: 0.85rem;
}

.cp__hex-input {
  width: 5.5rem;
  border: none;
  background: transparent;
  color: var(--main-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.85rem;
  letter-spacing: 0.04em;
  text-transform: lowercase;
  outline: none;
}
</style>

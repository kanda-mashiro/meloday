import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { FOCUS_PRESETS } from './useFocusSession'

// A compact, standalone pomodoro for the whole day — it doesn't target a
// specific task and never opens the full-screen FocusSession overlay. The
// ticking logic mirrors useFocusSession's runTicker, but kept here as a module
// singleton so the bottom-bar trigger and the pop-up panel share one timer.

const presets = FOCUS_PRESETS
const presetMin = ref(25)
const remaining = ref(presetMin.value * 60) // seconds left on the clock
const running = ref(false)
let ticker: ReturnType<typeof setInterval> | undefined

function clearTicker(): void {
  if (ticker) {
    clearInterval(ticker)
    ticker = undefined
  }
}

function runTicker(): void {
  clearTicker()
  running.value = true
  ticker = setInterval(() => {
    if (remaining.value > 0) remaining.value -= 1
    if (remaining.value <= 0) {
      remaining.value = 0
      running.value = false
      clearTicker()
    }
  }, 1000)
}

function setPreset(min: number): void {
  presetMin.value = min
  remaining.value = min * 60
  running.value = false
  clearTicker()
}

function start(): void {
  if (remaining.value <= 0) remaining.value = presetMin.value * 60
  runTicker()
}

function pause(): void {
  running.value = false
  clearTicker()
}

// Reset: stop and put the clock back to the chosen length.
function reset(): void {
  running.value = false
  clearTicker()
  remaining.value = presetMin.value * 60
}

const mmss = computed(() => {
  const m = Math.floor(remaining.value / 60)
  const s = remaining.value % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

const finished = computed(() => remaining.value <= 0)
// Fresh, un-started state: full clock, not ticking.
const ready = computed(() => !running.value && remaining.value === presetMin.value * 60)

export function useDayTimer(): {
  presets: typeof FOCUS_PRESETS
  presetMin: Ref<number>
  remaining: Ref<number>
  running: Ref<boolean>
  ready: ComputedRef<boolean>
  finished: ComputedRef<boolean>
  mmss: ComputedRef<string>
  setPreset: (min: number) => void
  start: () => void
  pause: () => void
  reset: () => void
} {
  return {
    presets,
    presetMin,
    remaining,
    running,
    ready,
    finished,
    mmss,
    setPreset,
    start,
    pause,
    reset,
  }
}

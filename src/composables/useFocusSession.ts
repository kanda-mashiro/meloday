import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { useTodoStore } from './useTodoStore'

/** The task currently held in a focus session. */
export interface FocusTarget {
  id: string
  label: string
}

// Pomodoro presets, in minutes.
export const FOCUS_PRESETS = [15, 25, 45] as const

// --- module-singleton session state -----------------------------------------
const target = ref<FocusTarget | null>(null)
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

/** Focus a specific task (any order) and start its countdown. */
function start(t: FocusTarget): void {
  target.value = t
  remaining.value = presetMin.value * 60
  runTicker()
}

/** Pick a pomodoro length; resets the clock to that length. */
function setPreset(min: number): void {
  presetMin.value = min
  remaining.value = min * 60
  if (target.value && running.value) runTicker()
}

function pause(): void {
  running.value = false
  clearTicker()
}

function resume(): void {
  if (remaining.value > 0) runTicker()
}

/** Leave the session (task untouched). */
function exit(): void {
  target.value = null
  running.value = false
  clearTicker()
  remaining.value = presetMin.value * 60
}

/** Mark the focused task done and leave the session. */
function complete(): void {
  const t = target.value
  if (t) useTodoStore().checkItem({ id: t.id, done: true })
  exit()
}

const mmss = computed(() => {
  const m = Math.floor(remaining.value / 60)
  const s = remaining.value % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

const finished = computed(() => target.value !== null && remaining.value <= 0)

/**
 * A single-task focus session: pick any task, run a pomodoro on it, then mark
 * it done or just leave. Module singleton so the trigger (a list row) and the
 * overlay share one clock.
 */
export function useFocusSession(): {
  target: Ref<FocusTarget | null>
  presetMin: Ref<number>
  remaining: Ref<number>
  running: Ref<boolean>
  mmss: ComputedRef<string>
  finished: ComputedRef<boolean>
  presets: readonly number[]
  start: (t: FocusTarget) => void
  setPreset: (min: number) => void
  pause: () => void
  resume: () => void
  exit: () => void
  complete: () => void
} {
  return {
    target,
    presetMin,
    remaining,
    running,
    mmss,
    finished,
    presets: FOCUS_PRESETS,
    start,
    setPreset,
    pause,
    resume,
    exit,
    complete,
  }
}

import { reactive, watch } from 'vue'

export type SizeStep = 'S' | 'M' | 'L'
export type StartOn = 'today' | 'yesterday'

export interface Accent {
  key: string
  label: string
  color: string
  soft: string
}

export interface Preferences {
  accent: string
  /** Hex used when `accent === 'custom'`. */
  customAccent?: string
  columns: number
  textSize: SizeStep
  spacing: SizeStep
  showCompleted: boolean
  showLines: boolean
  startOn: StartOn
}

export const ACCENTS: Accent[] = [
  { key: 'amber', label: 'Amber', color: '#d2912a', soft: 'rgba(210, 145, 42, 0.09)' },
  { key: 'red', label: 'Red', color: '#d23a4f', soft: 'rgba(210, 58, 79, 0.09)' },
  { key: 'pink', label: 'Pink', color: '#d6418c', soft: 'rgba(214, 65, 140, 0.09)' },
  { key: 'green', label: 'Green', color: '#2e9e5b', soft: 'rgba(46, 158, 91, 0.10)' },
  { key: 'teal', label: 'Teal', color: '#1aa3a3', soft: 'rgba(26, 163, 163, 0.10)' },
  { key: 'blue', label: 'Blue', color: '#3b6fe0', soft: 'rgba(59, 111, 224, 0.10)' },
  { key: 'purple', label: 'Purple', color: '#7a52d9', soft: 'rgba(122, 82, 217, 0.10)' },
  { key: 'graphite', label: 'Graphite', color: '#5b6472', soft: 'rgba(91, 100, 114, 0.10)' },
]

export const COLUMN_OPTIONS = [1, 3, 5, 7] as const

const FONT_SIZE: Record<SizeStep, string> = {
  S: '13.5px',
  M: '15px',
  L: '17px',
}

const LINE_HEIGHT: Record<SizeStep, string> = {
  S: '2.1rem',
  M: '2.5rem',
  L: '3rem',
}

const STORAGE_KEY = 'my-todo-prefs'

function defaults(): Preferences {
  return {
    accent: 'amber',
    customAccent: undefined,
    columns: 7,
    textSize: 'M',
    spacing: 'M',
    showCompleted: true,
    showLines: true,
    startOn: 'today',
  }
}

function load(): Preferences {
  const base = defaults()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Preferences>
      return { ...base, ...parsed }
    }
  } catch {
    // ignore malformed storage
  }
  return base
}

const prefs = reactive<Preferences>(load())

// Remember the last multi-day column count so Esc can restore it when leaving
// the single-day focus view.
let prevColumns = prefs.columns === 1 ? 3 : prefs.columns

function accentFor(key: string): Accent {
  return ACCENTS.find((a) => a.key === key) ?? ACCENTS[0]
}

// A custom hex's faint "soft" tint (used for --accent-soft).
function hexToSoft(hex: string): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const r = parseInt(full.slice(0, 2), 16) || 0
  const g = parseInt(full.slice(2, 4), 16) || 0
  const b = parseInt(full.slice(4, 6), 16) || 0
  return `rgba(${r}, ${g}, ${b}, 0.1)`
}

// Push the appearance-related preferences into CSS custom properties.
function apply(): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement.style
  const useCustom = prefs.accent === 'custom' && !!prefs.customAccent
  const color = useCustom ? (prefs.customAccent as string) : accentFor(prefs.accent).color
  const soft = useCustom ? hexToSoft(prefs.customAccent as string) : accentFor(prefs.accent).soft
  root.setProperty('--accent', color)
  root.setProperty('--highlight-text', color)
  root.setProperty('--accent-soft', soft)
  root.setProperty('--font-size', FONT_SIZE[prefs.textSize])
  root.setProperty('--line-h', LINE_HEIGHT[prefs.spacing])
}

/** Leave the single-day focus view, restoring the previous multi-day count. */
function exitFocus(): void {
  prefs.columns = prevColumns
}

let initialized = false

function init(): void {
  if (initialized) return
  initialized = true
  apply()
  watch(
    () => prefs,
    () => {
      apply()
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
      } catch {
        // ignore persistence errors
      }
    },
    { deep: true },
  )

  watch(
    () => prefs.columns,
    (n) => {
      if (n !== 1) prevColumns = n
    },
  )
}

init()

export function usePreferences(): {
  prefs: Preferences
  accents: Accent[]
  columnOptions: readonly number[]
  reset: () => void
  exitFocus: () => void
  setCustomAccent: (hex: string) => void
} {
  return {
    prefs,
    accents: ACCENTS,
    columnOptions: COLUMN_OPTIONS,
    reset: () => Object.assign(prefs, defaults()),
    exitFocus,
    setCustomAccent: (hex: string) => {
      prefs.customAccent = hex
      prefs.accent = 'custom'
    },
  }
}

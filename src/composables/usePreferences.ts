import { reactive, watch, nextTick } from 'vue'
import { supabase, PREFS_TABLE } from '../lib/supabase'
import { useAuth } from './useAuth'

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

const STORAGE_KEY = 'meloday-prefs'

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

// --- Cloud sync ------------------------------------------------------------
// Preferences also live in a per-user row (user_prefs) so they follow the
// account across devices. localStorage stays the local cache (and the only
// store when logged out). Whole-object last-write-wins: on login the cloud copy
// wins; later edits are pushed (debounced). Dark mode is deliberately NOT
// synced — it's environment-dependent (see useDarkMode).
const { user } = useAuth()
let pushTimer: ReturnType<typeof setTimeout> | null = null
// Guards the echo: a freshly-pulled cloud copy must not be pushed straight back.
let applyingRemote = false

function pushCloud(): void {
  const uid = user.value?.id
  if (!supabase || !uid) return
  supabase
    .from(PREFS_TABLE)
    .upsert({ user_id: uid, prefs: { ...prefs }, updated_at: new Date().toISOString() })
    .then(undefined, () => {
      // Best-effort; localStorage already holds the source of truth.
    })
}

function schedulePush(): void {
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(pushCloud, 600)
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
      // Mirror the change up to the user's cloud row (debounced) — but not when
      // we're applying a copy we just pulled down.
      if (!applyingRemote && user.value) schedulePush()
    },
    { deep: true },
  )

  watch(
    () => prefs.columns,
    (n) => {
      if (n !== 1) prevColumns = n
    },
  )

  // On login (or session restore) pull the cloud copy and let it win. No row
  // yet → keep whatever's local; the next edit creates it.
  watch(
    () => user.value?.id,
    async (uid) => {
      if (!supabase || !uid) return
      const { data } = await supabase
        .from(PREFS_TABLE)
        .select('prefs')
        .eq('user_id', uid)
        .maybeSingle()
      if (!data?.prefs) return
      applyingRemote = true
      Object.assign(prefs, data.prefs as Partial<Preferences>)
      // Let the deep watch flush (apply() + localStorage) before re-enabling
      // pushes, so the pulled copy isn't immediately echoed back up.
      await nextTick()
      applyingRemote = false
    },
    { immediate: true },
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

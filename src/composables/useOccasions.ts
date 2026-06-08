import { reactive, watch, nextTick } from 'vue'
import { supabase, OCCASIONS_TABLE } from '../lib/supabase'
import { useAuth } from './useAuth'

// A manually-added yearly occasion (生日/纪念日/节日). Only month+day are stored —
// yearly recurrence is implied, so there's deliberately no year field.
export interface Occasion {
  id: string
  name: string
  month: number // 1-12
  day: number // 1-31
}

const STORAGE_KEY = 'meloday-occasions'

function load(): Occasion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as Occasion[]
    }
  } catch {
    // ignore malformed storage
  }
  return []
}

const occasions = reactive<Occasion[]>(load())

function addOccasion(input: { name: string; month: number; day: number }): void {
  occasions.push({
    id: crypto.randomUUID(),
    name: input.name,
    month: input.month,
    day: input.day,
  })
}

function removeOccasion(id: string): void {
  const i = occasions.findIndex((o) => o.id === id)
  if (i !== -1) occasions.splice(i, 1)
}

/** Occasions whose month/day match the given date. */
function occasionsOn(month: number, day: number): Occasion[] {
  return occasions.filter((o) => o.month === month && o.day === day)
}

/**
 * Occasions whose NEXT yearly occurrence falls within `withinDays` of `today`.
 * For each, `days` is the whole-day gap to that occurrence: today itself = 0, and
 * an already-passed date this year rolls to next year. Sorted soonest-first.
 */
function upcoming(
  withinDays: number,
  today: Date = new Date(),
): { occasion: Occasion; days: number }[] {
  // Normalise "today" to local midnight so the gap is counted in whole days.
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const MS_PER_DAY = 86_400_000
  return occasions
    .map((occasion) => {
      let next = new Date(base.getFullYear(), occasion.month - 1, occasion.day)
      if (next.getTime() < base.getTime()) {
        next = new Date(base.getFullYear() + 1, occasion.month - 1, occasion.day)
      }
      const days = Math.round((next.getTime() - base.getTime()) / MS_PER_DAY)
      return { occasion, days }
    })
    .filter((e) => e.days <= withinDays)
    .sort((a, b) => a.days - b.days)
}

// --- Cloud sync ------------------------------------------------------------
// Occasions live in a per-user row (user_occasions) so they follow the account
// across devices, mirroring usePreferences. localStorage stays the local cache
// (and the only store when logged out). Whole-array last-write-wins: on login
// the cloud copy wins; later edits are pushed (debounced).
const { user } = useAuth()
let pushTimer: ReturnType<typeof setTimeout> | null = null
// Guards the echo: a freshly-pulled cloud copy must not be pushed straight back.
let applyingRemote = false

function pushCloud(): void {
  const uid = user.value?.id
  if (!supabase || !uid) return
  supabase
    .from(OCCASIONS_TABLE)
    .upsert({ user_id: uid, occasions: [...occasions], updated_at: new Date().toISOString() })
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

  watch(
    () => occasions,
    () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(occasions))
      } catch {
        // ignore persistence errors
      }
      // Mirror the change up to the user's cloud row (debounced) — but not when
      // we're applying a copy we just pulled down.
      if (!applyingRemote && user.value) schedulePush()
    },
    { deep: true },
  )

  // On login (or session restore) pull the cloud copy and let it win. No row
  // yet → keep whatever's local; the next edit creates it.
  watch(
    () => user.value?.id,
    async (uid) => {
      if (!supabase || !uid) return
      const { data } = await supabase
        .from(OCCASIONS_TABLE)
        .select('occasions')
        .eq('user_id', uid)
        .maybeSingle()
      if (!Array.isArray(data?.occasions)) return
      applyingRemote = true
      occasions.splice(0, occasions.length, ...(data.occasions as Occasion[]))
      // Let the deep watch flush (localStorage) before re-enabling pushes, so the
      // pulled copy isn't immediately echoed back up.
      await nextTick()
      applyingRemote = false
    },
    { immediate: true },
  )
}

init()

export function useOccasions(): {
  occasions: Occasion[]
  addOccasion: (input: { name: string; month: number; day: number }) => void
  removeOccasion: (id: string) => void
  occasionsOn: (month: number, day: number) => Occasion[]
  upcoming: (withinDays: number, today?: Date) => { occasion: Occasion; days: number }[]
} {
  return { occasions, addOccasion, removeOccasion, occasionsOn, upcoming }
}

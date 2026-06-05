import { ref, watch, type Ref } from 'vue'
import type { TodoData } from '../types/todo'
import { initTodoData, movePastTodoItems, partitionForArchive } from '../lib/todoLogic'
import { supabase, TODO_TABLE, ARCHIVE_TABLE } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useTodoStore } from './useTodoStore'

export type SyncStatus = 'offline' | 'idle' | 'syncing' | 'error'

const status: Ref<SyncStatus> = ref('offline')
const lastSyncedAt: Ref<number | null> = ref(null)

// Cache is keyed by user id so accounts never see each other's data, and is
// cleared on sign-out (privacy on shared devices).
const CACHE_PREFIX = 'my-todo:'
const PUSH_DEBOUNCE = 1000

interface CacheEntry {
  data: TodoData
  ts: number
}

function cacheKey(uid: string): string {
  return CACHE_PREFIX + uid
}

function readCache(uid: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(cacheKey(uid))
    return raw ? (JSON.parse(raw) as CacheEntry) : null
  } catch {
    return null
  }
}

function writeCache(uid: string, data: TodoData, ts: number): void {
  try {
    localStorage.setItem(cacheKey(uid), JSON.stringify({ data, ts }))
  } catch {
    // ignore quota / private mode
  }
}

function clearCache(uid: string): void {
  try {
    localStorage.removeItem(cacheKey(uid))
  } catch {
    // ignore
  }
}

function snapshot(state: TodoData): TodoData {
  return JSON.parse(JSON.stringify(state)) as TodoData
}

let initialized = false

function init(): void {
  if (initialized) return
  initialized = true
  if (!supabase) return

  const store = useTodoStore()
  const { user } = useAuth()

  // True while applying a snapshot that came from the cache/cloud, so the
  // change-watcher doesn't echo it straight back out.
  let applyingRemote = false
  // The cache timestamp currently reflected in the store (for LWW compares).
  let currentTs = 0
  let pushTimer: ReturnType<typeof setTimeout> | undefined
  let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null

  function applyRemote(data: TodoData, ts: number): void {
    applyingRemote = true
    store.setData(data)
    applyingRemote = false
    currentTs = ts
  }

  async function hydrate(uid: string): Promise<void> {
    if (!supabase) return
    status.value = 'syncing'

    // 1. Instant render from this user's local cache, if any.
    const cache = readCache(uid)
    if (cache) applyRemote(cache.data, cache.ts)

    // 2. Reconcile with the cloud (the source of truth).
    const { data: row, error } = await supabase
      .from(TODO_TABLE)
      .select('data, updated_at')
      .eq('user_id', uid)
      .maybeSingle()

    if (error) {
      status.value = 'error'
      console.warn('[sync] load failed', error.message)
      return
    }

    let data: TodoData
    let ts: number
    let needsPush = false

    if (row) {
      const remoteTs = new Date(row.updated_at as string).getTime()
      if (remoteTs >= (cache?.ts ?? 0)) {
        data = row.data as TodoData
        ts = remoteTs
      } else {
        // Local cache is newer (offline edits) → keep it, push up.
        data = cache!.data
        ts = cache!.ts
        needsPush = true
      }
    } else if (cache) {
      // No cloud row yet but this user has cached (offline) data → upload it.
      data = cache.data
      ts = cache.ts
      needsPush = true
    } else {
      // Brand-new user: start empty.
      data = initTodoData()
      ts = 0
    }

    // Roll unfinished past-day items forward, like the old local load did.
    data = movePastTodoItems(data)
    applyRemote(data, ts)
    writeCache(uid, data, ts)

    subscribe(uid)
    if (needsPush) push(uid)
    else {
      lastSyncedAt.value = ts || null
      status.value = 'idle'
    }

    // Background: relocate long-completed items into the archive table.
    void sweepArchive(uid)
  }

  async function push(uid: string): Promise<void> {
    if (!supabase) return
    status.value = 'syncing'
    const ts = Date.now()
    const data = snapshot(store.state)
    const { error } = await supabase.from(TODO_TABLE).upsert({
      user_id: uid,
      data,
      updated_at: new Date(ts).toISOString(),
    })
    if (error) {
      status.value = 'error'
      console.warn('[sync] push failed', error.message)
      return
    }
    currentTs = ts
    writeCache(uid, data, ts)
    lastSyncedAt.value = ts
    status.value = 'idle'
  }

  // Move long-completed items out of the hot doc into the archive table. Runs
  // in the background after hydrate. Safe ordering: persist archive rows FIRST,
  // only then drop them from the live document (a failed write loses nothing).
  // Most loads are no-ops (nothing crosses the threshold → early return).
  async function sweepArchive(uid: string): Promise<void> {
    if (!supabase) return
    const { data: trimmed, archived, changed } = partitionForArchive(
      snapshot(store.state),
    )
    if (!changed) return

    if (archived.length > 0) {
      const rows = archived.map((it) => ({
        id: it.id,
        user_id: uid,
        list_id: it.listId,
        idx: it.index,
        label: it.label,
        done: it.done,
        fixed: it.fixed,
        completed_at: it.completedAt ?? null,
      }))
      const { error } = await supabase.from(ARCHIVE_TABLE).upsert(rows)
      if (error) {
        console.warn('[archive] insert failed; keeping items in the doc', error.message)
        return
      }
    }

    // Apply the trimmed (+ backfilled) doc. This is a genuine local change, so
    // the store watcher persists it to cache + cloud via the normal push path.
    store.setData(trimmed)
  }

  function schedulePush(uid: string): void {
    // Cache immediately (offline-safe); debounce the network push.
    const ts = Date.now()
    currentTs = ts
    writeCache(uid, snapshot(store.state), ts)
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(() => push(uid), PUSH_DEBOUNCE)
  }

  function subscribe(uid: string): void {
    if (!supabase) return
    channel = supabase
      .channel('todo_docs_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TODO_TABLE, filter: `user_id=eq.${uid}` },
        (payload) => {
          const newRow = payload.new as { data: TodoData; updated_at: string } | null
          if (!newRow) return
          const remoteTs = new Date(newRow.updated_at).getTime()
          // Strictly newer → another device changed it; apply.
          if (remoteTs > currentTs) {
            applyRemote(newRow.data, remoteTs)
            writeCache(uid, newRow.data, remoteTs)
            lastSyncedAt.value = remoteTs
          }
        },
      )
      .subscribe()
  }

  function teardown(): void {
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = undefined
    if (channel && supabase) {
      supabase.removeChannel(channel)
      channel = null
    }
  }

  // Auth transitions: hydrate on login; clear everything on logout.
  watch(
    user,
    (u, prev) => {
      teardown()
      if (u) {
        hydrate(u.id)
      } else {
        if (prev) clearCache(prev.id)
        applyRemote(initTodoData(), 0)
        currentTs = 0
        lastSyncedAt.value = null
        status.value = 'offline'
      }
    },
    { immediate: true },
  )

  // Local edits → cache + debounced push (unless the change came from sync).
  watch(
    () => store.state,
    () => {
      if (applyingRemote) return
      if (!user.value) return
      schedulePush(user.value.id)
    },
    { deep: true },
  )
}

export function useSync(): { status: Ref<SyncStatus>; lastSyncedAt: Ref<number | null> } {
  init()
  return { status, lastSyncedAt }
}

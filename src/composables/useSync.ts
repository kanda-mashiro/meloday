import { ref, watch, type Ref } from 'vue'
import type { TodoData, TodoItem, CustomList } from '../types/todo'
import { initTodoData, movePastTodoItems } from '../lib/todoLogic'
import { supabase, ITEMS_TABLE, LISTS_TABLE } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useTodoStore } from './useTodoStore'

export type SyncStatus = 'offline' | 'idle' | 'syncing' | 'error'

const status: Ref<SyncStatus> = ref('offline')
const lastSyncedAt: Ref<number | null> = ref(null)

const CACHE_PREFIX = 'my-todo:'
const PUSH_DEBOUNCE = 800

// --- Row shapes (snake_case, as stored) ------------------------------------
interface ItemRow {
  id: string
  user_id: string
  list_id: string
  idx: number
  label: string
  done: boolean
  fixed: boolean
  completed_at: string | null
  deleted_at: string | null
  updated_at: string
}
interface ListRow {
  id: string
  user_id: string
  idx: number
  title: string
  deleted_at: string | null
  updated_at: string
}

// Per-id sync bookkeeping: the last-synced JSON snapshot + its updated_at (ms),
// and whether it's a tombstone. Lets us diff local edits and dedupe our own
// realtime echoes.
interface Shadow {
  snap: string | null
  ts: number
  deleted: boolean
}

interface CacheMeta {
  ts: number
  deleted: boolean
}
interface CacheEntry {
  data: TodoData
  itemMeta: Record<string, CacheMeta>
  listMeta: Record<string, CacheMeta>
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
function clearCache(uid: string): void {
  try {
    localStorage.removeItem(cacheKey(uid))
  } catch {
    // ignore
  }
}

function ms(iso2: string): number {
  return new Date(iso2).getTime()
}
function iso(t: number): string {
  return new Date(t).toISOString()
}

// --- Mappers ---------------------------------------------------------------
function rowToItem(r: ItemRow): TodoItem {
  return {
    id: r.id,
    listId: r.list_id,
    index: r.idx,
    label: r.label,
    done: r.done,
    completedAt: r.completed_at ?? undefined,
    fixed: r.fixed,
  }
}
function itemToRow(it: TodoItem, uid: string, ts: number, deleted: boolean): ItemRow {
  return {
    id: it.id,
    user_id: uid,
    list_id: it.listId,
    idx: it.index,
    label: it.label,
    done: it.done,
    fixed: it.fixed,
    completed_at: it.completedAt ?? null,
    deleted_at: deleted ? iso(ts) : null,
    updated_at: iso(ts),
  }
}
function rowToList(r: ListRow): CustomList {
  return { id: r.id, index: r.idx, title: r.title }
}
function listToRow(l: CustomList, uid: string, ts: number, deleted: boolean): ListRow {
  return {
    id: l.id,
    user_id: uid,
    idx: l.index,
    title: l.title,
    deleted_at: deleted ? iso(ts) : null,
    updated_at: iso(ts),
  }
}

let initialized = false

function init(): void {
  if (initialized) return
  initialized = true
  if (!supabase) return

  const sb = supabase
  const store = useTodoStore()
  const { user } = useAuth()

  let applyingRemote = false
  let pushTimer: ReturnType<typeof setTimeout> | undefined
  let channel: ReturnType<typeof sb.channel> | null = null

  // Per-id shadow of what the cloud last knew, for diffing + echo dedupe.
  const shItems = new Map<string, Shadow>()
  const shLists = new Map<string, Shadow>()
  // View state persisted locally but never synced (each device has its own).
  let viewAt = ''
  let viewCustomAt = 0

  function applyData(data: TodoData): void {
    applyingRemote = true
    store.setData(data)
    applyingRemote = false
  }

  function writeCache(uid: string): void {
    try {
      const itemMeta: Record<string, CacheMeta> = {}
      for (const [id, s] of shItems) itemMeta[id] = { ts: s.ts, deleted: s.deleted }
      const listMeta: Record<string, CacheMeta> = {}
      for (const [id, s] of shLists) listMeta[id] = { ts: s.ts, deleted: s.deleted }
      const entry: CacheEntry = {
        data: JSON.parse(JSON.stringify(store.state)) as TodoData,
        itemMeta,
        listMeta,
        ts: Date.now(),
      }
      localStorage.setItem(cacheKey(uid), JSON.stringify(entry))
    } catch {
      // ignore quota / private mode
    }
  }

  // --- merge cloud rows with the local cache (per-id LWW) -------------------
  function mergeItems(
    rows: ItemRow[],
    cache: CacheEntry | null,
  ): { items: TodoItem[]; needsPush: Set<string> } {
    const cloud = new Map<string, ItemRow>()
    for (const r of rows) {
      const ex = cloud.get(r.id)
      if (!ex || ms(r.updated_at) > ms(ex.updated_at)) cloud.set(r.id, r)
    }
    const cacheItems = new Map<string, TodoItem>()
    for (const it of cache?.data.items ?? []) cacheItems.set(it.id, it)
    const meta = cache?.itemMeta ?? {}

    const items: TodoItem[] = []
    const needsPush = new Set<string>()
    const ids = new Set<string>([...cloud.keys(), ...cacheItems.keys()])
    for (const id of ids) {
      const cRow = cloud.get(id)
      const cTs = cRow ? ms(cRow.updated_at) : -1
      const lTs = meta[id]?.ts ?? -1
      const lDeleted = meta[id]?.deleted ?? false
      if (lTs > cTs) {
        if (lDeleted || !cacheItems.has(id)) {
          shItems.set(id, { snap: null, ts: lTs, deleted: true })
          needsPush.add(id)
        } else {
          const it = cacheItems.get(id) as TodoItem
          items.push(it)
          shItems.set(id, { snap: JSON.stringify(it), ts: lTs, deleted: false })
          needsPush.add(id)
        }
      } else if (cRow) {
        if (cRow.deleted_at) {
          shItems.set(id, { snap: null, ts: cTs, deleted: true })
        } else {
          const it = rowToItem(cRow)
          items.push(it)
          shItems.set(id, { snap: JSON.stringify(it), ts: cTs, deleted: false })
        }
      }
    }
    return { items, needsPush }
  }

  function mergeLists(
    rows: ListRow[],
    cache: CacheEntry | null,
  ): { lists: CustomList[]; needsPush: Set<string> } {
    const cloud = new Map<string, ListRow>()
    for (const r of rows) {
      const ex = cloud.get(r.id)
      if (!ex || ms(r.updated_at) > ms(ex.updated_at)) cloud.set(r.id, r)
    }
    const cacheLists = new Map<string, CustomList>()
    for (const l of cache?.data.customLists ?? []) cacheLists.set(l.id, l)
    const meta = cache?.listMeta ?? {}

    const lists: CustomList[] = []
    const needsPush = new Set<string>()
    const ids = new Set<string>([...cloud.keys(), ...cacheLists.keys()])
    for (const id of ids) {
      const cRow = cloud.get(id)
      const cTs = cRow ? ms(cRow.updated_at) : -1
      const lTs = meta[id]?.ts ?? -1
      const lDeleted = meta[id]?.deleted ?? false
      if (lTs > cTs) {
        if (lDeleted || !cacheLists.has(id)) {
          shLists.set(id, { snap: null, ts: lTs, deleted: true })
          needsPush.add(id)
        } else {
          const l = cacheLists.get(id) as CustomList
          lists.push(l)
          shLists.set(id, { snap: JSON.stringify(l), ts: lTs, deleted: false })
          needsPush.add(id)
        }
      } else if (cRow) {
        if (cRow.deleted_at) {
          shLists.set(id, { snap: null, ts: cTs, deleted: true })
        } else {
          const l = rowToList(cRow)
          lists.push(l)
          shLists.set(id, { snap: JSON.stringify(l), ts: cTs, deleted: false })
        }
      }
    }
    return { lists, needsPush }
  }

  async function hydrate(uid: string): Promise<void> {
    status.value = 'syncing'
    const cache = readCache(uid)
    if (cache) {
      viewAt = cache.data.at
      viewCustomAt = cache.data.customAt
      applyData(cache.data) // instant paint
    }

    // Fresh device → live rows only. Returning device → live rows + anything
    // changed since our last sync (recent tombstones included) so deletes land.
    const itemSel = sb.from(ITEMS_TABLE).select('*').eq('user_id', uid)
    const listSel = sb.from(LISTS_TABLE).select('*').eq('user_id', uid)
    if (cache) {
      const since = iso(cache.ts)
      void itemSel.or(`deleted_at.is.null,updated_at.gt.${since}`)
      void listSel.or(`deleted_at.is.null,updated_at.gt.${since}`)
    } else {
      void itemSel.is('deleted_at', null)
      void listSel.is('deleted_at', null)
    }
    const [itemsRes, listsRes] = await Promise.all([itemSel, listSel])
    if (itemsRes.error || listsRes.error) {
      status.value = 'error'
      console.warn('[sync] load failed', itemsRes.error?.message ?? listsRes.error?.message)
      return
    }

    const { items, needsPush: pushI } = mergeItems((itemsRes.data as ItemRow[]) ?? [], cache)
    const { lists, needsPush: pushL } = mergeLists((listsRes.data as ListRow[]) ?? [], cache)

    let data: TodoData = {
      items,
      customLists: lists,
      at: viewAt || initTodoData().at,
      customAt: viewCustomAt,
    }
    // Roll unfinished past-day items forward (changes list_ids → diffed & pushed).
    data = movePastTodoItems(data)
    viewAt = data.at
    applyData(data)

    // Force local-newer rows through the next diff (their cloud copy is stale).
    for (const id of pushI) {
      const s = shItems.get(id)
      if (s) s.snap = ' '
    }
    for (const id of pushL) {
      const s = shLists.get(id)
      if (s) s.snap = ' '
    }

    subscribe(uid)
    await flushPush(uid)
    writeCache(uid)
    lastSyncedAt.value = Date.now()
    status.value = 'idle'
  }

  // --- diff local state vs shadow → upsert / tombstone ---------------------
  async function flushPush(uid: string): Promise<void> {
    const itemUpserts: ItemRow[] = []
    const seenItems = new Set<string>()
    for (const it of store.state.items) {
      seenItems.add(it.id)
      const snap = JSON.stringify(it)
      const prev = shItems.get(it.id)
      if (!prev || prev.snap !== snap || prev.deleted) {
        const ts = Date.now()
        itemUpserts.push(itemToRow(it, uid, ts, false))
        shItems.set(it.id, { snap, ts, deleted: false })
      }
    }
    for (const [id, s] of shItems) {
      if (!s.deleted && !seenItems.has(id)) {
        const ts = Date.now()
        itemUpserts.push({
          id,
          user_id: uid,
          list_id: '',
          idx: 0,
          label: '',
          done: false,
          fixed: false,
          completed_at: null,
          deleted_at: iso(ts),
          updated_at: iso(ts),
        })
        s.snap = null
        s.ts = ts
        s.deleted = true
      }
    }

    const listUpserts: ListRow[] = []
    const seenLists = new Set<string>()
    for (const l of store.state.customLists) {
      seenLists.add(l.id)
      const snap = JSON.stringify(l)
      const prev = shLists.get(l.id)
      if (!prev || prev.snap !== snap || prev.deleted) {
        const ts = Date.now()
        listUpserts.push(listToRow(l, uid, ts, false))
        shLists.set(l.id, { snap, ts, deleted: false })
      }
    }
    for (const [id, s] of shLists) {
      if (!s.deleted && !seenLists.has(id)) {
        const ts = Date.now()
        listUpserts.push({ id, user_id: uid, idx: 0, title: '', deleted_at: iso(ts), updated_at: iso(ts) })
        s.snap = null
        s.ts = ts
        s.deleted = true
      }
    }

    if (itemUpserts.length === 0 && listUpserts.length === 0) return
    status.value = 'syncing'
    const ops: PromiseLike<{ error: unknown }>[] = []
    if (itemUpserts.length) ops.push(sb.from(ITEMS_TABLE).upsert(itemUpserts))
    if (listUpserts.length) ops.push(sb.from(LISTS_TABLE).upsert(listUpserts))
    const results = await Promise.all(ops)
    const failed = results.find((r) => r.error)
    if (failed) {
      status.value = 'error'
      console.warn('[sync] push failed', failed.error)
      return
    }
    lastSyncedAt.value = Date.now()
    status.value = 'idle'
  }

  function schedulePush(uid: string): void {
    writeCache(uid)
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(() => void flushPush(uid), PUSH_DEBOUNCE)
  }

  // --- realtime: apply a single changed row --------------------------------
  function applyItemRow(uid: string, r: ItemRow): void {
    const ts = ms(r.updated_at)
    const prev = shItems.get(r.id)
    if (prev && ts <= prev.ts) return // not newer (or our own echo)
    applyingRemote = true
    const arr = store.state.items
    const at = arr.findIndex((x) => x.id === r.id)
    if (r.deleted_at) {
      if (at !== -1) arr.splice(at, 1)
      shItems.set(r.id, { snap: null, ts, deleted: true })
    } else {
      const it = rowToItem(r)
      if (at !== -1) arr.splice(at, 1, it)
      else arr.push(it)
      shItems.set(r.id, { snap: JSON.stringify(it), ts, deleted: false })
    }
    applyingRemote = false
    writeCache(uid)
  }

  function applyListRow(uid: string, r: ListRow): void {
    const ts = ms(r.updated_at)
    const prev = shLists.get(r.id)
    if (prev && ts <= prev.ts) return
    applyingRemote = true
    const arr = store.state.customLists
    const at = arr.findIndex((x) => x.id === r.id)
    if (r.deleted_at) {
      if (at !== -1) arr.splice(at, 1)
      shLists.set(r.id, { snap: null, ts, deleted: true })
    } else {
      const l = rowToList(r)
      if (at !== -1) arr.splice(at, 1, l)
      else arr.push(l)
      shLists.set(r.id, { snap: JSON.stringify(l), ts, deleted: false })
    }
    applyingRemote = false
    writeCache(uid)
  }

  function subscribe(uid: string): void {
    channel = sb
      .channel('todo_rows')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: ITEMS_TABLE, filter: `user_id=eq.${uid}` },
        (payload) => {
          const r = payload.new as ItemRow | null
          if (r && r.id) applyItemRow(uid, r)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: LISTS_TABLE, filter: `user_id=eq.${uid}` },
        (payload) => {
          const r = payload.new as ListRow | null
          if (r && r.id) applyListRow(uid, r)
        },
      )
      .subscribe()
  }

  function teardown(): void {
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = undefined
    if (channel) {
      void sb.removeChannel(channel)
      channel = null
    }
    shItems.clear()
    shLists.clear()
  }

  // Auth transitions.
  watch(
    user,
    (u, prev) => {
      teardown()
      if (u) {
        void hydrate(u.id)
      } else {
        if (prev) clearCache(prev.id)
        applyData(initTodoData())
        viewAt = ''
        viewCustomAt = 0
        lastSyncedAt.value = null
        status.value = 'offline'
      }
    },
    { immediate: true },
  )

  // Local edits → cache + debounced per-row push (ignore sync-applied changes
  // and view-only at/customAt changes, which never sync).
  watch(
    () => [store.state.items, store.state.customLists],
    () => {
      if (applyingRemote || !user.value) return
      schedulePush(user.value.id)
    },
    { deep: true },
  )
}

export function useSync(): { status: Ref<SyncStatus>; lastSyncedAt: Ref<number | null> } {
  init()
  return { status, lastSyncedAt }
}

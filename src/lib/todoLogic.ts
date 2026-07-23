import type {
  TodoItem,
  CustomList,
  TodoData,
  DayList,
  ResolvedTodoItem,
  ResolvedCustomList,
  TodoQueue,
} from '../types/todo'
import { uuid } from './uuid'
import { formatDateId } from './date'
import { topPriority, priorityLevel } from './tags'
import { getTime } from './time'
import { daysUntil } from './due'

/** Matches a day-list id of the form "YYYY-MM-DD". */
const DAY_ID_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Reassign contiguous 0..n-1 indexes by current array order. */
export function setIndexes<T extends { index: number }>(arr: T[]): T[] {
  return arr.map((entry, index) => ({ ...entry, index }))
}

/** Sort a shallow copy ascending by index. */
function sortByIndex<T extends { index: number }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => a.index - b.index)
}

function queueRootForItem(data: TodoData, item: TodoItem): TodoItem {
  if (!item.queueRootId) return item
  return data.items.find((candidate) => candidate.id === item.queueRootId) ?? item
}

function queueMembersForRoot(data: TodoData, root: TodoItem): TodoItem[] {
  const followers = data.items
    .filter((item) => item.queueRootId === root.id)
    .sort(
      (a, b) =>
        (a.queueIndex ?? Number.MAX_SAFE_INTEGER) -
          (b.queueIndex ?? Number.MAX_SAFE_INTEGER) ||
        a.index - b.index,
    )
  return [root, ...followers]
}

function rootsForList(data: TodoData, listId: string): TodoItem[] {
  return sortByIndex(
    data.items.filter((item) => {
      if (item.listId !== listId) return false
      if (!item.queueRootId) return true
      // A missing root should not make the task disappear forever. Treat an
      // orphaned follower as a standalone row until sync repairs the chain.
      return !data.items.some((candidate) => candidate.id === item.queueRootId)
    }),
  )
}

export function getTodoQueue(data: TodoData, itemId: string): TodoQueue | null {
  const item = data.items.find((candidate) => candidate.id === itemId)
  if (!item) return null
  const root = queueRootForItem(data, item)
  const items = queueMembersForRoot(data, root)
  const current = items.find((candidate) => !candidate.done) ?? root
  return {
    rootId: root.id,
    items,
    current,
    completed: items.filter((candidate) => candidate.done).length,
    total: items.length,
  }
}

/** Add `delta` days to a date and return a new Date. */
function addDays(date: Date, delta: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + delta)
  return next
}

/** Parse a "YYYY-MM-DD" id into a local Date at midnight. */
function parseDateId(id: string): Date {
  const [year, month, day] = id.split('-').map((n) => Number(n))
  return new Date(year, month - 1, day)
}

export function initTodoData(now: Date = new Date()): TodoData {
  return {
    items: [],
    customLists: [],
    at: formatDateId(now),
    customAt: 0,
  }
}

/**
 * True when `listId` is a day-list id strictly before today's id.
 * Custom-list ids (uuids) never match the pattern and are never "past".
 */
export function isListInThePast(listId: string, now: Date = new Date()): boolean {
  if (!DAY_ID_PATTERN.test(listId)) return false
  return listId < formatDateId(now)
}

export function itemsForList(data: TodoData, listId: string): ResolvedTodoItem[] {
  return rootsForList(data, listId).map((root) => {
    const queue = getTodoQueue(data, root.id)
    const current = queue?.current ?? root
    return {
      ...current,
      // The root owns board placement. Keeping a stable anchor lets Vue retain
      // the same row/component when completing one step reveals the next.
      anchorId: root.id,
      listId: root.listId,
      index: root.index,
      fixed: root.fixed,
    }
  })
}

/**
 * Build a window of (2*range) day lists centered on `data.at`, ascending,
 * each with its resolved+sorted items, isToday and isPast flags.
 */
export function getDayLists(
  data: TodoData,
  range: number,
  now: Date = new Date()
): DayList[] {
  const todayId = formatDateId(now)
  const center = parseDateId(data.at)
  const lists: DayList[] = []

  for (let offset = -range; offset < range; offset++) {
    const date = addDays(center, offset)
    const id = formatDateId(date)
    lists.push({
      id,
      date,
      items: itemsForList(data, id),
      isToday: id === todayId,
      isPast: id < todayId,
    })
  }

  return lists
}

export function getCustomTodoLists(data: TodoData): ResolvedCustomList[] {
  return sortByIndex(data.customLists).map((list) => ({
    ...list,
    items: itemsForList(data, list.id),
  }))
}

export function addTodoItem(
  data: TodoData,
  input: { listId: string; tags: string[]; text: string; due?: string },
  now: Date = new Date()
): TodoData {
  const existing = rootsForList(data, input.listId)
  const maxIndex = existing.reduce((max, item) => Math.max(max, item.index), -1)

  const newItem: TodoItem = {
    id: uuid(),
    listId: input.listId,
    index: maxIndex + 1,
    tags: input.tags ?? [],
    text: input.text ?? '',
    done: false,
    fixed: isListInThePast(input.listId, now),
    // Carry the optional inline deadline through; omitted when absent.
    ...(input.due ? { due: input.due } : {}),
  }

  return {
    ...data,
    items: [...data.items, newItem],
  }
}

export function addFollowUpTodoItem(
  data: TodoData,
  input: { afterId: string; tags: string[]; text: string; due?: string },
  now: Date = new Date(),
): TodoData {
  const after = data.items.find((item) => item.id === input.afterId)
  if (!after) return data
  const root = queueRootForItem(data, after)
  const members = queueMembersForRoot(data, root)
  const maxQueueIndex = members.reduce(
    (max, item) => Math.max(max, item.queueIndex ?? 0),
    0,
  )

  const newItem: TodoItem = {
    id: uuid(),
    listId: root.listId,
    index: root.index,
    tags: input.tags ?? [],
    text: input.text ?? '',
    done: false,
    fixed: isListInThePast(root.listId, now),
    queueRootId: root.id,
    queueIndex: maxQueueIndex + 1,
    ...(input.due ? { due: input.due } : {}),
  }

  return {
    ...data,
    items: [...data.items, newItem],
  }
}

export function checkTodoItem(
  data: TodoData,
  input: { id: string; done: boolean },
  now: Date = new Date()
): TodoData {
  return {
    ...data,
    items: data.items.map((item) =>
      item.id === input.id
        ? {
            ...item,
            done: input.done,
            // Stamp completion time so it can age into the archive; clear it
            // when un-done so it never archives while active.
            completedAt: input.done ? now.toISOString() : undefined,
          }
        : item
    ),
  }
}

export function editTodoItem(
  data: TodoData,
  input: { id: string; tags: string[]; text: string; due?: string }
): TodoData {
  return {
    ...data,
    items: data.items.map((item) => {
      if (item.id !== input.id) return item
      const next: TodoItem = { ...item, tags: input.tags, text: input.text }
      // A provided due sets the deadline; undefined clears it.
      if (input.due) next.due = input.due
      else delete next.due
      return next
    }),
  }
}

export function moveTodoItem(
  data: TodoData,
  input: { id: string; listId: string; index: number },
  now: Date = new Date()
): TodoData {
  const moving = data.items.find((item) => item.id === input.id)
  if (!moving) return data
  const movingRoot = queueRootForItem(data, moving)
  const sourceListId = movingRoot.listId

  const targetRoots = rootsForList(data, input.listId).filter(
    (root) => root.id !== movingRoot.id,
  )
  const clamped = Math.max(0, Math.min(input.index, targetRoots.length))
  targetRoots.splice(clamped, 0, movingRoot)

  const placements = new Map<
    string,
    { listId: string; index: number; fixed: boolean }
  >()
  targetRoots.forEach((root, index) => {
    placements.set(root.id, {
      listId: input.listId,
      index,
      fixed:
        root.id === movingRoot.id
          ? isListInThePast(input.listId, now)
          : root.fixed,
    })
  })

  if (sourceListId !== input.listId) {
    rootsForList(data, sourceListId)
      .filter((root) => root.id !== movingRoot.id)
      .forEach((root, index) => {
        placements.set(root.id, {
          listId: sourceListId,
          index,
          fixed: root.fixed,
        })
      })
  }

  return {
    ...data,
    items: data.items.map((item) => {
      const root = queueRootForItem(data, item)
      const placement = placements.get(root.id)
      if (!placement) return item
      return {
        ...item,
        listId: placement.listId,
        index: placement.index,
        fixed: placement.fixed,
      }
    }),
  }
}

export function deleteTodoItem(
  data: TodoData,
  input: { id: string }
): TodoData {
  const removed = data.items.find((item) => item.id === input.id)
  if (!removed) return data

  // Removing a follower keeps the root and compacts the remaining queue order.
  if (removed.queueRootId) {
    const followers = data.items
      .filter(
        (item) =>
          item.queueRootId === removed.queueRootId && item.id !== removed.id,
      )
      .sort((a, b) => (a.queueIndex ?? 0) - (b.queueIndex ?? 0))
    const queueIndex = new Map(
      followers.map((item, index) => [item.id, index + 1]),
    )
    return {
      ...data,
      items: data.items
        .filter((item) => item.id !== removed.id)
        .map((item) => {
          const index = queueIndex.get(item.id)
          return index === undefined ? item : { ...item, queueIndex: index }
        }),
    }
  }

  const followers = data.items
    .filter((item) => item.queueRootId === removed.id)
    .sort((a, b) => (a.queueIndex ?? 0) - (b.queueIndex ?? 0))

  // Deleting a root step promotes its first follower so the rest of the queue
  // survives in the same board slot instead of being orphaned or disappearing.
  if (followers.length > 0) {
    const promoted = followers[0]
    const remainingFollowers = followers.slice(1)
    const queueIndex = new Map(
      remainingFollowers.map((item, index) => [item.id, index + 1]),
    )
    return {
      ...data,
      items: data.items
        .filter((item) => item.id !== removed.id)
        .map((item) => {
          if (item.id === promoted.id) {
            const next: TodoItem = {
              ...item,
              listId: removed.listId,
              index: removed.index,
              fixed: removed.fixed,
            }
            delete next.queueRootId
            delete next.queueIndex
            return next
          }
          if (item.queueRootId !== removed.id) return item
          return {
            ...item,
            queueRootId: promoted.id,
            queueIndex: queueIndex.get(item.id) ?? item.queueIndex,
            listId: removed.listId,
            index: removed.index,
            fixed: removed.fixed,
          }
        }),
    }
  }

  const remaining = data.items.filter((item) => item.id !== removed.id)
  const roots = rootsForList({ ...data, items: remaining }, removed.listId)
  const rootIndexes = new Map(roots.map((root, index) => [root.id, index]))
  return {
    ...data,
    items: remaining.map((item) => {
      const root = queueRootForItem({ ...data, items: remaining }, item)
      const index = rootIndexes.get(root.id)
      return index === undefined ? item : { ...item, index }
    }),
  }
}

export function deleteTodoQueue(
  data: TodoData,
  input: { id: string },
): TodoData {
  const item = data.items.find((candidate) => candidate.id === input.id)
  if (!item) return data
  const root = queueRootForItem(data, item)
  const queueIds = new Set(queueMembersForRoot(data, root).map((member) => member.id))
  const remaining = data.items.filter((candidate) => !queueIds.has(candidate.id))
  const nextData = { ...data, items: remaining }
  const roots = rootsForList(nextData, root.listId)
  const rootIndexes = new Map(roots.map((candidate, index) => [candidate.id, index]))
  return {
    ...nextData,
    items: remaining.map((candidate) => {
      const candidateRoot = queueRootForItem(nextData, candidate)
      const index = rootIndexes.get(candidateRoot.id)
      return index === undefined ? candidate : { ...candidate, index }
    }),
  }
}

/**
 * The first tag whose `priorityLevel` is null — i.e. the item's primary CONTENT
 * tag, ignoring priority tags (p0/p1/p2). '' when it has none. This is what
 * groups items, so a "p0 #for me" item lives in the #for me group rather than a
 * phantom "p0" group, and a bare "p0 test" item has no content group.
 */
function contentPrimaryTag(tags: string[]): string {
  for (const tag of tags) {
    if (priorityLevel(tag) === null) return tag.toLowerCase()
  }
  return ''
}

/**
 * One-shot "整理": re-sort a single list's items to de-clutter them and rewrite
 * their `index` to 0..n-1. Pure — other lists are untouched, and the result is
 * just a fresh manual order, so the user can still drag to reorder afterwards.
 *
 * ALL items are sorted by a single stable comparator, by precedence:
 *   0. done — not-done items first, the whole completed block sinks below,
 *   1. priority (p0 > p1 > p2 > none) — urgent work floats to the very top,
 *   2. content primary tag grouped by ORDER OF FIRST APPEARANCE among ALL
 *      items, so groups settle without jumping around (untagged is a group too),
 *   3. earliest time first (timed items lead, untimed sink),
 *   4. original index, to keep the sort stable for otherwise-equal items.
 * The same priority → tag → time grouping applies within both the active and
 * completed sections; done just sits below not-done as a whole.
 */
export function sortListItems(
  data: TodoData,
  listId: string,
  now: Date = new Date()
): TodoData {
  // Current order is the stable tie-breaker for items within the same group.
  const current = itemsForList(data, listId)

  // Group order is a FIXED alphabetical (pinyin for CJK) order of the content
  // tags, independent of how the list is currently arranged — so dragging one
  // item never reshuffles whole groups. Untagged ('') sorts after all groups.
  const tagNames = [...new Set(current.map((item) => contentPrimaryTag(item.tags)))]
  tagNames.sort((a, b) =>
    a === b ? 0 : a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'zh'),
  )
  const tagRankByName = new Map(tagNames.map((name, i) => [name, i]))

  // Priority → rank; 'none' sorts after p2.
  const prioRank = (tags: string[]): number => {
    const top = topPriority(tags)
    return top === null ? 3 : Number(top.slice(1))
  }

  const keyed = current.map((item, originalIndex) => {
    const time = getTime(item.text)
    return {
      item,
      originalIndex,
      prioRank: prioRank(item.tags),
      tagRank: tagRankByName.get(contentPrimaryTag(item.tags)) ?? 0,
      // Whole days until the deadline; no deadline sinks to the bottom.
      dueDays: item.due ? daysUntil(item.due, now) : Infinity,
      time: time ? time.start : Infinity,
    }
  })

  keyed.sort(
    (a, b) =>
      (a.item.done ? 1 : 0) - (b.item.done ? 1 : 0) ||
      a.prioRank - b.prioRank ||
      a.tagRank - b.tagRank ||
      // Time-of-day first (no-time items, Infinity, fall through via ||).
      a.time - b.time ||
      // Then sooner deadline; equal/both-Infinity yields 0 to avoid NaN.
      (a.dueDays === b.dueDays ? 0 : a.dueDays - b.dueDays) ||
      a.originalIndex - b.originalIndex,
  )

  const rootIndexes = new Map(
    keyed.map((entry, index) => [entry.item.anchorId, index]),
  )

  return {
    ...data,
    items: data.items.map((item) => {
      const root = queueRootForItem(data, item)
      const index = rootIndexes.get(root.id)
      return index === undefined ? item : { ...item, index }
    }),
  }
}

/**
 * Roll unfinished, non-fixed items from past day lists into today's list,
 * appended in stable order after any existing today items.
 */
export function movePastTodoItems(
  data: TodoData,
  now: Date = new Date()
): TodoData {
  const todayId = formatDateId(now)

  const roots = data.items.filter(
    (item) => queueRootForItem(data, item).id === item.id,
  )
  const toMove = sortByIndex(
    roots.filter((root) => {
      const queue = getTodoQueue(data, root.id)
      return (
        isListInThePast(root.listId, now) &&
        queue?.current.done === false &&
        !root.fixed
      )
    }),
  )
  if (toMove.length === 0) return data

  const movingRootIds = new Set(toMove.map((root) => root.id))
  const todayRoots = rootsForList(data, todayId).filter(
    (root) => !movingRootIds.has(root.id),
  )
  const todayOrder = new Map(
    [...todayRoots, ...toMove].map((root, index) => [root.id, index]),
  )

  return {
    ...data,
    items: data.items.map((item) => {
      const root = queueRootForItem(data, item)
      const index = todayOrder.get(root.id)
      if (index === undefined) return item
      return {
        ...item,
        listId: todayId,
        index,
        fixed: false,
      }
    }),
  }
}

/** Completed items whose completion is older than this are eligible to archive. */
export const ARCHIVE_AFTER_DAYS = 60

/**
 * Partition completed items older than `afterDays` out of the active document,
 * so the hot blob stays bounded. Pure: returns the trimmed data, the items to
 * archive, and whether anything changed.
 *
 * Safety rules baked in:
 * - Incomplete items are never archived, at any age (they roll forward instead).
 * - Legacy completed items with no `completedAt` are stamped with `now` so they
 *   begin aging from today rather than disappearing on the first sweep.
 *
 * The caller MUST persist `archived` to durable storage before dropping them
 * (i.e. before applying the returned `data`), so a failed write never loses an
 * item.
 */
export function partitionForArchive(
  data: TodoData,
  now: Date = new Date(),
  afterDays: number = ARCHIVE_AFTER_DAYS
): { data: TodoData; archived: TodoItem[]; changed: boolean } {
  const cutoffMs = addDays(now, -afterDays).getTime()
  const nowIso = now.toISOString()
  const archived: TodoItem[] = []
  const kept: TodoItem[] = []
  let changed = false

  const normalizedItems = data.items.map((item) => {
    if (!item.done || item.completedAt) return item
    changed = true
    return { ...item, completedAt: nowIso }
  })
  const normalizedData = { ...data, items: normalizedItems }
  const groups = new Map<string, TodoItem[]>()
  for (const item of normalizedItems) {
    const root = queueRootForItem(normalizedData, item)
    const group = groups.get(root.id) ?? []
    group.push(item)
    groups.set(root.id, group)
  }

  for (const group of groups.values()) {
    // Queue members archive together. Keeping the root while any follower is
    // active prevents old completed heads from leaving orphaned live steps.
    const eligible = group.every(
      (item) =>
        item.done &&
        new Date(item.completedAt as string).getTime() <= cutoffMs,
    )
    if (eligible) {
      archived.push(...group)
      changed = true
    } else {
      kept.push(...group)
    }
  }

  if (!changed) return { data, archived: [], changed: false }
  return { data: { ...data, items: kept }, archived, changed: true }
}

export function addCustomTodoList(data: TodoData): TodoData {
  const maxIndex = data.customLists.reduce(
    (max, list) => Math.max(max, list.index),
    -1
  )

  const newList: CustomList = {
    id: uuid(),
    index: maxIndex + 1,
    title: '',
  }

  return {
    ...data,
    customLists: [...data.customLists, newList],
  }
}

export function editCustomTodoList(
  data: TodoData,
  input: { id: string; title: string }
): TodoData {
  return {
    ...data,
    customLists: data.customLists.map((list) =>
      list.id === input.id ? { ...list, title: input.title } : list
    ),
  }
}

export function moveCustomTodoList(
  data: TodoData,
  input: { id: string; index: number }
): TodoData {
  const moving = data.customLists.find((list) => list.id === input.id)
  if (!moving) return data

  const rest = sortByIndex(
    data.customLists.filter((list) => list.id !== input.id)
  )

  const clamped = Math.max(0, Math.min(input.index, rest.length))
  rest.splice(clamped, 0, moving)

  return {
    ...data,
    customLists: setIndexes(rest),
  }
}

export function deleteCustomTodoList(
  data: TodoData,
  input: { id: string }
): TodoData {
  const remaining = sortByIndex(
    data.customLists.filter((list) => list.id !== input.id)
  )

  return {
    ...data,
    customLists: setIndexes(remaining),
    items: data.items.filter((item) => item.listId !== input.id),
  }
}

export function seekDays(data: TodoData, delta: number): TodoData {
  const next = addDays(parseDateId(data.at), delta)
  return {
    ...data,
    at: formatDateId(next),
  }
}

export function seekToToday(data: TodoData, now: Date = new Date()): TodoData {
  return {
    ...data,
    at: formatDateId(now),
  }
}

export function seekToDate(data: TodoData, date: Date): TodoData {
  return {
    ...data,
    at: formatDateId(date),
  }
}

export function seekCustomTodoLists(data: TodoData, delta: number): TodoData {
  const max = Math.max(0, data.customLists.length - 1)
  const next = Math.max(0, Math.min(data.customAt + delta, max))
  return {
    ...data,
    customAt: next,
  }
}

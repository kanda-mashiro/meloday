import type {
  TodoItem,
  CustomList,
  TodoData,
  DayList,
  ResolvedCustomList,
} from '../types/todo'
import { uuid } from './uuid'
import { formatDateId } from './date'
import { parseLabel, topPriority, priorityLevel } from './tags'
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

export function itemsForList(data: TodoData, listId: string): TodoItem[] {
  return sortByIndex(data.items.filter((item) => item.listId === listId))
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
  input: { listId: string; label: string; due?: string },
  now: Date = new Date()
): TodoData {
  const existing = data.items.filter((item) => item.listId === input.listId)
  const maxIndex = existing.reduce((max, item) => Math.max(max, item.index), -1)

  const newItem: TodoItem = {
    id: uuid(),
    listId: input.listId,
    index: maxIndex + 1,
    label: input.label,
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
  input: { id: string; label: string; due?: string }
): TodoData {
  return {
    ...data,
    items: data.items.map((item) => {
      if (item.id !== input.id) return item
      const next: TodoItem = { ...item, label: input.label }
      // The editor round-trips the deadline as a !date token, so the edited text
      // is the source of truth: set it, or drop it when the token is gone.
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

  // Everything that isn't the moving item and isn't in the target list.
  // The id guard matters for cross-list moves, where the moving item still
  // carries its old listId and would otherwise be duplicated.
  const others = data.items.filter(
    (item) => item.listId !== input.listId && item.id !== input.id
  )

  // Current target-list items (excluding the moving one), in order.
  const target = sortByIndex(
    data.items.filter(
      (item) => item.listId === input.listId && item.id !== input.id
    )
  )

  const updatedMoving: TodoItem = {
    ...moving,
    listId: input.listId,
    fixed: isListInThePast(input.listId, now),
  }

  const clamped = Math.max(0, Math.min(input.index, target.length))
  target.splice(clamped, 0, updatedMoving)

  const reindexedTarget = setIndexes(target)

  return {
    ...data,
    items: [...others, ...reindexedTarget],
  }
}

export function deleteTodoItem(
  data: TodoData,
  input: { id: string }
): TodoData {
  const removed = data.items.find((item) => item.id === input.id)
  if (!removed) return data

  const remaining = data.items.filter((item) => item.id !== input.id)

  // Reindex the affected list to keep index integrity.
  const affected = setIndexes(
    sortByIndex(remaining.filter((item) => item.listId === removed.listId))
  )
  const untouched = remaining.filter((item) => item.listId !== removed.listId)

  return {
    ...data,
    items: [...untouched, ...affected],
  }
}

/**
 * The first tag of a label whose `priorityLevel` is null — i.e. its primary
 * CONTENT tag, ignoring priority tags (p0/p1/p2). '' when it has none. This is
 * what groups items, so a "p0 #for me" item lives in the #for me group rather
 * than a phantom "p0" group, and a bare "p0 test" item has no content group.
 */
function contentPrimaryTag(label: string): string {
  for (const tag of parseLabel(label).tags) {
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
  const tagNames = [...new Set(current.map((item) => contentPrimaryTag(item.label)))]
  tagNames.sort((a, b) =>
    a === b ? 0 : a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'zh'),
  )
  const tagRankByName = new Map(tagNames.map((name, i) => [name, i]))

  // Priority → rank; 'none' sorts after p2.
  const prioRank = (label: string): number => {
    const top = topPriority(parseLabel(label).tags)
    return top === null ? 3 : Number(top.slice(1))
  }

  const keyed = current.map((item, originalIndex) => {
    const time = getTime(item.label)
    return {
      item,
      originalIndex,
      prioRank: prioRank(item.label),
      tagRank: tagRankByName.get(contentPrimaryTag(item.label)) ?? 0,
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

  const reindexed = setIndexes(keyed.map((k) => k.item))
  const untouched = data.items.filter((item) => item.listId !== listId)

  return {
    ...data,
    items: [...untouched, ...reindexed],
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

  const toMove = sortByIndex(
    data.items.filter(
      (item) =>
        isListInThePast(item.listId, now) && !item.done && !item.fixed
    )
  )
  if (toMove.length === 0) return data

  const untouched = data.items.filter((item) => !toMove.includes(item))

  const todayItems = sortByIndex(
    untouched.filter((item) => item.listId === todayId)
  )
  const rest = untouched.filter((item) => item.listId !== todayId)

  const merged = setIndexes([
    ...todayItems,
    ...toMove.map((item) => ({ ...item, listId: todayId, fixed: false })),
  ])

  return {
    ...data,
    items: [...rest, ...merged],
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

  for (const item of data.items) {
    if (!item.done) {
      kept.push(item)
      continue
    }
    // Backfill legacy completed items so they can age from "now".
    let normalized = item
    if (!item.completedAt) {
      normalized = { ...item, completedAt: nowIso }
      changed = true
    }
    if (new Date(normalized.completedAt as string).getTime() <= cutoffMs) {
      archived.push(normalized)
      changed = true
    } else {
      kept.push(normalized)
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

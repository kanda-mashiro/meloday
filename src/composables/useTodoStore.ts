import { reactive, computed, type ComputedRef } from 'vue'
import type {
  TodoData,
  TodoItem,
  DayList,
  ResolvedCustomList,
  TodoQueue,
} from '../types/todo'
import {
  initTodoData,
  getDayLists,
  itemsForList,
  getTodoQueue,
  addTodoItem,
  addTodoSubtask,
  checkTodoItem,
  editTodoItem,
  moveTodoItem,
  deleteTodoItem,
  deleteTodoSubtasks,
  sortListItems,
  movePastTodoItems,
  getCustomTodoLists,
  addCustomTodoList,
  editCustomTodoList,
  moveCustomTodoList,
  deleteCustomTodoList,
  seekDays as seekDaysLogic,
  seekToToday as seekToTodayLogic,
  seekToDate as seekToDateLogic,
  seekCustomTodoLists,
} from '../lib/todoLogic'
import { INBOX_LIST_ID } from '../lib/constants'

const RANGE = 14

export interface TodoStore {
  state: TodoData
  days: ComputedRef<DayList[]>
  customLists: ComputedRef<ResolvedCustomList[]>
  inboxItems: ComputedRef<TodoItem[]>
  itemsFor(listId: string): TodoItem[]
  queueFor(itemId: string): TodoQueue | null
  addItem(input: { listId: string; tags: string[]; text: string; due?: string }): void
  addSubtask(input: { rootId: string; tags: string[]; text: string; due?: string }): void
  checkItem(input: { id: string; done: boolean }): string | null
  editItem(input: { id: string; tags: string[]; text: string; due?: string }): void
  moveItem(input: { id: string; listId: string; index: number }): void
  deleteItem(input: { id: string }): void
  deleteSubtasks(input: { id: string }): void
  sortList(input: { listId: string }): void
  undoDelete(): string | null
  addCustomList(): void
  editCustomList(input: { id: string; title: string }): void
  moveCustomList(input: { id: string; index: number }): void
  deleteCustomList(input: { id: string }): void
  seekDays(delta: number): void
  seekToToday(): void
  seekToDate(date: Date): void
  seekCustomLists(delta: number): void
  setData(data: TodoData): void
  importData(data: TodoData): void
  exportData(): void
}

function createStore(): TodoStore {
  const state = reactive<TodoData>(initTodoData())

  function apply(result: TodoData): void {
    Object.assign(state, result)
  }

  // Snapshots taken before each delete (with the deleted id), for ⌘Z undo.
  const undoStack: { snapshot: TodoData; id: string }[] = []

  const days = computed<DayList[]>(() =>
    getDayLists(state as TodoData, RANGE),
  )

  const customLists = computed<ResolvedCustomList[]>(() =>
    getCustomTodoLists(state as TodoData),
  )

  const inboxItems = computed<TodoItem[]>(() =>
    itemsForList(state as TodoData, INBOX_LIST_ID),
  )

  function itemsFor(listId: string): TodoItem[] {
    return itemsForList(state as TodoData, listId)
  }

  function queueFor(itemId: string): TodoQueue | null {
    return getTodoQueue(state as TodoData, itemId)
  }

  function addItem(input: { listId: string; tags: string[]; text: string; due?: string }): void {
    apply(addTodoItem(state as TodoData, input))
  }

  function addSubtask(input: { rootId: string; tags: string[]; text: string; due?: string }): void {
    apply(addTodoSubtask(state as TodoData, input))
  }

  function checkItem(input: { id: string; done: boolean }): string | null {
    apply(checkTodoItem(state as TodoData, input))
    return getTodoQueue(state as TodoData, input.id)?.current?.id ?? null
  }

  function editItem(input: { id: string; tags: string[]; text: string; due?: string }): void {
    apply(editTodoItem(state as TodoData, input))
  }

  function moveItem(input: { id: string; listId: string; index: number }): void {
    apply(moveTodoItem(state as TodoData, input))
  }

  function deleteItem(input: { id: string }): void {
    undoStack.push({ snapshot: JSON.parse(JSON.stringify(state)) as TodoData, id: input.id })
    if (undoStack.length > 25) undoStack.shift()
    apply(deleteTodoItem(state as TodoData, input))
  }

  function deleteSubtasks(input: { id: string }): void {
    undoStack.push({ snapshot: JSON.parse(JSON.stringify(state)) as TodoData, id: input.id })
    if (undoStack.length > 25) undoStack.shift()
    apply(deleteTodoSubtasks(state as TodoData, input))
  }

  // One-shot "整理": re-sort a day's list once. Not undoable (it only reorders;
  // sharing the delete undo stack made ⌘Z behave confusingly) — re-drag if needed.
  function sortList(input: { listId: string }): void {
    apply(sortListItems(state as TodoData, input.listId))
  }

  // Undo the most recent delete (session-only); restores the snapshot (view and
  // all) and returns the restored item's id so the caller can reselect it, or
  // null if there's nothing to undo.
  function undoDelete(): string | null {
    const entry = undoStack.pop()
    if (!entry) return null
    apply(entry.snapshot)
    return entry.id
  }

  function addCustomList(): void {
    apply(addCustomTodoList(state as TodoData))
  }

  function editCustomList(input: { id: string; title: string }): void {
    apply(editCustomTodoList(state as TodoData, input))
  }

  function moveCustomList(input: { id: string; index: number }): void {
    apply(moveCustomTodoList(state as TodoData, input))
  }

  function deleteCustomList(input: { id: string }): void {
    apply(deleteCustomTodoList(state as TodoData, input))
  }

  function seekDays(delta: number): void {
    apply(seekDaysLogic(state as TodoData, delta))
  }

  function seekToToday(): void {
    apply(seekToTodayLogic(state as TodoData))
  }

  function seekToDate(date: Date): void {
    apply(seekToDateLogic(state as TodoData, date))
  }

  function seekCustomLists(delta: number): void {
    apply(seekCustomTodoLists(state as TodoData, delta))
  }

  function importData(data: TodoData): void {
    apply(movePastTodoItems(data))
  }

  // Replace the whole document verbatim — used by cloud sync when applying a
  // remote snapshot (no past-item rollover, that already ran on the writer).
  function setData(data: TodoData): void {
    apply(data)
  }

  function exportData(): void {
    const json = JSON.stringify(state as TodoData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'melo.json'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  return {
    state: state as TodoData,
    days,
    customLists,
    inboxItems,
    itemsFor,
    queueFor,
    addItem,
    addSubtask,
    checkItem,
    editItem,
    moveItem,
    deleteItem,
    deleteSubtasks,
    sortList,
    undoDelete,
    addCustomList,
    editCustomList,
    moveCustomList,
    deleteCustomList,
    seekDays,
    seekToToday,
    seekToDate,
    seekCustomLists,
    setData,
    importData,
    exportData,
  }
}

const store: TodoStore = createStore()

export function useTodoStore(): TodoStore {
  return store
}

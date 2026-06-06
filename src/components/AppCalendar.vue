<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useTodoStore } from '../composables/useTodoStore'
import {
  formatDateId,
  formatMonth,
  formatDayOfMonth,
  MONTH_NAMES,
} from '../lib/date'

const store = useTodoStore()

const open = ref(false)
// First day of the month currently shown in the popover.
const view = ref(startOfMonth(store.state.at))

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function startOfMonth(dateId: string): Date {
  const d = new Date(`${dateId}T00:00:00`)
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

const todayId = computed(() => formatDateId(new Date()))

// Active (undone) and total todo counts per day list.
const counts = computed(() => {
  const map = new Map<string, { active: number; total: number }>()
  for (const item of store.state.items) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.listId)) continue
    const entry = map.get(item.listId) ?? { active: 0, total: 0 }
    entry.total += 1
    if (!item.done) entry.active += 1
    map.set(item.listId, entry)
  }
  return map
})

interface Cell {
  date: Date
  id: string
  day: number
  inMonth: boolean
  isToday: boolean
  isSelected: boolean
  active: number
  total: number
  done: number
}

const cells = computed<Cell[]>(() => {
  const first = view.value
  const start = new Date(first)
  start.setDate(1 - first.getDay()) // back to the Sunday on/before the 1st
  const month = first.getMonth()
  const out: Cell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const id = formatDateId(d)
    const c = counts.value.get(id)
    out.push({
      date: d,
      id,
      day: d.getDate(),
      inMonth: d.getMonth() === month,
      isToday: id === todayId.value,
      isSelected: id === store.state.at,
      active: c?.active ?? 0,
      total: c?.total ?? 0,
      done: (c?.total ?? 0) - (c?.active ?? 0),
    })
  }
  return out
})

const monthLabel = computed(
  () => `${MONTH_NAMES[view.value.getMonth()]} ${view.value.getFullYear()}`,
)

const triggerLabel = computed(() => {
  const d = new Date(`${store.state.at}T00:00:00`)
  return `${formatMonth(d)} ${formatDayOfMonth(d)}`
})

watch(open, (isOpen) => {
  if (isOpen) view.value = startOfMonth(store.state.at)
})

function shiftMonth(delta: number): void {
  view.value = new Date(view.value.getFullYear(), view.value.getMonth() + delta, 1)
}

function pick(cell: Cell): void {
  store.seekToDate(cell.date)
  open.value = false
}

function jumpToday(): void {
  view.value = startOfMonth(todayId.value)
}
</script>

<template>
  <div class="cal">
    <button
      class="cal__trigger"
      type="button"
      title="Pick a date"
      @click="open = !open"
    >
      {{ triggerLabel }}
    </button>

    <template v-if="open">
      <div class="cal__scrim" @click="open = false" />
      <div class="cal__pop" @keydown.esc="open = false">
        <header class="cal__head">
          <button class="cal__nav" type="button" title="Previous month" @click="shiftMonth(-1)">‹</button>
          <button class="cal__month" type="button" title="Jump to this month" @click="jumpToday">
            {{ monthLabel }}
          </button>
          <button class="cal__nav" type="button" title="Next month" @click="shiftMonth(1)">›</button>
        </header>

        <div class="cal__weekdays">
          <span v-for="(w, i) in WEEKDAYS" :key="i" class="cal__weekday">{{ w }}</span>
        </div>

        <div class="cal__grid">
          <button
            v-for="cell in cells"
            :key="cell.id"
            class="cal__cell"
            :class="{
              '-out': !cell.inMonth,
              '-today': cell.isToday,
              '-selected': cell.isSelected,
              '-has': cell.total > 0,
            }"
            type="button"
            @click="pick(cell)"
          >
            <span class="cal__day">{{ cell.day }}</span>
            <span v-if="cell.active > 0" class="cal__count">{{ cell.active }}</span>
            <span v-else-if="cell.done > 0" class="cal__count -done">{{ cell.done }}</span>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cal {
  position: relative;
  display: inline-flex;
}

.cal__trigger {
  min-width: 6rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--main-border-light);
  border-radius: 6px;
  background: transparent;
  color: var(--header-text);
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.cal__trigger:hover {
  background: var(--button-active-bg);
}

.cal__scrim {
  position: fixed;
  inset: 0;
  z-index: 40;
}

.cal__pop {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 41;
  width: 17rem;
  padding: 0.6rem;
  background: var(--panel-bg);
  border: 1px solid var(--main-border-light);
  border-radius: 10px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.28);
}

.cal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.4rem;
}

.cal__nav {
  width: 1.8rem;
  height: 1.8rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--button-text);
  font-size: 1.1rem;
  cursor: pointer;
}

.cal__nav:hover {
  background: var(--button-active-bg);
}

.cal__month {
  border: none;
  background: transparent;
  color: var(--main-text);
  font: inherit;
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
}

.cal__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 0.2rem;
}

.cal__weekday {
  text-align: center;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--disabled-text);
}

.cal__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.cal__cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1 / 1;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--main-text);
  font: inherit;
  font-size: 0.82rem;
  cursor: pointer;
  transition: background-color 0.1s ease;
}

.cal__cell:hover {
  background: var(--button-active-bg);
}

.cal__cell.-out {
  color: var(--disabled-text);
}

.cal__cell.-today {
  border-color: var(--accent);
}

.cal__cell.-selected {
  background: var(--accent);
  color: #fff;
}

.cal__count {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 0.95rem;
  height: 0.95rem;
  padding: 0 0.2rem;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 0.6rem;
  font-weight: 700;
  line-height: 0.95rem;
  text-align: center;
}

.cal__cell.-selected .cal__count {
  background: #fff;
  color: var(--accent);
}

/* All tasks done that day — show the completed count, muted to set it apart
   from the amber "still to do" badge. */
.cal__count.-done {
  background: var(--button-active-bg);
  color: var(--aside-text);
}
</style>

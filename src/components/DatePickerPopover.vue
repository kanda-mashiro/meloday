<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatDateId } from '../lib/date'

const props = defineProps<{
  // Where to anchor the popover: the "选日期…" item's bounding rect.
  anchor: DOMRect
  // The date the calendar should open on.
  initial: Date
}>()

const emit = defineEmits<{
  (e: 'pick', date: Date): void
  (e: 'close'): void
}>()

// Monday-first weekday labels.
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

const popEl = ref<HTMLElement | null>(null)

// First day of the month currently shown.
const view = ref(new Date(props.initial.getFullYear(), props.initial.getMonth(), 1))

const todayId = formatDateId(new Date())

const monthLabel = computed(
  () => `${view.value.getFullYear()}年${view.value.getMonth() + 1}月`,
)

interface Cell {
  date: Date
  id: string
  day: number
  inMonth: boolean
  isToday: boolean
}

const cells = computed<Cell[]>(() => {
  const first = view.value
  const month = first.getMonth()
  const start = new Date(first)
  // Back up to the Monday on/before the 1st. getDay(): Sun=0..Sat=6 → Mon-offset.
  const offset = (first.getDay() + 6) % 7
  start.setDate(1 - offset)
  const out: Cell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const id = formatDateId(d)
    out.push({
      date: d,
      id,
      day: d.getDate(),
      inMonth: d.getMonth() === month,
      isToday: id === todayId,
    })
  }
  return out
})

// Anchor the fixed popover near the "选日期…" item, clamped to the viewport so
// it never spills off-screen.
const POP_W = 232
const POP_H = 268
const style = computed(() => {
  const margin = 8
  const a = props.anchor
  let left = a.right + 6
  let top = a.top
  if (left + POP_W > window.innerWidth - margin) {
    // No room to the right → flip to the left of the anchor.
    left = a.left - 6 - POP_W
  }
  if (left < margin) left = margin
  if (top + POP_H > window.innerHeight - margin) {
    top = window.innerHeight - margin - POP_H
  }
  if (top < margin) top = margin
  return { left: `${left}px`, top: `${top}px` }
})

function shiftMonth(delta: number): void {
  view.value = new Date(view.value.getFullYear(), view.value.getMonth() + delta, 1)
}

function pick(cell: Cell): void {
  emit('pick', cell.date)
}

function onPointerDown(event: MouseEvent): void {
  if (popEl.value && !popEl.value.contains(event.target as Node)) {
    emit('close')
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.stopPropagation()
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('mousedown', onPointerDown, true)
  window.addEventListener('keydown', onKeydown, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', onPointerDown, true)
  window.removeEventListener('keydown', onKeydown, true)
})
</script>

<template>
  <div ref="popEl" class="dpp" :style="style" role="dialog" aria-label="选择日期">
    <header class="dpp__head">
      <button class="dpp__nav" type="button" aria-label="上个月" @click="shiftMonth(-1)">
        <svg viewBox="0 0 16 16" class="dpp__chevron" aria-hidden="true">
          <path d="M10 3.5L5.5 8l4.5 4.5" />
        </svg>
      </button>
      <span class="dpp__month">{{ monthLabel }}</span>
      <button class="dpp__nav" type="button" aria-label="下个月" @click="shiftMonth(1)">
        <svg viewBox="0 0 16 16" class="dpp__chevron" aria-hidden="true">
          <path d="M6 3.5L10.5 8L6 12.5" />
        </svg>
      </button>
    </header>

    <div class="dpp__weekdays">
      <span v-for="(w, i) in WEEKDAYS" :key="i" class="dpp__weekday">{{ w }}</span>
    </div>

    <div class="dpp__grid">
      <button
        v-for="cell in cells"
        :key="cell.id"
        class="dpp__cell"
        :class="{ '-out': !cell.inMonth, '-today': cell.isToday }"
        type="button"
        @click="pick(cell)"
      >
        {{ cell.day }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.dpp {
  position: fixed;
  z-index: 61;
  width: 232px;
  padding: 0.6rem;
  background: var(--panel-bg);
  border: 1px solid var(--main-border-light);
  border-radius: 10px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.28);
  user-select: none;
}

.dpp__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.45rem;
}

.dpp__nav {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.7rem;
  height: 1.7rem;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--aside-text);
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.dpp__nav:hover {
  color: var(--highlight-text);
  background: var(--button-active-bg);
}

.dpp__chevron {
  width: 0.9rem;
  height: 0.9rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.dpp__month {
  color: var(--main-text);
  font-size: 0.9rem;
  font-weight: 700;
}

.dpp__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 0.25rem;
}

.dpp__weekday {
  text-align: center;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--disabled-text);
}

.dpp__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.dpp__cell {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1 / 1;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--main-text);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background-color 0.1s ease;
}

.dpp__cell:hover {
  background: var(--accent-soft);
  color: var(--highlight-text);
}

.dpp__cell.-out {
  color: var(--disabled-text);
}

.dpp__cell.-today {
  border-color: var(--accent);
  color: var(--highlight-text);
  font-weight: 700;
}
</style>

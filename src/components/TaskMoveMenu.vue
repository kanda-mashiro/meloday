<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { TodoItem as TodoItemType } from '../types/todo'
import { formatDateId } from '../lib/date'
import { useTodoStore } from '../composables/useTodoStore'
import { useToast } from '../composables/useToast'
import DatePickerPopover from './DatePickerPopover.vue'

const props = defineProps<{
  item: TodoItemType
  /** Cursor position where the menu was opened (viewport coords). */
  x: number
  y: number
}>()

const emit = defineEmits<{
  close: []
  note: []
  focus: []
}>()

const store = useTodoStore()

// --- "Move to date" targets, resolved from the start of today --------------
function today(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}
function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}
function comingSaturday(base: Date): Date {
  return addDays(base, (6 - base.getDay() + 7) % 7)
}
function nextMonday(base: Date): Date {
  const delta = ((1 - base.getDay() + 7) % 7) || 7
  return addDays(base, delta)
}
function sameDayNextMonth(base: Date): Date {
  return new Date(base.getFullYear(), base.getMonth() + 1, base.getDate())
}

interface MoveOption {
  key: string
  label: string
  date: Date
}
const options = computed<MoveOption[]>(() => {
  const base = today()
  return [
    { key: 'tomorrow', label: '明天', date: addDays(base, 1) },
    { key: 'weekend', label: '本周末', date: comingSaturday(base) },
    { key: 'next-mon', label: '下周一', date: nextMonday(base) },
    { key: 'week', label: '一周后', date: addDays(base, 7) },
    { key: 'next-month', label: '下个月今天', date: sameDayNextMonth(base) },
  ]
})

function shortDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function moveTo(date: Date): void {
  // Move the task; keep the current view in place. The toast is the feedback.
  store.moveItem({ id: props.item.id, listId: formatDateId(date), index: 0 })
  const wd = '日一二三四五六'[date.getDay()]
  useToast().showToast(`已移到 ${date.getMonth() + 1}月${date.getDate()}日 · 周${wd}`)
  emit('close')
}

// --- Standard actions (handled by the parent TodoItem) ---------------------
function act(action: 'note' | 'focus'): void {
  if (action === 'note') emit('note')
  else emit('focus')
  emit('close')
}

// --- "移到日期 ▸" submenu ---------------------------------------------------
const submenuOpen = ref(false)
// Open the submenu on the left when there isn't room on the right.
const submenuSide = window.innerWidth - props.x < 300 ? 'left' : 'right'

// --- "选日期…" → the inline month calendar ---------------------------------
const showCalendar = ref(false)
const calAnchor = ref<DOMRect | null>(null)
function openCalendar(event: MouseEvent): void {
  calAnchor.value = (event.currentTarget as HTMLElement).getBoundingClientRect()
  showCalendar.value = true
}
function onCalendarPick(date: Date): void {
  showCalendar.value = false
  moveTo(date)
}
const calInitial = computed(() => {
  const id = props.item.listId
  if (/^\d{4}-\d{2}-\d{2}$/.test(id)) {
    const [y, m, d] = id.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date()
})

// --- Positioning: fixed panel at the cursor, clamped to the viewport -------
const panel = ref<HTMLElement | null>(null)
const pos = ref({ left: props.x, top: props.y })
function clamp(): void {
  const el = panel.value
  if (!el) return
  const margin = 8
  const { offsetWidth: w, offsetHeight: h } = el
  let left = props.x
  let top = props.y
  if (left + w + margin > window.innerWidth) left = Math.max(margin, window.innerWidth - w - margin)
  if (top + h + margin > window.innerHeight) top = Math.max(margin, window.innerHeight - h - margin)
  pos.value = { left, top }
}

// --- Dismissal: outside-click and Esc --------------------------------------
function onPointerDown(event: PointerEvent): void {
  // The calendar lives inside the panel, so clicks within it don't dismiss.
  if (panel.value && !panel.value.contains(event.target as Node)) emit('close')
}
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    if (showCalendar.value) showCalendar.value = false
    else emit('close')
  }
}

onMounted(() => {
  clamp()
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('keydown', onKeydown, true)
  window.addEventListener('resize', clamp)
  window.addEventListener('scroll', () => emit('close'), true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown, true)
  document.removeEventListener('keydown', onKeydown, true)
  window.removeEventListener('resize', clamp)
})
</script>

<template>
  <div
    ref="panel"
    class="move-menu"
    role="menu"
    aria-label="任务操作"
    :style="{ left: `${pos.left}px`, top: `${pos.top}px` }"
  >
    <!-- 移到日期 ▸ (submenu) -->
    <div
      class="move-menu__group"
      @mouseenter="submenuOpen = true"
      @mouseleave="submenuOpen = false"
    >
      <button class="move-menu__item" type="button" role="menuitem" @click="submenuOpen = true">
        <svg class="move-menu__icon" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
          <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
        </svg>
        <span class="move-menu__label">移到日期</span>
        <svg class="move-menu__caret" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M6 4l4 4-4 4" />
        </svg>
      </button>

      <div v-if="submenuOpen" class="move-menu__sub" :class="{ '-left': submenuSide === 'left' }">
        <button
          v-for="opt in options"
          :key="opt.key"
          class="move-menu__item"
          type="button"
          role="menuitem"
          @click="moveTo(opt.date)"
        >
          <span class="move-menu__label">{{ opt.label }}</span>
          <span class="move-menu__date">{{ shortDate(opt.date) }}</span>
        </button>

        <div class="move-menu__sep" role="separator" />

        <button class="move-menu__item" type="button" role="menuitem" @click="openCalendar">
          <span class="move-menu__label">选日期…</span>
        </button>
      </div>
    </div>

    <div class="move-menu__sep" role="separator" />

    <button class="move-menu__item" type="button" role="menuitem" @click="act('note')">
      <svg class="move-menu__icon" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="3.5" y="2.5" width="9" height="11" rx="1.5" />
        <path d="M5.5 6h5M5.5 8.5h5M5.5 11h3" />
      </svg>
      <span class="move-menu__label">笔记</span>
    </button>

    <button class="move-menu__item" type="button" role="menuitem" @click="act('focus')">
      <svg class="move-menu__icon" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M5 3.5l7 4.5-7 4.5z" />
      </svg>
      <span class="move-menu__label">专注</span>
    </button>

    <DatePickerPopover
      v-if="showCalendar && calAnchor"
      :anchor="calAnchor"
      :initial="calInitial"
      @pick="onCalendarPick"
      @close="showCalendar = false"
    />
  </div>
</template>

<style scoped>
.move-menu {
  position: fixed;
  z-index: 60;
  min-width: 11rem;
  padding: 0.3rem;
  background: var(--panel-bg);
  border: 1px solid var(--main-border-light);
  border-radius: 8px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22);
  font-size: 0.85rem;
  user-select: none;
}

.move-menu__group {
  position: relative;
}

.move-menu__sub {
  position: absolute;
  top: -0.35rem;
  left: 100%;
  /* Slight overlap (no gap) so moving the mouse from the parent into the submenu
     never leaves the group and closes it. */
  margin-left: -1px;
  min-width: 10.5rem;
  padding: 0.3rem;
  background: var(--panel-bg);
  border: 1px solid var(--main-border-light);
  border-radius: 8px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22);
}

.move-menu__sub.-left {
  left: auto;
  right: 100%;
  margin-left: 0;
  margin-right: -1px;
}

.move-menu__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.4rem 0.55rem;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--main-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.move-menu__item:hover,
.move-menu__item:focus-visible {
  background: var(--accent-soft);
  color: var(--highlight-text);
  outline: none;
}

.move-menu__item.-danger:hover {
  background: color-mix(in srgb, #d23a4f 14%, transparent);
  color: #d23a4f;
}

.move-menu__icon {
  flex: 0 0 auto;
  width: 0.95rem;
  height: 0.95rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.3;
  stroke-linecap: round;
  stroke-linejoin: round;
  color: var(--aside-text);
}

.move-menu__item:hover .move-menu__icon,
.move-menu__item:focus-visible .move-menu__icon {
  color: inherit;
}

.move-menu__label {
  flex: 1 1 auto;
}

.move-menu__caret {
  flex: 0 0 auto;
  width: 0.8rem;
  height: 0.8rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  color: var(--disabled-text);
}

.move-menu__date {
  flex: 0 0 auto;
  font-size: 0.76rem;
  color: var(--aside-text);
  font-variant-numeric: tabular-nums;
}

.move-menu__item:hover .move-menu__date,
.move-menu__item:focus-visible .move-menu__date {
  color: inherit;
}

.move-menu__sep {
  height: 1px;
  margin: 0.3rem 0.4rem;
  background: var(--divider);
}
</style>

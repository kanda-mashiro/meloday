<script setup lang="ts">
import { computed, ref } from 'vue';
import type { DayList } from '../types/todo';
import { formatDayOfWeek, formatDayOfMonth, formatMonth } from '../lib/date';
import { usePreferences } from '../composables/usePreferences';
import { useTodoStore } from '../composables/useTodoStore';
import TodoList from './TodoList.vue';
import OccasionGift from './OccasionGift.vue';
import OccasionHeadsUp from './OccasionHeadsUp.vue';

const props = defineProps<{ day: DayList }>();

const { prefs } = usePreferences();
const store = useTodoStore();

// Only offer 整理 when there's something to sort (≥2 items).
const total = computed(() => props.day.items.length);

const weekday = computed(() => formatDayOfWeek(props.day.date));
const subline = computed(
  () => `${formatMonth(props.day.date)} ${formatDayOfMonth(props.day.date)}`,
);

// Reveal the gift icon only while this column's header is hovered (special days
// keep it shown — see OccasionGift).
const headerHover = ref(false);
</script>

<template>
  <div class="todo-day" :class="{ '-today': day.isToday, '-past': day.isPast }">
    <header class="todo-day__header" @mouseenter="headerHover = true" @mouseleave="headerHover = false">
      <span class="todo-day__sub">{{ subline }}</span>
      <div class="todo-day__title-row">
        <span class="todo-day__weekday">{{ weekday }}</span>
        <div class="todo-day__actions">
          <!-- One-shot 整理: revealed on header hover (like the gift) and only with
               ≥2 items. Compact to suit the narrow multi-day column. -->
          <button
            v-if="total >= 2 && headerHover"
            class="todo-day__sort"
            type="button"
            title="整理"
            aria-label="整理"
            @click="store.sortList({ listId: day.id })"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:0.95rem;height:0.95rem;display:block"><path d="M5 7h14M5 12h9M5 17h4"/></svg>
          </button>
          <!-- Gift control on the weekday row (matches the focus view); the popover
               escapes the narrow column via z-index. -->
          <OccasionGift class="todo-day__gift" :date="day.date" :reveal="headerHover" />
        </div>
      </div>
    </header>
    <!-- Today-only heads-up: sits BELOW the header so it doesn't grow the header
         (which is flex-end aligned) and shove the weekday out of line with the
         other columns. -->
    <div v-if="day.isToday" class="todo-day__headsup">
      <OccasionHeadsUp />
    </div>
    <div class="todo-day__body" :class="{ ruled: prefs.showLines }">
      <TodoList :list-id="day.id" :items="day.items" />
    </div>
  </div>
</template>

<style scoped>
.todo-day {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.todo-day.-today {
  background: var(--accent-soft);
}

.todo-day.-past {
  opacity: 0.62;
}

.todo-day__header {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.1rem;
  /* A minimum height keeps the weekday baselines aligned across columns; it can
     grow when a today-heads-up is present. */
  min-height: calc(var(--line-h) * 1.6);
  padding: 0 0.85rem 0.5rem;
  /* Don't clip the gift popover, which is absolutely positioned below the icon. */
  position: relative;
  overflow: visible;
}

/* Weekday row: the weekday on the left, the gift control pinned right (mirrors
   the focus view's title row). */
.todo-day__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}

/* Header actions clustered on the right of the weekday row. */
.todo-day__actions {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  flex: 0 0 auto;
}

/* 整理 button — compact, matching the gift's quiet hover-tinted look. */
.todo-day__sort {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--aside-text);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.todo-day__sort:hover {
  background: var(--button-active-bg);
  color: var(--main-text);
}

/* Gift button — modest for the narrow column, but not tiny. */
.todo-day__gift :deep(.occ-gift__btn) {
  width: 1.85rem;
  height: 1.85rem;
  font-size: 1.25rem;
}

/* Today-only heads-up, below the header. Match the column's horizontal padding;
   a touch larger than the shared default so it reads in-column. */
.todo-day__headsup {
  padding: 0 0.85rem 0.3rem;
}

.todo-day__headsup :deep(.occ-headsup) {
  margin-top: 0;
}

.todo-day__headsup :deep(.occ-headsup__row) {
  font-size: 0.82rem;
}

.todo-day__sub {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--aside-text);
}

.todo-day__weekday {
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--main-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.todo-day.-today .todo-day__sub,
.todo-day.-today .todo-day__weekday {
  color: var(--highlight-text);
}

.todo-day__body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 62vh;
  padding: 0 0.5rem;
}
</style>

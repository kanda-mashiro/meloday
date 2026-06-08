<script setup lang="ts">
import { computed, ref } from 'vue';
import type { DayList } from '../types/todo';
import { formatDayOfWeek, formatDayOfMonth, formatMonth } from '../lib/date';
import { usePreferences } from '../composables/usePreferences';
import TodoList from './TodoList.vue';
import OccasionGift from './OccasionGift.vue';
import OccasionHeadsUp from './OccasionHeadsUp.vue';

const props = defineProps<{ day: DayList }>();

const { prefs } = usePreferences();

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
        <!-- Gift control on the weekday row (matches the focus view); the popover
             escapes the narrow column via z-index. -->
        <OccasionGift class="todo-day__gift" :date="day.date" :reveal="headerHover" />
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

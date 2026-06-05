<script setup lang="ts">
import { computed } from 'vue';
import type { DayList } from '../types/todo';
import { formatDayOfWeek, formatDayOfMonth, formatMonth } from '../lib/date';
import { usePreferences } from '../composables/usePreferences';
import TodoList from './TodoList.vue';

const props = defineProps<{ day: DayList }>();

const { prefs } = usePreferences();

const weekday = computed(() => formatDayOfWeek(props.day.date));
const subline = computed(
  () => `${formatMonth(props.day.date)} ${formatDayOfMonth(props.day.date)}`,
);
</script>

<template>
  <div class="todo-day" :class="{ '-today': day.isToday, '-past': day.isPast }">
    <header class="todo-day__header">
      <span class="todo-day__sub">{{ subline }}</span>
      <span class="todo-day__weekday">{{ weekday }}</span>
    </header>
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
  height: calc(var(--line-h) * 1.6);
  padding: 0 0.85rem 0.5rem;
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

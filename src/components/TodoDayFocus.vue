<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import type { DayList } from '../types/todo'
import { usePreferences } from '../composables/usePreferences'
import { useFocusSession } from '../composables/useFocusSession'
import { useNotes } from '../composables/useNotes'
import { formatDayOfWeek, formatDayOfMonth, formatMonth } from '../lib/date'
import TodoList from './TodoList.vue'

const props = defineProps<{ day: DayList }>()
const { prefs, exitFocus } = usePreferences()
const focusSession = useFocusSession()
const notes = useNotes()

// Esc leaves focus mode (back to a multi-day view). A focus session or note
// drawer layered on top handles Esc first (and stops it), so this only fires
// when the bare focus card is showing.
function onFocusKey(e: KeyboardEvent): void {
  if (
    e.key === 'Escape' &&
    prefs.columns === 1 &&
    !focusSession.target.value &&
    !notes.activeItem.value
  ) {
    e.preventDefault()
    exitFocus()
  }
}
onMounted(() => window.addEventListener('keydown', onFocusKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onFocusKey))

const subline = computed(
  () => `${formatMonth(props.day.date)} ${formatDayOfMonth(props.day.date)}`,
)
const weekday = computed(() => formatDayOfWeek(props.day.date))
</script>

<template>
  <div class="focus">
    <article class="focus__card" :class="{ '-today': day.isToday, '-past': day.isPast }">
      <header class="focus__head">
        <span class="focus__sub">{{ subline }}</span>
        <h2 class="focus__weekday">{{ weekday }}</h2>
      </header>

      <div class="focus__list" :class="{ ruled: prefs.showLines }">
        <TodoList :list-id="day.id" :items="day.items" :focusable="true" :persistent-add="true" />
      </div>
    </article>
  </div>
</template>

<style scoped>
.focus {
  flex: 1 1 auto;
  /* Fill the area below the day-nav so the muted backdrop covers the screen
     (the global header is hidden in focus mode). */
  min-height: calc(100vh - 7rem);
  display: flex;
  justify-content: center;
  overflow-y: auto;
  padding: 1.5rem 1rem 3rem;
  /* A faintly muted backdrop so the card reads as a focused "sheet". */
  background: color-mix(in srgb, var(--main-text) 4%, var(--main-bg));
}

.focus__card {
  width: 100%;
  max-width: 640px;
  align-self: flex-start;
  padding: 1.6rem 1.75rem 2.5rem;
  background: var(--main-bg);
  border: 1px solid var(--divider);
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
}

.focus__card.-past {
  opacity: 0.75;
}

.focus__head {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin-bottom: 0.5rem;
}

.focus__sub {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--aside-text);
}

.focus__weekday {
  margin: 0;
  font-size: 1.7rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--main-text);
}

.focus__card.-today .focus__weekday,
.focus__card.-today .focus__sub {
  color: var(--highlight-text);
}

.focus__list {
  margin-top: 0.25rem;
  display: flex;
  flex-direction: column;
  /* A tall click target: tapping the empty space below the items adds a todo
     (the card is otherwise only as tall as its content). */
  min-height: 55vh;
}
</style>

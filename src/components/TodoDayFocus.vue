<script setup lang="ts">
import { computed } from 'vue'
import type { DayList } from '../types/todo'
import { usePreferences } from '../composables/usePreferences'
import { getTime, parseLabelRich } from '../lib/time'
import { formatDayOfWeek, formatDayOfMonth, formatMonth } from '../lib/date'
import TodoList from './TodoList.vue'

const props = defineProps<{ day: DayList }>()
const { prefs } = usePreferences()

const subline = computed(
  () => `${formatMonth(props.day.date)} ${formatDayOfMonth(props.day.date)}`,
)
const weekday = computed(() => formatDayOfWeek(props.day.date))

// Most tasks have no time, so the list is the hero. The few that DO carry a
// time get pulled into a thin glanceable "schedule" strip up top — your fixed
// commitments at a glance, not a big mostly-empty calendar.
interface Slot {
  id: string
  start: number
  time: string
  text: string
}
const schedule = computed<Slot[]>(() => {
  const out: Slot[] = []
  for (const item of props.day.items) {
    if (item.done) continue
    const t = getTime(item.label)
    if (!t) continue
    const rich = parseLabelRich(item.label)
    const time = rich.segments.find((s) => s.kind === 'time')?.text ?? ''
    const text = rich.segments
      .filter((s) => s.kind === 'text')
      .map((s) => s.text)
      .join('')
      .trim()
    out.push({ id: item.id, start: t.start, time, text })
  }
  return out.sort((a, b) => a.start - b.start)
})
</script>

<template>
  <div class="focus">
    <article class="focus__card" :class="{ '-today': day.isToday, '-past': day.isPast }">
      <header class="focus__head">
        <span class="focus__sub">{{ subline }}</span>
        <h2 class="focus__weekday">{{ weekday }}</h2>
      </header>

      <div v-if="schedule.length" class="focus__schedule">
        <span class="focus__schedule-label">今日日程</span>
        <span v-for="s in schedule" :key="s.id" class="focus__slot">
          <span class="focus__slot-time">{{ s.time }}</span>
          <span class="focus__slot-text">{{ s.text || '—' }}</span>
        </span>
      </div>

      <div class="focus__list" :class="{ ruled: prefs.showLines }">
        <TodoList :list-id="day.id" :items="day.items" :focusable="true" />
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

/* Thin schedule strip — only the timed items, sorted by time. */
.focus__schedule {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.9rem;
  margin: 0.5rem 0 1.1rem;
  padding: 0.55rem 0.8rem;
  border-radius: 8px;
  background: var(--accent-soft);
}

.focus__schedule-label {
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--aside-text);
}

.focus__slot {
  display: inline-flex;
  align-items: baseline;
  gap: 0.35rem;
  font-size: 0.85rem;
  max-width: 100%;
}

.focus__slot-time {
  flex: 0 0 auto;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--highlight-text);
}

.focus__slot-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--main-text);
}

.focus__list {
  margin-top: 0.25rem;
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DayList } from '../types/todo'
import { usePreferences } from '../composables/usePreferences'
import { formatDayOfWeek, formatDayOfMonth, formatMonth, formatDateId } from '../lib/date'
import TodoList from './TodoList.vue'
import TaskNotePanel from './TaskNotePanel.vue'
import DayTimer from './DayTimer.vue'

const props = defineProps<{ day: DayList }>()
const { prefs } = usePreferences()

// The workspace's right pane (note + timer) is open by default.
const paneOpen = ref(true)

const subline = computed(
  () => `${formatMonth(props.day.date)} ${formatDayOfMonth(props.day.date)}`,
)
const weekday = computed(() => formatDayOfWeek(props.day.date))

// Relative-day chip: 今天 / 明天 / 昨天 (nothing for other days).
const relativeDay = computed(() => {
  const today = new Date()
  const dayId = formatDateId(props.day.date)
  if (dayId === formatDateId(today)) return '今天'
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  if (dayId === formatDateId(tomorrow)) return '明天'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (dayId === formatDateId(yesterday)) return '昨天'
  return ''
})

// Day progress, derived from the items (no new persistence).
const total = computed(() => props.day.items.length)
const done = computed(() => props.day.items.filter((i) => i.done).length)
const progress = computed(() =>
  total.value === 0 ? 0 : Math.round((done.value / total.value) * 100),
)

// Subtle time-of-day greeting, today only.
const greeting = computed(() => {
  if (!props.day.isToday) return ''
  const h = new Date().getHours()
  if (h < 12) return '早安'
  if (h < 18) return '下午好'
  return '晚上好'
})
</script>

<template>
  <div class="focus">
    <div class="focus__workspace" :class="{ '-pane-open': paneOpen }">
      <!-- LEFT pane: the day's task list (unchanged TodoList). -->
      <article class="focus__card" :class="{ '-today': day.isToday, '-past': day.isPast }">
        <header class="focus__head">
          <div class="focus__subline">
            <span class="focus__sub">{{ subline }}</span>
            <span v-if="relativeDay" class="focus__chip">{{ relativeDay }}</span>
          </div>
          <h2 class="focus__weekday">{{ weekday }}</h2>
          <span v-if="greeting" class="focus__greeting">{{ greeting }}</span>

          <div v-if="total > 0" class="focus__progress">
            <span class="focus__count">{{ total }} 项 · 已完成 {{ done }}</span>
            <div
              class="focus__bar"
              role="progressbar"
              :aria-valuenow="done"
              :aria-valuemin="0"
              :aria-valuemax="total"
            >
              <div class="focus__bar-fill" :style="{ width: progress + '%' }" />
            </div>
          </div>

          <button
            v-if="!paneOpen"
            class="focus__pane-toggle -reopen"
            type="button"
            aria-label="Show day panel"
            title="显示面板"
            @click="paneOpen = true"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1.05em;height:1.05em;display:block"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16"/></svg>
          </button>
        </header>

        <div class="focus__list" :class="{ ruled: prefs.showLines }">
          <TodoList :list-id="day.id" :items="day.items" :focusable="true" />
        </div>
      </article>

      <!-- RIGHT pane: day timer + free-form day note. Open by default. -->
      <aside v-if="paneOpen" class="focus__pane">
        <div class="focus__pane-bar">
          <button
            class="focus__pane-toggle"
            type="button"
            aria-label="Hide day panel"
            title="隐藏面板"
            @click="paneOpen = false"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1.05em;height:1.05em;display:block"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
        </div>
        <DayTimer />
        <TaskNotePanel />
      </aside>
    </div>
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

/* The two-pane workspace: list (flexible) + side panel (~380px). When the panel
   is collapsed it falls back to the original centered single card. */
.focus__workspace {
  width: 100%;
  max-width: 640px;
  align-self: flex-start;
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  transition: max-width 0.2s ease;
}

.focus__workspace.-pane-open {
  max-width: 1120px;
}

.focus__card {
  flex: 1 1 auto;
  min-width: 0;
  padding: 1.6rem 1.75rem 2.5rem;
  background: var(--main-bg);
  border: 1px solid var(--divider);
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
}

/* Right pane — the day workspace panel. */
.focus__pane {
  flex: 0 0 560px;
  width: 560px;
  /* Own height, decoupled from the task list; sticky so the timer + note stay in
     view while a long list scrolls past. */
  align-self: flex-start;
  position: sticky;
  top: 0;
  height: calc(100vh - 9rem);
  display: flex;
  flex-direction: column;
  background: var(--panel-bg);
  border: 1px solid var(--divider);
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.focus__pane-bar {
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-end;
  padding: 0.5rem 0.5rem 0;
}

.focus__pane-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.85rem;
  height: 1.85rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--aside-text);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.focus__pane-toggle:hover {
  background: var(--button-active-bg);
  color: var(--main-text);
}

/* The "reopen" toggle sits in the card header, pinned to the right. */
.focus__pane-toggle.-reopen {
  position: absolute;
  top: 0;
  right: 0;
}

.focus__card.-past {
  opacity: 0.75;
}

.focus__head {
  position: relative;
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

.focus__subline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.focus__chip {
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1;
  padding: 0.18rem 0.4rem;
  border-radius: 999px;
  color: var(--highlight-text);
  background: color-mix(in srgb, var(--accent, var(--highlight-text)) 14%, transparent);
}

.focus__greeting {
  margin-top: 0.1rem;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--aside-text);
}

.focus__progress {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.focus__count {
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--aside-text);
}

.focus__bar {
  height: 3px;
  border-radius: 999px;
  overflow: hidden;
  background: color-mix(in srgb, var(--main-text) 8%, transparent);
}

.focus__bar-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--accent, var(--highlight-text));
  transition: width 0.25s ease;
}

.focus__list {
  margin-top: 0.25rem;
  display: flex;
  flex-direction: column;
  /* A tall click target: tapping the empty space below the items adds a todo
     (the card is otherwise only as tall as its content). */
  min-height: 55vh;
}

/* Keep a clickable empty tail below the items even when a long list fills past
   the 55vh floor — clicking it still starts a new todo (no extra input row). */
.focus__list :deep(.todo-list) {
  padding-bottom: 5rem;
}

/* Narrow widths: stack the panel under the list instead of beside it. */
@media (max-width: 820px) {
  .focus__workspace.-pane-open {
    flex-direction: column;
    max-width: 640px;
  }

  .focus__pane {
    flex: 0 0 auto;
    width: 100%;
    height: auto;
    min-height: 0;
    position: static;
  }
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import type { DayList } from '../types/todo'
import { useTodoStore } from '../composables/useTodoStore'
import { usePreferences } from '../composables/usePreferences'
import TodoDay from './TodoDay.vue'
import TodoDayFocus from './TodoDayFocus.vue'
import InboxColumn from './InboxColumn.vue'
import AppCalendar from './AppCalendar.vue'

const store = useTodoStore()
const { prefs } = usePreferences()

// Show a window of `columns` days; optionally lead with yesterday.
const visibleDays = computed<DayList[]>(() => {
  const days = store.days.value
  const at = days.findIndex((d) => d.id === store.state.at)
  const lead = prefs.startOn === 'yesterday' ? 1 : 0
  const from = Math.max(0, (at < 0 ? 0 : at) - lead)
  return days.slice(from, from + prefs.columns)
})

// The single-day view becomes the focus timeline — the day at the cursor.
const currentDay = computed<DayList | undefined>(() => {
  const days = store.days.value
  return days.find((d) => d.id === store.state.at) ?? days[0]
})
</script>

<template>
  <section class="frame-days">
    <div class="frame-days__nav">
      <button class="btn" type="button" title="Previous week" @click="store.seekDays(-7)">«</button>
      <button class="btn" type="button" title="Previous day" @click="store.seekDays(-1)">‹</button>
      <button class="btn frame-days__today" type="button" title="Jump to today" @click="store.seekToToday()">
        Today
      </button>
      <AppCalendar />
      <button class="btn" type="button" title="Next day" @click="store.seekDays(1)">›</button>
      <button class="btn" type="button" title="Next week" @click="store.seekDays(7)">»</button>
    </div>

    <TodoDayFocus
      v-if="prefs.columns === 1 && currentDay"
      :day="currentDay"
    />
    <div v-else class="frame-days__grid">
      <InboxColumn />
      <TodoDay
        v-for="day in visibleDays"
        :key="day.id"
        :day="day"
        class="frame-days__col"
      />
    </div>
  </section>
</template>

<style scoped>
.frame-days {
  display: flex;
  flex-direction: column;
}

.frame-days__nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.7rem 1rem;
}

.frame-days__today {
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.frame-days__grid {
  display: flex;
  align-items: stretch;
  border-top: 1px solid var(--divider);
}

.frame-days__col {
  flex: 1 1 0;
  min-width: 0;
  border-right: 1px solid var(--divider);
}

.frame-days__col:last-child {
  border-right: none;
}

@media (max-width: 900px) {
  .frame-days__grid {
    overflow-x: auto;
  }

  .frame-days__col {
    flex: 0 0 14rem;
  }
}
</style>

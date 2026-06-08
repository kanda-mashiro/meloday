<script setup lang="ts">
import { computed } from 'vue'
import { useOccasions } from '../composables/useOccasions'

const { upcoming } = useOccasions()

// Occasions whose next occurrence falls within ~2 weeks, soonest-first.
const upcomingOccasions = computed(() => upcoming(14))

// Relative suffix for a heads-up entry.
function relativeSuffix(days: number): string {
  if (days === 0) return '· 就是今天'
  if (days === 1) return '· 明天'
  return `· 还有 ${days} 天`
}
</script>

<template>
  <div v-if="upcomingOccasions.length" class="occ-headsup">
    <div
      v-for="entry in upcomingOccasions"
      :key="entry.occasion.id"
      class="occ-headsup__row"
      :class="{ '-soon': entry.days <= 2 }"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:0.95em;height:0.95em;display:block;flex:0 0 auto"><path d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8"/><path d="M2 7h20v5H2z"/><path d="M12 7v14"/><path d="M12 7S10.5 3 8 3a2 2 0 0 0 0 4h4zM12 7s1.5-4 4-4a2 2 0 0 1 0 4h-4z"/></svg>
      <span class="occ-headsup__name">{{ entry.occasion.name }}</span>
      <span class="occ-headsup__when">{{ relativeSuffix(entry.days) }}</span>
    </div>
  </div>
</template>

<style scoped>
.occ-headsup {
  margin-top: 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.occ-headsup__row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.74rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: var(--accent, var(--highlight-text));
}

/* Within a couple of days: emphasise slightly. */
.occ-headsup__row.-soon {
  font-weight: 600;
}

.occ-headsup__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.occ-headsup__when {
  flex: 0 0 auto;
  opacity: 0.85;
}
</style>

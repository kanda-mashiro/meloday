<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useArchive, type ArchivedItem } from '../composables/useArchive'
import { parseTextRich, type RichSegment } from '../lib/time'
import { tagHue, priorityLevel } from '../lib/tags'
import { formatDateId, formatMonth, formatDayOfMonth, formatDayOfWeek } from '../lib/date'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { items, loading, error, hasMore, load, loadMore, search } = useArchive()

const term = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
function onSearchInput(): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => search(term.value), 250)
}

function segmentsOf(text: string): RichSegment[] {
  return parseTextRich(text).segments
}

interface DateGroup {
  key: string
  label: string
  items: ArchivedItem[]
}

// Items arrive ordered by completion (newest first), so consecutive same-day
// items group naturally without a re-sort.
const groups = computed<DateGroup[]>(() => {
  const out: DateGroup[] = []
  let cur: DateGroup | null = null
  for (const it of items.value) {
    const d = it.completedAt ? new Date(it.completedAt) : null
    const key = d ? formatDateId(d) : 'unknown'
    if (!cur || cur.key !== key) {
      cur = {
        key,
        label: d
          ? `${formatMonth(d)} ${formatDayOfMonth(d)} · ${formatDayOfWeek(d)}`
          : '未注明日期',
        items: [],
      }
      out.push(cur)
    }
    cur.items.push(it)
  }
  return out
})

// Load fresh on each open (new items may have been archived since last time).
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) load()
  },
)
</script>

<template>
  <div class="arch" :class="{ '-open': open }">
    <div class="arch__scrim" @click="emit('close')" />

    <aside class="arch__panel" role="dialog" aria-label="History">
      <header class="arch__head">
        <h2 class="arch__title">History</h2>
        <button class="arch__close" type="button" aria-label="Close" @click="emit('close')">×</button>
      </header>

      <div class="arch__search">
        <input
          v-model="term"
          class="arch__search-input"
          type="text"
          placeholder="搜索已归档的待办…"
          @input="onSearchInput"
        />
      </div>

      <div class="arch__body">
        <p v-if="error" class="arch__error">加载失败:{{ error }}</p>
        <p v-else-if="loading && items.length === 0" class="arch__hint">加载中…</p>
        <p v-else-if="items.length === 0" class="arch__hint">
          还没有归档的内容。完成超过 60 天的待办会自动来到这里,随时可搜。
        </p>

        <template v-else>
          <section v-for="g in groups" :key="g.key" class="arch__group">
            <h3 class="arch__date">{{ g.label }}</h3>
            <ul class="arch__list">
              <li v-for="it in g.items" :key="it.id" class="arch__item">
                <span class="arch__check" aria-hidden="true">✓</span>
                <span class="arch__label"><span
                  v-for="(tag, ti) in it.tags"
                  :key="`tag-${ti}`"
                ><span
                    v-if="priorityLevel(tag)"
                    class="prio-badge"
                    :class="`-${priorityLevel(tag)}`"
                  >{{ priorityLevel(tag)?.toUpperCase() }}</span><span
                    v-else
                    class="tag-chip"
                    :style="{ '--tag-h': tagHue(tag) }"
                  >{{ '#' + tag }}</span><template v-if="ti < it.tags.length - 1 || it.text"> </template></span><template
                  v-for="(seg, i) in segmentsOf(it.text)"
                  :key="i"
                ><span
                    v-if="seg.kind === 'time'"
                    class="time-chip"
                    :class="{ '-cross': seg.time?.crossMidnight }"
                  >{{ seg.text }}</span><span
                    v-else-if="seg.text.trim()"
                  >{{ seg.text }}</span><template v-else>{{ seg.text }}</template></template></span>
              </li>
            </ul>
          </section>

          <button
            v-if="hasMore"
            class="arch__more"
            type="button"
            :disabled="loading"
            @click="loadMore"
          >
            {{ loading ? '加载中…' : '加载更多' }}
          </button>
        </template>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.arch {
  position: fixed;
  inset: 0;
  z-index: 50;
  pointer-events: none;
}

.arch__scrim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.28);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.arch__panel {
  position: absolute;
  top: 0;
  right: 0;
  width: min(420px, 90vw);
  height: 100%;
  background: var(--panel-bg);
  border-left: 1px solid var(--divider);
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.12);
  transform: translateX(100%);
  transition: transform 0.22s ease;
  display: flex;
  flex-direction: column;
}

.arch.-open {
  pointer-events: auto;
}

.arch.-open .arch__scrim {
  opacity: 1;
}

.arch.-open .arch__panel {
  transform: translateX(0);
}

.arch__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.25rem 0.75rem;
}

.arch__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--main-text);
}

.arch__close {
  border: none;
  background: transparent;
  color: var(--aside-text);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 0.25rem;
}

.arch__close:hover {
  color: var(--main-text);
}

.arch__search {
  padding: 0 1.25rem 0.75rem;
}

.arch__search-input {
  width: 100%;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--main-border-light);
  border-radius: 7px;
  background: var(--main-bg);
  color: var(--main-text);
  font: inherit;
  font-size: 0.9rem;
  outline: none;
}

.arch__search-input:focus {
  border-color: var(--accent);
}

.arch__body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 0.25rem 1.25rem 2rem;
}

.arch__hint,
.arch__error {
  margin: 1.5rem 0;
  font-size: 0.86rem;
  line-height: 1.5;
  color: var(--aside-text);
}

.arch__error {
  color: var(--accent);
}

.arch__group {
  margin-top: 1.1rem;
}

.arch__date {
  margin: 0 0 0.4rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--aside-text);
}

.arch__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.arch__item {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.3rem 0;
  border-bottom: 1px solid var(--divider);
  font-size: 0.92rem;
  line-height: 1.45;
}

.arch__check {
  flex: 0 0 auto;
  color: var(--accent);
  font-size: 0.78rem;
}

.arch__label {
  min-width: 0;
  word-break: break-word;
  color: var(--main-text);
}

.arch__more {
  margin-top: 1.25rem;
  width: 100%;
  padding: 0.55rem;
  border: 1px solid var(--main-border-light);
  border-radius: 7px;
  background: transparent;
  color: var(--aside-text);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}

.arch__more:hover:not(:disabled) {
  color: var(--highlight-text);
  border-color: var(--highlight-text);
}

.arch__more:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>

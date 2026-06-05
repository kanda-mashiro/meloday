<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useQuickCapture } from '../composables/useQuickCapture'
import { useTodoStore } from '../composables/useTodoStore'
import { INBOX_LIST_ID } from '../lib/constants'
import { parseSegments, tagHue } from '../lib/tags'
import TodoItemInput from './TodoItemInput.vue'

const { open, closeCapture } = useQuickCapture()
const store = useTodoStore()

const inputRef = ref<InstanceType<typeof TodoItemInput> | null>(null)

// Most recent captures, newest first, as a little confirmation.
const recent = ref<{ id: string; label: string }[]>([])

watch(open, async (isOpen) => {
  if (isOpen) {
    recent.value = []
    await nextTick()
    inputRef.value?.focus()
  }
})

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeCapture()
}

// Snapshot the latest inbox item right after each capture for feedback.
function onCaptured(): void {
  const items = store.inboxItems.value
  const last = items[items.length - 1]
  if (last) recent.value = [{ id: last.id, label: last.label }, ...recent.value].slice(0, 5)
}
</script>

<template>
  <div v-if="open" class="qc" @keydown="onKeydown">
    <div class="qc__scrim" @click="closeCapture" />
    <div class="qc__panel" role="dialog" aria-label="Quick capture">
      <div class="qc__head">
        <span class="qc__title">Capture to Inbox</span>
        <span class="qc__hint">Enter 添加 · Esc 关闭</span>
      </div>

      <div class="qc__input">
        <TodoItemInput
          ref="inputRef"
          :list-id="INBOX_LIST_ID"
          @captured="onCaptured"
        />
      </div>

      <ul v-if="recent.length" class="qc__recent">
        <li v-for="r in recent" :key="r.id" class="qc__recent-item">
          <span class="qc__check">✓</span>
          <template v-for="(seg, i) in parseSegments(r.label)" :key="i">
            <span
              v-if="seg.tag"
              class="tag-chip -static"
              :style="{ '--tag-h': tagHue(seg.tag) }"
            >{{ seg.text }}</span>
            <template v-else>{{ seg.text }}</template>
          </template>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.qc {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 16vh;
}

.qc__scrim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
}

.qc__panel {
  position: relative;
  width: min(560px, 92vw);
  background: var(--panel-bg);
  border: 1px solid var(--main-border-light);
  border-radius: 12px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
  padding: 1rem 1.1rem 1.1rem;
}

.qc__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.qc__title {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--highlight-text);
}

.qc__hint {
  font-size: 0.72rem;
  color: var(--disabled-text);
}

.qc__input {
  border: 1px solid var(--main-border-light);
  border-radius: 8px;
  padding: 0.15rem 0.5rem;
}

.qc__recent {
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.qc__recent-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.1rem;
  font-size: 0.88rem;
  color: var(--aside-text);
}

.qc__check {
  color: var(--accent);
  font-weight: 700;
}
</style>

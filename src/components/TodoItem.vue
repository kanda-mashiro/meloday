<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import type { TodoItem } from '../types/todo'
import { useTodoStore } from '../composables/useTodoStore'
import { useTagFilter } from '../composables/useTagFilter'
import { useNotes } from '../composables/useNotes'
import { useFocusSession } from '../composables/useFocusSession'
import { hasTag, tagHue } from '../lib/tags'
import { parseLabelRich } from '../lib/time'

const props = defineProps<{ item: TodoItem; focusable?: boolean }>()

const store = useTodoStore()
const { activeTag, toggle: toggleTag } = useTagFilter()
const notes = useNotes()
const focusSession = useFocusSession()

function startFocus(): void {
  focusSession.start({ id: props.item.id, label: props.item.label })
}

const segments = computed(() => parseLabelRich(props.item.label).segments)

const hasNote = computed(() => notes.hasNote(props.item.id))

function openNote(): void {
  notes.open({ id: props.item.id, label: props.item.label })
}

// In "focus mode" (a tag is active), items without that tag fade back.
const dimmed = computed(
  () => activeTag.value !== null && !hasTag(props.item.label, activeTag.value),
)

const editing = ref(false)
const draft = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

function onToggle(): void {
  store.checkItem({ id: props.item.id, done: !props.item.done })
}

async function startEditing(): Promise<void> {
  draft.value = props.item.label
  editing.value = true
  await nextTick()
  inputEl.value?.focus()
  inputEl.value?.select()
}

function commitEdit(): void {
  if (!editing.value) return
  editing.value = false
  const label = draft.value.trim()
  if (label === '') {
    store.deleteItem({ id: props.item.id })
    return
  }
  if (label !== props.item.label) {
    store.editItem({ id: props.item.id, label })
  }
}

function cancelEdit(): void {
  editing.value = false
}

function remove(): void {
  store.deleteItem({ id: props.item.id })
}
</script>

<template>
  <div class="todo-item" :class="{ '-done': item.done, '-dim': dimmed }">
    <button
      class="todo-item__check"
      type="button"
      role="checkbox"
      :aria-checked="item.done"
      :title="item.done ? 'Mark as not done' : 'Mark as done'"
      @click="onToggle"
    >
      <svg viewBox="0 0 16 16" class="todo-item__tick" aria-hidden="true">
        <path d="M3.5 8.5l3 3 6-7" />
      </svg>
    </button>

    <input
      v-if="editing"
      ref="inputEl"
      v-model="draft"
      class="todo-item__input"
      type="text"
      @blur="commitEdit"
      @keydown.enter.prevent="commitEdit"
      @keydown.esc.prevent="cancelEdit"
    />
    <span
      v-else
      class="todo-item__label"
      :title="item.label"
      @click.stop="startEditing"
    ><template v-for="(seg, i) in segments" :key="i"><span
        v-if="seg.kind === 'tag'"
        class="tag-chip"
        :class="{ '-on': activeTag === seg.tag?.toLowerCase() }"
        :style="{ '--tag-h': tagHue(seg.tag ?? '') }"
        @click.stop="seg.tag && toggleTag(seg.tag)"
      >{{ seg.text }}</span><span
        v-else-if="seg.kind === 'time'"
        class="time-chip"
        :class="{ '-cross': seg.time?.crossMidnight }"
      >{{ seg.text }}</span><span
        v-else-if="seg.text.trim()"
        class="todo-item__text"
      >{{ seg.text }}</span><template v-else>{{ seg.text }}</template></template></span>

    <button
      v-if="focusable"
      class="todo-item__focus"
      type="button"
      title="专注做这件事"
      aria-label="Focus"
      @click.stop="startFocus"
    >
      <svg viewBox="0 0 16 16" class="todo-item__focus-glyph" aria-hidden="true">
        <path d="M5 3.5l7 4.5-7 4.5z" />
      </svg>
    </button>

    <button
      class="todo-item__note"
      :class="{ '-has': hasNote }"
      type="button"
      :title="hasNote ? 'Open note' : 'Add note'"
      aria-label="Note"
      @click.stop="openNote"
    >
      <svg viewBox="0 0 16 16" class="todo-item__note-glyph" aria-hidden="true">
        <rect x="3.5" y="2.5" width="9" height="11" rx="1.5" />
        <path d="M5.5 6h5M5.5 8.5h5M5.5 11h3" />
      </svg>
    </button>

    <button
      class="todo-item__delete"
      type="button"
      title="Delete"
      aria-label="Delete"
      @click.stop="remove"
    >×</button>
  </div>
</template>

<style scoped>
.todo-item {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  /* Grow past one baseline row when the label wraps; single-line items still
     measure exactly --line-h, so they stay snapped to the ruled grid. */
  min-height: var(--line-h);
  padding: 0.25rem 0.35rem;
  transition: opacity 0.15s ease;
}

.todo-item.-dim {
  opacity: 0.3;
}

.todo-item__check {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.1rem;
  height: 1.1rem;
  padding: 0;
  border: 1.5px solid var(--main-border-light);
  border-radius: 5px;
  background: transparent;
  cursor: pointer;
  /* Hidden until you hover the row (done items show "done" via strikethrough). */
  visibility: hidden;
  transition: border-color 0.12s ease, background-color 0.12s ease;
}

.todo-item:hover .todo-item__check {
  visibility: visible;
}

.todo-item__check:hover {
  border-color: var(--accent);
}

.todo-item__tick {
  width: 0.8rem;
  height: 0.8rem;
  fill: none;
  stroke: transparent;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.todo-item.-done .todo-item__check {
  border-color: var(--accent);
  background: var(--accent);
}

.todo-item.-done .todo-item__tick {
  stroke: var(--main-bg);
}

.todo-item__label {
  flex: 1 1 auto;
  min-width: 0;
  /* The label doubles as the drag handle (see TodoList's `handle`), so show a
     grab cursor to hint it's draggable. A click still edits; drag reorders. */
  cursor: grab;
  /* Wrap long labels, but cap at 2 lines with an ellipsis so a pasted URL can't
     balloon the row. Full text shows on hover (title) and when editing. */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.45;
  color: var(--main-text);
}

.todo-item__label:active {
  cursor: grabbing;
}

.todo-item.-done .todo-item__label {
  color: var(--disabled-text);
}

/* Strike only the task words; chips just fade back. */
.todo-item.-done .todo-item__text {
  text-decoration: line-through;
}

.todo-item.-done .tag-chip,
.todo-item.-done .time-chip {
  opacity: 0.5;
}

.todo-item__input {
  flex: 1 1 auto;
  min-width: 0;
  font: inherit;
  color: var(--main-text);
  background: transparent;
  border: none;
  padding: 0;
  outline: none;
}

.todo-item__note {
  flex: 0 0 auto;
  visibility: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.3rem;
  height: 1.3rem;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--disabled-text);
  cursor: pointer;
}

.todo-item__note-glyph {
  width: 0.92rem;
  height: 0.92rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.todo-item:hover .todo-item__note {
  visibility: visible;
}

.todo-item__note:hover {
  color: var(--highlight-text);
  background: var(--button-active-bg);
}

/* A note exists → keep the icon visible and tinted, even without hover. */
.todo-item__note.-has {
  visibility: visible;
  color: var(--accent);
}

.todo-item__focus {
  flex: 0 0 auto;
  visibility: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.3rem;
  height: 1.3rem;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--disabled-text);
  cursor: pointer;
}

.todo-item__focus-glyph {
  width: 0.8rem;
  height: 0.8rem;
  fill: currentColor;
}

.todo-item:hover .todo-item__focus {
  visibility: visible;
}

.todo-item__focus:hover {
  color: var(--highlight-text);
  background: var(--button-active-bg);
}

.todo-item__delete {
  flex: 0 0 auto;
  visibility: hidden;
  width: 1.3rem;
  height: 1.3rem;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--disabled-text);
  font-size: 1.15rem;
  line-height: 1;
  cursor: pointer;
}

.todo-item__delete:hover {
  color: var(--highlight-text);
  background: var(--button-active-bg);
}

.todo-item:hover .todo-item__delete {
  visibility: visible;
}
</style>

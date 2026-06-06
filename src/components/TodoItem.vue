<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import type { TodoItem } from '../types/todo'
import { useTodoStore } from '../composables/useTodoStore'
import { useTagFilter } from '../composables/useTagFilter'
import { useNotes } from '../composables/useNotes'
import { useFocusSession } from '../composables/useFocusSession'
import { hasTag, tagHue, priorityLevel, topPriority } from '../lib/tags'
import { parseLabelRich } from '../lib/time'
import TaskMoveMenu from './TaskMoveMenu.vue'
import { useSelection } from '../composables/useSelection'

const props = defineProps<{ item: TodoItem; focusable?: boolean }>()

const store = useTodoStore()
const { activeTag, toggle: toggleTag } = useTagFilter()
const notes = useNotes()
const focusSession = useFocusSession()
const selection = useSelection()

// Click a task once to select it (highlight), again to edit it — a two-step
// like Finder, so a single stray click doesn't drop you into editing.
const selected = computed(() => selection.selectedId.value === props.item.id)
function onLabelClick(): void {
  if (selected.value) startEditing()
  else selection.select(props.item.id)
}

function startFocus(): void {
  focusSession.start({ id: props.item.id, label: props.item.label })
}

const parsed = computed(() => parseLabelRich(props.item.label))
const segments = computed(() => parsed.value.segments)
// Highest priority tag on this task (p0 > p1 > p2) — drives the row accent.
const priority = computed(() => topPriority(parsed.value.tags))

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

// The stored label uses pipe form ("#tag | text") so multi-word tags survive.
// When editing, drop the pipe if every tag is a single word (the common case),
// so the separator doesn't leak into the editor; multi-word tags keep it.
function toEditForm(label: string): string {
  const pipe = label.indexOf('|')
  if (pipe === -1 || !label.slice(0, pipe).includes('#')) return label
  const names = label
    .slice(0, pipe)
    .split('#')
    .map((s) => s.trim())
    .filter(Boolean)
  if (names.some((n) => /\s/.test(n))) return label
  const body = label.slice(pipe + 1).replace(/^\s+/, '')
  const tagPart = names.map((n) => `#${n}`).join(' ')
  return body ? `${tagPart} ${body}` : tagPart
}

async function startEditing(): Promise<void> {
  draft.value = toEditForm(props.item.label)
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

// Right-click opens a "move to date" context menu at the cursor.
const menu = ref<{ x: number; y: number } | null>(null)

function openMenu(event: MouseEvent): void {
  // Right-click selects the word under the cursor (the OS default, meant for
  // targeting the native menu). We show our own menu, so drop that stray
  // selection or it stays highlighted behind the menu.
  window.getSelection()?.removeAllRanges()
  menu.value = { x: event.clientX, y: event.clientY }
}

function closeMenu(): void {
  menu.value = null
}
</script>

<template>
  <div
    class="todo-item"
    :class="[{ '-done': item.done, '-dim': dimmed, '-selected': selected }, priority ? `-prio-${priority}` : '']"
    @contextmenu.prevent="openMenu($event)"
  >
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
      @click.stop="onLabelClick"
    ><template v-for="(seg, i) in segments" :key="i"><span
        v-if="seg.kind === 'tag' && priorityLevel(seg.tag ?? '')"
        class="prio-badge"
        :class="[`-${priorityLevel(seg.tag ?? '')}`, { '-on': activeTag === seg.tag?.toLowerCase() }]"
        @click.stop="seg.tag && toggleTag(seg.tag)"
      >{{ priorityLevel(seg.tag ?? '')?.toUpperCase() }}</span><span
        v-else-if="seg.kind === 'tag'"
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
    >
      <svg viewBox="0 0 16 16" class="todo-item__delete-glyph" aria-hidden="true">
        <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
      </svg>
    </button>

    <TaskMoveMenu
      v-if="menu"
      :item="item"
      :x="menu.x"
      :y="menu.y"
      @close="closeMenu"
      @note="openNote"
      @focus="startFocus"
    />
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

/* Selected (first click): highlight the row and reveal its actions; a second
   click on the label then enters editing. */
.todo-item.-selected {
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px var(--accent);
  border-radius: 6px;
}

.todo-item.-selected .todo-item__check,
.todo-item.-selected .todo-item__focus,
.todo-item.-selected .todo-item__note,
.todo-item.-selected .todo-item__delete {
  visibility: visible;
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

.todo-item__delete-glyph {
  width: 0.85rem;
  height: 0.85rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
}

.todo-item__delete:hover {
  color: var(--highlight-text);
  background: var(--button-active-bg);
}

.todo-item:hover .todo-item__delete {
  visibility: visible;
}

/* Priority tags (#p0/#p1/#p2): fixed-color badges, plus a left accent strip on
   the row for p0/p1 so urgent tasks stand out when scanning the board. p2 is a
   quiet badge only. */
.prio-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.06rem 0.4rem;
  border-radius: 5px;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #fff;
  cursor: pointer;
}

.prio-badge.-p0 {
  background: #e0524e;
}

.prio-badge.-p1 {
  background: #e07b39;
}

.prio-badge.-p2 {
  background: #6b7a90;
}

.prio-badge.-on {
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.65);
}

.todo-item.-prio-p0,
.todo-item.-prio-p1 {
  position: relative;
}

.todo-item.-prio-p0::before,
.todo-item.-prio-p1::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.3rem;
  bottom: 0.3rem;
  width: 3px;
  border-radius: 2px;
}

.todo-item.-prio-p0::before {
  background: #e0524e;
}

.todo-item.-prio-p1::before {
  background: #e07b39;
}
</style>

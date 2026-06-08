<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TodoItem } from '../types/todo'
import { useTodoStore } from '../composables/useTodoStore'
import { useTagFilter } from '../composables/useTagFilter'
import { useNotes } from '../composables/useNotes'
import { useFocusSession } from '../composables/useFocusSession'
import { hasTag, labelText, tagHue, priorityLevel, topPriority } from '../lib/tags'
import { parseTextRich } from '../lib/time'
import { dueUrgency, dueRelative } from '../lib/due'
import TaskMoveMenu from './TaskMoveMenu.vue'
import TodoItemInput from './TodoItemInput.vue'
import { useSelection } from '../composables/useSelection'
import { useToast } from '../composables/useToast'

const props = defineProps<{ item: TodoItem; focusable?: boolean }>()

const store = useTodoStore()
const { activeTag, toggle: toggleTag } = useTagFilter()
const notes = useNotes()
const focusSession = useFocusSession()
const selection = useSelection()
const { showToast } = useToast()

// Click a task once to select it (highlight), again to edit it — a two-step
// like Finder, so a single stray click doesn't drop you into editing.
const selected = computed(() => selection.selectedId.value === props.item.id)
function onLabelClick(): void {
  if (selected.value) startEditing()
  else selection.select(props.item.id)
}

function startFocus(): void {
  focusSession.start({ id: props.item.id, label: labelText(props.item) })
}

// Time chips + plain text from the body; tags render separately from item.tags.
const segments = computed(() => parseTextRich(props.item.text).segments)
// Highest priority tag on this task (p0 > p1 > p2) — drives the row accent.
const priority = computed(() => topPriority(props.item.tags))

const hasNote = computed(() => notes.hasNote(props.item.id))

// Relative, human countdown for the due date (see dueRelative).
const dueLabel = computed(() => (props.item.due ? dueRelative(props.item.due) : ''))

const dueClass = computed(() =>
  props.item.due ? `-${dueUrgency(props.item.due)}` : '',
)

function openNote(): void {
  notes.open({ id: props.item.id, label: labelText(props.item) })
}

// In "focus mode" (a tag is active), items without that tag fade back.
const dimmed = computed(
  () => activeTag.value !== null && !hasTag(props.item.tags, activeTag.value),
)

const editing = ref(false)

function onToggle(): void {
  store.checkItem({ id: props.item.id, done: !props.item.done })
}

// The shared tag-aware input drives editing too (mode="edit"); it auto-focuses
// on mount, so all we do here is flip into editing.
function startEditing(): void {
  editing.value = true
}

function remove(): void {
  store.deleteItem({ id: props.item.id })
  showToast('已删除 · ⌘Z 撤销')
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

    <TodoItemInput
      v-if="editing"
      mode="edit"
      :list-id="item.listId"
      :edit-item="item"
      @done="editing = false"
    />
    <span
      v-else
      class="todo-item__label"
      :title="labelText(item)"
      @click.stop="onLabelClick"
    ><span
        v-for="(tag, ti) in item.tags"
        :key="`tag-${ti}`"
      ><span
          v-if="priorityLevel(tag)"
          class="prio-badge"
          :class="[`-${priorityLevel(tag)}`, { '-on': activeTag === tag.toLowerCase() }]"
          @click.stop="toggleTag(tag)"
        >{{ priorityLevel(tag)?.toUpperCase() }}</span><span
          v-else
          class="tag-chip"
          :class="{ '-on': activeTag === tag.toLowerCase() }"
          :style="{ '--tag-h': tagHue(tag) }"
          @click.stop="toggleTag(tag)"
        >{{ '#' + tag }}</span><template v-if="ti < item.tags.length - 1 || item.text"> </template></span><template v-for="(seg, i) in segments" :key="i"><span
        v-if="seg.kind === 'time'"
        class="time-chip"
        :class="{ '-cross': seg.time?.crossMidnight }"
      >{{ seg.text }}</span><span
        v-else-if="seg.text.trim()"
        class="todo-item__text"
      >{{ seg.text }}</span><template v-else>{{ seg.text }}</template></template></span>

    <!-- Relative countdown badge: a quiet, human phrase whose color escalates
         with urgency (overdue/today red, soon amber, later neutral). -->
    <span v-if="item.due && !editing" class="todo-item__due" :class="dueClass">
      <svg viewBox="0 0 16 16" class="todo-item__due-glyph" aria-hidden="true">
        <circle cx="8" cy="8.5" r="5" />
        <path d="M8 5.5v3l2 1.5" />
      </svg>{{ dueLabel }}</span>

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

/* Relative countdown badge. Small, quiet text after the label; a tiny clock
   glyph leads it. Color escalates by urgency but stays muted, never loud. */
.todo-item__due {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.7rem;
  line-height: 1;
  white-space: nowrap;
  color: var(--aside-text);
}

.todo-item__due-glyph {
  width: 0.72rem;
  height: 0.72rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Overdue & today share the urgent red family. */
.todo-item__due.-overdue,
.todo-item__due.-today {
  /* Muted red — urgent but calm; defined locally so we touch only this file. */
  --due-overdue: #c0392b;
  color: var(--due-overdue);
}

.todo-item__due.-soon {
  color: var(--amber-strong);
}

.todo-item__due.-later {
  color: var(--aside-text);
}

/* A finished task's deadline no longer matters — fade the badge back. */
.todo-item.-done .todo-item__due {
  opacity: 0.4;
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

/* Priority tags (#p0/#p1/#p2): a matching left accent strip on the row. The
   .prio-badge chip itself is styled globally (shared with the tag input). */
.todo-item.-prio-p0,
.todo-item.-prio-p1,
.todo-item.-prio-p2 {
  position: relative;
}

.todo-item.-prio-p0::before,
.todo-item.-prio-p1::before,
.todo-item.-prio-p2::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.3rem;
  bottom: 0.3rem;
  width: 3px;
  border-radius: 2px;
}

.todo-item.-prio-p0::before {
  background: var(--prio-p0);
}

.todo-item.-prio-p1::before {
  background: var(--prio-p1);
}

.todo-item.-prio-p2::before {
  background: var(--prio-p2);
}
</style>

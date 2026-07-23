<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
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

const queue = computed(() => store.queueFor(props.item.id))
const hasQueue = computed(() => (queue.value?.total ?? 0) > 0)
const expanded = ref(false)
const addingSubtask = ref(false)
const editingSubtaskId = ref<string | null>(null)
const subtaskAdder = ref<InstanceType<typeof TodoItemInput> | null>(null)

async function startAddingSubtask(): Promise<void> {
  expanded.value = true
  addingSubtask.value = true
  await nextTick()
  subtaskAdder.value?.focus()
}

function toggleQueue(): void {
  expanded.value = !expanded.value
}

function onQueueControl(): void {
  if (expanded.value) {
    expanded.value = false
    addingSubtask.value = false
    editingSubtaskId.value = null
  } else if (hasQueue.value) {
    toggleQueue()
  } else {
    void startAddingSubtask()
  }
}

function startEditingSubtask(item: TodoItem): void {
  addingSubtask.value = false
  editingSubtaskId.value = item.id
}

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
function segmentsOf(text: string) {
  return parseTextRich(text).segments
}
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

function toggleSubtask(item: TodoItem): void {
  const nextId = store.checkItem({ id: item.id, done: !item.done })
  if (!item.done && nextId) {
    const next = store.state.items.find((candidate) => candidate.id === nextId)
    if (next) showToast(`下一项：${labelText(next)}`)
  } else if (!item.done && !nextId) {
    showToast('所有子任务已完成')
  }
}

function removeSubtask(item: TodoItem): void {
  store.deleteItem({ id: item.id })
  showToast('已删除子任务 · ⌘Z 撤销')
}

function removeAllSubtasks(): void {
  store.deleteSubtasks({ id: props.item.id })
  showToast('已删除全部子任务 · ⌘Z 撤销')
}

// The shared tag-aware input drives editing too (mode="edit"); it auto-focuses
// on mount, so all we do here is flip into editing.
function startEditing(): void {
  editing.value = true
}

// The global Enter / i shortcut requests an edit by id; the matching row opens
// its editor and clears the one-shot request.
watch(
  () => selection.editRequestId.value,
  (id) => {
    if (id === props.item.id) {
      selection.editRequestId.value = null
      startEditing()
    }
  },
)

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
  <div class="todo-item-shell" @click.stop>
    <div
      class="todo-item"
      :class="[{ '-done': item.done, '-dim': dimmed, '-selected': selected }, priority ? `-prio-${priority}` : '']"
      @contextmenu.prevent="openMenu($event)"
    >
    <button
      v-if="!editing"
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
        >{{ '#' + tag }}</span></span><template v-for="(seg, i) in segments" :key="i"><span
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
        v-if="!editing"
        class="todo-item__queue-badge"
        :class="{ '-open': expanded, '-empty': !hasQueue }"
        type="button"
        :title="expanded ? '收起子任务' : (hasQueue ? '展开子任务' : '添加子任务')"
        @click.stop="onQueueControl"
      >
        <template v-if="hasQueue">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 4h8M5 8h8M5 12h8"/><circle cx="2.5" cy="4" r=".7"/><circle cx="2.5" cy="8" r=".7"/><circle cx="2.5" cy="12" r=".7"/></svg>
          {{ queue?.completed }}/{{ queue?.total }}
        </template>
        <template v-else>＋ 子任务</template>
      </button>

      <button
        v-if="focusable && !editing"
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
        v-if="!editing"
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
        v-if="!editing"
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

    <section v-if="expanded" class="todo-item-queue">
      <header class="todo-item-queue__head">
        <span>子任务</span>
        <span v-if="queue" class="todo-item-queue__progress">已完成 {{ queue.completed }}/{{ queue.total }}</span>
        <button
          v-if="hasQueue"
          class="todo-item-queue__delete-all"
          type="button"
          title="删除全部子任务"
          @click.stop="removeAllSubtasks"
        >删除全部</button>
      </header>

      <ol v-if="queue" class="todo-item-queue__list">
        <li
          v-for="(step, index) in queue.items"
          :key="step.id"
          class="todo-item-queue__step"
          :class="{ '-done': step.done, '-current': queue.current?.id === step.id }"
        >
          <template v-if="editingSubtaskId === step.id">
            <span class="todo-item-queue__edit-spacer" />
            <span class="todo-item-queue__order">{{ index + 1 }}</span>
            <TodoItemInput
              class="todo-item-queue__editor"
              mode="edit"
              :list-id="step.listId"
              :edit-item="step"
              @done="editingSubtaskId = null"
            />
          </template>
          <template v-else>
            <button
              class="todo-item-queue__check"
              type="button"
              role="checkbox"
              :aria-checked="step.done"
              @click.stop="toggleSubtask(step)"
            ><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg></button>
            <span class="todo-item-queue__order">{{ index + 1 }}</span>
            <span
              class="todo-item-queue__label"
              role="button"
              tabindex="0"
              :title="`点击修改：${labelText(step)}`"
              @click.stop="startEditingSubtask(step)"
              @keydown.enter.stop.prevent="startEditingSubtask(step)"
            ><template
              v-for="(tag, tagIndex) in step.tags"
              :key="`queue-tag-${tagIndex}`"
            ><span
                v-if="priorityLevel(tag)"
                class="prio-badge"
                :class="`-${priorityLevel(tag)}`"
              >{{ priorityLevel(tag)?.toUpperCase() }}</span><span
                v-else
                class="tag-chip"
                :style="{ '--tag-h': tagHue(tag) }"
              >{{ '#' + tag }}</span></template><template
              v-for="(segment, segmentIndex) in segmentsOf(step.text)"
              :key="`queue-segment-${segmentIndex}`"
            ><span
                v-if="segment.kind === 'time'"
                class="time-chip"
                :class="{ '-cross': segment.time?.crossMidnight }"
              >{{ segment.text }}</span><span
              v-else-if="segment.text.trim()"
              class="todo-item-queue__text"
            >{{ segment.text }}</span><template v-else>{{ segment.text }}</template></template></span>
            <span v-if="queue.current?.id === step.id && !step.done" class="todo-item-queue__now">当前</span>
            <button
              class="todo-item-queue__remove"
              type="button"
              title="删除此步骤"
              @click.stop="removeSubtask(step)"
            >×</button>
          </template>
        </li>
      </ol>

      <TodoItemInput
        v-if="addingSubtask"
        ref="subtaskAdder"
        class="todo-item-queue__adder"
        :list-id="item.listId"
        :subtask-for="item.id"
        @blur-empty="addingSubtask = false"
      />
      <button
        v-else
        class="todo-item-queue__add"
        type="button"
        @click.stop="startAddingSubtask"
      >＋ 添加子任务</button>
    </section>
  </div>
</template>

<style scoped>
.todo-item-shell {
  min-width: 0;
}

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
.todo-item.-selected .todo-item__queue-badge.-empty,
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

/* Breathing room between each tag chip and the next chip / the body text
   (replaces the old single-space separator for a steadier, roomier gap). */
.todo-item__label .tag-chip,
.todo-item__label .prio-badge {
  margin-right: 0.4rem;
}

.todo-item__label {
  flex: 1 1 auto;
  min-width: 0;
  /* The label doubles as the drag handle (see TodoList's `handle`), so show a
     grab cursor to hint it's draggable. A click still edits; drag reorders. */
  cursor: grab;
  /* Chips + body flow inline and wrap; cap at 2 lines so a pasted URL can't
     balloon the row (full text shows on hover via title, and when editing).
     A plain max-height clip rather than -webkit-line-clamp: Safari's line-clamp
     mis-truncates inline-flex chips mid-row (ellipsising a middle chip), so we
     trade the trailing "…" for chips that render intact. */
  display: block;
  line-height: 1.45;
  max-height: calc(1.45em * 2);
  overflow: hidden;
  overflow-wrap: anywhere;
  word-break: break-word;
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

.todo-item__queue-badge {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 1.3rem;
  padding: 0 0.3rem;
  border: none;
  border-radius: 4px;
  background: transparent;
  font: inherit;
  font-size: 0.68rem;
  cursor: pointer;
  gap: 0.18rem;
  visibility: visible;
  color: var(--aside-text);
}

.todo-item__queue-badge svg {
  width: 0.85rem;
  height: 0.85rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.35;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.todo-item__queue-badge:hover,
.todo-item__queue-badge.-open {
  color: var(--highlight-text);
  background: var(--button-active-bg);
}

.todo-item__queue-badge.-empty {
  visibility: hidden;
  padding: 0 0.38rem;
  white-space: nowrap;
}

.todo-item:hover .todo-item__queue-badge.-empty {
  visibility: visible;
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

.todo-item-queue {
  margin: 0.1rem 0.35rem 0.55rem 1.95rem;
  overflow: hidden;
  border: 1px solid var(--main-border-light);
  border-radius: 8px;
  background: color-mix(in srgb, var(--panel-bg) 88%, var(--accent-soft));
  box-shadow: 0 5px 16px rgba(0, 0, 0, 0.06);
}

.todo-item-queue__head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2rem;
  padding: 0.35rem 0.55rem;
  border-bottom: 1px solid var(--main-border-light);
  color: var(--aside-text);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.todo-item-queue__progress {
  font-weight: 500;
  letter-spacing: 0;
}

.todo-item-queue__delete-all {
  margin-left: auto;
  padding: 0.15rem 0.3rem;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--disabled-text);
  font: inherit;
  font-size: 0.68rem;
  cursor: pointer;
}

.todo-item-queue__delete-all:hover {
  background: var(--button-active-bg);
  color: var(--highlight-text);
}

.todo-item-queue__list {
  margin: 0;
  padding: 0.2rem 0;
  list-style: none;
}

.todo-item-queue__step {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 1.9rem;
  padding: 0.2rem 0.45rem;
  color: var(--main-text);
  font-size: 0.78rem;
}

.todo-item-queue__step.-current {
  background: var(--accent-soft);
}

.todo-item-queue__step.-done {
  color: var(--disabled-text);
}

.todo-item-queue__check {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 0.95rem;
  height: 0.95rem;
  padding: 0;
  border: 1.3px solid var(--main-border-light);
  border-radius: 4px;
  background: transparent;
  color: transparent;
  cursor: pointer;
}

.todo-item-queue__check svg {
  width: 0.72rem;
  height: 0.72rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.todo-item-queue__step.-done .todo-item-queue__check {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--main-bg);
}

.todo-item-queue__order {
  flex: 0 0 auto;
  width: 1rem;
  color: var(--disabled-text);
  font-size: 0.66rem;
  text-align: center;
}

.todo-item-queue__edit-spacer {
  flex: 0 0 auto;
  width: 0.95rem;
}

.todo-item-queue__editor {
  flex: 1 1 auto;
  min-width: 0;
}

.todo-item-queue__editor :deep(.todo-item-input__bullet) {
  display: none;
}

.todo-item-queue__label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: text;
}

.todo-item-queue__label:hover,
.todo-item-queue__label:focus-visible {
  color: var(--highlight-text);
  outline: none;
}

.todo-item-queue__label .tag-chip,
.todo-item-queue__label .prio-badge,
.todo-item-queue__label .time-chip {
  margin-right: 0.35rem;
}

.todo-item-queue__step.-done .todo-item-queue__label {
  text-decoration: line-through;
}

.todo-item-queue__now {
  flex: 0 0 auto;
  padding: 0.05rem 0.3rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--highlight-text);
  font-size: 0.62rem;
  font-weight: 700;
}

.todo-item-queue__remove {
  flex: 0 0 auto;
  visibility: hidden;
  width: 1.1rem;
  height: 1.1rem;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--disabled-text);
  font: inherit;
  cursor: pointer;
}

.todo-item-queue__step:hover .todo-item-queue__remove {
  visibility: visible;
}

.todo-item-queue__remove:hover {
  background: var(--button-active-bg);
  color: var(--highlight-text);
}

.todo-item-queue__adder {
  padding: 0 0.45rem;
  border-top: 1px solid var(--main-border-light);
}

.todo-item-queue__add {
  width: 100%;
  padding: 0.45rem 0.55rem;
  border: none;
  border-top: 1px solid var(--main-border-light);
  background: transparent;
  color: var(--aside-text);
  font: inherit;
  font-size: 0.72rem;
  text-align: left;
  cursor: pointer;
}

.todo-item-queue__add:hover {
  background: var(--button-active-bg);
  color: var(--highlight-text);
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

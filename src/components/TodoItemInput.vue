<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue'
import type { TodoItem } from '../types/todo'
import { useTodoStore } from '../composables/useTodoStore'
import { useImeEnter } from '../composables/useImeEnter'
import { tagHue, priorityLevel, topPriority } from '../lib/tags'
import { parseDue, dueRelative, dueUrgency } from '../lib/due'

const props = withDefaults(
  defineProps<{ listId: string; mode?: 'add' | 'edit'; editItem?: TodoItem }>(),
  { mode: 'add' },
)
const emit = defineEmits<{ blurEmpty: []; captured: []; done: [] }>()

const store = useTodoStore()

type Mode = 'body' | 'tag' | 'date'

const tags = ref<string[]>([])
const text = ref('')
const due = ref<string | null>(null)
const inputMode = ref<Mode>('body')
const inputEl = ref<HTMLInputElement | null>(null)
const rootEl = ref<HTMLElement | null>(null)
// In-place tag editing: the chip at `editIdx` becomes editable text (a
// contenteditable span — auto-sizes to its content natively, so no width/caret
// hacks) right where it sits, while the body stays put and visible.
const editIdx = ref<number | null>(null)
const editTagText = ref('')
const tagEditEl = ref<HTMLElement | null>(null)
// The chip editor is initialized HERE, the instant its element mounts — not via
// a deferred nextTick on a shared ref. When Backspace steps between chips, the
// old chip unmounts (ref fires null) and the new one mounts (ref fires the
// element) in an undefined order; a nextTick that reads the shared ref could see
// the null and bail, leaving the new chip blank and unfocused. Seeding text +
// focus + caret right on mount, and ignoring the null unmount calls, makes it
// robust to that ordering and to index-key reuse in the v-for.
function setTagEditEl(el: unknown): void {
  const node = (el as HTMLElement) ?? null
  if (!node) return // unmount call — keep tagEditEl pointing at the live editor
  tagEditEl.value = node
  if (editIdx.value === null) return
  // Seed the text now (safe during the patch), but defer focus + caret to the
  // next tick — focus() called mid-patch is unreliable and silently no-ops in
  // some browsers. Close over THIS node so we never read the shared ref (which a
  // sibling's unmount may have just nulled).
  node.textContent = tags.value[editIdx.value]
  refocusing = true // focus is about to move into this chip; finalize must wait
  void nextTick(() => {
    node.focus()
    const range = document.createRange()
    range.selectNodeContents(node)
    range.collapse(false)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    refocusing = false
  })
}
function onTagInput(e: Event): void {
  editTagText.value = (e.target as HTMLElement).textContent ?? ''
}

// Highest priority among the entered tags — drives the row's left accent strip.
const priority = computed(() => topPriority(tags.value))

// A leading '#' or fullwidth '＃' (what a Chinese IME produces) starts a tag.
// The keydown handler catches the keypress, but IME-inserted punctuation can
// slip past it, so this also converts a marker that lands at the start of the
// body — then strips it, since the marker itself isn't part of the tag.
watch(text, (val) => {
  if (inputMode.value !== 'body') return
  if (val[0] === '#' || val[0] === '＃') {
    // Strip the marker, then either type the tag in the main field (fresh row)
    // or, when there's already a body, hand off to an inline chip so the body
    // isn't swallowed into the tag name.
    const rest = val.slice(1)
    text.value = rest
    if (rest === '') inputMode.value = 'tag'
    else startNewTag()
  } else if (val === '!' || val === '！') {
    // Only a bare leading '!' opens date mode. With a body present, leave the
    // '!' literal — submit()'s parseDue lifts any inline !token at save time,
    // so it never needs to hijack the field.
    inputMode.value = 'date'
    text.value = ''
  }
})

const placeholder = computed(() => {
  if (inputMode.value === 'tag') return 'tag… (Enter to seal)'
  if (inputMode.value === 'date') return '明天 / 周五 / 6/20…'
  return tags.value.length ? 'what to do…' : 'Add todo…'
})

// Urgency bucket for the sealed deadline chip, mirroring TodoItem's due badge.
const dueUrgencyClass = computed(() => (due.value ? `-${dueUrgency(due.value)}` : ''))

// Live preview while typing in date mode: resolve what's typed so far the same
// way trySealDate will. Null until a full expression parses (so "3" before
// "3天后" shows nothing — no flicker), then drives a light "→ {relative}" hint.
const previewDue = computed(() =>
  inputMode.value === 'date' ? parseDue('!' + text.value.trim()).due : null,
)
const previewUrgencyClass = computed(() =>
  previewDue.value ? `-${dueUrgency(previewDue.value)}` : '',
)

function focus(): void {
  inputEl.value?.focus()
}

// Returning to the body from a chip lands the caret at the body's START — tags
// sit at the front, so that's where editing was happening (right before the
// existing body text), not the far end.
function focusBodyStart(): void {
  focus()
  void nextTick(() => inputEl.value?.setSelectionRange(0, 0))
}

defineExpose({ focus })

// Edit mode: prefill from the item and focus with the cursor at the end (not
// select-all), so the editor opens ready to continue typing.
onMounted(() => {
  if (props.mode === 'edit' && props.editItem) {
    tags.value = [...props.editItem.tags]
    text.value = props.editItem.text
    due.value = props.editItem.due ?? null
    const el = inputEl.value
    if (el) {
      el.focus()
      const end = el.value.length
      el.setSelectionRange(end, end)
    }
  }
})

// Set once the editor has handed control back (Escape-cancel or a commit), so a
// trailing focusout from the unmount doesn't fire a second commit.
let closing = false

// True while we're programmatically moving focus INTO a chip (set in
// setTagEditEl, cleared once that focus lands). It marks the one genuinely
// ambiguous moment in this widget: during a chip→chip hand-off the old chip is
// already gone but the new one isn't focused yet, so focus sits transiently on
// <body> — indistinguishable, in that instant, from a real click-away. The flag
// names that "refocus in flight" state so finalize can wait it out instead of
// mistaking it for leaving the row.
let refocusing = false

// The row owns several focusable parts — the body <input> and an inline chip
// editor that comes and goes. The ONLY thing that finalizes the editor is focus
// leaving the whole row; focus moving *between* those parts is an internal
// hand-off. We decide on the next tick by reading document.activeElement (the
// settled answer), and if a refocus is still in flight we wait one more tick.
let finalizeScheduled = false
function onRowFocusOut(): void {
  if (finalizeScheduled) return
  finalizeScheduled = true
  void nextTick(finalizeIfFocusLeft)
}

function finalizeIfFocusLeft(): void {
  finalizeScheduled = false
  if (closing) return
  // A programmatic refocus hasn't landed yet — re-check after it does, rather
  // than judge "left the row" while focus is mid-air.
  if (refocusing) {
    finalizeScheduled = true
    void nextTick(finalizeIfFocusLeft)
    return
  }
  const active = document.activeElement
  // A chip editor that no longer holds focus commits its text — whether focus
  // moved to the body, to another chip, or off the row entirely.
  if (editIdx.value !== null && active !== tagEditEl.value) commitTagEdit()
  // Focus is still inside the row → internal hand-off, nothing to finalize.
  if (rootEl.value && active && rootEl.value.contains(active)) return
  // Focus truly left the row: seal any in-progress tag/date draft, then commit
  // (edit mode always commits; an empty add-row just dismisses itself).
  if (inputMode.value === 'tag') sealTag()
  else if (inputMode.value === 'date') sealDate()
  if (props.mode === 'edit') {
    submit()
    return
  }
  if (text.value.trim() === '' && tags.value.length === 0 && due.value === null) {
    emit('blurEmpty')
    return
  }
  submit()
  emit('blurEmpty')
}

// IME-aware Enter guard (see useImeEnter): swallows keys that belong to the
// composition, including Safari's confirm-Enter that arrives after compositionend.
const { onCompositionEnd, isImeEnter } = useImeEnter()

function onKeydown(e: KeyboardEvent): void {
  // While an IME is composing, the keys belong to it (Backspace edits the
  // half-typed text, Enter commits a candidate, etc.). Running our shortcuts
  // here mangles the composition — bail until it's committed.
  if (e.isComposing || e.keyCode === 229) return

  if (e.key === 'Escape') {
    // Edit mode: cancel without saving and close the editor.
    if (props.mode === 'edit') {
      e.preventDefault()
      closing = true
      emit('done')
      return
    }
    text.value = ''
    tags.value = []
    due.value = null
    inputMode.value = 'body'
    inputEl.value?.blur()
    return
  }

  // '#' starts a tag (the '#' itself isn't typed). On an empty field it opens
  // tag mode in the main input; with a body already present, a '#' at the very
  // start drops a new inline chip instead (so the body stays visible). A '#'
  // mid-body is left literal.
  if ((e.key === '#' || e.key === '＃') && inputMode.value === 'body') {
    if (text.value === '') {
      e.preventDefault()
      inputMode.value = 'tag'
      return
    }
    const el = inputEl.value
    if (el && el.selectionStart === 0 && el.selectionEnd === 0) {
      e.preventDefault()
      startNewTag()
      return
    }
  }

  // '!' on an empty field enters date mode (the '!' itself isn't typed),
  // mirroring tag mode. Only one deadline, so skip if one is already sealed.
  if (
    (e.key === '!' || e.key === '！') &&
    inputMode.value === 'body' &&
    text.value === '' &&
    due.value === null
  ) {
    e.preventDefault()
    inputMode.value = 'date'
    return
  }

  // Space seals a date in date mode if the typed expression parses (mirrors how
  // Enter seals); otherwise it falls through as a normal space.
  if (e.key === ' ' && inputMode.value === 'date' && trySealDate()) {
    e.preventDefault()
    return
  }

  if (e.key === 'Enter') {
    e.preventDefault()
    // The IME-confirming Enter that Safari delivers just after compositionend:
    // it only commits the candidate, it must not also submit the todo.
    if (isImeEnter(e)) return
    if (inputMode.value === 'tag') {
      sealTag()
    } else if (inputMode.value === 'date') {
      // Only leave date mode once a valid deadline parses; stay put on garbage.
      trySealDate()
    } else {
      submit()
    }
    return
  }

  if (e.key === 'Backspace') {
    // Leave tag mode if the in-progress tag is empty.
    if (inputMode.value === 'tag' && text.value === '') {
      e.preventDefault()
      inputMode.value = 'body'
      return
    }
    // Leave date mode if the in-progress date is empty.
    if (inputMode.value === 'date' && text.value === '') {
      e.preventDefault()
      inputMode.value = 'body'
      return
    }
    // Backspace at the very START of the body opens the last tag for in-place
    // editing (the chip becomes editable text where it sits; the body stays
    // visible — it couldn't be edited from position 0 anyway).
    if (inputMode.value === 'body' && tags.value.length) {
      const el = inputEl.value
      if (el && el.selectionStart === 0 && el.selectionEnd === 0) {
        e.preventDefault()
        startTagEdit(tags.value.length - 1)
      }
    }
  }
}

function sealTag(): void {
  const name = text.value.trim()
  if (name) tags.value.push(name)
  text.value = ''
  inputMode.value = 'body'
}

function removeTag(index: number): void {
  tags.value.splice(index, 1)
  focus()
}

// Add a brand-new tag while the body already has text: drop an empty editable
// chip at the end of the tag row and focus it (reusing the inline-edit
// machinery), so the body stays visible and put. Enter seals it; an emptied
// chip removes itself on commit, so abandoning it leaves no trace.
function startNewTag(): void {
  tags.value.push('')
  startTagEdit(tags.value.length - 1)
}

// --- in-place tag editing (the chip's text becomes editable, no separate box) -
// Just flip state: mounting the editor element runs the seed/focus/caret in
// setTagEditEl above, so there's no nextTick race to get wrong.
function startTagEdit(i: number): void {
  if (i < 0 || i >= tags.value.length) return
  // Switching straight from one chip to another (e.g. clicking chip B while
  // editing chip A) must commit A first, or its edit is silently dropped. If A
  // was emptied, commit removes it and everything after shifts left — including
  // our target index when it sat to A's right.
  if (editIdx.value !== null && editIdx.value !== i) {
    const prev = editIdx.value
    const prevEmptied = editTagText.value.trim() === ''
    commitTagEdit()
    if (prevEmptied && prev < i) i -= 1
  }
  editTagText.value = tags.value[i]
  editIdx.value = i
}

// Write the inline edit back to its tag (empty → drop the tag) and exit editing.
function commitTagEdit(): void {
  if (editIdx.value === null) return
  const i = editIdx.value
  const name = editTagText.value.trim()
  if (name) tags.value[i] = name
  else tags.value.splice(i, 1)
  editIdx.value = null
  editTagText.value = ''
}

function onTagEditKeydown(e: KeyboardEvent, i: number): void {
  // While editing a chip, every key belongs to the chip editor — keep them from
  // bubbling to the board's global shortcuts (Backspace=delete item, Space, …).
  // The global guard relies on isContentEditable, which is unreliable once this
  // very key removes the chip from the DOM mid-dispatch.
  e.stopPropagation()
  if (e.isComposing || e.keyCode === 229) return
  if (e.key === 'Enter') {
    e.preventDefault()
    if (isImeEnter(e)) return
    commitTagEdit()
    focusBodyStart() // back to the body, caret before the existing text
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    editIdx.value = null // cancel without writing
    editTagText.value = ''
    focusBodyStart()
    return
  }
  // Backspace on an emptied chip removes it and returns to the body — one
  // predictable step. (Reaching back INTO a tag is the body-start Backspace
  // gesture; we don't auto-dive into the previous chip from here.)
  if (e.key === 'Backspace' && editTagText.value === '') {
    e.preventDefault()
    tags.value.splice(i, 1)
    editIdx.value = null
    focusBodyStart()
  }
}

// Parse the typed date expression (e.g. "明天", "6/20") by reusing parseDue
// with the '!' prefix it expects. Seals into `due` and returns to body mode on
// success; returns false (and stays in date mode) when nothing valid parsed.
function trySealDate(): boolean {
  const { due: parsed } = parseDue('!' + text.value.trim())
  if (!parsed) return false
  due.value = parsed
  text.value = ''
  inputMode.value = 'body'
  return true
}

// Blur seal: commit a valid date, but never block the blur — drop an
// unparseable in-progress expression and fall back to body mode.
function sealDate(): void {
  trySealDate()
  text.value = ''
  inputMode.value = 'body'
}

function clearDue(): void {
  due.value = null
  focus()
}

function submit(): void {
  // The deadline lives in `due` (sealed via date mode); the body is plain text.
  // Still run parseDue to lift any stray inline !token a user typed mid-text,
  // preferring an already-sealed `due` over it.
  const { text: body, due: inlineDue } = parseDue(text.value)
  const finalText = body.trim()
  const finalDue = due.value ?? inlineDue ?? undefined

  if (props.mode === 'edit' && props.editItem) {
    closing = true
    // Emptied out entirely → delete the item; otherwise commit the edit.
    if (tags.value.length === 0 && finalText === '') {
      store.deleteItem({ id: props.editItem.id })
    } else {
      store.editItem({
        id: props.editItem.id,
        tags: tags.value,
        text: finalText,
        due: finalDue,
      })
    }
    emit('done')
    return
  }

  // Add mode: nothing to add unless there are tags or some text (a bare deadline
  // alone isn't enough on its own).
  if (tags.value.length === 0 && finalText === '') return
  store.addItem({
    listId: props.listId,
    tags: tags.value,
    text: finalText,
    due: finalDue,
  })
  tags.value = []
  text.value = ''
  due.value = null
  inputMode.value = 'body'
  emit('captured')
}
</script>

<template>
  <div
    ref="rootEl"
    class="todo-item-input"
    :class="[
      { '-tagging': inputMode === 'tag', '-dating': inputMode === 'date', '-edit': mode === 'edit' },
      priority ? `-prio-${priority}` : '',
    ]"
    @click="focus"
    @focusout="onRowFocusOut"
  >
    <!-- Sits in the checkbox slot so chips/text line up with saved items. -->
    <!-- Slot where a saved row shows its checkbox: '+' when adding, a pencil
         when editing an existing item (so the row reads as "being edited"). -->
    <span class="todo-item-input__bullet"><svg
        v-if="mode === 'edit'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        style="width:0.95em;height:0.95em;display:block"
      ><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg><template v-else>+</template></span>

    <template v-for="(t, i) in tags" :key="i"><span
        v-if="editIdx === i"
        class="todo-item-input__tagedit"
        @click.stop
      ><span class="todo-item-input__tagedit-hash">#</span><span
          :ref="setTagEditEl"
          class="todo-item-input__tagedit-text"
          contenteditable="plaintext-only"
          @input="onTagInput"
          @keydown="onTagEditKeydown($event, i)"
          @compositionend="onCompositionEnd"
        ></span></span><span
        v-else
        :class="
          priorityLevel(t) ? ['prio-badge', '-static', `-${priorityLevel(t)}`] : ['tag-chip', '-static']
        "
        :style="priorityLevel(t) ? undefined : { '--tag-h': tagHue(t) }"
        @mousedown.prevent
        @click.stop="startTagEdit(i)"
      >{{ priorityLevel(t) ? priorityLevel(t)?.toUpperCase() : '#' + t }}<button
          class="todo-item-input__x"
          type="button"
          aria-label="Remove tag"
          @mousedown.prevent
          @click.stop="removeTag(i)"
        >×</button></span></template>

    <!-- Sealed deadline chip: a quiet countdown whose color escalates with
         urgency, mirroring the saved item's due badge. -->
    <span
      v-if="due"
      class="todo-item-input__due"
      :class="dueUrgencyClass"
    ><svg viewBox="0 0 16 16" class="todo-item-input__due-glyph" aria-hidden="true">
        <circle cx="8" cy="8.5" r="5" />
        <path d="M8 5.5v3l2 1.5" />
      </svg>{{ dueRelative(due) }}<button
        class="todo-item-input__x"
        type="button"
        aria-label="Remove deadline"
        @mousedown.prevent
        @click.stop="clearDue"
      >×</button></span>

    <span v-if="inputMode === 'tag'" class="todo-item-input__hash">#</span>
    <span v-if="inputMode === 'date'" class="todo-item-input__bang">!</span>

    <input
      ref="inputEl"
      v-model="text"
      class="todo-item-input__field"
      :class="{ '-tag': inputMode === 'tag', '-date': inputMode === 'date' }"
      type="text"
      :placeholder="placeholder"
      autocomplete="off"
      data-1p-ignore
      data-lpignore="true"
      data-bwignore
      data-form-type="other"
      @keydown="onKeydown"
      @compositionend="onCompositionEnd"
    />

    <!-- Live preview of the date being typed: an unsealed, lighter echo of what
         the chip will become. Sits to the right of the date-mode input; reads
         "→ {relative}" so it's clearly a preview, not an already-committed chip. -->
    <span
      v-if="previewDue"
      class="todo-item-input__preview"
      :class="previewUrgencyClass"
      aria-hidden="true"
    >→ {{ dueRelative(previewDue) }}</span>
  </div>
</template>

<style scoped>
.todo-item-input {
  position: relative;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.55rem;
  min-height: var(--line-h);
  padding: 0 0.35rem;
  cursor: text;
}

/* Edit mode: this input is embedded inside a .todo-item row that already
   supplies the row height + padding, so drop the add-row's full --line-h sizing
   and own padding — otherwise the editing row balloons taller than saved rows. */
.todo-item-input.-edit {
  /* Fill the row like the .todo-item__label this replaces — otherwise the editor
     shrinks to its content and the body field can't grow into the free space,
     clipping long text mid-row. min-width:0 lets it shrink so long text scrolls
     inside the input instead of widening the row. */
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  padding: 0;
  /* Baseline-align chips with the body text (matching the display row, which is
     inline/baseline) so the chip doesn't sit a touch higher than in display. */
  align-items: baseline;
  /* The outer .todo-item already draws the ruled hairline; suppress this inner
     one so the editing row doesn't get a doubled underline. */
  border-bottom: none;
}

/* Keep the +/pencil marker vertically centered even with baseline rows. */
.todo-item-input.-edit .todo-item-input__bullet {
  align-self: center;
}

.todo-item-input.-edit .todo-item-input__field {
  height: auto;
}

/* Left accent strip mirrors the saved priority rows. */
.todo-item-input.-prio-p0::before,
.todo-item-input.-prio-p1::before,
.todo-item-input.-prio-p2::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.3rem;
  bottom: 0.3rem;
  width: 3px;
  border-radius: 2px;
}

.todo-item-input.-prio-p0::before {
  background: var(--prio-p0);
}

.todo-item-input.-prio-p1::before {
  background: var(--prio-p1);
}

.todo-item-input.-prio-p2::before {
  background: var(--prio-p2);
}

.todo-item-input__bullet {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.1rem;
  color: var(--disabled-text);
  font-weight: 600;
  user-select: none;
}

.todo-item-input__hash {
  margin-right: -0.1rem;
  color: var(--accent);
  /* Smaller + not bold so the tag marker doesn't loom over what you type. */
  font-size: 0.9em;
  opacity: 0.85;
}

/* Date-mode marker — mirrors the tag '#' marker, but in the urgent amber
   family so date mode reads distinct from tag mode at a glance. */
.todo-item-input__bang {
  margin-right: -0.1rem;
  color: var(--amber-strong);
  font-size: 0.9em;
  font-weight: 600;
  opacity: 0.85;
}

.todo-item-input__field {
  flex: 1 1 auto;
  min-width: 4rem;
  height: var(--line-h);
  border: none;
  background: transparent;
  color: var(--main-text);
  font: inherit;
  padding: 0;
  outline: none;
}

/* A tag being edited in place: just accent "#text", no box. The text is a
   contenteditable span — it sizes to its content natively (no width/caret
   hacks, works with CJK / variable-width fonts). */
.todo-item-input__tagedit {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
  flex: 0 0 auto;
  color: var(--accent);
  font-weight: 600;
}

/* The '#' marker, lighter than the text — mirrors the add-row tag-mode marker. */
.todo-item-input__tagedit-hash {
  font-size: 0.9em;
  opacity: 0.85;
}

.todo-item-input__tagedit-text {
  min-width: 1ch;
  white-space: pre;
  color: inherit;
  outline: none;
}

.todo-item-input__field.-tag {
  color: var(--accent);
  font-weight: 600;
}

.todo-item-input__field.-date {
  color: var(--amber-strong);
  font-weight: 600;
}

.todo-item-input__field::placeholder {
  color: var(--disabled-text);
  font-weight: 400;
}

.todo-item-input__field:focus::placeholder {
  color: transparent;
}

.tag-chip.-static {
  cursor: default;
}

/* Sealed deadline chip — same urgency colors as the saved item's due badge. */
.todo-item-input__due {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.85em;
  white-space: nowrap;
}

.todo-item-input__due-glyph {
  width: 0.72rem;
  height: 0.72rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.todo-item-input__due.-overdue,
.todo-item-input__due.-today {
  --due-overdue: #c0392b;
  color: var(--due-overdue);
}

.todo-item-input__due.-soon {
  color: var(--amber-strong);
}

.todo-item-input__due.-later {
  color: var(--aside-text);
}

/* Live date-mode preview — same urgency palette as the sealed chip, but
   deliberately quieter: no pill, lower opacity, a leading arrow. It reads as
   "what you'll get", not as something already committed. */
.todo-item-input__preview {
  flex: 0 0 auto;
  margin-left: -0.2rem;
  font-size: 0.85em;
  font-style: italic;
  white-space: nowrap;
  opacity: 0.6;
  user-select: none;
  pointer-events: none;
}

.todo-item-input__preview.-overdue,
.todo-item-input__preview.-today {
  --due-overdue: #c0392b;
  color: var(--due-overdue);
}

.todo-item-input__preview.-soon {
  color: var(--amber-strong);
}

.todo-item-input__preview.-later {
  color: var(--aside-text);
}

.todo-item-input__x {
  margin-left: 0.2em;
  border: none;
  background: transparent;
  color: inherit;
  opacity: 0.6;
  font-size: 1em;
  line-height: 1;
  padding: 0;
  cursor: pointer;
}

.todo-item-input__x:hover {
  opacity: 1;
}
</style>

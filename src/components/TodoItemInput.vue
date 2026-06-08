<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useTodoStore } from '../composables/useTodoStore'
import { useImeEnter } from '../composables/useImeEnter'
import { buildLabel, tagHue, priorityLevel, topPriority } from '../lib/tags'
import { parseDue, dueRelative, dueUrgency } from '../lib/due'

const props = defineProps<{ listId: string }>()
const emit = defineEmits<{ blurEmpty: []; captured: [] }>()

const store = useTodoStore()

type Mode = 'body' | 'tag' | 'date'

const tags = ref<string[]>([])
const text = ref('')
const due = ref<string | null>(null)
const mode = ref<Mode>('body')
const inputEl = ref<HTMLInputElement | null>(null)
const rootEl = ref<HTMLElement | null>(null)

// Highest priority among the entered tags — drives the row's left accent strip.
const priority = computed(() => topPriority(tags.value))

// A leading '#' or fullwidth '＃' (what a Chinese IME produces) starts a tag.
// The keydown handler catches the keypress, but IME-inserted punctuation can
// slip past it, so this also converts a marker that lands at the start of the
// body — then strips it, since the marker itself isn't part of the tag.
watch(text, (val) => {
  if (mode.value === 'body' && (val[0] === '#' || val[0] === '＃')) {
    mode.value = 'tag'
    text.value = val.slice(1)
  } else if (mode.value === 'body' && (val[0] === '!' || val[0] === '！')) {
    mode.value = 'date'
    text.value = val.slice(1)
  }
})

const placeholder = computed(() => {
  if (mode.value === 'tag') return 'tag… (Enter to seal)'
  if (mode.value === 'date') return '明天 / 周五 / 6/20…'
  return tags.value.length ? 'what to do…' : 'Add todo…'
})

// Urgency bucket for the sealed deadline chip, mirroring TodoItem's due badge.
const dueUrgencyClass = computed(() => (due.value ? `-${dueUrgency(due.value)}` : ''))

// Live preview while typing in date mode: resolve what's typed so far the same
// way trySealDate will. Null until a full expression parses (so "3" before
// "3天后" shows nothing — no flicker), then drives a light "→ {relative}" hint.
const previewDue = computed(() =>
  mode.value === 'date' ? parseDue('!' + text.value.trim()).due : null,
)
const previewUrgencyClass = computed(() =>
  previewDue.value ? `-${dueUrgency(previewDue.value)}` : '',
)

function focus(): void {
  inputEl.value?.focus()
}

defineExpose({ focus })

// Click-away: empty → let the parent dismiss the add-row; has content → commit
// it so a typed draft isn't silently lost. Focus moving to something inside the
// row (e.g. a tag's × button) isn't a real blur, so ignore it.
function onBlur(e: FocusEvent): void {
  const next = e.relatedTarget as Node | null
  if (next && rootEl.value?.contains(next)) return
  if (text.value.trim() === '' && tags.value.length === 0 && due.value === null) {
    emit('blurEmpty')
    return
  }
  if (mode.value === 'tag') sealTag()
  else if (mode.value === 'date') sealDate()
  submit()
  // Clicked away → also close the now-empty add row.
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
    text.value = ''
    tags.value = []
    due.value = null
    mode.value = 'body'
    inputEl.value?.blur()
    return
  }

  // '#' on an empty field enters tag mode (the '#' itself isn't typed).
  if ((e.key === '#' || e.key === '＃') && mode.value === 'body' && text.value === '') {
    e.preventDefault()
    mode.value = 'tag'
    return
  }

  // '!' on an empty field enters date mode (the '!' itself isn't typed),
  // mirroring tag mode. Only one deadline, so skip if one is already sealed.
  if (
    (e.key === '!' || e.key === '！') &&
    mode.value === 'body' &&
    text.value === '' &&
    due.value === null
  ) {
    e.preventDefault()
    mode.value = 'date'
    return
  }

  // Space seals a date in date mode if the typed expression parses (mirrors how
  // Enter seals); otherwise it falls through as a normal space.
  if (e.key === ' ' && mode.value === 'date' && trySealDate()) {
    e.preventDefault()
    return
  }

  if (e.key === 'Enter') {
    e.preventDefault()
    // The IME-confirming Enter that Safari delivers just after compositionend:
    // it only commits the candidate, it must not also submit the todo.
    if (isImeEnter(e)) return
    if (mode.value === 'tag') {
      sealTag()
    } else if (mode.value === 'date') {
      // Only leave date mode once a valid deadline parses; stay put on garbage.
      trySealDate()
    } else {
      submit()
    }
    return
  }

  if (e.key === 'Backspace') {
    // Leave tag mode if the in-progress tag is empty.
    if (mode.value === 'tag' && text.value === '') {
      e.preventDefault()
      mode.value = 'body'
      return
    }
    // Leave date mode if the in-progress date is empty.
    if (mode.value === 'date' && text.value === '') {
      e.preventDefault()
      mode.value = 'body'
      return
    }
    // Pull the last sealed tag back into edit when at the start of an empty body.
    if (mode.value === 'body' && text.value === '' && tags.value.length) {
      e.preventDefault()
      mode.value = 'tag'
      text.value = tags.value.pop() ?? ''
    }
  }
}

function sealTag(): void {
  const name = text.value.trim()
  if (name) tags.value.push(name)
  text.value = ''
  mode.value = 'body'
}

function removeTag(index: number): void {
  tags.value.splice(index, 1)
  focus()
}

// Parse the typed date expression (e.g. "明天", "6/20") by reusing parseDue
// with the '!' prefix it expects. Seals into `due` and returns to body mode on
// success; returns false (and stays in date mode) when nothing valid parsed.
function trySealDate(): boolean {
  const { due: parsed } = parseDue('!' + text.value.trim())
  if (!parsed) return false
  due.value = parsed
  text.value = ''
  mode.value = 'body'
  return true
}

// Blur seal: commit a valid date, but never block the blur — drop an
// unparseable in-progress expression and fall back to body mode.
function sealDate(): void {
  trySealDate()
  text.value = ''
  mode.value = 'body'
}

function clearDue(): void {
  due.value = null
  focus()
}

function submit(): void {
  // The deadline lives in `due` (sealed via date mode), so the label is just
  // tags + remaining text. Still run parseDue to lift any stray inline !token a
  // user typed mid-text, preferring an already-sealed `due` over it.
  const raw = buildLabel(tags.value, text.value)
  const { text: label, due: inlineDue } = parseDue(raw)
  // Nothing to add unless there's a label — but a bare deadline with tags still
  // counts (label comes from the tags then).
  if (!label && due.value === null) return
  store.addItem({
    listId: props.listId,
    label,
    due: due.value ?? inlineDue ?? undefined,
  })
  tags.value = []
  text.value = ''
  due.value = null
  mode.value = 'body'
  emit('captured')
}
</script>

<template>
  <div
    ref="rootEl"
    class="todo-item-input"
    :class="[
      { '-tagging': mode === 'tag', '-dating': mode === 'date' },
      priority ? `-prio-${priority}` : '',
    ]"
    @click="focus"
  >
    <!-- Sits in the checkbox slot so chips/text line up with saved items. -->
    <span class="todo-item-input__bullet">+</span>

    <span
      v-for="(t, i) in tags"
      :key="i"
      :class="
        priorityLevel(t) ? ['prio-badge', '-static', `-${priorityLevel(t)}`] : ['tag-chip', '-static']
      "
      :style="priorityLevel(t) ? undefined : { '--tag-h': tagHue(t) }"
    >{{ priorityLevel(t) ? priorityLevel(t)?.toUpperCase() : '#' + t }}<button
        class="todo-item-input__x"
        type="button"
        aria-label="Remove tag"
        @mousedown.prevent
        @click.stop="removeTag(i)"
      >×</button></span>

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

    <span v-if="mode === 'tag'" class="todo-item-input__hash">#</span>
    <span v-if="mode === 'date'" class="todo-item-input__bang">!</span>

    <input
      ref="inputEl"
      v-model="text"
      class="todo-item-input__field"
      :class="{ '-tag': mode === 'tag', '-date': mode === 'date' }"
      type="text"
      :placeholder="placeholder"
      autocomplete="off"
      data-1p-ignore
      data-lpignore="true"
      data-bwignore
      data-form-type="other"
      @keydown="onKeydown"
      @compositionend="onCompositionEnd"
      @blur="onBlur"
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
  width: 1.1rem;
  text-align: center;
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

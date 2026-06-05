<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useTodoStore } from '../composables/useTodoStore'
import { buildLabel, tagHue } from '../lib/tags'

const props = defineProps<{ listId: string }>()
const emit = defineEmits<{ blurEmpty: []; captured: [] }>()

const store = useTodoStore()

type Mode = 'body' | 'tag'

const tags = ref<string[]>([])
const text = ref('')
const mode = ref<Mode>('body')
const inputEl = ref<HTMLInputElement | null>(null)

// A leading '#' or fullwidth '＃' (what a Chinese IME produces) starts a tag.
// The keydown handler catches the keypress, but IME-inserted punctuation can
// slip past it, so this also converts a marker that lands at the start of the
// body — then strips it, since the marker itself isn't part of the tag.
watch(text, (val) => {
  if (mode.value === 'body' && (val[0] === '#' || val[0] === '＃')) {
    mode.value = 'tag'
    text.value = val.slice(1)
  }
})

const placeholder = computed(() => {
  if (mode.value === 'tag') return 'tag… (Enter to seal)'
  return tags.value.length ? 'what to do…' : 'Add todo…'
})

function focus(): void {
  inputEl.value?.focus()
}

defineExpose({ focus })

// When the field loses focus with nothing entered, let the parent dismiss it.
function onBlur(): void {
  if (mode.value === 'body' && text.value === '' && tags.value.length === 0) {
    emit('blurEmpty')
  }
}

function onKeydown(e: KeyboardEvent): void {
  // While an IME is composing, the keys belong to it (Backspace edits the
  // half-typed text, Enter commits a candidate, etc.). Running our shortcuts
  // here mangles the composition — bail until it's committed.
  if (e.isComposing || e.keyCode === 229) return

  if (e.key === 'Escape') {
    text.value = ''
    tags.value = []
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

  if (e.key === 'Enter') {
    e.preventDefault()
    if (mode.value === 'tag') {
      sealTag()
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

function submit(): void {
  const label = buildLabel(tags.value, text.value)
  if (!label) return
  store.addItem({ listId: props.listId, label })
  tags.value = []
  text.value = ''
  mode.value = 'body'
  emit('captured')
}
</script>

<template>
  <div class="todo-item-input" :class="{ '-tagging': mode === 'tag' }" @click="focus">
    <!-- Sits in the checkbox slot so chips/text line up with saved items. -->
    <span class="todo-item-input__bullet">+</span>

    <span
      v-for="(t, i) in tags"
      :key="i"
      class="tag-chip -static"
      :style="{ '--tag-h': tagHue(t) }"
    >#{{ t }}<button
        class="todo-item-input__x"
        type="button"
        aria-label="Remove tag"
        @click.stop="removeTag(i)"
      >×</button></span>

    <span v-if="mode === 'tag'" class="todo-item-input__hash">#</span>

    <input
      ref="inputEl"
      v-model="text"
      class="todo-item-input__field"
      :class="{ '-tag': mode === 'tag' }"
      type="text"
      :placeholder="placeholder"
      autocomplete="off"
      @keydown="onKeydown"
      @blur="onBlur"
    />
  </div>
</template>

<style scoped>
.todo-item-input {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.55rem;
  min-height: var(--line-h);
  padding: 0 0.35rem;
  cursor: text;
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
  margin-right: -0.3rem;
  color: var(--accent);
  font-weight: 700;
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

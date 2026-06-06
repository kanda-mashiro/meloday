<script setup lang="ts">
import { ref, watch, computed, nextTick, onBeforeUnmount } from 'vue'
import { useNotes } from '../composables/useNotes'
import { useSelection } from '../composables/useSelection'
import { useTodoStore } from '../composables/useTodoStore'
import { parseLabelRich } from '../lib/time'
import NoteEditor from './NoteEditor.vue'

// The right-pane note follows the SELECTED task: pick a task on the left and its
// note loads here for inline editing. Reuses the per-task loadNote/saveNote
// helpers (same todo_notes table) and mirrors NotePanel's debounce + race-guard.
const { loadNote, saveNote } = useNotes()
const selection = useSelection()
const store = useTodoStore()

const status = ref<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('idle')
const errorMsg = ref<string | null>(null)
const editorRef = ref<InstanceType<typeof NoteEditor> | null>(null)

let saveTimer: ReturnType<typeof setTimeout> | undefined
// The item id the editor content currently belongs to (guards async races).
let loadedFor: string | null = null

const selectedId = computed(() => selection.selectedId.value)
const selectedItem = computed(() =>
  selectedId.value ? store.state.items.find((i) => i.id === selectedId.value) ?? null : null,
)
// The selected task's plain-text title (tags/time stripped) for the panel header.
const selectedLabel = computed(() => {
  const item = selectedItem.value
  if (!item) return ''
  const text = parseLabelRich(item.label)
    .segments.filter((s) => s.kind === 'text')
    .map((s) => s.text)
    .join('')
    .trim()
  return text || item.label
})

const statusText = computed(() => {
  switch (status.value) {
    case 'loading':
      return '加载中…'
    case 'saving':
      return '保存中…'
    case 'saved':
      return '已保存'
    case 'error':
      return errorMsg.value ? `保存失败:${errorMsg.value}` : '保存失败'
    default:
      return ''
  }
})

function currentValue(): string {
  const editor = editorRef.value?.editor
  if (!editor) return ''
  return editor.isEmpty ? '' : editor.getHTML()
}

function applyContent(html: string): void {
  const editor = editorRef.value?.editor
  editor?.commands.setContent(html || '', { emitUpdate: false })
}

// Flush any pending edit for the previously-loaded task so nothing is lost.
function flushPending(): void {
  if (saveTimer && loadedFor) {
    clearTimeout(saveTimer)
    saveTimer = undefined
    void saveNote(loadedFor, currentValue())
  }
}

// Load the selected task's note whenever the selection changes.
watch(
  selectedId,
  async (id) => {
    flushPending()
    if (!id) {
      loadedFor = null
      status.value = 'idle'
      return
    }
    status.value = 'loading'
    errorMsg.value = null
    const { content: loaded, error } = await loadNote(id)
    if (selectedId.value !== id) return // selection moved while loading
    if (!editorRef.value?.editor) await nextTick()
    applyContent(loaded)
    loadedFor = id
    status.value = error ? 'error' : 'idle'
    errorMsg.value = error
  },
  { immediate: true },
)

async function persist(id: string, value: string): Promise<void> {
  const { error } = await saveNote(id, value)
  if (loadedFor !== id) return // selection moved on; don't clobber the new status
  if (error) {
    status.value = 'error'
    errorMsg.value = error
  } else {
    status.value = 'saved'
    errorMsg.value = null
  }
}

function onUpdate(): void {
  if (!loadedFor) return
  status.value = 'saving'
  if (saveTimer) clearTimeout(saveTimer)
  const id = loadedFor
  const value = currentValue()
  saveTimer = setTimeout(() => void persist(id, value), 600)
}

onBeforeUnmount(flushPending)
</script>

<template>
  <section class="tnote">
    <header class="tnote__head">
      <span class="tnote__title">{{ selectedItem ? '任务笔记' : '笔记' }}</span>
      <span class="tnote__status" :class="{ '-error': status === 'error' }">{{ statusText }}</span>
    </header>

    <p v-if="selectedItem" class="tnote__task" :title="selectedLabel">{{ selectedLabel }}</p>

    <div v-if="!selectedItem" class="tnote__empty">选中一条任务来记笔记</div>
    <NoteEditor v-show="selectedItem" ref="editorRef" class="tnote__editor" @update="onUpdate" />
  </section>
</template>

<style scoped>
.tnote {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.tnote__head {
  flex: 0 0 auto;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1rem 0.4rem;
}

.tnote__title {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--aside-text);
}

.tnote__status {
  font-size: 0.72rem;
  color: var(--aside-text);
}

.tnote__status.-error {
  color: var(--accent);
}

.tnote__task {
  flex: 0 0 auto;
  margin: 0 1rem 0.5rem;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--main-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tnote__empty {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  font-size: 0.82rem;
  color: var(--disabled-text);
  text-align: center;
}

.tnote__editor {
  flex: 1 1 auto;
  min-height: 0;
}
</style>

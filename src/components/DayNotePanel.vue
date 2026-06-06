<script setup lang="ts">
import { ref, watch, computed, nextTick, onBeforeUnmount } from 'vue'
import { useNotes } from '../composables/useNotes'
import NoteEditor from './NoteEditor.vue'

// A free-form note for the whole day, keyed by the day id. Mirrors NotePanel's
// load/save/debounce/race-guard logic, but persists through the day-note
// helpers (which key the shared notes table by the day id) and lives inline in
// the focus view's right pane rather than in a slide-over drawer.
const props = defineProps<{ dayId: string }>()
const { loadDayNote, saveDayNote } = useNotes()

const status = ref<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('idle')
const errorMsg = ref<string | null>(null)
const editorRef = ref<InstanceType<typeof NoteEditor> | null>(null)

let saveTimer: ReturnType<typeof setTimeout> | undefined
// The day id the editor content currently belongs to (guards async races).
let loadedFor: string | null = null

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

// Load the note whenever the panel targets a (different) day.
watch(
  () => props.dayId,
  async (dayId) => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = undefined
    }
    status.value = 'loading'
    errorMsg.value = null
    const { content: loaded, error } = await loadDayNote(dayId)
    // The day may have changed while we were loading — bail if so.
    if (props.dayId !== dayId) return
    if (!editorRef.value?.editor) await nextTick()
    applyContent(loaded)
    loadedFor = dayId
    status.value = error ? 'error' : 'idle'
    errorMsg.value = error
  },
  { immediate: true },
)

async function persist(id: string, value: string): Promise<void> {
  const { error } = await saveDayNote(id, value)
  if (loadedFor !== id) return // panel moved on; don't clobber the new status
  if (error) {
    status.value = 'error'
    errorMsg.value = error
  } else {
    status.value = 'saved'
    errorMsg.value = null
  }
}

function onUpdate(): void {
  status.value = 'saving'
  if (saveTimer) clearTimeout(saveTimer)
  const id = props.dayId
  const value = currentValue()
  saveTimer = setTimeout(() => void persist(id, value), 600)
}

// Flush any pending edit immediately so nothing is lost when the pane unmounts.
onBeforeUnmount(() => {
  if (saveTimer && loadedFor) {
    clearTimeout(saveTimer)
    saveTimer = undefined
    void saveDayNote(loadedFor, currentValue())
  }
})
</script>

<template>
  <section class="dnote">
    <header class="dnote__head">
      <span class="dnote__title">今日笔记</span>
      <span class="dnote__status" :class="{ '-error': status === 'error' }">{{ statusText }}</span>
    </header>

    <NoteEditor ref="editorRef" class="dnote__editor" @update="onUpdate" />
  </section>
</template>

<style scoped>
.dnote {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.dnote__head {
  flex: 0 0 auto;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1rem 0.6rem;
}

.dnote__title {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--aside-text);
}

.dnote__status {
  font-size: 0.72rem;
  color: var(--aside-text);
}

.dnote__status.-error {
  color: var(--accent);
}

.dnote__editor {
  flex: 1 1 auto;
  min-height: 0;
}
</style>

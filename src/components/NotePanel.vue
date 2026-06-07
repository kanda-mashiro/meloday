<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import { useNotes } from '../composables/useNotes'
import { parseLabelRich, type RichSegment } from '../lib/time'
import { tagHue } from '../lib/tags'
import NoteEditor from './NoteEditor.vue'

const { activeItem, close, loadNote, saveNote } = useNotes()

const status = ref<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('idle')
const errorMsg = ref<string | null>(null)
// The child rich editor; we reach into its exposed `editor` ref to load,
// serialize and focus the TipTap instance.
const editorRef = ref<InstanceType<typeof NoteEditor> | null>(null)

let saveTimer: ReturnType<typeof setTimeout> | undefined
// The item id the editor content currently belongs to (guards async races).
let loadedFor: string | null = null

const titleSegments = computed<RichSegment[]>(() =>
  activeItem.value ? parseLabelRich(activeItem.value.label).segments : [],
)

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

// Current editor HTML, with empty mapped to '' so saveNote deletes the row
// (and clears the board icon). An empty TipTap doc serializes to "<p></p>",
// which is non-empty text — `editor.isEmpty` is the reliable empty check.
function currentValue(): string {
  const editor = editorRef.value?.editor
  if (!editor) return ''
  return editor.isEmpty ? '' : editor.getHTML()
}

// Push loaded HTML into the editor without firing onUpdate (so loading a note
// doesn't trigger an autosave). v3's setContent takes an options object.
function applyContent(html: string): void {
  const editor = editorRef.value?.editor
  editor?.commands.setContent(html || '', { emitUpdate: false })
}

// Load the note whenever the panel targets a (different) item.
watch(activeItem, async (item) => {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = undefined
  }
  if (!item) {
    loadedFor = null
    return
  }
  status.value = 'loading'
  errorMsg.value = null
  const { content: loaded, error } = await loadNote(item.id)
  // The user may have switched items while we were loading — bail if so.
  if (activeItem.value?.id !== item.id) return
  // The editor is mounted for the panel's lifetime, but if it isn't ready yet
  // (very first open) wait a tick so setContent/focus land on a live instance.
  if (!editorRef.value?.editor) await nextTick()
  applyContent(loaded)
  loadedFor = item.id
  status.value = error ? 'error' : 'idle'
  errorMsg.value = error
  await nextTick()
  editorRef.value?.editor?.commands.focus('end')
})

async function persist(id: string, value: string): Promise<void> {
  const { error } = await saveNote(id, value)
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
  const item = activeItem.value
  if (!item) return
  status.value = 'saving'
  if (saveTimer) clearTimeout(saveTimer)
  const id = item.id
  const value = currentValue()
  saveTimer = setTimeout(() => void persist(id, value), 600)
}

function onClose(): void {
  // Flush any pending edit immediately so nothing is lost on close.
  if (saveTimer && activeItem.value) {
    clearTimeout(saveTimer)
    saveTimer = undefined
    void saveNote(activeItem.value.id, currentValue())
  }
  close()
}
</script>

<template>
  <div class="note" :class="{ '-open': activeItem !== null }">
    <div class="note__scrim" @click="onClose" />

    <aside class="note__panel" role="dialog" aria-label="Note" @keydown.esc.stop="onClose">
      <header class="note__head">
        <span class="note__title"><template
          v-for="(seg, i) in titleSegments"
          :key="i"
        ><span
            v-if="seg.kind === 'tag'"
            class="tag-chip"
            :style="{ '--tag-h': tagHue(seg.tag ?? '') }"
          >{{ seg.text }}</span><span
            v-else-if="seg.kind === 'time'"
            class="time-chip"
            :class="{ '-cross': seg.time?.crossMidnight }"
          >{{ seg.text }}</span><span
            v-else-if="seg.text.trim()"
          >{{ seg.text }}</span><template v-else>{{ seg.text }}</template></template></span>
        <button class="note__close" type="button" aria-label="Close" @click="onClose">×</button>
      </header>

      <NoteEditor ref="editorRef" :toolbar="false" class="note__editor" @update="onUpdate" />

      <footer class="note__foot">
        <span class="note__status" :class="{ '-error': status === 'error' }">{{ statusText }}</span>
      </footer>
    </aside>
  </div>
</template>

<style scoped>
.note {
  position: fixed;
  inset: 0;
  z-index: 55;
  pointer-events: none;
}

.note__scrim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.28);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.note__panel {
  position: absolute;
  top: 0;
  right: 0;
  width: min(460px, 92vw);
  height: 100%;
  background: var(--panel-bg);
  border-left: 1px solid var(--divider);
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.12);
  transform: translateX(100%);
  transition: transform 0.22s ease;
  display: flex;
  flex-direction: column;
}

.note.-open {
  pointer-events: auto;
}

.note.-open .note__scrim {
  opacity: 1;
}

.note.-open .note__panel {
  transform: translateX(0);
}

.note__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1.1rem 1.25rem 0.75rem;
  border-bottom: 1px solid var(--divider);
}

.note__title {
  min-width: 0;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.4;
  color: var(--main-text);
  word-break: break-word;
}

.note__close {
  flex: 0 0 auto;
  border: none;
  background: transparent;
  color: var(--aside-text);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 0.25rem;
}

.note__close:hover {
  color: var(--main-text);
}

.note__editor {
  flex: 1 1 auto;
  min-height: 0;
}

.note__foot {
  padding: 0.55rem 1.25rem;
  border-top: 1px solid var(--divider);
  min-height: 1.2rem;
}

.note__status {
  font-size: 0.76rem;
  color: var(--aside-text);
}

.note__status.-error {
  color: var(--accent);
}
</style>

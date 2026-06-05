<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'

// The editor is a pure editing surface: it owns the TipTap instance and a
// toolbar/bubble-menu, and reports changes upward. All persistence,
// load/race-guarding and status lives in the parent NotePanel.
const emit = defineEmits<{
  (e: 'update'): void
}>()

// Bumped on every editor transaction so the toolbar's active-state buttons
// re-render (TipTap mutates the editor in place, which Vue can't track).
const tick = ref(0)

const editor = useEditor({
  extensions: [
    // StarterKit v3 already bundles Bold/Italic/Strike/Code/CodeBlock,
    // Heading, Blockquote, HorizontalRule, HardBreak, Paragraph, Underline,
    // Link, the list nodes (Bullet/Ordered/ListItem) and undo/redo history.
    // We only add the task list + placeholder on top. Link is configured via
    // StarterKit's `link` option to avoid a duplicate-extension error.
    StarterKit.configure({
      link: {
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      },
      codeBlock: { HTMLAttributes: { spellcheck: 'false' } },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({
      placeholder: '写点什么…',
      emptyEditorClass: 'is-editor-empty',
    }),
  ],
  editorProps: {
    attributes: {
      class: 'note-prose',
      spellcheck: 'false',
    },
  },
  // Fired on real content changes only — load uses { emitUpdate: false }.
  onUpdate: () => {
    tick.value++
    emit('update')
  },
  // A transaction fires on every doc/selection change, so this single hook
  // keeps the toolbar's active-state in sync without a separate selection hook.
  onTransaction: () => {
    tick.value++
  },
})

onBeforeUnmount(() => {
  editor.value?.destroy()
})

// Expose the live editor so the parent can load/serialize/focus it.
defineExpose({ editor })

// --- Toolbar helpers -------------------------------------------------------

// Reading `tick.value` makes these recompute on every transaction.
function active(name: string, attrs?: Record<string, unknown>): boolean {
  void tick.value
  return editor.value?.isActive(name, attrs) ?? false
}

function setLink(): void {
  const ed = editor.value
  if (!ed) return
  const prev = (ed.getAttributes('link').href as string | undefined) ?? ''
  const url = window.prompt('链接地址', prev)
  // Cancelled prompt → leave as-is.
  if (url === null) return
  const chain = ed.chain().focus().extendMarkRange('link')
  if (url.trim() === '') {
    chain.unsetLink().run()
  } else {
    chain.setLink({ href: url.trim() }).run()
  }
}

const TASK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1.05em;height:1.05em;display:block"><path d="M9 11l3 3L20 6"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg>'
const LINK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1.05em;height:1.05em;display:block"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.7-1.7"/></svg>'

const TOOLBAR_GROUPS: { items: { key: string; label: string; svg?: string; title: string; run: () => void; isActive: () => boolean; disabled?: () => boolean }[] }[] = [
  {
    items: [
      { key: 'bold', label: 'B', title: '加粗 (⌘B)', run: () => editor.value?.chain().focus().toggleBold().run(), isActive: () => active('bold') },
      { key: 'italic', label: 'I', title: '斜体 (⌘I)', run: () => editor.value?.chain().focus().toggleItalic().run(), isActive: () => active('italic') },
      { key: 'strike', label: 'S', title: '删除线', run: () => editor.value?.chain().focus().toggleStrike().run(), isActive: () => active('strike') },
      { key: 'code', label: '</>', title: '行内代码', run: () => editor.value?.chain().focus().toggleCode().run(), isActive: () => active('code') },
    ],
  },
  {
    items: [
      { key: 'h1', label: 'H1', title: '标题 1', run: () => editor.value?.chain().focus().toggleHeading({ level: 1 }).run(), isActive: () => active('heading', { level: 1 }) },
      { key: 'h2', label: 'H2', title: '标题 2', run: () => editor.value?.chain().focus().toggleHeading({ level: 2 }).run(), isActive: () => active('heading', { level: 2 }) },
      { key: 'h3', label: 'H3', title: '标题 3', run: () => editor.value?.chain().focus().toggleHeading({ level: 3 }).run(), isActive: () => active('heading', { level: 3 }) },
    ],
  },
  {
    items: [
      { key: 'bullet', label: '•', title: '无序列表', run: () => editor.value?.chain().focus().toggleBulletList().run(), isActive: () => active('bulletList') },
      { key: 'ordered', label: '1.', title: '有序列表', run: () => editor.value?.chain().focus().toggleOrderedList().run(), isActive: () => active('orderedList') },
      { key: 'task', label: 'Task', svg: TASK_SVG, title: '待办列表', run: () => editor.value?.chain().focus().toggleTaskList().run(), isActive: () => active('taskList') },
    ],
  },
  {
    items: [
      { key: 'quote', label: '“', title: '引用', run: () => editor.value?.chain().focus().toggleBlockquote().run(), isActive: () => active('blockquote') },
      { key: 'codeblock', label: '{}', title: '代码块', run: () => editor.value?.chain().focus().toggleCodeBlock().run(), isActive: () => active('codeBlock') },
      { key: 'link', label: 'Link', svg: LINK_SVG, title: '链接', run: setLink, isActive: () => active('link') },
      { key: 'hr', label: '―', title: '分割线', run: () => editor.value?.chain().focus().setHorizontalRule().run(), isActive: () => false },
    ],
  },
  {
    items: [
      { key: 'undo', label: '↶', title: '撤销 (⌘Z)', run: () => editor.value?.chain().focus().undo().run(), isActive: () => false, disabled: () => { void tick.value; return !editor.value?.can().undo() } },
      { key: 'redo', label: '↷', title: '重做 (⌘⇧Z)', run: () => editor.value?.chain().focus().redo().run(), isActive: () => false, disabled: () => { void tick.value; return !editor.value?.can().redo() } },
    ],
  },
]
</script>

<template>
  <div class="ne">
    <div v-if="editor" class="ne__toolbar" role="toolbar" aria-label="Formatting">
      <template v-for="(group, gi) in TOOLBAR_GROUPS" :key="gi">
        <span v-if="gi > 0" class="ne__sep" aria-hidden="true" />
        <button
          v-for="btn in group.items"
          :key="btn.key"
          type="button"
          class="ne__btn"
          :class="{ '-active': btn.isActive() }"
          :title="btn.title"
          :aria-label="btn.title"
          :aria-pressed="btn.isActive()"
          :disabled="btn.disabled ? btn.disabled() : false"
          @click="btn.run()"
        ><span v-if="btn.svg" class="ne__btn-ico" v-html="btn.svg"></span><template v-else>{{ btn.label }}</template></button>
      </template>
    </div>

    <BubbleMenu
      v-if="editor"
      :editor="editor"
      class="ne__bubble"
      :options="{ placement: 'top' }"
    >
      <button
        type="button"
        class="ne__btn"
        :class="{ '-active': active('bold') }"
        title="加粗"
        @click="editor.chain().focus().toggleBold().run()"
      >B</button>
      <button
        type="button"
        class="ne__btn"
        :class="{ '-active': active('italic') }"
        title="斜体"
        @click="editor.chain().focus().toggleItalic().run()"
      >I</button>
      <button
        type="button"
        class="ne__btn"
        :class="{ '-active': active('code') }"
        title="行内代码"
        @click="editor.chain().focus().toggleCode().run()"
      >&lt;/&gt;</button>
      <button
        type="button"
        class="ne__btn"
        :class="{ '-active': active('link') }"
        title="链接"
        @click="setLink()"
      ><span class="ne__btn-ico" v-html="LINK_SVG"></span></button>
    </BubbleMenu>

    <EditorContent class="ne__content" :editor="editor" />
  </div>
</template>

<style scoped>
.ne {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* --- Fixed top toolbar --- */
.ne__toolbar {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.15rem;
  padding: 0.45rem 0.85rem;
  border-bottom: 1px solid var(--divider);
  background: var(--panel-bg);
}

.ne__sep {
  width: 1px;
  align-self: stretch;
  margin: 0.15rem 0.3rem;
  background: var(--main-border-light);
}

.ne__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.85rem;
  height: 1.85rem;
  padding: 0 0.4rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--aside-text);
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.ne__btn-ico {
  display: inline-flex;
}

.ne__btn:hover:not(:disabled) {
  background: var(--button-active-bg);
  color: var(--main-text);
}

.ne__btn.-active {
  background: var(--accent-soft);
  color: var(--highlight-text);
  border-color: var(--accent);
}

.ne__btn:disabled {
  color: var(--disabled-text);
  cursor: default;
  opacity: 0.6;
}

/* --- Bubble menu --- */
.ne__bubble {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.2rem;
  border: 1px solid var(--main-border-light);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.18);
}

/* --- Editor content wrapper: fills the body and scrolls --- */
.ne__content {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

/* ======================================================================
   ProseMirror prose styling — make TipTap feel on-theme, not default grey.
   ====================================================================== */
.ne__content :deep(.ProseMirror) {
  min-height: 100%;
  outline: none;
  padding: 1.15rem 1.4rem 3rem;
  color: var(--main-text);
  font-size: 0.95rem;
  line-height: 1.7;
  caret-color: var(--accent);
  -webkit-font-smoothing: antialiased;
}

.ne__content :deep(.ProseMirror) > * + * {
  margin-top: 0.7em;
}

/* Placeholder on the empty document */
.ne__content :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
  color: var(--disabled-text);
}

/* Headings */
.ne__content :deep(.ProseMirror h1),
.ne__content :deep(.ProseMirror h2),
.ne__content :deep(.ProseMirror h3) {
  font-weight: 700;
  line-height: 1.3;
  color: var(--main-text);
  margin-top: 1.4em;
}
.ne__content :deep(.ProseMirror h1) {
  font-size: 1.55rem;
}
.ne__content :deep(.ProseMirror h2) {
  font-size: 1.28rem;
}
.ne__content :deep(.ProseMirror h3) {
  font-size: 1.08rem;
}
.ne__content :deep(.ProseMirror > h1:first-child),
.ne__content :deep(.ProseMirror > h2:first-child),
.ne__content :deep(.ProseMirror > h3:first-child) {
  margin-top: 0;
}

/* Paragraphs */
.ne__content :deep(.ProseMirror p) {
  margin: 0;
}

/* Lists */
.ne__content :deep(.ProseMirror ul),
.ne__content :deep(.ProseMirror ol) {
  padding-left: 1.5em;
}
.ne__content :deep(.ProseMirror ul) {
  list-style: disc;
}
.ne__content :deep(.ProseMirror ol) {
  list-style: decimal;
}
.ne__content :deep(.ProseMirror li) {
  margin: 0.2em 0;
}
.ne__content :deep(.ProseMirror li p) {
  margin: 0;
}

/* Task list — render as real, aligned checkboxes */
.ne__content :deep(.ProseMirror ul[data-type='taskList']) {
  list-style: none;
  padding-left: 0.1em;
}
.ne__content :deep(.ProseMirror ul[data-type='taskList'] li) {
  display: flex;
  align-items: flex-start;
  gap: 0.55em;
}
.ne__content :deep(.ProseMirror ul[data-type='taskList'] li > label) {
  flex: 0 0 auto;
  margin-top: 0.28em;
  user-select: none;
}
.ne__content :deep(.ProseMirror ul[data-type='taskList'] li > div) {
  flex: 1 1 auto;
  min-width: 0;
}
.ne__content :deep(.ProseMirror ul[data-type='taskList'] input[type='checkbox']) {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
  accent-color: var(--accent);
}
.ne__content :deep(.ProseMirror ul[data-type='taskList'] li[data-checked='true'] > div) {
  color: var(--disabled-text);
  text-decoration: line-through;
}
/* Nested task lists indent under their parent */
.ne__content :deep(.ProseMirror ul[data-type='taskList'] ul[data-type='taskList']) {
  margin-top: 0.2em;
  padding-left: 0.4em;
}

/* Blockquote */
.ne__content :deep(.ProseMirror blockquote) {
  margin: 0;
  padding-left: 0.95em;
  border-left: 3px solid var(--accent);
  color: var(--aside-text);
}

/* Inline code */
.ne__content :deep(.ProseMirror code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.86em;
  padding: 0.12em 0.35em;
  border-radius: 4px;
  background: var(--accent-soft);
  color: var(--amber-strong);
}

/* Code block */
.ne__content :deep(.ProseMirror pre) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.85rem;
  line-height: 1.55;
  padding: 0.85em 1em;
  border-radius: 8px;
  background: var(--main-bg);
  border: 1px solid var(--main-border-light);
  color: var(--main-text);
  overflow-x: auto;
}
.ne__content :deep(.ProseMirror pre code) {
  background: none;
  color: inherit;
  padding: 0;
  font-size: inherit;
  border-radius: 0;
}

/* Links */
.ne__content :deep(.ProseMirror a) {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
.ne__content :deep(.ProseMirror a:hover) {
  color: var(--highlight-text);
}

/* Horizontal rule */
.ne__content :deep(.ProseMirror hr) {
  border: none;
  border-top: 1px solid var(--main-border-light);
  margin: 1.3em 0;
}

/* Selection */
.ne__content :deep(.ProseMirror ::selection) {
  background: var(--accent-soft);
}
</style>

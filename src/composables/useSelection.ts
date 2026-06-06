import { ref, type Ref } from 'vue'

// One "selected" task at a time: click a task once to select it, again to edit.
// Module singleton so the rows, the click-outside-to-clear, and Esc all share
// the same state.
const selectedId = ref<string | null>(null)

let initialized = false
function init(): void {
  if (initialized || typeof document === 'undefined') return
  initialized = true
  // A click outside a todo row clears the selection — except clicks inside the
  // focus view's side pane, whose note follows the selection (so editing the
  // note must not deselect). Selecting a row uses @click.stop, so it never
  // reaches here.
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.todo-item, .focus__pane')) {
      selectedId.value = null
    }
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') selectedId.value = null
  })
}
init()

export function useSelection(): {
  selectedId: Ref<string | null>
  select: (id: string) => void
  clear: () => void
} {
  return {
    selectedId,
    select: (id: string) => {
      selectedId.value = id
    },
    clear: () => {
      selectedId.value = null
    },
  }
}

import { ref, type Ref } from 'vue'

// Shared open-state for the keyboard-shortcuts help overlay. Module singleton so
// the bottom-bar button, the global "?" shortcut, and the overlay all agree.
const open = ref(false)

export function useHelp(): {
  open: Ref<boolean>
  openHelp: () => void
  closeHelp: () => void
  toggleHelp: () => void
} {
  return {
    open,
    openHelp: () => {
      open.value = true
    },
    closeHelp: () => {
      open.value = false
    },
    toggleHelp: () => {
      open.value = !open.value
    },
  }
}

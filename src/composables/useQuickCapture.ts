import { ref, type Ref } from 'vue'

// Shared open-state for the quick-capture overlay. Kept tiny on purpose:
// the same primitive (open a small input → write to Inbox) is what a future
// desktop/mobile global hotkey would drive.
const open: Ref<boolean> = ref(false)

export function useQuickCapture(): {
  open: Ref<boolean>
  openCapture: () => void
  closeCapture: () => void
  toggleCapture: () => void
} {
  return {
    open,
    openCapture: () => {
      open.value = true
    },
    closeCapture: () => {
      open.value = false
    },
    toggleCapture: () => {
      open.value = !open.value
    },
  }
}

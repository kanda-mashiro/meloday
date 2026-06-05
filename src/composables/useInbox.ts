import { ref, watch, type Ref } from 'vue'

const KEY = 'my-todo-inbox-open'

function load(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'false'
  } catch {
    return true
  }
}

const open = ref(load())

let initialized = false
function init(): void {
  if (initialized) return
  initialized = true
  watch(open, (v) => {
    try {
      localStorage.setItem(KEY, String(v))
    } catch {
      // ignore
    }
  })
}
init()

export function useInbox(): { open: Ref<boolean>; toggle: () => void } {
  return {
    open,
    toggle: () => {
      open.value = !open.value
    },
  }
}

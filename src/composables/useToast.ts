import { ref, type Ref } from 'vue'

// A tiny transient toast — module singleton, so any component can pop a brief
// message (auto-dismisses).
const message = ref('')
let timer: ReturnType<typeof setTimeout> | undefined

function showToast(msg: string): void {
  message.value = msg
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    message.value = ''
  }, 2400)
}

export function useToast(): { message: Ref<string>; showToast: (msg: string) => void } {
  return { message, showToast }
}

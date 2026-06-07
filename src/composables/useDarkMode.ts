import { ref, watch, type Ref } from 'vue'

const STORAGE_KEY = 'meloday-dark'
const BODY_CLASS = '-invertcolorscheme'

function prefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

function loadInverted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function saveInverted(inverted: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(inverted))
  } catch {
    // ignore persistence errors
  }
}

// 'inverted' is the persisted flag; effectiveDark = prefersDark !== inverted.
const inverted: Ref<boolean> = ref(loadInverted())
const isDark: Ref<boolean> = ref(prefersDark() !== inverted.value)

function applyEffectiveDark(): void {
  isDark.value = prefersDark() !== inverted.value
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.toggle(BODY_CLASS, inverted.value)
  }
}

let initialized = false

function init(): void {
  if (initialized) return
  initialized = true

  applyEffectiveDark()

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyEffectiveDark()
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange)
    } else if (typeof mql.addListener === 'function') {
      mql.addListener(onChange)
    }
  }

  watch(inverted, (value) => {
    saveInverted(value)
    applyEffectiveDark()
  })
}

init()

function toggle(): void {
  inverted.value = !inverted.value
}

// Force the effective scheme to a specific value, accounting for the
// system preference (effectiveDark = prefersDark !== inverted).
function setDark(value: boolean): void {
  inverted.value = prefersDark() !== value
}

export function useDarkMode(): {
  isDark: Ref<boolean>
  toggle: () => void
  setDark: (value: boolean) => void
} {
  return { isDark, toggle, setDark }
}

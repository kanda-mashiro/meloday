import { ref, type Ref } from 'vue'

// The currently focused tag (lowercased), or null when not filtering.
// Transient session state — intentionally not persisted.
const activeTag: Ref<string | null> = ref(null)

export function useTagFilter(): {
  activeTag: Ref<string | null>
  toggle: (tag: string) => void
  clear: () => void
} {
  return {
    activeTag,
    toggle(tag: string) {
      const value = tag.toLowerCase()
      activeTag.value = activeTag.value === value ? null : value
    },
    clear() {
      activeTag.value = null
    },
  }
}

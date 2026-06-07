// Guards "Enter to submit" against IME composition. Two cases it recognises:
//  1. Keys pressed *during* composition belong to the IME — `e.isComposing`
//     (and the legacy `keyCode === 229`, which also covers the very first
//     keystroke, before compositionstart fires).
//  2. Safari delivers the composition-confirming Enter as a keydown *after*
//     compositionend, with `isComposing` already false — so it would otherwise
//     slip through and submit. Binding `onCompositionEnd` lets us recognise an
//     Enter that lands in that same tick.
//
// Usage: bind `onCompositionEnd` to the input's `@compositionend`, and gate the
// Enter handling on `!isImeEnter(e)`.
//
// This is a per-instance factory (not a module singleton): each input needs its
// own composition flag, so call it once per component that owns an input.
export function useImeEnter(): {
  onCompositionEnd: () => void
  isImeEnter: (e: KeyboardEvent) => boolean
} {
  let justComposed = false

  function onCompositionEnd(): void {
    justComposed = true
    // Only the Enter that immediately follows (same task) is the IME's; clear on
    // the next macrotask so a deliberate Enter still submits.
    setTimeout(() => {
      justComposed = false
    }, 0)
  }

  // True when this Enter belongs to the IME (still composing, or Safari's
  // post-compositionend confirm) and must not trigger a submit.
  function isImeEnter(e: KeyboardEvent): boolean {
    return e.isComposing || e.keyCode === 229 || justComposed
  }

  return { onCompositionEnd, isImeEnter }
}

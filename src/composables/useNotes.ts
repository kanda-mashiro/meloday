import { ref, reactive, watch, effectScope, type Ref } from 'vue'
import { supabase, NOTES_TABLE } from '../lib/supabase'
import { useAuth } from './useAuth'

/** The item whose note panel is currently open. */
export interface NoteTarget {
  id: string
  label: string
}

// The item whose note is being viewed/edited (null = panel closed).
const activeItem: Ref<NoteTarget | null> = ref(null)
// Ids of items that have a (non-empty) note — drives the board's note icon.
// Reactive Set: `.has()` tracks, so the icon updates as notes come and go.
const noteIds = reactive(new Set<string>())

// Detached scope so the singleton's auth-watcher survives no matter which
// component first calls useNotes() (the first caller is a transient TodoItem,
// whose own scope would otherwise stop the watcher on unmount).
const scope = effectScope(true)
let initialized = false
function init(): void {
  if (initialized) return
  initialized = true
  if (!supabase) return

  const { user } = useAuth()
  scope.run(() => {
    // On login, load the set of item ids that have notes; clear on logout.
    watch(
      user,
      async (u) => {
        noteIds.clear()
        activeItem.value = null
        if (!u || !supabase) return
        const { data, error } = await supabase
          .from(NOTES_TABLE)
          .select('item_id')
          .eq('user_id', u.id)
        if (error || !data) return
        for (const row of data as { item_id: string }[]) noteIds.add(row.item_id)
      },
      { immediate: true },
    )
  })
}

async function loadNote(itemId: string): Promise<{ content: string; error: string | null }> {
  if (!supabase) return { content: '', error: 'Backend not configured' }
  const { user } = useAuth()
  const uid = user.value?.id
  if (!uid) return { content: '', error: 'Not signed in' }
  const { data, error } = await supabase
    .from(NOTES_TABLE)
    .select('content')
    .eq('item_id', itemId)
    .eq('user_id', uid)
    .maybeSingle()
  if (error) return { content: '', error: error.message }
  return { content: (data?.content as string) ?? '', error: null }
}

async function saveNote(itemId: string, content: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Backend not configured' }
  const { user } = useAuth()
  const uid = user.value?.id
  if (!uid) return { error: 'Not signed in' }

  // An emptied note deletes the row and drops the indicator.
  if (content.trim() === '') {
    const { error } = await supabase
      .from(NOTES_TABLE)
      .delete()
      .eq('item_id', itemId)
      .eq('user_id', uid)
    if (error) return { error: error.message }
    noteIds.delete(itemId)
    return { error: null }
  }

  const { error } = await supabase.from(NOTES_TABLE).upsert({
    item_id: itemId,
    user_id: uid,
    content,
    updated_at: new Date().toISOString(),
  })
  if (error) return { error: error.message }
  noteIds.add(itemId)
  return { error: null }
}

/**
 * Per-item notes: a module singleton holding the open-panel target and the set
 * of items that have a note, plus lazy load/save against the todo_notes table.
 */
export function useNotes(): {
  activeItem: Ref<NoteTarget | null>
  open: (item: NoteTarget) => void
  close: () => void
  hasNote: (itemId: string) => boolean
  loadNote: (itemId: string) => Promise<{ content: string; error: string | null }>
  saveNote: (itemId: string, content: string) => Promise<{ error: string | null }>
} {
  init()
  return {
    activeItem,
    open: (item: NoteTarget) => {
      activeItem.value = item
    },
    close: () => {
      activeItem.value = null
    },
    hasNote: (itemId: string) => noteIds.has(itemId),
    loadNote,
    saveNote,
  }
}

import { ref, type Ref } from 'vue'
import { supabase, ITEMS_TABLE } from '../lib/supabase'
import { useAuth } from './useAuth'

/** A completed todo row, mapped to camelCase for the history view. */
export interface ArchivedItem {
  id: string
  listId: string
  tags: string[]
  text: string
  completedAt: string | null
}

interface ArchiveRow {
  id: string
  list_id: string
  tags: string[] | null
  body: string | null
  completed_at: string | null
}

const PAGE_SIZE = 50

function mapRow(r: ArchiveRow): ArchivedItem {
  return {
    id: r.id,
    listId: r.list_id,
    tags: r.tags ?? [],
    text: r.body ?? '',
    completedAt: r.completed_at,
  }
}

/**
 * View-scoped reader for a user's archived items. Loads lazily (on open),
 * supports text search and pagination. Read-only — archiving relocates history,
 * this is how you browse it. RLS scopes every query to the signed-in user.
 */
export function useArchive(): {
  items: Ref<ArchivedItem[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  query: Ref<string>
  hasMore: Ref<boolean>
  load: () => Promise<void>
  loadMore: () => Promise<void>
  search: (term: string) => Promise<void>
} {
  const items: Ref<ArchivedItem[]> = ref([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const query = ref('')
  const hasMore = ref(false)
  let offset = 0

  async function fetchPage(reset: boolean): Promise<void> {
    if (!supabase) return
    const { user } = useAuth()
    const uid = user.value?.id
    if (!uid) return

    loading.value = true
    error.value = null
    if (reset) {
      offset = 0
      items.value = []
    }

    let q = supabase
      .from(ITEMS_TABLE)
      .select('id, list_id, tags, body, completed_at')
      .eq('user_id', uid)
      .eq('done', true)
      .is('deleted_at', null)
      .order('completed_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + PAGE_SIZE - 1)

    const term = query.value.trim()
    // Search the body text (tags are a jsonb array; the body is what users type).
    if (term) q = q.ilike('body', `%${term}%`)

    const { data, error: err } = await q
    loading.value = false
    if (err) {
      error.value = err.message
      return
    }

    const rows = (data ?? []) as ArchiveRow[]
    items.value = reset ? rows.map(mapRow) : [...items.value, ...rows.map(mapRow)]
    hasMore.value = rows.length === PAGE_SIZE
    offset += rows.length
  }

  return {
    items,
    loading,
    error,
    query,
    hasMore,
    load: () => fetchPage(true),
    loadMore: () => fetchPage(false),
    search: (term: string) => {
      query.value = term
      return fetchPage(true)
    },
  }
}

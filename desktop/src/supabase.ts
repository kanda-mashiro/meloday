import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)

// Session persists in the Tauri webview's localStorage → log in once, stays in.
export const supabase: SupabaseClient | null = isConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null

/** Insert one Inbox item as its own row (per-item model; the web app picks it up
 *  via realtime). list_id 'inbox' matches the web's INBOX_LIST_ID. */
export async function appendInboxItem(label: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Backend not configured' }
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user) return { error: authErr?.message ?? 'Not signed in' }
  const now = new Date().toISOString()
  const { error } = await supabase.from('todo_items').insert({
    id: crypto.randomUUID(),
    user_id: user.id,
    list_id: 'inbox',
    idx: Date.now(),
    label,
    done: false,
    fixed: false,
    completed_at: null,
    deleted_at: null,
    updated_at: now,
  })
  return { error: error ? error.message : null }
}

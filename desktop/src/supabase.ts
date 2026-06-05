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

/** Atomic server-side append to the user's Inbox (see supabase/append_inbox_item.sql). */
export async function appendInboxItem(label: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Backend not configured' }
  const { error } = await supabase.rpc('append_inbox_item', { label })
  return { error: error ? error.message : null }
}

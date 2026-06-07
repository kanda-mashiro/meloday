import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Configured via .env (see .env.example). Both values are safe to ship in the
// frontend — real isolation is enforced by row-level security in the database.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

// Null until configured, so the app keeps running as a local-only todo app.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null

export const NOTES_TABLE = 'todo_notes'
// Per-item row model (multi-device sync). See supabase/todo_items.sql.
export const ITEMS_TABLE = 'todo_items'
export const LISTS_TABLE = 'todo_lists'

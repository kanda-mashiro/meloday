-- Per-user app preferences (accent, columns, text size, spacing, etc.) so a
-- user's settings follow their account across devices. ONE row per user; the
-- whole Preferences object is stored as a single jsonb blob — the shape changes
-- during development, so jsonb means no migrations when a preference is
-- added/removed.
--
-- Whole-object last-write-wins: the client upserts the entire blob on change,
-- and on login the cloud copy wins. No per-field merge needed (preferences are
-- tiny). Dark mode is NOT stored here — it's environment-dependent and stays
-- device-local (see src/composables/useDarkMode.ts).
--
-- Run this in the Supabase SQL editor.

create table if not exists public.user_prefs (
  user_id    uuid primary key references auth.users on delete cascade,
  prefs      jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row-level security: a user can only see and modify their own preferences.
alter table public.user_prefs enable row level security;
drop policy if exists "own prefs" on public.user_prefs;
create policy "own prefs" on public.user_prefs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

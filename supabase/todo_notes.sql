-- Per-item long-form notes (TeuxDeux-style). Kept in their OWN table, NOT in the
-- todo_docs blob: notes can be large, so embedding them would bloat every board
-- read/write and blow past the Realtime payload cap. The board only learns
-- "which items have a note" (a lightweight id list); the content is fetched on
-- demand when the note panel opens, and written only when edited.
--
-- One row per item (item_id is the original TodoItem id).
--
-- Run this in the Supabase SQL editor after schema.sql.

create table if not exists public.todo_notes (
  item_id    uuid primary key,            -- the original TodoItem id
  user_id    uuid not null references auth.users on delete cascade,
  content    text not null default '',    -- markdown / plain text
  updated_at timestamptz not null default now()
);

-- Fast "which of my items have notes" lookup.
create index if not exists todo_notes_user_idx on public.todo_notes (user_id);

-- Row-level security: a user can only see and modify their own notes.
alter table public.todo_notes enable row level security;
drop policy if exists "own notes" on public.todo_notes;
create policy "own notes" on public.todo_notes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

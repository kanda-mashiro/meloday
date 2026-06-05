-- Archive of old completed todo items, kept OUT of the hot todo_docs blob so
-- the active document stays small (fast sync, under the Realtime payload cap).
--
-- Items here are still fully viewable: the app queries this table on demand
-- (by day / by search). Archiving relocates history, it never deletes it.
--
-- Run this in the Supabase SQL editor after schema.sql.

create table if not exists public.todo_archive (
  id           uuid primary key,            -- the original TodoItem id
  user_id      uuid not null references auth.users on delete cascade,
  list_id      text not null,               -- original day id ("YYYY-MM-DD") or custom list id
  idx          int  not null default 0,     -- original position within its list
  label        text not null,
  done         boolean not null default true,
  fixed        boolean not null default false,
  completed_at timestamptz,                 -- when the item was completed
  archived_at  timestamptz not null default now()
);

-- Fast lookup of a user's archive by recency and by day.
create index if not exists todo_archive_user_completed_idx
  on public.todo_archive (user_id, completed_at desc);
create index if not exists todo_archive_user_list_idx
  on public.todo_archive (user_id, list_id);

-- Row-level security: a user can only see and modify their own archived rows.
alter table public.todo_archive enable row level security;
drop policy if exists "own archive" on public.todo_archive;
create policy "own archive" on public.todo_archive
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Custom list definitions (the "Lists" section), one row per list. Same
-- row-level, soft-delete model as todo_items so list create/rename/reorder
-- syncs cleanly across devices. The items in a list live in todo_items keyed by
-- list_id; this table only holds the list's own metadata (title + order).
--
-- Run this in the Supabase SQL editor.

create table if not exists public.todo_lists (
  id         uuid primary key,             -- the CustomList id
  user_id    uuid not null references auth.users on delete cascade,
  idx        int  not null default 0,      -- order among custom lists
  title      text not null default '',
  deleted_at timestamptz,                  -- soft-delete tombstone
  updated_at timestamptz not null default now()
);

create index if not exists todo_lists_user_idx
  on public.todo_lists (user_id) where deleted_at is null;
create index if not exists todo_lists_user_updated_idx
  on public.todo_lists (user_id, updated_at);

-- Row-level security: a user can only see and modify their own lists.
alter table public.todo_lists enable row level security;
drop policy if exists "own lists" on public.todo_lists;
create policy "own lists" on public.todo_lists
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter publication supabase_realtime add table public.todo_lists;

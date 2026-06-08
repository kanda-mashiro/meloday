-- Per-item todo rows — the multi-device source of truth. Replaces the old
-- whole-board blob (todo_docs): each todo is its own row, so edits on different
-- items from different devices never clobber each other, and deletes are soft
-- (deleted_at tombstone) so a stale device can never resurrect them.
--
-- Sync is row-level: the client upserts changed rows (LWW by updated_at) and
-- sets deleted_at to remove; realtime streams row changes to other devices.
-- Notes (todo_notes) stay in their own table and are fetched on demand.
--
-- Run this in the Supabase SQL editor. The old todo_docs / todo_archive tables
-- are no longer used and can be dropped.

create table if not exists public.todo_items (
  id           uuid primary key,            -- the TodoItem id
  user_id      uuid not null references auth.users on delete cascade,
  list_id      text not null,               -- 'YYYY-MM-DD' day, a custom-list uuid, or inbox
  idx          int  not null default 0,     -- order within the list
  tags         jsonb not null default '[]', -- ordered tag names (without '#')
  body         text not null default '',    -- the body text ('body', not 'text', to dodge the SQL keyword)
  done         boolean not null default false,
  fixed        boolean not null default false,  -- added to a past day → doesn't roll forward
  completed_at timestamptz,                 -- when last marked done (null when undone)
  due          timestamptz,                 -- optional deadline; date-only today, timestamptz leaves room for a time-of-day later
  deleted_at   timestamptz,                 -- soft-delete tombstone (kept forever; never resurrect)
  updated_at   timestamptz not null default now()
);

-- If the table already exists, move to the structured tags model:
--   alter table public.todo_items add column if not exists tags jsonb not null default '[]';
--   alter table public.todo_items rename column label to body;

-- Active board reads (a user's live items, by list).
create index if not exists todo_items_user_list_idx
  on public.todo_items (user_id, list_id) where deleted_at is null;
-- Completed-history reads + the lifetime "done" count.
create index if not exists todo_items_user_done_idx
  on public.todo_items (user_id, completed_at desc) where done and deleted_at is null;
-- Delta sync (rows changed since last sync, tombstones included).
create index if not exists todo_items_user_updated_idx
  on public.todo_items (user_id, updated_at);

-- Row-level security: a user can only see and modify their own items.
alter table public.todo_items enable row level security;
drop policy if exists "own items" on public.todo_items;
create policy "own items" on public.todo_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Realtime so other signed-in devices get row changes pushed live.
alter publication supabase_realtime add table public.todo_items;

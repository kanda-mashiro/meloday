-- Run this in the Supabase SQL editor (or `supabase db` if self-hosting).
-- One row per user holding the whole TodoData document, last-write-wins.

create table if not exists public.todo_docs (
  user_id    uuid primary key references auth.users on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row-level security: a user can only see and modify their own row.
alter table public.todo_docs enable row level security;

drop policy if exists "own doc" on public.todo_docs;
create policy "own doc" on public.todo_docs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Enable realtime so other signed-in devices get changes pushed live.
alter publication supabase_realtime add table public.todo_docs;

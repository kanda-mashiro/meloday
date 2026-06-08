-- Per-user yearly occasions (生日/纪念日/节日), one row per user holding the whole list as a single jsonb blob.
--
-- Whole-object last-write-wins: the client upserts the entire array on change,
-- and on login the cloud copy wins. No per-field merge needed (the list is
-- tiny). Each occasion stores only month+day — yearly recurrence is implied.
--
-- Run this in the Supabase SQL editor.

create table if not exists public.user_occasions (
  user_id    uuid primary key references auth.users on delete cascade,
  occasions  jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row-level security: a user can only see and modify their own occasions.
alter table public.user_occasions enable row level security;
drop policy if exists "own occasions" on public.user_occasions;
create policy "own occasions" on public.user_occasions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

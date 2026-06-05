-- Atomic server-side append to the user's Inbox. Used by the desktop quick-
-- capture app (and optionally the web app) so a capture never has to read +
-- rewrite the whole document, which would race with the web app's LWW sync.
--
-- Run this in the Supabase SQL editor after schema.sql.

create or replace function public.append_inbox_item(label text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  next_index int;
  new_item jsonb;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Make sure a document row exists for this user.
  insert into public.todo_docs (user_id, data, updated_at)
    values (
      uid,
      jsonb_build_object(
        'items', '[]'::jsonb,
        'customLists', '[]'::jsonb,
        'at', to_char(now(), 'YYYY-MM-DD'),
        'customAt', 0
      ),
      now()
    )
    on conflict (user_id) do nothing;

  -- Next index among existing inbox items.
  select coalesce(max((it->>'index')::int), -1) + 1
    into next_index
    from public.todo_docs td,
         jsonb_array_elements(td.data->'items') it
    where td.user_id = uid
      and it->>'listId' = 'inbox';

  new_item := jsonb_build_object(
    'id', gen_random_uuid(),
    'listId', 'inbox',
    'index', next_index,
    'label', label,
    'done', false,
    'fixed', false
  );

  update public.todo_docs
    set data = jsonb_set(data, '{items}', coalesce(data->'items', '[]'::jsonb) || new_item),
        updated_at = now()
    where user_id = uid;
end;
$$;

grant execute on function public.append_inbox_item(text) to authenticated;

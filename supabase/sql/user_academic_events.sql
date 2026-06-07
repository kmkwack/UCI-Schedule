-- Personal academic-calendar entries that a user adds themselves (any school).
-- Run this in the Supabase SQL editor.

create table if not exists public.user_academic_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  school       text not null,
  quarter_key  text not null,
  title        text not null,
  subtitle     text,
  date         text not null,
  end_date     text,
  category     text not null default 'deadline',
  created_at   timestamptz not null default now()
);

create index if not exists idx_user_academic_events_user
  on public.user_academic_events (user_id, school, quarter_key);

alter table public.user_academic_events enable row level security;

drop policy if exists "Users can read their own academic events" on public.user_academic_events;
create policy "Users can read their own academic events"
on public.user_academic_events
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can add their own academic events" on public.user_academic_events;
create policy "Users can add their own academic events"
on public.user_academic_events
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can delete their own academic events" on public.user_academic_events;
create policy "Users can delete their own academic events"
on public.user_academic_events
for delete
to authenticated
using (user_id = auth.uid());

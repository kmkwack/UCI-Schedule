-- Sports event reactions and comments for the Home Sports Events detail sheet.

create table if not exists public.sports_event_rsvps (
  event_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('going', 'interested')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists public.sports_event_comments (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) > 0 and char_length(content) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists sports_event_rsvps_event_idx
  on public.sports_event_rsvps (event_id, status);

create index if not exists sports_event_comments_event_created_idx
  on public.sports_event_comments (event_id, created_at);

alter table public.sports_event_rsvps enable row level security;
alter table public.sports_event_comments enable row level security;

drop policy if exists "Authenticated users can read sports event RSVPs" on public.sports_event_rsvps;
create policy "Authenticated users can read sports event RSVPs"
on public.sports_event_rsvps
for select
to authenticated
using (true);

drop policy if exists "Users can upsert their own sports event RSVP" on public.sports_event_rsvps;
create policy "Users can upsert their own sports event RSVP"
on public.sports_event_rsvps
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update their own sports event RSVP" on public.sports_event_rsvps;
create policy "Users can update their own sports event RSVP"
on public.sports_event_rsvps
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete their own sports event RSVP" on public.sports_event_rsvps;
create policy "Users can delete their own sports event RSVP"
on public.sports_event_rsvps
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Authenticated users can read sports event comments" on public.sports_event_comments;
create policy "Authenticated users can read sports event comments"
on public.sports_event_comments
for select
to authenticated
using (true);

drop policy if exists "Users can create their own sports event comments" on public.sports_event_comments;
create policy "Users can create their own sports event comments"
on public.sports_event_comments
for insert
to authenticated
with check (user_id = auth.uid());

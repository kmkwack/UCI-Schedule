-- Repair school scoping for sports event RSVPs/comments.
-- Run this once if the app reports that the sports_event_comments.school column
-- is missing from Supabase's schema cache.

create table if not exists public.sports_event_rsvps (
  school text not null default 'UC Irvine',
  event_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('going', 'interested')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (school, event_id, user_id)
);

create table if not exists public.sports_event_comments (
  id uuid primary key default gen_random_uuid(),
  school text not null default 'UC Irvine',
  event_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) > 0 and char_length(content) <= 500),
  created_at timestamptz not null default now()
);

alter table public.sports_event_rsvps
  add column if not exists school text not null default 'UC Irvine';

alter table public.sports_event_comments
  add column if not exists school text not null default 'UC Irvine';

update public.sports_event_rsvps
   set school = 'UC Irvine'
 where school is null or btrim(school) = '';

update public.sports_event_comments
   set school = 'UC Irvine'
 where school is null or btrim(school) = '';

alter table public.sports_event_rsvps
  drop constraint if exists sports_event_rsvps_event_id_user_id_key;

alter table public.sports_event_rsvps
  drop constraint if exists sports_event_rsvps_event_user_key;

alter table public.sports_event_rsvps
  drop constraint if exists sports_event_rsvps_pkey;

alter table public.sports_event_rsvps
  add constraint sports_event_rsvps_pkey primary key (school, event_id, user_id);

create index if not exists sports_event_rsvps_school_event_idx
  on public.sports_event_rsvps (school, event_id);

create unique index if not exists sports_event_rsvps_school_event_user_idx
  on public.sports_event_rsvps (school, event_id, user_id);

create index if not exists sports_event_comments_school_event_idx
  on public.sports_event_comments (school, event_id, created_at);

grant select, insert, update, delete on public.sports_event_rsvps to authenticated;
grant select, insert, delete on public.sports_event_comments to authenticated;

notify pgrst, 'reload schema';

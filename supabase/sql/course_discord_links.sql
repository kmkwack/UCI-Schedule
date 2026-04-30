-- Student-submitted Discord invite links scoped to a course and quarter.

create table if not exists public.course_discord_links (
  id uuid primary key default gen_random_uuid(),
  school text not null default 'UC Irvine',
  quarter_key text not null,
  course_code text not null,
  course_title text,
  discord_url text not null check (discord_url ~* '^https://discord\.gg/[A-Za-z0-9-]+$'),
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school, quarter_key, course_code)
);

create index if not exists course_discord_links_lookup_idx
  on public.course_discord_links (school, quarter_key, course_code);

grant select, insert, update, delete on public.course_discord_links to authenticated;

alter table public.course_discord_links enable row level security;

drop policy if exists "Authenticated users can read course Discord links" on public.course_discord_links;
create policy "Authenticated users can read course Discord links"
on public.course_discord_links
for select
to authenticated
using (true);

drop policy if exists "Users can submit course Discord links" on public.course_discord_links;
create policy "Users can submit course Discord links"
on public.course_discord_links
for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and discord_url ~* '^https://discord\.gg/[A-Za-z0-9-]+$'
);

drop policy if exists "Submitters can update course Discord links" on public.course_discord_links;
create policy "Submitters can update course Discord links"
on public.course_discord_links
for update
to authenticated
using (submitted_by = auth.uid())
with check (
  submitted_by = auth.uid()
  and discord_url ~* '^https://discord\.gg/[A-Za-z0-9-]+$'
);

drop policy if exists "Submitters can delete course Discord links" on public.course_discord_links;
create policy "Submitters can delete course Discord links"
on public.course_discord_links
for delete
to authenticated
using (submitted_by = auth.uid());

create or replace function public.touch_course_discord_link_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists course_discord_links_touch_updated_at on public.course_discord_links;
create trigger course_discord_links_touch_updated_at
before update on public.course_discord_links
for each row
execute function public.touch_course_discord_link_updated_at();

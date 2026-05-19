-- Profile social links and prior academic history.
-- Additive migration only: creates new tables, helper functions, triggers, and RLS policies.

create table if not exists public.profile_social_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  school text not null,
  instagram text null,
  discord text null,
  linkedin text null,
  github text null,
  website text null,
  visibility text not null default 'friends' check (visibility in ('hidden', 'friends', 'school')),
  updated_at timestamptz not null default now()
);

create table if not exists public.prior_academic_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  school text not null,
  institution text not null,
  term_label text null,
  gpa numeric null,
  credits numeric null,
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profile_social_links_school_visibility_idx
  on public.profile_social_links (school, visibility);

create index if not exists prior_academic_records_owner_school_idx
  on public.prior_academic_records (user_id, school, created_at desc);

create or replace function public.profile_links_prior_history_current_school()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.school
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.profile_links_prior_history_are_friends(target_user_id uuid, target_school text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and target_user_id is not null
    and target_user_id <> auth.uid()
    and target_school = public.profile_links_prior_history_current_school()
    and exists (
      select 1
      from public.friend_requests fr
      join public.profiles requester
        on requester.id = auth.uid()
       and requester.school = target_school
      join public.profiles target
        on target.id = target_user_id
       and target.school = target_school
      where fr.status = 'accepted'
        and (
          (fr.sender_id = auth.uid() and fr.receiver_id = target_user_id)
          or (fr.receiver_id = auth.uid() and fr.sender_id = target_user_id)
        )
    );
$$;

create or replace function public.profile_links_prior_history_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.profile_links_prior_history_current_school() from public;
revoke all on function public.profile_links_prior_history_are_friends(uuid, text) from public;
grant execute on function public.profile_links_prior_history_current_school() to authenticated;
grant execute on function public.profile_links_prior_history_are_friends(uuid, text) to authenticated;

drop trigger if exists profile_social_links_touch_updated_at on public.profile_social_links;
create trigger profile_social_links_touch_updated_at
before update on public.profile_social_links
for each row
execute function public.profile_links_prior_history_touch_updated_at();

drop trigger if exists prior_academic_records_touch_updated_at on public.prior_academic_records;
create trigger prior_academic_records_touch_updated_at
before update on public.prior_academic_records
for each row
execute function public.profile_links_prior_history_touch_updated_at();

alter table public.profile_social_links enable row level security;
alter table public.prior_academic_records enable row level security;

grant select, insert, update, delete on public.profile_social_links to authenticated;
grant select, insert, update, delete on public.prior_academic_records to authenticated;

drop policy if exists "Users can read own profile social links" on public.profile_social_links;
create policy "Users can read own profile social links"
on public.profile_social_links
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Accepted friends can read friend profile social links" on public.profile_social_links;
create policy "Accepted friends can read friend profile social links"
on public.profile_social_links
for select
to authenticated
using (
  visibility = 'friends'
  and public.profile_links_prior_history_are_friends(user_id, school)
);

drop policy if exists "Same-school users can read school profile social links" on public.profile_social_links;
create policy "Same-school users can read school profile social links"
on public.profile_social_links
for select
to authenticated
using (
  visibility = 'school'
  and school = public.profile_links_prior_history_current_school()
);

drop policy if exists "Users can insert own profile social links" on public.profile_social_links;
create policy "Users can insert own profile social links"
on public.profile_social_links
for insert
to authenticated
with check (
  user_id = auth.uid()
  and school = public.profile_links_prior_history_current_school()
);

drop policy if exists "Users can update own profile social links" on public.profile_social_links;
create policy "Users can update own profile social links"
on public.profile_social_links
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and school = public.profile_links_prior_history_current_school()
);

drop policy if exists "Users can delete own profile social links" on public.profile_social_links;
create policy "Users can delete own profile social links"
on public.profile_social_links
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own prior academic records" on public.prior_academic_records;
create policy "Users can read own prior academic records"
on public.prior_academic_records
for select
to authenticated
using (
  user_id = auth.uid()
  and school = public.profile_links_prior_history_current_school()
);

drop policy if exists "Users can insert own prior academic records" on public.prior_academic_records;
create policy "Users can insert own prior academic records"
on public.prior_academic_records
for insert
to authenticated
with check (
  user_id = auth.uid()
  and school = public.profile_links_prior_history_current_school()
);

drop policy if exists "Users can update own prior academic records" on public.prior_academic_records;
create policy "Users can update own prior academic records"
on public.prior_academic_records
for update
to authenticated
using (
  user_id = auth.uid()
  and school = public.profile_links_prior_history_current_school()
)
with check (
  user_id = auth.uid()
  and school = public.profile_links_prior_history_current_school()
);

drop policy if exists "Users can delete own prior academic records" on public.prior_academic_records;
create policy "Users can delete own prior academic records"
on public.prior_academic_records
for delete
to authenticated
using (
  user_id = auth.uid()
  and school = public.profile_links_prior_history_current_school()
);

-- Production readiness P0 fixes for multi-school data scoping and board privacy.
-- Run in the Supabase SQL editor before shipping the updated app.

alter table public.grades
  add column if not exists school text not null default 'UC Irvine';

update public.grades
set school = 'UC Irvine'
where school is null;

alter table public.grades
  drop constraint if exists grades_user_id_quarter_key_course_id_key;

drop index if exists public.grades_user_id_quarter_key_course_id_key;

do $$
begin
  if exists (
    select 1
    from public.grades
    group by user_id, school, quarter_key, course_id
    having count(*) > 1
  ) then
    raise notice 'Skipped grades_user_school_quarter_course_uidx because duplicate grade rows exist. Deduplicate grades first, then rerun this migration.';
  else
    create unique index if not exists grades_user_school_quarter_course_uidx
      on public.grades (user_id, school, quarter_key, course_id);
  end if;
end $$;

create index if not exists grades_school_user_idx
  on public.grades (school, user_id);

alter table public.school_terms
  add column if not exists start_date date,
  add column if not exists end_date date;

drop function if exists public.get_board_author_visibility(uuid[]);

create or replace function public.get_board_author_metadata(author_ids uuid[], target_school text)
returns table(user_id uuid, major text, year text)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as user_id,
    p.major,
    p.year
  from public.profiles p
  where auth.uid() is not null
    and p.id = any(author_ids)
    and p.school = target_school
    and exists (
      select 1
      from public.profiles requester
      where requester.id = auth.uid()
        and requester.school = target_school
    );
$$;

revoke all on function public.get_board_author_metadata(uuid[], text) from public;
grant execute on function public.get_board_author_metadata(uuid[], text) to authenticated;

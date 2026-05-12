-- Hotfix for clients that scope grades by school.
-- Run in the Supabase SQL editor if the app reports:
--   column grades.school does not exist

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

alter table public.sections
  add column if not exists enrolled integer,
  add column if not exists capacity integer,
  add column if not exists waitlist integer,
  add column if not exists waitlist_capacity integer;

create index if not exists sections_school_quarter_enrollment_status_idx
  on public.sections (school, quarter_key, status)
  where status is not null;

notify pgrst, 'reload schema';

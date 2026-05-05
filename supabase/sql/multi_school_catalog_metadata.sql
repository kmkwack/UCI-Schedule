-- Multi-school catalog metadata.
-- Keeps public.sections lean enough for app search while preserving source-system
-- identity and seed status for Cornell / Purdue / Maryland / UCI sync jobs.

alter table public.sections
  add column if not exists source text,
  add column if not exists source_id text,
  add column if not exists source_term_code text,
  add column if not exists campus text,
  add column if not exists status text,
  add column if not exists last_synced_at timestamptz not null default now();

alter table public.sections
  alter column units type numeric using units::numeric;

create unique index if not exists sections_school_source_unique_idx
  on public.sections (school, source, source_id, source_term_code)
  where source is not null and source_id is not null and source_term_code is not null;

create index if not exists sections_school_quarter_campus_idx
  on public.sections (school, quarter_key, campus);

create index if not exists sections_school_quarter_status_idx
  on public.sections (school, quarter_key, status);

create table if not exists public.school_terms (
  school text not null,
  quarter_key text not null,
  source text not null,
  source_term_code text not null,
  status text not null default 'seeded',
  section_count integer not null default 0,
  department_count integer not null default 0,
  error_count integer not null default 0,
  last_seeded_at timestamptz not null default now(),
  notes text,
  primary key (school, quarter_key)
);

create index if not exists school_terms_school_status_idx
  on public.school_terms (school, status);

create table if not exists public.school_departments (
  school text not null,
  department text not null,
  dept_name text,
  source text,
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  primary key (school, department)
);

create index if not exists school_departments_school_active_idx
  on public.school_departments (school, active, department);

alter table public.school_terms enable row level security;
alter table public.school_departments enable row level security;

grant select on public.school_terms to anon, authenticated;
grant select on public.school_departments to anon, authenticated;

drop policy if exists "Public can read school terms" on public.school_terms;
create policy "Public can read school terms"
  on public.school_terms
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can read school departments" on public.school_departments;
create policy "Public can read school departments"
  on public.school_departments
  for select
  to anon, authenticated
  using (true);

create table if not exists public.section_source_payloads (
  section_id text primary key references public.sections(id) on delete cascade,
  school text not null,
  source text not null,
  source_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists section_source_payloads_school_source_idx
  on public.section_source_payloads (school, source);

alter table public.timetables
  add column if not exists school text not null default 'UC Irvine';

update public.timetables
   set school = 'UC Irvine'
 where school is null or btrim(school) = '';

create index if not exists timetables_user_school_quarter_idx
  on public.timetables (user_id, school, quarter_key);

notify pgrst, 'reload schema';

alter table public.sections
  add column if not exists school text not null default 'UC Irvine';

create index if not exists sections_school_quarter_department_idx
  on public.sections (school, quarter_key, department);

create index if not exists sections_school_quarter_code_idx
  on public.sections (school, quarter_key, code);

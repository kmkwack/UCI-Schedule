-- Rebuild school_terms from the actual sections table.
-- Run this after historical backfills or anytime Add Quarter metadata looks stale.

insert into public.school_terms (
  school,
  quarter_key,
  source,
  source_term_code,
  status,
  section_count,
  department_count,
  error_count,
  last_seeded_at,
  notes
)
select
  school,
  quarter_key,
  coalesce(max(source), 'sections') as source,
  coalesce(max(source_term_code), quarter_key) as source_term_code,
  'seeded' as status,
  count(*)::integer as section_count,
  count(distinct department)::integer as department_count,
  0 as error_count,
  now() as last_seeded_at,
  'Reconciled from sections table' as notes
from public.sections
where school is not null
  and btrim(school) <> ''
  and quarter_key is not null
  and btrim(quarter_key) <> ''
group by school, quarter_key
having count(*) > 0
on conflict (school, quarter_key) do update set
  source = excluded.source,
  source_term_code = excluded.source_term_code,
  status = excluded.status,
  section_count = excluded.section_count,
  department_count = excluded.department_count,
  error_count = excluded.error_count,
  last_seeded_at = excluded.last_seeded_at,
  notes = excluded.notes;

notify pgrst, 'reload schema';

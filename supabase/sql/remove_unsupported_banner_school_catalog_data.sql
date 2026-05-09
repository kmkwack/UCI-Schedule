-- Remove catalog data for schools whose course-data source is not approved for
-- production use yet. This intentionally deletes only imported catalog metadata,
-- not user-created profiles, timetables, reviews, boards, messages, or friends.
--
-- Supabase SQL Editor can time out on one huge DELETE/COUNT. Run the blocks
-- below one at a time. Repeat each delete batch block until it returns
-- deleted_rows = 0, then move to the next block.
--
-- Keep:
--   UC Irvine, University of Maryland, Cornell, Purdue, UIUC
--
-- Remove:
--   Banner-backed schools currently pending explicit permission.

-- ---------------------------------------------------------------------------
-- 1) Fast remaining-data check. This avoids expensive full table counts.
-- ---------------------------------------------------------------------------
with target_schools(school) as (
  values
    ('UC Riverside'),
    ('Northeastern University'),
    ('Temple University'),
    ('Georgia State University'),
    ('Georgia Institute of Technology'),
    ('West Virginia University'),
    ('Sam Houston State University'),
    ('Denison University'),
    ('University of North Carolina Greensboro'),
    ('Eastern Illinois University'),
    ('University of North Georgia'),
    ('Alfred State College'),
    ('Canisius University'),
    ('Genesee Community College'),
    ('Utah Valley University'),
    ('Lehigh University'),
    ('Rider University'),
    ('Wheaton College (Massachusetts)')
),
target_sources(source) as (
  values
    ('ucr-banner'),
    ('neu-banner'),
    ('temple-banner'),
    ('gsu-banner'),
    ('gatech-banner'),
    ('wvu-banner'),
    ('shsu-banner'),
    ('denison-banner'),
    ('uncg-banner'),
    ('eiu-banner'),
    ('ung-banner'),
    ('alfredstate-banner'),
    ('canisius-banner'),
    ('genesee-banner'),
    ('uvu-banner'),
    ('lehigh-banner'),
    ('rider-banner'),
    ('wheatonma-banner')
)
select 'section_source_payloads' as table_name, exists (
  select 1
  from public.section_source_payloads p
  where p.school in (select school from target_schools)
     or p.source in (select source from target_sources)
  limit 1
) as has_rows_left
union all
select 'sections', exists (
  select 1
  from public.sections sec
  where sec.school in (select school from target_schools)
     or sec.source in (select source from target_sources)
  limit 1
)
union all
select 'school_terms', exists (
  select 1
  from public.school_terms t
  where t.school in (select school from target_schools)
     or t.source in (select source from target_sources)
  limit 1
)
union all
select 'school_departments', exists (
  select 1
  from public.school_departments d
  where d.school in (select school from target_schools)
     or d.source in (select source from target_sources)
  limit 1
);

-- ---------------------------------------------------------------------------
-- 1b) If sections still look present, run this sample to see exactly which
-- stored school/source values remain. This returns sample rows, not a slow
-- full count.
-- ---------------------------------------------------------------------------
with target_schools(school) as (
  values
    ('UC Riverside'),
    ('Northeastern University'),
    ('Temple University'),
    ('Georgia State University'),
    ('Georgia Institute of Technology'),
    ('West Virginia University'),
    ('Sam Houston State University'),
    ('Denison University'),
    ('University of North Carolina Greensboro'),
    ('Eastern Illinois University'),
    ('University of North Georgia'),
    ('Alfred State College'),
    ('Canisius University'),
    ('Genesee Community College'),
    ('Utah Valley University'),
    ('Lehigh University'),
    ('Rider University'),
    ('Wheaton College (Massachusetts)')
),
target_sources(source) as (
  values
    ('ucr-banner'),
    ('neu-banner'),
    ('temple-banner'),
    ('gsu-banner'),
    ('gatech-banner'),
    ('wvu-banner'),
    ('shsu-banner'),
    ('denison-banner'),
    ('uncg-banner'),
    ('eiu-banner'),
    ('ung-banner'),
    ('alfredstate-banner'),
    ('canisius-banner'),
    ('genesee-banner'),
    ('uvu-banner'),
    ('lehigh-banner'),
    ('rider-banner'),
    ('wheatonma-banner')
)
select id, school, source, quarter_key, department, code, title
from public.sections sec
where sec.school in (select school from target_schools)
   or sec.source in (select source from target_sources)
limit 50;

-- ---------------------------------------------------------------------------
-- 2) Delete section_source_payloads in small batches.
-- Run this block repeatedly until deleted_rows = 0.
-- If it still times out, change "limit 2000" to "limit 500".
-- ---------------------------------------------------------------------------
with target_schools(school) as (
  values
    ('UC Riverside'),
    ('Northeastern University'),
    ('Temple University'),
    ('Georgia State University'),
    ('Georgia Institute of Technology'),
    ('West Virginia University'),
    ('Sam Houston State University'),
    ('Denison University'),
    ('University of North Carolina Greensboro'),
    ('Eastern Illinois University'),
    ('University of North Georgia'),
    ('Alfred State College'),
    ('Canisius University'),
    ('Genesee Community College'),
    ('Utah Valley University'),
    ('Lehigh University'),
    ('Rider University'),
    ('Wheaton College (Massachusetts)')
),
target_sources(source) as (
  values
    ('ucr-banner'),
    ('neu-banner'),
    ('temple-banner'),
    ('gsu-banner'),
    ('gatech-banner'),
    ('wvu-banner'),
    ('shsu-banner'),
    ('denison-banner'),
    ('uncg-banner'),
    ('eiu-banner'),
    ('ung-banner'),
    ('alfredstate-banner'),
    ('canisius-banner'),
    ('genesee-banner'),
    ('uvu-banner'),
    ('lehigh-banner'),
    ('rider-banner'),
    ('wheatonma-banner')
),
batch as (
  select p.ctid
  from public.section_source_payloads p
  where p.school in (select school from target_schools)
     or p.source in (select source from target_sources)
  limit 2000
),
deleted as (
  delete from public.section_source_payloads p
  using batch b
  where p.ctid = b.ctid
  returning 1
)
select count(*) as deleted_rows from deleted;

-- ---------------------------------------------------------------------------
-- 3) Delete sections in small batches.
-- Run this block repeatedly until deleted_rows = 0.
-- If it still times out, change "limit 2000" to "limit 500".
-- ---------------------------------------------------------------------------
with target_schools(school) as (
  values
    ('UC Riverside'),
    ('Northeastern University'),
    ('Temple University'),
    ('Georgia State University'),
    ('Georgia Institute of Technology'),
    ('West Virginia University'),
    ('Sam Houston State University'),
    ('Denison University'),
    ('University of North Carolina Greensboro'),
    ('Eastern Illinois University'),
    ('University of North Georgia'),
    ('Alfred State College'),
    ('Canisius University'),
    ('Genesee Community College'),
    ('Utah Valley University'),
    ('Lehigh University'),
    ('Rider University'),
    ('Wheaton College (Massachusetts)')
),
target_sources(source) as (
  values
    ('ucr-banner'),
    ('neu-banner'),
    ('temple-banner'),
    ('gsu-banner'),
    ('gatech-banner'),
    ('wvu-banner'),
    ('shsu-banner'),
    ('denison-banner'),
    ('uncg-banner'),
    ('eiu-banner'),
    ('ung-banner'),
    ('alfredstate-banner'),
    ('canisius-banner'),
    ('genesee-banner'),
    ('uvu-banner'),
    ('lehigh-banner'),
    ('rider-banner'),
    ('wheatonma-banner')
),
batch as (
  select sec.ctid
  from public.sections sec
  where sec.school in (select school from target_schools)
     or sec.source in (select source from target_sources)
  limit 2000
),
deleted as (
  delete from public.sections sec
  using batch b
  where sec.ctid = b.ctid
  returning 1
)
select count(*) as deleted_rows from deleted;

-- ---------------------------------------------------------------------------
-- 4) Delete small metadata tables. These should finish quickly.
-- ---------------------------------------------------------------------------
with target_schools(school) as (
  values
    ('UC Riverside'),
    ('Northeastern University'),
    ('Temple University'),
    ('Georgia State University'),
    ('Georgia Institute of Technology'),
    ('West Virginia University'),
    ('Sam Houston State University'),
    ('Denison University'),
    ('University of North Carolina Greensboro'),
    ('Eastern Illinois University'),
    ('University of North Georgia'),
    ('Alfred State College'),
    ('Canisius University'),
    ('Genesee Community College'),
    ('Utah Valley University'),
    ('Lehigh University'),
    ('Rider University'),
    ('Wheaton College (Massachusetts)')
),
target_sources(source) as (
  values
    ('ucr-banner'),
    ('neu-banner'),
    ('temple-banner'),
    ('gsu-banner'),
    ('gatech-banner'),
    ('wvu-banner'),
    ('shsu-banner'),
    ('denison-banner'),
    ('uncg-banner'),
    ('eiu-banner'),
    ('ung-banner'),
    ('alfredstate-banner'),
    ('canisius-banner'),
    ('genesee-banner'),
    ('uvu-banner'),
    ('lehigh-banner'),
    ('rider-banner'),
    ('wheatonma-banner')
),
deleted_terms as (
  delete from public.school_terms t
  where t.school in (select school from target_schools)
     or t.source in (select source from target_sources)
  returning 1
),
deleted_departments as (
  delete from public.school_departments d
  where d.school in (select school from target_schools)
     or d.source in (select source from target_sources)
  returning 1
)
select 'school_terms' as table_name, count(*) as deleted_rows from deleted_terms
union all
select 'school_departments', count(*) from deleted_departments;

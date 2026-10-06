-- Correct the UC Irvine "P/NP Change Deadline" and remove known-bad scraped rows.
-- Run once in the Supabase SQL editor. Idempotent.
--
-- 1. The curated P/NP row carried the week-6 "drop without a W grade" date
--    (Nov 6). Per the registrar's add/drop policy
--    (https://www.reg.uci.edu/enrollment/adc/adcpolicy.html) the grading option
--    can be changed without approval only through the end of week 2 — Oct 9
--    for Fall 2026; weeks 3-10 need the dean's approval. Curated rows win over
--    scraped ones in the app, so fixing the scraper alone would not change
--    what students see.
update academic_calendar
set date = '2026-10-09',
    subtitle = 'Change grading option without dean''s approval (5 PM)',
    url = 'https://www.reg.uci.edu/enrollment/adc/adcpolicy.html'
where id = 'uci-fa26-pnp';

-- 2. Keep the Nov 6 date, under the name it actually has.
insert into academic_calendar (id, school, quarter_key, title, subtitle, date, category, url)
values ('uci-fa26-dropnow', 'UC Irvine', '2026-Fall', 'Drop Without W Deadline',
        'Dean''s approval required (5 PM)', '2026-11-06', 'withdrawal',
        'https://www.reg.uci.edu/enrollment/adc/adcpolicy.html')
on conflict (id) do nothing;

-- 3. Rows left behind by earlier scraper runs that no current run produces.
--    The seeder now prunes these itself once the fix is on main; this just
--    removes them before the next nightly run.
--      Memorial Day "Mar 26 2027" was Farmworkers Day's date from a shared row.
--      Labor Day "Sep 6 2026" (a Sunday) was 2027's date.
delete from academic_calendar
where school = 'UC Irvine'
  and id in ('auto-uci-2027-winter-memorial-day', 'auto-uci-2026-fall-labor-day');

// Rebuilds the lightweight `school_terms` catalog from the real `sections` data.
//
// This is intentionally separate from the mobile app. The app should read the
// tiny `school_terms` table quickly; this script keeps that table honest after
// large backfills or subject-only retry runs.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/reconcile-school-terms.js
//   node scripts/reconcile-school-terms.js --from-year 2024 --to-year 2026 --schools purdue,uiuc
//   node scripts/reconcile-school-terms.js --dry-run

const { createClient } = require('@supabase/supabase-js');

const DEFAULT_SUPABASE_URL = 'https://koiawtfuuevblrvlpuhe.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_JnbSRv8Y1Ue_BAp5q9EWMA_YjZmAwcZ';

const SUPABASE_URL = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
const DRY_RUN = process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';

const SCHOOL_CONFIGS = [
  {
    alias: 'uci',
    school: 'UC Irvine',
    source: 'anteaterapi',
    terms: ['Winter', 'Spring', 'Summer1', 'Summer10wk', 'Summer2', 'Fall'],
    sourceTermCode: (year, term) => `${year}-${term}`,
  },
  {
    alias: 'cornell',
    school: 'Cornell University',
    source: 'cornell-class-roster',
    terms: ['Spring', 'Summer', 'Fall'],
    sourceTermCode: (year, term) => `${{ Spring: 'SP', Summer: 'SU', Fall: 'FA' }[term]}${String(year).slice(-2)}`,
  },
  {
    alias: 'umd',
    school: 'University of Maryland, College Park',
    source: 'umd.io',
    terms: ['Spring', 'Summer', 'Fall'],
    sourceTermCode: (year, term) => `${year}${{ Spring: '01', Summer: '05', Fall: '08' }[term]}`,
  },
  {
    alias: 'purdue',
    school: 'Purdue University',
    source: 'purdue.io',
    terms: ['Spring', 'Summer', 'Fall'],
    sourceTermCode: (year, term) => `${Number(year) + (term === 'Fall' ? 1 : 0)}${{ Spring: '20', Summer: '30', Fall: '10' }[term]}`,
  },
  {
    alias: 'uiuc',
    school: 'University of Illinois Urbana-Champaign',
    source: 'uiuc-cis-api',
    terms: ['Spring', 'Summer', 'Fall'],
    sourceTermCode: (year, term) => `${year}-${term.toLowerCase()}`,
  },
];

function argValue(name, fallback = null) {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function selectedSchools() {
  const raw = argValue('--schools', 'all');
  if (raw === 'all') return SCHOOL_CONFIGS;
  const requested = new Set(raw.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean));
  return SCHOOL_CONFIGS.filter((config) => requested.has(config.alias) || requested.has(config.school.toLowerCase()));
}

function quarterKey(year, term) {
  return `${year}-${term}`;
}

async function countSectionsAndDepartments(supabase, school, qKey) {
  const departments = new Set();
  let sectionCount = 0;
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error, count } = await supabase
      .from('sections')
      .select('department', { count: from === 0 ? 'exact' : undefined })
      .eq('school', school)
      .eq('quarter_key', qKey)
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);
    if (from === 0) sectionCount = count ?? 0;
    (data ?? []).forEach((row) => {
      if (row.department) departments.add(row.department);
    });

    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return { sectionCount, departmentCount: departments.size };
}

async function upsertTerms(supabase, rows) {
  if (rows.length === 0 || DRY_RUN) return;
  const { error } = await supabase
    .from('school_terms')
    .upsert(rows, { onConflict: 'school,quarter_key' });
  if (error) throw new Error(`school_terms upsert failed: ${error.message}`);
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const fromYear = Number(argValue('--from-year', '2019'));
  const toYear = Number(argValue('--to-year', String(new Date().getFullYear() + 1)));
  const schools = selectedSchools();
  const now = new Date().toISOString();

  if (!Number.isFinite(fromYear) || !Number.isFinite(toYear) || fromYear > toYear) {
    throw new Error('Invalid --from-year / --to-year range.');
  }

  console.log(`Reconciling school_terms from sections (${fromYear}-${toYear})${DRY_RUN ? ' [dry-run]' : ''}`);

  for (const config of schools) {
    const rows = [];
    console.log(`\n${config.school}`);

    for (let year = fromYear; year <= toYear; year += 1) {
      for (const term of config.terms) {
        const qKey = quarterKey(year, term);
        const { sectionCount, departmentCount } = await countSectionsAndDepartments(supabase, config.school, qKey);
        if (sectionCount === 0) continue;

        rows.push({
          school: config.school,
          quarter_key: qKey,
          source: config.source,
          source_term_code: config.sourceTermCode(year, term),
          status: 'seeded',
          section_count: sectionCount,
          department_count: departmentCount,
          error_count: 0,
          last_seeded_at: now,
          notes: 'Reconciled from sections table',
        });
        console.log(`  ✓ ${qKey.padEnd(16)} ${sectionCount.toLocaleString()} sections, ${departmentCount.toLocaleString()} departments`);
      }
    }

    await upsertTerms(supabase, rows);
    console.log(`  → ${rows.length} terms ${DRY_RUN ? 'found' : 'upserted'}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

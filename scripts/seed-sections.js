// ─────────────────────────────────────────────────────────────────────────────
// UCI Section Seeder — 2026 Spring
// Fetches every UCI course section from Anteater API and upserts into Supabase.
//
// HOW TO RUN:
//   node scripts/seed-sections.js
//
// BEFORE RUNNING:
//   1. Supabase project → Settings → API → copy Project URL + service_role key
// ─────────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL        = 'https://koiawtfuuevblrvlpuhe.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvaWF3dGZ1dWV2YmxydmxwdWhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM5MjgyMSwiZXhwIjoyMDkxOTY4ODIxfQ.66VReYhiU9ssbT_yMmB_KoH_0qpmsUu5YrUn69His54';
const ANTEATER_API_KEY    = '1RHP9_TksIaNG6whqwEBCCmREp5Ub4CD-pjeuHZu1kY.sk.izl90mcmhm0vfui8124bod7z';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Single-quarter mode: node scripts/seed-sections.js Spring 2026
// Bulk mode (2019–2025):  node scripts/seed-sections.js
const SINGLE_QUARTER = process.argv[2] ?? null;
const SINGLE_YEAR    = process.argv[3] ?? null;

const BULK_QUARTERS = [];
for (let y = 2019; y <= 2025; y++) {
  BULK_QUARTERS.push({ year: String(y), quarter: 'Winter' });
  BULK_QUARTERS.push({ year: String(y), quarter: 'Spring' });
  BULK_QUARTERS.push({ year: String(y), quarter: 'Fall' });
}
const CONCURRENCY    = 8;   // parallel department fetches
const REQUEST_DELAY_MS = 150; // pause between each request
const RETRY_DELAY_MS = 5000; // longer pause after a 429/error

// ─── fetch all department codes from Anteater API ────────────────────────────

async function fetchDepartments() {
  const url = 'https://anteaterapi.com/v2/rest/websoc/departments';
  const res = await fetch(url, { headers: { Authorization: `Bearer ${ANTEATER_API_KEY}` } });
  if (!res.ok) throw new Error(`Failed to fetch departments: HTTP ${res.status}`);
  const json = await res.json();
  if (!json.ok || !Array.isArray(json.data)) throw new Error('Unexpected departments response');
  return json.data.map((d) => d.deptCode ?? d.departmentCode ?? d.code).filter(Boolean);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatTime(start, end) {
  if (!start || !end) return 'TBA';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(start.hour)}:${pad(start.minute)} - ${pad(end.hour)}:${pad(end.minute)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── fetch one department from Anteater API ───────────────────────────────────

async function fetchDepartment(year, quarter, dept, retries = 3) {
  const url = `https://anteaterapi.com/v2/rest/websoc?department=${encodeURIComponent(dept)}&year=${year}&quarter=${quarter}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${ANTEATER_API_KEY}` } });
  if (res.status === 429) {
    if (retries > 0) {
      await sleep(RETRY_DELAY_MS);
      return fetchDepartment(year, quarter, dept, retries - 1);
    }
    throw new Error(`HTTP 429 (rate limited, gave up after retries)`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.ok) return [];

  const qKey = `${year}-${quarter}`;
  const rows = [];

  for (const school of json.data.schools ?? []) {
    for (const d of school.departments ?? []) {
      for (const course of d.courses ?? []) {
        const code = `${d.deptCode} ${course.courseNumber}`;
        for (const section of course.sections ?? []) {
          if (section.isCancelled) continue;

          const meeting = section.meetings?.[0];
          const days    = meeting?.timeIsTBA ? 'TBA' : (meeting?.days ?? 'TBA');
          const time    = meeting?.timeIsTBA ? 'TBA' : formatTime(meeting?.startTime, meeting?.endTime);

          rows.push({
            id:            `${section.sectionCode}::${qKey}`,
            quarter_key:   qKey,
            department:    d.deptCode,
            code,
            title:         course.courseTitle ?? '',
            section_label: `${section.sectionType} ${section.sectionNum}`,
            professor:     section.instructors?.[0] ?? '',
            days,
            time,
            location:      meeting?.bldg?.[0] ?? null,
            units:         parseInt(section.units) || null,
          });
        }
      }
    }
  }

  return rows;
}

// ─── upsert rows into Supabase ────────────────────────────────────────────────

async function upsertRows(rows) {
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from('sections').upsert(chunk, { onConflict: 'id' });
    if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
  }
}

// ─── run N tasks concurrently ─────────────────────────────────────────────────

async function runConcurrent(items, worker, concurrency) {
  const queue = [...items];
  const active = new Set();
  const results = [];

  function runNext() {
    if (queue.length === 0) return;
    const item = queue.shift();
    const p = worker(item).then((r) => {
      results.push(r);
      active.delete(p);
      runNext();
    }).catch((err) => {
      results.push({ error: err, item });
      active.delete(p);
      runNext();
    });
    active.add(p);
  }

  for (let i = 0; i < concurrency; i++) runNext();
  while (active.size > 0) await sleep(50);
  return results;
}

// ─── main ────────────────────────────────────────────────────────────────────

async function seedQuarter(year, quarter, departments) {
  console.log(`\n── ${quarter} ${year} ${'─'.repeat(30)}`);
  let sections = 0;
  let errors   = 0;

  await runConcurrent(departments, async (dept) => {
    try {
      await sleep(REQUEST_DELAY_MS);
      const rows = await fetchDepartment(year, quarter, dept);
      if (rows.length > 0) {
        await upsertRows(rows);
        console.log(`  ✓ ${dept.padEnd(12)} ${rows.length} sections`);
        sections += rows.length;
      }
    } catch (err) {
      console.error(`  ✗ ${dept.padEnd(12)} ${err.message}`);
      errors++;
    }
  }, CONCURRENCY);

  console.log(`  → ${sections.toLocaleString()} sections, ${errors} errors`);
  return { sections, errors };
}

async function main() {
  console.log(`Fetching department list from Anteater API…`);
  let departments;
  try {
    departments = await fetchDepartments();
    console.log(`Found ${departments.length} departments.`);
  } catch (err) {
    console.error(`Could not fetch departments: ${err.message}`);
    process.exit(1);
  }

  const quarters = SINGLE_QUARTER && SINGLE_YEAR
    ? [{ year: SINGLE_YEAR, quarter: SINGLE_QUARTER }]
    : BULK_QUARTERS;

  console.log(`Seeding ${quarters.length} quarter(s)…`);

  let totalSections = 0;
  let totalErrors   = 0;

  for (const { year, quarter } of quarters) {
    const { sections, errors } = await seedQuarter(year, quarter, departments);
    totalSections += sections;
    totalErrors   += errors;
  }

  console.log('\n═════════════════════════════════════════');
  console.log(`Done! ${totalSections.toLocaleString()} total sections inserted across ${quarters.length} quarter(s).`);
  if (totalErrors > 0) console.log(`     ${totalErrors} departments failed — re-run to retry.`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

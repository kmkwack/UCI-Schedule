// ─────────────────────────────────────────────────────────────────────────────
// Enrollment History Seeder
// Fetches day-by-day enrollment history for every course from Anteater API
// and upserts into Supabase `enrollment_history` table.
//
// HOW TO RUN:
//   node scripts/seed-enrollment-history.js
//
// BEFORE RUNNING:
//   Create the table in Supabase SQL editor:
//
//   CREATE TABLE enrollment_history (
//     id TEXT PRIMARY KEY,  -- "DEPT::COURSENUM"
//     department TEXT NOT NULL,
//     course_number TEXT NOT NULL,
//     history JSONB NOT NULL DEFAULT '[]',
//     updated_at TIMESTAMPTZ DEFAULT now()
//   );
// ─────────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTEATER_API_KEY     = process.env.ANTEATER_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ANTEATER_API_KEY) {
  throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY, or ANTEATER_API_KEY environment variable.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CONCURRENCY     = 6;
const REQUEST_DELAY   = 200;
const RETRY_DELAY     = 6000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── fetch all unique dept+courseNumber combos from the sections table ────────

async function fetchCoursePairs() {
  console.log('Fetching course list from Supabase sections table…');
  const seen = new Set();
  const pairs = [];
  let from = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('sections')
      .select('department, code')
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`Supabase fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      const courseNumber = row.code?.split(' ').slice(1).join(' ');
      if (!row.department || !courseNumber) continue;
      const key = `${row.department}::${courseNumber}`;
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push({ department: row.department, courseNumber });
      }
    }

    from += PAGE;
    if (data.length < PAGE) break;
  }

  console.log(`Found ${pairs.length} unique courses.`);
  return pairs;
}

// ─── fetch enrollment history from Anteater API ───────────────────────────────

async function fetchEnrollmentHistory(department, courseNumber, retries = 3) {
  const params = new URLSearchParams({ department, courseNumber, sectionType: 'Lec' });
  const url = `https://anteaterapi.com/v2/rest/enrollmentHistory?${params}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${ANTEATER_API_KEY}` } });

  if (res.status === 429) {
    if (retries > 0) { await sleep(RETRY_DELAY); return fetchEnrollmentHistory(department, courseNumber, retries - 1); }
    throw new Error('HTTP 429 — rate limited');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  if (!json.ok || !Array.isArray(json.data)) return [];

  // Filter out quarters with no date data, then parse into compact shape
  return json.data
    .filter((q) => q.dates?.length > 0)
    .map((q) => ({
      year: q.year,
      quarter: q.quarter,
      instructors: q.instructors ?? [],
      days: q.dates.map((date, i) => ({
        date,
        enrolled: Number(q.totalEnrolledHistory[i]),
        capacity: Number(q.maxCapacityHistory[i]),
        waitlist: q.waitlistHistory[i] === '-1' ? null : Number(q.waitlistHistory[i]),
      })),
    }));
}

// ─── run N tasks concurrently ─────────────────────────────────────────────────

async function runConcurrent(items, worker, concurrency) {
  const queue = [...items];
  const active = new Set();

  function runNext() {
    if (queue.length === 0) return;
    const item = queue.shift();
    const p = worker(item).finally(() => { active.delete(p); runNext(); });
    active.add(p);
  }

  for (let i = 0; i < concurrency; i++) runNext();
  while (active.size > 0) await sleep(50);
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  const pairs = await fetchCoursePairs();
  let done = 0, skipped = 0, errors = 0;

  await runConcurrent(pairs, async ({ department, courseNumber }) => {
    try {
      await sleep(REQUEST_DELAY);
      const history = await fetchEnrollmentHistory(department, courseNumber);

      if (history.length === 0) { skipped++; return; }

      const { error } = await supabase.from('enrollment_history').upsert({
        id: `${department}::${courseNumber}`,
        department,
        course_number: courseNumber,
        history,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

      if (error) throw new Error(error.message);
      done++;
      if (done % 50 === 0) console.log(`  ✓ ${done} courses seeded (${skipped} no data, ${errors} errors)`);
    } catch (err) {
      errors++;
      console.error(`  ✗ ${department} ${courseNumber}: ${err.message}`);
    }
  }, CONCURRENCY);

  console.log('\n═════════════════════════════════════════');
  console.log(`Done! ${done} courses seeded, ${skipped} had no history, ${errors} errors.`);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });

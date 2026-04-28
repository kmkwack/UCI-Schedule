// ─────────────────────────────────────────────────────────────────────────────
// Summer Session Seeder — 2019 to present
// Seeds Summer1, Summer2, and Summer10wk for each year into the sections table.
//
// HOW TO RUN:
//   node scripts/seed-summer.js              # seeds all years 2019–2026
//   node scripts/seed-summer.js Summer1 2026 # seeds a single session
// ─────────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANTEATER_API_KEY     = process.env.ANTEATER_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ANTEATER_API_KEY) {
  throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_KEY, or ANTEATER_API_KEY environment variable.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const SUMMER_SESSIONS = ['Summer1', 'Summer10wk', 'Summer2'];
const CONCURRENCY     = 8;
const REQUEST_DELAY   = 150;
const RETRY_DELAY     = 5000;

const SINGLE_SESSION = process.argv[2] ?? null;
const SINGLE_YEAR    = process.argv[3] ?? null;

const BULK_QUARTERS = [];
for (let y = 2019; y <= 2026; y++) {
  for (const session of SUMMER_SESSIONS) {
    BULK_QUARTERS.push({ year: String(y), quarter: session });
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchDepartments() {
  const res = await fetch('https://anteaterapi.com/v2/rest/websoc/departments', {
    headers: { Authorization: `Bearer ${ANTEATER_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch departments: HTTP ${res.status}`);
  const json = await res.json();
  if (!json.ok || !Array.isArray(json.data)) throw new Error('Unexpected departments response');
  return json.data.map((d) => d.deptCode ?? d.departmentCode ?? d.code).filter(Boolean);
}

function formatTime(start, end) {
  if (!start || !end) return 'TBA';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(start.hour)}:${pad(start.minute)} - ${pad(end.hour)}:${pad(end.minute)}`;
}

async function fetchDepartment(year, quarter, dept, retries = 3) {
  const url = `https://anteaterapi.com/v2/rest/websoc?department=${encodeURIComponent(dept)}&year=${year}&quarter=${quarter}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${ANTEATER_API_KEY}` } });
  if (res.status === 429) {
    if (retries > 0) { await sleep(RETRY_DELAY); return fetchDepartment(year, quarter, dept, retries - 1); }
    throw new Error('HTTP 429 — rate limited');
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
            id:               `${section.sectionCode}::${qKey}`,
            quarter_key:      qKey,
            department:       d.deptCode,
            dept_name:        d.deptName ?? null,
            code,
            title:            course.courseTitle ?? '',
            section_label:    `${section.sectionType} ${section.sectionNum}`,
            professor:        section.instructors?.[0] ?? '',
            instructors:      section.instructors ?? [],
            days,
            time,
            location:         meeting?.bldg?.[0] ?? null,
            meetings:         section.meetings ?? [],
            units:            parseInt(section.units) || null,
            ge_categories:    section.geCategories ?? [],
            final_exam:       section.finalExam ?? null,
            restrictions:     section.restrictions ?? null,
            prerequisite_link: course.prerequisiteLink ?? null,
            section_comment:  section.sectionComment ?? null,
          });
        }
      }
    }
  }
  return rows;
}

async function upsertRows(rows) {
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from('sections').upsert(rows.slice(i, i + CHUNK), { onConflict: 'id' });
    if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
  }
}

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

async function seedQuarter(year, quarter, departments) {
  console.log(`\n── ${quarter} ${year} ${'─'.repeat(30)}`);
  let sections = 0, errors = 0;
  await runConcurrent(departments, async (dept) => {
    try {
      await sleep(REQUEST_DELAY);
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
  console.log('Fetching department list…');
  const departments = await fetchDepartments();
  console.log(`Found ${departments.length} departments.`);

  const quarters = SINGLE_SESSION && SINGLE_YEAR
    ? [{ year: SINGLE_YEAR, quarter: SINGLE_SESSION }]
    : BULK_QUARTERS;

  console.log(`Seeding ${quarters.length} summer session(s)…`);
  let totalSections = 0, totalErrors = 0;

  for (const { year, quarter } of quarters) {
    const { sections, errors } = await seedQuarter(year, quarter, departments);
    totalSections += sections;
    totalErrors   += errors;
  }

  console.log('\n═════════════════════════════════════════');
  console.log(`Done! ${totalSections.toLocaleString()} total sections across ${quarters.length} session(s).`);
  if (totalErrors > 0) console.log(`     ${totalErrors} departments failed — re-run to retry.`);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });

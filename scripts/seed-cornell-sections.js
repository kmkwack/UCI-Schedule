// ─────────────────────────────────────────────────────────────────────────────
// Cornell Section Seeder
// Fetches Cornell University course sections from the official Class Roster API
// and upserts them into the shared Supabase `sections` table.
//
// HOW TO RUN:
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed-cornell-sections.js Fall 2026
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed-cornell-sections.js Fall 2026 CS,MATH
//   DRY_RUN=1 node scripts/seed-cornell-sections.js Fall 2026 CS
//
// BEFORE RUNNING:
//   1. Run supabase/sql/sections_school.sql in Supabase.
//   2. Supabase project → Settings → API → copy Project URL + service_role key.
// ─────────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DRY_RUN = process.env.DRY_RUN === '1';

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variable.');
}

const supabase = DRY_RUN ? null : createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CORNELL_API = 'https://classes.cornell.edu/api/2.0';
const SCHOOL = 'Cornell University';
const CONCURRENCY = 1;
const REQUEST_DELAY_MS = 1100; // Cornell asks API clients to stay at or below 1 request/sec.
const FETCH_RETRIES = Math.max(0, Math.floor(numberEnv('CORNELL_FETCH_RETRIES', 3)));
const RETRY_DELAY_MS = numberEnv('CORNELL_RETRY_DELAY_MS', 3000);

const TERM = process.argv[2] ?? 'Fall';
const YEAR = process.argv[3] ?? '2026';
const SUBJECT_ARG = process.argv[4] ?? null;

const TERM_TO_ROSTER_PREFIX = {
  Fall: 'FA',
  Winter: 'WI',
  Spring: 'SP',
  Summer: 'SU',
  Summer1: 'SU',
  Summer10wk: 'SU',
  Summer2: 'SU',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function numberEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function quarterKey(year, term) {
  return `${year}-${term}`;
}

function rosterCode(year, term) {
  const prefix = TERM_TO_ROSTER_PREFIX[term];
  if (!prefix) {
    throw new Error(`Unsupported Cornell term "${term}". Use one of: ${Object.keys(TERM_TO_ROSTER_PREFIX).join(', ')}`);
  }
  return `${prefix}${String(year).slice(-2)}`;
}

function createHttpError(status, url) {
  const error = new Error(`HTTP ${status} for ${url}`);
  error.status = status;
  error.url = url;
  return error;
}

async function fetchJson(path, params = {}, retries = FETCH_RETRIES) {
  const url = new URL(`${CORNELL_API}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });

  let res;
  try {
    res = await fetch(url.toString());
  } catch (error) {
    if (retries > 0) {
      await sleep(RETRY_DELAY_MS);
      return fetchJson(path, params, retries - 1);
    }
    throw error;
  }

  if ((res.status === 429 || res.status >= 500) && retries > 0) {
    await sleep(RETRY_DELAY_MS);
    return fetchJson(path, params, retries - 1);
  }
  if (!res.ok) throw createHttpError(res.status, url.toString());
  const json = await res.json();
  if (json.status !== 'success') throw new Error(`Cornell API returned status ${json.status ?? 'unknown'} for ${url}`);
  return json.data;
}

async function fetchSubjects(roster) {
  const data = await fetchJson('/config/subjects.json', { roster });
  const subjects = data.subjects ?? data;
  if (!Array.isArray(subjects)) throw new Error('Unexpected Cornell subjects response');
  return uniqueByValue(subjects.map((subject) => subject.value).filter(Boolean));
}

function uniqueByValue(values) {
  return [...new Set(values)];
}

function normalizeTime(value) {
  if (!value) return null;
  const raw = String(value).trim().toUpperCase();
  const match = raw.match(/^(\d{1,2}):(\d{2})(AM|PM)$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3];
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function normalizeDays(pattern) {
  if (!pattern) return 'TBA';
  const value = String(pattern).trim();
  if (value === 'TBA') return 'TBA';
  const result = [];

  for (let i = 0; i < value.length; i++) {
    const one = value[i];
    if (one === 'M') result.push('M');
    if (one === 'T') result.push('T');
    if (one === 'W') result.push('W');
    if (one === 'R') result.push('Th');
    if (one === 'F') result.push('F');
    if (one === 'S' && value[i + 1] === 'A') {
      result.push('Sa');
      i += 1;
    }
    if (one === 'S' && value[i + 1] === 'U') {
      result.push('Su');
      i += 1;
    }
  }

  return result.join('') || 'TBA';
}

function sectionTypeLabel(section) {
  const component = section.ssrComponentLong || section.ssrComponent || 'Section';
  const shortType = component === 'Lecture'
    ? 'Lec'
    : component === 'Discussion'
      ? 'Dis'
      : component === 'Laboratory'
        ? 'Lab'
        : component;
  return [shortType, section.section].filter(Boolean).join(' ');
}

function instructorNames(meeting, section) {
  const instructors = meeting?.instructors?.length ? meeting.instructors : section.instructors;
  return (instructors ?? [])
    .map((instructor) => instructor.name || [instructor.firstName, instructor.lastName].filter(Boolean).join(' '))
    .filter(Boolean);
}

function locationFor(meeting, section) {
  const facility = meeting?.facilityDescr || meeting?.facilityDescrshort;
  return facility || section.locationDescr || section.campusDescr || null;
}

function buildRows(classes, subject, qKey) {
  const rows = [];
  const syncedAt = new Date().toISOString();

  for (const course of classes) {
    const code = `${course.subject} ${course.catalogNbr}`.trim();
    const geCategories = [
      ...(course.crseAttrValueGroups ?? []).map((item) => item.crseAttrValues).filter(Boolean),
      ...(course.crseAttrs ?? []).map((item) => item.crseAttrValue).filter(Boolean),
    ];

    for (const enrollGroup of course.enrollGroups ?? []) {
      for (const section of enrollGroup.classSections ?? []) {
        const meeting = (section.meetings ?? []).find((item) => item.timeStart && item.timeEnd)
          ?? section.meetings?.[0]
          ?? null;
        const start = normalizeTime(meeting?.timeStart);
        const end = normalizeTime(meeting?.timeEnd);
        const instructors = instructorNames(meeting, section);

        rows.push({
          id: `cornell:${section.classNbr}::${qKey}`,
          school: SCHOOL,
          source: 'cornell-class-roster',
          source_id: String(section.classNbr),
          source_term_code: rosterCode(YEAR, TERM),
          campus: section.campusDescr || section.locationDescr || null,
          status: section.openStatus ?? null,
          last_synced_at: syncedAt,
          quarter_key: qKey,
          department: course.subject ?? subject,
          dept_name: null,
          code,
          title: course.titleLong || course.titleShort || '',
          section_label: sectionTypeLabel(section),
          professor: instructors[0] ?? '',
          instructors,
          days: normalizeDays(meeting?.pattern),
          time: start && end ? `${start} - ${end}` : 'TBA',
          location: locationFor(meeting, section),
          meetings: section.meetings ?? [],
          units: Number(enrollGroup.unitsMaximum ?? enrollGroup.unitsMinimum) || null,
          ge_categories: geCategories,
          final_exam: section.finalExam ?? null,
          restrictions: course.catalogEnrollmentPriority || course.catalogPermission || null,
          prerequisite_link: null,
          section_comment: course.description || course.catalogPrereq || course.catalogPrereqCoreq || null,
        });
      }
    }
  }

  return rows;
}

async function upsertRows(rows) {
  const dedupedRows = dedupeRowsById(rows);
  if (DRY_RUN) {
    dedupedRows.slice(0, 3).forEach((row) => console.log(`    sample ${row.id} ${row.code} ${row.section_label} ${row.days} ${row.time}`));
    return;
  }

  const CHUNK = 500;
  for (let i = 0; i < dedupedRows.length; i += CHUNK) {
    const chunk = dedupedRows.slice(i, i + CHUNK);
    const { error } = await supabase.from('sections').upsert(chunk, { onConflict: 'id' });
    if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
  }
}

function dedupeRowsById(rows) {
  const byId = new Map();
  rows.forEach((row) => {
    if (!row?.id) return;
    byId.set(row.id, row);
  });
  return [...byId.values()];
}

async function upsertSeedMetadata(subjects, roster, qKey, total, errors, updateTermMetadata = true) {
  if (DRY_RUN) return;

  const now = new Date().toISOString();
  const uniqueSubjects = uniqueByValue(subjects);
  if (updateTermMetadata) {
    const { error: termError } = await supabase.from('school_terms').upsert({
      school: SCHOOL,
      quarter_key: qKey,
      source: 'cornell-class-roster',
      source_term_code: roster,
      status: errors > 0 ? 'partial' : 'seeded',
      section_count: total,
      department_count: uniqueSubjects.length,
      error_count: errors,
      last_seeded_at: now,
    }, { onConflict: 'school,quarter_key' });
    if (termError) console.error(`  ✗ school_terms upsert failed: ${termError.message}`);
  }

  const departmentRows = uniqueSubjects.map((subject) => ({
    school: SCHOOL,
    department: subject,
    dept_name: null,
    source: 'cornell-class-roster',
    active: true,
    last_seen_at: now,
  }));
  const { error: departmentsError } = await supabase
    .from('school_departments')
    .upsert(departmentRows, { onConflict: 'school,department' });
  if (departmentsError) console.error(`  ✗ school_departments upsert failed: ${departmentsError.message}`);
}

async function runConcurrent(items, worker, concurrency) {
  const queue = [...items];
  const active = new Set();

  function runNext() {
    if (queue.length === 0) return;
    const item = queue.shift();
    const task = worker(item).finally(() => {
      active.delete(task);
      runNext();
    });
    active.add(task);
  }

  for (let i = 0; i < concurrency; i++) runNext();
  while (active.size > 0) await sleep(50);
}

async function seedSubject(subject, roster, qKey) {
  await sleep(REQUEST_DELAY_MS);
  let data;
  try {
    data = await fetchJson('/search/classes.json', { roster, subject });
  } catch (error) {
    if (error?.status === 404) {
      console.warn(`    skipping ${subject}: subject not available for ${roster}`);
      return 0;
    }
    throw error;
  }
  const classes = data.classes ?? [];
  const rows = buildRows(classes, subject, qKey);
  const dedupedRows = dedupeRowsById(rows);
  await upsertRows(dedupedRows);
  return dedupedRows.length;
}

async function main() {
  const roster = rosterCode(YEAR, TERM);
  const qKey = quarterKey(YEAR, TERM);
  const subjects = SUBJECT_ARG
    ? uniqueByValue(SUBJECT_ARG.split(',').map((subject) => subject.trim().toUpperCase()).filter(Boolean))
    : await fetchSubjects(roster);

  console.log(`Seeding ${SCHOOL} ${TERM} ${YEAR} (${roster})`);
  console.log(`Subjects: ${subjects.length}`);

  let total = 0;
  let errors = 0;

  await runConcurrent(subjects, async (subject) => {
    try {
      const count = await seedSubject(subject, roster, qKey);
      total += count;
      if (count > 0) console.log(`  ✓ ${subject.padEnd(8)} ${count} sections`);
    } catch (error) {
      errors += 1;
      console.error(`  ✗ ${subject.padEnd(8)} ${error.message}`);
    }
  }, CONCURRENCY);

  await upsertSeedMetadata(subjects, roster, qKey, total, errors, !SUBJECT_ARG);

  console.log(`\nDone. ${total.toLocaleString()} sections, ${errors} subject errors.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

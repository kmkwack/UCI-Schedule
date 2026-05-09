// ─────────────────────────────────────────────────────────────────────────────
// Purdue Section Seeder
// Fetches Purdue University sections from Purdue.io OData and upserts them into
// the shared Supabase `sections` table.
//
// HOW TO RUN:
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed-purdue-sections.js Fall 2026
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed-purdue-sections.js Fall 2026 CS,MA
//   DRY_RUN=1 node scripts/seed-purdue-sections.js Fall 2026 CS
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

const PURDUE_API = 'https://api.purdue.io/odata';
const SCHOOL = 'Purdue University';
const CONCURRENCY = 2;
const REQUEST_DELAY_MS = 250;
const CAMPUS_CODE = process.env.PURDUE_CAMPUS_CODE || 'PWL';

const TERM = process.argv[2] ?? 'Fall';
const YEAR = process.argv[3] ?? '2026';
const SUBJECT_ARG = process.argv[4] ?? null;

const TERM_TO_CODE_SUFFIX = {
  Fall: '10',
  Spring: '20',
  Summer: '30',
  Summer1: '30',
  Summer10wk: '30',
  Summer2: '30',
};

const TERM_TO_YEAR_OFFSET = {
  Fall: 1,
  Spring: 0,
  Summer: 0,
  Summer1: 0,
  Summer10wk: 0,
  Summer2: 0,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function quarterKey(year, term) {
  return `${year}-${term}`;
}

function termCode(year, term) {
  const suffix = TERM_TO_CODE_SUFFIX[term];
  if (!suffix) {
    throw new Error(`Unsupported Purdue term "${term}". Use one of: ${Object.keys(TERM_TO_CODE_SUFFIX).join(', ')}`);
  }
  return `${Number(year) + TERM_TO_YEAR_OFFSET[term]}${suffix}`;
}

async function fetchJson(path, params = {}, retries = 3) {
  const url = new URL(`${PURDUE_API}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if ((res.status === 429 || res.status >= 500) && retries > 0) {
    await sleep(3000);
    return fetchJson(path, params, retries - 1);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} for ${url}: ${body.slice(0, 240)}`);
  }
  const json = await res.json();
  if (!Array.isArray(json.value)) throw new Error(`Unexpected Purdue response for ${url}`);
  return json.value;
}

async function fetchSubjects() {
  const subjects = await fetchJson('/Subjects');
  return subjects
    .map((subject) => subject.Abbreviation)
    .filter(Boolean)
    .sort();
}

function sectionTypeLabel(type, crn) {
  const shortType = type === 'Lecture'
    ? 'Lec'
    : type === 'Laboratory'
      ? 'Lab'
      : type === 'Recitation'
        ? 'Rec'
        : type === 'Distance Learning'
          ? 'Online'
          : type || 'Section';
  return [shortType, crn].filter(Boolean).join(' ');
}

function normalizeDays(daysOfWeek) {
  const value = String(daysOfWeek ?? '').trim();
  if (!value) return 'TBA';
  return value
    .split(',')
    .map((day) => day.trim())
    .map((day) => ({
      Monday: 'M',
      Tuesday: 'T',
      Wednesday: 'W',
      Thursday: 'Th',
      Friday: 'F',
      Saturday: 'Sa',
      Sunday: 'Su',
    }[day] ?? day))
    .join('');
}

function parseDurationMinutes(duration) {
  const match = String(duration ?? '').match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/);
  if (!match) return null;
  return (Number(match[1] ?? 0) * 60) + Number(match[2] ?? 0);
}

function normalizeStartTime(startTime) {
  const match = String(startTime ?? '').match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  return `${match[1]}:${match[2]}`;
}

function addMinutes(time, minutes) {
  const [hour, minute] = time.split(':').map(Number);
  const total = hour * 60 + minute + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function normalizeMeetingTime(meeting) {
  const start = normalizeStartTime(meeting?.StartTime);
  const minutes = parseDurationMinutes(meeting?.Duration);
  if (!start || !minutes) return 'TBA';
  return `${start} - ${addMinutes(start, minutes)}`;
}

function instructorNames(meeting) {
  return (meeting?.Instructors ?? [])
    .map((instructor) => instructor.Name || [instructor.FirstName, instructor.LastName].filter(Boolean).join(' '))
    .filter(Boolean);
}

function locationFor(meeting) {
  const building = meeting?.Room?.Building?.ShortCode || meeting?.Room?.Building?.Name;
  const room = meeting?.Room?.Number;
  return [building, room].filter(Boolean).join(' ') || null;
}

function buildRows(sections, subject, qKey) {
  const syncedAt = new Date().toISOString();

  return sections.map((section) => {
    const course = section.Class?.Course ?? {};
    const subjectInfo = course.Subject ?? {};
    const meeting = (section.Meetings ?? []).find((item) => item.StartTime && item.Duration)
      ?? section.Meetings?.[0]
      ?? null;
    const instructors = instructorNames(meeting);
    const department = subjectInfo.Abbreviation ?? subject;
    const number = String(course.Number ?? '').trim();

    return {
      id: `purdue:${section.Crn || section.Id}::${qKey}`,
      school: SCHOOL,
      source: 'purdue.io',
      source_id: section.Crn || section.Id,
      source_term_code: termCode(YEAR, TERM),
      campus: section.Class?.Campus?.Code || section.Class?.Campus?.Name || CAMPUS_CODE,
      status: null,
      enrolled: numberOrNull(section.Enrolled ?? section.Enrollment ?? section.CurrentEnrollment),
      capacity: numberOrNull(section.Capacity ?? section.MaxEnrollment ?? section.Seats),
      waitlist: numberOrNull(section.Waitlist ?? section.WaitlistCount),
      waitlist_capacity: numberOrNull(section.WaitlistCapacity ?? section.WaitlistCap),
      last_synced_at: syncedAt,
      quarter_key: qKey,
      department,
      dept_name: subjectInfo.Name ?? null,
      code: `${department} ${number}`.trim(),
      title: course.Title ?? '',
      section_label: sectionTypeLabel(section.Type, section.Crn),
      professor: instructors[0] ?? '',
      instructors,
      days: normalizeDays(meeting?.DaysOfWeek),
      time: normalizeMeetingTime(meeting),
      location: locationFor(meeting),
      meetings: section.Meetings ?? [],
      units: Number(course.CreditHours) || null,
      ge_categories: [],
      final_exam: null,
      restrictions: null,
      prerequisite_link: null,
      section_comment: course.Description || null,
    };
  });
}

async function upsertRows(rows) {
  if (DRY_RUN) {
    rows.slice(0, 3).forEach((row) => console.log(`    sample ${row.id} ${row.code} ${row.section_label} ${row.days} ${row.time}`));
    return;
  }

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from('sections').upsert(chunk, { onConflict: 'id' });
    if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
  }
}

async function upsertSeedMetadata(subjects, purdueTermCode, qKey, total, errors, updateTermMetadata = true) {
  if (DRY_RUN) return;

  const now = new Date().toISOString();
  const uniqueSubjects = uniqueValues(subjects);
  if (updateTermMetadata) {
    const { error: termError } = await supabase.from('school_terms').upsert({
      school: SCHOOL,
      quarter_key: qKey,
      source: 'purdue.io',
      source_term_code: purdueTermCode,
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
    source: 'purdue.io',
    active: true,
    last_seen_at: now,
  }));
  const { error: departmentsError } = await supabase
    .from('school_departments')
    .upsert(departmentRows, { onConflict: 'school,department' });
  if (departmentsError) console.error(`  ✗ school_departments upsert failed: ${departmentsError.message}`);
}

function uniqueValues(values) {
  return [...new Set(values)];
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

async function seedSubject(subject, purdueTermCode, qKey) {
  await sleep(REQUEST_DELAY_MS);
  const filter = [
    `Class/Course/Subject/Abbreviation eq '${subject.replace(/'/g, "''")}'`,
    `Class/Term/Code eq '${purdueTermCode}'`,
    `Class/Campus/Code eq '${CAMPUS_CODE}'`,
  ].join(' and ');
  const sections = await fetchJson('/Sections', {
    '$filter': filter,
    '$expand': 'Class($expand=Course($expand=Subject),Term,Campus),Meetings($expand=Instructors,Room($expand=Building))',
  });
  const rows = buildRows(sections, subject, qKey);
  await upsertRows(rows);
  return rows.length;
}

async function main() {
  const purdueTermCode = termCode(YEAR, TERM);
  const qKey = quarterKey(YEAR, TERM);
  const subjects = SUBJECT_ARG
    ? uniqueValues(SUBJECT_ARG.split(',').map((subject) => subject.trim().toUpperCase()).filter(Boolean))
    : await fetchSubjects();

  console.log(`Seeding ${SCHOOL} ${TERM} ${YEAR} (${purdueTermCode}, campus ${CAMPUS_CODE})`);
  console.log(`Subjects: ${subjects.length}`);

  let total = 0;
  let errors = 0;

  await runConcurrent(subjects, async (subject) => {
    try {
      const count = await seedSubject(subject, purdueTermCode, qKey);
      total += count;
      if (count > 0) console.log(`  ✓ ${subject.padEnd(8)} ${count} sections`);
    } catch (error) {
      errors += 1;
      console.error(`  ✗ ${subject.padEnd(8)} ${error.message}`);
    }
  }, CONCURRENCY);

  await upsertSeedMetadata(subjects, purdueTermCode, qKey, total, errors, !SUBJECT_ARG);

  console.log(`\nDone. ${total.toLocaleString()} sections, ${errors} subject errors.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

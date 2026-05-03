// ─────────────────────────────────────────────────────────────────────────────
// UMD Section Seeder
// Fetches University of Maryland, College Park course sections from umd.io and
// upserts them into the shared Supabase `sections` table.
//
// HOW TO RUN:
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed-umd-sections.js Fall 2026
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed-umd-sections.js Fall 2026 CMSC,MATH
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

const UMD_API = 'https://api.umd.io/v0';
const SCHOOL = 'University of Maryland, College Park';
const PER_PAGE = 100;
const CONCURRENCY = 4;
const REQUEST_DELAY_MS = 120;

const TERM_TO_MONTH = {
  Spring: '01',
  Summer: '05',
  Summer1: '05',
  Summer10wk: '05',
  Summer2: '07',
  Fall: '08',
};

const TERM = process.argv[2] ?? 'Fall';
const YEAR = process.argv[3] ?? '2026';
const DEPT_ARG = process.argv[4] ?? null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function quarterKey(year, term) {
  return `${year}-${term}`;
}

function semesterCode(year, term) {
  if (term === 'Winter') return `${Number(year) - 1}12`;
  const month = TERM_TO_MONTH[term];
  if (!month) {
    throw new Error(`Unsupported UMD term "${term}". Use one of: Winter, ${Object.keys(TERM_TO_MONTH).join(', ')}`);
  }
  return `${year}${month}`;
}

function parseLinkHeader(linkHeader) {
  if (!linkHeader) return {};
  return Object.fromEntries(
    linkHeader.split(',').map((part) => {
      const match = part.match(/<([^>]+)>;\s*rel="?([^"]+)"?/);
      return match ? [match[2], match[1]] : null;
    }).filter(Boolean)
  );
}

async function fetchJson(url, retries = 3) {
  const res = await fetch(url);
  if (res.status === 429 && retries > 0) {
    await sleep(1500);
    return fetchJson(url, retries - 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const json = await res.json();
  return { json, links: parseLinkHeader(res.headers.get('link')) };
}

async function fetchAllPages(path, params = {}) {
  const rows = [];
  let page = 1;

  while (true) {
    const url = new URL(`${UMD_API}${path}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    });
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(PER_PAGE));

    await sleep(REQUEST_DELAY_MS);
    const { json, links } = await fetchJson(url.toString());
    if (!Array.isArray(json)) throw new Error(`Unexpected response for ${url}`);
    rows.push(...json);
    if (!links.next || json.length === 0) break;
    page += 1;
  }

  return rows;
}

async function fetchDepartments() {
  const url = `${UMD_API}/courses/departments`;
  const { json } = await fetchJson(url);
  if (!Array.isArray(json)) throw new Error('Unexpected departments response from umd.io');
  return json
    .map((department) => (
      typeof department === 'string'
        ? department
        : department?.dept_id
    ))
    .filter(Boolean);
}

function splitCourseCode(courseId) {
  const match = String(courseId ?? '').match(/^([A-Z]+)(.+)$/);
  if (!match) return { department: '', number: String(courseId ?? '') };
  return { department: match[1], number: match[2] };
}

function normalizeTime(value) {
  if (!value) return null;
  const raw = String(value).trim().toLowerCase().replace(/\s+/g, '');
  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? '0');
  const meridiem = match[3];
  if (meridiem === 'pm' && hour !== 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function normalizeMeeting(meeting) {
  const start = normalizeTime(meeting?.start_time);
  const end = normalizeTime(meeting?.end_time);
  const building = String(meeting?.building ?? '').trim();
  const room = String(meeting?.room ?? '').trim();
  return {
    days: meeting?.days || 'TBA',
    time: start && end ? `${start} - ${end}` : 'TBA',
    location: [building, room].filter(Boolean).join(' ') || null,
    classtype: meeting?.classtype ?? null,
  };
}

function sectionLabel(section, meeting) {
  const sectionNum = String(section.section_id ?? '').split('-')[1] ?? '';
  const classType = meeting?.classtype || 'Section';
  const shortType = classType === 'Lecture'
    ? 'Lec'
    : classType === 'Discussion'
      ? 'Dis'
      : classType === 'Lab'
        ? 'Lab'
        : classType;
  return [shortType, sectionNum].filter(Boolean).join(' ');
}

function courseCodeFor(courseId) {
  const { department, number } = splitCourseCode(courseId);
  return `${department} ${number}`.trim();
}

function buildRows(courses, sections, qKey) {
  const coursesById = Object.fromEntries(courses.map((course) => [course.course_id, course]));
  const syncedAt = new Date().toISOString();

  return sections.map((section) => {
    const courseId = section.course_id || String(section.section_id ?? '').split('-')[0];
    const course = coursesById[courseId] ?? {};
    const { department } = splitCourseCode(courseId);
    const meeting = (section.meetings ?? []).find((item) => item?.days && item?.start_time && item?.end_time)
      ?? section.meetings?.[0]
      ?? null;
    const normalizedMeeting = normalizeMeeting(meeting);

    return {
      id: `${section.section_id}::${qKey}`,
      school: SCHOOL,
      source: 'umd.io',
      source_id: section.section_id,
      source_term_code: semesterCode(YEAR, TERM),
      campus: 'College Park',
      status: null,
      last_synced_at: syncedAt,
      quarter_key: qKey,
      department: course.dept_id ?? department,
      dept_name: course.department ?? null,
      code: courseCodeFor(courseId),
      title: course.name ?? '',
      section_label: sectionLabel(section, meeting),
      professor: section.instructors?.[0] ?? '',
      instructors: section.instructors ?? [],
      days: normalizedMeeting.days,
      time: normalizedMeeting.time,
      location: normalizedMeeting.location,
      meetings: section.meetings ?? [],
      units: Number(course.credits) || null,
      ge_categories: course.gen_ed ?? course.core ?? [],
      final_exam: null,
      restrictions: [
        ...(course.relationships?.restrictions ?? []),
        ...(course.relationships?.restricted_to ?? []),
      ].filter(Boolean).join('\n') || null,
      prerequisite_link: null,
      section_comment: course.description ?? null,
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

async function upsertSeedMetadata(departments, qKey, semester, total, errors) {
  if (DRY_RUN) return;

  const now = new Date().toISOString();
  const { error: termError } = await supabase.from('school_terms').upsert({
    school: SCHOOL,
    quarter_key: qKey,
    source: 'umd.io',
    source_term_code: semester,
    status: errors > 0 ? 'partial' : 'seeded',
    section_count: total,
    department_count: departments.length,
    error_count: errors,
    last_seeded_at: now,
  }, { onConflict: 'school,quarter_key' });
  if (termError) console.error(`  ✗ school_terms upsert failed: ${termError.message}`);

  const departmentRows = departments.map((department) => ({
    school: SCHOOL,
    department,
    dept_name: null,
    source: 'umd.io',
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

async function seedDepartment(department, semester, qKey) {
  const courses = await fetchAllPages('/courses', { dept_id: department, semester });
  if (courses.length === 0) return 0;

  const sectionIds = [...new Set(courses.flatMap((course) => course.sections ?? []))];
  if (sectionIds.length === 0) return 0;

  const sectionBatches = [];
  for (let i = 0; i < sectionIds.length; i += 80) {
    sectionBatches.push(sectionIds.slice(i, i + 80));
  }

  const sections = [];
  for (const batch of sectionBatches) {
    await sleep(REQUEST_DELAY_MS);
    const { json } = await fetchJson(`${UMD_API}/courses/sections/${batch.join(',')}`);
    if (Array.isArray(json)) sections.push(...json);
    else if (json) sections.push(json);
  }

  const rows = buildRows(courses, sections, qKey);
  await upsertRows(rows);
  return rows.length;
}

async function main() {
  const semester = semesterCode(YEAR, TERM);
  const qKey = quarterKey(YEAR, TERM);
  const departments = DEPT_ARG
    ? DEPT_ARG.split(',').map((dept) => dept.trim().toUpperCase()).filter(Boolean)
    : await fetchDepartments();

  console.log(`Seeding ${SCHOOL} ${TERM} ${YEAR} (${semester})`);
  console.log(`Departments: ${departments.length}`);

  let total = 0;
  let errors = 0;

  await runConcurrent(departments, async (department) => {
    try {
      const count = await seedDepartment(department, semester, qKey);
      total += count;
      if (count > 0) console.log(`  ✓ ${department.padEnd(8)} ${count} sections`);
    } catch (error) {
      errors += 1;
      console.error(`  ✗ ${department.padEnd(8)} ${error.message}`);
    }
  }, CONCURRENCY);

  await upsertSeedMetadata(departments, qKey, semester, total, errors);

  console.log(`\nDone. ${total.toLocaleString()} sections, ${errors} department errors.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

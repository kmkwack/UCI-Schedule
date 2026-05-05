// ─────────────────────────────────────────────────────────────────────────────
// UIUC Section Seeder
// Fetches University of Illinois Urbana-Champaign sections from Course Explorer
// and upserts them into the shared Supabase `sections` table.
//
// HOW TO RUN:
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed-uiuc-sections.js Fall 2026
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed-uiuc-sections.js Fall 2026 CS,MATH
//   UIUC_FETCH_RETRIES=1 UIUC_RETRY_DELAY_MS=5000 node scripts/seed-uiuc-sections.js Spring 2019 CS
//   DRY_RUN=1 node scripts/seed-uiuc-sections.js Fall 2026 CS
//   node scripts/retry-uiuc-failed-subjects.js # retries known failed UIUC subjects
// ─────────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DRY_RUN = process.env.DRY_RUN === '1';

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variable.');
}

const supabase = DRY_RUN ? null : createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const UIUC_BASE = 'https://courses.illinois.edu';
const SCHOOL = 'University of Illinois Urbana-Champaign';
const CONCURRENCY = Math.max(1, Math.floor(numberEnv('UIUC_CONCURRENCY', 1)));
const REQUEST_DELAY_MS = numberEnv('UIUC_REQUEST_DELAY_MS', 900);
const FETCH_RETRIES = Math.max(0, Math.floor(numberEnv('UIUC_FETCH_RETRIES', 0)));
const RETRY_DELAY_MS = numberEnv('UIUC_RETRY_DELAY_MS', 30000);
const TRANSIENT_RETRY_DELAY_MS = numberEnv('UIUC_TRANSIENT_RETRY_DELAY_MS', 5000);
const FETCH_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
};

const TERM = process.argv[2] ?? 'Fall';
const YEAR = process.argv[3] ?? '2026';
const SUBJECT_ARG = process.argv[4] ?? null;

const TERM_TO_PATH = {
  Spring: 'spring',
  Summer: 'summer',
  Fall: 'fall',
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

function termPath(term) {
  const path = TERM_TO_PATH[term];
  if (!path) {
    throw new Error(`Unsupported UIUC term "${term}". Use one of: ${Object.keys(TERM_TO_PATH).join(', ')}`);
  }
  return path;
}

function htmlDecode(value) {
  return String(value ?? '')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHiddenHtml(value) {
  return String(value ?? '').replace(/<span[^>]*class=["'][^"']*hide[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, '');
}

function stripHtml(value) {
  return htmlDecode(stripHiddenHtml(value).replace(/<br\s*\/?>/gi, '; ').replace(/<[^>]+>/g, ' '));
}

function appMeetingParts(value) {
  const html = stripHiddenHtml(value);
  const parts = [];
  const pattern = /<div[^>]*class=["'][^"']*app-meeting[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const text = stripHtml(match[1]);
    if (text) parts.push(text);
  }
  return parts.length > 0 ? parts : [stripHtml(html)].filter(Boolean);
}

async function fetchHtml(path, retries = FETCH_RETRIES) {
  await sleep(REQUEST_DELAY_MS);
  const url = `${UIUC_BASE}${path}`;
  let res;
  try {
    res = await fetch(url, { headers: FETCH_HEADERS });
  } catch (error) {
    if (retries > 0) {
      console.warn(`    waiting ${Math.round(TRANSIENT_RETRY_DELAY_MS / 1000)}s after fetch failed for ${url}`);
      await sleep(TRANSIENT_RETRY_DELAY_MS);
      return fetchHtml(path, retries - 1);
    }
    throw error;
  }

  if ((res.status === 403 || res.status === 429 || res.status >= 500) && retries > 0) {
    const waitMs = res.status === 403 ? RETRY_DELAY_MS : TRANSIENT_RETRY_DELAY_MS;
    console.warn(`    waiting ${Math.round(waitMs / 1000)}s after HTTP ${res.status} for ${url}`);
    await sleep(waitMs);
    return fetchHtml(path, retries - 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function fetchSubjects(year, termSlug) {
  const html = await fetchHtml(`/schedule/${year}/${termSlug}`);
  const subjects = [];
  const rowPattern = /<tr>\s*<td>\s*([A-Z0-9&]+)\s*<\/td>\s*<td>\s*<a href="\/schedule\/[^"]+\/([^"\/]+)">([\s\S]*?)<\/a>\s*<\/td>\s*<\/tr>/g;
  let match;
  while ((match = rowPattern.exec(html))) {
    const department = htmlDecode(match[1]);
    subjects.push({
      department,
      deptName: stripHtml(match[3]),
    });
  }
  return subjects.filter((subject) => subject.department);
}

async function fetchCourses(year, termSlug, subject) {
  const html = await fetchHtml(`/schedule/${year}/${termSlug}/${encodeURIComponent(subject)}`);
  const courses = [];
  const rowPattern = /<tr>\s*<td>\s*([A-Z0-9&]+)\s+([A-Z0-9]+)\s*<\/td>\s*<td>\s*<a href="\/schedule\/[^"]+\/([^"\/]+)">([\s\S]*?)<\/a>\s*<\/td>\s*<\/tr>/g;
  let match;
  while ((match = rowPattern.exec(html))) {
    courses.push({
      subject: htmlDecode(match[1]),
      number: htmlDecode(match[2]),
      title: stripHtml(match[4]),
    });
  }
  return courses;
}

function extractCourseCredit(html) {
  const match = html.match(/Credit:\s*([\s\S]*?)<\/p>/i) ?? html.match(/Credit:\s*([^<]+)/i);
  if (!match) return null;
  const text = stripHtml(match[1]);
  const number = text.match(/(\d+(?:\.\d+)?)/);
  return number ? Number(number[1]) : null;
}

function extractCourseDescription(html) {
  const match = html.match(/<p class="courseblockdesc">([\s\S]*?)<\/p>/i);
  return match ? stripHtml(match[1]) : null;
}

function parseSectionData(html) {
  const marker = html.match(/var\s+sectionDataObj\s*=/);
  if (!marker) return [];
  const arrayStart = html.indexOf('[', marker.index);
  if (arrayStart === -1) return [];

  let depth = 0;
  let quote = null;
  let escaped = false;
  let arrayEnd = -1;

  for (let i = arrayStart; i < html.length; i += 1) {
    const char = html[i];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '[') depth += 1;
    if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        arrayEnd = i + 1;
        break;
      }
    }
  }

  if (arrayEnd === -1) {
    throw new Error('Could not parse sectionDataObj: missing closing array bracket');
  }

  const json = html.slice(arrayStart, arrayEnd);
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new Error(`Could not parse sectionDataObj: ${error.message}`);
  }
}

function normalizeTime(value) {
  const text = stripHtml(value);
  if (!text || /arranged|n\.a\./i.test(text)) return 'TBA';
  const twelveHourMatch = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (twelveHourMatch) {
    const to24Hour = (hourValue, minuteValue, meridiem) => {
      let hour = Number(hourValue);
      const minute = Number(minuteValue);
      const marker = meridiem.toUpperCase();
      if (marker === 'PM' && hour !== 12) hour += 12;
      if (marker === 'AM' && hour === 12) hour = 0;
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    };
    return `${to24Hour(twelveHourMatch[1], twelveHourMatch[2], twelveHourMatch[3])} - ${to24Hour(twelveHourMatch[4], twelveHourMatch[5], twelveHourMatch[6])}`;
  }

  const match = text.match(/^(\d{1,2})(\d{2})\s*-\s*(\d{1,2})(\d{2})$/);
  if (!match) return text;
  return `${match[1].padStart(2, '0')}:${match[2]} - ${match[3].padStart(2, '0')}:${match[4]}`;
}

function normalizeDays(value) {
  const text = stripHtml(value).replace(/n\.a\./i, '').trim();
  if (!text) return 'TBA';
  const result = [];
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === 'M') result.push('M');
    if (char === 'T') result.push('T');
    if (char === 'W') result.push('W');
    if (char === 'R') result.push('Th');
    if (char === 'F') result.push('F');
    if (char === 'S') result.push('Sa');
    if (char === 'U') result.push('Su');
  }
  return result.join('') || 'TBA';
}

function shortType(type) {
  const text = stripHtml(type);
  return ({
    'Online Lecture': 'Online',
    Lecture: 'Lec',
    'Lecture-Discussion': 'Lec',
    Discussion: 'Dis',
    'Discussion/ Recitation': 'Dis',
    Laboratory: 'Lab',
    LabDiscussion: 'Lab',
    'Laboratory-Discussion': 'Lab',
    Recitation: 'Rec',
    'Independent Study': 'Study',
  }[text] ?? text);
}

async function fetchCourseSections(year, termSlug, subject, course, qKey) {
  const html = await fetchHtml(`/schedule/${year}/${termSlug}/${encodeURIComponent(subject)}/${encodeURIComponent(course.number)}`);
  const credit = extractCourseCredit(html);
  const description = extractCourseDescription(html);
  const sections = parseSectionData(html);
  const syncedAt = new Date().toISOString();

  return sections.map((section) => {
    const crn = stripHtml(section.crn);
    const typeParts = appMeetingParts(section.type);
    const sectionParts = appMeetingParts(section.section);
    const dayParts = appMeetingParts(section.day);
    const timeParts = appMeetingParts(section.time);
    const locationParts = appMeetingParts(section.location);
    const type = shortType(typeParts[0]);
    const sectionCode = sectionParts[0] ?? '';
    const instructors = appMeetingParts(section.instructor).join('; ')
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean);
    const meetings = Array.from({ length: Math.max(dayParts.length, timeParts.length, locationParts.length, 1) }).map((_, index) => ({
      days: normalizeDays(dayParts[index] ?? dayParts[0]),
      time: normalizeTime(timeParts[index] ?? timeParts[0]),
      location: stripHtml(locationParts[index] ?? locationParts[0]).replace(/^n\.a\.$/i, '') || null,
      dateRange: stripHtml(section.sectionDateRange) || null,
      partOfTerm: section.partOfTerm ?? null,
    }));
    const primaryMeeting = meetings.find((meeting) => meeting.time !== 'TBA') ?? meetings[0];

    return {
      id: `uiuc:${crn}::${qKey}`,
      school: SCHOOL,
      source: 'uiuc-course-explorer',
      source_id: crn,
      source_term_code: `${year}-${termSlug}`,
      campus: 'Urbana-Champaign',
      status: stripHtml(section.availability || section.status) || null,
      last_synced_at: syncedAt,
      quarter_key: qKey,
      department: subject,
      dept_name: null,
      code: `${subject} ${course.number}`,
      title: course.title,
      section_label: [type, sectionCode].filter(Boolean).join(' '),
      professor: instructors[0] ?? '',
      instructors,
      days: primaryMeeting.days,
      time: primaryMeeting.time,
      location: primaryMeeting.location,
      meetings,
      units: Number(section.credit) || credit,
      ge_categories: section.courseDegreeNotes ? [stripHtml(section.courseDegreeNotes)] : [],
      final_exam: null,
      restrictions: stripHtml(section.restricted || section.info || section.specialApproval) || null,
      prerequisite_link: null,
      section_comment: stripHtml(section.sectionDescription || section.sectionTitle || description) || null,
    };
  });
}

async function upsertRows(rows) {
  if (DRY_RUN) {
    rows.slice(0, 1).forEach((row) => console.log(`    sample ${row.id} ${row.code} ${row.section_label} ${row.days} ${row.time}`));
    return;
  }

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from('sections').upsert(chunk, { onConflict: 'id' });
    if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
  }
}

async function upsertSeedMetadata(subjects, termCode, qKey, total, errors, updateTermMetadata = true) {
  if (DRY_RUN) return;

  const now = new Date().toISOString();
  const uniqueSubjects = uniqueSubjectRows(subjects);
  if (updateTermMetadata) {
    const { error: termError } = await supabase.from('school_terms').upsert({
      school: SCHOOL,
      quarter_key: qKey,
      source: 'uiuc-course-explorer',
      source_term_code: termCode,
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
    department: subject.department,
    dept_name: subject.deptName,
    source: 'uiuc-course-explorer',
    active: true,
    last_seen_at: now,
  }));
  const { error: departmentsError } = await supabase
    .from('school_departments')
    .upsert(departmentRows, { onConflict: 'school,department' });
  if (departmentsError) console.error(`  ✗ school_departments upsert failed: ${departmentsError.message}`);
}

function uniqueSubjectRows(subjects) {
  const byDepartment = new Map();
  subjects.forEach((subject) => {
    if (subject?.department) byDepartment.set(subject.department, subject);
  });
  return [...byDepartment.values()];
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

async function seedSubject(subjectInfo, year, termSlug, qKey) {
  const courses = await fetchCourses(year, termSlug, subjectInfo.department);
  let count = 0;

  for (const course of courses) {
    const rows = await fetchCourseSections(year, termSlug, subjectInfo.department, course, qKey);
    await upsertRows(rows);
    count += rows.length;
  }

  return count;
}

async function main() {
  const termSlug = termPath(TERM);
  const qKey = quarterKey(YEAR, TERM);
  const termCode = `${YEAR}-${termSlug}`;
  const subjects = SUBJECT_ARG
    ? SUBJECT_ARG.split(',').map((subject) => ({ department: subject.trim().toUpperCase(), deptName: null })).filter((subject) => subject.department)
    : await fetchSubjects(YEAR, termSlug);

  console.log(`Seeding ${SCHOOL} ${TERM} ${YEAR} (${termCode})`);
  console.log(`Subjects: ${subjects.length}`);

  let total = 0;
  let errors = 0;

  await runConcurrent(subjects, async (subject) => {
    try {
      const count = await seedSubject(subject, YEAR, termSlug, qKey);
      total += count;
      if (count > 0) console.log(`  ✓ ${subject.department.padEnd(8)} ${count} sections`);
    } catch (error) {
      errors += 1;
      console.error(`  ✗ ${subject.department.padEnd(8)} ${error.message}`);
    }
  }, CONCURRENCY);

  await upsertSeedMetadata(subjects, termCode, qKey, total, errors, !SUBJECT_ARG);

  console.log(`\nDone. ${total.toLocaleString()} sections, ${errors} subject errors.`);
  if (errors > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

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
const { parseStringPromise, processors } = require('xml2js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === '1';

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY environment variable.');
}

const supabase = DRY_RUN ? null : createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const UIUC_CIS_BASE = 'https://courses.illinois.edu/cisapp/explorer';
const SCHOOL = 'University of Illinois Urbana-Champaign';
const CONCURRENCY = Math.max(1, Math.floor(numberEnv('UIUC_CONCURRENCY', 1)));
const REQUEST_DELAY_MS = numberEnv('UIUC_REQUEST_DELAY_MS', 900);
const FETCH_RETRIES = Math.max(0, Math.floor(numberEnv('UIUC_FETCH_RETRIES', 0)));
const RETRY_DELAY_MS = numberEnv('UIUC_RETRY_DELAY_MS', 30000);
const TRANSIENT_RETRY_DELAY_MS = numberEnv('UIUC_TRANSIENT_RETRY_DELAY_MS', 5000);
const FETCH_HEADERS = {
  Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
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

function toArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function xmlText(value) {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(xmlText).filter(Boolean).join('; ');
  if (typeof value === 'object') return xmlText(value._);
  return String(value).replace(/\s+/g, ' ').trim();
}

function xmlNumber(...values) {
  for (const value of values) {
    const text = xmlText(value);
    if (!text) continue;
    const match = text.match(/-?\d+/);
    if (match) return Number(match[0]);
  }
  return null;
}

function xmlAttr(node, name) {
  return xmlText(node?.$?.[name]);
}

async function fetchCisXml(path, params = {}, retries = FETCH_RETRIES) {
  await sleep(REQUEST_DELAY_MS);
  const query = new URLSearchParams(params).toString();
  const url = `${UIUC_CIS_BASE}${path}${query ? `?${query}` : ''}`;
  let res;
  try {
    res = await fetch(url, { headers: FETCH_HEADERS });
  } catch (error) {
    if (retries > 0) {
      console.warn(`    waiting ${Math.round(TRANSIENT_RETRY_DELAY_MS / 1000)}s after fetch failed for ${url}`);
      await sleep(TRANSIENT_RETRY_DELAY_MS);
      return fetchCisXml(path, params, retries - 1);
    }
    throw error;
  }

  if ((res.status === 403 || res.status === 429 || res.status >= 500) && retries > 0) {
    const waitMs = res.status === 403 ? RETRY_DELAY_MS : TRANSIENT_RETRY_DELAY_MS;
    console.warn(`    waiting ${Math.round(waitMs / 1000)}s after HTTP ${res.status} for ${url}`);
    await sleep(waitMs);
    return fetchCisXml(path, params, retries - 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const xml = await res.text();
  return parseStringPromise(xml, {
    explicitArray: false,
    attrkey: '$',
    charkey: '_',
    trim: true,
    tagNameProcessors: [processors.stripPrefix],
  });
}

async function fetchSubjects(year, termSlug) {
  const data = await fetchCisXml(`/schedule/${year}/${termSlug}.xml`, { mode: 'summary' });
  return toArray(data?.term?.subjects?.subject)
    .map((subject) => ({
      department: xmlAttr(subject, 'id'),
      deptName: xmlText(subject),
    }))
    .filter((subject) => subject.department);
}

async function fetchCourses(year, termSlug, subject) {
  const data = await fetchCisXml(`/schedule/${year}/${termSlug}/${encodeURIComponent(subject)}.xml`, { mode: 'summary' });
  return toArray(data?.subject?.courses?.course)
    .map((course) => ({
      subject,
      number: xmlAttr(course, 'id'),
      title: xmlText(course),
    }))
    .filter((course) => course.number);
}

function parseCreditValue(value) {
  const text = xmlText(value);
  const number = text.match(/(\d+(?:\.\d+)?)/);
  return number ? Number(number[1]) : null;
}

function genEdCategoriesFromCourse(courseNode) {
  const categories = [];
  toArray(courseNode?.genEdCategories?.category).forEach((category) => {
    const attributes = toArray(category?.genEdAttributes?.genEdAttribute)
      .map((attribute) => xmlText(attribute))
      .filter(Boolean);
    if (attributes.length > 0) {
      categories.push(...attributes);
      return;
    }
    const description = xmlText(category?.description);
    if (description) categories.push(description);
  });

  const degreeAttributes = xmlText(courseNode?.sectionDegreeAttributes);
  if (degreeAttributes) categories.push(degreeAttributes);
  return [...new Set(categories)];
}

function normalizeTime(value) {
  const text = xmlText(value);
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

function formatMeetingTime(start, end) {
  const startText = xmlText(start);
  const endText = xmlText(end);
  if (!startText || !endText) return 'TBA';
  return normalizeTime(`${startText} - ${endText}`);
}

function normalizeDays(value) {
  const text = xmlText(value).replace(/n\.a\.|arranged/gi, '').trim();
  if (!text || /^tba$/i.test(text)) return 'TBA';
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
  const text = xmlText(type);
  const code = xmlAttr(type, 'code');
  return ({
    LEC: 'Lec',
    LCD: 'Lec',
    DIS: 'Dis',
    LAB: 'Lab',
    LBD: 'Lab',
    ONL: 'Online',
    OLC: 'Online',
    REC: 'Rec',
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
  }[code] ?? {
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

function instructorsFromMeeting(meeting) {
  return toArray(meeting?.instructors?.instructor)
    .map((instructor) => xmlText(instructor))
    .filter(Boolean);
}

function formatMeetingLocation(meeting) {
  const building = xmlText(meeting?.buildingName);
  const room = xmlText(meeting?.roomNumber);
  if (!building && !room) return null;
  if (!building) return room;
  if (!room) return building;
  return `${building} ${room}`;
}

function sectionRestrictions(section) {
  return [
    xmlText(section?.sectionNotes),
    xmlText(section?.sectionCappArea),
  ].filter(Boolean).join(' ') || null;
}

function sectionComment(section, courseNode) {
  return [
    xmlText(section?.sectionText),
    xmlText(courseNode?.classScheduleInformation),
    xmlText(courseNode?.description),
  ].filter(Boolean).join(' ') || null;
}

async function fetchCourseSections(year, termSlug, subject, course, qKey) {
  const data = await fetchCisXml(
    `/schedule/${year}/${termSlug}/${encodeURIComponent(subject)}/${encodeURIComponent(course.number)}.xml`,
    { mode: 'detail' }
  );
  const courseNode = data?.course ?? {};
  const credit = parseCreditValue(courseNode.creditHours);
  const geCategories = genEdCategoriesFromCourse(courseNode);
  const sections = toArray(courseNode?.detailedSections?.detailedSection);
  const syncedAt = new Date().toISOString();

  return sections.map((section) => {
    const crn = xmlAttr(section, 'id');
    const sectionCode = xmlText(section.sectionNumber);
    const meetingNodes = toArray(section?.meetings?.meeting);
    const type = shortType(meetingNodes[0]?.type);
    const instructors = [...new Set(meetingNodes.flatMap(instructorsFromMeeting))];
    const dateRange = [xmlText(section.startDate), xmlText(section.endDate)].filter(Boolean).join(' - ') || null;
    const meetings = (meetingNodes.length > 0 ? meetingNodes : [{}]).map((meeting) => ({
      days: normalizeDays(meeting?.daysOfTheWeek),
      time: formatMeetingTime(meeting?.start, meeting?.end),
      location: formatMeetingLocation(meeting),
      dateRange,
      partOfTerm: xmlText(section.partOfTerm) || null,
    }));
    const primaryMeeting = meetings.find((meeting) => meeting.time !== 'TBA') ?? meetings[0];

    return {
      id: `uiuc:${crn}::${qKey}`,
      school: SCHOOL,
      source: 'uiuc-cis-api',
      source_id: crn,
      source_term_code: `${year}-${termSlug}`,
      campus: 'Urbana-Champaign',
      status: xmlText(section.enrollmentStatus) || xmlText(section.sectionStatusCode) || xmlText(section.statusCode) || null,
      enrolled: xmlNumber(section.enrolled, section.enrolledCount, section.enrollment, section.enrollmentCount),
      capacity: xmlNumber(section.capacity, section.sectionCapacity, section.maxEnrollment, section.maximumEnrollment),
      waitlist: xmlNumber(section.waitlist, section.waitList, section.waitlistCount, section.waitListCount),
      waitlist_capacity: xmlNumber(section.waitlistCapacity, section.waitListCapacity, section.maxWaitlist, section.maximumWaitlist),
      last_synced_at: syncedAt,
      quarter_key: qKey,
      department: subject,
      dept_name: null,
      code: `${subject} ${course.number}`,
      title: course.title || xmlText(courseNode.label),
      section_label: [type, sectionCode].filter(Boolean).join(' '),
      professor: instructors[0] ?? '',
      instructors,
      days: primaryMeeting.days,
      time: primaryMeeting.time,
      location: primaryMeeting.location,
      meetings,
      units: credit,
      ge_categories: geCategories,
      final_exam: null,
      restrictions: sectionRestrictions(section),
      prerequisite_link: null,
      section_comment: sectionComment(section, courseNode),
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
      source: 'uiuc-cis-api',
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
    source: 'uiuc-cis-api',
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

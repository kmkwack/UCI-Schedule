// ─────────────────────────────────────────────────────────────────────────────
// Banner / Ellucian Section Seeder
// Fetches public StudentRegistrationSsb class-search JSON and upserts rows into
// the shared Supabase `sections` table.
//
// HOW TO RUN:
//   DRY_RUN=1 node scripts/seed-banner-sections.js ucr Spring 2026 CS,MATH
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed-banner-sections.js temple Spring 2026 CIS
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed-banner-sections.js northeastern Fall 2026
// ─────────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === '1';

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variable.');
}

const supabase = DRY_RUN ? null : createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BANNER_SCHOOLS = {
  ucr: {
    school: 'UC Riverside',
    source: 'ucr-banner',
    baseUrl: 'https://registrationssb.ucr.edu',
    campus: 'Riverside campus',
  },
  northeastern: {
    school: 'Northeastern University',
    source: 'neu-banner',
    baseUrl: 'https://nubanner.neu.edu',
    campus: 'Boston campus',
    excludeTermDescriptions: ['cps quarter', 'cps semester', 'law quarter', 'law semester'],
  },
  temple: {
    school: 'Temple University',
    source: 'temple-banner',
    baseUrl: 'https://prd-xereg.temple.edu',
    campus: 'Main campus',
  },
  gsu: {
    school: 'Georgia State University',
    source: 'gsu-banner',
    baseUrl: 'https://registration.gosolar.gsu.edu',
    campus: 'Atlanta campus',
  },
};

const SCHOOL_KEY = String(process.argv[2] ?? '').toLowerCase();
const TERM = process.argv[3] ?? 'Spring';
const YEAR = process.argv[4] ?? '2026';
const SUBJECT_ARG = process.argv[5] ?? null;

const config = BANNER_SCHOOLS[SCHOOL_KEY];
if (!config) {
  throw new Error(`Unknown Banner school "${SCHOOL_KEY}". Use one of: ${Object.keys(BANNER_SCHOOLS).join(', ')}`);
}

const PAGE_SIZE = Math.max(50, Math.floor(numberEnv('BANNER_PAGE_SIZE', 500)));
const CONCURRENCY = Math.max(1, Math.floor(numberEnv('BANNER_CONCURRENCY', 1)));
const REQUEST_DELAY_MS = numberEnv('BANNER_REQUEST_DELAY_MS', 180);
const FETCH_RETRIES = Math.max(0, Math.floor(numberEnv('BANNER_FETCH_RETRIES', 3)));
const RETRY_DELAY_MS = numberEnv('BANNER_RETRY_DELAY_MS', 1200);

let cookieJar = new Map();

function numberEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function quarterKey(year, term) {
  return `${year}-${term}`;
}

function htmlDecode(value) {
  return String(value ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function updateCookies(headers) {
  const getSetCookie = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie.bind(headers)
    : null;
  const cookies = getSetCookie ? getSetCookie() : splitSetCookie(headers.get('set-cookie'));
  cookies.forEach((cookie) => {
    const [pair] = String(cookie).split(';');
    const index = pair.indexOf('=');
    if (index > 0) cookieJar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  });
}

function splitSetCookie(raw) {
  if (!raw) return [];
  return String(raw).split(/,(?=[^;,]+=)/);
}

function cookieHeader() {
  return Array.from(cookieJar.entries()).map(([key, value]) => `${key}=${value}`).join('; ');
}

function bannerUrl(path) {
  return `${config.baseUrl}/StudentRegistrationSsb/ssb${path}`;
}

async function fetchWithCookies(url, options = {}, retries = FETCH_RETRIES) {
  const headers = {
    Accept: 'application/json, text/plain, */*',
    'User-Agent': 'ClassMateSeeder/1.0',
    ...(options.headers ?? {}),
  };
  const cookie = cookieHeader();
  if (cookie) headers.Cookie = cookie;

  let res;
  try {
    res = await fetch(url, { ...options, headers, redirect: 'follow' });
  } catch (error) {
    if (retries > 0) {
      await sleep(RETRY_DELAY_MS);
      return fetchWithCookies(url, options, retries - 1);
    }
    throw error;
  }

  updateCookies(res.headers);
  if ((res.status === 429 || res.status >= 500) && retries > 0) {
    await sleep(res.status === 429 ? Math.max(RETRY_DELAY_MS, 2000) : RETRY_DELAY_MS);
    return fetchWithCookies(url, options, retries - 1);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} for ${url}: ${body.slice(0, 240)}`);
  }
  return res;
}

async function fetchJson(url, options = {}) {
  const res = await fetchWithCookies(url, options);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error(`Expected JSON for ${url}, got: ${text.slice(0, 240)}`);
  }
}

async function establishSession() {
  cookieJar = new Map();
  await fetchWithCookies(bannerUrl('/classSearch/classSearch'), {
    headers: { Accept: 'text/html,application/xhtml+xml' },
  });
}

async function fetchTerms() {
  const url = new URL(bannerUrl('/classSearch/getTerms'));
  url.searchParams.set('offset', '1');
  url.searchParams.set('max', '200');
  url.searchParams.set('searchTerm', String(YEAR));
  const terms = await fetchJson(url.toString());
  if (!Array.isArray(terms)) throw new Error(`Unexpected terms response for ${config.school}`);
  return terms;
}

function termMatches(description, term, year) {
  const text = String(description ?? '').toLowerCase();
  if (!text.includes(String(year))) return false;
  if ((config.excludeTermDescriptions ?? []).some((blocked) => text.includes(blocked))) return false;
  if (term === 'Summer1' || term === 'Summer2' || term === 'Summer10wk') return text.includes('summer');
  return text.includes(String(term).toLowerCase());
}

async function resolveTermCodes() {
  const terms = await fetchTerms();
  const matches = terms
    .filter((term) => termMatches(term.description, TERM, YEAR))
    .map((term) => ({ code: String(term.code), description: htmlDecode(term.description) }));

  if (matches.length === 0) {
    throw new Error(`No Banner term found for ${config.school} ${TERM} ${YEAR}. Got: ${terms.map((term) => term.description).join(', ')}`);
  }
  return matches;
}

async function selectTerm(termCode) {
  const body = new URLSearchParams({
    term: termCode,
    studyPath: '',
    studyPathText: '',
    startDatepicker: '',
    endDatepicker: '',
  });
  await fetchJson(bannerUrl('/term/search'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  }).catch(() => null);
}

async function fetchSubjects(termCode) {
  const url = new URL(bannerUrl('/classSearch/get_subject'));
  url.searchParams.set('searchTerm', '');
  url.searchParams.set('term', termCode);
  url.searchParams.set('offset', '1');
  url.searchParams.set('max', '500');
  const subjects = await fetchJson(url.toString());
  if (!Array.isArray(subjects)) throw new Error(`Unexpected subject response for ${termCode}`);
  return subjects
    .map((subject) => ({
      code: String(subject.code ?? '').trim(),
      description: htmlDecode(subject.description ?? '').trim(),
    }))
    .filter((subject) => subject.code);
}

async function fetchSubjectSections(termCode, subject) {
  const rows = [];
  let pageOffset = 0;
  let fetchedCount = 0;
  const requestedSubject = String(subject).trim().toUpperCase();

  while (true) {
    await sleep(REQUEST_DELAY_MS);
    const url = new URL(bannerUrl('/searchResults/searchResults'));
    url.searchParams.set('txt_subject', subject);
    url.searchParams.set('txt_courseNumber', '');
    url.searchParams.set('txt_term', termCode);
    url.searchParams.set('startDatepicker', '');
    url.searchParams.set('endDatepicker', '');
    url.searchParams.set('pageOffset', String(pageOffset));
    url.searchParams.set('pageMaxSize', String(PAGE_SIZE));
    url.searchParams.set('sortColumn', 'subjectDescription');
    url.searchParams.set('sortDirection', 'asc');

    const json = await fetchJson(url.toString());
    if (json.success !== true) throw new Error(`Banner search failed for ${subject} ${termCode}`);
    const data = Array.isArray(json.data) ? json.data : [];
    fetchedCount += data.length;
    rows.push(...data.filter((row) => String(row.subject ?? '').trim().toUpperCase() === requestedSubject));
    const total = Number(json.totalCount ?? fetchedCount);
    if (data.length === 0 || fetchedCount >= total) break;
    pageOffset += PAGE_SIZE;
  }

  return rows;
}

function dayLetters(meetingTime) {
  if (!meetingTime) return 'TBA';
  const days = [
    ['monday', 'M'],
    ['tuesday', 'T'],
    ['wednesday', 'W'],
    ['thursday', 'Th'],
    ['friday', 'F'],
    ['saturday', 'Sa'],
    ['sunday', 'Su'],
  ].filter(([key]) => meetingTime[key] === true).map(([, label]) => label);
  return days.join('') || 'TBA';
}

function normalizeBannerTime(value) {
  const raw = String(value ?? '').replace(/\D/g, '');
  if (raw.length < 3) return null;
  const padded = raw.padStart(4, '0');
  return `${padded.slice(0, 2)}:${padded.slice(2, 4)}`;
}

function meetingTimeLabel(meetingTime) {
  const start = normalizeBannerTime(meetingTime?.beginTime);
  const end = normalizeBannerTime(meetingTime?.endTime);
  return start && end ? `${start} - ${end}` : 'TBA';
}

function locationFor(meetingTime, row) {
  const building = htmlDecode(meetingTime?.building ?? meetingTime?.buildingDescription ?? '').trim();
  const room = String(meetingTime?.room ?? '').trim();
  return [building, room].filter(Boolean).join(' ') || htmlDecode(row.campusDescription ?? '').trim() || null;
}

function instructorsFor(row, meeting) {
  const people = [
    ...(row.faculty ?? []),
    ...(meeting?.faculty ?? []),
  ];
  return [...new Set(people.map((person) => htmlDecode(person.displayName ?? '').trim()).filter(Boolean))];
}

function sectionTypeLabel(type, sectionNumber) {
  const label = htmlDecode(type || 'Section');
  const lower = label.toLowerCase();
  const shortType = lower.includes('lecture') && lower.includes('lab')
    ? 'Lec/Lab'
    : lower.includes('lecture')
      ? 'Lec'
      : lower.includes('laboratory') || lower.includes(' lab')
        ? 'Lab'
        : lower.includes('discussion')
          ? 'Dis'
          : lower.includes('seminar')
            ? 'Sem'
            : label;
  return [shortType, sectionNumber].filter(Boolean).join(' ');
}

function buildRows(sections, termCode, qKey, subjectNames) {
  const syncedAt = new Date().toISOString();
  return sections.map((section) => {
    const meetings = Array.isArray(section.meetingsFaculty) ? section.meetingsFaculty : [];
    const primaryMeeting = meetings.find((item) => item?.meetingTime?.beginTime && item?.meetingTime?.endTime)
      ?? meetings[0]
      ?? null;
    const meetingTime = primaryMeeting?.meetingTime ?? null;
    const department = String(section.subject ?? '').trim();
    const courseNumber = String(section.courseNumber ?? '').trim();
    const instructors = instructorsFor(section, primaryMeeting);
    const credits = Number(section.creditHourLow ?? section.creditHours ?? section.creditHourHigh);

    return {
      id: `${config.source}:${termCode}:${section.courseReferenceNumber}`,
      school: config.school,
      source: config.source,
      source_id: String(section.courseReferenceNumber ?? section.id ?? ''),
      source_term_code: termCode,
      campus: htmlDecode(section.campusDescription ?? config.campus),
      status: section.openSection === true ? 'OPEN' : section.openSection === false ? 'CLOSED' : null,
      last_synced_at: syncedAt,
      quarter_key: qKey,
      department,
      dept_name: (subjectNames.get(department) ?? htmlDecode(section.subjectDescription ?? '')) || null,
      code: `${department} ${courseNumber}`.trim(),
      title: htmlDecode(section.courseTitle ?? ''),
      section_label: sectionTypeLabel(section.scheduleTypeDescription, section.sequenceNumber),
      professor: instructors[0] ?? '',
      instructors,
      days: dayLetters(meetingTime),
      time: meetingTimeLabel(meetingTime),
      location: locationFor(meetingTime, section),
      meetings,
      units: Number.isFinite(credits) ? credits : null,
      ge_categories: [],
      final_exam: null,
      restrictions: null,
      prerequisite_link: null,
      section_comment: null,
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

async function upsertSeedMetadata(subjects, qKey, termCodes, total, errors, updateTermMetadata = true) {
  if (DRY_RUN) return;

  const now = new Date().toISOString();
  const uniqueSubjects = uniqueSubjectRows(subjects);
  if (updateTermMetadata) {
    const { error: termError } = await supabase.from('school_terms').upsert({
      school: config.school,
      quarter_key: qKey,
      source: config.source,
      source_term_code: termCodes.join(','),
      status: errors > 0 ? 'partial' : 'seeded',
      section_count: total,
      department_count: uniqueSubjects.length,
      error_count: errors,
      last_seeded_at: now,
    }, { onConflict: 'school,quarter_key' });
    if (termError) console.error(`  ✗ school_terms upsert failed: ${termError.message}`);
  }

  const departmentRows = uniqueSubjects.map((subject) => ({
    school: config.school,
    department: subject.code,
    dept_name: subject.description || null,
    source: config.source,
    active: true,
    last_seen_at: now,
  }));
  const { error: departmentsError } = await supabase
    .from('school_departments')
    .upsert(departmentRows, { onConflict: 'school,department' });
  if (departmentsError) console.error(`  ✗ school_departments upsert failed: ${departmentsError.message}`);
}

function uniqueSubjectRows(subjects) {
  const map = new Map();
  subjects.forEach((subject) => {
    if (!map.has(subject.code)) map.set(subject.code, subject);
  });
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
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

  for (let i = 0; i < concurrency; i += 1) runNext();
  while (active.size > 0) await sleep(50);
}

async function main() {
  const qKey = quarterKey(YEAR, TERM);
  await establishSession();
  const termMatchesForSchool = await resolveTermCodes();
  const termCodes = termMatchesForSchool.map((term) => term.code);

  console.log(`Seeding ${config.school} ${TERM} ${YEAR} (${termMatchesForSchool.map((term) => `${term.code} ${term.description}`).join(' | ')})`);

  const allSubjects = [];
  const subjectNames = new Map();
  for (const termCode of termCodes) {
    await selectTerm(termCode);
    const subjects = SUBJECT_ARG
      ? SUBJECT_ARG.split(',').map((code) => ({ code: code.trim().toUpperCase(), description: null })).filter((subject) => subject.code)
      : await fetchSubjects(termCode);
    subjects.forEach((subject) => {
      allSubjects.push(subject);
      if (subject.description) subjectNames.set(subject.code, subject.description);
    });
  }

  const subjects = uniqueSubjectRows(allSubjects);
  console.log(`Subjects: ${subjects.length}`);

  let total = 0;
  let errors = 0;

  await runConcurrent(subjects, async (subject) => {
    let subjectTotal = 0;
    try {
      for (const termCode of termCodes) {
        await selectTerm(termCode);
        const sections = await fetchSubjectSections(termCode, subject.code);
        const rows = buildRows(sections, termCode, qKey, subjectNames);
        await upsertRows(rows);
        subjectTotal += rows.length;
      }
      total += subjectTotal;
      if (subjectTotal > 0) console.log(`  ✓ ${subject.code.padEnd(8)} ${subjectTotal} sections`);
    } catch (error) {
      errors += 1;
      console.error(`  ✗ ${subject.code.padEnd(8)} ${error.message}`);
    }
  }, CONCURRENCY);

  await upsertSeedMetadata(subjects, qKey, termCodes, total, errors, !SUBJECT_ARG);

  console.log(`\nDone. ${total.toLocaleString()} sections, ${errors} subject errors.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

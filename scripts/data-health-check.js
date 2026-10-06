#!/usr/bin/env node
// Nightly data-health check.
//
// Every serious data bug this app has shipped was silent: the app ran fine
// while showing the wrong building, the wrong P/NP deadline, 5 of 38 games.
// None of them were findable by reading code — each needed the data checked
// against its source. This script does that check every night and fails loudly
// when something drifts, so we hear about it before a student does.
//
// It runs the app's own TypeScript (map matcher, sports parser, dining fetch,
// calendar helpers) rather than re-implementing them, so it also catches the
// case where the data is right but the app reads it wrong.
//
// Read-only: uses the public anon key. Exit code 1 on any FAIL.
//
// Usage:
//   node scripts/data-health-check.js
//   node scripts/data-health-check.js --report /tmp/health.md

const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.resolve(__dirname, '..');
const SCHOOL = 'UC Irvine';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://koiawtfuuevblrvlpuhe.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_JnbSRv8Y1Ue_BAp5q9EWMA_YjZmAwcZ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Load the app's own TypeScript modules ───────────────────────────────────

// The app's data modules use AsyncStorage for caching (and the Supabase client
// persists its session there). Node has no React Native storage, so give them
// an in-memory one; every run starts cold, which is what we want to measure.
const memoryStore = new Map();
const AsyncStorageStub = {
  getItem: async (k) => (memoryStore.has(k) ? memoryStore.get(k) : null),
  setItem: async (k, v) => { memoryStore.set(k, v); },
  removeItem: async (k) => { memoryStore.delete(k); },
  getAllKeys: async () => [...memoryStore.keys()],
  multiRemove: async (keys) => { keys.forEach((k) => memoryStore.delete(k)); },
};
const NATIVE_STUBS = {
  '@react-native-async-storage/async-storage': { __esModule: true, default: AsyncStorageStub, ...AsyncStorageStub },
};

const moduleCache = new Map();
function loadTs(file) {
  if (moduleCache.has(file)) return moduleCache.get(file).exports;
  const src = fs.readFileSync(file, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
  }).outputText;
  const m = new Module(file);
  m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  moduleCache.set(file, m);
  const parentRequire = m.require.bind(m);
  m.require = (id) => {
    if (NATIVE_STUBS[id]) return NATIVE_STUBS[id];
    if (id.startsWith('.')) {
      const base = path.resolve(path.dirname(file), id);
      for (const ext of ['.ts', '.tsx']) if (fs.existsSync(base + ext)) return loadTs(base + ext);
    }
    // React Native / Expo modules have no Node build; the data modules only
    // touch them at call sites this script never reaches.
    try { return parentRequire(id); } catch { return new Proxy({}, { get: () => () => undefined }); }
  };
  m._compile(out, file);
  return m.exports;
}
const app = (rel) => loadTs(path.join(ROOT, rel));

// ─── Result collection ────────────────────────────────────────────────────────

const results = [];
function record(check, status, detail) {
  results.push({ check, status, detail });
  const icon = status === 'PASS' ? '✓' : status === 'WARN' ? '!' : '✗';
  console.log(`${icon} [${status}] ${check} — ${detail}`);
}
async function run(check, fn) {
  const started = Date.now();
  try {
    await fn();
  } catch (error) {
    record(check, 'FAIL', `check itself crashed: ${error && error.message}`);
  }
  const ms = Date.now() - started;
  if (ms > 60_000) record(check, 'WARN', `took ${(ms / 1000).toFixed(0)}s`);
}

async function fetchJson(url, timeoutMs = 20_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json', 'User-Agent': 'ClassMate-HealthCheck/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function pageAll(build, pageSize = 1000, max = 40_000) {
  const rows = [];
  for (let from = 0; from < max; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

// ─── Term context ─────────────────────────────────────────────────────────────

const schools = app('src/data/schools.ts');
const courses = app('src/data/courses.ts');
const now = new Date();
const currentTerm = schools.getAcademicTermForDate(SCHOOL, now);
const currentKey = courses.quarterKey(currentTerm);

function nextQuarterKey(key) {
  const order = ['Winter', 'Spring', 'Fall'];
  const [year, quarter] = key.split('-');
  if (quarter === 'Fall') return `${Number(year) + 1}-Winter`;
  if (quarter.startsWith('Summer')) return `${year}-Fall`;
  return `${year}-${order[order.indexOf(quarter) + 1]}`;
}
// Summer has no regular calendar rows; check the term students are planning.
const calendarKey = currentTerm.quarter.startsWith('Summer') ? `${currentTerm.year}-Fall` : currentKey;
const termsToCheck = [calendarKey, nextQuarterKey(calendarKey)];

// ─── 1. Course data is fresh ─────────────────────────────────────────────────

async function checkSectionFreshness() {
  const { data, error } = await supabase
    .from('sections')
    .select('last_synced_at')
    .eq('school', SCHOOL)
    .eq('quarter_key', calendarKey)
    .order('last_synced_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const latest = data?.[0]?.last_synced_at;
  if (!latest) return record('Course data freshness', 'FAIL', `no sections at all for ${calendarKey}`);
  const hours = (Date.now() - new Date(latest).getTime()) / 3_600_000;
  // The seeder runs daily; a gap past a day and a half means it stopped.
  record('Course data freshness', hours > 36 ? 'FAIL' : 'PASS', `${calendarKey} last synced ${hours.toFixed(1)}h ago`);
}

// ─── 2. Course data matches WebSoc ───────────────────────────────────────────

// A rotating handful each night: all departments every few weeks, without
// hammering Anteater API.
const ROTATION = ['ECON', 'COMPSCI', 'MATH', 'WRITING', 'BIO SCI', 'PSYCH', 'CHEM', 'PHYSICS', 'IN4MATX', 'STATS',
  'SOCIOL', 'POL SCI', 'HISTORY', 'EECS', 'MGMT', 'CRM/LAW', 'ENGLISH', 'PSCI', 'ANTHRO', 'MAE', 'PUBHLTH', 'ART HIS'];

async function checkSectionsMatchWebSoc() {
  const day = Math.floor(Date.now() / 86_400_000);
  const depts = [0, 1, 2].map((i) => ROTATION[(day * 3 + i) % ROTATION.length]);
  const [year, quarter] = calendarKey.split('-');
  let compared = 0;
  const problems = [];
  for (const dept of depts) {
    const json = await fetchJson(`https://anteaterapi.com/v2/rest/websoc?year=${year}&quarter=${quarter}&department=${encodeURIComponent(dept)}`);
    const live = new Map();
    for (const s of json.data?.schools ?? []) for (const d of s.departments ?? []) for (const c of d.courses ?? []) for (const x of c.sections ?? []) {
      if (x.isCancelled) continue;
      const m = (x.meetings ?? [])[0] ?? {};
      const start = m.startTime ? `${String(m.startTime.hour).padStart(2, '0')}:${String(m.startTime.minute).padStart(2, '0')}` : '';
      live.set(x.sectionCode, { days: (m.days ?? '').replace(/\s/g, ''), start });
    }
    const { data, error } = await supabase.from('sections').select('id,days,time')
      .eq('school', SCHOOL).eq('quarter_key', calendarKey).eq('department', dept);
    if (error) throw error;
    const db = new Map(data.map((r) => [r.id.split('::')[0], r]));
    for (const [code, l] of live) {
      const r = db.get(code);
      if (!r) { problems.push(`${dept} ${code} missing from DB`); continue; }
      compared++;
      if (l.start && !String(r.time ?? '').startsWith(l.start)) problems.push(`${dept} ${code} time ${r.time} ≠ ${l.start}`);
      if (l.days && String(r.days ?? '').replace(/\s/g, '') !== l.days) problems.push(`${dept} ${code} days ${r.days} ≠ ${l.days}`);
    }
    for (const code of db.keys()) if (!live.has(code)) problems.push(`${dept} ${code} in DB but not in WebSoc`);
  }
  // A section added or cancelled since last night is normal; a pattern isn't.
  const rate = compared ? problems.length / compared : 1;
  const status = !compared ? 'FAIL' : rate > 0.03 ? 'FAIL' : problems.length ? 'WARN' : 'PASS';
  record('Course data matches WebSoc', status,
    `${depts.join(', ')}: ${compared} sections compared, ${problems.length} differences${problems.length ? ' — ' + problems.slice(0, 6).join('; ') : ''}`);
}

// ─── 3. Every building code resolves to its own building ─────────────────────

// Codes that legitimately have no map pin.
const NO_PIN = new Set(['ON', 'TBA', 'VRTL', 'UCI', 'ONLINE', 'OFF', 'ARR']);

async function checkBuildingMapping() {
  const loc = app('src/data/campusLocations.ts');
  const rows = await pageAll(() => supabase.from('sections').select('location')
    .eq('school', SCHOOL).eq('quarter_key', calendarKey).order('id'));
  const counts = new Map();
  for (const r of rows) {
    const token = String(r.location ?? '').trim().split(/\s+/)[0]?.toUpperCase();
    if (!token || NO_PIN.has(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  const wrong = [], unmapped = [];
  for (const [code, n] of counts) {
    const hit = loc.getCampusMapLocation(SCHOOL, `${code} 100`);
    if (!hit) unmapped.push(`${code}(${n})`);
    else if (hit.code !== code) wrong.push(`${code}(${n})→${hit.code}`);
  }
  // Sending people to the wrong building is worse than showing no pin.
  if (wrong.length) record('Building codes map to their own building', 'FAIL', wrong.join(', '));
  else if (unmapped.length) record('Building codes map to their own building', 'WARN', `${counts.size} codes; no pin for ${unmapped.join(', ')}`);
  else record('Building codes map to their own building', 'PASS', `${counts.size} codes all resolve`);
}

// ─── 4. Academic calendar ─────────────────────────────────────────────────────

const REQUIRED_EVENTS = ['Instruction Begins', 'Add/Drop Deadline', 'P/NP Change Deadline', 'Last Day of Instruction', 'Finals Week'];
// Weekday of each holiday (0 = Sunday). UC observes these on fixed weekdays or
// fixed dates; anything else is a parse error.
const HOLIDAY_WEEKDAY = { 'Labor Day': 1, 'MLK Day': 1, "Presidents' Day": 1, 'Memorial Day': 1, 'Thanksgiving': 4 };
const HOLIDAY_MONTH = { 'Labor Day': 9, 'Veterans Day': 11, 'Thanksgiving': 11, 'MLK Day': 1, "Presidents' Day": 2, 'Memorial Day': 5, 'Farmworkers Day': 3, 'Juneteenth': 6 };

async function checkAcademicCalendar() {
  for (const key of termsToCheck) {
    const { data, error } = await supabase.from('academic_calendar').select('id,title,date,end_date')
      .eq('school', SCHOOL).eq('quarter_key', key);
    if (error) throw error;
    const issues = [];
    const titles = new Set(data.map((r) => r.title));
    for (const t of REQUIRED_EVENTS) if (!titles.has(t)) issues.push(`missing "${t}"`);

    for (const r of data) {
      const [y, m, d] = r.date.split('-').map(Number);
      const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      if (HOLIDAY_MONTH[r.title] && HOLIDAY_MONTH[r.title] !== m) issues.push(`${r.title} on ${r.date} is in the wrong month`);
      if (r.title in HOLIDAY_WEEKDAY && HOLIDAY_WEEKDAY[r.title] !== wd) issues.push(`${r.title} on ${r.date} is not its weekday`);
    }
    // Curated and scraped rows for the same event must agree; the app shows the
    // curated one, so a disagreement means one of them is wrong.
    const byTitle = new Map();
    for (const r of data) {
      const list = byTitle.get(r.title) ?? [];
      list.push(r);
      byTitle.set(r.title, list);
    }
    for (const [title, list] of byTitle) {
      const dates = new Set(list.map((r) => r.date));
      if (dates.size > 1) issues.push(`"${title}" has conflicting dates ${[...dates].join(' / ')}`);
    }
    // P/NP must be the end of week 2, i.e. the add/drop date (registrar policy).
    const pnp = data.filter((r) => r.title === 'P/NP Change Deadline').map((r) => r.date);
    const addDrop = data.filter((r) => r.title === 'Add/Drop Deadline').map((r) => r.date);
    if (pnp.length && addDrop.length && !pnp.every((d) => addDrop.includes(d))) {
      issues.push(`P/NP deadline ${pnp.join('/')} ≠ week-2 add/drop ${addDrop.join('/')}`);
    }
    record(`Academic calendar ${key}`, issues.length ? 'FAIL' : 'PASS', issues.length ? issues.join('; ') : `${data.length} events, all consistent`);
  }
}

// ─── 5. Term boundaries the widget and reminders depend on ───────────────────

async function checkTermBoundaries() {
  const cal = app('src/data/academicCalendar.ts');
  const missing = [];
  for (const key of termsToCheck) {
    const { data } = await supabase.from('academic_calendar').select('title,category,date,end_date')
      .eq('school', SCHOOL).eq('quarter_key', key);
    const hasStart = (data ?? []).some((r) => /instruction begins/i.test(r.title));
    const hasEnd = (data ?? []).some((r) => r.category === 'finals' || /last day of instruction/i.test(r.title));
    if (!hasStart) missing.push(`${key} start`);
    if (!hasEnd) missing.push(`${key} end`);
  }
  // Sanity-check the shipped fallback still parses for the current term.
  const fallbackEnd = cal.getTermEndDate(SCHOOL, calendarKey);
  record('Term start/end dates available', missing.length ? 'FAIL' : 'PASS',
    missing.length ? `no data for ${missing.join(', ')} — widget dates and reminder cut-off will be wrong`
      : `${termsToCheck.join(', ')} have start and end${fallbackEnd ? '' : ' (no local fallback for current term)'}`);
}

// ─── 6. Sports: the app shows every game the feed has ────────────────────────

async function checkSports() {
  const sports = app('src/data/sportsEvents.ts');
  const loc = app('src/data/campusLocations.ts');
  const parsed = await sports.fetchSportsEventsForSchool(SCHOOL, { maxDaysAhead: 14, includePastDays: 0 });

  // Count what the source actually has for the same window.
  const months = [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1)];
  let raw = 0;
  const end = now.getTime() + 15 * 86_400_000;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  for (const m of months) {
    const days = await fetchJson(`https://ucirvinesports.com/services/responsive-calendar.ashx?type=month&sport=0&location=all&date=${m.getMonth() + 1}/1/${m.getFullYear()}&year=${m.getFullYear()}`);
    for (const d of days) for (const g of d.events ?? []) {
      const t = new Date(g.date).getTime();
      if (t >= startOfToday && t < end) raw++;
    }
  }
  const homeWithoutVenue = parsed.filter((e) => e.isHome && !loc.getSportsVenueForEvent(SCHOOL, e) && !/tba/i.test(e.location));
  // Window edges differ by a few hours across time zones; allow a little slack.
  const missing = raw - parsed.length;
  const status = parsed.length === 0 && raw > 0 ? 'FAIL' : missing > Math.max(2, raw * 0.1) ? 'FAIL' : homeWithoutVenue.length ? 'WARN' : 'PASS';
  record('Sports events', status,
    `feed has ~${raw} in 14 days, app parsed ${parsed.length}${homeWithoutVenue.length ? `; home games with no venue: ${homeWithoutVenue.map((e) => e.sport).join(', ')}` : ''}`);
}

// ─── 7. Dining ────────────────────────────────────────────────────────────────

async function checkDining() {
  const dining = app('src/data/uciDining.ts');
  const started = Date.now();
  const summaries = await dining.fetchUciDiningSummaries(now);
  const ms = Date.now() - started;
  const withToday = summaries.filter((s) => (s.todayMeals ?? []).length > 0);
  const status = summaries.length === 0 ? 'FAIL' : ms > 8000 ? 'WARN' : 'PASS';
  record('Dining hours', status, `${summaries.length} locations, ${withToday.length} with today's meals, ${ms}ms`);
}

// ─── 8. Latency of the queries users wait on ──────────────────────────────────

async function checkLatency() {
  const timings = [];
  const time = async (label, q) => {
    const s = Date.now();
    const { error } = await q;
    if (error) throw error;
    timings.push([label, Date.now() - s]);
  };
  await time('course list page', supabase.from('sections').select('id,code,title,department,professor,days,time,location,units,section_label,status')
    .eq('school', SCHOOL).eq('quarter_key', calendarKey).order('code').order('id').range(0, 999));
  await time('department filter', supabase.from('sections').select('id,code,title,department,professor,days,time,location,units,section_label,status')
    .eq('school', SCHOOL).eq('quarter_key', calendarKey).eq('department', 'ECON').order('code').order('id'));
  await time('academic calendar', supabase.from('academic_calendar').select('id,title,date').eq('school', SCHOOL).eq('quarter_key', calendarKey));
  const s = Date.now();
  await fetchJson(`https://anteaterapi.com/v2/rest/websoc?department=ECON&courseNumber=1&year=${calendarKey.split('-')[0]}&quarter=${calendarKey.split('-')[1]}`);
  timings.push(['live seat counts (Anteater API)', Date.now() - s]);

  const slow = timings.filter(([, ms]) => ms > 2000);
  record('Response times', slow.some(([, ms]) => ms > 5000) ? 'FAIL' : slow.length ? 'WARN' : 'PASS',
    timings.map(([l, ms]) => `${l} ${ms}ms`).join(', '));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`ClassMate data health — ${now.toISOString()} — term ${calendarKey}\n`);
  await run('Course data freshness', checkSectionFreshness);
  await run('Course data matches WebSoc', checkSectionsMatchWebSoc);
  await run('Building codes', checkBuildingMapping);
  await run('Academic calendar', checkAcademicCalendar);
  await run('Term boundaries', checkTermBoundaries);
  await run('Sports events', checkSports);
  await run('Dining hours', checkDining);
  await run('Response times', checkLatency);

  const fails = results.filter((r) => r.status === 'FAIL');
  const warns = results.filter((r) => r.status === 'WARN');
  const reportIdx = process.argv.indexOf('--report');
  if (reportIdx > -1 && process.argv[reportIdx + 1]) {
    const icon = { PASS: '✅', WARN: '⚠️', FAIL: '❌' };
    const md = [
      `**${fails.length} failing, ${warns.length} warnings** — term ${calendarKey}, ${now.toISOString()}`,
      '',
      '| | Check | Detail |',
      '|---|---|---|',
      ...results.map((r) => `| ${icon[r.status]} | ${r.check} | ${String(r.detail).replace(/\|/g, '\\|')} |`),
    ].join('\n');
    fs.writeFileSync(process.argv[reportIdx + 1], md);
  }
  console.log(`\n${fails.length} FAIL, ${warns.length} WARN, ${results.length - fails.length - warns.length} PASS`);
  process.exit(fails.length ? 1 : 0);
})();

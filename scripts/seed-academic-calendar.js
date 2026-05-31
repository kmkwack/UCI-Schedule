// ─────────────────────────────────────────────────────────────────────────────
// Academic Calendar Auto-Seeder
//
// Scrapes each school's official registrar page and upserts key academic
// dates into Supabase academic_calendar table. Runs monthly via GitHub Actions.
//
// HOW TO RUN:
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed-academic-calendar.js
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed-academic-calendar.js --schools uci,cornell
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed-academic-calendar.js --years 2025,2026
// ─────────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const ALL_SCHOOLS = ['uci', 'cornell', 'purdue', 'umd', 'uiuc'];

function parseArgs() {
  const args = process.argv.slice(2);
  const year = new Date().getFullYear();
  const opts = { schools: ALL_SCHOOLS, years: [year, year + 1] };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--schools' && args[i + 1]) {
      opts.schools = args[i + 1].split(',').map((s) => s.trim().toLowerCase());
      i++;
    } else if (args[i] === '--years' && args[i + 1]) {
      opts.years = args[i + 1].split(',').map(Number).filter(Boolean);
      i++;
    }
  }
  return opts;
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────

async function fetchText(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'ClassMate-CalendarBot/1.0 (academic calendar sync)' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function stripHtml(html) {
  return html
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—').replace(/&#39;/g, "'").replace(/&[a-z#0-9]+;/g, '')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const MONTHS = {
  Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06',
  Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12',
  January:'01', February:'02', March:'03', April:'04', June:'06',
  July:'07', August:'08', September:'09', October:'10', November:'11', December:'12',
};

function isoDate(month, day, year) {
  const m = MONTHS[month];
  if (!m) return null;
  return `${year}-${m}-${String(parseInt(day, 10)).padStart(2, '0')}`;
}

// Parse "Oct 10" or "October 10" → { date, endDate }
// Also handles "Dec 6–12" or "Mar 14-20", "Mar 14 - Mar 20"
function parseDateCell(raw, year) {
  const s = raw.replace(/\*/g, '').trim();

  // Full range with two months: "Mar 14 – Mar 20"
  const fullRange = s.match(/([A-Za-z]+)\.?\s+(\d{1,2})\s*[–-]\s*([A-Za-z]+)\.?\s+(\d{1,2})/);
  if (fullRange) {
    const d = isoDate(fullRange[1], fullRange[2], year);
    const e = isoDate(fullRange[3], fullRange[4], year);
    return d ? { date: d, endDate: e } : null;
  }

  // Short range, same month: "Dec 6–12"
  const shortRange = s.match(/([A-Za-z]+)\.?\s+(\d{1,2})\s*[–-]\s*(\d{1,2})/);
  if (shortRange) {
    const d = isoDate(shortRange[1], shortRange[2], year);
    const e = isoDate(shortRange[1], shortRange[3], year);
    return d ? { date: d, endDate: e } : null;
  }

  // Single date: "Oct 10" or "October 10, 2025"
  const single = s.match(/([A-Za-z]+)\.?\s+(\d{1,2})/);
  if (single) {
    const d = isoDate(single[1], single[2], year);
    return d ? { date: d, endDate: null } : null;
  }

  return null;
}

function makeId(school, quarterKey, title) {
  const slug = `${school}-${quarterKey}-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');
  return `auto-${slug}`;
}

// ─── UCI ─────────────────────────────────────────────────────────────────────
// https://reg.uci.edu/calendars/quarterly/YYYY-YYYY/quarterlyYY-YY.html
// Table: description | Fall | Winter | Spring

async function scrapeUci(academicYear) {
  const y1 = academicYear, y2 = academicYear + 1;
  const url = `https://reg.uci.edu/calendars/quarterly/${y1}-${y2}/quarterly${String(y1).slice(2)}-${String(y2).slice(2)}.html`;
  console.log(`    ${url}`);
  const html = await fetchText(url);

  const quarters = [
    { key: `${y1}-Fall`,   year: y1 },
    { key: `${y2}-Winter`, year: y2 },
    { key: `${y2}-Spring`, year: y2 },
  ];

  const rules = [
    { re: /instruction begins/i,                        title: 'Instruction Begins',    category: 'instruction' },
    { re: /drop.*without dean.*approval/i,              title: 'Add/Drop Deadline',     category: 'enrollment',  subtitle: "No dean's approval needed (5 PM)", url },
    { re: /grading option.*dean.*required/i,            title: 'P/NP Change Deadline',  category: 'passnopass',  subtitle: 'Last drop without W grade (5 PM)', url: 'https://reg.uci.edu/enrollment/grading/passnopass.html' },
    { re: /withdraw.*W grade assigned/i,                title: 'Withdrawal Deadline',   category: 'withdrawal',  subtitle: 'W grade assigned (5 PM)', url },
    { re: /instruction ends/i,                          title: 'Last Day of Instruction', category: 'instruction' },
    { re: /final exam/i,                                title: 'Finals Week',            category: 'finals', url },
    { re: /deadline.*submit.*final grades/i,            title: 'Final Grades Due',       category: 'deadline', subtitle: 'Grades available 10 PM' },
    { re: /veterans day/i,                              title: 'Veterans Day',           category: 'holiday', subtitle: 'No classes', cols: [0] },
    { re: /thanksgiving/i,                              title: 'Thanksgiving',           category: 'holiday', subtitle: 'No classes', cols: [0] },
    { re: /martin luther king|mlk/i,                   title: 'MLK Day',               category: 'holiday', subtitle: 'No classes', cols: [1] },
    { re: /president.{0,3}s.*day/i,                    title: "Presidents' Day",       category: 'holiday', subtitle: 'No classes', cols: [1] },
    { re: /memorial day/i,                             title: 'Memorial Day',          category: 'holiday', subtitle: 'No classes', cols: [2] },
    { re: /commencement/i,                             title: 'Commencement',          category: 'graduation', cols: [2] },
  ];

  const tableRowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  const events = [];
  const seen = new Set();
  let m;

  while ((m = tableRowRe.exec(html)) !== null) {
    const cells = [];
    let c;
    cellRe.lastIndex = 0;
    while ((c = cellRe.exec(m[1])) !== null) cells.push(stripHtml(c[1]));
    if (cells.length < 4) continue;
    const desc = cells[0];

    for (const rule of rules) {
      if (!rule.re.test(desc)) continue;
      const colIndices = rule.cols ?? [0, 1, 2];
      for (const qi of colIndices) {
        const parsed = parseDateCell(cells[qi + 1] ?? '', quarters[qi].year);
        if (!parsed) continue;
        const key = `${quarters[qi].key}::${rule.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        events.push({
          id: makeId('uci', quarters[qi].key, rule.title),
          school: 'UC Irvine',
          quarterKey: quarters[qi].key,
          title: rule.title,
          subtitle: rule.subtitle ?? null,
          date: parsed.date,
          endDate: parsed.endDate,
          category: rule.category,
          url: rule.url ?? null,
        });
      }
      break;
    }
  }

  return events;
}

// ─── Cornell ─────────────────────────────────────────────────────────────────
// https://registrar.cornell.edu/academic-calendar
// Format: "Fall 2025: Last day to add classes Sep 8"
// Semester school: Fall + Spring only

async function scrapeCornel(academicYear) {
  const url = 'https://registrar.cornell.edu/academic-calendar';
  console.log(`    ${url}`);
  const html = await fetchText(url);
  const text = stripHtml(html);

  const y1 = academicYear, y2 = academicYear + 1;
  const terms = [
    { label: `Fall ${y1}`,   key: `${y1}-Fall`,   year: y1 },
    { label: `Spring ${y2}`, key: `${y2}-Spring`,  year: y2 },
  ];

  const rules = [
    { re: /last day to add classes.*(?:regular|full)/i,                         title: 'Add Deadline',               category: 'enrollment' },
    { re: /last day to drop classes.*(?:regular|full)/i,                        title: 'Drop Deadline',              category: 'enrollment' },
    { re: /last day to change grading basis/i,                                  title: 'S/U Grade Deadline',         category: 'passnopass', subtitle: 'Satisfactory/Unsatisfactory', url: 'https://registrar.cornell.edu/student-services/su-option' },
    { re: /last day of instruction.*(?:regular|full)/i,                         title: 'Last Day of Classes',        category: 'instruction' },
    { re: /(?:regular|full).*final exam|final exam.*(?:regular|full)/i,         title: 'Finals Period',              category: 'finals', url },
    { re: /fall break/i,                                                         title: 'Fall Break',                 category: 'holiday', termLabel: `Fall ${y1}` },
    { re: /spring break/i,                                                       title: 'Spring Break',               category: 'holiday', termLabel: `Spring ${y2}` },
    { re: /thanksgiving/i,                                                       title: 'Thanksgiving Break',         category: 'holiday', termLabel: `Fall ${y1}` },
    { re: /labor day/i,                                                          title: 'Labor Day',                  category: 'holiday', subtitle: 'No classes', termLabel: `Fall ${y1}` },
    { re: /instruction begins|classes begin/i,                                   title: 'Classes Begin',              category: 'instruction' },
    { re: /commencement|graduation ceremony/i,                                   title: 'Commencement',               category: 'graduation', termLabel: `Spring ${y2}` },
  ];

  const events = [];
  const seen = new Set();

  for (const term of terms) {
    // Find all sentences that start with "Fall YYYY:" or "Spring YYYY:"
    const termPattern = new RegExp(`${term.label}\\s*:\\s*([^]+?)(?=(?:Fall|Spring|Summer|Winter)\\s+\\d{4}:|$)`, 'gi');
    let block;
    while ((block = termPattern.exec(text)) !== null) {
      const desc = block[1].slice(0, 200);
      for (const rule of rules) {
        if (rule.termLabel && rule.termLabel !== term.label) continue;
        if (!rule.re.test(desc)) continue;

        // Extract date from the description
        const dateMatch = desc.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:\s*[–-]\s*(?:[A-Za-z]{3,9}\.?\s+)?(\d{1,2}))?/);
        if (!dateMatch) continue;

        const parsed = parseDateCell(dateMatch[0], term.year);
        if (!parsed) continue;

        const key = `${term.key}::${rule.title}`;
        if (seen.has(key)) continue;
        seen.add(key);

        events.push({
          id: makeId('cornell', term.key, rule.title),
          school: 'Cornell University',
          quarterKey: term.key,
          title: rule.title,
          subtitle: rule.subtitle ?? null,
          date: parsed.date,
          endDate: parsed.endDate,
          category: rule.category,
          url: rule.url ?? `https://registrar.cornell.edu/academic-calendar`,
        });
        break;
      }
    }
  }

  return events;
}

// ─── Purdue ───────────────────────────────────────────────────────────────────
// https://catalog.purdue.edu/preview_program.php?catoid=XX&poid=XX
// catoid increments each year — scrape the calendars index to find current link

async function scrapePurdue(academicYear) {
  const y1 = academicYear, y2 = academicYear + 1;
  const indexUrl = 'https://www.purdue.edu/registrar/calendars/';
  console.log(`    ${indexUrl} (finding ${y1}-${y2} calendar)`);

  const indexHtml = await fetchText(indexUrl);
  const yearPattern = new RegExp(`href="([^"]+catalog[^"]+)"[^>]*title="[^"]*${y1}-${String(y2).slice(2)}[^"]*"`, 'i');
  const linkMatch = indexHtml.match(yearPattern);
  const calUrl = linkMatch ? linkMatch[1] : null;

  if (!calUrl) {
    throw new Error(`Could not find ${y1}-${y2} calendar link on Purdue page`);
  }
  console.log(`    → ${calUrl}`);
  const html = await fetchText(calUrl);
  const text = stripHtml(html);

  const terms = [
    { label: 'Fall',   key: `${y1}-Fall`,   year: y1 },
    { label: 'Spring', key: `${y2}-Spring`,  year: y2 },
  ];

  // Purdue catalog page lists dates inline: "Fall Break October 13-14"
  const rules = [
    { re: /classes begin|instruction begins/i,      title: 'Classes Begin',         category: 'instruction' },
    { re: /last day.*add.*drop|add.*drop.*deadline/i, title: 'Add/Drop Deadline',   category: 'enrollment', url: calUrl },
    { re: /S\/U.*deadline|satisfactory.*unsatisfactory|grade.*option.*change/i, title: 'S/U Grade Deadline', category: 'passnopass', subtitle: 'Satisfactory/Unsatisfactory', url: calUrl },
    { re: /last day.*withdraw|withdrawal deadline/i, title: 'Withdrawal Deadline',  category: 'withdrawal', subtitle: 'W grade assigned', url: calUrl },
    { re: /last day.*class|last day.*instruction|end.*instruction/i, title: 'Last Day of Classes', category: 'instruction' },
    { re: /final exam/i,                             title: 'Finals Week',           category: 'finals', url: calUrl },
    { re: /spring break/i,                           title: 'Spring Break',          category: 'holiday', termLabel: 'Spring' },
    { re: /fall break/i,                             title: 'Fall Break',            category: 'holiday', termLabel: 'Fall' },
    { re: /thanksgiving/i,                           title: 'Thanksgiving Break',    category: 'holiday', termLabel: 'Fall' },
    { re: /labor day/i,                              title: 'Labor Day',             category: 'holiday', subtitle: 'No classes', termLabel: 'Fall' },
    { re: /mlk|martin luther king/i,                title: 'MLK Day',               category: 'holiday', subtitle: 'No classes', termLabel: 'Spring' },
  ];

  const events = [];
  const seen = new Set();

  // Try to split text into Fall/Spring sections
  for (const term of terms) {
    const sectionRe = new RegExp(`${term.label}\\s+(?:Semester\\s+)?${term.year}[\\s\\S]{0,3000}`, 'i');
    const sectionMatch = text.match(sectionRe);
    const section = sectionMatch ? sectionMatch[0].slice(0, 3000) : text;

    for (const rule of rules) {
      if (rule.termLabel && rule.termLabel !== term.label) continue;
      const match = section.match(new RegExp(rule.re.source + '[^\\n]{0,80}', 'i'));
      if (!match) continue;

      const dateMatch = match[0].match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:\s*[–-]\s*(?:[A-Za-z]{3,9}\.?\s+)?(\d{1,2}))?/);
      if (!dateMatch) continue;

      const parsed = parseDateCell(dateMatch[0], term.year);
      if (!parsed) continue;

      const key = `${term.key}::${rule.title}`;
      if (seen.has(key)) continue;
      seen.add(key);

      events.push({
        id: makeId('purdue', term.key, rule.title),
        school: 'Purdue University',
        quarterKey: term.key,
        title: rule.title,
        subtitle: rule.subtitle ?? null,
        date: parsed.date,
        endDate: parsed.endDate,
        category: rule.category,
        url: rule.url ?? calUrl,
      });
    }
  }

  return events;
}

// ─── UMD ─────────────────────────────────────────────────────────────────────
// https://registrar.umd.edu/calendars/standard-registration-dates-deadlines
// Format: "Event name... Date Jan 26, 2026 (Mon)"

async function scrapeUmd(academicYear) {
  const url = 'https://registrar.umd.edu/calendars/standard-registration-dates-deadlines';
  console.log(`    ${url}`);
  const html = await fetchText(url);
  const text = stripHtml(html);

  const y1 = academicYear, y2 = academicYear + 1;
  const terms = [
    { label: `Fall ${y1}`,   key: `${y1}-Fall`,   year: y1 },
    { label: `Spring ${y2}`, key: `${y2}-Spring`,  year: y2 },
  ];

  const rules = [
    { re: /first day of classes|instruction begins/i,           title: 'Classes Begin',         category: 'instruction' },
    { re: /schedule adjustment|last day.*add.*drop/i,           title: 'Add/Drop Deadline',     category: 'enrollment', subtitle: 'Schedule adjustment period ends', url },
    { re: /pass.?fail deadline|grade.*pass.*fail/i,             title: 'Pass/Fail Deadline',    category: 'passnopass', url: 'https://registrar.umd.edu/current-students/registration/grading-options' },
    { re: /last day.*withdraw|withdrawal deadline/i,            title: 'Withdrawal Deadline',   category: 'withdrawal', subtitle: 'W grade assigned', url },
    { re: /last day of classes|instruction ends/i,              title: 'Last Day of Classes',   category: 'instruction' },
    { re: /final exam/i,                                        title: 'Finals Period',         category: 'finals', url },
    { re: /spring break/i,                                      title: 'Spring Break',          category: 'holiday', termLabel: `Spring ${y2}` },
    { re: /thanksgiving/i,                                      title: 'Thanksgiving Break',    category: 'holiday', termLabel: `Fall ${y1}` },
  ];

  const events = [];
  const seen = new Set();

  for (const term of terms) {
    // Find the section for this term
    const idx = text.indexOf(term.label);
    if (idx < 0) continue;
    const section = text.slice(idx, idx + 4000);

    for (const rule of rules) {
      if (rule.termLabel && rule.termLabel !== term.label) continue;
      const lineRe = new RegExp(rule.re.source + '[^\\n]{0,200}', 'i');
      const lineMatch = section.match(lineRe);
      if (!lineMatch) continue;

      // UMD format: "Event description... Jan 26, 2026 (Mon)"
      const dateRe = /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/g;
      const dateMatches = [...lineMatch[0].matchAll(dateRe)];
      if (!dateMatches.length) continue;

      // For ranges, look for two dates
      const startMatch = dateMatches[0];
      const endMatch = dateMatches.length > 1 ? dateMatches[dateMatches.length - 1] : null;
      const date = isoDate(startMatch[1], startMatch[2], parseInt(startMatch[3], 10));
      if (!date) continue;
      const endDate = endMatch && endMatch[3] !== startMatch[3] || (endMatch && endMatch[2] !== startMatch[2])
        ? isoDate(endMatch[1], endMatch[2], parseInt(endMatch[3], 10))
        : null;

      const key = `${term.key}::${rule.title}`;
      if (seen.has(key)) continue;
      seen.add(key);

      events.push({
        id: makeId('umd', term.key, rule.title),
        school: 'University of Maryland, College Park',
        quarterKey: term.key,
        title: rule.title,
        subtitle: rule.subtitle ?? null,
        date,
        endDate,
        category: rule.category,
        url: rule.url ?? url,
      });
    }
  }

  return events;
}

// ─── UIUC ─────────────────────────────────────────────────────────────────────
// https://registrar.illinois.edu/{fall|spring}-YYYY-academic-calendar/
// Per-term pages with structured text

async function scrapeUiuc(academicYear) {
  const y1 = academicYear, y2 = academicYear + 1;
  const terms = [
    { season: 'fall',   key: `${y1}-Fall`,   year: y1, url: `https://registrar.illinois.edu/fall-${y1}-academic-calendar/` },
    { season: 'spring', key: `${y2}-Spring`,  year: y2, url: `https://registrar.illinois.edu/spring-${y2}-academic-calendar/` },
  ];

  const rules = [
    { re: /instruction begins|classes begin|first day of instruction/i, title: 'Classes Begin',              category: 'instruction' },
    { re: /last day.*add|last day.*enroll/i,                            title: 'Add Deadline',               category: 'enrollment' },
    { re: /credit.?no.?credit|credit\/no credit/i,                      title: 'Credit/No Credit Deadline',  category: 'passnopass', url: 'https://registrar.illinois.edu/courses-grades/credit-no-credit/' },
    { re: /last day.*drop|last day.*withdraw/i,                         title: 'Withdrawal Deadline',        category: 'withdrawal', subtitle: 'W grade assigned' },
    { re: /last day of instruction|instruction ends|classes end/i,      title: 'Last Day of Classes',        category: 'instruction' },
    { re: /final exam/i,                                                 title: 'Finals Period',              category: 'finals' },
    { re: /thanksgiving/i,                                               title: 'Thanksgiving Break',         category: 'holiday' },
    { re: /spring break/i,                                               title: 'Spring Break',               category: 'holiday' },
    { re: /fall break/i,                                                 title: 'Fall Break',                 category: 'holiday' },
    { re: /labor day/i,                                                  title: 'Labor Day',                  category: 'holiday', subtitle: 'No classes' },
    { re: /mlk|martin luther king/i,                                    title: 'MLK Day',                    category: 'holiday', subtitle: 'No classes' },
  ];

  const events = [];
  const seen = new Set();

  for (const term of terms) {
    console.log(`    ${term.url}`);
    let html;
    try {
      html = await fetchText(term.url);
    } catch (err) {
      console.log(`    Skipping ${term.key}: ${err.message}`);
      continue;
    }
    const text = stripHtml(html);

    for (const rule of rules) {
      const lineRe = new RegExp(rule.re.source + '[^\\n]{0,150}', 'i');
      const lineMatch = text.match(lineRe);
      if (!lineMatch) continue;

      const dateMatch = lineMatch[0].match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:\s*[–-]\s*(?:[A-Za-z]{3,9}\.?\s+)?(\d{1,2}))?/);
      if (!dateMatch) continue;

      const parsed = parseDateCell(dateMatch[0], term.year);
      if (!parsed) continue;

      const key = `${term.key}::${rule.title}`;
      if (seen.has(key)) continue;
      seen.add(key);

      events.push({
        id: makeId('uiuc', term.key, rule.title),
        school: 'University of Illinois Urbana-Champaign',
        quarterKey: term.key,
        title: rule.title,
        subtitle: rule.subtitle ?? null,
        date: parsed.date,
        endDate: parsed.endDate,
        category: rule.category,
        url: rule.url ?? term.url,
      });
    }
  }

  return events;
}

// ─── Supabase upsert ─────────────────────────────────────────────────────────

async function upsertEvents(events) {
  if (!events.length) return 0;
  const rows = events.map((e) => ({
    id: e.id,
    school: e.school,
    quarter_key: e.quarterKey,
    title: e.title,
    subtitle: e.subtitle,
    date: e.date,
    end_date: e.endDate ?? null,
    category: e.category,
    url: e.url,
  }));
  const { error } = await supabase.from('academic_calendar').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  return rows.length;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const SCRAPERS = {
  uci:     { name: 'UC Irvine',                               fn: scrapeUci },
  cornell: { name: 'Cornell University',                      fn: scrapeCornel },
  purdue:  { name: 'Purdue University',                       fn: scrapePurdue },
  umd:     { name: 'University of Maryland, College Park',    fn: scrapeUmd },
  uiuc:    { name: 'University of Illinois Urbana-Champaign', fn: scrapeUiuc },
};

async function main() {
  const { schools, years } = parseArgs();
  console.log(`\nAcademic Calendar Seeder`);
  console.log(`Schools: ${schools.join(', ')}`);
  console.log(`Academic year starts: ${years.join(', ')}\n`);

  let totalUpserted = 0;
  const failures = [];

  for (const schoolKey of schools) {
    const scraper = SCRAPERS[schoolKey];
    if (!scraper) { console.warn(`Unknown school: ${schoolKey}`); continue; }

    for (const year of years) {
      const label = `${scraper.name} ${year}-${year + 1}`;
      console.log(`\n── ${label}`);
      try {
        const events = await scraper.fn(year);
        if (events.length === 0) {
          console.log('  No events parsed — page structure may have changed');
          continue;
        }
        console.log(`  Parsed ${events.length} events:`);
        for (const e of events) {
          const range = e.endDate ? `${e.date} – ${e.endDate}` : e.date;
          console.log(`    [${e.quarterKey}] ${e.title}: ${range}`);
        }
        const n = await upsertEvents(events);
        console.log(`  ✓ Upserted ${n} rows`);
        totalUpserted += n;
      } catch (err) {
        console.error(`  ✗ FAILED: ${err.message}`);
        failures.push(label);
      }
    }
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Total upserted: ${totalUpserted}`);
  if (failures.length) {
    console.error(`Failed:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
  console.log('Done.\n');
}

main();

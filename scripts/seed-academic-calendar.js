// ─────────────────────────────────────────────────────────────────────────────
// Academic Calendar Auto-Seeder
//
// Scrapes official registrar pages → parses key dates → upserts to Supabase.
// Runs monthly via GitHub Actions so the app always has fresh data.
//
// HOW TO RUN:
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed-academic-calendar.js
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

// ─── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const year = new Date().getFullYear();
  const opts = { years: [year, year + 1] };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--years' && args[i + 1]) {
      opts.years = args[i + 1].split(',').map(Number).filter(Boolean);
      i++;
    }
  }
  return opts;
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'ClassMate-CalendarBot/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function cleanCell(html) {
  return html
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—').replace(/&#39;/g, "'").replace(/&[a-z]+;/g, '')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// "Sep 25" → "2025-09-25", also handles "Dec 6–12" range → start + end
const MONTHS = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',
                 Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' };

function parseDate(raw, year) {
  const clean = raw.replace(/\*/g, '').trim();
  // Range: "Dec 6–12" or "Mar 14–20" or "Jun 6–11"
  const rangeMatch = clean.match(/([A-Za-z]{3})\s+(\d{1,2})\s*[–-]\s*(\d{1,2})/);
  if (rangeMatch) {
    const mon = MONTHS[rangeMatch[1]]; if (!mon) return null;
    const d1 = rangeMatch[2].padStart(2,'0');
    const d2 = rangeMatch[3].padStart(2,'0');
    return { date: `${year}-${mon}-${d1}`, endDate: `${year}-${mon}-${d2}` };
  }
  // Single: "Sep 25"
  const single = clean.match(/([A-Za-z]{3})\.?\s+(\d{1,2})/);
  if (single) {
    const mon = MONTHS[single[1]]; if (!mon) return null;
    const d = single[2].padStart(2,'0');
    return { date: `${year}-${mon}-${d}`, endDate: null };
  }
  return null;
}

// ─── UCI ─────────────────────────────────────────────────────────────────────
//
// Page: https://reg.uci.edu/calendars/quarterly/YYYY-YYYY/quarterlyYY-YY.html
// Table rows: description | Fall | Winter | Spring

async function scrapeUci(academicYear) {
  const y1 = academicYear, y2 = academicYear + 1;
  const url = `https://reg.uci.edu/calendars/quarterly/${y1}-${y2}/quarterly${String(y1).slice(2)}-${String(y2).slice(2)}.html`;
  console.log(`  → ${url}`);

  const html = await fetchText(url);

  // Parse <tr> rows into [desc, col1, col2, col3] arrays
  const tableRows = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let row;
  while ((row = rowRe.exec(html)) !== null) {
    const cells = [];
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cell;
    while ((cell = cellRe.exec(row[1])) !== null) cells.push(cleanCell(cell[1]));
    if (cells.length >= 4) tableRows.push(cells);
  }

  // Columns after the header row: [description, Fall, Winter, Spring]
  // Fall = academicYear, Winter = academicYear+1, Spring = academicYear+1
  const quarters = [
    { key: `${y1}-Fall`,   year: y1   },
    { key: `${y2}-Winter`, year: y2   },
    { key: `${y2}-Spring`, year: y2   },
  ];

  const rules = [
    {
      match: (d) => /instruction begins/i.test(d),
      title: 'Instruction Begins', category: 'instruction',
    },
    {
      match: (d) => /\bdrop\b.*without dean|waitlists deactivated|add.*without dean/i.test(d) && !/W grade|without receiving/i.test(d),
      title: 'Add/Drop Deadline', subtitle: "No dean's approval needed (5 PM)",
      category: 'enrollment', url: url,
    },
    {
      match: (d) => /grading option.*dean|change.*grade.*option.*dean|grade option.*required/i.test(d) && /required/i.test(d),
      title: 'P/NP Change Deadline', subtitle: 'Last drop without W grade (5 PM)',
      category: 'passnopass', url: 'https://reg.uci.edu/enrollment/grading/passnopass.html',
    },
    {
      match: (d) => /withdraw.*W grade|W grade assigned/i.test(d),
      title: 'Withdrawal Deadline', subtitle: 'W grade assigned (5 PM)',
      category: 'withdrawal', url: url,
    },
    {
      match: (d) => /instruction ends/i.test(d),
      title: 'Last Day of Instruction', category: 'instruction',
    },
    {
      match: (d) => /final exam/i.test(d),
      title: 'Finals Week', category: 'finals', url: url,
    },
    {
      match: (d) => /deadline.*submit.*final grades|grades available/i.test(d),
      title: 'Final Grades Due', subtitle: 'Grades available 10 PM', category: 'deadline',
    },
    {
      match: (d) => /veterans day/i.test(d),
      title: 'Veterans Day', subtitle: 'No classes', category: 'holiday', quarterIndex: 0, // Fall only
    },
    {
      match: (d) => /thanksgiving/i.test(d),
      title: 'Thanksgiving', subtitle: 'No classes', category: 'holiday', quarterIndex: 0,
    },
    {
      match: (d) => /martin luther king|mlk/i.test(d),
      title: 'MLK Day', subtitle: 'No classes', category: 'holiday', quarterIndex: 1,
    },
    {
      match: (d) => /president.{0,3}s.*day|presidents.*day/i.test(d),
      title: "Presidents' Day", subtitle: 'No classes', category: 'holiday', quarterIndex: 1,
    },
    {
      match: (d) => /memorial day/i.test(d),
      title: 'Memorial Day', subtitle: 'No classes', category: 'holiday', quarterIndex: 2,
    },
    {
      match: (d) => /commencement/i.test(d),
      title: 'Commencement', category: 'graduation', quarterIndex: 2,
    },
  ];

  const events = [];
  const seen = new Set();

  for (const row of tableRows) {
    const desc = row[0];
    for (const rule of rules) {
      if (!rule.match(desc)) continue;
      const colStart = rule.quarterIndex !== undefined ? rule.quarterIndex : 0;
      const colEnd   = rule.quarterIndex !== undefined ? rule.quarterIndex : 2;
      for (let qi = colStart; qi <= colEnd; qi++) {
        const rawDate = row[qi + 1]; // +1 because col 0 is description
        const parsed = parseDate(rawDate, quarters[qi].year);
        if (!parsed) continue;
        const key = `${quarters[qi].key}::${rule.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        events.push({
          id: `uci-${quarters[qi].key.toLowerCase().replace(/[^a-z0-9]/g, '')}-${rule.title.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
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
      break; // first matching rule wins
    }
  }

  return events;
}

// ─── Supabase upsert ─────────────────────────────────────────────────────────

async function upsertEvents(events) {
  if (!events.length) return 0;
  const rows = events.map((e) => ({
    id: e.id, school: e.school, quarter_key: e.quarterKey,
    title: e.title, subtitle: e.subtitle, date: e.date,
    end_date: e.endDate ?? null, category: e.category, url: e.url,
  }));
  const { error } = await supabase.from('academic_calendar').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  return rows.length;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { years } = parseArgs();
  console.log(`\nSeeding UCI academic calendar for academic years: ${years.join(', ')}\n`);

  let total = 0;
  const failures = [];

  for (const year of years) {
    try {
      console.log(`UCI ${year}-${year + 1}:`);
      const events = await scrapeUci(year);
      console.log(`  Parsed ${events.length} events:`);
      for (const e of events) {
        console.log(`    [${e.quarterKey}] ${e.title}: ${e.date}${e.endDate ? '–' + e.endDate : ''}`);
      }
      const n = await upsertEvents(events);
      console.log(`  ✓ Upserted ${n} rows\n`);
      total += n;
    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}\n`);
      failures.push(`${year}`);
    }
  }

  console.log(`Done. Total upserted: ${total}`);
  if (failures.length) {
    console.error(`Failed years: ${failures.join(', ')}`);
    process.exit(1);
  }
}

main();

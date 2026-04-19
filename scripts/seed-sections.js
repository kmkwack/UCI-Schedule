// ─────────────────────────────────────────────────────────────────────────────
// UCI Section Seeder
// Fetches all UCI course sections from Anteater API and stores them in Supabase.
//
// HOW TO RUN:
//   node scripts/seed-sections.js
//
// BEFORE RUNNING:
//   1. Go to your Supabase project → Settings → API
//   2. Copy "Project URL"  → paste into SUPABASE_URL below
//   3. Copy "service_role" secret key → paste into SUPABASE_SERVICE_KEY below
//      (use service_role, NOT anon — it bypasses row-level security for bulk insert)
// ─────────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL        = 'https://koiawtfuuevblrvlpuhe.supabase.co';   // ← replace
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvaWF3dGZ1dWV2YmxydmxwdWhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM5MjgyMSwiZXhwIjoyMDkxOTY4ODIxfQ.66VReYhiU9ssbT_yMmB_KoH_0qpmsUu5YrUn69His54';             // ← replace

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const QUARTERS = [
  { year: '2025', quarter: 'Winter' },
  { year: '2025', quarter: 'Spring' },
  { year: '2025', quarter: 'Fall' },
  { year: '2026', quarter: 'Winter' },
  { year: '2026', quarter: 'Spring' },
  { year: '2026', quarter: 'Fall' },
];

const UCI_DEPARTMENTS = [
  'AC ENG', 'AFAM', 'ANATOMY', 'ANESTH', 'ANTHRO', 'ARABIC', 'ARMN',
  'ART', 'ART HIS', 'ARTS', 'ARTSHUM', 'ASIANAM', 'ASL', 'BANA', 'BATS',
  'BIO SCI', 'BIOCHEM', 'BME', 'CAMPREC', 'CBE', 'CEM', 'CHEM', 'CHINESE',
  'CLASSIC', 'CLT&THY', 'COGS', 'COM LIT', 'COMPSCI', 'CRITISM', 'CRM/LAW',
  'CSE', 'DANCE', 'DATA', 'DERM', 'DEV BIO', 'DRAMA', 'EARTHSS', 'EAS',
  'ECO EVO', 'ECON', 'ECPS', 'ED AFF', 'EDUC', 'EECS', 'EHS', 'ENGLISH',
  'ENGR', 'ENGRCEE', 'ENGRMAE', 'ENGRMSE', 'EPIDEM', 'ER MED', 'EURO ST',
  'FAM MED', 'FILIPNO', 'FIN', 'FLM&MDA', 'FRENCH', 'GDIM', 'GEN&SEX',
  'GERMAN', 'GLBL ME', 'GLBLCLT', 'GREEK', 'HEBREW', 'HINDI', 'HISTORY',
  'HUMAN', 'HUMARTS', 'I&C SCI', 'IN4MATX', 'INNO', 'INT MED', 'INTL ST',
  'IRAN', 'ITALIAN', 'JAPANSE', 'KOREAN', 'LATIN', 'LAW', 'LIT JRN', 'LPS',
  'LSCI', 'M&MG', 'MATH', 'MED', 'MED ED', 'MED HUM', 'MGMT', 'MGMT EP',
  'MGMT FE', 'MGMT HC', 'MGMTMBA', 'MGMTPHD', 'MIC BIO', 'MNGE', 'MOL BIO',
  'MPAC', 'MSE', 'MUSIC', 'NET SYS', 'NEURBIO', 'NEUROL', 'NUR DNP',
  'NUR FNP', 'NUR INF', 'NUR SCI', 'OB/GYN', 'OPHTHAL', 'PATH', 'PED GEN',
  'PEDS', 'PERSIAN', 'PHARM', 'PHILOS', 'PHMD', 'PHRMSCI', 'PHY SCI',
  'PHYSICS', 'PHYSIO', 'PLASTIC', 'PM&R', 'POL SCI', 'PORTUG', 'PSCI',
  'PSMD', 'PSYCH', 'PUB POL', 'PUBHLTH', 'RADIO', 'REL STD', 'ROTC',
  'RUSSIAN', 'SOC SCI', 'SOCECOL', 'SOCIOL', 'SPANISH', 'SPPS', 'STATS',
  'SURGERY', 'SWE', 'TAGALOG', 'TOX', 'UCDC', 'UNI AFF', 'UNI STU',
  'UPPP', 'VIETMSE', 'VIS STD', 'WRITING',
];

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatTime(start, end) {
  if (!start || !end) return 'TBA';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(start.hour)}:${pad(start.minute)} - ${pad(end.hour)}:${pad(end.minute)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── fetch one department + quarter from Anteater API ────────────────────────

async function fetchDepartment(year, quarter, dept) {
  const url = `https://anteaterapi.com/v2/rest/websoc?department=${encodeURIComponent(dept)}&year=${year}&quarter=${quarter}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${dept} ${year} ${quarter}`);
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
            id:            section.sectionCode,
            quarter_key:   qKey,
            department:    d.deptCode,
            code,
            title:         course.courseTitle ?? '',
            section_label: `${section.sectionType} ${section.sectionNum}`,
            professor:     section.instructors?.[0] ?? '',
            days,
            time,
            location:      meeting?.bldg?.[0] ?? null,
            units:         parseInt(section.units) || null,
          });
        }
      }
    }
  }

  return rows;
}

// ─── upsert a batch into Supabase ────────────────────────────────────────────

async function upsertRows(rows) {
  // Upsert in chunks of 500 to stay within Supabase request size limits
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from('sections')
      .upsert(chunk, { onConflict: 'id' });
    if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
  }
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Starting seed: ${QUARTERS.length} quarters × ${UCI_DEPARTMENTS.length} departments\n`);

  let totalSections = 0;
  let totalErrors   = 0;

  for (const { year, quarter } of QUARTERS) {
    console.log(`── ${quarter} ${year} ──────────────────────────`);

    for (const dept of UCI_DEPARTMENTS) {
      try {
        const rows = await fetchDepartment(year, quarter, dept);
        if (rows.length > 0) {
          await upsertRows(rows);
          console.log(`  ✓ ${dept.padEnd(12)} ${rows.length} sections`);
          totalSections += rows.length;
        }
        // Small delay between requests so we don't hammer the API
        await sleep(400);
      } catch (err) {
        console.error(`  ✗ ${dept.padEnd(12)} ${err.message}`);
        totalErrors++;
        await sleep(1000); // longer pause after an error
      }
    }

    console.log('');
  }

  console.log('─────────────────────────────────────────');
  console.log(`Done! ${totalSections.toLocaleString()} sections inserted.`);
  if (totalErrors > 0) console.log(`     ${totalErrors} departments had errors (re-run to retry).`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

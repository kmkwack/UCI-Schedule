// ─────────────────────────────────────────────────────────────────────────────
// UIUC failed-subject retry runner
//
// Re-runs only the UIUC year/term/subject combinations that failed during the
// 2019-2026 backfill. Keep this list tight so retries do not touch already
// seeded departments.
//
// HOW TO RUN:
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/retry-uiuc-failed-subjects.js
//   UIUC_FETCH_RETRIES=2 UIUC_RETRY_DELAY_MS=60000 node scripts/retry-uiuc-failed-subjects.js
//   DRY_RUN=1 node scripts/retry-uiuc-failed-subjects.js
// ─────────────────────────────────────────────────────────────────────────────

const { spawnSync } = require('child_process');
const path = require('path');

const FAILED_UIUC_SUBJECTS = [
  {
    term: 'Spring',
    year: 2021,
    subjects: ['ENGL'],
  },
  {
    term: 'Fall',
    year: 2022,
    subjects: ['NPRE'],
  },
  {
    term: 'Fall',
    year: 2026,
    subjects: [
      'CI',
      'CIC',
      'CLCV',
      'CLE',
      'CMN',
      'CPSC',
      'CS',
      'CSE',
      'CW',
      'CWL',
      'CZCH',
      'DANC',
      'DTX',
      'EALC',
      'ECE',
      'ECON',
      'EDPR',
      'EDUC',
      'EIL',
      'ENG',
      'ENGL',
      'ENSU',
      'ENVS',
      'EPOL',
      'EPSY',
      'ERAM',
      'ES',
      'ESE',
      'ESL',
      'ETMA',
      'EURO',
      'EXP',
      'FAA',
      'FIN',
      'FR',
      'FSHN',
      'MCB',
      'MSE',
    ],
  },
];

function runUiucSeeder({ term, year, subjects }) {
  const scriptPath = path.join(__dirname, 'seed-uiuc-sections.js');
  const args = [scriptPath, term, String(year), subjects.join(',')];
  console.log('\n────────────────────────────────────────');
  console.log(`Retrying UIUC ${term} ${year}: ${subjects.join(',')}`);
  console.log('────────────────────────────────────────');

  const result = spawnSync(process.execPath, args, {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      UIUC_FETCH_RETRIES: process.env.UIUC_FETCH_RETRIES ?? '2',
      UIUC_TRANSIENT_RETRY_DELAY_MS: process.env.UIUC_TRANSIENT_RETRY_DELAY_MS ?? '10000',
      UIUC_RETRY_DELAY_MS: process.env.UIUC_RETRY_DELAY_MS ?? '60000',
    },
    stdio: 'inherit',
  });

  return result.status ?? 1;
}

function printHelp() {
  console.log(`Usage:
  node scripts/retry-uiuc-failed-subjects.js
  npm run retry:uiuc-failed

Retries only these known failed UIUC groups:
  - Spring 2021: ENGL
  - Fall 2022: NPRE
  - Fall 2026: CI,CIC,CLCV,CLE,CMN,CPSC,CS,CSE,CW,CWL,CZCH,DANC,DTX,EALC,ECE,ECON,EDPR,EDUC,EIL,ENG,ENGL,ENSU,ENVS,EPOL,EPSY,ERAM,ES,ESE,ESL,ETMA,EURO,EXP,FAA,FIN,FR,FSHN,MCB,MSE

Environment:
  SUPABASE_URL=... SUPABASE_SERVICE_KEY=...   Required unless DRY_RUN=1.
  SUPABASE_SERVICE_ROLE_KEY=...               Also accepted in place of SUPABASE_SERVICE_KEY.
  UIUC_FETCH_RETRIES=2                       Defaults to 2 for retry runs.
  UIUC_TRANSIENT_RETRY_DELAY_MS=10000        Defaults to 10 seconds.
  UIUC_RETRY_DELAY_MS=60000                  Defaults to 60 seconds.
  DRY_RUN=1                                  Fetches and prints samples without upserting.
`);
}

function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    return;
  }

  const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.DRY_RUN !== '1' && (!process.env.SUPABASE_URL || !serviceKey)) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY. Put both before the retry command in the same terminal command.');
  }

  const failures = [];
  for (const item of FAILED_UIUC_SUBJECTS) {
    const status = runUiucSeeder(item);
    if (status !== 0) {
      failures.push(`${item.term} ${item.year}: ${item.subjects.join(',')}`);
    }
  }

  if (failures.length > 0) {
    console.error(`\nRetry finished with ${failures.length} failed group(s):`);
    failures.forEach((failure) => console.error(`  - ${failure}`));
    process.exit(1);
  }

  console.log('\nUIUC failed-subject retry complete.');
}

main();

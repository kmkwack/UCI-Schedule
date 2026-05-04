// ─────────────────────────────────────────────────────────────────────────────
// Multi-school section backfill runner
//
// Runs the existing single-term seeders across multiple schools, years, and
// academic terms. This script does not fetch sections itself; it delegates to
// the school-specific seeders so normalization stays in one place.
//
// Examples:
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/backfill-school-sections.js
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/backfill-school-sections.js --from-year 2019 --to-year 2026
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/backfill-school-sections.js --schools cornell,purdue,uiuc --terms Spring,Fall
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/backfill-school-sections.js --schools uiuc --skip-terms uiuc:Spring:2019
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/backfill-school-sections.js --only-terms umd:Fall:2025,umd:Fall:2026
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/backfill-school-sections.js --only-subjects "umd:Fall:2025:EPIB+EXST;cornell:Spring:2019:FDSC"
//   DRY_RUN=1 node scripts/backfill-school-sections.js --schools umd --from-year 2025 --to-year 2026
// ─────────────────────────────────────────────────────────────────────────────

const { spawnSync } = require('child_process');
const path = require('path');

const CURRENT_YEAR = new Date().getFullYear();

const SCHOOL_SEEDERS = {
  umd: {
    label: 'University of Maryland, College Park',
    script: 'seed-umd-sections.js',
    terms: ['Spring', 'Summer', 'Fall'],
  },
  cornell: {
    label: 'Cornell University',
    script: 'seed-cornell-sections.js',
    terms: ['Spring', 'Summer', 'Fall'],
  },
  purdue: {
    label: 'Purdue University',
    script: 'seed-purdue-sections.js',
    terms: ['Spring', 'Summer', 'Fall'],
  },
  uiuc: {
    label: 'University of Illinois Urbana-Champaign',
    script: 'seed-uiuc-sections.js',
    terms: ['Spring', 'Summer', 'Fall'],
  },
};

function parseArgs(argv) {
  const options = {
    schools: Object.keys(SCHOOL_SEEDERS),
    terms: null,
    fromYear: 2019,
    toYear: CURRENT_YEAR,
    onlyTerms: new Set(),
    onlySubjects: new Map(),
    skipTerms: new Set(),
    continueOnError: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === '--schools' && next) {
      options.schools = next.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
      i += 1;
    } else if (arg === '--terms' && next) {
      options.terms = next.split(',').map((item) => item.trim()).filter(Boolean);
      i += 1;
    } else if (arg === '--from-year' && next) {
      options.fromYear = Number(next);
      i += 1;
    } else if (arg === '--to-year' && next) {
      options.toYear = Number(next);
      i += 1;
    } else if (arg === '--skip-terms' && next) {
      next.split(',').map((item) => item.trim()).filter(Boolean).forEach((item) => {
        options.skipTerms.add(parseSkipTerm(item));
      });
      i += 1;
    } else if (arg === '--only-terms' && next) {
      next.split(',').map((item) => item.trim()).filter(Boolean).forEach((item) => {
        options.onlyTerms.add(parseSkipTerm(item));
      });
      i += 1;
    } else if (arg === '--only-subjects' && next) {
      next.split(';').map((item) => item.trim()).filter(Boolean).forEach((item) => {
        const { key, subjects } = parseOnlySubjectsTerm(item);
        const existing = options.onlySubjects.get(key) ?? [];
        options.onlySubjects.set(key, [...new Set([...existing, ...subjects])]);
      });
      i += 1;
    } else if (arg === '--stop-on-error') {
      options.continueOnError = false;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument "${arg}". Run with --help for usage.`);
    }
  }

  if (!Number.isInteger(options.fromYear) || !Number.isInteger(options.toYear)) {
    throw new Error('--from-year and --to-year must be whole years.');
  }
  if (options.fromYear > options.toYear) {
    throw new Error('--from-year must be less than or equal to --to-year.');
  }

  const unknownSchools = options.schools.filter((school) => !SCHOOL_SEEDERS[school]);
  if (unknownSchools.length > 0) {
    throw new Error(`Unknown school(s): ${unknownSchools.join(', ')}. Use: ${Object.keys(SCHOOL_SEEDERS).join(', ')}`);
  }

  const exactTermKeys = new Set([...options.onlyTerms, ...options.onlySubjects.keys()]);
  if (exactTermKeys.size > 0) {
    const exactTerms = [...exactTermKeys].map(parseSkipTermKey);
    const exactSchools = [...new Set(exactTerms.map((item) => item.school))];
    const unknownExactSchools = exactSchools.filter((school) => !SCHOOL_SEEDERS[school]);
    if (unknownExactSchools.length > 0) {
      throw new Error(`Unknown school(s) in exact-term options: ${unknownExactSchools.join(', ')}. Use: ${Object.keys(SCHOOL_SEEDERS).join(', ')}`);
    }
    options.schools = exactSchools;
    options.fromYear = Math.min(...exactTerms.map((item) => Number(item.year)));
    options.toYear = Math.max(...exactTerms.map((item) => Number(item.year)));
  }

  return options;
}

function parseSkipTerm(value) {
  const [school, term, year] = value.split(':').map((part) => part.trim());
  if (!school || !term || !year) {
    throw new Error(`Invalid --skip-terms value "${value}". Use school:Term:Year, for example uiuc:Spring:2019.`);
  }
  return skipTermKey(school, term, year);
}

function parseOnlySubjectsTerm(value) {
  const [school, term, year, subjectText] = value.split(':').map((part) => part.trim());
  const subjects = String(subjectText ?? '')
    .split(/[+,]/)
    .map((subject) => subject.trim().toUpperCase())
    .filter(Boolean);

  if (!school || !term || !year || subjects.length === 0) {
    throw new Error(`Invalid --only-subjects value "${value}". Use school:Term:Year:SUBJ+SUBJ, for example umd:Fall:2025:EPIB+EXST.`);
  }

  return {
    key: skipTermKey(school, term, year),
    subjects,
  };
}

function skipTermKey(schoolKey, term, year) {
  return `${String(schoolKey).toLowerCase()}:${String(term).toLowerCase()}:${String(year)}`;
}

function parseSkipTermKey(key) {
  const [school, term, year] = key.split(':');
  return { school, term, year };
}

function printHelp() {
  console.log(`Usage:
  node scripts/backfill-school-sections.js [options]

Options:
  --schools umd,cornell,purdue,uiuc   Schools to seed. Defaults to all.
  --terms Spring,Summer,Fall     Terms to seed. Defaults to each school's standard terms.
  --from-year 2019               First catalog year. Defaults to 2019.
  --to-year 2026                 Last catalog year. Defaults to current year.
  --skip-terms uiuc:Spring:2019  Comma-separated school:Term:Year entries to skip.
  --only-terms umd:Fall:2025     Run only exact school:Term:Year entries.
  --only-subjects "umd:Fall:2025:EPIB+EXST;cornell:Spring:2019:FDSC"
                                  Run only exact subjects/departments for exact terms.
  --stop-on-error                Stop after the first failed school/term.
  --help                         Show this help.
`);
}

function runSeeder(scriptName, term, year, subjects) {
  const scriptPath = path.join(__dirname, scriptName);
  const args = [scriptPath, term, String(year)];
  if (subjects?.length) args.push(subjects.join(','));

  const result = spawnSync(process.execPath, args, {
    cwd: path.join(__dirname, '..'),
    env: process.env,
    stdio: 'inherit',
  });

  return result.status ?? 1;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (process.env.DRY_RUN !== '1' && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY)) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. Put both before the backfill command in the same terminal command.');
  }

  const years = [];
  for (let year = options.fromYear; year <= options.toYear; year += 1) years.push(year);

  const failures = [];
  console.log(`Backfilling sections for ${options.schools.join(', ')} (${options.fromYear}-${options.toYear})`);
  const exactTermKeys = new Set([...options.onlyTerms, ...options.onlySubjects.keys()]);

  for (const schoolKey of options.schools) {
    const school = SCHOOL_SEEDERS[schoolKey];
    const terms = options.terms ?? school.terms;

    for (const year of years) {
      for (const term of terms) {
        const exactKey = skipTermKey(schoolKey, term, year);
        if (exactTermKeys.size > 0 && !exactTermKeys.has(exactKey)) {
          continue;
        }

        if (options.skipTerms.has(skipTermKey(schoolKey, term, year))) {
          console.log(`\nSkipping ${school.label}: ${term} ${year}`);
          continue;
        }

        console.log(`\n────────────────────────────────────────`);
        const subjects = options.onlySubjects.get(exactKey) ?? null;
        console.log(`${school.label}: ${term} ${year}${subjects ? ` (${subjects.join(',')})` : ''}`);
        console.log(`────────────────────────────────────────`);

        const status = runSeeder(school.script, term, year, subjects);
        if (status !== 0) {
          const label = `${schoolKey} ${term} ${year}${subjects ? ` ${subjects.join(',')}` : ''}`;
          failures.push(label);
          console.error(`Failed: ${label}`);
          if (!options.continueOnError) {
            process.exit(status);
          }
        }
      }
    }
  }

  if (failures.length > 0) {
    console.error(`\nBackfill finished with ${failures.length} failed term(s):`);
    failures.forEach((failure) => console.error(`  - ${failure}`));
    process.exit(1);
  }

  console.log('\nBackfill complete.');
}

main();

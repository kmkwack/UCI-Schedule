// Reports section locations that do not resolve to an in-app campus map preview.
//
// Usage:
//   node scripts/report-unmapped-classrooms.js
//   node scripts/report-unmapped-classrooms.js --school "UC Irvine" --limit 100
//   node scripts/report-unmapped-classrooms.js --group-buildings --limit 40
//   node scripts/report-unmapped-classrooms.js --csv /tmp/unmapped-classrooms.csv

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createClient } = require('@supabase/supabase-js');

const DEFAULT_SUPABASE_URL = 'https://koiawtfuuevblrvlpuhe.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_JnbSRv8Y1Ue_BAp5q9EWMA_YjZmAwcZ';

const SUPABASE_URL = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_ANON_KEY;

const PAGE_SIZE = 1000;

function parseArgs(argv) {
  const args = {
    school: null,
    limit: 50,
    minCount: 1,
    csv: null,
    groupBuildings: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--school' && next) {
      args.school = next;
      i += 1;
    } else if (token === '--limit' && next) {
      args.limit = Number(next);
      i += 1;
    } else if (token === '--min-count' && next) {
      args.minCount = Number(next);
      i += 1;
    } else if (token === '--csv' && next) {
      args.csv = next;
      i += 1;
    } else if (token === '--group-buildings') {
      args.groupBuildings = true;
    } else if (token === '--help' || token === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  if (!Number.isFinite(args.limit) || args.limit < 0) args.limit = 50;
  if (!Number.isFinite(args.minCount) || args.minCount < 1) args.minCount = 1;
  return args;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/report-unmapped-classrooms.js [options]

Options:
  --school "UC Irvine"        Only report one school.
  --limit 50                  Max rows to print per school. Use 0 for all.
  --min-count 2               Hide locations appearing fewer than this count.
  --group-buildings           Collapse rooms into building-level candidates.
  --csv /tmp/report.csv       Also write the full report as CSV.

Environment:
  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... can be provided for privileged reads.
`);
}

function loadClassroomLocations() {
  const sourcePath = path.join(__dirname, '..', 'src', 'data', 'campusLocations.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const match = source.match(/const CLASSROOM_LOCATIONS[\s\S]*?=\s*([\s\S]*?);\n\nconst SPORTS_VENUES/);

  if (!match) {
    throw new Error('Could not find CLASSROOM_LOCATIONS in src/data/campusLocations.ts');
  }

  return vm.runInNewContext(`(${match[1]})`, {}, { timeout: 1000 });
}

function normalize(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

function isUnmappableLocation(rawLocation) {
  const normalized = String(rawLocation ?? '').trim().toLowerCase();
  return (
    !normalized ||
    normalized === 'tba' ||
    normalized === 'tba tba' ||
    normalized === 'away' ||
    normalized === 'arr' ||
    normalized === 'n/a' ||
    normalized === 'no' ||
    normalized === 'none' ||
    normalized === 'null' ||
    normalized === 'main' ||
    normalized === 'na' ||
    normalized === 'health sciences' ||
    normalized === 'atlanta' ||
    normalized === 'arrngd' ||
    normalized === 'japan' ||
    normalized === 'rome' ||
    normalized === 'online' ||
    normalized === 'on line' ||
    normalized === 'bos' ||
    normalized === 'boston' ||
    normalized === 'riverside' ||
    normalized.startsWith('nappl') ||
    normalized.startsWith('arrngd') ||
    normalized.startsWith('japan ') ||
    normalized.startsWith('bos ') ||
    normalized.startsWith('boston ') ||
    normalized.startsWith('no ') ||
    normalized.includes('online') ||
    normalized.includes('remote') ||
    normalized.includes('to be assigned') ||
    normalized.includes('location pending') ||
    normalized.includes('main campus') ||
    normalized.includes('offcmp') ||
    normalized.includes('off-campus') ||
    normalized.includes('off campus')
  );
}

function stripRoomSuffix(value) {
  return String(value ?? '').replace(/\s+\d+[A-Z]?\s*$/i, '').trim();
}

function stripLeadingRoomPrefix(value) {
  return String(value ?? '')
    .replace(/^(arr|null|none|n\/a)\s+/i, '')
    .replace(/^\d+[A-Z]?\s+/i, '')
    .trim();
}

function titleCaseBuilding(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b([A-Z])([A-Z']+)\b/g, (word) => {
      if (word.length <= 4 && word === word.toUpperCase()) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
}

function extractBuildingCandidate(school, rawLocation) {
  const location = String(rawLocation ?? '').trim();
  const withoutRoom = stripLeadingRoomPrefix(stripRoomSuffix(location));
  const normalized = normalize(withoutRoom);
  const firstToken = normalized.split(/\s+/).filter(Boolean)[0] ?? '';

  if (!withoutRoom || !firstToken) return { key: location, label: location };

  if (
    school === 'UC Irvine' ||
    school === 'Purdue University' ||
    school === 'University of Maryland, College Park'
  ) {
    return { key: firstToken, label: firstToken };
  }

  if (school === 'Cornell University') {
    const hallMatch = withoutRoom.match(/^(.+?\b(?:Hall|Library|Center|Laboratory|Lab|Building|Bldg|House|Gym|Field|Rink|Auditorium|Theatre|Theater))\b/i);
    const label = hallMatch?.[1] ?? withoutRoom;
    return { key: normalize(label), label: titleCaseBuilding(label) };
  }

  if (school === 'University of Illinois Urbana-Champaign') {
    const label = withoutRoom || location;
    return { key: normalize(label), label: titleCaseBuilding(label) };
  }

  return { key: firstToken, label: firstToken };
}

function getCampusMapLocation(classroomLocations, school, rawLocation) {
  if (isUnmappableLocation(rawLocation)) return null;

  const schoolLocations = classroomLocations[school] ?? [];
  const normalized = normalize(rawLocation);
  const firstToken = normalized.split(/\s+/).filter(Boolean)[0] ?? '';
  const compact = normalized.replace(/\s+/g, '');
  const noRoom = normalize(stripRoomSuffix(rawLocation));

  for (const location of schoolLocations) {
    const aliases = [location.code, location.name, ...(location.aliases ?? [])].map(normalize);
    const matched = aliases.some((alias) => (
      firstToken === alias ||
      normalized === alias ||
      noRoom === alias ||
      compact.startsWith(alias.replace(/\s+/g, '')) ||
      normalized.includes(alias)
    ));

    if (matched) return location;
  }

  return null;
}

function upsertAggregate(map, row, groupBuildings) {
  const school = row.school || 'UC Irvine';
  const location = String(row.location ?? '').trim();
  const candidate = groupBuildings
    ? extractBuildingCandidate(school, location)
    : { key: location, label: location };
  const key = `${school}\u0000${candidate.key}`;
  const existing = map.get(key) ?? {
    school,
    location: candidate.label,
    count: 0,
    examples: new Set(),
    rawLocations: new Set(),
    terms: new Set(),
  };

  existing.count += 1;
  if (existing.rawLocations.size < 8) existing.rawLocations.add(location);
  if (existing.examples.size < 6 && row.code) {
    existing.examples.add(`${row.code}${row.quarter_key ? ` (${row.quarter_key})` : ''}`);
  }
  if (row.quarter_key) existing.terms.add(row.quarter_key);
  map.set(key, existing);
}

async function fetchSeededTerms(supabase, school) {
  let query = supabase
    .from('school_terms')
    .select('school, quarter_key, section_count')
    .gt('section_count', 0);

  if (school) query = query.eq('school', school);

  const { data, error } = await query;
  if (error) throw error;

  const seen = new Set();
  return (data ?? [])
    .filter((row) => row.school && row.quarter_key)
    .filter((row) => {
      const key = `${row.school}\u0000${row.quarter_key}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function fetchSectionPage(supabase, from, to, term) {
  let query = supabase
    .from('sections')
    .select('school, location, code, quarter_key')
    .range(from, to);

  if (term?.school) query = query.eq('school', term.school);
  if (term?.quarter_key) query = query.eq('quarter_key', term.quarter_key);
  return query;
}

function toSortedRows(unmapped, minCount) {
  return [...unmapped.values()]
    .filter((item) => item.count >= minCount)
    .sort((a, b) => (
      a.school.localeCompare(b.school) ||
      b.count - a.count ||
      a.location.localeCompare(b.location)
    ));
}

function printReport(rows, stats, limit) {
  console.log(`Scanned ${stats.total.toLocaleString()} section rows with locations.`);
  console.log(`Mapped: ${stats.mapped.toLocaleString()} | Unmapped: ${stats.unmapped.toLocaleString()} | Skipped TBA/online/remote: ${stats.skipped.toLocaleString()}`);

  const bySchool = new Map();
  for (const row of rows) {
    if (!bySchool.has(row.school)) bySchool.set(row.school, []);
    bySchool.get(row.school).push(row);
  }

  for (const [school, schoolRows] of bySchool.entries()) {
    const total = schoolRows.reduce((sum, row) => sum + row.count, 0);
    const visible = limit === 0 ? schoolRows : schoolRows.slice(0, limit);
    console.log(`\n${school} — ${schoolRows.length.toLocaleString()} unmapped ${schoolRows.some((row) => row.rawLocations?.size > 1) ? 'building candidates' : 'location strings'}, ${total.toLocaleString()} sections`);

    for (const row of visible) {
      const examples = [...row.examples].join('; ');
      console.log(`  ${String(row.count).padStart(5)}  ${row.location}${examples ? `  |  ${examples}` : ''}`);
      if (row.rawLocations?.size > 1) {
        console.log(`         rooms: ${[...row.rawLocations].join(', ')}`);
      }
    }

    if (visible.length < schoolRows.length) {
      console.log(`  ... ${schoolRows.length - visible.length} more. Re-run with --limit 0 to print all.`);
    }
  }
}

function writeCsv(rows, csvPath) {
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = [
    ['school', 'location_or_building', 'count', 'terms', 'raw_locations', 'examples'].map(escape).join(','),
    ...rows.map((row) => [
      row.school,
      row.location,
      row.count,
      [...row.terms].join('; '),
      row.rawLocations ? [...row.rawLocations].join('; ') : '',
      [...row.examples].join('; '),
    ].map(escape).join(',')),
  ];
  fs.writeFileSync(csvPath, `${lines.join('\n')}\n`);
  console.log(`\nCSV written to ${csvPath}`);
}

async function main() {
  const args = parseArgs(process.argv);
  const classroomLocations = loadClassroomLocations();
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const unmapped = new Map();
  const stats = { total: 0, mapped: 0, unmapped: 0, skipped: 0 };
  const terms = await fetchSeededTerms(supabase, args.school);

  if (terms.length === 0) {
    throw new Error(args.school ? `No seeded terms found for ${args.school}.` : 'No seeded terms found.');
  }

  console.log(`Scanning ${terms.length.toLocaleString()} seeded school terms...`);

  for (const term of terms) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await fetchSectionPage(supabase, from, to, term);

      if (error) throw error;
      if (!data || data.length === 0) break;

      for (const row of data) {
        stats.total += 1;
        if (isUnmappableLocation(row.location)) {
          stats.skipped += 1;
          continue;
        }

        const school = row.school || 'UC Irvine';
        if (getCampusMapLocation(classroomLocations, school, row.location)) {
          stats.mapped += 1;
        } else {
          stats.unmapped += 1;
          upsertAggregate(unmapped, row, args.groupBuildings);
        }
      }

      if (data.length < PAGE_SIZE) break;
    }
  }

  const rows = toSortedRows(unmapped, args.minCount);
  printReport(rows, stats, args.limit);
  if (args.csv) writeCsv(rows, args.csv);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

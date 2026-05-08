// Static parity checks for every supported school.
//
// This catches the "added a school but forgot one of the repeated app hooks"
// class of regressions before they reach the app.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

const files = {
  schools: read('src/data/schools.ts'),
  departments: read('src/data/schoolDepartments.ts'),
  logos: read('src/components/UniversityLogo.tsx'),
  dining: read('src/data/diningMenus.ts'),
  home: read('src/screens/HomeScreen.tsx'),
  settings: read('src/screens/SettingsScreen.tsx'),
  coursePicker: read('src/screens/CoursePickerScreen.tsx'),
  backfill: read('scripts/backfill-school-sections.js'),
  reconcile: read('scripts/reconcile-school-terms.js'),
  bannerSeeder: read('scripts/seed-banner-sections.js'),
  campusLocations: read('src/data/campusLocations.ts'),
};

function parseSchoolConfigs() {
  const schools = [];
  const blockPattern = /\n  '([^']+)': \{([\s\S]*?)\n  \},/g;
  let match;
  while ((match = blockPattern.exec(files.schools))) {
    const [, name, block] = match;
    const id = block.match(/\bid: '([^']+)'/)?.[1];
    const sportsEnabled = /features:\s*\{[\s\S]*?sports:\s*true[\s\S]*?\}/.test(block);
    if (id) schools.push({ id, name, block, sportsEnabled });
  }
  return schools;
}

function parseObjectKeys(text, objectName) {
  const start = text.indexOf(`const ${objectName}`);
  if (start === -1) return new Set();
  const end = text.indexOf('};', start);
  if (end === -1) return new Set();
  const body = text.slice(start, end);
  return new Set([...body.matchAll(/\n\s{2}([a-z0-9_]+):\s*\{/g)].map((match) => match[1]));
}

function parseLogoMap() {
  const logos = new Map();
  for (const match of files.logos.matchAll(/\n\s{2}([a-z0-9_]+):\s*require\('([^']+)'\)/g)) {
    const assetPath = match[2].replace('../../', '');
    logos.set(match[1], assetPath);
  }
  return logos;
}

const schools = parseSchoolConfigs();
const logos = parseLogoMap();
const pickerBannerIds = parseObjectKeys(files.coursePicker, 'BANNER_FALLBACKS');
const seederBannerIds = parseObjectKeys(files.bannerSeeder, 'BANNER_SCHOOLS');
const failures = [];
const warnings = [];

function requireCheck(condition, message) {
  if (!condition) failures.push(message);
}

function warnCheck(condition, message) {
  if (!condition) warnings.push(message);
}

for (const school of schools) {
  const { id, name, block, sportsEnabled } = school;
  const logoAsset = logos.get(id);
  const domain = block.match(/\bdomain: '([^']+)'/)?.[1];
  const terms = block.match(/\bterms: \[([^\]]+)\]/)?.[1];

  requireCheck(domain?.startsWith('@'), `${name}: missing or invalid email domain`);
  requireCheck(Boolean(terms?.trim()), `${name}: missing supported term list`);
  requireCheck(block.includes('gradeScale:'), `${name}: missing grade scale config`);
  requireCheck(files.departments.includes(`  ${id}:`), `${name}: missing local department fallback in src/data/schoolDepartments.ts`);
  if (logoAsset) {
    requireCheck(exists(logoAsset), `${name}: logo asset does not exist (${logoAsset})`);
  } else {
    warnCheck(false, `${name}: no UniversityLogo asset mapping; app will use initials fallback`);
  }
  if (files.dining.includes(`'${name}'`)) {
    requireCheck(
      files.dining.includes(`school === '${name}'`) || files.dining.includes(`const external = EXTERNAL_DINING_MENU_CONFIGS[school]`),
      `${name}: missing fetchDiningMenusForSchool branch`
    );
  } else {
    warnCheck(false, `${name}: dining menus are not explicitly supported`);
  }
  warnCheck(
    files.home.includes(`  '${name}': [`) || files.home.includes(`  '${name}': createStandardCampusInfoResources`),
    `${name}: no campus info resource block; app will use search-link fallback`
  );
  requireCheck(files.reconcile.includes(`alias: '${id}'`), `${name}: missing reconcile-school-terms config`);
  if (id !== 'uci') {
    requireCheck(files.backfill.includes(`  ${id}: {`), `${name}: missing backfill-school-sections seeder config`);
  }
  if (sportsEnabled) {
    requireCheck(block.includes('sportsFeed:'), `${name}: sports enabled without sportsFeed config`);
  }

  const hasPickerBanner = pickerBannerIds.has(id);
  const hasSeederBanner = seederBannerIds.has(id);
  requireCheck(hasPickerBanner === hasSeederBanner, `${name}: Banner live fallback and Banner seeder configs are out of sync`);
  warnCheck(files.campusLocations.includes(`  '${name}': [`), `${name}: no detailed classroom/sports venue map list; app will fall back to map search`);
}

requireCheck(
  files.settings.includes('SUPPORTED_UNIVERSITIES.length'),
  'Settings Help Center should describe supported schools from SUPPORTED_UNIVERSITIES instead of a stale hardcoded list'
);
requireCheck(
  !files.settings.includes('starting with UC Irvine, University of Maryland, Cornell University, Purdue University, and University of Illinois Urbana-Champaign'),
  'Settings Help Center still contains the old five-school expansion copy'
);
requireCheck(
  !files.dining.includes('https://dining.gatech.edu/locations-hours'),
  'Georgia Tech dining still points at the old 404 locations-hours URL'
);
requireCheck(
  !files.dining.includes('https://denison.cafebonappetit.com/'),
  'Denison dining still points at the old 410 Bon Appetit URL'
);
requireCheck(
  !files.dining.includes('https://ung.sodexomyway.com/'),
  'UNG dining still points at the old unresolved Sodexo URL'
);
requireCheck(
  !files.dining.includes('https://alfredstate.sodexomyway.com/'),
  'Alfred State dining still points at the old unresolved Sodexo URL'
);
requireCheck(
  !files.dining.includes('https://www.canisius.edu/student-experience/student-life/dining-services'),
  'Canisius dining still points at the old 404 dining-services URL'
);
requireCheck(
  !files.dining.includes('https://www.genesee.edu/student-life/dining/'),
  'Genesee dining still points at the old 404 student-life dining URL'
);
requireCheck(
  !files.dining.includes('https://auxiliaryservices.lehigh.edu/dining'),
  'Lehigh dining still points at the old 404 auxiliary services URL'
);
requireCheck(
  !files.home.includes("athleticsUrl: 'https://ramblinwreck.com/sports/',"),
  'Georgia Tech athletics Campus Info still points at /sports/, which redirects to the wrong page'
);
requireCheck(
  !files.home.includes("transitUrl: 'https://pts.gatech.edu/transportation',"),
  'Georgia Tech transit Campus Info still points at the old 404 transportation URL'
);
requireCheck(
  !files.home.includes("transitUrl: 'https://www.shsu.edu/dept/public-safety/parking/transportation',"),
  'Sam Houston transit Campus Info still points at the old 404 public safety path'
);
requireCheck(
  !files.home.includes("transitUrl: 'https://denison.edu/campus/safety/transportation',"),
  'Denison transit Campus Info still points at the old 404 safety transportation URL'
);
requireCheck(
  !files.home.includes("clubsUrl: 'https://denison.edu/campus/get-involved/organizations',"),
  'Denison clubs Campus Info still points at the old 404 organizations URL'
);
requireCheck(
  !files.home.includes("clubsUrl: 'https://uncg.campuslabs.com/engage/organizations',"),
  'UNCG clubs Campus Info still points at the old 404 Campus Labs URL'
);
requireCheck(
  !files.home.includes("studyRoomsUrl: 'https://www.eiu.edu/booth/reserve.php',"),
  'EIU study rooms Campus Info still points at the old 404 reserve.php URL'
);
requireCheck(
  !files.home.includes("transitUrl: 'https://www.eiu.edu/police/parking.php',"),
  'EIU transit Campus Info still points at the old 300 parking.php URL'
);
requireCheck(
  !files.home.includes("clubsUrl: 'https://eiu.campuslabs.com/engage/organizations',"),
  'EIU clubs Campus Info still points at the old 404 Campus Labs URL'
);
requireCheck(
  !files.home.includes("libraryUrl: 'https://www.alfredstate.edu/library',"),
  'Alfred State library Campus Info still points at the old 404 library URL'
);
requireCheck(
  !files.home.includes("transitUrl: 'https://www.alfredstate.edu/parking-and-transportation',"),
  'Alfred State transit Campus Info still points at the old 404 parking URL'
);
requireCheck(
  !files.home.includes("transitUrl: 'https://www.canisius.edu/student-experience/student-life/public-safety/parking-transportation',"),
  'Canisius transit Campus Info still points at the old 404 parking URL'
);
requireCheck(
  !files.home.includes("clubsUrl: 'https://canisius.campuslabs.com/engage/organizations',"),
  'Canisius clubs Campus Info still points at the old 404 Campus Labs URL'
);
requireCheck(
  !files.home.includes("transitUrl: 'https://www.genesee.edu/student-life/transportation/',"),
  'Genesee transit Campus Info still points at the old 404 transportation URL'
);
requireCheck(
  !files.home.includes("clubsUrl: 'https://www.genesee.edu/student-life/clubs-organizations/',"),
  'Genesee clubs Campus Info still points at the old 404 clubs URL'
);
requireCheck(
  !files.home.includes("studyRoomsUrl: 'https://uvu.libcal.com/spaces',"),
  'UVU study rooms Campus Info still points at the old 404 LibCal URL'
);
requireCheck(
  !files.home.includes("clubsUrl: 'https://uvu.campuslabs.com/engage/organizations',"),
  'UVU clubs Campus Info still points at the old 404 Campus Labs URL'
);
requireCheck(
  !files.home.includes("studyRoomsUrl: 'https://lehigh.libcal.com/',"),
  'Lehigh study rooms Campus Info still points at the old 404 LibCal URL'
);
requireCheck(
  !files.home.includes("transitUrl: 'https://financeadmin.lehigh.edu/content/transportation-and-parking-services',"),
  'Lehigh transit Campus Info still points at the old 404 finance admin URL'
);
requireCheck(
  !files.home.includes("transitUrl: 'https://www.rider.edu/student-life/housing-dining/transportation',"),
  'Rider transit Campus Info still points at the old 404 housing-dining URL'
);
requireCheck(
  !files.home.includes("libraryUrl: 'https://wheatoncollege.edu/academics/library/',"),
  'Wheaton library Campus Info still points at the old curl-blocked library redirect'
);
requireCheck(
  !files.home.includes("transitUrl: 'https://wheatoncollege.edu/campus-life/campus-safety/parking-transportation/',"),
  'Wheaton transit Campus Info still points at the old 404 parking transportation URL'
);

if (failures.length > 0) {
  console.error('School parity audit failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log(`School parity audit passed for ${schools.length} supported schools.`);
if (warnings.length > 0) {
  console.log('Warnings:');
  warnings.forEach((warning) => console.log(`  - ${warning}`));
}

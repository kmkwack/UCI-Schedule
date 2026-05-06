import { Quarter, Timetable, quarterKey } from './courses';

export type AcademicSystem = 'quarter' | 'semester';

export type UniversityStatus = 'available' | 'coming-soon';

export type University = {
  id: string;
  name: string;
  domain: string;
  location: string;
  logo: string;
  status?: UniversityStatus;
};

export type SchoolFeatures = {
  courseCatalog: boolean;
  departmentBoards: boolean;
  reviews: boolean;
  classmates: boolean;
  sports: boolean;
};

export type SportsFeedConfig =
  | { kind: 'uci-calendar'; url: string }
  | { kind: 'sidearm-components'; url: string }
  | { kind: 'sidearm-responsive'; baseUrl: string }
  | {
      kind: 'schedule-pages';
      baseUrl: string;
      pages: Array<{
        sport: string;
        path: string;
        parser: 'umd-text' | 'wmt-schedule';
      }>;
    };

export type GradeScale = {
  maxGpa: number;
  options: string[];
  points: Record<string, number>;
  nonGpaGrades: string[];
  sourceLabel: string;
};

export type SchoolConfig = {
  id: string;
  name: string;
  campus: string;
  domain: string;
  location: string;
  timeZone: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  logo: string;
  shortName: string;
  accent: string;
  welcomeName: string;
  mascotName: string;
  communityName: string;
  academicSystem: AcademicSystem;
  terms: string[];
  features: SchoolFeatures;
  sportsFeed?: SportsFeedConfig;
  gradeDistributionSource?: 'anteaterapi';
  rmpSchoolId?: string;
  gradeScale: GradeScale;
};

const DEFAULT_FEATURES: SchoolFeatures = {
  courseCatalog: true,
  departmentBoards: true,
  reviews: true,
  classmates: true,
  sports: false,
};

const LETTER_GRADE_OPTIONS = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
const UCI_GRADE_OPTIONS = [...LETTER_GRADE_OPTIONS, 'P', 'NP'];
const SAT_UNSAT_GRADE_OPTIONS = [...LETTER_GRADE_OPTIONS, 'S', 'U'];
const PURDUE_GRADE_OPTIONS = [...LETTER_GRADE_OPTIONS, 'P', 'N', 'S', 'U'];
const UIUC_GRADE_OPTIONS = [...LETTER_GRADE_OPTIONS, 'S', 'U', 'CR', 'NC', 'NP'];
const STANDARD_40_POINTS = {
  'A+': 4.0, 'A': 4.0, 'A-': 3.7,
  'B+': 3.3, 'B': 3.0, 'B-': 2.7,
  'C+': 2.3, 'C': 2.0, 'C-': 1.7,
  'D+': 1.3, 'D': 1.0, 'D-': 0.7,
  F: 0.0,
};
const STANDARD_NON_GPA_GRADES = ['P', 'NP', 'N', 'S', 'U', 'CR', 'NC', 'I', 'W'];

const STANDARD_40_SCALE: GradeScale = {
  maxGpa: 4.0,
  options: UCI_GRADE_OPTIONS,
  points: STANDARD_40_POINTS,
  nonGpaGrades: STANDARD_NON_GPA_GRADES,
  sourceLabel: '4.0 plus/minus scale',
};

const CORNELL_43_SCALE: GradeScale = {
  ...STANDARD_40_SCALE,
  maxGpa: 4.3,
  options: SAT_UNSAT_GRADE_OPTIONS,
  points: { ...STANDARD_40_POINTS, 'A+': 4.3 },
  sourceLabel: 'Cornell 4.3 scale',
};

const PURDUE_40_SCALE: GradeScale = {
  ...STANDARD_40_SCALE,
  options: PURDUE_GRADE_OPTIONS,
  sourceLabel: 'Purdue 4.0 scale',
};

const UMD_40_SCALE: GradeScale = {
  ...STANDARD_40_SCALE,
  options: SAT_UNSAT_GRADE_OPTIONS,
  sourceLabel: 'UMD 4.0 scale',
};

const ILLINOIS_40_SCALE: GradeScale = {
  ...STANDARD_40_SCALE,
  options: UIUC_GRADE_OPTIONS,
  points: {
    'A+': 4.0, 'A': 4.0, 'A-': 3.67,
    'B+': 3.33, 'B': 3.0, 'B-': 2.67,
    'C+': 2.33, 'C': 2.0, 'C-': 1.67,
    'D+': 1.33, 'D': 1.0, 'D-': 0.67,
    F: 0.0,
  },
  sourceLabel: 'Illinois 4.0 scale',
};

const UMD_SPORTS_PAGES: Extract<SportsFeedConfig, { kind: 'schedule-pages' }>['pages'] = [
  { sport: 'Baseball', path: '/sports/baseball/schedule/text', parser: 'umd-text' },
  { sport: "Men's Basketball", path: '/sports/mens-basketball/schedule/text', parser: 'umd-text' },
  { sport: 'Football', path: '/sports/football/schedule/text', parser: 'umd-text' },
  { sport: "Men's Golf", path: '/sports/mens-golf/schedule/text', parser: 'umd-text' },
  { sport: "Men's Lacrosse", path: '/sports/mens-lacrosse/schedule/text', parser: 'umd-text' },
  { sport: "Men's Soccer", path: '/sports/mens-soccer/schedule/text', parser: 'umd-text' },
  { sport: 'Wrestling', path: '/sports/wrestling/schedule/text', parser: 'umd-text' },
  { sport: "Women's Basketball", path: '/sports/womens-basketball/schedule/text', parser: 'umd-text' },
  { sport: "Women's Cross Country", path: '/sports/womens-cross-country/schedule/text', parser: 'umd-text' },
  { sport: 'Field Hockey', path: '/sports/field-hockey/schedule/text', parser: 'umd-text' },
  { sport: "Women's Golf", path: '/sports/womens-golf/schedule/text', parser: 'umd-text' },
  { sport: 'Gymnastics', path: '/sports/gymnastics/schedule/text', parser: 'umd-text' },
  { sport: 'Track & Field', path: '/sports/track-and-field/schedule/text', parser: 'umd-text' },
  { sport: "Women's Lacrosse", path: '/sports/womens-lacrosse/schedule/text', parser: 'umd-text' },
  { sport: "Women's Soccer", path: '/sports/womens-soccer/schedule/text', parser: 'umd-text' },
  { sport: 'Softball', path: '/sports/softball/schedule/text', parser: 'umd-text' },
  { sport: "Women's Tennis", path: '/sports/womens-tennis/schedule/text', parser: 'umd-text' },
  { sport: 'Volleyball', path: '/sports/womens-volleyball/schedule/text', parser: 'umd-text' },
];

const PURDUE_SPORTS_PAGES: Extract<SportsFeedConfig, { kind: 'schedule-pages' }>['pages'] = [
  { sport: 'Baseball', path: '/sports/baseball/schedule', parser: 'wmt-schedule' },
  { sport: "Men's Basketball", path: '/sports/mens-basketball/schedule', parser: 'wmt-schedule' },
  { sport: "Women's Basketball", path: '/sports/womens-basketball/schedule', parser: 'wmt-schedule' },
  { sport: 'Cross Country', path: '/sports/cross-country/schedule', parser: 'wmt-schedule' },
  { sport: 'Football', path: '/sports/football/schedule', parser: 'wmt-schedule' },
  { sport: "Men's Golf", path: '/sports/mens-golf/schedule', parser: 'wmt-schedule' },
  { sport: "Women's Golf", path: '/sports/womens-golf/schedule', parser: 'wmt-schedule' },
  { sport: 'Soccer', path: '/sports/soccer/schedule', parser: 'wmt-schedule' },
  { sport: 'Softball', path: '/sports/softball/schedule', parser: 'wmt-schedule' },
  { sport: "Men's Swimming & Diving", path: '/sports/mens-swimming-diving/schedule', parser: 'wmt-schedule' },
  { sport: "Women's Swimming & Diving", path: '/sports/womens-swimming-diving/schedule', parser: 'wmt-schedule' },
  { sport: "Men's Tennis", path: '/sports/mens-tennis/schedule', parser: 'wmt-schedule' },
  { sport: "Women's Tennis", path: '/sports/womens-tennis/schedule', parser: 'wmt-schedule' },
  { sport: 'Track & Field', path: '/sports/track-field/schedule', parser: 'wmt-schedule' },
  { sport: 'Volleyball', path: '/sports/volleyball/schedule', parser: 'wmt-schedule' },
  { sport: 'Wrestling', path: '/sports/wrestling/schedule', parser: 'wmt-schedule' },
];

export const SCHOOL_CONFIGS: Record<string, SchoolConfig> = {
  'UC Irvine': {
    id: 'uci',
    name: 'UC Irvine',
    campus: 'Irvine campus',
    domain: '@uci.edu',
    location: 'Irvine, CA',
    timeZone: 'America/Los_Angeles',
    coordinates: { latitude: 33.6405, longitude: -117.8443 },
    logo: 'UCI',
    shortName: 'UCI',
    accent: '#4169E1',
    welcomeName: 'Anteater',
    mascotName: 'Peter the Anteater',
    communityName: 'Anteaters',
    academicSystem: 'quarter',
    terms: ['Winter', 'Spring', 'Summer1', 'Summer10wk', 'Summer2', 'Fall'],
    features: { ...DEFAULT_FEATURES, sports: true },
    sportsFeed: { kind: 'uci-calendar', url: 'https://ucirvinesports.com/calendar' },
    gradeDistributionSource: 'anteaterapi',
    rmpSchoolId: '1074',
    gradeScale: STANDARD_40_SCALE,
  },
  'University of Maryland, College Park': {
    id: 'umd',
    name: 'University of Maryland, College Park',
    campus: 'College Park campus',
    domain: '@umd.edu',
    location: 'College Park, MD',
    timeZone: 'America/New_York',
    coordinates: { latitude: 38.9869, longitude: -76.9426 },
    logo: 'UMD',
    shortName: 'UMD',
    accent: '#E21833',
    welcomeName: 'Terp',
    mascotName: 'Terrapin',
    communityName: 'Terrapins',
    academicSystem: 'semester',
    terms: ['Spring', 'Summer', 'Fall'],
    features: { ...DEFAULT_FEATURES, sports: true },
    sportsFeed: { kind: 'schedule-pages', baseUrl: 'https://umterps.com', pages: UMD_SPORTS_PAGES },
    gradeScale: UMD_40_SCALE,
  },
  'Cornell University': {
    id: 'cornell',
    name: 'Cornell University',
    campus: 'Ithaca campus',
    domain: '@cornell.edu',
    location: 'Ithaca, NY',
    timeZone: 'America/New_York',
    coordinates: { latitude: 42.4534, longitude: -76.4735 },
    logo: 'CU',
    shortName: 'Cornell',
    accent: '#B31B1B',
    welcomeName: 'Cornellian',
    mascotName: 'Big Red',
    communityName: 'Cornellians',
    academicSystem: 'semester',
    terms: ['Spring', 'Summer', 'Fall'],
    features: { ...DEFAULT_FEATURES, sports: true },
    sportsFeed: { kind: 'sidearm-responsive', baseUrl: 'https://cornellbigred.com' },
    gradeScale: CORNELL_43_SCALE,
  },
  'Purdue University': {
    id: 'purdue',
    name: 'Purdue University',
    campus: 'West Lafayette campus',
    domain: '@purdue.edu',
    location: 'West Lafayette, IN',
    timeZone: 'America/Indiana/Indianapolis',
    coordinates: { latitude: 40.4237, longitude: -86.9212 },
    logo: 'PU',
    shortName: 'Purdue',
    accent: '#8E6F3E',
    welcomeName: 'Boilermaker',
    mascotName: 'Purdue Pete',
    communityName: 'Boilermakers',
    academicSystem: 'semester',
    terms: ['Spring', 'Summer', 'Fall'],
    features: { ...DEFAULT_FEATURES, sports: true },
    sportsFeed: { kind: 'schedule-pages', baseUrl: 'https://purduesports.com', pages: PURDUE_SPORTS_PAGES },
    gradeScale: PURDUE_40_SCALE,
  },
  'University of Illinois Urbana-Champaign': {
    id: 'uiuc',
    name: 'University of Illinois Urbana-Champaign',
    campus: 'Urbana-Champaign campus',
    domain: '@illinois.edu',
    location: 'Champaign, IL',
    timeZone: 'America/Chicago',
    coordinates: { latitude: 40.102, longitude: -88.2272 },
    logo: 'UIUC',
    shortName: 'Illinois',
    accent: '#FF5F05',
    welcomeName: 'Illini',
    mascotName: 'Fighting Illini',
    communityName: 'Illini',
    academicSystem: 'semester',
    terms: ['Spring', 'Summer', 'Fall'],
    features: { ...DEFAULT_FEATURES, sports: true },
    sportsFeed: { kind: 'sidearm-components', url: 'https://fightingillini.com/calendar' },
    gradeScale: ILLINOIS_40_SCALE,
  },
};

export const SUPPORTED_UNIVERSITIES: University[] = Object.values(SCHOOL_CONFIGS).map((config) => ({
  id: config.id,
  name: config.name,
  domain: config.domain,
  location: config.location,
  logo: config.logo,
  status: 'available',
}));

export const DEFAULT_UNIVERSITY = SUPPORTED_UNIVERSITIES[0];

export function getSchoolConfig(school: string): SchoolConfig {
  return SCHOOL_CONFIGS[school] ?? {
    id: school.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: school,
    campus: 'Campus',
    domain: '',
    location: '',
    timeZone: 'auto',
    coordinates: { latitude: 39.8283, longitude: -98.5795 },
    logo: school.slice(0, 4).toUpperCase(),
    shortName: school,
    accent: '#4169E1',
    welcomeName: 'student',
    mascotName: 'campus community',
    communityName: 'students',
    academicSystem: 'semester',
    terms: ['Spring', 'Summer', 'Fall'],
    features: DEFAULT_FEATURES,
    gradeScale: STANDARD_40_SCALE,
  };
}

export function universityForName(name: string | null | undefined): University {
  return SUPPORTED_UNIVERSITIES.find((university) => university.name === name) ?? DEFAULT_UNIVERSITY;
}

export function schoolFeatureEnabled(school: string, feature: keyof SchoolFeatures) {
  return getSchoolConfig(school).features[feature];
}

export function gradeScaleForSchool(school: string) {
  return getSchoolConfig(school).gradeScale;
}

export function sportsFeedForSchool(school: string) {
  return getSchoolConfig(school).sportsFeed;
}

export function schoolCampusLabel(school: string) {
  const config = getSchoolConfig(school);
  return config.name;
}

export function schoolHomeLabel(school: string) {
  const config = getSchoolConfig(school);
  if (config.name.length <= 22) return config.name;
  return config.logo.length <= 6 ? config.logo : config.shortName;
}

export function academicSystemNoun(school: string, capitalize = false) {
  const noun = getSchoolConfig(school).academicSystem === 'quarter' ? 'quarter' : 'term';
  return capitalize ? noun.charAt(0).toUpperCase() + noun.slice(1) : noun;
}

export function termLabel(term: Quarter, school: string, includeSystem = false) {
  const base = `${term.quarter} ${term.year}`;
  return includeSystem && getSchoolConfig(school).academicSystem === 'quarter'
    ? `${base} ${academicSystemNoun(school, true)}`
    : base;
}

export function termOrderValue(termName: string, school: string) {
  const order = getSchoolConfig(school).terms;
  const index = order.indexOf(termName);
  return index === -1 ? order.length : index;
}

export function getAcademicTermForDate(school: string, date: Date): Quarter {
  const year = date.getFullYear();
  const month = date.getMonth();
  if (getSchoolConfig(school).academicSystem === 'quarter') {
    if (month <= 2) return { year: String(year), quarter: 'Winter' };
    if (month <= 5) return { year: String(year), quarter: 'Spring' };
    if (month <= 8) return { year: String(year), quarter: 'Summer10wk' };
    return { year: String(year), quarter: 'Fall' };
  }

  if (month <= 4) return { year: String(year), quarter: 'Spring' };
  if (month <= 7) return { year: String(year), quarter: 'Summer' };
  return { year: String(year), quarter: 'Fall' };
}

export function buildTermCandidates(school: string, startYear: number, endYear: number): Quarter[] {
  const terms = getSchoolConfig(school).terms;
  const candidates: Quarter[] = [];
  for (let year = startYear; year <= endYear; year++) {
    terms.forEach((term) => candidates.push({ year: String(year), quarter: term }));
  }
  return candidates;
}

export function resolveCurrentTerm(school: string, timetables: Timetable[]): Quarter {
  const current = getAcademicTermForDate(school, new Date());
  const existingKeys = new Set(timetables.map((t) => t.quarterKey));
  if (existingKeys.has(quarterKey(current))) return current;
  const candidates = buildTermCandidates(school, 2020, 2027).reverse();
  return candidates.find((term) => existingKeys.has(quarterKey(term))) ?? current;
}

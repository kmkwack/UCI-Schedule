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
        parser: 'umd-text' | 'wmt-schedule' | 'wmt-table';
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

const GEORGIA_TECH_SPORTS_PAGES: Extract<SportsFeedConfig, { kind: 'schedule-pages' }>['pages'] = [
  { sport: 'Baseball', path: '/sports/m-basebl/schedule/', parser: 'wmt-table' },
  { sport: "Men's Basketball", path: '/sports/m-baskbl/schedule/', parser: 'wmt-table' },
  { sport: "Women's Basketball", path: '/sports/w-baskbl/schedule/', parser: 'wmt-table' },
  { sport: "Men's Cross Country", path: '/sports/m-xc/schedule/', parser: 'wmt-table' },
  { sport: "Women's Cross Country", path: '/sports/w-xc/schedule/', parser: 'wmt-table' },
  { sport: 'Football', path: '/sports/m-footbl/schedule/', parser: 'wmt-table' },
  { sport: "Men's Golf", path: '/sports/m-golf/schedule/', parser: 'wmt-table' },
  { sport: 'Softball', path: '/sports/w-softbl/schedule/', parser: 'wmt-table' },
  { sport: 'Swimming & Diving', path: '/sports/c-swim/schedule/', parser: 'wmt-table' },
  { sport: "Men's Tennis", path: '/sports/m-tennis/schedule/', parser: 'wmt-table' },
  { sport: "Women's Tennis", path: '/sports/w-tennis/schedule/', parser: 'wmt-table' },
  { sport: "Men's Track & Field", path: '/sports/m-track/schedule/', parser: 'wmt-table' },
  { sport: "Women's Track & Field", path: '/sports/w-track/schedule/', parser: 'wmt-table' },
  { sport: 'Volleyball', path: '/sports/w-volley/schedule/', parser: 'wmt-table' },
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
  'UC Riverside': {
    id: 'ucr',
    name: 'UC Riverside',
    campus: 'Riverside campus',
    domain: '@ucr.edu',
    location: 'Riverside, CA',
    timeZone: 'America/Los_Angeles',
    coordinates: { latitude: 33.9737, longitude: -117.3281 },
    logo: 'UCR',
    shortName: 'UCR',
    accent: '#003DA5',
    welcomeName: 'Highlander',
    mascotName: 'Scotty',
    communityName: 'Highlanders',
    academicSystem: 'quarter',
    terms: ['Winter', 'Spring', 'Summer', 'Fall'],
    features: { ...DEFAULT_FEATURES, sports: true },
    sportsFeed: { kind: 'sidearm-responsive', baseUrl: 'https://gohighlanders.com' },
    gradeScale: STANDARD_40_SCALE,
  },
  'Northeastern University': {
    id: 'northeastern',
    name: 'Northeastern University',
    campus: 'Boston campus',
    domain: '@northeastern.edu',
    location: 'Boston, MA',
    timeZone: 'America/New_York',
    coordinates: { latitude: 42.3398, longitude: -71.0892 },
    logo: 'NEU',
    shortName: 'Northeastern',
    accent: '#D41B2C',
    welcomeName: 'Husky',
    mascotName: 'Paws',
    communityName: 'Huskies',
    academicSystem: 'semester',
    terms: ['Spring', 'Summer', 'Fall'],
    features: { ...DEFAULT_FEATURES, sports: true },
    sportsFeed: { kind: 'sidearm-responsive', baseUrl: 'https://nuhuskies.com' },
    gradeScale: STANDARD_40_SCALE,
  },
  'Temple University': {
    id: 'temple',
    name: 'Temple University',
    campus: 'Main campus',
    domain: '@temple.edu',
    location: 'Philadelphia, PA',
    timeZone: 'America/New_York',
    coordinates: { latitude: 39.9812, longitude: -75.1559 },
    logo: 'TU',
    shortName: 'Temple',
    accent: '#A41E35',
    welcomeName: 'Owl',
    mascotName: 'Hooter',
    communityName: 'Owls',
    academicSystem: 'semester',
    terms: ['Spring', 'Summer', 'Fall'],
    features: { ...DEFAULT_FEATURES, sports: true },
    sportsFeed: { kind: 'sidearm-responsive', baseUrl: 'https://owlsports.com' },
    gradeScale: STANDARD_40_SCALE,
  },
  'Georgia State University': {
    id: 'gsu',
    name: 'Georgia State University',
    campus: 'Atlanta campus',
    domain: '@gsu.edu',
    location: 'Atlanta, GA',
    timeZone: 'America/New_York',
    coordinates: { latitude: 33.7531, longitude: -84.3853 },
    logo: 'GSU',
    shortName: 'Georgia State',
    accent: '#0039A6',
    welcomeName: 'Panther',
    mascotName: 'Pounce',
    communityName: 'Panthers',
    academicSystem: 'semester',
    terms: ['Spring', 'Summer', 'Fall'],
    features: { ...DEFAULT_FEATURES, sports: true },
    sportsFeed: { kind: 'sidearm-responsive', baseUrl: 'https://georgiastatesports.com' },
    gradeScale: STANDARD_40_SCALE,
  },
  'Georgia Institute of Technology': {
    id: 'gatech',
    name: 'Georgia Institute of Technology',
    campus: 'Atlanta campus',
    domain: '@gatech.edu',
    location: 'Atlanta, GA',
    timeZone: 'America/New_York',
    coordinates: { latitude: 33.7756, longitude: -84.3963 },
    logo: 'GT',
    shortName: 'Georgia Tech',
    accent: '#B3A369',
    welcomeName: 'Yellow Jacket',
    mascotName: 'Buzz',
    communityName: 'Yellow Jackets',
    academicSystem: 'semester',
    terms: ['Spring', 'Summer', 'Fall'],
    features: { ...DEFAULT_FEATURES, sports: true },
    sportsFeed: { kind: 'schedule-pages', baseUrl: 'https://ramblinwreck.com', pages: GEORGIA_TECH_SPORTS_PAGES },
    gradeScale: STANDARD_40_SCALE,
  },
  'West Virginia University': {
    id: 'wvu',
    name: 'West Virginia University',
    campus: 'Morgantown campus',
    domain: '@mix.wvu.edu',
    location: 'Morgantown, WV',
    timeZone: 'America/New_York',
    coordinates: { latitude: 39.648, longitude: -79.9697 },
    logo: 'WVU',
    shortName: 'WVU',
    accent: '#002855',
    welcomeName: 'Mountaineer',
    mascotName: 'Mountaineer',
    communityName: 'Mountaineers',
    academicSystem: 'semester',
    terms: ['Spring', 'Summer', 'Fall'],
    features: { ...DEFAULT_FEATURES, sports: true },
    sportsFeed: { kind: 'sidearm-responsive', baseUrl: 'https://wvusports.com' },
    gradeScale: STANDARD_40_SCALE,
  },
  'Sam Houston State University': {
    id: 'shsu',
    name: 'Sam Houston State University',
    campus: 'Huntsville campus',
    domain: '@shsu.edu',
    location: 'Huntsville, TX',
    timeZone: 'America/Chicago',
    coordinates: { latitude: 30.7139, longitude: -95.5476 },
    logo: 'SHSU',
    shortName: 'Sam Houston',
    accent: '#F47B20',
    welcomeName: 'Bearkat',
    mascotName: 'Sammy Bearkat',
    communityName: 'Bearkats',
    academicSystem: 'semester',
    terms: ['Spring', 'Summer', 'Fall'],
    features: { ...DEFAULT_FEATURES, sports: true },
    sportsFeed: { kind: 'sidearm-responsive', baseUrl: 'https://gobearkats.com' },
    gradeScale: STANDARD_40_SCALE,
  },
  'Denison University': {
    id: 'denison',
    name: 'Denison University',
    campus: 'Granville campus',
    domain: '@denison.edu',
    location: 'Granville, OH',
    timeZone: 'America/New_York',
    coordinates: { latitude: 40.072, longitude: -82.522 },
    logo: 'DU',
    shortName: 'Denison',
    accent: '#C8102E',
    welcomeName: 'Denisonian',
    mascotName: 'Big Red',
    communityName: 'Big Red',
    academicSystem: 'semester',
    terms: ['Spring', 'Fall'],
    features: { ...DEFAULT_FEATURES, sports: true },
    sportsFeed: { kind: 'sidearm-responsive', baseUrl: 'https://denisonbigred.com' },
    gradeScale: STANDARD_40_SCALE,
  },
  'University of North Carolina Greensboro': {
    id: 'uncg',
    name: 'University of North Carolina Greensboro',
    campus: 'Greensboro campus',
    domain: '@uncg.edu',
    location: 'Greensboro, NC',
    timeZone: 'America/New_York',
    coordinates: { latitude: 36.0689, longitude: -79.8102 },
    logo: 'UNCG',
    shortName: 'UNCG',
    accent: '#0F2044',
    welcomeName: 'Spartan',
    mascotName: 'Spiro',
    communityName: 'Spartans',
    academicSystem: 'semester',
    terms: ['Spring', 'Summer', 'Fall'],
    features: { ...DEFAULT_FEATURES, sports: true },
    sportsFeed: { kind: 'sidearm-responsive', baseUrl: 'https://uncgspartans.com' },
    gradeScale: STANDARD_40_SCALE,
  },
  'Eastern Illinois University': {
    id: 'eiu',
    name: 'Eastern Illinois University',
    campus: 'Charleston campus',
    domain: '@eiu.edu',
    location: 'Charleston, IL',
    timeZone: 'America/Chicago',
    coordinates: { latitude: 39.484, longitude: -88.175 },
    logo: 'EIU',
    shortName: 'Eastern Illinois',
    accent: '#005EB8',
    welcomeName: 'Panther',
    mascotName: 'Billy the Panther',
    communityName: 'Panthers',
    academicSystem: 'semester',
    terms: ['Spring', 'Summer', 'Fall'],
    features: { ...DEFAULT_FEATURES, sports: true },
    sportsFeed: { kind: 'sidearm-responsive', baseUrl: 'https://eiupanthers.com' },
    gradeScale: STANDARD_40_SCALE,
  },
  'University of North Georgia': {
    id: 'ung',
    name: 'University of North Georgia',
    campus: 'Dahlonega campus',
    domain: '@ung.edu',
    location: 'Dahlonega, GA',
    timeZone: 'America/New_York',
    coordinates: { latitude: 34.527, longitude: -83.984 },
    logo: 'UNG',
    shortName: 'UNG',
    accent: '#002855',
    welcomeName: 'Nighthawk',
    mascotName: 'Nigel the Nighthawk',
    communityName: 'Nighthawks',
    academicSystem: 'semester',
    terms: ['Spring', 'Summer', 'Fall'],
    features: { ...DEFAULT_FEATURES, sports: true },
    sportsFeed: { kind: 'sidearm-responsive', baseUrl: 'https://ungathletics.com' },
    gradeScale: STANDARD_40_SCALE,
  },
  'Alfred State College': {
    id: 'alfredstate',
    name: 'Alfred State College',
    campus: 'Alfred campus',
    domain: '@alfredstate.edu',
    location: 'Alfred, NY',
    timeZone: 'America/New_York',
    coordinates: { latitude: 42.255, longitude: -77.789 },
    logo: 'ASC',
    shortName: 'Alfred State',
    accent: '#0033A0',
    welcomeName: 'Pioneer',
    mascotName: 'Pioneer',
    communityName: 'Pioneers',
    academicSystem: 'semester',
    terms: ['Spring', 'Summer', 'Fall'],
    features: { ...DEFAULT_FEATURES, sports: true },
    sportsFeed: { kind: 'sidearm-responsive', baseUrl: 'https://alfredstateathletics.com' },
    gradeScale: STANDARD_40_SCALE,
  },
  'Canisius University': {
    id: 'canisius',
    name: 'Canisius University',
    campus: 'Buffalo campus',
    domain: '@canisius.edu',
    location: 'Buffalo, NY',
    timeZone: 'America/New_York',
    coordinates: { latitude: 42.925, longitude: -78.852 },
    logo: 'CU',
    shortName: 'Canisius',
    accent: '#0C2340',
    welcomeName: 'Griffin',
    mascotName: 'Golden Griffin',
    communityName: 'Golden Griffins',
    academicSystem: 'semester',
    terms: ['Spring', 'Summer', 'Fall'],
    features: { ...DEFAULT_FEATURES, sports: true },
    sportsFeed: { kind: 'sidearm-responsive', baseUrl: 'https://gogriffs.com' },
    gradeScale: STANDARD_40_SCALE,
  },
  'Genesee Community College': {
    id: 'genesee',
    name: 'Genesee Community College',
    campus: 'Batavia campus',
    domain: '@genesee.edu',
    location: 'Batavia, NY',
    timeZone: 'America/New_York',
    coordinates: { latitude: 43.019, longitude: -78.135 },
    logo: 'GCC',
    shortName: 'Genesee',
    accent: '#003C71',
    welcomeName: 'Cougar',
    mascotName: 'Cougar',
    communityName: 'Cougars',
    academicSystem: 'semester',
    terms: ['Spring', 'Summer', 'Fall'],
    features: { ...DEFAULT_FEATURES },
    gradeScale: STANDARD_40_SCALE,
  },
  'Utah Valley University': {
    id: 'uvu',
    name: 'Utah Valley University',
    campus: 'Orem campus',
    domain: '@uvu.edu',
    location: 'Orem, UT',
    timeZone: 'America/Denver',
    coordinates: { latitude: 40.278, longitude: -111.714 },
    logo: 'UVU',
    shortName: 'UVU',
    accent: '#275D38',
    welcomeName: 'Wolverine',
    mascotName: 'Willy the Wolverine',
    communityName: 'Wolverines',
    academicSystem: 'semester',
    terms: ['Spring', 'Summer', 'Fall'],
    features: { ...DEFAULT_FEATURES, sports: true },
    sportsFeed: { kind: 'sidearm-responsive', baseUrl: 'https://gouvu.com' },
    gradeScale: STANDARD_40_SCALE,
  },
  'Lehigh University': {
    id: 'lehigh',
    name: 'Lehigh University',
    campus: 'Bethlehem campus',
    domain: '@lehigh.edu',
    location: 'Bethlehem, PA',
    timeZone: 'America/New_York',
    coordinates: { latitude: 40.6069, longitude: -75.3783 },
    logo: 'LU',
    shortName: 'Lehigh',
    accent: '#653600',
    welcomeName: 'Mountain Hawk',
    mascotName: 'Clutch',
    communityName: 'Mountain Hawks',
    academicSystem: 'semester',
    terms: ['Spring', 'Summer', 'Fall'],
    features: { ...DEFAULT_FEATURES, sports: true },
    sportsFeed: { kind: 'sidearm-responsive', baseUrl: 'https://lehighsports.com' },
    gradeScale: STANDARD_40_SCALE,
  },
  'Rider University': {
    id: 'rider',
    name: 'Rider University',
    campus: 'Lawrenceville campus',
    domain: '@rider.edu',
    location: 'Lawrenceville, NJ',
    timeZone: 'America/New_York',
    coordinates: { latitude: 40.279, longitude: -74.737 },
    logo: 'RU',
    shortName: 'Rider',
    accent: '#981E32',
    welcomeName: 'Bronc',
    mascotName: 'Bronc',
    communityName: 'Broncs',
    academicSystem: 'semester',
    terms: ['Spring', 'Summer1', 'Summer2', 'Fall'],
    features: { ...DEFAULT_FEATURES, sports: true },
    sportsFeed: { kind: 'sidearm-responsive', baseUrl: 'https://gobroncs.com' },
    gradeScale: STANDARD_40_SCALE,
  },
  'Wheaton College (Massachusetts)': {
    id: 'wheatonma',
    name: 'Wheaton College (Massachusetts)',
    campus: 'Norton campus',
    domain: '@wheatoncollege.edu',
    location: 'Norton, MA',
    timeZone: 'America/New_York',
    coordinates: { latitude: 41.966, longitude: -71.185 },
    logo: 'WC',
    shortName: 'Wheaton',
    accent: '#003DA5',
    welcomeName: 'Lyon',
    mascotName: 'Lyon',
    communityName: 'Lyons',
    academicSystem: 'semester',
    terms: ['Winter', 'Spring', 'Summer', 'Fall'],
    features: { ...DEFAULT_FEATURES, sports: true },
    sportsFeed: { kind: 'sidearm-responsive', baseUrl: 'https://wheatoncollegelyons.com' },
    gradeScale: STANDARD_40_SCALE,
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

function summerTermForSchool(school: string) {
  const terms = getSchoolConfig(school).terms;
  return terms.find((term) => term === 'Summer10wk')
    ?? terms.find((term) => term === 'Summer')
    ?? terms.find((term) => term.toLowerCase().includes('summer'))
    ?? 'Summer';
}

export function getAcademicTermForDate(school: string, date: Date): Quarter {
  const year = date.getFullYear();
  const month = date.getMonth();
  if (getSchoolConfig(school).academicSystem === 'quarter') {
    if (month <= 2) return { year: String(year), quarter: 'Winter' };
    if (month <= 5) return { year: String(year), quarter: 'Spring' };
    if (month <= 8) return { year: String(year), quarter: summerTermForSchool(school) };
    return { year: String(year), quarter: 'Fall' };
  }

  if (month <= 4) return { year: String(year), quarter: 'Spring' };
  if (month <= 7) {
    const summer = getSchoolConfig(school).terms.find((term) => term.toLowerCase().includes('summer'));
    return { year: String(year), quarter: summer ?? 'Spring' };
  }
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

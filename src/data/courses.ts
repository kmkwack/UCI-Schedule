export type Course = {
  id: string;
  code: string;
  title: string;
  professor: string;
  days: string;
  time: string;
  department: string;
  addedCount: number;
  rating: number;
  location?: string;
  units?: number;
};

export type Quarter = { year: string; quarter: string };

export function quarterKey(q: Quarter): string {
  return `${q.year}-${q.quarter}`;
}

export function quarterLabel(q: Quarter): string {
  return `${q.quarter} ${q.year}`;
}

export const QUARTERS: Quarter[] = [
  { year: '2024', quarter: 'Fall' },
  { year: '2025', quarter: 'Winter' },
  { year: '2025', quarter: 'Spring' },
  { year: '2025', quarter: 'Fall' },
  { year: '2026', quarter: 'Winter' },
  { year: '2026', quarter: 'Spring' },
  { year: '2026', quarter: 'Fall' },
];

export const UCI_DEPARTMENTS = [
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

const COURSE_COLORS = [
  '#7eb6ff', '#cfae5a', '#a7cf6f', '#d07c70',
  '#a78bfa', '#f97316', '#14b8a6', '#ec4899',
  '#84cc16', '#f59e0b',
];

export function colorForDepartment(dept: string): string {
  const hash = dept.split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0);
  return COURSE_COLORS[Math.abs(hash) % COURSE_COLORS.length];
}

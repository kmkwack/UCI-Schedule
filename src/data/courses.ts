export type Timetable = {
  id: string;         // UUID from Supabase
  name: string;       // e.g. "Plan A", "My Schedule"
  quarterKey: string; // e.g. "2026-Spring"
  courses: Course[];
  order: number;      // display order within the quarter (0-based)
};

export type TimetableTheme = 'default' | 'minimal' | 'colorful' | 'dark';

export type TimetableSettings = {
  theme: TimetableTheme;
  showCode: boolean;
  showClassName: boolean;
  showRoomNumber: boolean;
  showInstructor: boolean;
  showTime: boolean;
};

export const DEFAULT_TIMETABLE_SETTINGS: TimetableSettings = {
  theme: 'default',
  showCode: true,
  showClassName: true,
  showRoomNumber: true,
  showInstructor: true,
  showTime: true,
};

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
  sectionLabel?: string;  // e.g. "Lec A", "Dis A1"
};

export type Quarter = { year: string; quarter: string };

export function quarterKey(q: Quarter): string {
  return `${q.year}-${q.quarter}`;
}

export function quarterLabel(q: Quarter): string {
  return `${q.quarter} ${q.year}`;
}

export const QUARTERS: Quarter[] = [
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
  '#84cc16', '#f59e0b', '#60a5fa', '#fb7185',
  '#34d399', '#fbbf24', '#a3e635', '#38bdf8',
  '#c084fc', '#fb923c', '#4ade80', '#f472b6',
  '#e879f9', '#2dd4bf', '#facc15', '#94a3b8',
];

// FNV-1a hash — far better distribution than weighted sum for similar strings
function hashStr(s: string): number {
  let hash = 2166136261;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

export function colorForDepartment(dept: string): string {
  return COURSE_COLORS[Math.abs(hashStr(dept)) % COURSE_COLORS.length];
}

// Pastel palette — bg/text/border triplets, one per course slot
export const PASTEL_PALETTES: { bg: string; text: string; border: string }[] = [
  { bg: '#EEF4FF', text: '#3B6BC9', border: '#93B8F5' },
  { bg: '#FDF8EE', text: '#8B6914', border: '#E5C96A' },
  { bg: '#F2FAEC', text: '#4A7A1E', border: '#90CC5A' },
  { bg: '#FDF2F0', text: '#8B3B30', border: '#E07A70' },
  { bg: '#F5F0FF', text: '#6D28D9', border: '#B48AFC' },
  { bg: '#FFF4EC', text: '#C2540A', border: '#F9A170' },
  { bg: '#E8FBF9', text: '#0F766E', border: '#5CD1C8' },
  { bg: '#FFF0F7', text: '#BE185D', border: '#F472B6' },
  { bg: '#F5FDE8', text: '#3F6212', border: '#A6D96A' },
  { bg: '#FFFAEB', text: '#92400E', border: '#F5C061' },
  { bg: '#F0F9FF', text: '#0369A1', border: '#7DD3FC' },
  { bg: '#FEF2F2', text: '#991B1B', border: '#FCA5A5' },
  { bg: '#FFF7F0', text: '#9A3412', border: '#FDBA74' },
  { bg: '#F0FDF4', text: '#166534', border: '#86EFAC' },
  { bg: '#FEFCE8', text: '#854D0E', border: '#FDE047' },
  { bg: '#F0F4FF', text: '#3730A3', border: '#A5B4FC' },
  { bg: '#FDF4FF', text: '#86198F', border: '#E879F9' },
  { bg: '#ECFDF5', text: '#065F46', border: '#6EE7B7' },
  { bg: '#FFF1F2', text: '#9F1239', border: '#FDA4AF' },
  { bg: '#F0FDFA', text: '#134E4A', border: '#5EEAD4' },
  { bg: '#FFFBEB', text: '#78350F', border: '#FCD34D' },
  { bg: '#EFF6FF', text: '#1E40AF', border: '#93C5FD' },
  { bg: '#FAF5FF', text: '#5B21B6', border: '#C4B5FD' },
  { bg: '#F8FAFC', text: '#334155', border: '#CBD5E1' },
];

/** Returns a consistent pastel color set for a given course code (e.g. "ECON 100A"). */
export function pastelForCourse(courseCode: string): { bg: string; text: string; border: string } {
  return PASTEL_PALETTES[Math.abs(hashStr(courseCode)) % PASTEL_PALETTES.length];
}

/** Solid color for a course code — used in Colorful theme. */
export function colorForCourse(courseCode: string): string {
  return COURSE_COLORS[Math.abs(hashStr(courseCode)) % COURSE_COLORS.length];
}

/** Color key includes section type so Lec and Dis get distinct colors. */
export function blockColorKey(course: Course): string {
  const type = course.sectionLabel?.split(' ')[0];
  return type ? `${course.code}-${type}` : course.code;
}

/** Returns block bg/text/border for a given course and theme. */
export function getBlockColors(course: Course, theme: TimetableTheme): { bg: string; text: string; border: string } {
  switch (theme) {
    case 'minimal':
      return { bg: '#f5f6f8', text: '#4b5563', border: '#d1d5db' };
    case 'colorful': {
      const color = colorForCourse(blockColorKey(course));
      return { bg: color, text: 'white', border: color };
    }
    case 'dark': {
      const { border } = pastelForCourse(blockColorKey(course));
      return { bg: '#1e293b', text: '#f1f5f9', border };
    }
    default:
      return pastelForCourse(blockColorKey(course));
  }
}

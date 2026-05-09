export type Timetable = {
  id: string;         // UUID from Supabase
  name: string;       // e.g. "Plan A", "My Schedule"
  quarterKey: string; // e.g. "2026-Spring"
  courses: Course[];
  order: number;      // display order within the quarter (0-based)
};

export type TimetableTheme = 'pastel' | 'minimal' | 'colorful' | 'soft' | 'outline';

export type TimetableSettings = {
  theme: TimetableTheme;
  showCode: boolean;
  showClassName: boolean;
  showRoomNumber: boolean;
  showInstructor: boolean;
  showTime: boolean;
};

export const DEFAULT_TIMETABLE_SETTINGS: TimetableSettings = {
  theme: 'pastel',
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
  location?: string;
  units?: number;
  sectionLabel?: string;  // e.g. "Lec A", "Dis A1"
  enrollmentStatus?: string;
  enrolled?: number;
  capacity?: number;
  waitlist?: number;
  waitlistCapacity?: number;
  customColor?: string;
};

export type Quarter = { year: string; quarter: string };

export const INSTRUCTOR_TBA_LABEL = 'Instructor TBA';

export function professorIsKnown(value: string | null | undefined) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
  return Boolean(normalized)
    && normalized !== 'STAFF'
    && normalized !== 'TBA'
    && normalized !== 'INSTRUCTOR TBA'
    && normalized !== 'TO BE ANNOUNCED';
}

export function professorDisplayName(value: string | null | undefined) {
  const cleaned = String(value ?? '').replace(/\s+/g, ' ').trim();
  return professorIsKnown(cleaned) ? cleaned : INSTRUCTOR_TBA_LABEL;
}

export function quarterKey(q: Quarter): string {
  return `${q.year}-${q.quarter}`;
}

export function quarterLabel(q: Quarter): string {
  return `${q.quarter} ${q.year}`;
}

export function parseTimeToMinutes(value: string | undefined, options: { allow24HourEnd?: boolean } = {}) {
  const raw = (value ?? '').trim();
  if (!raw || raw.toUpperCase() === 'TBA') return null;

  const twelveHour = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*([AP])\.?M\.?$/i);
  if (twelveHour) {
    const hour = Number(twelveHour[1]);
    const minute = Number(twelveHour[2] ?? '0');
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
    const period = twelveHour[3].toUpperCase();
    const hour24 = period === 'AM' ? hour % 12 : (hour % 12) + 12;
    return hour24 * 60 + minute;
  }

  const twentyFourHour = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1]);
    const minute = Number(twentyFourHour[2]);
    if (options.allow24HourEnd && hour === 24 && minute === 0) return 24 * 60;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return hour * 60 + minute;
  }

  return null;
}

export function formatMinutesAs24Hour(totalMinutes: number) {
  const clamped = Math.max(0, Math.min(totalMinutes, 24 * 60));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

export function formatMinutesAs12Hour(
  totalMinutes: number,
  options: { includePeriod?: boolean; omitMinutesIfZero?: boolean } = {},
) {
  const { includePeriod = true, omitMinutesIfZero = false } = options;
  const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const hour12 = hour24 % 12 || 12;
  const minuteText = omitMinutesIfZero && minute === 0
    ? ''
    : `:${minute.toString().padStart(2, '0')}`;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  return includePeriod ? `${hour12}${minuteText} ${period}` : `${hour12}${minuteText}`;
}

export function formatTimeOfDay12(
  value: string | undefined,
  options: { omitMinutesIfZero?: boolean } = {},
) {
  const minutes = parseTimeToMinutes(value, { allow24HourEnd: true });
  return minutes == null ? (value ?? '') : formatMinutesAs12Hour(minutes, options);
}

export function formatCourseTimeRange12(timeRange: string, options: { compact?: boolean } = {}) {
  if (!timeRange || timeRange === 'TBA') return timeRange;
  const [rawStart, rawEnd] = timeRange.split(' - ');
  const start = parseTimeToMinutes(rawStart);
  const end = parseTimeToMinutes(rawEnd, { allow24HourEnd: true });
  if (start == null || end == null) return timeRange;

  const startPeriod = Math.floor((((start % (24 * 60)) + (24 * 60)) % (24 * 60)) / 60) >= 12 ? 'PM' : 'AM';
  const endPeriod = Math.floor((((end % (24 * 60)) + (24 * 60)) % (24 * 60)) / 60) >= 12 ? 'PM' : 'AM';

  if (options.compact && startPeriod === endPeriod) {
    return `${formatMinutesAs12Hour(start, { includePeriod: false })}-${formatMinutesAs12Hour(end)}`;
  }
  if (options.compact) {
    return `${formatMinutesAs12Hour(start)}-${formatMinutesAs12Hour(end)}`;
  }
  return `${formatMinutesAs12Hour(start)} - ${formatMinutesAs12Hour(end)}`;
}

export function formatHourLabel12(hour: number) {
  return formatMinutesAs12Hour(hour * 60, { omitMinutesIfZero: true });
}

export function normalizeTimeInputTo24Hour(value: string, options: { allow24HourEnd?: boolean } = {}) {
  const minutes = parseTimeToMinutes(value, options);
  return minutes == null ? null : formatMinutesAs24Hour(minutes);
}

export function getAcademicQuarterForDate(date: Date): Quarter {
  const month = date.getMonth();
  if (month <= 2) return { year: String(date.getFullYear()), quarter: 'Winter' };
  if (month <= 5) return { year: String(date.getFullYear()), quarter: 'Spring' };
  if (month <= 8) return { year: String(date.getFullYear()), quarter: 'Summer10wk' };
  return { year: String(date.getFullYear()), quarter: 'Fall' };
}

// Resolve to the academic quarter used by the app's seeded quarter list.
export function resolveCurrentQuarter(timetables: Timetable[]): Quarter {
  const q = getAcademicQuarterForDate(new Date());
  if (QUARTERS.some((quarter) => quarterKey(quarter) === quarterKey(q))) return q;
  const existingKeys = new Set(timetables.map((t) => t.quarterKey));
  for (let i = QUARTERS.length - 1; i >= 0; i--) {
    if (existingKeys.has(quarterKey(QUARTERS[i]))) return QUARTERS[i];
  }
  return QUARTERS[0];
}

export const QUARTERS: Quarter[] = [
  { year: '2025', quarter: 'Fall' },
  { year: '2026', quarter: 'Winter' },
  { year: '2026', quarter: 'Spring' },
  { year: '2026', quarter: 'Summer1' },
  { year: '2026', quarter: 'Summer10wk' },
  { year: '2026', quarter: 'Summer2' },
  { year: '2026', quarter: 'Fall' },
  { year: '2027', quarter: 'Winter' },
  { year: '2027', quarter: 'Spring' },
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

const VIVID_COURSE_COLORS = [
  '#DC2626', // red
  '#EA580C', // orange
  '#FACC15', // yellow
  '#16A34A', // green
  '#0891B2', // cyan
  '#2563EB', // blue
  '#4F46E5', // indigo
  '#9333EA', // violet
  '#DB2777', // magenta
  '#BE123C', // rose
  '#65A30D', // lime
  '#0D9488', // teal
  '#7C3AED', // purple
  '#F59E0B', // amber
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;
  const int = parseInt(expanded, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixHex(colorA: string, colorB: string, ratio: number) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  return rgbToHex(
    a.r + (b.r - a.r) * ratio,
    a.g + (b.g - a.g) * ratio,
    a.b + (b.b - a.b) * ratio
  );
}

function relativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function normalizeTimetableTheme(theme: TimetableTheme | string | null | undefined): TimetableTheme {
  if (theme === 'minimal' || theme === 'colorful' || theme === 'soft' || theme === 'outline') return theme;
  return 'pastel';
}

function customBlockColors(color: string, themeInput: TimetableTheme | string) {
  const theme = normalizeTimetableTheme(themeInput);

  if (theme === 'colorful') {
    return {
      bg: color,
      text: relativeLuminance(color) > 0.55 ? '#111827' : '#ffffff',
      border: mixHex(color, '#000000', 0.08),
    };
  }

  if (theme === 'outline') {
    return {
      bg: '#ffffff',
      text: mixHex(color, '#111827', 0.26),
      border: mixHex(color, '#ffffff', 0.18),
    };
  }

  if (theme === 'soft') {
    return {
      bg: mixHex(color, '#ffffff', 0.76),
      text: mixHex(color, '#111827', 0.22),
      border: mixHex(color, '#ffffff', 0.34),
    };
  }

  if (theme === 'minimal') {
    return {
      bg: mixHex(color, '#ffffff', 0.9),
      text: mixHex(color, '#111827', 0.5),
      border: mixHex(color, '#ffffff', 0.55),
    };
  }

  return {
    bg: mixHex(color, '#ffffff', 0.86),
    text: mixHex(color, '#111827', 0.4),
    border: mixHex(color, '#ffffff', 0.46),
  };
}

/** Returns a consistent pastel color set for a given course code (e.g. "ECON 100A"). */
export function pastelForCourse(courseCode: string): { bg: string; text: string; border: string } {
  return PASTEL_PALETTES[Math.abs(hashStr(courseCode)) % PASTEL_PALETTES.length];
}

/** Solid color for a course code — used in Colorful theme. */
export function colorForCourse(courseCode: string): string {
  return COURSE_COLORS[Math.abs(hashStr(courseCode)) % COURSE_COLORS.length];
}

/** Saturated rainbow color for a course code — used in Colorful theme. */
export function vividColorForCourse(courseCode: string): string {
  return VIVID_COURSE_COLORS[Math.abs(hashStr(courseCode)) % VIVID_COURSE_COLORS.length];
}

/** Color key includes section type so Lec and Dis get distinct colors. */
export function blockColorKey(course: Course): string {
  const type = course.sectionLabel?.split(' ')[0];
  return type ? `${course.code}-${type}` : course.code;
}

/** Returns block bg/text/border for a given course and block style. */
export function getBlockColors(course: Course, themeInput: TimetableTheme | string): { bg: string; text: string; border: string } {
  const theme = normalizeTimetableTheme(themeInput);

  if (course.customColor) {
    return customBlockColors(course.customColor, theme);
  }

  switch (theme) {
    case 'minimal':
      return { bg: '#f5f6f8', text: '#4b5563', border: '#d1d5db' };
    case 'colorful': {
      const color = vividColorForCourse(blockColorKey(course));
      return {
        bg: color,
        text: relativeLuminance(color) > 0.55 ? '#111827' : '#ffffff',
        border: mixHex(color, '#000000', 0.16),
      };
    }
    case 'soft': {
      const color = colorForCourse(blockColorKey(course));
      return {
        bg: mixHex(color, '#ffffff', 0.76),
        text: mixHex(color, '#111827', 0.22),
        border: mixHex(color, '#ffffff', 0.34),
      };
    }
    case 'outline': {
      const color = colorForCourse(blockColorKey(course));
      return {
        bg: '#ffffff',
        text: mixHex(color, '#111827', 0.2),
        border: mixHex(color, '#ffffff', 0.1),
      };
    }
    default:
      return pastelForCourse(blockColorKey(course));
  }
}

export type EditableProfile = {
  firstName: string;
  middleName: string;
  lastName: string;
  nickname: string;
  email: string;
  year: string;
  major: string;
  gender: string;
  dateOfBirth: string;
};

export type TimetableVisibility = 'friends' | 'private' | 'public';

export type NotificationPreferences = {
  pushNotifications: boolean;
  emailNotifications: boolean;
  dailyScheduleSummary: boolean;
  dailyScheduleSummaryHour: number;
  classReminders: boolean;
  classReminderMinutes: number;
  assignmentReminders: boolean;
  assignmentReminderOffsets: number[];
  sportsGameReminders: boolean;
  sportsGameReminderMinutes: number;
  friendRequests: boolean;
  comments: boolean;
  likes: boolean;
  messages: boolean;
};

export type PushPermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';
export type LanguagePreference = 'en';
export type DateFormatPreference = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';

export type UserSettingsState = {
  timetableVisibility: TimetableVisibility;
  boardProfileVisible: boolean;
  notifications: NotificationPreferences;
  pushPermissionStatus: PushPermissionStatus;
  language: LanguagePreference;
  timeZone: string;
  dateFormat: DateFormatPreference;
};

export function deviceTimeZoneFallback() {
  return 'America/Los_Angeles';
}

export function normalizeLanguagePreference(value: unknown): LanguagePreference {
  return 'en';
}

export function normalizeDateFormatPreference(value: unknown): DateFormatPreference {
  return value === 'DD/MM/YYYY' || value === 'YYYY-MM-DD' || value === 'MM/DD/YYYY' ? value : 'MM/DD/YYYY';
}

export function normalizeTimeZonePreference(value: unknown): string {
  return 'America/Los_Angeles';
}

const MAJOR_ABBREVIATIONS: Record<string, string> = {
  'Aerospace Engineering': 'AE',
  'African American Studies': 'AAS',
  Anthropology: 'ANTH',
  'Applied Physics': 'AP',
  'Applied and Computational Mathematics': 'ACM',
  'Art History': 'ARTH',
  Art: 'ART',
  'Asian American Studies': 'AAS',
  'Biochemistry and Molecular Biology': 'BMB',
  'Biological Sciences': 'BIO SCI',
  'Biology/Education': 'BIO ED',
  'Biomedical Engineering': 'BME',
  'Biomedical Engineering: Premedical': 'BME PRE',
  'Business Administration': 'BA',
  'Business Economics': 'BUS ECON',
  'Business Information Management': 'BIM',
  'Chemical Engineering': 'CHE',
  Chemistry: 'CHEM',
  'Chicano/Latino Studies': 'CLS',
  'Chinese Studies': 'CHN',
  'Civil Engineering': 'CE',
  Classics: 'CLASS',
  'Cognitive Sciences': 'COGS',
  'Comparative Literature': 'C LIT',
  'Computer Engineering': 'CE',
  'Computer Science and Engineering': 'CSE',
  'Computer Science': 'CS',
  'Criminology, Law and Society': 'CLS',
  Dance: 'DANCE',
  'Data Science': 'DATA',
  'Developmental and Cell Biology': 'DCB',
  Drama: 'DRAMA',
  'East Asian Cultures': 'EAS',
  'Ecology and Evolutionary Biology': 'EEB',
  Economics: 'ECON',
  'Education Sciences': 'EDUC',
  'Electrical Engineering': 'EE',
  English: 'ENG',
  'Environmental Engineering': 'ENV ENG',
  'Environmental Science and Policy': 'ESP',
  'Environmental and Earth System Science': 'EESS',
  'European Studies': 'EURO',
  'Film and Media Studies': 'FMS',
  French: 'FR',
  'Game Design and Interactive Media': 'GDIM',
  'Gender and Sexuality Studies': 'GSS',
  Genetics: 'GEN',
  'German Studies': 'GER',
  'Global Cultures': 'GC',
  History: 'HIST',
  'Human Biology': 'H BIO',
  Informatics: 'IN4MATX',
  'Information and Computer Science': 'ICS',
  'International Studies': 'INTL',
  'Japanese Language and Literature': 'JAPAN',
  'Korean Literature and Culture': 'KOREAN',
  'Language Science': 'LSCI',
  'Literary Journalism': 'LIT JRN',
  'Materials Science and Engineering': 'MSE',
  Mathematics: 'MATH',
  'Mechanical Engineering': 'ME',
  'Microbiology and Immunology': 'MICRO',
  'Music Theatre': 'MT',
  Music: 'MUSIC',
  Neurobiology: 'NEURO',
  'Nursing Science': 'NURS',
  'Pharmaceutical Sciences': 'PHARM',
  Philosophy: 'PHIL',
  Physics: 'PHYS',
  'Physiology and Exercise Science': 'PES',
  'Political Science': 'POL SCI',
  Psychology: 'PSYCH',
  'Public Health Policy': 'PHP',
  'Public Health Science': 'PHS',
  'Quantitative Economics': 'Q ECON',
  'Religious Studies': 'REL STD',
  'Social Ecology': 'SOC ECOL',
  'Social Policy and Public Service': 'SPPS',
  Sociology: 'SOC',
  'Software Engineering': 'SWE',
  Spanish: 'SPAN',
  'Undergraduate/Undeclared': 'UNDECL',
  Undeclared: 'UNDECL',
  'Urban Studies': 'URB ST',
};

export function abbreviateMajor(major?: string | null) {
  const trimmed = major?.trim();
  if (!trimmed) return '';
  const mapped = MAJOR_ABBREVIATIONS[trimmed];
  if (mapped) return mapped;
  if (/undeclared/i.test(trimmed)) return 'UNDECL';
  if (/^[A-Z0-9 &/.-]{2,10}$/.test(trimmed)) return trimmed;

  const words = trimmed
    .replace(/[:/,&-]+/g, ' ')
    .replace(/\band\b/gi, ' ')
    .split(/\s+/)
    .filter((word) => word && !/^(of|the|and)$/i.test(word));

  if (words.length <= 1) return trimmed.length <= 8 ? trimmed.toUpperCase() : trimmed.slice(0, 8).toUpperCase();
  return words.map((word) => word[0]).join('').toUpperCase().slice(0, 6);
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushNotifications: false,
  emailNotifications: true,
  dailyScheduleSummary: true,
  dailyScheduleSummaryHour: 8,
  classReminders: true,
  classReminderMinutes: 60,
  assignmentReminders: true,
  assignmentReminderOffsets: [2880, 1440, 720],
  sportsGameReminders: true,
  sportsGameReminderMinutes: 60,
  friendRequests: true,
  comments: true,
  likes: true,
  messages: true,
};

export const DEFAULT_USER_SETTINGS: UserSettingsState = {
  timetableVisibility: 'friends',
  boardProfileVisible: false,
  notifications: DEFAULT_NOTIFICATION_PREFERENCES,
  pushPermissionStatus: 'undetermined',
  language: 'en',
  timeZone: 'America/Los_Angeles',
  dateFormat: 'MM/DD/YYYY',
};

function prettifyNamePart(part: string) {
  if (!part) return '';
  return part.charAt(0).toUpperCase() + part.slice(1);
}

export function splitName(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', middleName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], middleName: '', lastName: '' };
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

export function fallbackProfileFromEmail(email: string): EditableProfile {
  const localPart = (email.split('@')[0] ?? 'student').trim();
  const nameParts = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map(prettifyNamePart);
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

  return {
    firstName: '',
    middleName: '',
    lastName,
    nickname: '',
    email,
    year: 'Junior',
    major: 'Undeclared',
    gender: 'Prefer not to say',
    dateOfBirth: '',
  };
}

export function composeFullName(profile: Pick<EditableProfile, 'firstName' | 'middleName' | 'lastName'>) {
  return [profile.firstName, profile.middleName, profile.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

export function buildDisplayName(profile: EditableProfile) {
  const fullName = composeFullName(profile);
  return fullName || profile.nickname.trim() || emailName(profile.email);
}

export function emailName(email: string) {
  return (email.split('@')[0] ?? 'student').trim() || 'student';
}

export function profileDetailsFromProfile(
  profile: EditableProfile,
  boardProfileVisible = false,
  profileSetupComplete = false,
  onboardingComplete = true
) {
  return {
    firstName: profile.firstName,
    middleName: profile.middleName,
    lastName: profile.lastName,
    nickname: profile.nickname,
    gender: profile.gender,
    dateOfBirth: profile.dateOfBirth,
    boardProfileVisible,
    profileSetupComplete,
    onboardingComplete,
  };
}

export function hasCompletedProfileSetup(details?: Record<string, any> | null) {
  return details?.profileSetupComplete === true;
}

export function needsInitialOnboarding(details?: Record<string, any> | null) {
  return details?.onboardingComplete === false;
}

export function profileFromSources(
  row: Record<string, any> | null | undefined,
  email: string,
  details?: Record<string, any> | null
): EditableProfile {
  const fallback = fallbackProfileFromEmail(email);
  const split = splitName(typeof row?.name === 'string' ? row.name : '');

  return {
    firstName: typeof details?.firstName === 'string' ? details.firstName : split.firstName || fallback.firstName,
    middleName: typeof details?.middleName === 'string' ? details.middleName : split.middleName,
    lastName: typeof details?.lastName === 'string' ? details.lastName : split.lastName || fallback.lastName,
    nickname: typeof details?.nickname === 'string' ? details.nickname : fallback.nickname,
    email,
    year: typeof row?.year === 'string' && row.year.trim() ? row.year : fallback.year,
    major: typeof row?.major === 'string' && row.major.trim() ? row.major : fallback.major,
    gender: typeof details?.gender === 'string' && details.gender.trim() ? details.gender : fallback.gender,
    dateOfBirth: typeof details?.dateOfBirth === 'string' ? details.dateOfBirth : '',
  };
}

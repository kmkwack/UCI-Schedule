import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Alert,
  ActivityIndicator,
  Animated,
  LayoutAnimation,
  UIManager,
  Platform,
  PanResponder,
  Modal,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Course, Quarter, TimetableSettings, DEFAULT_TIMETABLE_SETTINGS, formatCourseTimeRange12, formatMinutesAs24Hour, formatTimeOfDay12, parseTimeToMinutes, professorDisplayName, professorIsKnown, quarterKey } from '../data/courses';
import { getSchoolConfig, termLabel } from '../data/schools';
import { departmentsForSchoolId } from '../data/schoolDepartments';
import PreviewTimetable from '../components/PreviewTimetable';
import InfoChip from '../components/InfoChip';
import { MiniLoader } from '../components/ScheduleLoader';
import { supabase } from '../lib/supabase';
import ReviewsModal from '../components/ReviewsModal';
import { useTheme } from '../context/ThemeContext';
import {
  BACKDROP_DURATION,
  BACKDROP_EXIT_DURATION,
  MOTION,
  SHEET_CORNER_RADIUS,
  SHEET_DRAG_DISMISS_DISTANCE,
  SHEET_DRAG_DISMISS_VELOCITY,
  SHEET_INITIAL_TRANSLATE_Y,
  SHEET_OUT_DURATION,
  SHEET_RESET_SPRING,
  SHEET_SPRING,
} from '../utils/motion';

// GE category codes match what Anteater API stores in geCategories[]
const GE_CATEGORIES = [
  { code: 'GE-1A', label: 'GE Ia — Lower Division Writing' },
  { code: 'GE-1B', label: 'GE Ib — Upper Division Writing' },
  { code: 'GE-2',  label: 'GE II — Science and Technology' },
  { code: 'GE-3',  label: 'GE III — Social & Behavioral Sciences' },
  { code: 'GE-4',  label: 'GE IV — Arts and Humanities' },
  { code: 'GE-5A', label: 'GE Va — Quantitative Reasoning (Lower)' },
  { code: 'GE-5B', label: 'GE Vb — Quantitative Reasoning (Upper)' },
  { code: 'GE-6',  label: 'GE VI — Language Other Than English' },
  { code: 'GE-7',  label: 'GE VII — Multicultural Studies' },
  { code: 'GE-8',  label: 'GE VIII — International/Global Issues' },
];

type Props = {
  activeCourses: Course[];
  onToggleCourse: (course: Course) => void;
  onFocusCourse: (courseId: string | null) => void;
  onClose: () => void;
  selectedQuarter: Quarter;
  timetableSettings?: TimetableSettings;
  userId: string;
  school: string;
  editingCustomCourse?: Course | null;
  onReplaceCourse?: (oldId: string, newCourse: Course) => void;
  onResolveCourseConflicts?: (oldIds: string[], newCourse: Course) => void;
  onEditingHandled?: () => void;
};

type CatalogCourse = {
  id: string;
  department: string;
  courseNumber: string;
  title: string;
  units?: string;
};

const CUSTOM_DAY_OPTIONS = [
  { key: 'M', label: 'M' },
  { key: 'T', label: 'T' },
  { key: 'W', label: 'W' },
  { key: 'Th', label: 'Th' },
  { key: 'F', label: 'F' },
  { key: 'Sa', label: 'Sa' },
  { key: 'Su', label: 'Su' },
];

const DAY_FILTER_OPTIONS = [
  { key: 'M', label: 'Mon' },
  { key: 'T', label: 'Tue' },
  { key: 'W', label: 'Wed' },
  { key: 'Th', label: 'Thu' },
  { key: 'F', label: 'Fri' },
  { key: 'Sa', label: 'Sat' },
  { key: 'Su', label: 'Sun' },
];

const CUSTOM_COLOR_OPTIONS = [
  '#7C9BFF',
  '#8B5CF6',
  '#14B8A6',
  '#22C55E',
  '#F59E0B',
  '#F97316',
  '#F43F5E',
  '#64748B',
];

type CustomCourseDraft = {
  name: string;
  shortLabel: string;
  professor: string;
  location: string;
  customColor: string;
  units: string;
  startTime: string;
  endTime: string;
  selectedDays: string[];
};

const EMPTY_CUSTOM_DRAFT: CustomCourseDraft = {
  name: '',
  shortLabel: '',
  professor: '',
  location: '',
  customColor: CUSTOM_COLOR_OPTIONS[0],
  units: '',
  startTime: '',
  endTime: '',
  selectedDays: ['M', 'W', 'F'],
};

type SectionEnrollment = {
  status: string;          // "OPEN" | "Waitl" | "FULL" | "NewOnly"
  enrolled?: number;
  capacity?: number;
  waitlist?: number;
  waitlistCap?: number;
};

type ReviewSummary = {
  average: number | null;
  count: number;
};

type BannerFallbackConfig = {
  baseUrl: string;
  source: string;
  excludeTermDescriptions?: string[];
};

const SECTION_SELECT_COLUMNS = 'id,code,title,department,professor,days,time,location,units,section_label,status';
const SECTION_QUERY_PAGE_SIZE = 1000;
const COURSE_PICKER_ACCENT_BORDER = '#C7D4FF';
const departmentMemoryCache = new Map<string, string[]>();
const bannerFallbackRowsCache = new Map<string, any[]>();
const bannerTermCodeCache = new Map<string, string | null>();
const bannerDepartmentsCache = new Map<string, string[]>();

// Disabled until each Banner-backed school grants explicit permission for
// third-party course catalog caching/display.
const BANNER_FALLBACKS: Record<string, BannerFallbackConfig> = {};

const TITLE_SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'nor', 'of', 'on', 'or', 'the', 'to', 'with']);

function titleCaseWord(word: string, index: number) {
  if (!word) return word;
  if (/^[IVXLCDM]+$/i.test(word)) return word.toUpperCase();
  const lower = word.toLowerCase();
  if (index > 0 && TITLE_SMALL_WORDS.has(lower)) return lower;
  return lower.replace(/[a-z]/, (letter) => letter.toUpperCase());
}

function formatCatalogTitle(value: string | null | undefined) {
  const trimmed = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  const letters = trimmed.replace(/[^A-Za-z]/g, '');
  if (!letters || letters !== letters.toUpperCase()) return trimmed;
  return trimmed.split(' ').map(titleCaseWord).join(' ');
}

function normalizeCourseDays(value: string | null | undefined) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed || /^none$/i.test(trimmed) || /^arranged$/i.test(trimmed)) return 'TBA';
  return trimmed;
}

function courseNumberFromRow(row: any) {
  const code = String(row.code ?? '').trim();
  const department = String(row.department ?? '').trim();
  if (!department) return code;
  if (code.toUpperCase().startsWith(`${department.toUpperCase()} `)) {
    return code.slice(department.length).trim();
  }
  if (code.toUpperCase().startsWith(department.toUpperCase())) {
    return code.slice(department.length).trim();
  }
  return code;
}

function displaySectionId(sectionId: string) {
  return sectionId.split(':').pop() ?? sectionId;
}

function htmlDecode(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function cleanBannerDisplayText(value: string | number | null | undefined) {
  return htmlDecode(value == null ? '' : String(value))
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function comparableDisplayText(value: string | number | null | undefined) {
  return cleanBannerDisplayText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sectionHeaderLabel(sectionId: string, sectionLabel?: string) {
  const displayId = displaySectionId(sectionId);
  const label = sectionLabel?.trim();
  if (!label) return displayId;

  const idPattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(displayId)}([^a-z0-9]|$)`, 'i');
  if (idPattern.test(label)) return label;

  return `${displayId} · ${label}`;
}

function schoolLocationPhrases(schoolName?: string) {
  if (!schoolName) return [];
  const config = getSchoolConfig(schoolName);
  const phrases = [
    schoolName,
    config.name,
    config.shortName,
    config.campus,
    config.location,
  ];
  const [city, state] = config.location.split(',').map((part) => part.trim()).filter(Boolean);
  phrases.push(city, state);
  return [...new Set(phrases.map(comparableDisplayText).filter((phrase) => phrase.length > 1))];
}

function isGenericCampusLocation(value: string, schoolName?: string) {
  const normalized = comparableDisplayText(value);
  if (!normalized) return true;
  if (['tba', 'to be announced', 'arranged', 'none', 'n/a'].includes(normalized)) return true;
  if (/(online|remote|virtual)/i.test(value)) return false;
  if (/\bcampus$/.test(normalized)) return true;

  let remainder = normalized;
  schoolLocationPhrases(schoolName).forEach((phrase) => {
    remainder = remainder.replace(new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'g'), ' ');
  });
  remainder = remainder
    .replace(/\b(main|campus|online|remote|virtual|university|college|institute|school|state|of|the|at|and)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!remainder) return true;

  return false;
}

function normalizeLocationForDisplay(value: string | number | null | undefined, schoolName?: string) {
  const cleaned = cleanBannerDisplayText(value);
  if (!cleaned) return undefined;
  if (/(online|remote|virtual)/i.test(cleaned)) return 'Online';
  if (isGenericCampusLocation(cleaned, schoolName)) return undefined;
  return cleaned;
}

function normalizeSectionLabelForDisplay(value: string | number | null | undefined) {
  const cleaned = cleanBannerDisplayText(value);
  if (!cleaned) return undefined;

  const [rawType, ...rest] = cleaned.split(' ');
  const lowerType = rawType.toLowerCase();
  const type = lowerType === 'lecture'
    ? 'Lec'
    : lowerType === 'discussion'
      ? 'Dis'
      : lowerType === 'laboratory'
        ? 'Lab'
        : lowerType === 'seminar'
          ? 'Sem'
          : rawType;

  return [type, ...rest].join(' ').replace(/\s+/g, ' ').trim();
}

function normalizeEnrollmentStatus(value: string | number | null | undefined) {
  const cleaned = cleanBannerDisplayText(value);
  return cleaned || undefined;
}

function optionalCount(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function enrollmentCountLabel(values: { enrolled?: number; capacity?: number }) {
  if (values.enrolled !== undefined && values.capacity !== undefined && values.capacity > 0) {
    return `${values.enrolled}/${values.capacity} enrolled`;
  }
  if (values.enrolled !== undefined) return `${values.enrolled} enrolled`;
  if (values.capacity !== undefined && values.capacity > 0) return `Capacity ${values.capacity}`;
  return null;
}

function waitlistCountLabel(values: { waitlist?: number; waitlistCap?: number; waitlistCapacity?: number }) {
  const waitlistCap = values.waitlistCap ?? values.waitlistCapacity;
  if (values.waitlist !== undefined && waitlistCap !== undefined && waitlistCap > 0) {
    return `${values.waitlist}/${waitlistCap} waitlist`;
  }
  if (values.waitlist !== undefined && values.waitlist > 0) return `${values.waitlist} waitlist`;
  if (waitlistCap !== undefined && waitlistCap > 0) return `Waitlist cap ${waitlistCap}`;
  return null;
}

function sectionStatusPresentation(rawStatus: string | null | undefined) {
  const raw = rawStatus?.trim();
  if (!raw) return null;
  const compact = raw.replace(/[^a-z0-9]+/gi, '').toLowerCase();

  if (compact === 'waitl' || compact.includes('waitlist')) {
    return { label: 'Waitlist', color: '#d97706' };
  }
  if (compact === 'newonly' || compact.includes('newonly')) {
    return { label: 'New Only', color: '#d97706' };
  }
  if (compact.includes('closed') || compact === 'close' || compact.includes('notavailable') || compact.includes('notopen')) {
    return { label: 'Closed', color: '#dc2626' };
  }
  if (compact === 'full' || compact.includes('full')) {
    return { label: 'Full', color: '#dc2626' };
  }
  if (compact === 'open' || compact === 'opened' || compact === 'available' || compact.includes('open')) {
    return { label: 'Open', color: '#16a34a' };
  }

  return null;
}

async function fetchSectionRowsForTerm(school: string, quarterKeyValue: string, departments?: string[]) {
  const rows: any[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from('sections')
      .select(SECTION_SELECT_COLUMNS)
      .eq('school', school)
      .eq('quarter_key', quarterKeyValue)
      .order('code', { ascending: true })
      .range(from, from + SECTION_QUERY_PAGE_SIZE - 1);

    if (departments?.length) query = query.in('department', departments);

    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < SECTION_QUERY_PAGE_SIZE) break;
    from += SECTION_QUERY_PAGE_SIZE;
  }

  return rows;
}

function bannerPath(config: BannerFallbackConfig, path: string) {
  return `${config.baseUrl}/StudentRegistrationSsb/ssb${path}`;
}

function bannerTermMatches(description: string, term: Quarter, config: BannerFallbackConfig) {
  const text = description.toLowerCase();
  if (!text.includes(String(term.year))) return false;
  if ((config.excludeTermDescriptions ?? []).some((blocked) => text.includes(blocked))) return false;
  if (term.quarter === 'Summer1') return /summer\s*(1|i)\b/.test(text) || text.includes('summer one') || text.includes('first summer');
  if (term.quarter === 'Summer2') return /summer\s*(2|ii)\b/.test(text) || text.includes('summer two') || text.includes('second summer');
  if (term.quarter === 'Summer10wk') return text.includes('summer') && (text.includes('10') || text.includes('ten') || text.includes('full'));
  return text.includes(term.quarter.toLowerCase());
}

async function resolveBannerTermCode(schoolId: string, config: BannerFallbackConfig, term: Quarter, credentials: RequestCredentials) {
  const cacheKey = `${schoolId}:${quarterKey(term)}`;
  if (bannerTermCodeCache.has(cacheKey)) return bannerTermCodeCache.get(cacheKey) ?? null;

  const url = new URL(bannerPath(config, '/classSearch/getTerms'));
  url.searchParams.set('offset', '1');
  url.searchParams.set('max', '200');
  url.searchParams.set('searchTerm', String(term.year));

  try {
    const response = await fetch(url.toString(), { credentials, headers: { Accept: 'application/json, text/plain, */*' } });
    const terms = await response.json();
    const match = Array.isArray(terms)
      ? terms.find((row: any) => bannerTermMatches(htmlDecode(row.description ?? ''), term, config))
      : null;
    const code = match?.code ? String(match.code) : null;
    bannerTermCodeCache.set(cacheKey, code);
    return code;
  } catch (_) {
    bannerTermCodeCache.set(cacheKey, null);
    return null;
  }
}

function bannerDayLetters(meetingTime: any) {
  if (!meetingTime) return 'TBA';
  const days = [
    ['monday', 'M'],
    ['tuesday', 'T'],
    ['wednesday', 'W'],
    ['thursday', 'Th'],
    ['friday', 'F'],
    ['saturday', 'Sa'],
    ['sunday', 'Su'],
  ].filter(([key]) => meetingTime[key] === true).map(([, label]) => label);
  return days.join('') || 'TBA';
}

function normalizeBannerTime(value: string | number | null | undefined) {
  const raw = String(value ?? '').replace(/\D/g, '');
  if (raw.length < 3) return null;
  const padded = raw.padStart(4, '0');
  return `${padded.slice(0, 2)}:${padded.slice(2, 4)}`;
}

function bannerTimeLabel(meetingTime: any) {
  const start = normalizeBannerTime(meetingTime?.beginTime);
  const end = normalizeBannerTime(meetingTime?.endTime);
  return start && end ? `${start} - ${end}` : 'TBA';
}

function bannerLocation(meetingTime: any, row: any, schoolName: string) {
  const building = cleanBannerDisplayText(meetingTime?.building ?? meetingTime?.buildingDescription ?? '');
  const room = cleanBannerDisplayText(meetingTime?.room ?? '');
  return normalizeLocationForDisplay([building, room].filter(Boolean).join(' '), schoolName)
    ?? normalizeLocationForDisplay(row.campusDescription, schoolName)
    ?? null;
}

function bannerInstructors(row: any, meeting: any) {
  const people = [
    ...(Array.isArray(row.faculty) ? row.faculty : []),
    ...(Array.isArray(meeting?.faculty) ? meeting.faculty : []),
  ];
  return [...new Set(people.map((person: any) => htmlDecode(person.displayName ?? '').trim()).filter(Boolean))];
}

function bannerSectionLabel(type: string | null | undefined, sectionNumber: string | number | null | undefined) {
  const label = cleanBannerDisplayText(type || 'Section');
  const lower = label.toLowerCase();
  const shortType = lower.includes('lecture') && lower.includes('lab')
    ? 'Lec/Lab'
    : lower.includes('lecture')
      ? 'Lec'
      : lower.includes('laboratory') || lower.includes(' lab')
        ? 'Lab'
        : lower.includes('discussion')
          ? 'Dis'
          : lower.includes('seminar')
            ? 'Sem'
            : label;
  return normalizeSectionLabelForDisplay([shortType, sectionNumber].filter(Boolean).join(' ')) ?? undefined;
}

function bannerRowToSectionRow(row: any, config: BannerFallbackConfig, schoolName: string, termCode: string, qKey: string) {
  const meetings = Array.isArray(row.meetingsFaculty) ? row.meetingsFaculty : [];
  const primaryMeeting = meetings.find((item: any) => item?.meetingTime?.beginTime && item?.meetingTime?.endTime)
    ?? meetings[0]
    ?? null;
  const meetingTime = primaryMeeting?.meetingTime ?? null;
  const department = String(row.subject ?? '').trim();
  const courseNumber = String(row.courseNumber ?? '').trim();
  const instructors = bannerInstructors(row, primaryMeeting);
  const credits = Number(row.creditHourLow ?? row.creditHours ?? row.creditHourHigh);

  return {
    id: `${config.source}:${termCode}:${row.courseReferenceNumber}`,
    school: schoolName,
    quarter_key: qKey,
    department,
    code: `${department} ${courseNumber}`.trim(),
    title: htmlDecode(row.courseTitle ?? ''),
    professor: instructors[0] ?? '',
    days: bannerDayLetters(meetingTime),
    time: bannerTimeLabel(meetingTime),
    location: bannerLocation(meetingTime, row, schoolName),
    units: Number.isFinite(credits) ? credits : null,
    section_label: bannerSectionLabel(row.scheduleTypeDescription, row.sequenceNumber),
  };
}

async function fetchBannerFallbackRows(
  schoolId: string,
  schoolName: string,
  selectedQuarter: Quarter,
  departments: string[],
) {
  const config = BANNER_FALLBACKS[schoolId];
  if (!config || departments.length === 0) return [];

  const credentials: RequestCredentials = 'include';
  await fetch(bannerPath(config, '/classSearch/classSearch'), {
    credentials,
    headers: { Accept: 'text/html,application/xhtml+xml' },
  }).catch(() => null);

  const termCode = await resolveBannerTermCode(schoolId, config, selectedQuarter, credentials);
  if (!termCode) return [];

  const termBody = new URLSearchParams({
    term: termCode,
    studyPath: '',
    studyPathText: '',
    startDatepicker: '',
    endDatepicker: '',
  });
  await fetch(bannerPath(config, '/term/search'), {
    method: 'POST',
    credentials,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: termBody.toString(),
  }).catch(() => null);

  const qKey = quarterKey(selectedQuarter);
  const pageSize = 500;
  const allRows: any[] = [];
  for (const department of departments) {
    const requestedDepartment = department.trim().toUpperCase();
    const cacheKey = `${schoolId}:${qKey}:${requestedDepartment}`;
    const cachedRows = bannerFallbackRowsCache.get(cacheKey);
    if (cachedRows) {
      allRows.push(...cachedRows);
      continue;
    }

    const departmentRows: any[] = [];
    let pageOffset = 0;
    let fetchedCount = 0;
    while (true) {
      const url = new URL(bannerPath(config, '/searchResults/searchResults'));
      url.searchParams.set('txt_subject', requestedDepartment);
      url.searchParams.set('txt_courseNumber', '');
      url.searchParams.set('txt_term', termCode);
      url.searchParams.set('startDatepicker', '');
      url.searchParams.set('endDatepicker', '');
      url.searchParams.set('pageOffset', String(pageOffset));
      url.searchParams.set('pageMaxSize', String(pageSize));
      url.searchParams.set('sortColumn', 'subjectDescription');
      url.searchParams.set('sortDirection', 'asc');

      const response = await fetch(url.toString(), { credentials, headers: { Accept: 'application/json, text/plain, */*' } });
      const json = await response.json();
      if (json?.success !== true) break;
      const rows = Array.isArray(json.data) ? json.data : [];
      fetchedCount += rows.length;
      departmentRows.push(
        ...rows
          .filter((row: any) => String(row.subject ?? '').trim().toUpperCase() === requestedDepartment)
          .map((row: any) => bannerRowToSectionRow(row, config, schoolName, termCode, qKey))
      );

      const total = Number(json.totalCount ?? fetchedCount);
      if (rows.length === 0 || fetchedCount >= total) break;
      pageOffset += pageSize;
    }
    bannerFallbackRowsCache.set(cacheKey, departmentRows);
    allRows.push(...departmentRows);
  }
  return allRows;
}

async function fetchBannerDepartmentsForTerm(schoolId: string, selectedQuarter: Quarter) {
  const config = BANNER_FALLBACKS[schoolId];
  if (!config) return [];

  const cacheKey = `${schoolId}:${quarterKey(selectedQuarter)}:departments`;
  const cached = bannerDepartmentsCache.get(cacheKey);
  if (cached) return cached;

  const credentials: RequestCredentials = 'include';
  await fetch(bannerPath(config, '/classSearch/classSearch'), {
    credentials,
    headers: { Accept: 'text/html,application/xhtml+xml' },
  }).catch(() => null);

  const termCode = await resolveBannerTermCode(schoolId, config, selectedQuarter, credentials);
  if (!termCode) {
    bannerDepartmentsCache.set(cacheKey, []);
    return [];
  }

  try {
    const url = new URL(bannerPath(config, '/classSearch/get_subject'));
    url.searchParams.set('searchTerm', '');
    url.searchParams.set('term', termCode);
    url.searchParams.set('offset', '1');
    url.searchParams.set('max', '500');
    const response = await fetch(url.toString(), { credentials, headers: { Accept: 'application/json, text/plain, */*' } });
    const json = await response.json();
    const departments = Array.isArray(json)
      ? [...new Set(json.map((row: any) => String(row.code ?? '').trim()).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b))
      : [];
    bannerDepartmentsCache.set(cacheKey, departments);
    return departments;
  } catch (_) {
    bannerDepartmentsCache.set(cacheKey, []);
    return [];
  }
}

function getDaysArray(daysString: string) {
  const result: string[] = [];
  let i = 0;
  while (i < daysString.length) {
    const two = daysString.slice(i, i + 2);
    if (two === 'Th') { result.push('Th'); i += 2; continue; }
    if (two === 'Sa') { result.push('Sa'); i += 2; continue; }
    if (two === 'Su') { result.push('Su'); i += 2; continue; }
    const one = daysString[i];
    if (one === 'M') result.push('M');
    if (one === 'T') result.push('T');
    if (one === 'W') result.push('W');
    if (one === 'F') result.push('F');
    i += 1;
  }
  return result;
}

function parseHour(time: string) {
  const [h, m] = time.split(':');
  return Number(h) + Number(m) / 60;
}

function getCourseStartHour(t: string) { return parseHour(t.split(' - ')[0]); }
function getCourseEndHour(t: string) { return parseHour(t.split(' - ')[1]); }

function normalizeCustomTimeInput(value: string) {
  return value.replace(/\s+/g, ' ').toUpperCase().slice(0, 8);
}

function isValidTimeInput(value: string, allow24Hour = false) {
  return parseTimeToMinutes(value, { allow24HourEnd: allow24Hour }) != null;
}

function parseCustomEndMinutes(endValue: string, startMinutes: number | null) {
  const endMinutes = parseTimeToMinutes(endValue, { allow24HourEnd: true });
  if (endMinutes === 0 && startMinutes != null && startMinutes > 0) return 24 * 60;
  return endMinutes;
}

function buildCustomCourse(draft: CustomCourseDraft): Course {
  const trimmedName = draft.name.trim();
  const trimmedShortLabel = draft.shortLabel.trim();
  const trimmedProfessor = draft.professor.trim();
  const trimmedLocation = draft.location.trim();
  const trimmedUnits = draft.units.trim();
  const startMinutes = parseTimeToMinutes(draft.startTime);
  const endMinutes = parseCustomEndMinutes(draft.endTime, startMinutes);
  const startTime = startMinutes == null ? draft.startTime : formatMinutesAs24Hour(startMinutes);
  const endTime = endMinutes == null ? draft.endTime : formatMinutesAs24Hour(endMinutes);
  const time = `${startTime} - ${endTime}`;
  const days = draft.selectedDays.join('');
  const shortCode = (trimmedShortLabel || trimmedName).toUpperCase();

  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    code: shortCode,
    title: trimmedName,
    professor: trimmedProfessor,
    days,
    time,
    department: 'CUSTOM',
    location: trimmedLocation || undefined,
    units: trimmedUnits ? Number(trimmedUnits) : undefined,
    sectionLabel: undefined,
    customColor: draft.customColor,
  };
}

function courseToCustomDraft(course: Course): CustomCourseDraft {
  const [startTime = '', endTime = ''] = course.time.split(' - ');
  const shortLabel = course.code !== course.title.toUpperCase() ? course.code : '';
  return {
    name: course.title,
    shortLabel,
    professor: course.professor ?? '',
    location: course.location ?? '',
    customColor: course.customColor ?? CUSTOM_COLOR_OPTIONS[0],
    units: course.units != null ? String(course.units) : '',
    startTime: formatTimeOfDay12(startTime),
    endTime: formatTimeOfDay12(endTime),
    selectedDays: getDaysArray(course.days),
  };
}

export default function CoursePickerScreen({
  activeCourses,
  onToggleCourse,
  onFocusCourse,
  onClose,
  selectedQuarter,
  timetableSettings = DEFAULT_TIMETABLE_SETTINGS,
  userId,
  school,
  editingCustomCourse,
  onReplaceCourse,
  onResolveCourseConflicts,
  onEditingHandled,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const schoolConfig = getSchoolConfig(school);
  const courseAccent = colors.brand;
  const courseAccentSoft = colors.brandBg;
  const courseAccentBorder = isDark ? 'rgba(122,162,255,0.44)' : COURSE_PICKER_ACCENT_BORDER;
  const coursePickerBg = colors.bg;
  const coursePickerSheetBg = colors.card;
  const coursePickerInputBg = colors.inputBg;
  const coursePickerRaisedBg = isDark ? colors.bgTertiary : '#f9fafb';
  const coursePickerLoadingBg = isDark ? colors.bgTertiary : '#f8fbff';
  const coursePickerLoadingBorder = isDark ? colors.border : '#dbe4ff';
  const coursePickerNeutralChipBg = isDark ? colors.bgTertiary : '#f3f4f6';
  const coursePickerNeutralChipText = isDark ? colors.textSecondary : '#6b7280';
  const coursePickerAddedBg = isDark ? colors.bgTertiary : '#e5e7eb';
  const coursePickerAddedText = isDark ? colors.textSecondary : '#374151';
  const coursePickerKeyboardBacking = coursePickerSheetBg;
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
  const [searchText, setSearchText] = useState('');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [selectedGE, setSelectedGE] = useState('');
  const [selectedDayFilters, setSelectedDayFilters] = useState<string[]>([]);
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);
  const deptSheetSlideAnim = useRef(new Animated.Value(SHEET_INITIAL_TRANSLATE_Y)).current;
  const deptBackdropAnim = useRef(new Animated.Value(0)).current;
  const customizeBackdropAnim = useRef(new Animated.Value(0)).current;
  const customizeSheetAnim = useRef(new Animated.Value(SHEET_INITIAL_TRANSLATE_Y)).current;
  const customizeKeyboardAnim = useRef(new Animated.Value(0)).current;
  const closeDeptModalRef = useRef<(() => void) | null>(null);
  const deptDragPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gs) => {
      if (gs.dy > 0) deptSheetSlideAnim.setValue(gs.dy);
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > SHEET_DRAG_DISMISS_DISTANCE || gs.vy > SHEET_DRAG_DISMISS_VELOCITY) {
        closeDeptModalRef.current?.();
      } else {
        Animated.spring(deptSheetSlideAnim, { toValue: 0, useNativeDriver: true, ...SHEET_RESET_SPRING }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(deptSheetSlideAnim, { toValue: 0, useNativeDriver: true, ...SHEET_RESET_SPRING }).start();
    },
  })).current;
  const [deptSearch, setDeptSearch] = useState('');
  const [showGESublist, setShowGESublist] = useState(false);
  const [keyboardBackingHeight, setKeyboardBackingHeight] = useState(0);
  const [catalogCourses, setCatalogCourses] = useState<CatalogCourse[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogReloadKey, setCatalogReloadKey] = useState(0);
  const [expandedCourseIds, setExpandedCourseIds] = useState<Record<string, boolean>>({});
  const [sectionsMap, setSectionsMap] = useState<Record<string, Course[]>>({});
  const [previewCourse, setPreviewCourse] = useState<Course | null>(null);
  const [enrollmentCache, setEnrollmentCache] = useState<Record<string, SectionEnrollment>>({});
  const [enrollmentLoadingIds, setEnrollmentLoadingIds] = useState<Set<string>>(new Set());
  const [reviewSummaryCache, setReviewSummaryCache] = useState<Record<string, ReviewSummary>>({});
  const [savedCountCache, setSavedCountCache] = useState<Record<string, number>>({});
  const [savedByCurrentUserSectionIds, setSavedByCurrentUserSectionIds] = useState<Set<string>>(new Set());
  const [reviewsCourse, setReviewsCourse] = useState<Course | null>(null);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [customCourseDraft, setCustomCourseDraft] = useState<CustomCourseDraft>(EMPTY_CUSTOM_DRAFT);
  const editingCourseIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!editingCustomCourse) return;
    editingCourseIdRef.current = editingCustomCourse.id;
    setCustomCourseDraft(courseToCustomDraft(editingCustomCourse));
    customizeBackdropAnim.setValue(0);
    customizeSheetAnim.setValue(SHEET_INITIAL_TRANSLATE_Y);
    setShowCustomizeModal(true);
    Animated.parallel([
      Animated.spring(customizeSheetAnim, { toValue: 0, useNativeDriver: true, ...SHEET_SPRING }),
      Animated.timing(customizeBackdropAnim, { toValue: 1, duration: BACKDROP_DURATION, useNativeDriver: true }),
    ]).start();
  }, [editingCustomCourse]);

  function openDeptModal() {
    setDeptSearch('');
    deptSheetSlideAnim.setValue(SHEET_INITIAL_TRANSLATE_Y);
    deptBackdropAnim.setValue(0);
    setDeptDropdownOpen(true);
    Animated.parallel([
      Animated.spring(deptSheetSlideAnim, { toValue: 0, useNativeDriver: true, ...SHEET_SPRING }),
      Animated.timing(deptBackdropAnim, { toValue: 1, duration: BACKDROP_DURATION, useNativeDriver: true }),
    ]).start();
  }

  function closeDeptModal(callback?: () => void) {
    Animated.parallel([
      Animated.timing(deptSheetSlideAnim, { toValue: SHEET_INITIAL_TRANSLATE_Y, duration: SHEET_OUT_DURATION, easing: MOTION.easing.exit, useNativeDriver: true }),
      Animated.timing(deptBackdropAnim, { toValue: 0, duration: BACKDROP_EXIT_DURATION, useNativeDriver: true }),
    ]).start(() => {
      setDeptDropdownOpen(false);
      setShowGESublist(false);
      callback?.();
    });
  }
  closeDeptModalRef.current = closeDeptModal;

  // Global search state (cross-department, triggers when no dept selected + text >= 2)
  const [globalCatalog, setGlobalCatalog] = useState<CatalogCourse[]>([]);
  const [globalSectionsMap, setGlobalSectionsMap] = useState<Record<string, Course[]>>({});
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  function buildCatalogFromRows(rows: any[]): { catalog: CatalogCourse[]; sections: Record<string, Course[]> } {
    const catalogMap: Record<string, CatalogCourse> = {};
    const rawSections: Record<string, any[]> = {};

    rows.forEach((row: any) => {
      const department = String(row.department ?? '').trim();
      const courseNumber = courseNumberFromRow(row);
      const courseId = `${department}::${courseNumber}`;
      const title = formatCatalogTitle(row.title);
      if (!catalogMap[courseId]) {
        catalogMap[courseId] = { id: courseId, department, courseNumber, title, units: row.units?.toString() };
        rawSections[courseId] = [];
      } else {
        const existing = parseInt(catalogMap[courseId].units ?? '0') || 0;
        const incoming = row.units ?? 0;
        if (incoming > existing) catalogMap[courseId].units = incoming.toString();
      }
      rawSections[courseId].push(row);
    });

    const sections: Record<string, Course[]> = {};
    Object.entries(rawSections).forEach(([courseId, sectionRows]) => {
      const sorted = sectionRows.slice().sort((a, b) => {
        const typeOrder = (t: string) => ({ Lec: 0, Dis: 1, Lab: 2 }[t] ?? 3);
        const aType = a.section_label?.split(' ')[0] ?? '';
        const bType = b.section_label?.split(' ')[0] ?? '';
        if (typeOrder(aType) !== typeOrder(bType)) return typeOrder(aType) - typeOrder(bType);
        return (a.section_label ?? '').localeCompare(b.section_label ?? '', undefined, { numeric: true });
      });
      sections[courseId] = sorted.map((row: any): Course => ({
        id: row.id.split('::')[0],
        code: cleanBannerDisplayText(row.code),
        title: formatCatalogTitle(row.title),
        professor: professorDisplayName(cleanBannerDisplayText(row.professor)),
        days: normalizeCourseDays(row.days),
        time: row.time ?? 'TBA',
        department: cleanBannerDisplayText(row.department),
        location: normalizeLocationForDisplay(row.location, row.school ?? school),
        units: row.units ?? undefined,
        sectionLabel: normalizeSectionLabelForDisplay(row.section_label),
        enrollmentStatus: normalizeEnrollmentStatus(row.status),
        enrolled: optionalCount(row.enrolled),
        capacity: optionalCount(row.capacity),
        waitlist: optionalCount(row.waitlist),
        waitlistCapacity: optionalCount(row.waitlist_capacity),
      }));
    });

    return { catalog: Object.values(catalogMap), sections };
  }

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => {
      setKeyboardBackingHeight(e.endCoordinates.height);
      Animated.timing(customizeKeyboardAnim, {
        toValue: e.endCoordinates.height,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
    });
    const hide = Keyboard.addListener(hideEvent, (e) => {
      setKeyboardBackingHeight(0);
      Animated.timing(customizeKeyboardAnim, {
        toValue: 0,
        duration: (e as any).duration || 250,
        useNativeDriver: false,
      }).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  const hasSelectedDepartments = selectedDepts.length > 0;
  const isUciSchool = schoolConfig.id === 'uci';

  // Clear all department/GE filters when school changes
  const prevSchoolRef = useRef(school);
  useEffect(() => {
    if (prevSchoolRef.current !== school) {
      prevSchoolRef.current = school;
      setSelectedDepts([]);
      setSelectedGE('');
      setSearchText('');
    }
  }, [school]);

  // Also clear GE if switching to non-UCI mid-session
  useEffect(() => {
    if (!isUciSchool && selectedGE) {
      setSelectedGE('');
    }
  }, [isUciSchool, selectedGE]);

  const hasSelectedCategory = hasSelectedDepartments || !!selectedGE;
  const isAllDepartmentsSelected = !hasSelectedDepartments && !selectedGE;
  const shouldLoadSavedCounts = hasSelectedCategory || isAllDepartmentsSelected || searchText.trim().length >= 2;
  const selectedDeptKey = selectedDepts.join('|');
  const localDepartmentOptions = useMemo(() => departmentsForSchoolId(schoolConfig.id), [schoolConfig.id]);
  const activeCourseIds = useMemo(() => new Set(activeCourses.map((course) => course.id)), [activeCourses]);
  const departmentOptions = availableDepartments.length > 0
    ? availableDepartments
    : localDepartmentOptions;

  useEffect(() => {
    const qk = quarterKey(selectedQuarter);
    let cancelled = false;
    const cachedDepartments = departmentMemoryCache.get(school);
    const instantDepartments = cachedDepartments?.length ? cachedDepartments : localDepartmentOptions;

    setAvailableDepartments(instantDepartments);

    void (async () => {
      const departmentsSet = new Set<string>(instantDepartments);
      let hasAuthoritativeDepartments = departmentsSet.size > 0;
      const { data: departmentRows, error: departmentError } = await supabase
        .from('school_departments')
        .select('department')
        .eq('school', school)
        .eq('active', true)
        .order('department', { ascending: true });

      if (cancelled) return;
      if (!departmentError && departmentRows && departmentRows.length > 0) {
        departmentRows.forEach((row: any) => {
          if (row.department) departmentsSet.add(row.department);
        });
        hasAuthoritativeDepartments = departmentsSet.size > 0;
        if (departmentsSet.size > 0) {
          const departments = [...departmentsSet].sort((a, b) => a.localeCompare(b));
          departmentMemoryCache.set(school, departments);
          setAvailableDepartments(departments);
        }
      }

      const PAGE_SIZE = 1000;
      let sectionError: any = null;
      let selectedTermDepartmentCount = 0;
      const selectedTermDepartmentsSet = new Set<string>();

      async function scanSectionDepartments(queryQuarterKey?: string) {
        let from = 0;
        while (!cancelled) {
          let query = supabase
            .from('sections')
            .select('department')
            .eq('school', school)
            .range(from, from + PAGE_SIZE - 1);

          if (queryQuarterKey) query = query.eq('quarter_key', queryQuarterKey);

          const { data, error } = await query;

          if (error) {
            sectionError = error;
            break;
          }

          (data ?? []).forEach((row: any) => {
            if (row.department) {
              departmentsSet.add(row.department);
              if (queryQuarterKey) {
                selectedTermDepartmentCount += 1;
                selectedTermDepartmentsSet.add(row.department);
              }
            }
          });

          if (!data || data.length < PAGE_SIZE) break;
          from += PAGE_SIZE;
        }
      }

      await scanSectionDepartments(qk);
      if (cancelled) return;

      if (selectedTermDepartmentsSet.size > 0) {
        const sourceDepartments = hasAuthoritativeDepartments || localDepartmentOptions.length > 0
          ? departmentsSet
          : selectedTermDepartmentsSet;
        const departments = [...sourceDepartments].sort((a, b) => a.localeCompare(b));
        departmentMemoryCache.set(school, departments);
        setAvailableDepartments(departments);
        return;
      }

      if (BANNER_FALLBACKS[schoolConfig.id]) {
        const liveDepartments = await fetchBannerDepartmentsForTerm(schoolConfig.id, selectedQuarter);
        if (cancelled) return;
        liveDepartments.forEach((department) => departmentsSet.add(department));
        if (liveDepartments.length > 0) {
          const departments = [...departmentsSet].sort((a, b) => a.localeCompare(b));
          departmentMemoryCache.set(school, departments);
          setAvailableDepartments(departments);
          return;
        }
      }

      if (!hasAuthoritativeDepartments) {
        await scanSectionDepartments();
      }

      // If the selected term has no rows yet, still show the school's departments
      // so the picker is not blank while the user switches to a seeded term.
      // For supported schools with local indexes, avoid scanning every historical
      // row; seeders should backfill school_departments as the long-term source.
      if (!cancelled && !hasAuthoritativeDepartments && selectedTermDepartmentCount === 0 && localDepartmentOptions.length === 0) {
        await scanSectionDepartments();
      }

      if (cancelled) return;
      if (departmentsSet.size === 0 && (departmentError || sectionError)) {
        console.warn('Failed to load departments:', departmentError ?? sectionError);
        setAvailableDepartments([]);
        return;
      }

      const departments = [...departmentsSet].sort((a, b) => a.localeCompare(b));
      departmentMemoryCache.set(school, departments);
      setAvailableDepartments(departments);
    })();

    return () => {
      cancelled = true;
    };
  }, [localDepartmentOptions, schoolConfig.id, selectedQuarter, school]);

  useEffect(() => {
    if (hasSelectedCategory || searchText.trim().length < 2) {
      setGlobalCatalog([]);
      setGlobalSectionsMap({});
      return;
    }

    const q = searchText.trim();
    // Normalize "eecs125" → "eecs 125" so it matches DB codes stored with a space
    const qNorm = q.replace(/^([a-zA-Z]+)\s*(\d+.*)$/i, '$1 $2').trim();
    setGlobalSearchLoading(true);

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const qk = quarterKey(selectedQuarter);
        const baseClauses = `code.ilike.%${q}%,title.ilike.%${q}%,professor.ilike.%${q}%,id.ilike.%${q}%`;
        const orClause = qNorm !== q
          ? `${baseClauses},code.ilike.%${qNorm}%,id.ilike.%${qNorm}%`
          : baseClauses;
        const { data, error } = await supabase
          .from('sections')
          .select(SECTION_SELECT_COLUMNS)
          .eq('school', school)
          .eq('quarter_key', qk)
          .or(orClause)
          .order('code', { ascending: true })
          .limit(500);

        if (cancelled) return;
        if (!error && data) {
          const { catalog, sections } = buildCatalogFromRows(data);
          setGlobalCatalog(catalog);
          setGlobalSectionsMap(sections);
        }
      } catch (err) {
        console.warn('Global search error:', err);
      } finally {
        if (!cancelled) setGlobalSearchLoading(false);
      }
    }, 400);

    return () => { cancelled = true; clearTimeout(timer); setGlobalSearchLoading(false); };
  }, [searchText, hasSelectedCategory, selectedQuarter, school]);

  useEffect(() => {
    if (!shouldLoadSavedCounts || !userId) {
      setSavedCountCache({});
      setSavedByCurrentUserSectionIds(new Set());
      return;
    }

    const qk = quarterKey(selectedQuarter);
    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase
        .from('timetables')
        .select('user_id, courses')
        .eq('school', school)
        .eq('quarter_key', qk);

      if (cancelled) return;
      if (error) {
        console.warn('Failed to load ClassMate saved counts:', error);
        setSavedCountCache({});
        setSavedByCurrentUserSectionIds(new Set());
        return;
      }

      const sectionUsers = new Map<string, Set<string>>();
      const currentUserSectionIds = new Set<string>();
      ((data ?? []) as Array<{ user_id: string; courses: Course[] | null }>).forEach((row) => {
        const uid = row.user_id;
        const seenSections = new Set<string>();
        (row.courses ?? []).forEach((course) => {
          if (!course?.id) return;
          seenSections.add(course.id);
        });
        seenSections.forEach((sectionId) => {
          const users = sectionUsers.get(sectionId) ?? new Set<string>();
          users.add(uid);
          sectionUsers.set(sectionId, users);
          if (uid === userId) currentUserSectionIds.add(sectionId);
        });
      });

      setSavedCountCache(
        Object.fromEntries(Array.from(sectionUsers.entries()).map(([sectionId, users]) => [sectionId, users.size]))
      );
      setSavedByCurrentUserSectionIds(currentUserSectionIds);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedQuarter, school, shouldLoadSavedCounts, userId]);

  useEffect(() => {
    if (selectedGE) {
      return;
    }

    setCatalogLoading(true);
    setCatalogCourses([]);
    setSectionsMap({});
    setExpandedCourseIds({});
    setPreviewCourse(null);

    const qk = quarterKey(selectedQuarter);
    let cancelled = false;
    void (async () => {
      try {
        let rows = await fetchSectionRowsForTerm(
          school,
          qk,
          hasSelectedDepartments ? selectedDepts : undefined
        );
        if (cancelled) return;
        if (BANNER_FALLBACKS[schoolConfig.id]) {
          const departmentsWithRows = new Set(rows.map((row: any) => String(row.department ?? '').trim().toUpperCase()).filter(Boolean));
          const requestedDepartments = hasSelectedDepartments ? selectedDepts : departmentOptions;
          const missingDepartments = requestedDepartments.filter((dept) => !departmentsWithRows.has(dept.trim().toUpperCase()));
          try {
            if (missingDepartments.length > 0) {
              const liveRows = await fetchBannerFallbackRows(schoolConfig.id, school, selectedQuarter, missingDepartments);
              const merged = new Map<string, any>();
              rows.forEach((row: any) => merged.set(String(row.id), row));
              liveRows.forEach((row: any) => merged.set(String(row.id), row));
              rows = [...merged.values()];
            }
          } catch (fallbackError) {
            console.warn('Banner fallback fetch failed:', fallbackError);
          }
        }
        const { catalog, sections } = buildCatalogFromRows(rows);
        setCatalogCourses(catalog);
        setSectionsMap(sections);
      } catch (error) {
        if (!cancelled) console.warn('Supabase fetch failed:', error);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalogReloadKey, departmentOptions, hasSelectedDepartments, selectedDeptKey, selectedGE, selectedQuarter, school, schoolConfig.id]);

  useEffect(() => {
    if (!selectedGE) {
      return;
    }

    setCatalogLoading(true);
    setCatalogCourses([]);
    setSectionsMap({});
    setExpandedCourseIds({});
    setPreviewCourse(null);

    const qk = quarterKey(selectedQuarter);
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('sections')
          .select(SECTION_SELECT_COLUMNS)
          .eq('school', school)
          .eq('quarter_key', qk)
          .contains('ge_categories', [selectedGE]);
        if (cancelled) return;
        if (error) { console.warn('GE fetch failed:', error); return; }
        const { catalog, sections } = buildCatalogFromRows(data ?? []);
        setCatalogCourses(catalog);
        setSectionsMap(sections);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedGE, selectedQuarter, school]);

  const fetchEnrollment = async (course: CatalogCourse) => {
    if (schoolConfig.id !== 'uci') return;
    if (enrollmentLoadingIds.has(course.id)) return;
    const sections = (isGlobalSearch ? globalSectionsMap : sectionsMap)[course.id] ?? [];
    if (sections.length > 0 && sections.every((s) => s.id in enrollmentCache)) return;

    setEnrollmentLoadingIds((prev) => new Set(prev).add(course.id));
    try {
      const { year, quarter } = selectedQuarter;
      const url = `https://anteaterapi.com/v2/rest/websoc?department=${encodeURIComponent(course.department)}&courseNumber=${encodeURIComponent(course.courseNumber)}&year=${year}&quarter=${quarter}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!json.ok) return;

      const updates: Record<string, SectionEnrollment> = {};
      for (const school of json.data?.schools ?? []) {
        for (const dept of school.departments ?? []) {
          for (const c of dept.courses ?? []) {
            for (const s of c.sections ?? []) {
              updates[s.sectionCode] = {
                status: s.status ?? 'OPEN',
                enrolled: optionalCount(s.numCurrentlyEnrolled?.totalEnrolled),
                capacity: optionalCount(s.maxCapacity),
                waitlist: optionalCount(s.numOnWaitlist),
                waitlistCap: optionalCount(s.numWaitlistCap),
              };
            }
          }
        }
      }
      setEnrollmentCache((prev) => ({ ...prev, ...updates }));
    } catch (_) {
      // silently fail — section rows just won't show status
    } finally {
      setEnrollmentLoadingIds((prev) => { const s = new Set(prev); s.delete(course.id); return s; });
    }
  };

  const fetchReviewSummary = async (courseCode: string, sectionType: string) => {
    const cacheKey = `${courseCode}::${sectionType}`;
    if (reviewSummaryCache[cacheKey]?.count) return;

    const { data, error } = await supabase
      .from('reviews')
      .select('rating')
      .eq('school', school)
      .eq('course_code', courseCode)
      .eq('section_type', sectionType);

    if (error) {
      console.warn('Failed to load ClassMate review summary:', error);
      setReviewSummaryCache((prev) => ({ ...prev, [cacheKey]: { average: null, count: 0 } }));
      return;
    }

    const ratings = ((data ?? []) as Array<{ rating: number | null }>)
      .map((row) => Number(row.rating))
      .filter((value) => Number.isFinite(value));

    setReviewSummaryCache((prev) => ({
      ...prev,
      [cacheKey]: {
        average: ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null,
        count: ratings.length,
      },
    }));
  };

  const handleExpandCourse = (course: CatalogCourse) => {
    const nextExpanded = !expandedCourseIds[course.id];
    if (nextExpanded) {
      LayoutAnimation.configureNext({
        duration: 280,
        create: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.opacity },
        update: { type: LayoutAnimation.Types.easeOut },
        delete: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.opacity },
      });
    } else {
      LayoutAnimation.configureNext({
        duration: 280,
        create: { type: LayoutAnimation.Types.easeIn, property: LayoutAnimation.Properties.opacity },
        update: { type: LayoutAnimation.Types.easeIn },
        delete: { type: LayoutAnimation.Types.easeIn, property: LayoutAnimation.Properties.opacity },
      });
    }
    setExpandedCourseIds((prev) => {
      const next = { ...prev };
      if (nextExpanded) next[course.id] = true;
      else delete next[course.id];
      return next;
    });
    if (nextExpanded) {
      fetchEnrollment(course);
      const activeSections = (isGlobalSearch ? globalSectionsMap : sectionsMap)[course.id] ?? [];
      const courseCode = `${course.department} ${course.courseNumber}`.trim();
      const sectionTypes = [...new Set(activeSections.map(s => s.sectionLabel?.split(' ')[0]).filter((t): t is string => !!t))];
      for (const st of sectionTypes) void fetchReviewSummary(courseCode, st);
    }
    setPreviewCourse(null);
  };

  const visibleSavedCountForSection = (sectionId: string) => {
    const cachedCount = savedCountCache[sectionId] ?? 0;
    const wasSavedByCurrentUser = savedByCurrentUserSectionIds.has(sectionId);
    const isCurrentlySaved = activeCourseIds.has(sectionId);
    return Math.max(
      0,
      cachedCount
        + (isCurrentlySaved && !wasSavedByCurrentUser ? 1 : 0)
        - (!isCurrentlySaved && wasSavedByCurrentUser ? 1 : 0)
    );
  };

  const getConflicts = (candidate: Course) => {
    if (candidate.time === 'TBA' || candidate.days === 'TBA') return [];
    const candidateDays = getDaysArray(candidate.days);
    const candidateStart = getCourseStartHour(candidate.time);
    const candidateEnd = getCourseEndHour(candidate.time);

    return activeCourses.filter((existing) => {
      if (existing.id === candidate.id) return false;
      if (existing.time === 'TBA' || existing.days === 'TBA') return false;
      const existingDays = getDaysArray(existing.days);
      if (!candidateDays.some((d) => existingDays.includes(d))) return false;
      const existingStart = getCourseStartHour(existing.time);
      const existingEnd = getCourseEndHour(existing.time);
      return !(candidateEnd <= existingStart || candidateStart >= existingEnd);
    });
  };

  const handleAddToTable = (course: Course) => {
    const isAdded = activeCourseIds.has(course.id);
    if (isAdded) {
      onToggleCourse(course);
      onFocusCourse(null);
      setPreviewCourse(null);
      return;
    }

    const conflictCourses = getConflicts(course);
    if (conflictCourses.length > 0) {
      const conflictLabel = conflictCourses.length === 1
        ? `'${conflictCourses[0].title}'`
        : `${conflictCourses.length} existing classes`;
      Alert.alert(
        'Add subject',
        `This schedule conflicts with ${conflictLabel}. The existing ${conflictCourses.length === 1 ? 'class' : 'classes'} will be removed from your timetable if you add this. Add this subject?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add',
            onPress: () => {
              if (onResolveCourseConflicts) {
                onResolveCourseConflicts(conflictCourses.map((conflict) => conflict.id), course);
              } else if (onReplaceCourse && conflictCourses.length === 1) {
                onReplaceCourse(conflictCourses[0].id, course);
              } else {
                onToggleCourse(course);
              }
              onFocusCourse(course.id);
              setPreviewCourse(course);
            },
          },
        ]
      );
      return;
    }

    onToggleCourse(course);
    onFocusCourse(course.id);
    setPreviewCourse(course);
  };

  const resetCustomCourseDraft = () => {
    setCustomCourseDraft(EMPTY_CUSTOM_DRAFT);
  };

  const openCustomizeModal = () => {
    resetCustomCourseDraft();
    customizeBackdropAnim.setValue(0);
    customizeSheetAnim.setValue(SHEET_INITIAL_TRANSLATE_Y);
    customizeKeyboardAnim.setValue(0);
    setShowCustomizeModal(true);
    Animated.parallel([
      Animated.spring(customizeSheetAnim, { toValue: 0, useNativeDriver: true, ...SHEET_SPRING }),
      Animated.timing(customizeBackdropAnim, { toValue: 1, duration: BACKDROP_DURATION, useNativeDriver: true }),
    ]).start();
  };

  const closeCustomizeModal = () => {
    Animated.parallel([
      Animated.timing(customizeSheetAnim, { toValue: SHEET_INITIAL_TRANSLATE_Y, duration: SHEET_OUT_DURATION, easing: MOTION.easing.exit, useNativeDriver: true }),
      Animated.timing(customizeBackdropAnim, { toValue: 0, duration: BACKDROP_EXIT_DURATION, useNativeDriver: true }),
    ]).start(() => {
      setShowCustomizeModal(false);
      if (editingCourseIdRef.current) {
        editingCourseIdRef.current = null;
        onEditingHandled?.();
      }
    });
  };

  const confirmCloseCustomizeModal = () => {
    const { name, shortLabel, professor, location, units, startTime, endTime } = customCourseDraft;
    const hasInput = [name, shortLabel, professor, location, units, startTime, endTime].some((v) => v.trim() !== '');
    if (!hasInput) { closeCustomizeModal(); return; }
    Alert.alert(
      'Discard block?',
      'Changes will not be saved.',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: closeCustomizeModal },
      ]
    );
  };

  const toggleCustomDay = (dayKey: string) => {
    setCustomCourseDraft((prev) => {
      const exists = prev.selectedDays.includes(dayKey);
      const nextDays = exists
        ? prev.selectedDays.filter((day) => day !== dayKey)
        : [...prev.selectedDays, dayKey].sort(
            (a, b) =>
              CUSTOM_DAY_OPTIONS.findIndex((option) => option.key === a) -
              CUSTOM_DAY_OPTIONS.findIndex((option) => option.key === b)
          );
      return { ...prev, selectedDays: nextDays };
    });
  };

  const toggleDayFilter = (dayKey: string) => {
    setSelectedDayFilters((prev) => {
      const exists = prev.includes(dayKey);
      if (exists) return prev.filter((day) => day !== dayKey);
      return [...prev, dayKey].sort(
        (a, b) =>
          DAY_FILTER_OPTIONS.findIndex((option) => option.key === a) -
          DAY_FILTER_OPTIONS.findIndex((option) => option.key === b)
      );
    });
  };

  const sectionMatchesDayFilter = (course: Course) => {
    if (selectedDayFilters.length === 0) return true;
    if (course.days === 'TBA') return false;
    const courseDays = getDaysArray(course.days);
    return selectedDayFilters.some((day) => courseDays.includes(day));
  };

  const isPrimaryClassSection = (course: Course) => {
    const sectionType = course.sectionLabel?.split(' ')[0]?.toLowerCase() ?? '';
    return !['dis', 'discussion', 'disc', 'lab', 'laboratory', 'rec', 'recitation', 'qiz', 'quiz', 'tut', 'tutorial', 'act', 'activity'].includes(sectionType);
  };

  const sectionMatchesPrimaryClassDayFilter = (course: Course) => (
    isPrimaryClassSection(course) && sectionMatchesDayFilter(course)
  );

  const handleCreateCustomCourse = () => {
    const trimmedName = customCourseDraft.name.trim();
    if (!trimmedName) {
        Alert.alert('Missing name', 'Add a name for your custom block.');
      return;
    }
    if (customCourseDraft.selectedDays.length === 0) {
      Alert.alert('Missing days', 'Choose at least one day for this class.');
      return;
    }
    if (!isValidTimeInput(customCourseDraft.startTime) || !isValidTimeInput(customCourseDraft.endTime, true)) {
      Alert.alert('Invalid time', 'Use a time like 1:00 PM or 9:30 AM.');
      return;
    }
    const customStartMinutes = parseTimeToMinutes(customCourseDraft.startTime);
    const customEndMinutes = parseCustomEndMinutes(customCourseDraft.endTime, customStartMinutes);
    if (customStartMinutes == null || customEndMinutes == null || customEndMinutes <= customStartMinutes) {
      Alert.alert('Invalid range', 'End time needs to be later than the start time.');
      return;
    }

    Keyboard.dismiss();
    const customCourse = buildCustomCourse(customCourseDraft);
    closeCustomizeModal();

    const oldId = editingCourseIdRef.current;
    if (oldId && onReplaceCourse) {
      onReplaceCourse(oldId, { ...customCourse, id: oldId });
      editingCourseIdRef.current = null;
      onEditingHandled?.();
    } else {
      handleAddToTable(customCourse);
      setPreviewCourse(customCourse);
    }

    resetCustomCourseDraft();
  };

  const isGlobalSearch = !hasSelectedCategory && searchText.trim().length >= 2;

  const filteredCatalog = useMemo(() => {
    const stripH = (s: string) => s.replace(/^H/i, '');
    const shouldGroupByDepartment = isGlobalSearch || selectedDepts.length !== 1;
    const sortCatalog = (list: CatalogCourse[]) =>
      [...list].sort((a, b) => {
        if (shouldGroupByDepartment && a.department !== b.department)
          return a.department.localeCompare(b.department);
        const numA = parseInt(stripH(a.courseNumber)) || 0;
        const numB = parseInt(stripH(b.courseNumber)) || 0;
        if (numA !== numB) return numA - numB;
        const suffixA = stripH(a.courseNumber).replace(/^\d+/, '');
        const suffixB = stripH(b.courseNumber).replace(/^\d+/, '');
        return suffixA.localeCompare(suffixB);
      });

    const activeSectionsMap = isGlobalSearch ? globalSectionsMap : sectionsMap;
    const applyDayFilter = (list: CatalogCourse[]) => {
      if (selectedDayFilters.length === 0) return list;
      return list.filter((course) => (activeSectionsMap[course.id] ?? []).some(sectionMatchesPrimaryClassDayFilter));
    };

    if (isGlobalSearch) return sortCatalog(applyDayFilter(globalCatalog));

    const list = !searchText
      ? catalogCourses
      : catalogCourses.filter((c) => {
          const q = searchText.toLowerCase();
          if (
            c.courseNumber.toLowerCase().includes(q) ||
            c.title.toLowerCase().includes(q) ||
            c.department.toLowerCase().includes(q) ||
            `${c.department} ${c.courseNumber}`.toLowerCase().includes(q)
          ) return true;
          return (sectionsMap[c.id] ?? []).some((s) =>
            s.professor.toLowerCase().includes(q) ||
            s.id.toLowerCase().includes(q)
          );
        });

    return sortCatalog(applyDayFilter(list));
  }, [catalogCourses, searchText, sectionsMap, isGlobalSearch, globalCatalog, globalSectionsMap, selectedDayFilters, selectedDepts.length]);

  const filteredDepts = useMemo(() => {
    if (!deptSearch) return departmentOptions;
    const q = deptSearch.toLowerCase();
    return departmentOptions.filter((d) => d.toLowerCase().includes(q));
  }, [departmentOptions, deptSearch]);

  const filteredGECategories = useMemo(() => {
    if (!deptSearch) return GE_CATEGORIES;
    const q = deptSearch.toLowerCase();
    return GE_CATEGORIES.filter((g) => g.label.toLowerCase().includes(q) || g.code.toLowerCase().includes(q));
  }, [deptSearch]);

  const selectedGELabel = selectedGE ? GE_CATEGORIES.find((g) => g.code === selectedGE)?.label ?? selectedGE : '';
  const selectedCategorySummary = hasSelectedDepartments
    ? selectedDepts.length === 1
      ? selectedDepts[0]
      : `${selectedDepts.length} departments selected`
    : selectedGELabel || 'All Departments';
  const isCourseListLoading = (catalogLoading && !selectedGE) || (globalSearchLoading && isGlobalSearch);
  const courseLoadingTitle = isGlobalSearch ? 'Searching courses' : 'Loading courses';
  const courseLoadingSubtitle = isGlobalSearch
    ? `Checking ${termLabel(selectedQuarter, school)} for "${searchText.trim()}".`
    : selectedCategorySummary
      ? `Checking ${selectedCategorySummary} for ${termLabel(selectedQuarter, school)}. New schools can take a few seconds the first time.`
      : `Checking ${termLabel(selectedQuarter, school)} now.`;

  const clearSelectedCategory = () => {
    setSelectedDepts([]);
    setSelectedGE('');
    setCatalogReloadKey((value) => value + 1);
    setExpandedCourseIds({});
    setPreviewCourse(null);
  };

  const toggleSelectedDept = (dept: string) => {
    setSelectedGE('');
    setSelectedDepts((prev) => {
      const exists = prev.includes(dept);
      if (exists) return prev.filter((item) => item !== dept);
      return [...prev, dept].sort((a, b) => departmentOptions.indexOf(a) - departmentOptions.indexOf(b));
    });
    setExpandedCourseIds({});
    setPreviewCourse(null);
  };

  const removeSelectedDept = (dept: string) => {
    setSelectedDepts((prev) => prev.filter((item) => item !== dept));
    setExpandedCourseIds({});
    setPreviewCourse(null);
  };

  const customFieldLabelStyle = {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 5,
  } as const;

  const customInputStyle = {
    height: 42,
    backgroundColor: coursePickerInputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 0,
    color: colors.text,
    fontSize: 14,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: coursePickerBg, paddingTop: insets.top + 8 }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
        }}
      >
        <TouchableOpacity onPress={onClose} style={{ width: 44, height: 36, justifyContent: 'center', zIndex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 30 }}>×</Text>
        </TouchableOpacity>

        <Text
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            textAlign: 'center',
            fontWeight: '700',
            fontSize: 15,
            color: colors.textSecondary,
          }}
        >
          {termLabel(selectedQuarter, school)}
        </Text>

        <TouchableOpacity
          onPress={openCustomizeModal}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 999,
            backgroundColor: courseAccentSoft,
            borderWidth: 1,
            borderColor: courseAccentBorder,
            zIndex: 1,
          }}
        >
          <Text style={{ color: courseAccent, fontSize: 12, fontWeight: '700' }}>Customize</Text>
        </TouchableOpacity>
      </View>

      <PreviewTimetable
        selectedCourses={activeCourses}
        previewCourse={previewCourse}
        onBackgroundPress={onClose}
        settings={timetableSettings}
      />

      <View
        style={{
          flex: 1,
          marginTop: 12,
          backgroundColor: coursePickerSheetBg,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          overflow: 'hidden',
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: coursePickerInputBg, borderRadius: 14, paddingHorizontal: 14, marginBottom: 10 }}>
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search title, code (e.g. ECON 100A), or professor"
              placeholderTextColor={colors.placeholder}
              style={{ flex: 1, color: colors.text, paddingVertical: 12 }}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Department / GE dropdown */}
          <TouchableOpacity
            onPress={() => { Keyboard.dismiss(); openDeptModal(); }}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: hasSelectedCategory ? courseAccentSoft : coursePickerInputBg,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 13,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: hasSelectedCategory ? courseAccent : colors.border,
            }}
          >
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ flex: 1, minWidth: 0, color: hasSelectedCategory ? courseAccent : colors.textTertiary, fontSize: 15, fontWeight: hasSelectedCategory ? '600' : '400' }}
            >
              {selectedCategorySummary || 'Department or GE category…'}
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>▼</Text>
          </TouchableOpacity>

          <View style={{ marginBottom: 10 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
              {selectedDepts.map((dept) => (
                <TouchableOpacity
                  key={dept}
                  onPress={() => removeSelectedDept(dept)}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    maxWidth: 210,
                    paddingLeft: 12,
                    paddingRight: 9,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: courseAccentSoft,
                    borderWidth: 1,
                    borderColor: courseAccent,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{ flexShrink: 1, minWidth: 0, fontSize: 12, fontWeight: '700', color: courseAccent }}
                  >
                    {dept}
                  </Text>
                  <Ionicons name="close" size={14} color={courseAccent} />
                </TouchableOpacity>
              ))}
              {!!selectedGELabel && (
                <TouchableOpacity
                  onPress={clearSelectedCategory}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    maxWidth: 210,
                    paddingLeft: 12,
                    paddingRight: 9,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: courseAccentSoft,
                    borderWidth: 1,
                    borderColor: courseAccent,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{ flexShrink: 1, minWidth: 0, fontSize: 12, fontWeight: '700', color: courseAccent }}
                  >
                    {selectedGELabel}
                  </Text>
                  <Ionicons name="close" size={14} color={courseAccent} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setSelectedDayFilters([])}
                activeOpacity={0.8}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: selectedDayFilters.length === 0 ? courseAccent : coursePickerNeutralChipBg,
                  borderWidth: 1,
                  borderColor: selectedDayFilters.length === 0 ? courseAccent : colors.border,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: selectedDayFilters.length === 0 ? 'white' : coursePickerNeutralChipText }}>
                  Any day
                </Text>
              </TouchableOpacity>
              {DAY_FILTER_OPTIONS.map((day) => {
                const selected = selectedDayFilters.includes(day.key);
                return (
                  <TouchableOpacity
                    key={day.key}
                    onPress={() => toggleDayFilter(day.key)}
                    activeOpacity={0.8}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: selected ? courseAccentSoft : coursePickerNeutralChipBg,
                      borderWidth: 1,
                      borderColor: selected ? courseAccent : colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: selected ? courseAccent : coursePickerNeutralChipText }}>
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Department / GE picker modal */}
          <Modal
            visible={deptDropdownOpen}
            animationType="none"
            transparent
            onRequestClose={() => closeDeptModal()}
          >
            <Animated.View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: deptBackdropAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.3)'] }) }}>
              {keyboardBackingHeight > 0 ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: keyboardBackingHeight,
                    backgroundColor: coursePickerKeyboardBacking,
                  }}
                />
              ) : null}
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
                style={{ flex: 1, justifyContent: 'flex-end' }}
              >
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => closeDeptModal()} />
                <Animated.View style={{ backgroundColor: coursePickerSheetBg, borderTopLeftRadius: SHEET_CORNER_RADIUS, borderTopRightRadius: SHEET_CORNER_RADIUS, paddingTop: 16, maxHeight: '72%', transform: [{ translateY: deptSheetSlideAnim }] }}>

                {/* Drag handle */}
                <View style={{ alignItems: 'center', paddingBottom: 8, marginTop: -4 }} {...deptDragPan.panHandlers}>
                  <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
                </View>

                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
                  {showGESublist ? (
                    <TouchableOpacity onPress={() => { setShowGESublist(false); setDeptSearch(''); }} style={{ marginRight: 10 }}>
                      <Ionicons name="chevron-back" size={22} color={colors.text} />
                    </TouchableOpacity>
                  ) : null}
                  <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: colors.text }}>
                    {showGESublist ? 'GE Categories' : 'Department filters'}
                  </Text>
                  {hasSelectedCategory && (
                    <TouchableOpacity onPress={clearSelectedCategory} style={{ marginRight: 14 }}>
                      <Text style={{ fontSize: 14, color: colors.textTertiary, fontWeight: '700' }}>Clear</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => closeDeptModal()}>
                    <Text style={{ fontSize: 14, color: courseAccent, fontWeight: '800' }}>Done</Text>
                  </TouchableOpacity>
                </View>

                {/* Search bar */}
                <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: coursePickerInputBg, borderRadius: 12, paddingHorizontal: 14 }}>
                    <TextInput
                      value={deptSearch}
                      onChangeText={setDeptSearch}
                      placeholder={showGESublist ? 'Search GE categories…' : 'Search departments…'}
                      placeholderTextColor={colors.placeholder}
                      style={{ flex: 1, paddingVertical: 10, fontSize: 15, color: colors.text }}
                    />
                    {deptSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setDeptSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {showGESublist ? (
                  /* GE sub-list */
                  <FlatList
                    data={filteredGECategories}
                    keyExtractor={(item) => item.code}
                    extraData={selectedGE}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
                    renderItem={({ item: ge }) => {
                      const isSelected = selectedGE === ge.code;
                      return (
                        <TouchableOpacity
                          onPress={() => { Keyboard.dismiss(); closeDeptModal(() => { setSelectedGE(ge.code); setSelectedDepts([]); setDeptSearch(''); }); }}
                          style={{
                            paddingVertical: 14,
                            borderBottomWidth: 1,
                            borderBottomColor: colors.borderSubtle,
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ fontSize: 15, color: isSelected ? courseAccent : colors.text, fontWeight: isSelected ? '700' : '400' }}>
                            {ge.label}
                          </Text>
                          {isSelected && <Ionicons name="checkmark" size={18} color={courseAccent} />}
                        </TouchableOpacity>
                      );
                    }}
                  />
                ) : (
                  /* Main dept list with single GE row at top */
                  <FlatList
                    data={filteredDepts}
                    keyExtractor={(item) => `dept-${item}`}
                    extraData={`${selectedDeptKey}|${selectedGE}`}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
                    ListHeaderComponent={
                      <>
                        <TouchableOpacity
                          onPress={() => { Keyboard.dismiss(); closeDeptModal(clearSelectedCategory); }}
	                          style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                        >
	                          <Text style={{ fontSize: 15, color: !hasSelectedCategory ? courseAccent : colors.text, fontWeight: !hasSelectedCategory ? '700' : '400' }}>
                            All Departments
                          </Text>
                          {!hasSelectedCategory && <Ionicons name="checkmark" size={18} color={courseAccent} />}
                        </TouchableOpacity>
                        {isUciSchool && !deptSearch && (
                          <TouchableOpacity
                          onPress={() => { Keyboard.dismiss(); setShowGESublist(true); setDeptSearch(''); }}
                          style={{
                            paddingVertical: 14,
                            borderTopWidth: 1,
	                            borderTopColor: colors.border,
                            borderBottomWidth: 1,
	                            borderBottomColor: colors.border,
                            marginBottom: 4,
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
	                          <Text style={{ fontSize: 15, color: selectedGE ? courseAccent : colors.text, fontWeight: selectedGE ? '700' : '500' }}>
                            {selectedGE ? GE_CATEGORIES.find(g => g.code === selectedGE)?.label : 'GE Categories'}
                          </Text>
	                          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                        )}
                      </>
                    }
                    renderItem={({ item }) => {
                      const isSelected = selectedDepts.includes(item);
                      return (
                        <TouchableOpacity
                          onPress={() => { Keyboard.dismiss(); toggleSelectedDept(item); }}
                          style={{
                            paddingVertical: 14,
                            borderBottomWidth: 1,
	                            borderBottomColor: colors.borderSubtle,
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
	                          <Text style={{ fontSize: 15, color: isSelected ? courseAccent : colors.text, fontWeight: isSelected ? '700' : '400' }}>
                            {item}
                          </Text>
                          {isSelected && <Ionicons name="checkmark" size={18} color={courseAccent} />}
                        </TouchableOpacity>
                      );
                    }}
                  />
                )}
              </Animated.View>
              </KeyboardAvoidingView>
            </Animated.View>
          </Modal>
        </View>

        {/* Content */}
        {isCourseListLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 60 }}>
            <View
              style={{
                width: '100%',
                maxWidth: 340,
                alignItems: 'center',
                borderRadius: 18,
                borderWidth: 1,
                borderColor: coursePickerLoadingBorder,
                backgroundColor: coursePickerLoadingBg,
                paddingHorizontal: 20,
                paddingVertical: 24,
              }}
            >
              <MiniLoader labelColor={colors.textTertiary} />
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 18, textAlign: 'center' }}>
                {courseLoadingTitle}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6, textAlign: 'center' }}>
                {courseLoadingSubtitle}
              </Text>
            </View>
          </View>
        ) : filteredCatalog.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 60 }}>
            <Ionicons name="school-outline" size={30} color={colors.textTertiary} style={{ marginBottom: 10 }} />
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center' }}>
              No courses found
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 13, lineHeight: 19, marginTop: 5, textAlign: 'center' }}>
              Try another department, search term, or switch terms.
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredCatalog}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
            renderItem={({ item }) => {
              const isExpanded = !!expandedCourseIds[item.id];
              const activeSectionsMap = isGlobalSearch ? globalSectionsMap : sectionsMap;
              const sections = selectedDayFilters.length > 0
                ? (activeSectionsMap[item.id] ?? []).filter(sectionMatchesPrimaryClassDayFilter)
                : (activeSectionsMap[item.id] ?? []);

              return (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => handleExpandCourse(item)}
                  style={{
                    paddingVertical: 14,
                    borderBottomWidth: 1,
	                    borderBottomColor: colors.borderSubtle,
                  }}
                >
                  {/* Course header row */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
	                      <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
                        {item.department} {item.courseNumber}
                      </Text>
	                      <Text numberOfLines={2} ellipsizeMode="tail" style={{ color: colors.textSecondary, marginTop: 2, fontSize: 14 }}>{item.title}</Text>
                      {item.units != null && (
	                        <Text style={{ color: colors.textTertiary, marginTop: 2, fontSize: 12 }}>
                          {item.units} units
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Expanded sections */}
                  {isExpanded && (
                    <View style={{ marginTop: 10 }}>
                      {sections.length === 0 ? (
	                        <Text style={{ color: colors.textTertiary, fontSize: 13, paddingVertical: 8 }}>
                          {selectedDayFilters.length > 0
                            ? 'No class meetings match selected days'
                            : `No sections found for ${termLabel(selectedQuarter, school)}`}
                        </Text>
                      ) : (
                        sections.map((course) => {
                          const isAdded = activeCourseIds.has(course.id);
                          const isPreviewing = previewCourse?.id === course.id;
                          const enroll = enrollmentCache[course.id];
                          const sectionType = course.sectionLabel?.split(' ')[0] ?? '';
                          const reviewSummary = reviewSummaryCache[`${item.department} ${item.courseNumber}::${sectionType}`.trim()] ?? { average: null, count: 0 };
                          const savedCount = visibleSavedCountForSection(course.id);
                          const statusPresentation = sectionStatusPresentation(enroll?.status ?? course.enrollmentStatus);
                          const enrollmentLabel = enrollmentCountLabel({
                            enrolled: enroll?.enrolled ?? course.enrolled,
                            capacity: enroll?.capacity ?? course.capacity,
                          });
                          const waitlistLabel = waitlistCountLabel({
                            waitlist: enroll?.waitlist ?? course.waitlist,
                            waitlistCap: enroll?.waitlistCap,
                            waitlistCapacity: course.waitlistCapacity,
                          });
                          const sectionDisplayTitle = sectionHeaderLabel(course.id, course.sectionLabel);
                          const statusTone = statusPresentation?.label === 'Open'
                            ? 'success'
                            : statusPresentation?.label === 'Full' || statusPresentation?.label === 'Closed'
                              ? 'danger'
                              : 'warning';

                          return (
                            <TouchableOpacity
                              key={course.id}
                              activeOpacity={0.85}
                              onPress={() => setPreviewCourse(isPreviewing ? null : course)}
                              style={{
	                                backgroundColor: isPreviewing ? courseAccentSoft : coursePickerRaisedBg,
                                borderRadius: 12,
                                paddingHorizontal: 10,
                                paddingVertical: 8,
                                marginBottom: 6,
                                borderWidth: 1,
	                                borderColor: isPreviewing ? courseAccent : colors.borderSubtle,
                              }}
                            >
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
	                                    <Text numberOfLines={1} ellipsizeMode="tail" style={{ flexShrink: 1, minWidth: 0, fontWeight: '600', fontSize: 13, color: colors.text }}>
                                      {sectionDisplayTitle}
                                    </Text>
                                    {statusPresentation && (
                                      <InfoChip
                                        label={statusPresentation.label}
                                        tone={statusTone}
                                        compact
                                        color={statusPresentation.color}
                                        backgroundColor={`${statusPresentation.color}18`}
                                        borderColor={`${statusPresentation.color}28`}
                                      />
                                    )}
                                  </View>
	                                  <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: colors.textSecondary, fontSize: 12, marginTop: 1 }}>
                                    {course.professor}
                                  </Text>
	                                  <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: colors.textSecondary, fontSize: 12, marginTop: 1 }}>
                                    {[course.days, formatCourseTimeRange12(course.time), course.location].filter(Boolean).join(' · ')}
                                  </Text>
                                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 }}>
                                    {enrollmentLabel ? (
	                                      <InfoChip icon="person-outline" label={enrollmentLabel} tone="neutral" compact color={isDark ? '#cbd5e1' : '#64748b'} backgroundColor={isDark ? 'rgba(148,163,184,0.14)' : '#eef2f7'} borderColor={isDark ? 'rgba(148,163,184,0.26)' : '#e2e8f0'} />
                                    ) : null}
                                    {waitlistLabel ? (
	                                      <InfoChip icon="time-outline" label={waitlistLabel} tone="warning" compact color="#d97706" backgroundColor={isDark ? 'rgba(245,158,11,0.14)' : '#fff7ed'} borderColor="rgba(245,158,11,0.28)" />
                                    ) : null}
                                    <InfoChip icon="people-outline" label={`${savedCount} saved`} tone="brand" compact color={courseAccent} backgroundColor={courseAccentSoft} borderColor={`${courseAccent}24`} />
                                  </View>
                                </View>

                                <View style={{ alignItems: 'flex-end', justifyContent: 'flex-start', alignSelf: 'stretch', gap: 6 }}>
                                  <TouchableOpacity
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      handleAddToTable(course);
                                    }}
                                    style={{
	                                      backgroundColor: isAdded ? coursePickerAddedBg : '#ef4444',
                                      paddingHorizontal: 11,
                                      paddingVertical: 5,
                                      borderRadius: 999,
                                      alignSelf: 'flex-end',
                                    }}
                                  >
	                                    <Text style={{ color: isAdded ? coursePickerAddedText : 'white', fontWeight: '700', fontSize: 13 }}>
                                      {isAdded ? 'Remove' : 'Add'}
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      setReviewsCourse(course);
                                    }}
                                    style={{
                                      paddingHorizontal: 10, paddingVertical: 5,
                                      borderRadius: 999, backgroundColor: courseAccent,
                                      alignSelf: 'flex-end',
                                    }}
                                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                                  >
                                    <Text style={{ fontSize: 11, color: 'white', fontWeight: '600' }}>Reviews</Text>
                                  </TouchableOpacity>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-end' }}>
                                    <Ionicons name="star" size={11} color="#f59e0b" />
	                                    <Text style={{ color: colors.textSecondary, fontSize: 10 }}>
                                      {reviewSummary.average == null
                                        ? 'No ratings yet'
                                        : `${reviewSummary.average.toFixed(1)} (${reviewSummary.count})`}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>

      {reviewsCourse && (
        <ReviewsModal
          visible={!!reviewsCourse}
          onClose={() => setReviewsCourse(null)}
          sectionId={reviewsCourse.id}
          courseCode={reviewsCourse.code}
          department={reviewsCourse.department}
          courseNumber={reviewsCourse.code.slice(reviewsCourse.department.length).trim()}
          sectionType={reviewsCourse.sectionLabel?.split(' ')[0] ?? 'Lec'}
          title={reviewsCourse.title}
          professors={[...new Set(
            [reviewsCourse.professor].filter((p): p is string => professorIsKnown(p))
          )]}
          school={school}
          userId={userId}
          semesterLabel={termLabel(selectedQuarter, school)}
          quarterKey={quarterKey(selectedQuarter)}
        />
      )}

      <Modal
        visible={showCustomizeModal}
        animationType="none"
        transparent
        onRequestClose={confirmCloseCustomizeModal}
      >
        <Animated.View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: customizeBackdropAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0)', 'rgba(15,23,42,0.28)'] }) }}>
          <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} activeOpacity={1} onPress={confirmCloseCustomizeModal} />
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <Animated.View
            style={{
              backgroundColor: coursePickerSheetBg,
              borderTopLeftRadius: SHEET_CORNER_RADIUS,
              borderTopRightRadius: SHEET_CORNER_RADIUS,
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: Math.max(insets.bottom + 8, 18),
              maxHeight: windowHeight * 0.9,
              transform: [{ translateY: customizeSheetAnim }],
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Customize Block</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
                  Add any custom class, event, shift, or study block.
                </Text>
              </View>
              <TouchableOpacity onPress={confirmCloseCustomizeModal}>
                <Text style={{ fontSize: 26, color: colors.textTertiary }}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              contentContainerStyle={{ paddingBottom: Platform.OS === 'android' && keyboardBackingHeight > 0 ? 24 : 8 }}
            >
              <View style={{ gap: 8 }}>
                <View>
                  <TextInput
                    value={customCourseDraft.name}
                    onChangeText={(value) => setCustomCourseDraft((prev) => ({ ...prev, name: value }))}
                    placeholder="Club Meeting"
                    placeholderTextColor={colors.placeholder}
                    clearButtonMode="while-editing"
                    style={customInputStyle}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={customFieldLabelStyle}>Short Label</Text>
                    <TextInput
                      value={customCourseDraft.shortLabel}
                      onChangeText={(value) => setCustomCourseDraft((prev) => ({ ...prev, shortLabel: value }))}
                      placeholder="Optional"
	                      placeholderTextColor={colors.placeholder}
                      clearButtonMode="while-editing"
                      style={customInputStyle}
                    />
                  </View>
                  <View style={{ width: 92 }}>
                    <Text style={customFieldLabelStyle}>Units</Text>
                    <TextInput
                      value={customCourseDraft.units}
                      onChangeText={(value) =>
                        setCustomCourseDraft((prev) => ({ ...prev, units: value.replace(/[^0-9.]/g, '').slice(0, 4) }))
                      }
                      placeholder="Optional"
	                      placeholderTextColor={colors.placeholder}
                      keyboardType="decimal-pad"
                      style={customInputStyle}
                    />
                  </View>
                </View>

                <View>
                  <Text style={customFieldLabelStyle}>Days</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
                    {CUSTOM_DAY_OPTIONS.map((option) => {
                      const isSelected = customCourseDraft.selectedDays.includes(option.key);
                      return (
                        <TouchableOpacity
                          key={option.key}
                          onPress={() => toggleCustomDay(option.key)}
                          style={{
                            minWidth: 36,
                            paddingHorizontal: 0,
                            paddingVertical: 7,
                            borderRadius: 11,
	                            backgroundColor: isSelected ? courseAccent : coursePickerNeutralChipBg,
                            borderWidth: 1,
	                            borderColor: isSelected ? courseAccent : colors.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 1,
                          }}
                        >
	                          <Text style={{ color: isSelected ? 'white' : colors.textSecondary, fontWeight: '700', fontSize: 11 }}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View>
                  <Text style={customFieldLabelStyle}>Color</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
                    {CUSTOM_COLOR_OPTIONS.map((color) => {
                      const isSelected = customCourseDraft.customColor === color;
                      return (
                        <TouchableOpacity
                          key={color}
                          onPress={() => setCustomCourseDraft((prev) => ({ ...prev, customColor: color }))}
                          style={{
                            width: 27,
                            height: 27,
                            borderRadius: 999,
                            backgroundColor: color,
                            borderWidth: isSelected ? 3 : 1.5,
	                            borderColor: isSelected ? colors.text : isDark ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.9)',
                            shadowColor: color,
                            shadowOpacity: isSelected ? 0.28 : 0.14,
                            shadowRadius: isSelected ? 8 : 5,
                            shadowOffset: { width: 0, height: 3 },
                            elevation: isSelected ? 4 : 2,
                          }}
                        />
                      );
                    })}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={customFieldLabelStyle}>Start Time</Text>
                    <TextInput
                      value={customCourseDraft.startTime}
                      onChangeText={(value) =>
                        setCustomCourseDraft((prev) => ({ ...prev, startTime: normalizeCustomTimeInput(value) }))
                      }
                      placeholder="1:00 PM"
	                      placeholderTextColor={colors.placeholder}
                      autoCapitalize="characters"
                      maxLength={8}
                      style={customInputStyle}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={customFieldLabelStyle}>End Time</Text>
                    <TextInput
                      value={customCourseDraft.endTime}
                      onChangeText={(value) =>
                        setCustomCourseDraft((prev) => ({ ...prev, endTime: normalizeCustomTimeInput(value) }))
                      }
                      placeholder="2:20 PM"
	                      placeholderTextColor={colors.placeholder}
                      autoCapitalize="characters"
                      maxLength={8}
                      style={customInputStyle}
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={customFieldLabelStyle}>Location</Text>
                    <TextInput
                      value={customCourseDraft.location}
                      onChangeText={(value) => setCustomCourseDraft((prev) => ({ ...prev, location: value }))}
                      placeholder="Optional"
	                      placeholderTextColor={colors.placeholder}
                      clearButtonMode="while-editing"
                      style={customInputStyle}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={customFieldLabelStyle}>Instructor</Text>
                    <TextInput
                      value={customCourseDraft.professor}
                      onChangeText={(value) => setCustomCourseDraft((prev) => ({ ...prev, professor: value }))}
                      placeholder="Optional"
	                      placeholderTextColor={colors.placeholder}
                      clearButtonMode="while-editing"
                      style={customInputStyle}
                    />
                  </View>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleCreateCustomCourse}
                style={{
                  marginTop: 10,
                  marginBottom: 0,
                  backgroundColor: courseAccent,
                  borderRadius: 14,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: 'white', fontSize: 15, fontWeight: '800' }}>Add Custom Block</Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </View>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActionSheetIOS, ActivityIndicator, Alert, Animated, Keyboard, Linking, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import Svg, { Circle } from 'react-native-svg';
import { Course, Quarter, TimetableSettings, DEFAULT_TIMETABLE_SETTINGS, blockColorKey, formatCourseTimeRange12, getBlockColors, quarterKey } from '../data/courses';
import { CATEGORY_CONFIG, daysUntilEvent, fetchAcademicEvents, filterUpcomingEvents, type AcademicEvent } from '../data/academicCalendar';
import { buildSectionMatchKey, getSharedClassMatch, normalizeCourseCode, type SharedClassMatch } from '../data/sharedClasses';
import { getSportsVenueForEvent, type SportsVenue } from '../data/campusLocations';
import { fetchSportsEventsForSchool, formatSportsEventTime, type SportsEvent } from '../data/sportsEvents';
import { fetchDiningMenusForSchool, schoolDiningMenusSupported, type DiningLocationMenu, type DiningMenuMeal } from '../data/diningMenus';
import { academicSystemNoun, getSchoolConfig, schoolCampusLabel, schoolFeatureEnabled, schoolHomeLabel, termLabel } from '../data/schools';
import type { TimetableVisibility } from '../data/userPreferences';
import { formatDateInTimeZone, getZonedDateParts, normalizeTimeZone, zonedDateFromParts, zonedDateKey, zonedWeekdayIndex } from '../data/timeZone';
import {
  COMMUNITY_GUIDELINES_MESSAGE,
  evaluateModerationText,
  moderationUserMessage,
  shouldBlockModerationResult,
} from '../data/moderationPolicy';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { isMissingSchoolColumnError } from '../lib/supabaseErrors';
import InfoChip from '../components/InfoChip';
import { EmptyState, SkeletonBlock } from '../components/Polish';
import { themedIconBackground, themedIconColor } from '../utils/themeTint';
import { triggerSelectionHaptic, triggerSuccessHaptic } from '../utils/haptics';
import {
  BACKDROP_DURATION,
  BACKDROP_EXIT_DURATION,
  MOTION,
  SHEET_CORNER_RADIUS,
  SHEET_INITIAL_TRANSLATE_Y,
  SHEET_OUT_DURATION,
  SHEET_SPRING,
} from '../utils/motion';
import { useKeyboardInset } from '../utils/useKeyboardInset';

type Props = {
  activeCourses: Course[];
  selectedQuarter: Quarter;
  onOpenSettings: () => void;
  topInset?: number;
  userId: string;
  school: string;
  timeZone?: string;
  bottomInset?: number;
  scrollToTopTrigger?: number;
  onAssignmentCalendarChange?: () => void;
  timetableSettings?: TimetableSettings;
};

type FriendRequestRow = {
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
};

type ProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
};

type FriendSettingsRow = {
  user_id: string;
  timetable_visibility: TimetableVisibility | null;
};

type FriendTimetableRow = {
  user_id: string;
  name: string;
  courses: Course[] | null;
};

type ClassmateMatch = {
  id: string;
  name: string;
  email: string;
  sharedCourseMatches: {
    courseKey: string;
    courseCode: string;
    matchType: SharedClassMatch;
  }[];
};

type SportsEventRsvpStatus = 'going';
type StoredSportsEventRsvpStatus = SportsEventRsvpStatus | 'interested';

type SportsEventComment = {
  id: string;
  userId: string;
  authorName: string;
  content: string;
  createdAt: string;
};

type SportsEventCommentRow = {
  id: string;
  event_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

type SportsEventRsvpRow = {
  event_id?: string;
  user_id: string;
  status: StoredSportsEventRsvpStatus;
};

function isServerModerationError(error: { message?: string } | null | undefined) {
  return typeof error?.message === 'string' && error.message.includes('ClassMate moderation policy');
}

type CalendarTask = {
  id: string;
  title: string;
  courseCode: string;
  dueAt: string;
  allDay: boolean;
  url?: string;
  description?: string;
};

type CalendarProviderId = 'canvas' | 'brightspace' | 'blackboard' | 'moodle' | 'sakai' | 'google-classroom' | 'other';

type CalendarProviderOption = {
  id: CalendarProviderId;
  label: string;
  helper: string;
  placeholder: string;
};

type CalendarSyncOptions = {
  completedSnapshot?: Record<string, boolean>;
  tasksSnapshot?: CalendarTask[];
  previousLastSync?: string | null;
};

function isOnConflictTargetError(error: any) {
  const message = String(error?.message ?? '').toLowerCase();
  return error?.code === '42P10' || message.includes('no unique or exclusion constraint');
}

type HeroCardItem =
  | { type: 'idleSummary' }
  | { type: 'completedSummary'; courses: Course[] }
  | { type: 'upcomingSummary'; courses: Course[] }
  | { type: 'course'; course: Course }
  | { type: 'diningMenu' }
  | { type: 'sportsEvents' }
  | { type: 'campusInfo' };

function getHeroItemKey(item: HeroCardItem) {
  if (item.type === 'course') return `course-${item.course.id}`;
  if (item.type === 'completedSummary' || item.type === 'upcomingSummary') return `${item.type}-today`;
  return item.type;
}

type CampusInfoResource = {
  id: string;
  title: string;
  subtitle: string;
  url?: string;
  appUrl?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  children?: Array<{
    id: string;
    title: string;
    subtitle: string;
    url: string;
    appUrl?: string;
  }>;
};

type CampusInfoChild = NonNullable<CampusInfoResource['children']>[number];

function campusInfoResourceCaption(resource: CampusInfoResource) {
  const captions: Record<string, string> = {
    'student-portal': 'Manage registration, tuition, and dates.',
    transit: 'Check campus routes and transit.',
    library: 'Use libraries and book study rooms.',
    clubs: 'Browse campus groups.',
    jobs: 'Find jobs and internships.',
    'student-deals': 'Find student discounts.',
    athletics: 'Check games and teams.',
  };
  return captions[resource.id] ?? '';
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type SchoolTermDateRange = { start: Date; end: Date };

const HOME_SPORTS_FETCH_DELAY_MS = 250;
const HOME_CLASSMATES_FETCH_DELAY_MS = 1000;

const STUDENT_DEALS_RESOURCE: CampusInfoResource = {
  id: 'student-deals',
  title: 'Student Deals',
  subtitle: 'Verified student discounts and student plans',
  icon: 'pricetag-outline',
  color: '#DB2777',
  bg: '#fdf2f8',
  children: [
    { id: 'unidays', title: 'UNiDAYS', subtitle: 'Student discount hub', url: 'https://www.myunidays.com/US/en-US' },
    { id: 'student-beans', title: 'Student Beans', subtitle: 'Verified student deals', url: 'https://www.studentbeans.com/us' },
    { id: 'idme-student', title: 'ID.me', subtitle: 'Student verification offers', url: 'https://shop.id.me/student' },
    { id: 'apple-education', title: 'Apple', subtitle: 'Education Store', url: 'https://www.apple.com/us-edu/store' },
    { id: 'amazon-prime-student', title: 'Amazon', subtitle: 'Prime Student', url: 'https://www.amazon.com/amazonprime/student' },
    { id: 'spotify-student', title: 'Spotify', subtitle: 'Student plan', url: 'https://www.spotify.com/us/student/' },
    { id: 'adobe-student', title: 'Adobe', subtitle: 'Student pricing', url: 'https://www.adobe.com/creativecloud/buy/students.html' },
  ],
};

function createLibraryResource(schoolLabel: string, libraryUrl: string, studyRoomsUrl: string): CampusInfoResource {
  return {
    id: 'library',
    title: 'Library',
    subtitle: 'Library services and study room reservations',
    icon: 'book-outline',
    color: '#0891B2',
    bg: '#ecfeff',
    children: [
      { id: 'library-home', title: 'Library', subtitle: `${schoolLabel} library homepage`, url: libraryUrl },
      { id: 'study-rooms', title: 'Study Rooms', subtitle: 'Reserve study spaces', url: studyRoomsUrl },
    ],
  };
}

function createStudentPortalResource(
  portalTitle: string,
  portalSubtitle: string,
  portalUrl: string,
  billingTitle: string,
  billingSubtitle: string,
  billingUrl: string,
  calendarTitle: string,
  calendarSubtitle: string,
  calendarUrl: string,
): CampusInfoResource {
  return {
    id: 'student-portal',
    title: 'Student Portal',
    subtitle: 'Registration, billing, and academic dates',
    icon: 'school-outline',
    color: '#4F46E5',
    bg: '#eef2ff',
    children: [
      { id: 'registration-portal', title: portalTitle, subtitle: portalSubtitle, url: portalUrl },
      { id: 'student-billing', title: billingTitle, subtitle: billingSubtitle, url: billingUrl },
      { id: 'academic-calendar', title: calendarTitle, subtitle: calendarSubtitle, url: calendarUrl },
    ],
  };
}

function campusInfoSearchUrl(school: string, topic: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${school} ${topic}`)}`;
}

function createLinkGroupResource(
  id: string,
  title: string,
  subtitle: string,
  icon: keyof typeof Ionicons.glyphMap,
  color: string,
  bg: string,
  children: CampusInfoChild[],
): CampusInfoResource {
  return {
    id,
    title,
    subtitle,
    icon,
    color,
    bg,
    children,
  };
}

function createSingleLinkResource(
  id: string,
  title: string,
  subtitle: string,
  icon: keyof typeof Ionicons.glyphMap,
  color: string,
  bg: string,
  child: CampusInfoChild,
): CampusInfoResource {
  return createLinkGroupResource(id, title, subtitle, icon, color, bg, [child]);
}

function handshakeJobSearchUrl(schoolSlug?: string) {
  return schoolSlug ? `https://${schoolSlug}.joinhandshake.com/job-search` : 'https://app.joinhandshake.com/job-search';
}

function createJobsResource(handshakeUrl: string, handshakeSubtitle: string): CampusInfoResource {
  return createLinkGroupResource(
    'jobs',
    'Jobs',
    'Jobs, internships, and career listings',
    'briefcase-outline',
    '#2563EB',
    '#eff6ff',
    [
      { id: 'handshake', title: 'Handshake', subtitle: handshakeSubtitle, url: handshakeUrl },
    ],
  );
}

function createFallbackCampusInfoResources(school: string): CampusInfoResource[] {
  return [
    createStudentPortalResource(
      'Registration',
      'Find the course registration site',
      campusInfoSearchUrl(school, 'course registration registrar'),
      'Billing',
      'Find tuition and payment info',
      campusInfoSearchUrl(school, 'student billing tuition payment'),
      'Academic Calendar',
      'Term dates and deadlines',
      campusInfoSearchUrl(school, 'academic calendar registrar dates deadlines'),
    ),
    createSingleLinkResource(
      'transit',
      'Shuttle',
      'Campus shuttle, bus, and transportation links',
      'bus-outline',
      '#0EA5E9',
      '#f0f9ff',
      { id: 'transit-search', title: 'Shuttle', subtitle: 'Find shuttle and bus info', url: campusInfoSearchUrl(school, 'campus shuttle bus transit') },
    ),
    createLibraryResource(
      school,
      campusInfoSearchUrl(school, 'library'),
      campusInfoSearchUrl(school, 'library study rooms reserve'),
    ),
    createSingleLinkResource(
      'clubs',
      'Clubs',
      'Student organizations and campus groups',
      'people-outline',
      '#8B5CF6',
      '#f5f3ff',
      { id: 'clubs-search', title: 'Organizations', subtitle: 'Browse student groups', url: campusInfoSearchUrl(school, 'student organizations clubs') },
    ),
    createJobsResource(handshakeJobSearchUrl(), 'Handshake jobs and internships'),
    STUDENT_DEALS_RESOURCE,
  ];
}

type StandardCampusInfoConfig = {
  schoolShortName: string;
  registrationTitle?: string;
  registrationUrl: string;
  billingTitle?: string;
  billingSubtitle?: string;
  billingUrl?: string;
  calendarTitle?: string;
  calendarSubtitle?: string;
  calendarUrl?: string;
  handshakeSlug?: string;
  jobsSubtitle: string;
  libraryUrl: string;
  studyRoomsUrl: string;
  transitTitle?: string;
  transitSubtitle?: string;
  transitUrl: string;
  clubsTitle?: string;
  clubsSubtitle?: string;
  clubsUrl: string;
  athleticsUrl?: string;
};

function createStandardCampusInfoResources(config: StandardCampusInfoConfig): CampusInfoResource[] {
  const athleticsResource = config.athleticsUrl
    ? [createSingleLinkResource(
      'athletics',
      'Athletics',
      'Schedules and team links',
      'trophy-outline',
      '#F97316',
      '#fff7ed',
      { id: 'athletics-site', title: 'Athletics', subtitle: 'Open official athletics site', url: config.athleticsUrl },
    )]
    : [];

  return [
    createStudentPortalResource(
      config.registrationTitle ?? 'Class Search',
      'Register and manage classes',
      config.registrationUrl,
      config.billingTitle ?? 'Billing',
      config.billingSubtitle ?? 'Tuition, fees, and payments',
      config.billingUrl ?? campusInfoSearchUrl(config.schoolShortName, 'student billing tuition payment'),
      config.calendarTitle ?? 'Academic Calendar',
      config.calendarSubtitle ?? 'Term dates and deadlines',
      config.calendarUrl ?? campusInfoSearchUrl(config.schoolShortName, 'academic calendar registrar dates deadlines'),
    ),
    createSingleLinkResource(
      'transit',
      config.transitTitle ?? 'Shuttle',
      config.transitSubtitle ?? 'Campus shuttle and transportation links',
      'bus-outline',
      '#0EA5E9',
      '#f0f9ff',
      { id: 'transportation', title: config.transitTitle ?? 'Shuttle', subtitle: config.transitSubtitle ?? 'Parking, shuttle, and transit info', url: config.transitUrl },
    ),
    createLibraryResource(config.schoolShortName, config.libraryUrl, config.studyRoomsUrl),
    createSingleLinkResource(
      'clubs',
      'Clubs',
      'Student organizations and campus groups',
      'people-outline',
      '#8B5CF6',
      '#f5f3ff',
      { id: 'organizations', title: config.clubsTitle ?? 'Organizations', subtitle: config.clubsSubtitle ?? 'Browse student organizations', url: config.clubsUrl },
    ),
    createJobsResource(handshakeJobSearchUrl(config.handshakeSlug), config.jobsSubtitle),
    ...athleticsResource,
    STUDENT_DEALS_RESOURCE,
  ];
}

const CAMPUS_INFO_RESOURCES: Record<string, CampusInfoResource[]> = {
  'UC Irvine': [
    createStudentPortalResource(
      'WebReg',
      'Add, drop, and enroll in classes',
      'https://www.reg.uci.edu/registrar/soc/webreg.html',
      'ZOT Account',
      'Tuition, fees, and payments',
      'https://zotaccount.uci.edu/',
      'Academic Calendar',
      'Quarter dates and deadlines',
      'https://www.reg.uci.edu/navigation/calendars.html',
    ),
    createSingleLinkResource(
      'transit',
      'Shuttle',
      'Campus shuttle and transportation links',
      'bus-outline',
      '#0EA5E9',
      '#f0f9ff',
      { id: 'anteater-express', title: 'Anteater Express', subtitle: 'Live bus tracking', url: 'https://shuttle.uci.edu/' },
    ),
    createLibraryResource('UCI', 'https://www.lib.uci.edu/', 'https://spaces.lib.uci.edu/'),
    createSingleLinkResource(
      'clubs',
      'Clubs',
      'Student organizations and campus groups',
      'people-outline',
      '#8B5CF6',
      '#f5f3ff',
      { id: 'zotspot', title: 'ZotSpot', subtitle: 'Browse campus groups', url: 'https://zotspot.uci.edu/club_signup' },
    ),
    createJobsResource(handshakeJobSearchUrl('uci'), 'UCI jobs and internships'),
    STUDENT_DEALS_RESOURCE,
  ],
  'University of Maryland, College Park': [
    createStudentPortalResource(
      'Testudo',
      'Registration and student services',
      'https://testudo.umd.edu/',
      'Billing',
      'Student account and payments',
      'https://billpay.umd.edu/',
      'Academic Calendar',
      'Dates and deadlines',
      'https://registrar.umd.edu/calendars',
    ),
    createSingleLinkResource(
      'transit',
      'Shuttle',
      'Campus shuttle and transportation links',
      'bus-outline',
      '#0EA5E9',
      '#f0f9ff',
      { id: 'shuttle-um', title: 'Shuttle-UM', subtitle: 'Routes and app setup', url: 'https://transportation.umd.edu/transit-official-app-shuttle-um' },
    ),
    createLibraryResource('UMD', 'https://www.lib.umd.edu/', 'https://umd.libcal.com/'),
    createSingleLinkResource(
      'clubs',
      'Clubs',
      'Student organizations and campus groups',
      'people-outline',
      '#8B5CF6',
      '#f5f3ff',
      { id: 'terplink', title: 'TerpLink', subtitle: 'Browse organizations', url: 'https://terplink.umd.edu/organizations' },
    ),
    createJobsResource(handshakeJobSearchUrl('umd'), 'UMD jobs and internships'),
    STUDENT_DEALS_RESOURCE,
  ],
  'Cornell University': [
    createStudentPortalResource(
      'Student Center',
      'Enroll in classes and manage records',
      'https://studentcenter.cornell.edu/',
      'Bursar',
      'Bills and payments',
      'https://bursar.cornell.edu/students-parents/paying-your-bill',
      'Academic Calendar',
      'Term dates and exams',
      'https://registrar.cornell.edu/calendars-exams/academic-calendar',
    ),
    createSingleLinkResource(
      'transit',
      'Shuttle',
      'Campus bus and transportation links',
      'bus-outline',
      '#0EA5E9',
      '#f0f9ff',
      { id: 'bus-services', title: 'Bus Services', subtitle: 'TCAT and OmniRide', url: 'https://fcs.cornell.edu/departments/transportation-delivery-services/alternative-transportation-options/bus-services-privileges-omniride-passes' },
    ),
    createLibraryResource('Cornell', 'https://www.library.cornell.edu/', 'https://spaces.library.cornell.edu/'),
    createSingleLinkResource(
      'clubs',
      'Clubs',
      'Student organizations and campus groups',
      'people-outline',
      '#8B5CF6',
      '#f5f3ff',
      { id: 'campusgroups', title: 'CampusGroups', subtitle: 'Browse organizations', url: 'https://cornell.campusgroups.com/club_signup' },
    ),
    createJobsResource(handshakeJobSearchUrl('cornell'), 'Cornell jobs and internships'),
    STUDENT_DEALS_RESOURCE,
  ],
  'Purdue University': [
    createStudentPortalResource(
      'myPurdue',
      'Register and manage classes',
      'https://mypurdue.purdue.edu/',
      'Bursar',
      'Tuition, invoices, and payments',
      'https://www.purdue.edu/bursar/',
      'Academic Calendar',
      'Registration dates and deadlines',
      'https://www.purdue.edu/registrar/calendars/',
    ),
    createSingleLinkResource(
      'transit',
      'Shuttle',
      'Campus shuttle and transportation links',
      'bus-outline',
      '#0EA5E9',
      '#f0f9ff',
      { id: 'campus-transit', title: 'Campus Transit', subtitle: 'Routes and ride options', url: 'https://www.purdue.edu/parking/green_benefits/campus-transit.html' },
    ),
    createLibraryResource('Purdue', 'https://www.lib.purdue.edu/', 'https://calendar.lib.purdue.edu/reserve'),
    createSingleLinkResource(
      'clubs',
      'Clubs',
      'Student organizations and campus groups',
      'people-outline',
      '#8B5CF6',
      '#f5f3ff',
      { id: 'boilerlink', title: 'BoilerLink', subtitle: 'Browse organizations', url: 'https://boilerlink.purdue.edu/organizations' },
    ),
    createJobsResource(handshakeJobSearchUrl('purdue'), 'Purdue jobs and internships'),
    STUDENT_DEALS_RESOURCE,
  ],
  'University of Illinois Urbana-Champaign': [
    createStudentPortalResource(
      'Self-Service',
      'Register and manage student records',
      'https://apps.uillinois.edu/selfservice',
      'UI-Pay',
      'Student account and payments',
      'https://paymybill.uillinois.edu/Access',
      'Academic Calendar',
      'Term dates and deadlines',
      'https://registrar.illinois.edu/academic-calendars/',
    ),
    createSingleLinkResource(
      'transit',
      'Shuttle',
      'Campus bus and transportation links',
      'bus-outline',
      '#0EA5E9',
      '#f0f9ff',
      { id: 'mtd-apps', title: 'MTD Apps', subtitle: 'Real-time transit apps', url: 'https://mtd.org/maps-and-schedules/apps/' },
    ),
    createLibraryResource('Illinois', 'https://www.library.illinois.edu/', 'https://libcal.library.illinois.edu/allspaces'),
    createSingleLinkResource(
      'clubs',
      'Clubs',
      'Student organizations and campus groups',
      'people-outline',
      '#8B5CF6',
      '#f5f3ff',
      { id: 'oneillinois', title: 'OneIllinois', subtitle: 'Browse organizations', url: 'https://one.illinois.edu/club_signup' },
    ),
    createJobsResource(handshakeJobSearchUrl('illinois'), 'Illinois jobs and internships'),
    STUDENT_DEALS_RESOURCE,
  ],
};

function getCampusInfoResources(school: string): CampusInfoResource[] {
  return CAMPUS_INFO_RESOURCES[school] ?? createFallbackCampusInfoResources(school);
}

type CampusInfoLinkTarget = {
  url?: string;
  appUrl?: string;
};

async function openCampusInfoLink(target: CampusInfoLinkTarget) {
  const candidates = [target.appUrl, target.url].filter((value): value is string => Boolean(value));
  for (const url of candidates) {
    try {
      await Linking.openURL(url);
      return;
    } catch {}
  }
  Alert.alert('Could not open link', target.url ?? target.appUrl ?? 'Try again later.');
}

const DEFAULT_CALENDAR_PROVIDER_ID: CalendarProviderId = 'canvas';
const CALENDAR_PROVIDER_OPTIONS: CalendarProviderOption[] = [
  {
    id: 'canvas',
    label: 'Canvas',
    helper: 'Use the calendar feed link from your Canvas calendar settings.',
    placeholder: 'https://your-school.instructure.com/feeds/calendars/...',
  },
  {
    id: 'brightspace',
    label: 'Brightspace',
    helper: 'Use the iCal or calendar feed link from your Brightspace calendar.',
    placeholder: 'https://your-school.brightspace.com/d2l/le/calendar/feed/...',
  },
  {
    id: 'blackboard',
    label: 'Blackboard',
    helper: 'Use the external calendar link from your Blackboard calendar.',
    placeholder: 'https://your-school.blackboard.com/calendar/ical/...',
  },
  {
    id: 'moodle',
    label: 'Moodle',
    helper: 'Use the export or subscription URL from your Moodle calendar.',
    placeholder: 'https://moodle.your-school.edu/calendar/export_execute.php?...',
  },
  {
    id: 'sakai',
    label: 'Sakai',
    helper: 'Use the private publish or subscribe link from your Sakai calendar.',
    placeholder: 'https://sakai.your-school.edu/ical/...',
  },
  {
    id: 'google-classroom',
    label: 'Google Classroom',
    helper: 'Use the secret iCal address from the Google Calendar that receives Classroom deadlines.',
    placeholder: 'https://calendar.google.com/calendar/ical/...',
  },
  {
    id: 'other',
    label: 'Other',
    helper: 'Any assignment calendar feed should work if it provides an .ics or iCal URL.',
    placeholder: 'https://...',
  },
];

const CANVAS_CALENDAR_SETUP_STEPS = [
  'Open the Canvas mobile app.',
  'Tap the top-left three-line menu.',
  'Go to Settings.',
  'Tap Subscribe to Calendar Feed, then copy and paste the link here.',
];

function getCalendarProviderOption(providerId: string | null | undefined) {
  return CALENDAR_PROVIDER_OPTIONS.find((provider) => provider.id === providerId) ?? CALENDAR_PROVIDER_OPTIONS[0];
}

function userScopedStorageKey(base: string, userId: string) {
  return `${base}_${userId || 'guest'}`;
}

function unfoldIcsLines(text: string) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const unfolded: string[] = [];
  lines.forEach((line) => {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
      return;
    }
    unfolded.push(line);
  });
  return unfolded;
}

function decodeIcsText(value: string) {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function stripHtml(value: string) {
  return decodeIcsText(value.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function getIcsField(lines: string[], fieldName: string) {
  const prefix = `${fieldName}`;
  const line = lines.find((candidate) => candidate.startsWith(`${prefix}:`) || candidate.startsWith(`${prefix};`));
  if (!line) return null;
  const separatorIndex = line.indexOf(':');
  if (separatorIndex < 0) return null;
  return {
    raw: line,
    value: line.slice(separatorIndex + 1),
  };
}

function parseIcsDate(value: string, allDay: boolean, timeZone: string) {
  const dateOnly = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return zonedDateFromParts({
      year: Number(year),
      month: Number(month),
      day: Number(day),
      hour: allDay ? 23 : 0,
      minute: allDay ? 59 : 0,
      second: 0,
    }, timeZone);
  }

  const dateTime = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!dateTime) return null;
  const [, year, month, day, hour, minute, second, isUtc] = dateTime;
  if (isUtc) {
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second ?? 0)));
  }
  return zonedDateFromParts({
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second ?? 0),
  }, timeZone);
}

function splitCalendarSummary(summary: string) {
  const contextMatch = summary.match(/\s*\[([^\]]+)\]\s*$/);
  const title = summary.replace(/\s*\[[^\]]+\]\s*$/, '').trim();
  const context = contextMatch?.[1]?.replace(/\.\.\.$/, '').trim() ?? 'Calendar';
  const courseMatch = context.match(/\b([A-Z][A-Z&]*(?:\s+[A-Z][A-Z&]*)?\s+\d+[A-Z]?)\b/);
  const sectionlessContext = context
    .split(':')[0]
    .replace(/\s+(LEC|DIS|LAB|SEM|STU|ACT|QIZ|TUT)\b.*$/i, '')
    .trim();
  return {
    title: title || summary.trim(),
    courseCode: courseMatch?.[1] ?? sectionlessContext ?? 'Calendar',
  };
}

function parseCalendarTasksFromIcs(text: string, timeZone: string): CalendarTask[] {
  const lines = unfoldIcsLines(text);
  const assignments: CalendarTask[] = [];
  let current: string[] | null = null;

  lines.forEach((line) => {
    if (line === 'BEGIN:VEVENT') {
      current = [];
      return;
    }
    if (line === 'END:VEVENT') {
      if (!current) return;
      const uid = decodeIcsText(getIcsField(current, 'UID')?.value ?? '');
      const summary = decodeIcsText(getIcsField(current, 'SUMMARY')?.value ?? '');
      const start = getIcsField(current, 'DTSTART');
      const url = decodeIcsText(getIcsField(current, 'URL')?.value ?? '');
      const description = stripHtml(getIcsField(current, 'DESCRIPTION')?.value ?? getIcsField(current, 'X-ALT-DESC')?.value ?? '');
      const allDay = start?.raw.includes('VALUE=DATE') ?? false;
      const dueAt = start ? parseIcsDate(start.value.trim(), allDay, timeZone) : null;

      if (uid && summary && dueAt && !Number.isNaN(dueAt.getTime())) {
        const parsedSummary = splitCalendarSummary(summary);
        assignments.push({
          id: uid || url || `${parsedSummary.title}-${dueAt.toISOString()}`,
          title: parsedSummary.title,
          courseCode: parsedSummary.courseCode,
          dueAt: dueAt.toISOString(),
          allDay,
          url: url || undefined,
          description: description || undefined,
        });
      }
      current = null;
      return;
    }
    if (current) current.push(line);
  });

  return assignments.sort((left, right) => new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime());
}

function formatCalendarTaskDueLabel(assignment: CalendarTask, now: Date, timeZone: string) {
  const due = new Date(assignment.dueAt);
  const dayLabel = formatRelativeEventDayLabel(due, now, timeZone);
  const prefix = due.getTime() < now.getTime() ? 'Past due' : 'Due';
  if (assignment.allDay) return `${prefix} ${dayLabel}`;
  return `${prefix} ${dayLabel} · ${formatDateInTimeZone(due, timeZone, { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

function isCalendarTaskOverdue(assignment: CalendarTask, completed: boolean, now: Date) {
  return !completed && new Date(assignment.dueAt).getTime() < now.getTime();
}

function isCalendarTaskCompleted(assignment: CalendarTask, completedTasks: Record<string, boolean>, _now: Date) {
  return completedTasks[assignment.id] === true;
}

function parseCompletedCalendarTasks(value?: string | null): Record<string, boolean> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

function parseStoredCalendarTasks(value?: string | null): CalendarTask[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((task): task is CalendarTask => (
      task
      && typeof task.id === 'string'
      && typeof task.title === 'string'
      && typeof task.courseCode === 'string'
      && typeof task.dueAt === 'string'
      && !Number.isNaN(new Date(task.dueAt).getTime())
      && typeof task.allDay === 'boolean'
    ));
  } catch {
    return [];
  }
}

function completeImportedPastCalendarTasks(
  tasks: CalendarTask[],
  previouslySeenTasks: CalendarTask[],
  completedTasks: Record<string, boolean>,
  cutoff: Date
) {
  const cutoffTime = cutoff.getTime();
  const previouslySeenTaskIds = new Set(previouslySeenTasks.map((task) => task.id));
  let next = completedTasks;
  let changed = false;

  tasks.forEach((task) => {
    if (next[task.id] !== undefined) return;
    if (previouslySeenTaskIds.has(task.id)) return;
    const dueTime = new Date(task.dueAt).getTime();
    if (!Number.isFinite(dueTime) || dueTime > cutoffTime) return;
    if (!changed) {
      next = { ...completedTasks };
      changed = true;
    }
    next[task.id] = true;
  });

  return { completedTasks: next, changed };
}

function mergeSyncedCalendarTasks(
  incomingTasks: CalendarTask[],
  existingTasks: CalendarTask[],
  completedTasks: Record<string, boolean>,
  now: Date
) {
  const mergedById = new Map<string, CalendarTask>();
  incomingTasks.forEach((task) => mergedById.set(task.id, task));

  const nowTime = now.getTime();
  existingTasks.forEach((task) => {
    if (mergedById.has(task.id)) return;
    const dueTime = new Date(task.dueAt).getTime();
    const hasManualState = completedTasks[task.id] !== undefined;
    const isPastOrOverdue = Number.isFinite(dueTime) && dueTime <= nowTime;
    if (hasManualState || isPastOrOverdue) mergedById.set(task.id, task);
  });

  return Array.from(mergedById.values()).sort((left, right) => (
    new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime()
  ));
}

function termBoundaryFromString(value: string | null | undefined, timeZone: string, endOfDay: boolean) {
  if (!value) return null;
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return zonedDateFromParts({
      year: Number(dateOnly[1]),
      month: Number(dateOnly[2]),
      day: Number(dateOnly[3]),
      hour: endOfDay ? 23 : 0,
      minute: endOfDay ? 59 : 0,
      second: endOfDay ? 59 : 0,
    }, timeZone);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function fallbackQuarterBounds(selectedQuarter: Quarter, school: string, timeZone: string): SchoolTermDateRange {
  const year = Number(selectedQuarter.year);
  const system = getSchoolConfig(school).academicSystem;
  const normalizedTerm = selectedQuarter.quarter.toLowerCase();
  const fallback = system === 'semester'
    ? normalizedTerm.includes('fall')
      ? { startMonth: 8, startDay: 20, endMonth: 12, endDay: 20 }
      : normalizedTerm.includes('summer')
        ? { startMonth: 6, startDay: 1, endMonth: 8, endDay: 15 }
        : { startMonth: 1, startDay: 10, endMonth: 5, endDay: 15 }
    : normalizedTerm.includes('fall')
      ? { startMonth: 9, startDay: 20, endMonth: 12, endDay: 15 }
      : normalizedTerm.includes('summer')
        ? { startMonth: 6, startDay: 15, endMonth: 9, endDay: 10 }
        : normalizedTerm.includes('spring')
          ? { startMonth: 3, startDay: 25, endMonth: 6, endDay: 15 }
          : { startMonth: 1, startDay: 3, endMonth: 3, endDay: 25 };

  return {
    start: zonedDateFromParts({ year, month: fallback.startMonth, day: fallback.startDay, hour: 0, minute: 0, second: 0 }, timeZone),
    end: zonedDateFromParts({ year, month: fallback.endMonth, day: fallback.endDay, hour: 23, minute: 59, second: 59 }, timeZone),
  };
}

function getQuarterBounds(
  selectedQuarter: Quarter,
  school: string,
  timeZone: string,
  termDateRange: SchoolTermDateRange | null
) {
  if (termDateRange) return termDateRange;
  return fallbackQuarterBounds(selectedQuarter, school, timeZone);
}

function getWeekNumber(now: Date, quarterStart: Date, quarterEnd: Date) {
  const totalWeeks = Math.max(1, Math.ceil((quarterEnd.getTime() - quarterStart.getTime()) / (7 * 24 * 60 * 60 * 1000)));
  const diff = now.getTime() - quarterStart.getTime();
  const week = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, Math.min(week, totalWeeks));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getDaysRemainingInQuarter(now: Date, quarterEnd: Date) {
  const diff = quarterEnd.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

function getDateLabel(now: Date, selectedQuarter: Quarter, quarterStart: Date, quarterEnd: Date, school: string, timeZone: string) {
  const parts = getZonedDateParts(now, timeZone);
  const dayName = DAY_LABELS[zonedWeekdayIndex(now, timeZone)];
  const month = MONTH_LABELS[parts.month - 1] ?? '';
  const date = parts.day;
  const week = getWeekNumber(now, quarterStart, quarterEnd);
  return `${month} ${date} ${dayName} · ${termLabel(selectedQuarter, school)} · Week ${week}`;
}

function formatAcademicDate(isoDate: string): string {
  // "2026-06-06" → "Jun 6"
  const [, month, day] = isoDate.split('-').map(Number);
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${monthNames[(month ?? 1) - 1]} ${day}`;
}

function formatEventDayLabel(date: Date, timeZone: string) {
  const parts = getZonedDateParts(date, timeZone);
  const dayName = DAY_LABELS[zonedWeekdayIndex(date, timeZone)];
  const month = MONTH_LABELS[parts.month - 1] ?? '';
  return `${dayName}, ${month} ${parts.day}`;
}

function formatRelativeEventDayLabel(date: Date, now: Date, timeZone: string) {
  const targetKey = zonedDateKey(date, timeZone);
  const todayKey = zonedDateKey(now, timeZone);
  const tomorrowKey = zonedDateKey(zonedDateFromParts({ ...getZonedDateParts(now, timeZone), day: getZonedDateParts(now, timeZone).day + 1 }, timeZone), timeZone);

  if (targetKey === todayKey) return 'Today';
  if (targetKey === tomorrowKey) return 'Tomorrow';
  return formatEventDayLabel(date, timeZone);
}

function formatSportsEventDetailDate(event: SportsEvent, timeZone: string) {
  return `${formatEventDayLabel(event.date, timeZone)} · ${formatSportsEventTime(event.date, event.timeLabel, timeZone)}`;
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

function normalizeSportsEventForDisplay(event: SportsEvent): SportsEvent {
  const normalizedEvent = { ...event, isHome: event.isHome === true };
  const lower = event.location.toLowerCase();
  const looksLikePageChrome =
    lower.includes('select sport') ||
    lower.includes('all sports') ||
    lower.includes('no filter selected') ||
    lower.includes('upcoming event') ||
    event.location.length > 90;

  if (!looksLikePageChrome) return normalizedEvent;

  return {
    ...normalizedEvent,
    location: normalizedEvent.isHome ? 'Venue TBA' : 'Away',
  };
}

function sportsHomeAwayLabel(event: SportsEvent) {
  return event.isHome ? 'Home' : 'Away';
}

function flattenDiningItems(menu: DiningLocationMenu) {
  return menu.meals.flatMap((meal) => meal.stations.flatMap((station) => station.items));
}

function previewDiningItems(menu: DiningLocationMenu, limit = 3) {
  return flattenDiningItems(menu).slice(0, limit).map((item) => item.name);
}

function mealItemCount(meal: DiningMenuMeal) {
  return meal.stations.reduce((total, station) => total + station.items.length, 0);
}

function diningStationLabel(name: string, index: number) {
  const label = String(name ?? '').trim();
  return !label || label.toLowerCase() === 'menu' ? 'Items' : label;
}

async function openSportsVenueInMaps(venue: SportsVenue, school: string) {
  const query = encodeURIComponent(`${schoolCampusLabel(school)} ${venue.name}`);
  const appleMapsUrl = `https://maps.apple.com/?ll=${venue.latitude},${venue.longitude}&q=${query}`;
  try {
    await Linking.openURL(appleMapsUrl);
  } catch {}
}

function getTodayDayCode(now: Date, timeZone: string): string | null {
  const day = zonedWeekdayIndex(now, timeZone);
  if (day === 0) return 'Su';
  if (day === 1) return 'M';
  if (day === 2) return 'T';
  if (day === 3) return 'W';
  if (day === 4) return 'Th';
  if (day === 5) return 'F';
  if (day === 6) return 'Sa';
  return null;
}

function getDaysArray(daysString: string): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < daysString.length) {
    const two = daysString.slice(i, i + 2);
    if (two === 'Th') { result.push('Th'); i += 2; continue; }
    if (two === 'Tu') { result.push('T'); i += 2; continue; }
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

function extractStartHour(timeRange: string): number {
  const start = timeRange?.split(' - ')[0];
  if (!start) return 0;
  const [hour, minute] = start.split(':').map(Number);
  if (isNaN(hour)) return 0;
  return hour + (minute || 0) / 60;
}

function extractEndHour(timeRange: string): number {
  const end = timeRange?.split(' - ')[1];
  if (!end) return 0;
  const [hour, minute] = end.split(':').map(Number);
  if (isNaN(hour)) return 0;
  return hour + (minute || 0) / 60;
}

function dateFromHour(baseDate: Date, hourValue: number, timeZone: string) {
  const hours = Math.floor(hourValue);
  const minutes = Math.round((hourValue - hours) * 60);
  const parts = getZonedDateParts(baseDate, timeZone);
  return zonedDateFromParts({ ...parts, hour: hours, minute: minutes, second: 0 }, timeZone);
}

function formatClock(date: Date, timeZone: string) {
  return formatDateInTimeZone(date, timeZone, { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatTimelineClockParts(date: Date, timeZone: string) {
  const label = formatClock(date, timeZone);
  const match = label.match(/^(.+)\s([AP]M)$/i);
  return match
    ? { time: match[1], period: match[2].toUpperCase() }
    : { time: label, period: '' };
}

function formatDuration(totalMinutes: number) {
  const rounded = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatHeroTimeRange(timeRange: string) {
  return formatCourseTimeRange12(timeRange, { compact: true });
}

function formatHeroTimelineLocation(location?: string) {
  const raw = location?.trim();
  if (!raw) return '';
  const normalized = raw.toLowerCase();
  if (
    normalized === 'tba'
    || normalized === 'location tba'
    || normalized === 'online'
    || normalized === 'remote'
    || normalized === 'main campus'
    || /^[a-z .'-]+,\s*[a-z]{2}(?:\s*\([^)]*\))?$/i.test(raw)
  ) {
    return '';
  }
  return raw;
}

function ProgressRing({
  progress,
  color,
  trackColor,
  textColor,
  subTextColor,
  primaryLabel,
  secondaryLabel,
  size = 74,
  strokeWidth = 6,
}: {
  progress: number;
  color: string;
  trackColor: string;
  textColor: string;
  subTextColor: string;
  primaryLabel: string;
  secondaryLabel?: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeProgress = clamp(progress, 0, 1);
  const dashOffset = circumference * (1 - safeProgress);
  const primaryFontSize = size >= 108 ? 22 : size >= 90 ? 20 : size >= 74 ? 16 : 14;
  const secondaryFontSize = size >= 108 ? 11 : 10;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', width: size - 18 }}>
        <Text style={{ fontSize: primaryFontSize, fontWeight: '800', color: textColor }}>
          {primaryLabel}
        </Text>
        {secondaryLabel ? (
          <Text style={{ fontSize: secondaryFontSize, color: subTextColor, marginTop: 1, textAlign: 'center' }}>
            {secondaryLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function DualProgressRing({
  outerProgress, outerColor, outerTrackColor,
  innerProgress, innerColor, innerTrackColor,
  primaryLabel, secondaryLabel,
  textColor, subTextColor,
  size = 96,
  outerStrokeWidth = 5,
  innerStrokeWidth = 6,
}: {
  outerProgress: number;
  outerColor: string;
  outerTrackColor: string;
  innerProgress: number;
  innerColor: string;
  innerTrackColor: string;
  primaryLabel: string;
  secondaryLabel?: string;
  textColor: string;
  subTextColor: string;
  size?: number;
  outerStrokeWidth?: number;
  innerStrokeWidth?: number;
}) {
  const outerRadius = (size - outerStrokeWidth) / 2;
  const innerRadius = outerRadius - outerStrokeWidth / 2 - 5 - innerStrokeWidth / 2;
  const outerCircumference = 2 * Math.PI * outerRadius;
  const innerCircumference = 2 * Math.PI * innerRadius;
  const outerOffset = outerCircumference * (1 - clamp(outerProgress, 0, 1));
  const innerOffset = innerCircumference * (1 - clamp(innerProgress, 0, 1));
  const primaryFontSize = size >= 108 ? 22 : size >= 90 ? 18 : size >= 74 ? 15 : 13;
  const secondaryFontSize = 10;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={outerRadius} stroke={outerTrackColor} strokeWidth={outerStrokeWidth} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={outerRadius}
          stroke={outerColor} strokeWidth={outerStrokeWidth} fill="none"
          strokeLinecap="round"
          strokeDasharray={`${outerCircumference} ${outerCircumference}`}
          strokeDashoffset={outerOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <Circle cx={size / 2} cy={size / 2} r={innerRadius} stroke={innerTrackColor} strokeWidth={innerStrokeWidth} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={innerRadius}
          stroke={innerColor} strokeWidth={innerStrokeWidth} fill="none"
          strokeLinecap="round"
          strokeDasharray={`${innerCircumference} ${innerCircumference}`}
          strokeDashoffset={innerOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', width: innerRadius * 2 - innerStrokeWidth }}>
        <Text style={{ fontSize: primaryFontSize, fontWeight: '800', color: textColor }}>
          {primaryLabel}
        </Text>
        {secondaryLabel ? (
          <Text style={{ fontSize: secondaryFontSize, color: subTextColor, marginTop: 1, textAlign: 'center' }}>
            {secondaryLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function HomeScreen({
  activeCourses,
  selectedQuarter,
  onOpenSettings,
  userId,
  school,
  timeZone,
  topInset = 0,
  bottomInset = 0,
  scrollToTopTrigger = 0,
  onAssignmentCalendarChange,
  timetableSettings = DEFAULT_TIMETABLE_SETTINGS,
}: Props) {
  const { colors, isDark } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const effectiveTimeZone = normalizeTimeZone(timeZone, getSchoolConfig(school).timeZone);
  const scrollRef = useRef<ScrollView>(null);
  const sportsEventScrollRef = useRef<ScrollView>(null);
  const sportsEventCommentInputRef = useRef<TextInput>(null);
  const calendarSetupScrollRef = useRef<ScrollView>(null);
  const calendarFeedInputRef = useRef<TextInput>(null);
  const [sportsEvents, setSportsEvents] = useState<SportsEvent[]>([]);
  const [sportsLoading, setSportsLoading] = useState(false);
  const [diningMenus, setDiningMenus] = useState<DiningLocationMenu[]>([]);
  const [diningLoading, setDiningLoading] = useState(false);
  const [diningError, setDiningError] = useState<string | null>(null);
  const [calendarProvider, setCalendarProvider] = useState<CalendarProviderId>(DEFAULT_CALENDAR_PROVIDER_ID);
  const [calendarFeedUrl, setCalendarFeedUrl] = useState<string | null>(null);
  const [calendarFeedInput, setCalendarFeedInput] = useState('');
  const [showCalendarSetup, setShowCalendarSetup] = useState(false);
  const [calendarTasks, setCalendarTasks] = useState<CalendarTask[]>([]);
  const [calendarTasksLoading, setCalendarTasksLoading] = useState(false);
  const [calendarTasksError, setCalendarTasksError] = useState<string | null>(null);
  const [calendarLastSyncedAt, setCalendarLastSyncedAt] = useState<string | null>(null);
  const [completedCalendarTasks, setCompletedCalendarTasks] = useState<Record<string, boolean>>({});
  const calendarTasksRef = useRef<CalendarTask[]>([]);
  const calendarLastSyncedAtRef = useRef<string | null>(null);
  const completedCalendarTasksRef = useRef<Record<string, boolean>>({});
  const [showPastAssignments, setShowPastAssignments] = useState(false);
  const [classmateMatches, setClassmateMatches] = useState<ClassmateMatch[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [selectedSportsEvent, setSelectedSportsEvent] = useState<SportsEvent | null>(null);
  const [showSportsEventsList, setShowSportsEventsList] = useState(false);
  const [showDiningMenuList, setShowDiningMenuList] = useState(false);
  const sportsListBackdropAnim = useRef(new Animated.Value(0)).current;
  const sportsListSheetAnim = useRef(new Animated.Value(SHEET_INITIAL_TRANSLATE_Y)).current;
  const diningListBackdropAnim = useRef(new Animated.Value(0)).current;
  const diningListSheetAnim = useRef(new Animated.Value(SHEET_INITIAL_TRANSLATE_Y)).current;
  const sportsEventBackdropAnim = useRef(new Animated.Value(0)).current;
  const sportsEventSheetAnim = useRef(new Animated.Value(SHEET_INITIAL_TRANSLATE_Y)).current;
  const sportsEventKeyboardOffsetAnim = useRef(new Animated.Value(0)).current;
  const pastAssignmentsBackdropAnim = useRef(new Animated.Value(0)).current;
  const pastAssignmentsSheetAnim = useRef(new Animated.Value(SHEET_INITIAL_TRANSLATE_Y)).current;
  const calendarSetupBackdropAnim = useRef(new Animated.Value(0)).current;
  const calendarSetupSheetAnim = useRef(new Animated.Value(SHEET_INITIAL_TRANSLATE_Y)).current;
  const selectedSportsEventRef = useRef<SportsEvent | null>(null);
  const [sportsEventRsvp, setSportsEventRsvp] = useState<SportsEventRsvpStatus | null>(null);
  const [sportsEventGoingCount, setSportsEventGoingCount] = useState(0);
  const [sportsEventComments, setSportsEventComments] = useState<SportsEventComment[]>([]);
  const [sportsEventCommentInput, setSportsEventCommentInput] = useState('');
  const [sportsEventListParticipation, setSportsEventListParticipation] = useState<Record<string, number>>({});
  const [sportsEventUserRsvps, setSportsEventUserRsvps] = useState<Record<string, SportsEventRsvpStatus>>({});
  const [sportsEventDetailLoading, setSportsEventDetailLoading] = useState(false);
  const [savingSportsEventRsvp, setSavingSportsEventRsvp] = useState(false);
  const [submittingSportsEventComment, setSubmittingSportsEventComment] = useState(false);
  const [deletingSportsEventCommentId, setDeletingSportsEventCommentId] = useState<string | null>(null);
  const keyboardInset = useKeyboardInset({ bottomInset });
  const sportsEventKeyboardVisible = keyboardInset.visible;
  const calendarSetupKeyboardVisible = keyboardInset.visible;
  const [showCampusInfo, setShowCampusInfo] = useState(false);
  const [expandedCampusInfoCards, setExpandedCampusInfoCards] = useState<Record<string, boolean>>({});
  const [termDateRange, setTermDateRange] = useState<SchoolTermDateRange | null>(null);

  const selectedQuarterKey = quarterKey(selectedQuarter);
  const calendarProviderStorageKey = userScopedStorageKey('assignment_calendar_provider', userId);
  const calendarFeedStorageKey = userScopedStorageKey('assignment_calendar_feed', userId);
  const calendarTasksStorageKey = userScopedStorageKey('assignment_calendar_tasks_cache', userId);
  const calendarCompletedStorageKey = userScopedStorageKey('assignment_calendar_completed', userId);
  const calendarLastSyncStorageKey = userScopedStorageKey('assignment_calendar_last_sync', userId);
  const legacyCalendarFeedStorageKey = userScopedStorageKey('canvas_calendar_feed', userId);
  const legacyCalendarTasksStorageKey = userScopedStorageKey('canvas_assignments_cache', userId);
  const legacyCalendarCompletedStorageKey = userScopedStorageKey('canvas_assignments_completed', userId);
  const legacyCalendarLastSyncStorageKey = userScopedStorageKey('canvas_assignments_last_sync', userId);
  const { start: quarterStart, end: quarterEnd } = getQuarterBounds(selectedQuarter, school, effectiveTimeZone, termDateRange);
  const sportsEventSheetHeight = Math.round(windowHeight * 0.88);
  const sportsListSheetHeight = Math.round(windowHeight * 0.72);
  const diningListSheetHeight = Math.round(windowHeight * 0.84);
  const pastAssignmentsSheetHeight = Math.round(windowHeight * 0.74);
  const calendarSetupSheetHeight = Math.min(
    Math.round(windowHeight * 0.84),
    Math.max(360, windowHeight - 88)
  );
  const sportsEventCommentFooterPadding = sportsEventKeyboardVisible ? 8 : Math.max(bottomInset, 12) + 10;
  const sportsEventScrollBottomPadding = sportsEventKeyboardVisible ? 92 : 18;
  const resetSportsEventDetailScroll = useCallback(() => {
    const timers = [0, 80, 180].map((delay) =>
      setTimeout(() => sportsEventScrollRef.current?.scrollTo({ y: 0, animated: false }), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTermDateRange() {
      setTermDateRange(null);
      const { data, error } = await supabase
        .from('school_terms')
        .select('start_date, end_date')
        .eq('school', school)
        .eq('quarter_key', selectedQuarterKey)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        const message = String(error.message ?? '').toLowerCase();
        if (error.code !== 'PGRST205' && error.code !== 'PGRST204' && error.code !== '42703' && !message.includes('start_date') && !message.includes('end_date')) {
          console.warn('Failed to load school term dates:', error);
        }
        setTermDateRange(null);
        return;
      }

      const row = data as { start_date?: string | null; end_date?: string | null } | null;
      const start = termBoundaryFromString(row?.start_date, effectiveTimeZone, false);
      const end = termBoundaryFromString(row?.end_date, effectiveTimeZone, true);
      setTermDateRange(start && end ? { start, end } : null);
    }

    void loadTermDateRange();
    return () => {
      cancelled = true;
    };
  }, [effectiveTimeZone, school, selectedQuarterKey]);

  const scrollSportsEventDetailToEnd = useCallback((animated = true, delay = 0) => {
    const run = () => sportsEventScrollRef.current?.scrollToEnd({ animated });
    if (delay > 0) {
      setTimeout(run, delay);
      return;
    }
    requestAnimationFrame(run);
  }, []);
  const settleSportsEventComposer = useCallback((animated = true) => {
    const timers = [90, 180, 340].map((delay) =>
      setTimeout(() => sportsEventScrollRef.current?.scrollToEnd({ animated }), delay)
    );
    sportsEventScrollRef.current?.scrollToEnd({ animated });
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    selectedSportsEventRef.current = selectedSportsEvent;
  }, [selectedSportsEvent]);

  const selectedCalendarProvider = getCalendarProviderOption(calendarProvider);

  useEffect(() => {
    calendarTasksRef.current = calendarTasks;
  }, [calendarTasks]);

  useEffect(() => {
    calendarLastSyncedAtRef.current = calendarLastSyncedAt;
  }, [calendarLastSyncedAt]);

  useEffect(() => {
    completedCalendarTasksRef.current = completedCalendarTasks;
  }, [completedCalendarTasks]);

  const syncCalendarTasks = useCallback(async (feedUrl: string, options: CalendarSyncOptions = {}) => {
    const trimmedUrl = feedUrl.trim();
    if (!trimmedUrl) return;
    setCalendarTasksLoading(true);
    setCalendarTasksError(null);
    try {
      const calController = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const calTimeout = setTimeout(() => calController?.abort(), 15_000);
      let response: Response;
      try {
        response = await fetch(trimmedUrl, { signal: calController?.signal });
      } finally {
        clearTimeout(calTimeout);
      }
      if (!response.ok) throw new Error(`Calendar feed returned ${response.status}`);
      const text = await response.text();
      const parsedTasks = parseCalendarTasksFromIcs(text, effectiveTimeZone);
      const syncedAt = new Date().toISOString();
      const priorLastSync = options.previousLastSync ?? calendarLastSyncedAtRef.current;
      const previousTasks = options.tasksSnapshot ?? calendarTasksRef.current;
      const importCutoff = priorLastSync && !Number.isNaN(new Date(priorLastSync).getTime())
        ? new Date(priorLastSync)
        : new Date(syncedAt);
      const seededCompletion = completeImportedPastCalendarTasks(
        parsedTasks,
        previousTasks,
        options.completedSnapshot ?? completedCalendarTasksRef.current,
        importCutoff
      );
      const mergedTasks = mergeSyncedCalendarTasks(
        parsedTasks,
        previousTasks,
        seededCompletion.completedTasks,
        new Date(syncedAt)
      );
      calendarTasksRef.current = mergedTasks;
      setCalendarTasks(mergedTasks);
      if (seededCompletion.changed) {
        completedCalendarTasksRef.current = seededCompletion.completedTasks;
        setCompletedCalendarTasks(seededCompletion.completedTasks);
      }
      calendarLastSyncedAtRef.current = syncedAt;
      setCalendarLastSyncedAt(syncedAt);
      const updates: [string, string][] = [
        [calendarTasksStorageKey, JSON.stringify(mergedTasks)],
        [calendarLastSyncStorageKey, syncedAt],
      ];
      if (seededCompletion.changed) {
        updates.push([calendarCompletedStorageKey, JSON.stringify(seededCompletion.completedTasks)]);
      }
      void AsyncStorage.multiSet(updates);
      onAssignmentCalendarChange?.();
    } catch {
      setCalendarTasksError('Could not refresh this calendar feed. Check the link and try again.');
    } finally {
      setCalendarTasksLoading(false);
    }
  }, [calendarCompletedStorageKey, calendarTasksStorageKey, calendarLastSyncStorageKey, effectiveTimeZone, onAssignmentCalendarChange]);

  useEffect(() => {
    let cancelled = false;

    async function loadCalendarState() {
      const [
        storedProvider,
        storedFeedUrl,
        storedTasks,
        storedCompleted,
        storedLastSync,
        legacyFeedUrl,
        legacyTasks,
        legacyCompleted,
        legacyLastSync,
      ] = await AsyncStorage.multiGet([
        calendarProviderStorageKey,
        calendarFeedStorageKey,
        calendarTasksStorageKey,
        calendarCompletedStorageKey,
        calendarLastSyncStorageKey,
        legacyCalendarFeedStorageKey,
        legacyCalendarTasksStorageKey,
        legacyCalendarCompletedStorageKey,
        legacyCalendarLastSyncStorageKey,
      ]).then((entries) => entries.map(([, value]) => value));

      if (cancelled) return;
      const resolvedProvider = getCalendarProviderOption(storedProvider).id;
      const resolvedFeedUrl = storedFeedUrl ?? legacyFeedUrl;
      const resolvedTasks = storedTasks ?? legacyTasks;
      const resolvedCompleted = storedCompleted ?? legacyCompleted;
      const resolvedLastSync = storedLastSync ?? legacyLastSync;
      const resolvedCalendarTasks = parseStoredCalendarTasks(resolvedTasks);
      const resolvedCompletedTasks = parseCompletedCalendarTasks(resolvedCompleted);
      calendarTasksRef.current = resolvedCalendarTasks;
      calendarLastSyncedAtRef.current = resolvedLastSync;
      completedCalendarTasksRef.current = resolvedCompletedTasks;
      setCalendarProvider(resolvedProvider);
      setCalendarFeedUrl(resolvedFeedUrl);
      setCalendarFeedInput(resolvedFeedUrl ?? '');
      setCalendarLastSyncedAt(resolvedLastSync);

      setCalendarTasks(resolvedCalendarTasks);

      setCompletedCalendarTasks(resolvedCompletedTasks);

      if (!storedFeedUrl && legacyFeedUrl) {
        void AsyncStorage.multiSet([
          [calendarProviderStorageKey, DEFAULT_CALENDAR_PROVIDER_ID],
          [calendarFeedStorageKey, legacyFeedUrl],
          ...(legacyTasks ? [[calendarTasksStorageKey, legacyTasks] as [string, string]] : []),
          ...(legacyCompleted ? [[calendarCompletedStorageKey, legacyCompleted] as [string, string]] : []),
          ...(legacyLastSync ? [[calendarLastSyncStorageKey, legacyLastSync] as [string, string]] : []),
        ]);
      }

      onAssignmentCalendarChange?.();
      if (resolvedFeedUrl) {
        void syncCalendarTasks(resolvedFeedUrl, {
          completedSnapshot: resolvedCompletedTasks,
          tasksSnapshot: resolvedCalendarTasks,
          previousLastSync: resolvedLastSync,
        });
      }
    }

    void loadCalendarState();
    return () => {
      cancelled = true;
    };
  }, [
    calendarCompletedStorageKey,
    calendarFeedStorageKey,
    calendarLastSyncStorageKey,
    calendarProviderStorageKey,
    calendarTasksStorageKey,
    legacyCalendarCompletedStorageKey,
    legacyCalendarFeedStorageKey,
    legacyCalendarLastSyncStorageKey,
    legacyCalendarTasksStorageKey,
    onAssignmentCalendarChange,
    syncCalendarTasks,
  ]);

  async function saveCalendarFeed() {
    const trimmedUrl = calendarFeedInput.trim();
    if (!trimmedUrl) {
      Alert.alert('Calendar link needed', `Paste your ${selectedCalendarProvider.label} calendar feed link first.`);
      return;
    }
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      Alert.alert('Use a full link', 'Paste the full calendar feed URL that starts with https://.');
      return;
    }
    const replacingFeed = trimmedUrl !== calendarFeedUrl;
    const completedSnapshot = replacingFeed ? {} : completedCalendarTasks;
    const tasksSnapshot = replacingFeed ? [] : calendarTasks;
    const previousLastSync = replacingFeed ? null : calendarLastSyncedAt;
    if (replacingFeed) {
      calendarTasksRef.current = [];
      calendarLastSyncedAtRef.current = null;
      completedCalendarTasksRef.current = {};
      setCalendarTasks([]);
      setCalendarLastSyncedAt(null);
      setCompletedCalendarTasks({});
    }
    setCalendarFeedUrl(trimmedUrl);
    closeCalendarSetup();
    const updates: [string, string][] = [
      [calendarProviderStorageKey, calendarProvider],
      [calendarFeedStorageKey, trimmedUrl],
    ];
    if (replacingFeed) updates.push([calendarCompletedStorageKey, JSON.stringify({})]);
    await AsyncStorage.multiSet(updates);
    if (replacingFeed) {
      await AsyncStorage.multiRemove([calendarTasksStorageKey, calendarLastSyncStorageKey]);
    }
    void syncCalendarTasks(trimmedUrl, { completedSnapshot, tasksSnapshot, previousLastSync });
  }

  async function disconnectCalendarFeed() {
    setCalendarFeedUrl(null);
    setCalendarFeedInput('');
    setCalendarTasks([]);
    setCalendarTasksError(null);
    setCalendarLastSyncedAt(null);
    setCompletedCalendarTasks({});
    calendarTasksRef.current = [];
    calendarLastSyncedAtRef.current = null;
    completedCalendarTasksRef.current = {};
    await AsyncStorage.multiRemove([
      calendarProviderStorageKey,
      calendarFeedStorageKey,
      calendarTasksStorageKey,
      calendarCompletedStorageKey,
      calendarLastSyncStorageKey,
      legacyCalendarFeedStorageKey,
      legacyCalendarTasksStorageKey,
      legacyCalendarCompletedStorageKey,
      legacyCalendarLastSyncStorageKey,
    ]);
    onAssignmentCalendarChange?.();
    closeCalendarSetup();
  }

  function toggleCalendarTask(assignment: CalendarTask) {
    setCompletedCalendarTasks((current) => {
      const currentlyCompleted = isCalendarTaskCompleted(assignment, current, now);
      const next = { ...current };
      if (currentlyCompleted) {
        next[assignment.id] = false;
      } else {
        next[assignment.id] = true;
      }
      completedCalendarTasksRef.current = next;
      void AsyncStorage.setItem(calendarCompletedStorageKey, JSON.stringify(next));
      onAssignmentCalendarChange?.();
      return next;
    });
  }

  async function openCalendarTask(assignment: CalendarTask) {
    if (!assignment.url) return;
    try {
      await Linking.openURL(assignment.url);
    } catch {
      Alert.alert('Could not open assignment', 'Try opening the assignment from your LMS directly.');
    }
  }

  useEffect(() => {
    if (keyboardInset.visible && selectedSportsEventRef.current) settleSportsEventComposer(true);
  }, [keyboardInset.visible, settleSportsEventComposer]);

  // Shift the sports-event sheet up when keyboard appears so the input bar is never covered
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(sportsEventKeyboardOffsetAnim, {
        toValue: -(e.endCoordinates?.height ?? 0),
        duration: (e as any).duration ?? 250,
        useNativeDriver: true,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(sportsEventKeyboardOffsetAnim, {
        toValue: 0,
        duration: (e as any).duration ?? 200,
        useNativeDriver: true,
      }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [sportsEventKeyboardOffsetAnim]);

  useEffect(() => {
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    async function loadSports() {
      const sportsCacheKey = `sports_cache_${school}`;
      const sportsCacheDate = zonedDateKey(new Date(), effectiveTimeZone);
      setSportsEvents([]);
      setSportsEventListParticipation({});
      setSportsEventUserRsvps({});
      selectedSportsEventRef.current = null;
      setSelectedSportsEvent(null);
      setSportsEventRsvp(null);
      setSportsEventGoingCount(0);
      setSportsEventComments([]);
      setSportsLoading(false);

      if (!schoolFeatureEnabled(school, 'sports')) {
        if (!cancelled) setSportsLoading(false);
        return;
      }

      setSportsLoading(true);
      const cached = await AsyncStorage.getItem(sportsCacheKey);
      if (cached && !cancelled) {
        try {
          const parsed = JSON.parse(cached) as { date?: string; events?: any[] };
          if (parsed.date === sportsCacheDate && Array.isArray(parsed.events)) {
            setSportsEvents(parsed.events.map((event: any) => (
              normalizeSportsEventForDisplay({ ...event, date: new Date(event.date) })
            )));
            setSportsLoading(false);
          }
        } catch {}
      }

      refreshTimer = setTimeout(() => {
        void (async () => {
          try {
            const events = await fetchSportsEventsForSchool(school, { maxDaysAhead: 7, includePastDays: 0 });
            const normalizedEvents = events.map(normalizeSportsEventForDisplay);
            if (cancelled) return;
            setSportsEvents(normalizedEvents);
            void AsyncStorage.setItem(sportsCacheKey, JSON.stringify({ date: sportsCacheDate, events: normalizedEvents }));
          } catch {}
          if (!cancelled) setSportsLoading(false);
        })();
      }, HOME_SPORTS_FETCH_DELAY_MS);
    }

    void loadSports();
    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [effectiveTimeZone, school]);

  useEffect(() => {
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    async function loadDiningMenus() {
      const diningCacheKey = `dining_menus_cache_${school}`;
      const todayDiningCacheDate = zonedDateKey(new Date(), effectiveTimeZone);
      setDiningMenus([]);
      setDiningError(null);
      setDiningLoading(false);

      if (!schoolDiningMenusSupported(school)) return;

      setDiningLoading(true);
      const cached = await AsyncStorage.getItem(diningCacheKey);
      if (cached && !cancelled) {
        try {
          const parsed = JSON.parse(cached) as { date: string; menus: DiningLocationMenu[] };
          if (parsed.date === todayDiningCacheDate) {
            setDiningMenus(parsed.menus);
            setDiningLoading(false);
          }
        } catch {}
      }

      refreshTimer = setTimeout(() => {
        void (async () => {
          try {
            const menus = await fetchDiningMenusForSchool(school, new Date());
            if (cancelled) return;
            setDiningMenus(menus);
            setDiningError(null);
            void AsyncStorage.setItem(diningCacheKey, JSON.stringify({
              date: todayDiningCacheDate,
              menus,
            }));
          } catch {
            if (!cancelled) setDiningError('Dining menus are unavailable right now.');
          } finally {
            if (!cancelled) setDiningLoading(false);
          }
        })();
      }, 450);
    }

    void loadDiningMenus();
    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [effectiveTimeZone, school]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollToTopTrigger > 0) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scrollToTopTrigger]);

  const homeScheduleSignature = useMemo(
    () => activeCourses
      .map((course) => `${buildSectionMatchKey(course)}:${normalizeCourseCode(course)}`)
      .sort()
      .join(','),
    [activeCourses]
  );

  useEffect(() => {
    if (!userId || activeCourses.length === 0) {
      setClassmateMatches([]);
      return;
    }

    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    async function loadClassmates() {
      const cacheKey = `home_classmates_v2_${userId}_${school}_${selectedQuarterKey}_${homeScheduleSignature}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached && !cancelled) {
        try {
          setClassmateMatches(JSON.parse(cached) as ClassmateMatch[]);
        } catch {}
      }

      let { data: requestRows, error: requestError } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id, status')
        .eq('school', school)
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

      if (cancelled) return;
      if (requestError && isMissingSchoolColumnError(requestError)) {
        const fallback = await supabase
          .from('friend_requests')
          .select('sender_id, receiver_id, status')
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
        requestRows = fallback.data;
        requestError = fallback.error;
      }

      if (cancelled) return;
      if (requestError) {
        if (!isMissingSchoolColumnError(requestError)) {
          console.warn('Failed to load classmates for home:', requestError);
        }
        return;
      }

      const acceptedIds = Array.from(
        new Set(
          ((requestRows ?? []) as FriendRequestRow[])
            .filter((row) => row.status === 'accepted')
            .map((row) => (row.sender_id === userId ? row.receiver_id : row.sender_id))
        )
      );

      if (acceptedIds.length === 0) {
        setClassmateMatches([]);
        void AsyncStorage.setItem(cacheKey, JSON.stringify([]));
        return;
      }

      const visibilityPromise = supabase
        .rpc('get_friend_timetable_visibility', {
          friend_ids: acceptedIds,
          target_school: school,
        })
        .then(async (result) => {
          if (result.error?.code === 'PGRST202' || result.error?.code === '42883') {
            return supabase.from('user_settings').select('user_id, timetable_visibility').in('user_id', acceptedIds);
          }
          return result;
        });

      const [
        { data: profilesData, error: profilesError },
        { data: settingsData, error: settingsError },
        { data: timetableData, error: timetableError },
      ] = await Promise.all([
        supabase.from('profiles').select('id, name, email').eq('school', school).in('id', acceptedIds),
        visibilityPromise,
        supabase.from('timetables').select('user_id, name, courses').eq('school', school).eq('quarter_key', selectedQuarterKey).in('user_id', acceptedIds),
      ]);

      if (cancelled) return;
      if (profilesError) console.warn('Failed to load home classmate profiles:', profilesError);
      if (settingsError) console.warn('Failed to load home classmate visibility:', settingsError);
      if (timetableError) console.warn('Failed to load home classmate timetables:', timetableError);

      const profilesById = Object.fromEntries(
        ((profilesData ?? []) as ProfileRow[]).map((row) => [row.id, row])
      );
      const visibilityById = Object.fromEntries(
        ((settingsData ?? []) as FriendSettingsRow[]).map((row) => [row.user_id, row.timetable_visibility ?? 'friends'])
      );

      const timetableRowsByUser = new Map<string, FriendTimetableRow[]>();
      ((timetableData ?? []) as FriendTimetableRow[]).forEach((row) => {
        const existing = timetableRowsByUser.get(row.user_id) ?? [];
        existing.push(row);
        timetableRowsByUser.set(row.user_id, existing);
      });

      const matches = acceptedIds.flatMap((friendId) => {
        if (visibilityById[friendId] === 'private') return [];

        const profile = profilesById[friendId];
        const candidateTimetables = timetableRowsByUser.get(friendId) ?? [];
        const primaryTimetable =
          candidateTimetables.find((row) => row.name === 'My Schedule')
          ?? candidateTimetables[0]
          ?? null;
        const friendCourses = primaryTimetable?.courses ?? [];
        const sharedCourseMatches = activeCourses.flatMap((course) => {
          const matchTypes = friendCourses
            .map((friendCourse) => getSharedClassMatch(course, friendCourse))
            .filter((matchType): matchType is SharedClassMatch => Boolean(matchType));
          if (matchTypes.length === 0) return [];
          const matchType: SharedClassMatch = matchTypes.includes('same_section') ? 'same_section' : 'same_course';
          return [{
            courseKey: buildSectionMatchKey(course),
            courseCode: course.code,
            matchType,
          }];
        });

        if (!profile || sharedCourseMatches.length === 0) return [];

        return [{
          id: friendId,
          name: profile.name?.trim() || (profile.email?.split('@')[0] ?? 'Classmate'),
          email: profile.email ?? '',
          sharedCourseMatches,
        }];
      }).sort((left, right) => {
        if (right.sharedCourseMatches.length !== left.sharedCourseMatches.length) {
          return right.sharedCourseMatches.length - left.sharedCourseMatches.length;
        }
        return left.name.localeCompare(right.name);
      });

      setClassmateMatches(matches);
      void AsyncStorage.setItem(cacheKey, JSON.stringify(matches));
    }

    refreshTimer = setTimeout(() => {
      void loadClassmates();
    }, HOME_CLASSMATES_FETCH_DELAY_MS);

    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [activeCourses, homeScheduleSignature, school, selectedQuarterKey, userId]);

  const todayCode = getTodayDayCode(now, effectiveTimeZone);
  const todayCourses = useMemo(
    () => (todayCode
      ? activeCourses
          .filter((course) => course.days !== 'TBA' && course.time !== 'TBA' && getDaysArray(course.days).includes(todayCode))
          .sort((left, right) => extractStartHour(left.time) - extractStartHour(right.time))
      : []),
    [activeCourses, todayCode]
  );

  const nowParts = getZonedDateParts(now, effectiveTimeZone);
  const nowHour = nowParts.hour + nowParts.minute / 60;
  const completedClasses = todayCourses.filter((course) => extractEndHour(course.time) <= nowHour).length;
  const shouldShowDiningHeroPage = schoolDiningMenusSupported(school);
  const shouldShowSportsHeroPage = schoolFeatureEnabled(school, 'sports');
  const mainHeroItem: HeroCardItem = todayCourses.length > 0
    ? { type: 'upcomingSummary', courses: todayCourses }
    : { type: 'idleSummary' };
  // ── Academic Calendar sheet ──────────────────────────────────────────────
  const [selectedAcademicEvent, setSelectedAcademicEvent] = useState<AcademicEvent | null>(null);
  const [academicSheetVisible, setAcademicSheetVisible] = useState(false);
  const academicSheetAnim = useRef(new Animated.Value(700)).current;
  const academicBackdropAnim = useRef(new Animated.Value(0)).current;

  const openAcademicSheet = useCallback((event: AcademicEvent) => {
    setSelectedAcademicEvent(event);
    setAcademicSheetVisible(true);
    academicSheetAnim.setValue(700);
    academicBackdropAnim.setValue(0);
    Animated.parallel([
      Animated.spring(academicSheetAnim, { toValue: 0, useNativeDriver: true, damping: 28, stiffness: 320, mass: 0.85 }),
      Animated.timing(academicBackdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
    triggerSelectionHaptic();
  }, [academicSheetAnim, academicBackdropAnim]);

  const closeAcademicSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(academicSheetAnim, { toValue: 700, duration: 250, useNativeDriver: true }),
      Animated.timing(academicBackdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setAcademicSheetVisible(false);
      setSelectedAcademicEvent(null);
    });
  }, [academicSheetAnim, academicBackdropAnim]);

  const qKey = quarterKey(selectedQuarter);
  const [upcomingAcademicEvents, setUpcomingAcademicEvents] = useState<AcademicEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchAcademicEvents(school, qKey).then((events) => {
      if (!cancelled) {
        // 현재 학기: 아직 안 지난 이벤트만 표시 (스트립 깔끔하게)
        // 지난 학기: 전체 이벤트 표시 (학기 전체 일정 참고용)
        const todayStr = new Date().toISOString().slice(0, 10);
        const quarterEndStr = events.length > 0
          ? events[events.length - 1].endDate ?? events[events.length - 1].date
          : todayStr;
        const isCurrentOrFutureQuarter = quarterEndStr >= todayStr;
        const filtered = isCurrentOrFutureQuarter
          ? filterUpcomingEvents(events, new Date())
          : events;
        setUpcomingAcademicEvents(filtered);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [school, qKey]);

  const [openHeroSheet, setOpenHeroSheet] = useState<'dining' | 'sports' | 'campus' | null>(null);
  const [heroSheetVisible, setHeroSheetVisible] = useState(false);
  const heroSheetSlideAnim = useRef(new Animated.Value(700)).current;
  const openHeroSheetFor = useCallback((type: 'dining' | 'sports' | 'campus') => {
    setOpenHeroSheet(type);
    setHeroSheetVisible(true);
    heroSheetSlideAnim.setValue(700);
    Animated.spring(heroSheetSlideAnim, { toValue: 0, useNativeDriver: true, damping: 28, stiffness: 320, mass: 0.85 }).start();
    triggerSelectionHaptic();
  }, [heroSheetSlideAnim]);
  const closeHeroSheet = useCallback(() => {
    Animated.timing(heroSheetSlideAnim, { toValue: 700, duration: 250, useNativeDriver: true }).start(() => {
      setHeroSheetVisible(false);
      setOpenHeroSheet(null);
    });
  }, [heroSheetSlideAnim]);

  const daysRemaining = getDaysRemainingInQuarter(now, quarterEnd);
  const quarterProgress = clamp(
    (now.getTime() - quarterStart.getTime()) / Math.max(quarterEnd.getTime() - quarterStart.getTime(), 1),
    0,
    1
  );
  const heroProgress = todayCourses.length === 0 ? 0 : completedClasses / todayCourses.length;
  const heroProgressLabel = todayCourses.length === 0 ? '0' : `${completedClasses}/${todayCourses.length}`;
  const heroProgressSubLabel = todayCourses.length === 0 ? 'classes' : 'done';

  const visibleCampusEvents = useMemo(
    () => sportsEvents.slice(0, 12),
    [sportsEvents]
  );
  const homeDiningMenus = diningMenus.slice(0, 2);
  const diningMenuItemCount = diningMenus.reduce((total, menu) => total + menu.itemCount, 0);
  const diningMenusExternalOnly = diningMenus.length > 0 && diningMenus.every((menu) => menu.isExternalLinkOnly);
  const homeSportsEvents = visibleCampusEvents.slice(0, 1);
  const remainingHomeSportsEventCount = Math.max(visibleCampusEvents.length - homeSportsEvents.length, 0);
  const visibleSportsEventIds = useMemo(
    () => visibleCampusEvents.map((event) => event.id).join('|'),
    [visibleCampusEvents]
  );
  const upcomingCalendarTasks = useMemo(() => (
    calendarTasks
      .filter((assignment) => !isCalendarTaskCompleted(assignment, completedCalendarTasks, now))
      .sort((left, right) => new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime())
  ), [calendarTasks, completedCalendarTasks, now]);
  const pastCalendarTasks = useMemo(() => (
    calendarTasks
      .filter((assignment) => isCalendarTaskCompleted(assignment, completedCalendarTasks, now))
      .sort((left, right) => new Date(right.dueAt).getTime() - new Date(left.dueAt).getTime())
  ), [calendarTasks, completedCalendarTasks, now]);
  const incompleteCalendarTaskCount = upcomingCalendarTasks.length;
  const pastCalendarTaskCount = pastCalendarTasks.length;
  const calendarLastSyncedLabel = calendarLastSyncedAt ? `${selectedCalendarProvider.label} synced ${timeAgo(calendarLastSyncedAt)}` : 'Assignment calendar';
  const campusInfoResources = useMemo(() => getCampusInfoResources(school), [school]);
  const toggleCampusInfoCard = useCallback((resourceId: string) => {
    setExpandedCampusInfoCards((prev) => ({
      ...prev,
      [resourceId]: !(prev[resourceId] ?? true),
    }));
  }, []);

  const raisedCardStyle = {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(188,199,221,0.42)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: isDark ? 0.22 : 0.07,
    shadowRadius: 28,
    elevation: 6,
  } as const;

  const heroCardWidth = Math.max(windowWidth - 36, 0);
  const isCompactCampusInfoCard = heroCardWidth > 0 && heroCardWidth < 340;
  const campusInfoHeroIconBoxSize = isCompactCampusInfoCard ? 34 : 36;
  const campusInfoHeroIconSize = isCompactCampusInfoCard ? 17 : 18;
  const campusInfoHeroTitleSize = isCompactCampusInfoCard ? 13 : 14;
  const campusInfoHeroTitleLineHeight = isCompactCampusInfoCard ? 17 : 18;
  const campusInfoHeroCaptionSize = isCompactCampusInfoCard ? 10 : 11;
  const campusInfoHeroCaptionLineHeight = isCompactCampusInfoCard ? 13 : 14;
  const campusInfoHeroChildSize = isCompactCampusInfoCard ? 10 : 11;
  const campusInfoHeroChildLineHeight = isCompactCampusInfoCard ? 13 : 14;
  const isCompactCampusInfoSheet = windowWidth < 360;
  const campusInfoSheetTitleSize = isCompactCampusInfoSheet ? 14 : 15;
  const campusInfoSheetTitleLineHeight = isCompactCampusInfoSheet ? 18 : 19;
  const campusInfoSheetChildTitleSize = isCompactCampusInfoSheet ? 12 : 13;
  const campusInfoSheetChildTitleLineHeight = isCompactCampusInfoSheet ? 16 : 17;
  const campusInfoSheetCaptionSize = isCompactCampusInfoSheet ? 11 : 12;
  const campusInfoSheetCaptionLineHeight = isCompactCampusInfoSheet ? 14 : 15;
  const sportsGoingAccent = getSchoolConfig(school).accent;
  const diningAccent = '#F97316';
  const selectedSportsVenue = selectedSportsEvent ? getSportsVenueForEvent(school, selectedSportsEvent) : null;
  const selectedSportsEventLocationLabel = selectedSportsEvent?.location === 'Venue TBA'
    ? 'Venue TBA'
    : selectedSportsEvent?.location === 'Away'
      ? 'Away game'
      : selectedSportsEvent?.location;

  useEffect(() => {
    const eventIds = visibleSportsEventIds.split('|').filter(Boolean);
    if (eventIds.length === 0) {
      setSportsEventListParticipation({});
      return;
    }

    let cancelled = false;

    async function loadSportsEventParticipation() {
      let { data, error } = await supabase
        .from('sports_event_rsvps')
        .select('event_id, user_id, status')
        .eq('school', school)
        .in('event_id', eventIds);

      if (error && isMissingSchoolColumnError(error)) {
        const fallback = await supabase
          .from('sports_event_rsvps')
          .select('event_id, user_id, status')
          .in('event_id', eventIds);
        data = fallback.data;
        error = fallback.error;
      }

      if (cancelled) return;
      if (error) {
        if (error.code !== 'PGRST205' && !isMissingSchoolColumnError(error)) console.warn('Failed to load sports event participation:', error);
        return;
      }

      const counts: Record<string, number> = {};
      const userRsvps: Record<string, SportsEventRsvpStatus> = {};
      ((data ?? []) as SportsEventRsvpRow[]).forEach((row) => {
        if (!row.event_id) return;
        if (row.status !== 'going') return;
        counts[row.event_id] = (counts[row.event_id] ?? 0) + 1;
        if (String(row.user_id) === userId) userRsvps[row.event_id] = 'going';
      });
      setSportsEventListParticipation(counts);
      setSportsEventUserRsvps((current) => {
        const next = { ...current };
        eventIds.forEach((eventId) => {
          if (userRsvps[eventId]) {
            next[eventId] = userRsvps[eventId];
          } else {
            delete next[eventId];
          }
        });
        return next;
      });
    }

    void loadSportsEventParticipation();

    return () => {
      cancelled = true;
    };
  }, [school, userId, visibleSportsEventIds]);

  async function loadSportsEventSocial(event: SportsEvent) {
    setSportsEventDetailLoading(true);
    let [rsvpResult, commentsResult] = await Promise.all([
      supabase
        .from('sports_event_rsvps')
        .select('user_id, status')
        .eq('school', school)
        .eq('event_id', event.id),
      supabase
        .from('sports_event_comments')
        .select('id, event_id, user_id, content, created_at')
        .eq('school', school)
        .eq('event_id', event.id)
        .order('created_at', { ascending: true })
        .limit(50),
    ]);

    if (rsvpResult.error && isMissingSchoolColumnError(rsvpResult.error)) {
      rsvpResult = await supabase
        .from('sports_event_rsvps')
        .select('user_id, status')
        .eq('event_id', event.id);
    }

    if (commentsResult.error && isMissingSchoolColumnError(commentsResult.error)) {
      commentsResult = await supabase
        .from('sports_event_comments')
        .select('id, event_id, user_id, content, created_at')
        .eq('event_id', event.id)
        .order('created_at', { ascending: true })
        .limit(50);
    }

    if (selectedSportsEventRef.current?.id !== event.id) {
      return;
    }

    if (!rsvpResult.error) {
      const rows = (rsvpResult.data ?? []) as SportsEventRsvpRow[];
      const nextGoingCount = rows.filter((row) => row.status === 'going').length;
      const nextUserRsvp: SportsEventRsvpStatus | null = rows.some((row) => String(row.user_id) === userId && row.status === 'going') ? 'going' : null;
      setSportsEventRsvp(nextUserRsvp);
      setSportsEventGoingCount(nextGoingCount);
      setSportsEventListParticipation((current) => ({
        ...current,
        [event.id]: nextGoingCount,
      }));
      setSportsEventUserRsvps((current) => {
        const next = { ...current };
        if (nextUserRsvp) {
          next[event.id] = nextUserRsvp;
        } else {
          delete next[event.id];
        }
        return next;
      });
    } else if (rsvpResult.error.code !== 'PGRST205' && !isMissingSchoolColumnError(rsvpResult.error)) {
      console.warn('Failed to load sports event RSVPs:', rsvpResult.error);
    }

    if (!commentsResult.error) {
      const rows = (commentsResult.data ?? []) as SportsEventCommentRow[];
      const authorIds = Array.from(new Set(rows.map((row) => row.user_id)));
      let namesById: Record<string, string> = {};

      if (authorIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, email')
          .eq('school', school)
          .in('id', authorIds);
        if (!profilesError) {
          namesById = Object.fromEntries(
            ((profilesData ?? []) as ProfileRow[]).map((profile) => [
              profile.id,
              profile.name?.trim() || profile.email?.split('@')[0] || 'ClassMate',
            ])
          );
        }
      }

      if (selectedSportsEventRef.current?.id !== event.id) {
        return;
      }

      setSportsEventComments(rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        authorName: namesById[row.user_id] ?? 'ClassMate',
        content: row.content,
        createdAt: row.created_at,
      })));
    } else if (commentsResult.error.code !== 'PGRST205' && !isMissingSchoolColumnError(commentsResult.error)) {
      console.warn('Failed to load sports event comments:', commentsResult.error);
    }

    setSportsEventDetailLoading(false);
  }

  function openCalendarSetup() {
    calendarSetupBackdropAnim.setValue(0);
    calendarSetupSheetAnim.setValue(SHEET_INITIAL_TRANSLATE_Y);
    setShowCalendarSetup(true);
    Animated.parallel([
      Animated.spring(calendarSetupSheetAnim, { toValue: 0, useNativeDriver: true, ...SHEET_SPRING }),
      Animated.timing(calendarSetupBackdropAnim, { toValue: 1, duration: BACKDROP_DURATION, useNativeDriver: true }),
    ]).start();
  }

  function closeCalendarSetup() {
    Animated.parallel([
      Animated.timing(calendarSetupBackdropAnim, { toValue: 0, duration: BACKDROP_EXIT_DURATION, useNativeDriver: true }),
      Animated.timing(calendarSetupSheetAnim, { toValue: SHEET_INITIAL_TRANSLATE_Y, duration: SHEET_OUT_DURATION, easing: MOTION.easing.exit, useNativeDriver: true }),
    ]).start(() => setShowCalendarSetup(false));
  }

  function openPastAssignments() {
    pastAssignmentsBackdropAnim.setValue(0);
    pastAssignmentsSheetAnim.setValue(SHEET_INITIAL_TRANSLATE_Y);
    setShowPastAssignments(true);
    Animated.parallel([
      Animated.spring(pastAssignmentsSheetAnim, { toValue: 0, useNativeDriver: true, ...SHEET_SPRING }),
      Animated.timing(pastAssignmentsBackdropAnim, { toValue: 1, duration: BACKDROP_DURATION, useNativeDriver: true }),
    ]).start();
  }

  function closePastAssignments() {
    Animated.parallel([
      Animated.timing(pastAssignmentsBackdropAnim, { toValue: 0, duration: BACKDROP_EXIT_DURATION, useNativeDriver: true }),
      Animated.timing(pastAssignmentsSheetAnim, { toValue: SHEET_INITIAL_TRANSLATE_Y, duration: SHEET_OUT_DURATION, easing: MOTION.easing.exit, useNativeDriver: true }),
    ]).start(() => setShowPastAssignments(false));
  }

  function openDiningMenuList() {
    diningListBackdropAnim.setValue(0);
    diningListSheetAnim.setValue(SHEET_INITIAL_TRANSLATE_Y);
    setShowDiningMenuList(true);
    Animated.parallel([
      Animated.spring(diningListSheetAnim, { toValue: 0, useNativeDriver: true, ...SHEET_SPRING }),
      Animated.timing(diningListBackdropAnim, { toValue: 1, duration: BACKDROP_DURATION, useNativeDriver: true }),
    ]).start();
  }

  function closeDiningMenuList() {
    Animated.parallel([
      Animated.timing(diningListBackdropAnim, { toValue: 0, duration: BACKDROP_EXIT_DURATION, useNativeDriver: true }),
      Animated.timing(diningListSheetAnim, { toValue: SHEET_INITIAL_TRANSLATE_Y, duration: SHEET_OUT_DURATION, easing: MOTION.easing.exit, useNativeDriver: true }),
    ]).start(() => setShowDiningMenuList(false));
  }

  function openDiningOfficialMenu(url: string) {
    void openCampusInfoLink({ url });
  }

  function openSportsMoreList() {
    sportsListBackdropAnim.setValue(0);
    sportsListSheetAnim.setValue(SHEET_INITIAL_TRANSLATE_Y);
    setShowSportsEventsList(true);
    Animated.parallel([
      Animated.spring(sportsListSheetAnim, { toValue: 0, useNativeDriver: true, ...SHEET_SPRING }),
      Animated.timing(sportsListBackdropAnim, { toValue: 1, duration: BACKDROP_DURATION, useNativeDriver: true }),
    ]).start();
  }

  function closeSportsMoreList(then?: () => void) {
    Animated.parallel([
      Animated.timing(sportsListBackdropAnim, { toValue: 0, duration: BACKDROP_EXIT_DURATION, useNativeDriver: true }),
      Animated.timing(sportsListSheetAnim, { toValue: SHEET_INITIAL_TRANSLATE_Y, duration: SHEET_OUT_DURATION, easing: MOTION.easing.exit, useNativeDriver: true }),
    ]).start(() => { setShowSportsEventsList(false); then?.(); });
  }

  function openSportsEvent(event: SportsEvent) {
    const doOpen = () => {
      sportsEventBackdropAnim.setValue(0);
      sportsEventSheetAnim.setValue(SHEET_INITIAL_TRANSLATE_Y);
      selectedSportsEventRef.current = event;
      setSelectedSportsEvent(event);
      setSportsEventCommentInput('');
      setSportsEventRsvp(sportsEventUserRsvps[event.id] ?? null);
      setSportsEventGoingCount(sportsEventListParticipation[event.id] ?? 0);
      setSportsEventComments([]);
      setSavingSportsEventRsvp(false);
      resetSportsEventDetailScroll();
      Animated.parallel([
        Animated.spring(sportsEventSheetAnim, { toValue: 0, useNativeDriver: true, ...SHEET_SPRING }),
        Animated.timing(sportsEventBackdropAnim, { toValue: 1, duration: BACKDROP_DURATION, useNativeDriver: true }),
      ]).start();
      void loadSportsEventSocial(event);
    };

    if (showSportsEventsList) {
      closeSportsMoreList(doOpen);
    } else {
      doOpen();
    }
  }

  function closeSportsEvent() {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(sportsEventBackdropAnim, { toValue: 0, duration: BACKDROP_EXIT_DURATION, useNativeDriver: true }),
      Animated.timing(sportsEventSheetAnim, { toValue: SHEET_INITIAL_TRANSLATE_Y, duration: SHEET_OUT_DURATION, easing: MOTION.easing.exit, useNativeDriver: true }),
    ]).start(() => {
      selectedSportsEventRef.current = null;
      setSelectedSportsEvent(null);
      setSportsEventCommentInput('');
      setSportsEventComments([]);
      setSportsEventDetailLoading(false);
      setSavingSportsEventRsvp(false);
      setSubmittingSportsEventComment(false);
      setDeletingSportsEventCommentId(null);
    });
  }

  async function handleSportsEventRsvp() {
    if (!selectedSportsEvent || savingSportsEventRsvp) return;
    if (!userId) {
      Alert.alert('Sign in required', 'Please sign in to mark sports events.');
      return;
    }
    const event = selectedSportsEvent;
    const previousStatus = sportsEventRsvp;
    const previousGoingCount = sportsEventGoingCount;
    const nextStatus: SportsEventRsvpStatus | null = sportsEventRsvp === 'going' ? null : 'going';
    let nextGoingCount = previousGoingCount;
    if (previousStatus === 'going') nextGoingCount = Math.max(0, nextGoingCount - 1);
    if (nextStatus === 'going') nextGoingCount += 1;

    setSportsEventRsvp(nextStatus);
    setSportsEventGoingCount(nextGoingCount);
    setSportsEventListParticipation((current) => ({
      ...current,
      [event.id]: nextGoingCount,
    }));
    setSportsEventUserRsvps((current) => {
      const next = { ...current };
      if (nextStatus) {
        next[event.id] = nextStatus;
      } else {
        delete next[event.id];
      }
      return next;
    });
    setSavingSportsEventRsvp(true);

    let result;
    if (nextStatus) {
      const payload = {
        school,
        event_id: event.id,
        user_id: userId,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      };
      result = await supabase
        .from('sports_event_rsvps')
        .upsert(payload, { onConflict: 'school,event_id,user_id' });

      if (result.error && (isMissingSchoolColumnError(result.error) || isOnConflictTargetError(result.error))) {
        const fallbackPayload = isMissingSchoolColumnError(result.error)
          ? {
              event_id: event.id,
              user_id: userId,
              status: nextStatus,
              updated_at: payload.updated_at,
            }
          : payload;
        result = await supabase
          .from('sports_event_rsvps')
          .upsert(fallbackPayload, { onConflict: 'event_id,user_id' });
      }
    } else {
      result = await supabase
        .from('sports_event_rsvps')
        .delete()
        .eq('school', school)
        .eq('event_id', event.id)
        .eq('user_id', userId);

      if (result.error && isMissingSchoolColumnError(result.error)) {
        result = await supabase
          .from('sports_event_rsvps')
          .delete()
          .eq('event_id', event.id)
          .eq('user_id', userId);
      }
    }

    if (selectedSportsEventRef.current?.id !== event.id) {
      setSavingSportsEventRsvp(false);
      return;
    }

    if (result.error) {
      if (result.error.code !== 'PGRST205') console.warn('Failed to save sports event RSVP:', result.error);
      if (result.error.code !== 'PGRST205') {
        setSportsEventRsvp(previousStatus);
        setSportsEventGoingCount(previousGoingCount);
        setSportsEventListParticipation((current) => ({
          ...current,
          [event.id]: previousGoingCount,
        }));
        setSportsEventUserRsvps((current) => {
          const next = { ...current };
          if (previousStatus) {
            next[event.id] = previousStatus;
          } else {
            delete next[event.id];
          }
          return next;
        });
      }
      setSavingSportsEventRsvp(false);
      return;
    }

    await loadSportsEventSocial(event);
    setSavingSportsEventRsvp(false);
  }

  async function handleSubmitSportsEventComment() {
    if (!selectedSportsEvent || !sportsEventCommentInput.trim() || submittingSportsEventComment) return;
    if (!userId) {
      Alert.alert('Sign in required', 'Please sign in to comment on sports events.');
      return;
    }
    const event = selectedSportsEvent;
    const content = sportsEventCommentInput.trim();
    const moderationResult = evaluateModerationText(content);
    if (shouldBlockModerationResult(moderationResult)) {
      Alert.alert('Comment not allowed', moderationUserMessage(moderationResult));
      return;
    }
    const optimisticId = `local-${Date.now()}`;
    setSubmittingSportsEventComment(true);
    setSportsEventCommentInput('');
    setSportsEventComments((current) => [
      ...current,
      {
        id: optimisticId,
        userId,
        authorName: 'You',
        content,
        createdAt: new Date().toISOString(),
      },
    ]);
    settleSportsEventComposer(true);

    let result = await supabase
      .from('sports_event_comments')
      .insert({
        school,
        event_id: event.id,
        user_id: userId,
        content,
      })
      .select('id, event_id, user_id, content, created_at')
      .single();

    if (result.error && isMissingSchoolColumnError(result.error)) {
      result = await supabase
        .from('sports_event_comments')
        .insert({
          event_id: event.id,
          user_id: userId,
          content,
        })
        .select('id, event_id, user_id, content, created_at')
        .single();
    }

    if (selectedSportsEventRef.current?.id !== event.id) return;

    const { data, error } = result;

    if (error) {
      console.warn('Failed to post sports event comment:', error);
      setSportsEventComments((current) => current.filter((comment) => comment.id !== optimisticId));
      setSportsEventCommentInput(content);
      setSubmittingSportsEventComment(false);
      Alert.alert(
        'Comment failed',
        isServerModerationError(error)
          ? COMMUNITY_GUIDELINES_MESSAGE
          : error.code === 'PGRST205'
          ? 'Sports event comments are not set up yet. Run the sports_event_social.sql migration.'
          : error.message
      );
      return;
    }

    if (data) {
      const savedComment = data as SportsEventCommentRow;
      setSportsEventComments((current) => current.map((comment) => (
        comment.id === optimisticId
          ? {
              id: savedComment.id,
              userId: savedComment.user_id,
              authorName: 'You',
              content: savedComment.content,
              createdAt: savedComment.created_at,
            }
          : comment
      )));
    }
    requestAnimationFrame(() => sportsEventCommentInputRef.current?.focus());
    settleSportsEventComposer(true);
    setSubmittingSportsEventComment(false);
    triggerSuccessHaptic();
  }

  function openSportsEventCommentActions(comment: SportsEventComment) {
    if (comment.userId !== userId || comment.id.startsWith('local-')) return;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Delete Comment', 'Cancel'],
          cancelButtonIndex: 1,
          destructiveButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) confirmDeleteSportsEventComment(comment);
        }
      );
      return;
    }

    Alert.alert(
      'Comment options',
      undefined,
      [
        { text: 'Delete Comment', style: 'destructive', onPress: () => confirmDeleteSportsEventComment(comment) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }

  function confirmDeleteSportsEventComment(comment: SportsEventComment) {
    if (comment.userId !== userId || comment.id.startsWith('local-')) return;
    Alert.alert(
      'Delete comment?',
      'This comment will be removed from the game thread.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void handleDeleteSportsEventComment(comment),
        },
      ]
    );
  }

  async function handleDeleteSportsEventComment(comment: SportsEventComment) {
    if (!selectedSportsEvent || comment.userId !== userId || deletingSportsEventCommentId) return;
    const event = selectedSportsEvent;
    const previousComments = sportsEventComments;

    setDeletingSportsEventCommentId(comment.id);
    setSportsEventComments((current) => current.filter((item) => item.id !== comment.id));

    let result = await supabase
      .from('sports_event_comments')
      .delete()
      .eq('school', school)
      .eq('id', comment.id)
      .eq('user_id', userId);

    if (result.error && isMissingSchoolColumnError(result.error)) {
      result = await supabase
        .from('sports_event_comments')
        .delete()
        .eq('id', comment.id)
        .eq('user_id', userId);
    }

    if (selectedSportsEventRef.current?.id !== event.id) {
      setDeletingSportsEventCommentId(null);
      return;
    }

    const { error } = result;

    if (error) {
      console.warn('Failed to delete sports event comment:', error);
      setSportsEventComments(previousComments);
      Alert.alert(
        'Delete failed',
        error.code === 'PGRST205'
          ? 'Sports event comments are not set up yet. Run the sports_event_social.sql migration.'
          : error.message
      );
    }

    setDeletingSportsEventCommentId(null);
  }

  function renderHeroCardContent(item: HeroCardItem): ReactNode {
    if (item.type === 'diningMenu') {
      return (
        <View style={{
          ...raisedCardStyle,
          backgroundColor: colors.card,
          padding: 22,
        }}>
          <View>
            <Text style={{ fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.text }}>
              Today's Dining
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 7 }}>
              {diningMenus.length > 0
                ? diningMenusExternalOnly
                  ? 'Official dining menu link'
                  : `${diningMenus.length} location${diningMenus.length === 1 ? '' : 's'} · ${diningMenuItemCount} items`
                : diningLoading
                  ? 'Loading campus dining menus'
                  : 'No menu data yet'}
            </Text>
          </View>

          {homeDiningMenus.length > 0 ? (
            <View style={{ marginTop: 16 }}>
              {homeDiningMenus.map((menu, index, shownMenus) => {
                const previewItems = previewDiningItems(menu, 3);
                const statusColor = menu.isOpen === true ? '#10B981' : menu.isOpen === false ? '#EF4444' : diningAccent;
                return (
                  <TouchableOpacity
                    key={`hero-dining-${menu.id}`}
                    onPress={openDiningMenuList}
                    activeOpacity={0.76}
                    style={{
                      paddingTop: index === 0 ? 0 : 11,
                      paddingBottom: index === shownMenus.length - 1 ? 0 : 11,
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: colors.borderSubtle,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: themedIconBackground(diningAccent, isDark, '#fff7ed'), alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Ionicons name="restaurant-outline" size={20} color={themedIconColor(diningAccent, isDark)} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, minWidth: 0, fontSize: 16, lineHeight: 20, fontWeight: '800', color: colors.text }}>
                            {menu.name}
                          </Text>
                          {menu.statusLabel ? (
                            <View style={{ borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: `${statusColor}16`, borderWidth: 1, borderColor: `${statusColor}30` }}>
                              <Text style={{ fontSize: 10, lineHeight: 13, fontWeight: '900', color: statusColor }}>
                                {menu.statusLabel}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        {menu.statusDetail || previewItems.length > 0 ? (
                          <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 12, color: colors.textTertiary, marginTop: 5 }}>
                            {menu.statusDetail ?? previewItems.join(' · ')}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : diningLoading ? (
            <View style={{ marginTop: 16, gap: 10 }}>
              <SkeletonBlock height={48} radius={16} />
              <SkeletonBlock height={48} radius={16} width="88%" />
            </View>
          ) : (
            <EmptyState
              compact
              icon="restaurant-outline"
              title="Dining menus unavailable"
              body={diningError ?? 'Menus will appear here when the dining feed has food data for today.'}
            />
          )}

          {diningMenus.length > 0 ? (
            <TouchableOpacity
              onPress={openDiningMenuList}
              activeOpacity={0.72}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textSecondary }}>
                View full menu
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      );
    }

    if (item.type === 'sportsEvents') {
      return (
        <View style={{
          ...raisedCardStyle,
          backgroundColor: colors.card,
          padding: 22,
        }}>
          <View>
            <Text style={{ fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.text }}>
              Sports Events
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 7 }}>
              {visibleCampusEvents.length} upcoming
            </Text>
          </View>

          {homeSportsEvents.length > 0 ? (
            <View style={{ marginTop: 16 }}>
              {homeSportsEvents.map((event, index, shownEvents) => (
                <TouchableOpacity
                  key={`hero-${event.id}`}
                  onPress={() => openSportsEvent(event)}
                  activeOpacity={0.76}
                  style={{
                    paddingTop: index === 0 ? 0 : 11,
                    paddingBottom: index === shownEvents.length - 1 ? 0 : 11,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: colors.borderSubtle,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: themedIconBackground(event.color, isDark, event.bg), alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Ionicons name={event.icon} size={20} color={themedIconColor(event.color, isDark)} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={2} ellipsizeMode="tail" style={{ fontSize: 16, lineHeight: 20, fontWeight: '800', color: colors.text }}>
                        {event.title}
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                        {formatRelativeEventDayLabel(event.date, now, effectiveTimeZone)} · {formatSportsEventTime(event.date, event.timeLabel, effectiveTimeZone)}
                      </Text>
                    </View>
                    <InfoChip
                      label={sportsHomeAwayLabel(event)}
                      tone={event.isHome ? 'brand' : 'neutral'}
                      compact
                      color={event.isHome ? colors.brand : colors.textSecondary}
                      borderColor={event.isHome ? `${colors.brand}44` : colors.borderSubtle}
                      backgroundColor={event.isHome ? colors.brandBg : colors.bgTertiary}
                    />
                  </View>
                  <InfoChip
                    icon="people-outline"
                    label={`${(sportsEventListParticipation[event.id] ?? 0) > 99 ? '99+' : (sportsEventListParticipation[event.id] ?? 0)} going`}
                    tone="brand"
                    compact
                    color={sportsGoingAccent}
                    backgroundColor={`${sportsGoingAccent}14`}
                    borderColor={`${sportsGoingAccent}28`}
                    style={{ marginTop: 7, marginLeft: 48 }}
                  />
                </TouchableOpacity>
              ))}
            </View>
          ) : sportsLoading ? (
            <View style={{ marginTop: 16, gap: 10 }}>
              <SkeletonBlock height={50} radius={16} />
              <SkeletonBlock height={50} radius={16} width="90%" />
            </View>
          ) : (
            <EmptyState
              compact
              icon="trophy-outline"
              title="No upcoming sports events"
              body="Events will appear here when the athletics calendar has something coming up."
            />
          )}

          {visibleCampusEvents.length > 0 ? (
            <TouchableOpacity
              onPress={openSportsMoreList}
              activeOpacity={0.72}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textSecondary }}>
                {remainingHomeSportsEventCount > 0 ? `More (${remainingHomeSportsEventCount})` : 'More'}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      );
    }

    if (item.type === 'campusInfo') {
      return (
        <View style={{
          ...raisedCardStyle,
          backgroundColor: colors.card,
          padding: 22,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.text }}>
                Campus Info
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowCampusInfo(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                borderRadius: 999,
                backgroundColor: colors.brandBg,
                paddingHorizontal: 10,
                paddingVertical: 7,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '800', color: colors.brand }}>
                View all
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 16, gap: 8 }}>
            {campusInfoResources.slice(0, 3).map((resource) => {
              const resourceCaption = campusInfoResourceCaption(resource);
              if (resource.children?.length) {
                return (
                  <View
                    key={`hero-campus-info-${resource.id}`}
                    style={{
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: colors.borderSubtle,
                      backgroundColor: colors.bg,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View
                        style={{
                          width: campusInfoHeroIconBoxSize,
                          height: campusInfoHeroIconBoxSize,
                          borderRadius: isCompactCampusInfoCard ? 13 : 14,
                          backgroundColor: themedIconBackground(resource.color, isDark, resource.bg),
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Ionicons name={resource.icon} size={campusInfoHeroIconSize} color={themedIconColor(resource.color, isDark)} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: campusInfoHeroTitleSize, lineHeight: campusInfoHeroTitleLineHeight, fontWeight: '800', color: colors.text }}>
                          {resource.title}
                        </Text>
                        {resourceCaption ? (
                          <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: campusInfoHeroCaptionSize, lineHeight: campusInfoHeroCaptionLineHeight, color: colors.textSecondary, marginTop: 2 }}>
                            {resourceCaption}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                      {resource.children.map((child) => (
                        <TouchableOpacity
                          key={`hero-campus-info-${resource.id}-${child.id}`}
                          onPress={() => void openCampusInfoLink(child)}
                          activeOpacity={0.76}
                          style={{
                            flexGrow: 1,
                            flexBasis: '47%',
                            minHeight: 34,
                            borderRadius: 13,
                            backgroundColor: themedIconBackground(resource.color, isDark, resource.bg),
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingHorizontal: 8,
                          }}
                        >
                          <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: campusInfoHeroChildSize, lineHeight: campusInfoHeroChildLineHeight, fontWeight: '800', color: themedIconColor(resource.color, isDark) }}>
                            {child.title}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              }

              return (
                <TouchableOpacity
                  key={`hero-campus-info-${resource.id}`}
                  onPress={() => void openCampusInfoLink(resource)}
                  activeOpacity={0.76}
                  style={{
                    minHeight: 56,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: colors.borderSubtle,
                    backgroundColor: colors.bg,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      width: campusInfoHeroIconBoxSize,
                      height: campusInfoHeroIconBoxSize,
                      borderRadius: isCompactCampusInfoCard ? 13 : 14,
                      backgroundColor: themedIconBackground(resource.color, isDark, resource.bg),
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Ionicons name={resource.icon} size={campusInfoHeroIconSize} color={themedIconColor(resource.color, isDark)} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: campusInfoHeroTitleSize, lineHeight: campusInfoHeroTitleLineHeight, fontWeight: '800', color: colors.text }}>
                      {resource.title}
                    </Text>
                    {resourceCaption ? (
                      <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: campusInfoHeroCaptionSize, lineHeight: campusInfoHeroCaptionLineHeight, color: colors.textSecondary, marginTop: 2 }}>
                        {resourceCaption}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    }

    if (item.type === 'idleSummary') {
      return (
        <View style={{
          ...raisedCardStyle,
          backgroundColor: colors.card,
          paddingHorizontal: 18,
          paddingVertical: 17,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 22, lineHeight: 26, fontWeight: '800', color: colors.text }}>
                {todayCourses.length > 0 ? 'You are clear for the rest of today' : 'No classes on your schedule today'}
              </Text>
            </View>
            <View style={{ alignItems: 'center', alignSelf: 'flex-start' }}>
              <DualProgressRing
                outerProgress={quarterProgress}
                outerColor={colors.brand}
                outerTrackColor={colors.bgTertiary}
                innerProgress={heroProgress}
                innerColor={colors.brand}
                innerTrackColor={colors.bgTertiary}
                primaryLabel={heroProgressLabel}
                secondaryLabel={heroProgressSubLabel}
                textColor={colors.text}
                subTextColor={colors.textTertiary}
                size={76}
                outerStrokeWidth={4}
                innerStrokeWidth={5}
              />
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.brand, marginTop: 5 }}>
                {termLabel(selectedQuarter, school)}
              </Text>
              <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 1 }}>
                {`${Math.round(quarterProgress * 100)}% · ${daysRemaining}d left`}
              </Text>
            </View>
          </View>
        </View>
      );
    }

    const course = item.type === 'course' ? item.course : null;
    const summaryCourses = item.type !== 'course' ? item.courses : [];
    const firstSummaryCourse = summaryCourses[0] ?? null;
    const lastSummaryCourse = summaryCourses[summaryCourses.length - 1] ?? null;
    const isCurrent = course ? extractStartHour(course.time) <= nowHour && extractEndHour(course.time) >= nowHour : false;
    const startDate = course
      ? dateFromHour(now, extractStartHour(course.time), effectiveTimeZone)
      : firstSummaryCourse
        ? dateFromHour(now, extractStartHour(firstSummaryCourse.time), effectiveTimeZone)
        : now;
    const endDate = course
      ? dateFromHour(now, extractEndHour(course.time), effectiveTimeZone)
      : lastSummaryCourse
        ? dateFromHour(now, extractEndHour(lastSummaryCourse.time), effectiveTimeZone)
        : now;
    const accent = course
      ? getBlockColors(course, timetableSettings.theme).border
      : item.type === 'completedSummary'
        ? colors.textTertiary
        : colors.brand;
    const courseKey = course ? buildSectionMatchKey(course) : '';
    const rawCourseClassmates = course
      ? classmateMatches.flatMap((match) => {
        const sharedMatch = match.sharedCourseMatches.find((candidate) => candidate.courseKey === courseKey);
        return sharedMatch ? [{ classmate: match, matchType: sharedMatch.matchType }] : [];
      })
      : [];
    const sameSectionClassmates = rawCourseClassmates.filter((match) => match.matchType === 'same_section');
    const courseClassmates = sameSectionClassmates.length > 0 ? sameSectionClassmates : rawCourseClassmates;
    const courseClassmateMatchType: SharedClassMatch | null = sameSectionClassmates.length > 0
      ? 'same_section'
      : rawCourseClassmates.length > 0
        ? 'same_course'
        : null;
    const progress = isCurrent
      ? clamp((now.getTime() - startDate.getTime()) / Math.max(endDate.getTime() - startDate.getTime(), 1), 0, 1)
        : 0;
    const label = item.type === 'course' ? 'Ends in' : 'Today';
    const value = item.type === 'course'
      ? formatDuration((endDate.getTime() - now.getTime()) / 60000)
      : `${summaryCourses.length} class${summaryCourses.length === 1 ? '' : 'es'}`;
    const summaryRangeLabel = item.type === 'course'
      ? ''
      : firstSummaryCourse && lastSummaryCourse
        ? `${formatClock(startDate, effectiveTimeZone)} to ${formatClock(endDate, effectiveTimeZone)} today`
        : '';
    const title = course?.title ?? '';
    const courseHeroLocation = course ? formatHeroTimelineLocation(course.location) : '';
    const detail = course
      ? [formatHeroTimeRange(course.time), courseHeroLocation].filter(Boolean).join(' · ')
      : '';

    return (
      <View style={{
        ...raisedCardStyle,
        backgroundColor: colors.card,
        padding: 22,
      }}>
        {item.type === 'course' ? (
          /* Current class: original side-by-side layout */
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textTertiary }}>
                  Current class
                </Text>
              </View>
              <Text style={{ fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.text }}>
                {label}
              </Text>
              <Text style={{ fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.text }}>
                {value}
              </Text>
              <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 12 }}>
                {title}
              </Text>
              {courseClassmates.length > 0 ? (
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 6 }}>
                  {courseClassmates.length === 1
                    ? `1 friend also has this ${courseClassmateMatchType === 'same_section' ? 'section' : 'course'}`
                    : `${courseClassmates.length} friends also have this ${courseClassmateMatchType === 'same_section' ? 'section' : 'course'}`}
                </Text>
              ) : null}
              <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 6 }}>
                {detail}
              </Text>
            </View>
            <View style={{ alignItems: 'center', alignSelf: 'flex-start' }}>
              <DualProgressRing
                outerProgress={quarterProgress}
                outerColor={colors.brand}
                outerTrackColor={colors.bgTertiary}
                innerProgress={heroProgress}
                innerColor={accent}
                innerTrackColor={colors.bgTertiary}
                primaryLabel={heroProgressLabel}
                secondaryLabel={heroProgressSubLabel}
                textColor={colors.text}
                subTextColor={colors.textTertiary}
                size={76}
              />
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.brand, marginTop: 5 }}>
                {termLabel(selectedQuarter, school)}
              </Text>
              <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 1 }}>
                {`${Math.round(quarterProgress * 100)}% · ${daysRemaining}d left`}
              </Text>
            </View>
          </View>
        ) : (
          /* Summary card: headline + dense timeline list */
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: `${accent}14`, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Ionicons name={item.type === 'completedSummary' ? 'checkmark-done-outline' : 'calendar-outline'} size={22} color={accent} />
                </View>
                <Text style={{ fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.text }}>
                  {label}
                </Text>
                <Text style={{ fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.text }}>
                  {value}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 7 }}>
                  {summaryRangeLabel}
                </Text>
              </View>
              <View style={{ alignItems: 'center', alignSelf: 'flex-start' }}>
                <DualProgressRing
                  outerProgress={quarterProgress}
                  outerColor={colors.brand}
                  outerTrackColor={colors.bgTertiary}
                  innerProgress={heroProgress}
                  innerColor={accent}
                  innerTrackColor={colors.bgTertiary}
                  primaryLabel={heroProgressLabel}
                  secondaryLabel={heroProgressSubLabel}
                  textColor={colors.text}
                  subTextColor={colors.textTertiary}
                  size={76}
                />
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.brand, marginTop: 5 }}>
                  {termLabel(selectedQuarter, school)}
                </Text>
                <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 1 }}>
                  {`${Math.round(quarterProgress * 100)}% · ${daysRemaining}d left`}
                </Text>
              </View>
            </View>
            <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginTop: 16, marginHorizontal: 2 }} />
            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textTertiary }}>
                  Today's timeline
                </Text>
              </View>
              {summaryCourses.map((summaryCourse, index) => {
                const rowStartDate = dateFromHour(now, extractStartHour(summaryCourse.time), effectiveTimeZone);
                const rowEndDate = dateFromHour(now, extractEndHour(summaryCourse.time), effectiveTimeZone);
                const rowStartClock = formatTimelineClockParts(rowStartDate, effectiveTimeZone);
                const rowLocationLabel = formatHeroTimelineLocation(summaryCourse.location);
                const summaryCourseCode = String(summaryCourse.code ?? '').replace(/\s+/g, ' ').trim();
                const rowIsPast = rowEndDate.getTime() < now.getTime();
                const rowIsCurrent = rowStartDate.getTime() <= now.getTime() && rowEndDate.getTime() >= now.getTime();
                const summaryCourseAccent = rowIsPast
                  ? colors.border
                  : getBlockColors(summaryCourse, timetableSettings.theme).border;
                const rowPrimaryColor = rowIsPast ? colors.textTertiary : colors.text;
                const rowSecondaryColor = rowIsPast ? colors.textTertiary : colors.textSecondary;
                return (
                  <View
                    key={buildSectionMatchKey(summaryCourse)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 7,
                      paddingTop: index === 0 ? 0 : 7,
                      paddingBottom: index === summaryCourses.length - 1 ? 0 : 7,
                      opacity: rowIsPast ? 0.46 : 1,
                    }}
                  >
                    <View style={{ width: 64 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: 2 }}>
                        <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 14, fontWeight: '800', color: rowPrimaryColor }}>
                          {rowStartClock.time}
                        </Text>
                        {rowStartClock.period ? (
                          <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 11, fontWeight: '800', color: rowPrimaryColor }}>
                            {rowStartClock.period}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', gap: 10 }}>
                      <View
                        style={{
                          width: 4,
                          alignSelf: 'stretch',
                          minHeight: 39,
                          borderRadius: 999,
                          backgroundColor: summaryCourseAccent,
                          opacity: rowIsCurrent ? 1 : 0.82,
                        }}
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 15, lineHeight: 19, fontWeight: '800', color: rowPrimaryColor }}>
                          {summaryCourseCode}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <Text numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 17, color: rowSecondaryColor }}>
                            {summaryCourse.title}
                          </Text>
                          {rowLocationLabel ? (
                            <View
                              style={{
                                maxWidth: 118,
                                flexShrink: 0,
                                borderRadius: 999,
                                backgroundColor: colors.bgTertiary,
                                paddingHorizontal: 7,
                                paddingVertical: 2,
                              }}
                            >
                              <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 10, lineHeight: 13, fontWeight: '800', color: colors.textTertiary }}>
                                {rowLocationLabel}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {item.type === 'course' ? (
          <View style={{ marginTop: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 12, color: colors.textTertiary }}>
                {formatClock(startDate, effectiveTimeZone)}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textTertiary }}>
                {formatClock(endDate, effectiveTimeZone)}
              </Text>
            </View>
            <View style={{ position: 'relative', height: 16, justifyContent: 'center' }}>
              <View style={{ height: isCurrent ? 7 : 4, borderRadius: 999, backgroundColor: colors.bgTertiary }} />
              {isCurrent ? (
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    width: `${progress * 100}%`,
                    height: 7,
                    borderRadius: 999,
                    backgroundColor: accent,
                  }}
                />
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ paddingTop: topInset + 9, paddingHorizontal: 18, paddingBottom: bottomInset + 84 }}
        showsVerticalScrollIndicator={false}
      >
      <View style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Text numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, minWidth: 0, fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: 0 }}>
            {schoolHomeLabel(school)}
          </Text>
          <TouchableOpacity
            onPress={onOpenSettings}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.card,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="person-outline" size={18} color={colors.brand} />
          </TouchableOpacity>
        </View>
        <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
          {getDateLabel(now, selectedQuarter, quarterStart, quarterEnd, school, effectiveTimeZone)}
        </Text>
      </View>

      {/* Main schedule card */}
      <View style={{ marginBottom: 10 }}>
        {renderHeroCardContent(mainHeroItem)}
      </View>

      {/* Info thumbnail cards */}
      {(shouldShowDiningHeroPage || shouldShowSportsHeroPage) && (
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          {shouldShowDiningHeroPage && (
            <TouchableOpacity
              onPress={() => openHeroSheetFor('dining')}
              activeOpacity={0.78}
              style={{
                flex: 1,
                backgroundColor: colors.card,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 10,
                paddingHorizontal: 12,
                alignItems: 'center',
                gap: 5,
              }}
            >
              <View style={{
                width: 34, height: 34, borderRadius: 10,
                backgroundColor: `${colors.brand}14`,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="restaurant-outline" size={17} color={colors.brand} />
              </View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Dining</Text>
              <Text numberOfLines={1} style={{ fontSize: 11, color: colors.textTertiary }}>
                {diningMenus.length > 0 ? `${diningMenus.length} open` : 'No data'}
              </Text>
            </TouchableOpacity>
          )}

          {shouldShowSportsHeroPage && (
            <TouchableOpacity
              onPress={() => openHeroSheetFor('sports')}
              activeOpacity={0.78}
              style={{
                flex: 1,
                backgroundColor: colors.card,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 10,
                paddingHorizontal: 12,
                alignItems: 'center',
                gap: 5,
              }}
            >
              <View style={{
                width: 34, height: 34, borderRadius: 10,
                backgroundColor: `${colors.brand}18`,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="trophy-outline" size={17} color={colors.brand} />
              </View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Sports</Text>
              <Text numberOfLines={1} style={{ fontSize: 11, color: colors.textTertiary }}>
                {visibleCampusEvents.length > 0 ? `${visibleCampusEvents.length} events` : 'No games'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => openHeroSheetFor('campus')}
            activeOpacity={0.78}
            style={{
              flex: 1,
              backgroundColor: colors.card,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: 10,
              paddingHorizontal: 12,
              alignItems: 'center',
              gap: 5,
            }}
          >
            <View style={{
              width: 34, height: 34, borderRadius: 10,
              backgroundColor: `${colors.brand}14`,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="map-outline" size={17} color={colors.brand} />
            </View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Campus</Text>
            <Text numberOfLines={1} style={{ fontSize: 11, color: colors.textTertiary }}>Quick links</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Academic Calendar Strip ─────────────────────────────────────── */}
      {upcomingAcademicEvents.length > 0 && (
        <View style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Academic Calendar</Text>
            <Text style={{ fontSize: 12, color: colors.textTertiary }}>{termLabel(selectedQuarter, school)}</Text>
          </View>
          <View style={{ position: 'relative' }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 32 }}
          >
            {upcomingAcademicEvents.map((event) => {
              const dateStr = event.endDate && event.endDate !== event.date
                ? `${formatAcademicDate(event.date)} – ${formatAcademicDate(event.endDate)}`
                : formatAcademicDate(event.date);

              return (
                <TouchableOpacity
                  key={event.id}
                  onPress={() => openAcademicSheet(event)}
                  activeOpacity={0.76}
                  style={{
                    width: 140,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                    gap: 4,
                    justifyContent: 'center',
                  }}
                >
                  <Text numberOfLines={2} style={{ fontSize: 13, fontWeight: '700', color: colors.text, lineHeight: 17 }}>
                    {event.title}
                  </Text>
                  <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', color: colors.brand }}>
                    {dateStr}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {/* Right fade — hints there's more to scroll */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: 40,
              borderRadius: 4,
              opacity: 0.95,
              backgroundColor: colors.bg,
              // Soft left edge via shadow
              shadowColor: colors.bg,
              shadowOffset: { width: -24, height: 0 },
              shadowOpacity: 1,
              shadowRadius: 20,
            }}
          />
          </View>
        </View>
      )}

      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
              Assignments
            </Text>
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
              {calendarFeedUrl ? calendarLastSyncedLabel : 'Assignment calendar'}
            </Text>
          </View>
          {calendarFeedUrl ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                onPress={openCalendarSetup}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  minHeight: 34,
                  borderRadius: 17,
                  backgroundColor: colors.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 11,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textSecondary }}>
                  Manage
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void syncCalendarTasks(calendarFeedUrl)}
                disabled={calendarTasksLoading}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: colors.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                {calendarTasksLoading ? (
                  <ActivityIndicator size="small" color={colors.brand} />
                ) : (
                  <Ionicons name="refresh" size={16} color={colors.brand} />
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
        <View style={{
          ...raisedCardStyle,
          backgroundColor: colors.card,
          padding: 18,
        }}>
          {calendarFeedUrl && upcomingCalendarTasks.length > 0 ? (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <Text style={{ fontSize: 22, lineHeight: 26, fontWeight: '800', color: colors.text }}>
                  {incompleteCalendarTaskCount} to do
                </Text>
                {pastCalendarTaskCount > 0 ? (
                  <TouchableOpacity
                    onPress={openPastAssignments}
                    style={{
                      paddingHorizontal: 11,
                      paddingVertical: 7,
                      borderRadius: 999,
                      backgroundColor: colors.bgTertiary,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textSecondary }}>
                      Completed
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {calendarTasksError ? (
                <Text style={{ fontSize: 12, color: '#EF4444' }}>
                  {calendarTasksError}
                </Text>
              ) : null}
              {upcomingCalendarTasks.map((assignment, index) => (
                (() => {
                  const completed = isCalendarTaskCompleted(assignment, completedCalendarTasks, now);
                  const overdue = isCalendarTaskOverdue(assignment, completed, now);
                  return (
                    <TouchableOpacity
                      key={assignment.id}
                      onPress={() => {
                        if (assignment.url) void openCalendarTask(assignment);
                      }}
                      activeOpacity={assignment.url ? 0.78 : 1}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: 11,
                        paddingTop: index === 0 ? 2 : 13,
                        borderTopWidth: index === 0 ? 0 : 1,
                        borderTopColor: colors.borderSubtle,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => toggleCalendarTask(assignment)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 13,
                          backgroundColor: completed ? colors.brand : colors.bgTertiary,
                          borderWidth: 1,
                          borderColor: completed ? colors.brand : colors.border,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: 1,
                        }}
                      >
                        <Ionicons name="checkmark" size={16} color={completed ? 'white' : colors.textTertiary} />
                      </TouchableOpacity>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          style={{
                            fontSize: 15,
                            fontWeight: '800',
                            color: overdue ? '#EF4444' : (completed ? colors.textTertiary : colors.text),
                            textDecorationLine: completed ? 'line-through' : 'none',
                          }}
                        >
                          {assignment.title}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5, flexWrap: 'wrap' }}>
                          <View
                            style={{
                              borderRadius: 999,
                              backgroundColor: colors.brandBg,
                              borderWidth: 1,
                              borderColor: `${colors.brand}33`,
                              paddingHorizontal: 7,
                              paddingVertical: 3,
                            }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.brand }}>
                              {assignment.courseCode}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 13, color: overdue ? '#EF4444' : colors.textSecondary }}>
                            {formatCalendarTaskDueLabel(assignment, now, effectiveTimeZone)}
                          </Text>
                        </View>
                      </View>
                      {assignment.url ? <Ionicons name="open-outline" size={17} color={colors.textTertiary} /> : null}
                    </TouchableOpacity>
                  );
                })()
              ))}
            </View>
          ) : calendarFeedUrl ? (
            <View style={{ alignItems: 'center', paddingVertical: 14 }}>
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: colors.brandBg,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}>
                <Ionicons name="checkmark-done-outline" size={23} color={colors.brand} />
              </View>
              <Text style={{ fontSize: 20, lineHeight: 24, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
                No upcoming deadlines
              </Text>
              <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary, textAlign: 'center', marginTop: 7 }}>
                Your calendar is connected. New assignments will show up here after the next refresh.
              </Text>
              {calendarTasksError ? (
                <Text style={{ fontSize: 12, color: '#EF4444', textAlign: 'center', marginTop: 10 }}>
                  {calendarTasksError}
                </Text>
              ) : null}
              <TouchableOpacity
                onPress={openCalendarSetup}
                style={{
                  marginTop: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: colors.bgTertiary,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>
                  Manage Calendar
                </Text>
              </TouchableOpacity>
              {pastCalendarTaskCount > 0 ? (
                <TouchableOpacity
                  onPress={openPastAssignments}
                  style={{
                    marginTop: 10,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: colors.brandBg,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.brand }}>
                    View Completed
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 14 }}>
              <View style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                backgroundColor: colors.brandBg,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}>
                <Ionicons name="calendar-outline" size={24} color={colors.brand} />
              </View>
              <Text style={{ fontSize: 21, lineHeight: 25, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
                Import Assignments
              </Text>
              <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary, textAlign: 'center', marginTop: 7 }}>
                Connect your LMS calendar feed to turn assignment deadlines into a checklist.
              </Text>
              <TouchableOpacity
                onPress={openCalendarSetup}
                style={{
                  marginTop: 15,
                  paddingHorizontal: 18,
                  paddingVertical: 11,
                  borderRadius: 999,
                  backgroundColor: colors.brand,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: 'white' }}>
                  Import Assignments
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
      </ScrollView>

      {/* ── Academic Calendar detail sheet ───────────────────────────── */}
      {academicSheetVisible && selectedAcademicEvent && (() => {
        const event = selectedAcademicEvent;
        const days = daysUntilEvent(event, now);
        const cfg = CATEGORY_CONFIG[event.category];
        const accentColor = colors.brand;
        const isMultiDay = event.endDate && event.endDate !== event.date;
        const isOngoing = event.endDate && days <= 0 && event.endDate >= now.toISOString().slice(0, 10);
        const dLabel = days === 0 ? 'Today' : isOngoing ? 'Ongoing' : days === 1 ? 'Tomorrow' : days < 0 ? 'Ended' : `${days} days away`;
        return (
          <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} pointerEvents="box-none">
            <Animated.View
              style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.45)', opacity: academicBackdropAnim }}
              pointerEvents="auto"
            >
              <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeAcademicSheet} />
            </Animated.View>
            <Animated.View style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              transform: [{ translateY: academicSheetAnim }],
              backgroundColor: colors.bg,
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              paddingBottom: bottomInset + 84,
              overflow: 'hidden',
            }}>
              <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
              </View>
              <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 20 }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: `${accentColor}14`, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={cfg.ionIcon as any} size={24} color={accentColor} />
                      </View>
                      <View style={{
                        borderRadius: 999,
                        backgroundColor: `${accentColor}18`,
                        borderWidth: 1,
                        borderColor: `${accentColor}40`,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                      }}>
                        <Text style={{ fontSize: 12, fontWeight: '900', color: accentColor }}>{dLabel}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, lineHeight: 29 }}>{event.title}</Text>
                    {event.subtitle ? (
                      <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>{event.subtitle}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    onPress={closeAcademicSheet}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgTertiary, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="close" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                {/* Date card */}
                <View style={{ borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="calendar-outline" size={20} color={accentColor} />
                    <View>
                      <Text style={{ fontSize: 13, color: colors.textTertiary, fontWeight: '600', marginBottom: 2 }}>
                        {isMultiDay ? 'Date Range' : 'Date'}
                      </Text>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                        {isMultiDay
                          ? `${formatAcademicDate(event.date)} – ${formatAcademicDate(event.endDate!)}`
                          : formatAcademicDate(event.date)}
                      </Text>
                    </View>
                  </View>
                </View>
                {/* Action buttons */}
                {event.url ? (
                  <TouchableOpacity
                    onPress={() => void Linking.openURL(event.url!)}
                    style={{
                      borderRadius: 14,
                      backgroundColor: colors.brand,
                      paddingVertical: 14,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Ionicons name="open-outline" size={16} color="white" />
                    <Text style={{ fontSize: 15, fontWeight: '800', color: 'white' }}>View on Registrar</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </Animated.View>
          </View>
        );
      })()}

      {/* ── Hero info sheet (absolutely positioned, no Modal) ── */}
      {heroSheetVisible && (
        <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} pointerEvents="box-none">
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.45)' }}
            activeOpacity={1}
            onPress={closeHeroSheet}
          />
          <Animated.View style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            transform: [{ translateY: heroSheetSlideAnim }],
            backgroundColor: colors.bg,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            maxHeight: '88%',
            overflow: 'hidden',
          }}>
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
                {openHeroSheet === 'dining' ? 'Today\'s Dining' : openHeroSheet === 'sports' ? 'Sports Events' : 'Campus'}
              </Text>
              <TouchableOpacity onPress={closeHeroSheet} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.bgSecondary, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={17} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: bottomInset + 84 }} showsVerticalScrollIndicator={false}>
              {/* ── Dining ── */}
              {openHeroSheet === 'dining' && (
                <View style={{ gap: 12 }}>
                  {/* Sponsored card — Dining */}
                  <TouchableOpacity activeOpacity={0.76} style={{ borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(234,88,12,0.1)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Ionicons name="bag-handle-outline" size={20} color="#EA580C" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textTertiary }}>Sponsored</Text>
                      </View>
                      <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>DoorDash — $0 delivery for students</Text>
                      <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>Free DashPass with your .edu email</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                  {diningLoading && diningMenus.length === 0 ? (
                    <View style={{ gap: 10 }}><SkeletonBlock height={110} radius={18} /><SkeletonBlock height={110} radius={18} /></View>
                  ) : diningMenus.length === 0 ? (
                    <EmptyState compact icon="restaurant-outline" title="No dining data" body={diningError ?? 'No menu available today.'} />
                  ) : diningMenusExternalOnly ? (
                    <TouchableOpacity onPress={openDiningMenuList} activeOpacity={0.78}
                      style={{ borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: themedIconBackground(diningAccent, isDark, '#fff7ed'), alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="restaurant-outline" size={20} color={themedIconColor(diningAccent, isDark)} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>View Official Menu</Text>
                        <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>Opens in browser</Text>
                      </View>
                      <Ionicons name="open-outline" size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                  ) : (
                    diningMenus.map((menu) => {
                      const statusColor = menu.isOpen === true ? '#10B981' : menu.isOpen === false ? '#EF4444' : diningAccent;
                      const items = previewDiningItems(menu, 18);
                      return (
                        <TouchableOpacity key={menu.id} onPress={openDiningMenuList} activeOpacity={0.78}
                          style={{ borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 16 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                            <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: themedIconBackground(diningAccent, isDark, '#fff7ed'), alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Ionicons name="restaurant-outline" size={19} color={themedIconColor(diningAccent, isDark)} />
                            </View>
                            <Text numberOfLines={1} style={{ flex: 1, fontSize: 16, fontWeight: '800', color: colors.text }}>{menu.name}</Text>
                            {menu.statusLabel ? (
                              <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: `${statusColor}18`, borderWidth: 1, borderColor: `${statusColor}35`, flexShrink: 0 }}>
                                <Text style={{ fontSize: 11, fontWeight: '900', color: statusColor }}>{menu.statusLabel}</Text>
                              </View>
                            ) : null}
                          </View>
                          {menu.statusDetail ? <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 10 }}>{menu.statusDetail}</Text> : null}
                          {items.length > 0 ? (
                            <Text numberOfLines={2} ellipsizeMode="tail" style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}>
                              {items.join('  ·  ')}
                            </Text>
                          ) : null}
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 10, gap: 3 }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary }}>Full menu</Text>
                            <Ionicons name="chevron-forward" size={12} color={colors.textTertiary} />
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              )}
              {/* ── Sports ── */}
              {openHeroSheet === 'sports' && (
                <View style={{ gap: 10 }}>
                  {/* Sponsored card — Sports */}
                  <TouchableOpacity activeOpacity={0.76} style={{ borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(65,105,225,0.1)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Ionicons name="tv-outline" size={20} color={colors.brand} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textTertiary }}>Sponsored</Text>
                      </View>
                      <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>ESPN+ — Watch every game live</Text>
                      <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>Student discount available</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                  {sportsLoading && visibleCampusEvents.length === 0 ? (
                    <View style={{ gap: 10 }}><SkeletonBlock height={72} radius={18} /><SkeletonBlock height={72} radius={18} /><SkeletonBlock height={72} radius={18} /></View>
                  ) : visibleCampusEvents.length === 0 ? (
                    <EmptyState compact icon="trophy-outline" title="No upcoming sports events" body="Events will appear here when the athletics calendar has something coming up." />
                  ) : (
                    visibleCampusEvents.map((event) => (
                      <TouchableOpacity key={event.id}
                        onPress={() => { closeHeroSheet(); setTimeout(() => openSportsEvent(event), 260); }}
                        activeOpacity={0.76}
                        style={{ borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: themedIconBackground(event.color, isDark, event.bg), alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Ionicons name={event.icon} size={20} color={themedIconColor(event.color, isDark)} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{event.title}</Text>
                          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                            {formatRelativeEventDayLabel(event.date, now, effectiveTimeZone)} · {formatSportsEventTime(event.date, event.timeLabel, effectiveTimeZone)}
                          </Text>
                        </View>
                        <InfoChip label={sportsHomeAwayLabel(event)} tone={event.isHome ? 'brand' : 'neutral'} compact
                          color={event.isHome ? colors.brand : colors.textSecondary}
                          borderColor={event.isHome ? `${colors.brand}44` : colors.borderSubtle}
                          backgroundColor={event.isHome ? colors.brandBg : colors.bgTertiary} />
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
              {/* ── Campus ── */}
              {openHeroSheet === 'campus' && (
                <View style={{ gap: 10 }}>
                  {/* Sponsored card — Campus */}
                  <TouchableOpacity activeOpacity={0.76} style={{ borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(5,150,105,0.1)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Ionicons name="briefcase-outline" size={20} color="#059669" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textTertiary }}>Sponsored</Text>
                      </View>
                      <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Handshake — Internships for UCI students</Text>
                      <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>1,200+ open roles near Irvine</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                  {campusInfoResources.map((resource) => {
                    const resourceCaption = campusInfoResourceCaption(resource);
                    if (resource.children?.length) {
                      return (
                        <View key={resource.id} style={{ borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                            <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: themedIconBackground(resource.color, isDark, resource.bg), alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Ionicons name={resource.icon} size={18} color={themedIconColor(resource.color, isDark)} />
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{resource.title}</Text>
                              {resourceCaption ? <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>{resourceCaption}</Text> : null}
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {resource.children.map((child) => (
                              <TouchableOpacity key={child.id} onPress={() => void openCampusInfoLink(child)} activeOpacity={0.76}
                                style={{ flexGrow: 1, flexBasis: '47%', minHeight: 36, borderRadius: 12, backgroundColor: themedIconBackground(resource.color, isDark, resource.bg), alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
                                <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '800', color: themedIconColor(resource.color, isDark) }}>{child.title}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      );
                    }
                    return (
                      <TouchableOpacity key={resource.id} onPress={() => void openCampusInfoLink(resource)} activeOpacity={0.76}
                        style={{ borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: themedIconBackground(resource.color, isDark, resource.bg), alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Ionicons name={resource.icon} size={19} color={themedIconColor(resource.color, isDark)} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{resource.title}</Text>
                          {resourceCaption ? <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>{resourceCaption}</Text> : null}
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      )}

      <Modal
        visible={showCampusInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCampusInfo(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.34)' }}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowCampusInfo(false)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View
            style={{
              maxHeight: Math.round(windowHeight * 0.72),
              borderTopLeftRadius: SHEET_CORNER_RADIUS,
              borderTopRightRadius: SHEET_CORNER_RADIUS,
              backgroundColor: colors.bg,
              paddingTop: 10,
              overflow: 'hidden',
            }}
          >
            <View style={{ alignItems: 'center', paddingBottom: 12 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>
            <View style={{ paddingHorizontal: 18, paddingBottom: 12, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 24, lineHeight: 29, fontWeight: '800', color: colors.text }}>
                  Campus Info
                </Text>
                <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary, marginTop: 6 }}>
                  Campus links for {schoolCampusLabel(school)}.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowCampusInfo(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: colors.bgTertiary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: Math.max(bottomInset, 18) + 18, gap: 10 }}
            >
              {campusInfoResources.map((resource) => {
                const resourceCaption = campusInfoResourceCaption(resource);
                if (resource.children?.length) {
                  const isExpanded = expandedCampusInfoCards[resource.id] ?? true;
                  return (
                    <View
                      key={resource.id}
                      style={{
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        padding: 14,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => toggleCampusInfoCard(resource.id)}
                        activeOpacity={0.78}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
                      >
                        <View
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 15,
                            backgroundColor: themedIconBackground(resource.color, isDark, resource.bg),
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name={resource.icon} size={21} color={themedIconColor(resource.color, isDark)} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: campusInfoSheetTitleSize, lineHeight: campusInfoSheetTitleLineHeight, fontWeight: '800', color: colors.text }}>
                            {resource.title}
                          </Text>
                          {resourceCaption ? (
                            <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: campusInfoSheetCaptionSize, lineHeight: campusInfoSheetCaptionLineHeight, color: colors.textSecondary, marginTop: 2 }}>
                              {resourceCaption}
                            </Text>
                          ) : null}
                        </View>
                        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
                      </TouchableOpacity>
                      {isExpanded ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 12 }}>
                          {resource.children.map((child) => (
                            <TouchableOpacity
                              key={`${resource.id}-${child.id}`}
                              onPress={() => {
                                setShowCampusInfo(false);
                                void openCampusInfoLink(child);
                              }}
                              activeOpacity={0.78}
                              style={{
                                flexGrow: 1,
                                flexBasis: '47%',
                                minHeight: 46,
                                borderRadius: 15,
                                backgroundColor: themedIconBackground(resource.color, isDark, resource.bg),
                                paddingHorizontal: 10,
                                paddingVertical: 8,
                                justifyContent: 'center',
                              }}
                            >
                              <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: campusInfoSheetChildTitleSize, lineHeight: campusInfoSheetChildTitleLineHeight, fontWeight: '800', color: themedIconColor(resource.color, isDark) }}>
                                {child.title}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  );
                }

                return (
                  <TouchableOpacity
                    key={resource.id}
                    onPress={() => {
                      setShowCampusInfo(false);
                      void openCampusInfoLink(resource);
                    }}
                    activeOpacity={0.78}
                    style={{
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      padding: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 15,
                        backgroundColor: themedIconBackground(resource.color, isDark, resource.bg),
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name={resource.icon} size={21} color={themedIconColor(resource.color, isDark)} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: campusInfoSheetTitleSize, lineHeight: campusInfoSheetTitleLineHeight, fontWeight: '800', color: colors.text }}>
                        {resource.title}
                      </Text>
                      {resourceCaption ? (
                        <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: campusInfoSheetCaptionSize, lineHeight: campusInfoSheetCaptionLineHeight, color: colors.textSecondary, marginTop: 2 }}>
                          {resourceCaption}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="open-outline" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDiningMenuList}
        transparent
        animationType="none"
        onRequestClose={() => closeDiningMenuList()}
      >
        <Animated.View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: diningListBackdropAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0)', 'rgba(15,23,42,0.34)'] }) }}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => closeDiningMenuList()}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <Animated.View
            style={{
              maxHeight: '90%',
              height: diningListSheetHeight,
              borderTopLeftRadius: SHEET_CORNER_RADIUS,
              borderTopRightRadius: SHEET_CORNER_RADIUS,
              backgroundColor: colors.bg,
              paddingTop: 10,
              paddingBottom: Math.max(bottomInset, 18) + 8,
              overflow: 'hidden',
              transform: [{ translateY: diningListSheetAnim }],
            }}
          >
            <View style={{ alignItems: 'center', paddingBottom: 12 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, marginBottom: 12 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 24, lineHeight: 29, fontWeight: '800', color: colors.text }}>
                  Today's Dining
                </Text>
                <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                  {diningMenus.length > 0
                    ? diningMenusExternalOnly
                      ? 'Official dining menu link'
                      : `${diningMenus.length} location${diningMenus.length === 1 ? '' : 's'} · ${diningMenuItemCount} items`
                    : schoolCampusLabel(school)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => closeDiningMenuList()}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: colors.bgTertiary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 22 }}
            >
              {diningMenus.length > 0 ? (
                <View style={{ gap: 12 }}>
                  {diningMenus.map((menu) => {
                    const statusColor = menu.isOpen === true ? '#10B981' : menu.isOpen === false ? '#EF4444' : diningAccent;
                    return (
                    <View
                      key={`dining-sheet-${menu.id}`}
                      style={{
                        borderRadius: 18,
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: colors.borderSubtle,
                        padding: 14,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 11 }}>
                        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: themedIconBackground(diningAccent, isDark, '#fff7ed'), alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Ionicons name="restaurant-outline" size={20} color={themedIconColor(diningAccent, isDark)} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 17, lineHeight: 21, fontWeight: '800', color: colors.text }}>
                            {menu.name}
                          </Text>
                          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>
                            {menu.isExternalLinkOnly ? 'Official menu link' : `${menu.itemCount} items today`}
                          </Text>
                        </View>
                        {menu.statusLabel ? (
                          <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: `${statusColor}16`, borderWidth: 1, borderColor: `${statusColor}30` }}>
                            <Text style={{ fontSize: 10.5, lineHeight: 14, fontWeight: '900', color: statusColor }}>
                              {menu.statusLabel}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {menu.statusDetail ? (
                        <View style={{ borderRadius: 14, backgroundColor: colors.bgSecondary, borderWidth: 1, borderColor: colors.borderSubtle, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 }}>
                          <Text style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary, fontWeight: '700' }}>
                            {menu.statusDetail}
                          </Text>
                        </View>
                      ) : null}

                      {menu.meals.map((meal, mealIndex) => {
                        return (
                          <View
                            key={`${menu.id}-${meal.id}-${mealIndex}`}
                            style={{
                              paddingTop: mealIndex === 0 ? 0 : 14,
                              marginTop: mealIndex === 0 ? 0 : 14,
                              borderTopWidth: mealIndex === 0 ? 0 : 1,
                              borderTopColor: colors.borderSubtle,
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                              <Text style={{ fontSize: 14, lineHeight: 18, fontWeight: '800', color: colors.text }}>
                                {meal.name}
                              </Text>
                              <Text style={{ fontSize: 11, lineHeight: 15, fontWeight: '700', color: colors.textTertiary }}>
                                {meal.timeLabel ?? `${mealItemCount(meal)} items`}
                              </Text>
                            </View>
                            <View style={{ marginTop: 10, gap: 10 }}>
                              {meal.stations.map((station, stationIndex) => (
                                <View
                                  key={`${menu.id}-${meal.id}-${station.id}-${stationIndex}`}
                                  style={{
                                    borderRadius: 14,
                                    backgroundColor: colors.bgSecondary,
                                    borderWidth: 1,
                                    borderColor: colors.borderSubtle,
                                    paddingHorizontal: 12,
                                    paddingVertical: 10,
                                  }}
                                >
                                  <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '800', color: colors.textSecondary, marginBottom: 7 }}>
                                    {diningStationLabel(station.name, stationIndex)}
                                  </Text>
                                  <View style={{ gap: 7 }}>
                                    {station.items.map((food, foodIndex) => (
                                      <View
                                        key={`${menu.id}-${meal.id}-${station.id}-${food.id}-${foodIndex}`}
                                        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}
                                      >
                                        <Text style={{ fontSize: 15, lineHeight: 20, color: diningAccent, marginTop: -1 }}>
                                          •
                                        </Text>
                                        <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: colors.text }}>
                                          {food.name}
                                        </Text>
                                      </View>
                                    ))}
                                  </View>
                                </View>
                              ))}
                            </View>
                          </View>
                        );
                      })}

                      <TouchableOpacity
                        onPress={() => openDiningOfficialMenu(menu.officialUrl)}
                        activeOpacity={0.72}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderTopWidth: 1,
                          borderTopColor: colors.borderSubtle,
                          marginTop: 14,
                          paddingTop: 13,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '800', color: diningAccent }}>
                          Open official menu
                        </Text>
                        <Ionicons name="open-outline" size={15} color={diningAccent} />
                      </TouchableOpacity>
                    </View>
                    );
                  })}
                </View>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  {diningLoading ? <ActivityIndicator size="small" color={diningAccent} /> : null}
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center', marginTop: diningLoading ? 12 : 0 }}>
                    {diningLoading ? 'Loading dining menus' : 'Dining menus unavailable'}
                  </Text>
                  <Text style={{ fontSize: 13, lineHeight: 19, color: diningError ? '#EF4444' : colors.textSecondary, textAlign: 'center', marginTop: 7 }}>
                    {diningError ?? 'Menus will appear here when the dining feed has food data for today.'}
                  </Text>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>

      <Modal
        visible={showSportsEventsList}
        transparent
        animationType="none"
        onRequestClose={() => closeSportsMoreList()}
      >
        <Animated.View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: sportsListBackdropAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0)', 'rgba(15,23,42,0.34)'] }) }}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => closeSportsMoreList()}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <Animated.View
            style={{
              maxHeight: '78%',
              height: sportsListSheetHeight,
              borderTopLeftRadius: SHEET_CORNER_RADIUS,
              borderTopRightRadius: SHEET_CORNER_RADIUS,
              backgroundColor: colors.bg,
              paddingTop: 10,
              paddingBottom: Math.max(bottomInset, 18) + 8,
              overflow: 'hidden',
              transform: [{ translateY: sportsListSheetAnim }],
            }}
          >
            <View style={{ alignItems: 'center', paddingBottom: 12 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, marginBottom: 12 }}>
              <View>
                <Text style={{ fontSize: 24, lineHeight: 29, fontWeight: '800', color: colors.text }}>
                  Sports Events
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                  {visibleCampusEvents.length} upcoming
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => closeSportsMoreList()}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: colors.bgTertiary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 10 }}
            >
              {visibleCampusEvents.length > 0 ? (
                <View style={{ gap: 10 }}>
                  {visibleCampusEvents.map((event, index) => (
                    <TouchableOpacity
                      key={`${event.id}-sheet-${index}`}
                      onPress={() => openSportsEvent(event)}
                      activeOpacity={0.78}
                      style={{
                        borderRadius: 18,
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: colors.borderSubtle,
                        padding: 14,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: themedIconBackground(event.color, isDark, event.bg), alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Ionicons name={event.icon} size={20} color={themedIconColor(event.color, isDark)} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={2} style={{ fontSize: 16, lineHeight: 20, fontWeight: '800', color: colors.text }}>
                            {event.title}
                          </Text>
                          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 6 }}>
                            {formatRelativeEventDayLabel(event.date, now, effectiveTimeZone)} · {formatSportsEventTime(event.date, event.timeLabel, effectiveTimeZone)}
                          </Text>
                        </View>
                        <InfoChip
                          label={sportsHomeAwayLabel(event)}
                          tone={event.isHome ? 'brand' : 'neutral'}
                          compact
                          color={event.isHome ? colors.brand : colors.textSecondary}
                          borderColor={event.isHome ? `${colors.brand}44` : colors.borderSubtle}
                          backgroundColor={event.isHome ? colors.brandBg : colors.bgTertiary}
                        />
                      </View>
                      <InfoChip
                        icon="people-outline"
                        label={`${(sportsEventListParticipation[event.id] ?? 0) > 99 ? '99+' : (sportsEventListParticipation[event.id] ?? 0)} going`}
                        tone="brand"
                        compact
                        color={sportsGoingAccent}
                        backgroundColor={`${sportsGoingAccent}14`}
                        borderColor={`${sportsGoingAccent}28`}
                        style={{ marginTop: 9, marginLeft: 48 }}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
                    No upcoming sports events
                  </Text>
                  <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary, textAlign: 'center', marginTop: 7 }}>
                    Events will appear here when the athletics calendar has something coming up.
                  </Text>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>

      <Modal
        visible={showPastAssignments}
        transparent
        animationType="none"
        onRequestClose={closePastAssignments}
      >
        <Animated.View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: pastAssignmentsBackdropAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0)', 'rgba(15,23,42,0.34)'] }) }}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={closePastAssignments}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <Animated.View
            style={{
              maxHeight: '80%',
              height: pastAssignmentsSheetHeight,
              borderTopLeftRadius: SHEET_CORNER_RADIUS,
              borderTopRightRadius: SHEET_CORNER_RADIUS,
              backgroundColor: colors.bg,
              paddingTop: 10,
              paddingBottom: Math.max(bottomInset, 18) + 8,
              overflow: 'hidden',
              transform: [{ translateY: pastAssignmentsSheetAnim }],
            }}
          >
            <View style={{ alignItems: 'center', paddingBottom: 12 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, marginBottom: 12 }}>
              <View>
                <Text style={{ fontSize: 24, lineHeight: 29, fontWeight: '800', color: colors.text }}>
                  Completed
                </Text>
              </View>
              <TouchableOpacity
                onPress={closePastAssignments}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: colors.bgTertiary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 10 }}
            >
              {pastCalendarTasks.length > 0 ? (
                <View style={{ gap: 10 }}>
                  {pastCalendarTasks.map((assignment) => {
                    const completed = isCalendarTaskCompleted(assignment, completedCalendarTasks, now);
                    return (
                      <View
                        key={`past-${assignment.id}`}
                        style={{
                          borderRadius: 18,
                          backgroundColor: colors.card,
                          borderWidth: 1,
                          borderColor: colors.borderSubtle,
                          padding: 14,
                          flexDirection: 'row',
                          gap: 11,
                          alignItems: 'flex-start',
                        }}
                      >
                        <TouchableOpacity
                          onPress={() => toggleCalendarTask(assignment)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 13,
                            backgroundColor: completed ? colors.brand : colors.bgTertiary,
                            borderWidth: 1,
                            borderColor: completed ? colors.brand : colors.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: 1,
                          }}
                        >
                          <Ionicons name="checkmark" size={16} color={completed ? 'white' : colors.textTertiary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            if (assignment.url) void openCalendarTask(assignment);
                          }}
                          activeOpacity={assignment.url ? 0.78 : 1}
                          style={{ flex: 1 }}
                        >
                          <Text
                            numberOfLines={2}
                            style={{
                              fontSize: 15,
                              lineHeight: 19,
                              fontWeight: '800',
                              color: completed ? colors.textTertiary : colors.text,
                              textDecorationLine: completed ? 'line-through' : 'none',
                            }}
                          >
                            {assignment.title}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6, flexWrap: 'wrap' }}>
                            <View
                              style={{
                                borderRadius: 999,
                                backgroundColor: colors.brandBg,
                                borderWidth: 1,
                                borderColor: `${colors.brand}33`,
                                paddingHorizontal: 7,
                                paddingVertical: 3,
                              }}
                            >
                              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.brand }}>
                                {assignment.courseCode}
                              </Text>
                            </View>
                            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                              {formatCalendarTaskDueLabel(assignment, now, effectiveTimeZone)}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
                    No completed assignments
                  </Text>
                  <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary, textAlign: 'center', marginTop: 7 }}>
                    Deadlines move here after they pass.
                  </Text>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>

      <Modal
        visible={showCalendarSetup}
        transparent
        animationType="none"
        onRequestClose={closeCalendarSetup}
      >
        <Animated.View style={{ flex: 1, backgroundColor: calendarSetupBackdropAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0)', 'rgba(15,23,42,0.34)'] }) }}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={closeCalendarSetup}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}
          />
          <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end', zIndex: 1, elevation: 1 }}>
            <Animated.View
              style={{
                height: calendarSetupSheetHeight,
                borderTopLeftRadius: SHEET_CORNER_RADIUS,
                borderTopRightRadius: SHEET_CORNER_RADIUS,
                backgroundColor: colors.bg,
                overflow: 'hidden',
                zIndex: 2,
                elevation: 2,
                transform: [{ translateY: calendarSetupSheetAnim }],
              }}
            >
              <ScrollView
                ref={calendarSetupScrollRef}
                style={{ flex: 1 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
	                contentContainerStyle={{
	                  paddingHorizontal: 18,
	                  paddingTop: 10,
	                  paddingBottom: 12,
	                }}
	              >
                <View style={{ alignItems: 'center', paddingBottom: 12 }}>
                  <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 24, lineHeight: 29, fontWeight: '800', color: colors.text }}>
                      Import Assignments
                    </Text>
                    <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary, marginTop: 6 }}>
                      Pick your LMS and paste its .ics or iCal feed link. ClassMate imports deadlines only, not class meetings.
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={closeCalendarSetup}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: colors.bgTertiary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={{ marginTop: 18 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textTertiary, marginBottom: 9 }}>
                Assignment source
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {CALENDAR_PROVIDER_OPTIONS.map((provider) => {
                  const active = provider.id === calendarProvider;
                  return (
                    <TouchableOpacity
                      key={provider.id}
                      onPress={() => setCalendarProvider(provider.id)}
                      activeOpacity={0.78}
                      style={{
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: active ? colors.brand : colors.border,
                        backgroundColor: active ? colors.brandBg : colors.card,
                        paddingHorizontal: 11,
                        paddingVertical: 8,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '800', color: active ? colors.brand : colors.textSecondary }}>
                        {provider.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={{ fontSize: 12, lineHeight: 17, color: colors.textSecondary, marginTop: 9 }}>
                {selectedCalendarProvider.helper}
              </Text>
              {calendarProvider === 'canvas' ? (
                <View
                  style={{
                    marginTop: 12,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.borderSubtle,
                    backgroundColor: colors.card,
                    padding: 12,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: 9 }}>
                    How to get your Canvas link
                  </Text>
                  <View style={{ gap: 8 }}>
                    {CANVAS_CALENDAR_SETUP_STEPS.map((step, index) => (
                      <View key={`canvas-step-${index}`} style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start' }}>
                        <View
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor: colors.brandBg,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: 1,
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.brand }}>
                            {index + 1}
                          </Text>
                        </View>
                        <Text style={{ flex: 1, fontSize: 12, lineHeight: 17, color: colors.textSecondary }}>
                          {step}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>

            <View style={{
              marginTop: 18,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.inputBg,
              paddingHorizontal: 14,
              paddingVertical: 11,
            }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textTertiary, marginBottom: 8 }}>
                {selectedCalendarProvider.label} feed link
              </Text>
              <TextInput
                ref={calendarFeedInputRef}
                value={calendarFeedInput}
                onChangeText={setCalendarFeedInput}
                onPressIn={() => calendarFeedInputRef.current?.focus()}
                onFocus={() => {
                  setTimeout(() => calendarSetupScrollRef.current?.scrollToEnd({ animated: true }), 120);
                }}
                placeholder={selectedCalendarProvider.placeholder}
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                showSoftInputOnFocus
                style={{ minHeight: 44, fontSize: 14, color: colors.text }}
              />
            </View>

                {calendarTasksError ? (
                  <Text style={{ fontSize: 12, color: '#EF4444', marginTop: 10 }}>
                    {calendarTasksError}
                  </Text>
                ) : null}
              </ScrollView>

              <View
                style={{
                  paddingHorizontal: 18,
                  paddingTop: 12,
                  paddingBottom: keyboardInset.footerPaddingBottom(Math.max(bottomInset, 18), 18),
                  backgroundColor: colors.bg,
                }}
              >
                <TouchableOpacity
                  onPress={() => void saveCalendarFeed()}
                  disabled={calendarTasksLoading}
                  activeOpacity={0.8}
                  style={{
                    minHeight: 52,
                    borderRadius: 18,
                    backgroundColor: colors.brand,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 8,
                  }}
                >
                  {calendarTasksLoading ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="sync" size={18} color="white" />}
                  <Text style={{ fontSize: 15, fontWeight: '800', color: 'white' }}>
                    Save and Sync
                  </Text>
                </TouchableOpacity>

            {calendarFeedUrl ? (
              <TouchableOpacity
                onPress={() => void disconnectCalendarFeed()}
                activeOpacity={0.8}
                style={{
                  minHeight: 48,
                  borderRadius: 16,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 10,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#EF4444' }}>
                  Disconnect Calendar
                </Text>
              </TouchableOpacity>
            ) : null}
              </View>
            </Animated.View>
          </View>
        </Animated.View>
      </Modal>

      <Modal
        visible={!!selectedSportsEvent}
        transparent
        animationType="none"
        onRequestClose={closeSportsEvent}
      >
        <Animated.View
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: sportsEventBackdropAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0)', 'rgba(15,23,42,0.34)'] }) }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={closeSportsEvent}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}
          />
          {selectedSportsEvent ? (
            <Animated.View
              style={{
                zIndex: 1,
                elevation: 1,
                maxHeight: '88%',
                height: sportsEventSheetHeight,
                borderTopLeftRadius: SHEET_CORNER_RADIUS,
                borderTopRightRadius: SHEET_CORNER_RADIUS,
                backgroundColor: colors.bg,
                paddingTop: 10,
                paddingBottom: 0,
                overflow: 'hidden',
                transform: [{ translateY: Animated.add(sportsEventSheetAnim, sportsEventKeyboardOffsetAnim) }],
              }}
            >
              <View style={{ alignItems: 'center', paddingBottom: 8 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
              </View>
              <ScrollView
                ref={sportsEventScrollRef}
                style={{ flex: 1 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: sportsEventScrollBottomPadding }}
                onLayout={() => {
                  if (sportsEventKeyboardVisible) settleSportsEventComposer(false);
                }}
                onContentSizeChange={() => {
                  if (sportsEventKeyboardVisible) settleSportsEventComposer(true);
                }}
                showsVerticalScrollIndicator={false}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: themedIconBackground(selectedSportsEvent.color, isDark, selectedSportsEvent.bg),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name={selectedSportsEvent.icon} size={23} color={themedIconColor(selectedSportsEvent.color, isDark)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 24, lineHeight: 29, fontWeight: '800', color: colors.text }}>
                      {selectedSportsEvent.title}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 5 }}>
                      {formatSportsEventDetailDate(selectedSportsEvent, effectiveTimeZone)}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 7, flexWrap: 'wrap' }}>
                      <View
                        style={{
                          borderRadius: 999,
                          backgroundColor: selectedSportsEvent.isHome ? colors.brandBg : colors.bgTertiary,
                          borderWidth: 1,
                          borderColor: selectedSportsEvent.isHome ? `${colors.brand}44` : colors.borderSubtle,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '800', color: selectedSportsEvent.isHome ? colors.brand : colors.textSecondary }}>
                          {sportsHomeAwayLabel(selectedSportsEvent)}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 13, color: colors.textTertiary }}>
                        {selectedSportsEventLocationLabel} · {selectedSportsEvent.sport}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={closeSportsEvent}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: colors.bgTertiary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={() => void handleSportsEventRsvp()}
                  disabled={savingSportsEventRsvp}
                  activeOpacity={0.78}
                  style={{
                    minHeight: 52,
                    borderRadius: 16,
                    backgroundColor: sportsEventRsvp === 'going' ? sportsGoingAccent : colors.card,
                    borderWidth: 1,
                    borderColor: sportsEventRsvp === 'going' ? sportsGoingAccent : colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 7,
                    marginTop: 18,
                  }}
                >
                  <Ionicons
                    name={sportsEventRsvp === 'going' ? 'checkmark-circle' : 'checkmark-circle-outline'}
                    size={18}
                    color={sportsEventRsvp === 'going' ? 'white' : colors.textSecondary}
                  />
                  <Text style={{ fontSize: 14, fontWeight: '800', color: sportsEventRsvp === 'going' ? 'white' : colors.text }}>
                    Going
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: sportsEventRsvp === 'going' ? 'rgba(255,255,255,0.78)' : colors.textTertiary }}>
                    {sportsEventGoingCount}
                  </Text>
                </TouchableOpacity>

                <View
                  style={{
                    marginTop: 18,
                    borderRadius: 20,
                    overflow: 'hidden',
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.borderSubtle,
                  }}
                >
                  {selectedSportsVenue && Platform.OS !== 'web' ? (
                    <MapView
                      style={{ height: 178 }}
                      initialRegion={{
                        latitude: selectedSportsVenue.latitude,
                        longitude: selectedSportsVenue.longitude,
                        latitudeDelta: 0.006,
                        longitudeDelta: 0.006,
                      }}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      rotateEnabled={false}
                      pitchEnabled={false}
                    >
                      <Marker
                        coordinate={{ latitude: selectedSportsVenue.latitude, longitude: selectedSportsVenue.longitude }}
                        title={selectedSportsVenue.name}
                      />
                    </MapView>
                  ) : (
                    <View style={{ height: 118, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgTertiary }}>
                      <Ionicons name={selectedSportsEvent.isHome ? 'map-outline' : 'airplane-outline'} size={28} color={colors.textTertiary} />
                      <Text style={{ marginTop: 8, fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>
                        {selectedSportsEvent.isHome ? 'Venue map unavailable' : 'Away game'}
                      </Text>
                    </View>
                  )}
                  <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>
                        {selectedSportsVenue?.name ?? selectedSportsEvent.location}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 3 }}>
                        {selectedSportsVenue
                          ? `${schoolCampusLabel(school)} venue`
                          : selectedSportsEvent.location === 'Venue TBA'
                            ? 'Venue not listed yet'
                            : 'Event location'}
                      </Text>
                    </View>
                    {selectedSportsVenue ? (
                      <TouchableOpacity
                        onPress={() => void openSportsVenueInMaps(selectedSportsVenue, school)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 999,
                          backgroundColor: colors.brandBg,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.brand }}>Map</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>

                <View style={{ marginTop: 20 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 10 }}>
                    Comments ({sportsEventComments.length})
                  </Text>
                  {sportsEventDetailLoading ? (
                    <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color={colors.brand} />
                    </View>
                  ) : sportsEventComments.length > 0 ? (
                    <View>
                      {sportsEventComments.map((comment) => (
                        <TouchableOpacity
                          key={comment.id}
                          activeOpacity={comment.userId === userId && !comment.id.startsWith('local-') ? 0.92 : 1}
                          disabled={comment.userId !== userId || comment.id.startsWith('local-')}
                          onLongPress={() => openSportsEventCommentActions(comment)}
                          style={{
                            flexDirection: 'row',
                            gap: 10,
                            marginBottom: 16,
                          }}
                        >
                          <View
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              backgroundColor: colors.brand,
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '700', color: 'white' }}>
                              {(comment.authorName || 'A').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                                  {comment.authorName}
                                </Text>
                                <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                                  {timeAgo(comment.createdAt)}
                                </Text>
                              </View>
                              {comment.userId === userId && !comment.id.startsWith('local-') ? (
                                <TouchableOpacity
                                  onPress={() => openSportsEventCommentActions(comment)}
                                  disabled={deletingSportsEventCommentId === comment.id}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 12,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: deletingSportsEventCommentId === comment.id ? 0.45 : 1,
                                    flexShrink: 0,
                                  }}
                                >
                                  <Ionicons name="ellipsis-horizontal" size={16} color={colors.textTertiary} />
                                </TouchableOpacity>
                              ) : null}
                            </View>
                            <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>
                              {comment.content}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textTertiary }}>
                      No comments yet. Start the game thread.
                    </Text>
                  )}
                </View>
              </ScrollView>
              <View
                style={{
                  paddingHorizontal: 18,
                  paddingTop: 8,
                  paddingBottom: sportsEventCommentFooterPadding,
                  borderTopWidth: 1,
                  borderTopColor: colors.borderSubtle,
                  backgroundColor: colors.bg,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                  <TextInput
                    ref={sportsEventCommentInputRef}
                    value={sportsEventCommentInput}
                    onChangeText={setSportsEventCommentInput}
                    onFocus={() => settleSportsEventComposer(true)}
                    placeholder="Add a comment..."
                    placeholderTextColor={colors.placeholder}
                    multiline
                    blurOnSubmit={false}
                    maxLength={500}
                    style={{
                      flex: 1,
                      minHeight: 40,
                      maxHeight: 104,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.inputBg,
                      paddingHorizontal: 14,
                      paddingTop: 10,
                      paddingBottom: 10,
                      fontSize: 14,
                      lineHeight: 19,
                      color: colors.text,
                    }}
                    onSubmitEditing={() => void handleSubmitSportsEventComment()}
                    returnKeyType="send"
                  />
                  <TouchableOpacity
                    onPressIn={() => sportsEventCommentInputRef.current?.focus()}
                    onPress={() => void handleSubmitSportsEventComment()}
                    disabled={!sportsEventCommentInput.trim() || submittingSportsEventComment}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: sportsEventCommentInput.trim() ? colors.brand : colors.border,
                      opacity: submittingSportsEventComment ? 0.7 : 1,
                    }}
                  >
                    {submittingSportsEventComment
                      ? <ActivityIndicator size="small" color="white" />
                      : <Ionicons name="send" size={16} color="white" />}
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          ) : null}
        </Animated.View>
      </Modal>
    </>
  );
}

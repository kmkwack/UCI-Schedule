import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Alert, Animated, BackHandler, LogBox, Modal, PanResponder, Platform, StyleSheet, View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { ThemeProvider, ThemePreference, useTheme } from './src/context/ThemeContext';
import HomeScreen from './src/screens/HomeScreen';
import TimetableScreen from './src/screens/TimetableScreen';
import GradesScreen from './src/screens/GradesScreen';
import CoursePickerScreen from './src/screens/CoursePickerScreen';
import FriendsScreen from './src/screens/FriendsScreen';
import BoardScreen from './src/screens/BoardScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import UniversitySelectionScreen from './src/screens/UniversitySelectionScreen';
import SignInScreen from './src/screens/SignInScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AppErrorBoundary from './src/components/AppErrorBoundary';
import ClassMateIntroScreen from './src/components/ClassMateIntroScreen';
import FeatureOnboardingScreen from './src/components/FeatureOnboardingScreen';
import NotificationPermissionScreen from './src/components/NotificationPermissionScreen';
import { Course, Quarter, Timetable, TimetableSettings, DEFAULT_TIMETABLE_SETTINGS, formatTimeOfDay12, quarterKey } from './src/data/courses';
import { DEFAULT_UNIVERSITY, buildTermCandidates, getAcademicTermForDate, getSchoolConfig, resolveCurrentTerm, schoolFeatureEnabled, universityForName, type University } from './src/data/schools';
import {
  buildDisplayName,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_USER_SETTINGS,
  fallbackProfileFromEmail,
  hasCompletedProfileSetup,
  needsInitialOnboarding,
  normalizeDateFormatPreference,
  normalizeLanguagePreference,
  profileDetailsFromProfile,
  profileFromSources,
} from './src/data/userPreferences';
import { fetchSportsEventsForSchool } from './src/data/sportsEvents';
import { addZonedDays, getZonedDateParts, normalizeTimeZone, zonedDateFromParts, zonedWeekdayIndex } from './src/data/timeZone';
import { supabase } from './src/lib/supabase';
import { isMissingSchoolColumnError } from './src/lib/supabaseErrors';
import type { ChatTarget } from './src/data/messages';
import { triggerLightHaptic, triggerSelectionHaptic, triggerSuccessHaptic } from './src/utils/haptics';
import { MOTION } from './src/utils/motion';
import type { PanResponderGestureState } from 'react-native';
import type { DateFormatPreference, EditableProfile, LanguagePreference, NotificationPreferences, PushPermissionStatus, TimetableVisibility, UserSettingsState } from './src/data/userPreferences';

type ConversationMessageNotificationRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type FriendRequestNotificationRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
};

type CommentNotificationRow = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_comment_id?: string | null;
};

type LikeNotificationRow = {
  target_type: 'post' | 'comment';
  target_id: string;
  user_id: string;
  post_id?: string;
  comment_id?: string;
};

type SocialNotificationSnapshot = {
  friendRequests: FriendRequestNotificationRow[];
  messages: ConversationMessageNotificationRow[];
  comments: CommentNotificationRow[];
  likes: LikeNotificationRow[];
  postTitlesById: Record<string, string>;
  myCommentIds: Set<string>;
};

type AssignmentCalendarTask = {
  id: string;
  title: string;
  courseCode?: string;
  dueAt: string;
  allDay?: boolean;
  url?: string;
};

type ConversationParticipantUnreadRow = {
  conversation_id: string;
  last_read_at: string | null;
};

type ConversationUnreadMessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  created_at: string;
  deleted_at: string | null;
};

type BoardPostTimestampRow = {
  id: string;
  created_at: string;
};

type AuthScreen = 'welcome' | 'university' | 'signin' | 'signup';
type MainTab = 'home' | 'timetable' | 'grades' | 'board' | 'friends';
type BoardPostOpenRequest = { postId: string; requestId: number };

function parseQuarterKeyValue(key: string): Quarter | null {
  const idx = key.indexOf('-');
  if (idx <= 0) return null;
  const year = key.slice(0, idx);
  const quarter = key.slice(idx + 1);
  if (!year || !quarter) return null;
  return { year, quarter };
}

async function fetchPreferredSeededQuarter(school: string, preferredKey: string): Promise<Quarter | null> {
  const candidates = buildTermCandidates(school, 2019, new Date().getFullYear() + 1);
  const seededKeys = new Set<string>();

  const { data, error } = await supabase
    .from('school_terms')
    .select('quarter_key, section_count')
    .eq('school', school)
    .gt('section_count', 0);

  if (error) console.warn('Failed to resolve seeded quarter from school_terms:', error);
  (data ?? []).forEach((row: any) => {
    if (row.quarter_key) seededKeys.add(row.quarter_key);
  });

  if (seededKeys.has(preferredKey)) return parseQuarterKeyValue(preferredKey);

  return candidates.reverse().find((term) => seededKeys.has(quarterKey(term))) ?? null;
}

const AUTH_VALIDATION_TIMEOUT_MS = 8000;
const USER_BOOTSTRAP_TIMEOUT_MS = 7000;
const MESSAGE_BADGE_INITIAL_DELAY_MS = 1000;
const MESSAGE_BADGE_REFRESH_INTERVAL_MS = 60000;
const BOARD_BADGE_INITIAL_DELAY_MS = 1400;
const BOARD_BADGE_REFRESH_INTERVAL_MS = 60000;
const SOCIAL_NOTIFICATION_BOOTSTRAP_DELAY_MS = 8000;
const SOCIAL_NOTIFICATION_REFRESH_INTERVAL_MS = 120000;
const REMINDER_RESCHEDULE_DELAY_MS = 4000;
const LEGACY_ASSIGNMENT_REMINDER_OFFSETS = [2880, 1440, 720];
const ASSIGNMENT_REMINDER_OFFSETS = [2880, 1440, 720, 60];
const ASSIGNMENT_REMINDER_MAX_DAYS_AHEAD = 60;
const REVIEW_ACCOUNT_EMAILS = new Set(['review@classmate.app']);
const CLASSMATE_REMINDER_NOTIFICATION_PREFIX = 'classmate-reminder';
const LAST_THEME_PREFERENCE_STORAGE_KEY = 'theme_preference_last';

function scopedPreferenceStorageKey(base: string, school: string, userId: string | null | undefined) {
  return `${base}_${encodeURIComponent(school)}_${userId || 'guest'}`;
}

function notificationIdentifierPart(value: string | number | null | undefined) {
  return encodeURIComponent(String(value ?? 'none').trim().replace(/\s+/g, '_')).slice(0, 120);
}

function reminderNotificationPrefix(userId: string, school: string) {
  return [
    CLASSMATE_REMINDER_NOTIFICATION_PREFIX,
    notificationIdentifierPart(userId),
    notificationIdentifierPart(school),
  ].join(':');
}

function reminderNotificationIdentifier(userId: string, school: string, kind: string, parts: Array<string | number | null | undefined>) {
  return [
    reminderNotificationPrefix(userId, school),
    notificationIdentifierPart(kind),
    ...parts.map(notificationIdentifierPart),
  ].join(':');
}

async function cancelScheduledClassMateReminders(userId: string, school: string) {
  const prefix = `${reminderNotificationPrefix(userId, school)}:`;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.identifier.startsWith(prefix))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier))
  );
}

function normalizeThemePreference(value: unknown): ThemePreference | null {
  return value === 'light' || value === 'dark' || value === 'auto' ? value : null;
}

function normalizeTimetableSettings(value: unknown): TimetableSettings | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<TimetableSettings>;
  const theme = candidate.theme === 'minimal' || candidate.theme === 'colorful' || candidate.theme === 'soft' || candidate.theme === 'outline'
    ? candidate.theme
    : 'pastel';
  return {
    theme,
    showCode: typeof candidate.showCode === 'boolean' ? candidate.showCode : DEFAULT_TIMETABLE_SETTINGS.showCode,
    showClassName: typeof candidate.showClassName === 'boolean' ? candidate.showClassName : DEFAULT_TIMETABLE_SETTINGS.showClassName,
    showRoomNumber: typeof candidate.showRoomNumber === 'boolean' ? candidate.showRoomNumber : DEFAULT_TIMETABLE_SETTINGS.showRoomNumber,
    showInstructor: typeof candidate.showInstructor === 'boolean' ? candidate.showInstructor : DEFAULT_TIMETABLE_SETTINGS.showInstructor,
    showTime: typeof candidate.showTime === 'boolean' ? candidate.showTime : DEFAULT_TIMETABLE_SETTINGS.showTime,
  };
}

async function readStoredTimetableSettings(key: string) {
  try {
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return null;
    return normalizeTimetableSettings(JSON.parse(stored));
  } catch {
    return null;
  }
}

async function readLastThemePreference() {
  const storedPreference = normalizeThemePreference(await AsyncStorage.getItem(LAST_THEME_PREFERENCE_STORAGE_KEY));
  if (storedPreference) return storedPreference;

  const keys = await AsyncStorage.getAllKeys();
  const scopedThemeKeys = keys.filter(
    (key) => key.startsWith('theme_preference_') && key !== LAST_THEME_PREFERENCE_STORAGE_KEY
  );
  if (scopedThemeKeys.length === 0) return null;

  const scopedPreferences = await AsyncStorage.multiGet(scopedThemeKeys);
  const scopedPreference = scopedPreferences
    .map(([, value]) => normalizeThemePreference(value))
    .find((value): value is ThemePreference => value !== null) ?? null;
  if (scopedPreference) {
    void AsyncStorage.setItem(LAST_THEME_PREFERENCE_STORAGE_KEY, scopedPreference);
  }
  return scopedPreference;
}

function isReviewAccountEmail(email: string | null | undefined) {
  return REVIEW_ACCOUNT_EMAILS.has((email ?? '').trim().toLowerCase());
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });
}

type AppContentProps = { themePreference: ThemePreference; onThemeChange: (v: ThemePreference) => void };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});


// Supabase logs this to console before firing SIGNED_OUT when a stored refresh
// token is invalid. We handle SIGNED_OUT in onAuthStateChange, so suppress the noise.
LogBox.ignoreLogs(['Invalid Refresh Token', 'AuthApiError']);

function parseCourseDays(daysString: string) {
  const result: string[] = [];
  let i = 0;
  while (i < daysString.length) {
    const two = daysString.slice(i, i + 2);
    if (two === 'Th' || two === 'Sa' || two === 'Su') {
      result.push(two);
      i += 2;
      continue;
    }
    const one = daysString[i];
    if ('MTWF'.includes(one)) result.push(one);
    i += 1;
  }
  return result;
}

function parseTimeStart(timeRange: string) {
  const [hourStr, minuteStr] = timeRange.split(' - ')[0].split(':');
  return { hour: Number(hourStr), minute: Number(minuteStr) };
}

function courseStartMinutes(course: Course) {
  const { hour, minute } = parseTimeStart(course.time);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Number.MAX_SAFE_INTEGER;
  return hour * 60 + minute;
}

function formatNotificationStartTime(timeRange: string) {
  const rawStart = timeRange.split(' - ')[0]?.trim() ?? timeRange;
  return formatTimeOfDay12(rawStart);
}

function buildDailyScheduleNotificationLine(course: Course) {
  const parts = [
    formatNotificationStartTime(course.time),
    course.code,
    course.location,
  ].filter(Boolean);
  return `• ${parts.join(' · ')}`;
}

function buildDailyScheduleNotificationBody(courses: Course[]) {
  const sortedCourses = courses.slice().sort((a, b) => courseStartMinutes(a) - courseStartMinutes(b));
  const visibleCourses = sortedCourses.slice(0, 5);
  const items = visibleCourses.map(buildDailyScheduleNotificationLine);
  const remaining = Math.max(0, sortedCourses.length - visibleCourses.length);
  const body = remaining > 0
    ? [...items, `• +${remaining} more in ClassMate`].join('\n')
    : items.join('\n');

  return truncateNotificationText(body || 'Open ClassMate to see your full schedule for today.', 220);
}

function normalizeDailyScheduleSummaryHour(value: number | undefined) {
  const candidate = typeof value === 'number' ? value : 8;
  return Number.isFinite(candidate) && candidate >= 0 && candidate <= 23 ? Math.floor(candidate) : 8;
}

function weekdayIndex(day: string) {
  const map: Record<string, number> = { Su: 0, M: 1, T: 2, W: 3, Th: 4, F: 5, Sa: 6 };
  return map[day] ?? -1;
}

function truncateNotificationText(value: string, maxLength = 64) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function isNetworkRequestError(error: unknown) {
  const message = String((error as { message?: unknown } | null | undefined)?.message ?? error ?? '').toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('fetch failed')
  );
}

function buildUpcomingClassReminderDates(courses: Course[], reminderMinutes: number, timeZone: string, daysAhead = 14) {
  const zone = normalizeTimeZone(timeZone);
  const now = new Date();
  const dates: Array<{ course: Course; notifyAt: Date }> = [];

  for (const course of courses) {
    if (course.time === 'TBA' || course.days === 'TBA') continue;
    const location = course.location?.toLowerCase() ?? '';
    if (location.includes('online') || location.includes('remote')) continue;

    const { hour, minute } = parseTimeStart(course.time);
    const courseDays = parseCourseDays(course.days);

    for (let dayOffset = 0; dayOffset <= daysAhead; dayOffset++) {
      const cursor = addZonedDays(now, dayOffset, zone);
      if (!courseDays.some((day) => weekdayIndex(day) === zonedWeekdayIndex(cursor, zone))) continue;

      const dayParts = getZonedDateParts(cursor, zone);
      const classStart = zonedDateFromParts({ ...dayParts, hour, minute, second: 0 }, zone);
      const notifyAt = new Date(classStart.getTime() - reminderMinutes * 60 * 1000);

      if (notifyAt <= now || classStart <= now) continue;
      dates.push({ course, notifyAt });
    }
  }

  return dates;
}

function buildDailyScheduleSummaryDates(courses: Course[], timeZone: string, daysAhead = 14, summaryHour = 8) {
  const zone = normalizeTimeZone(timeZone);
  const now = new Date();
  const dates: Array<{ notifyAt: Date; courses: Course[] }> = [];

  for (let dayOffset = 0; dayOffset <= daysAhead; dayOffset++) {
    const cursor = addZonedDays(now, dayOffset, zone);
    const dayIndex = zonedWeekdayIndex(cursor, zone);
    const dayCourses = courses.filter((course) => {
      if (course.time === 'TBA' || course.days === 'TBA') return false;
      return parseCourseDays(course.days).some((day) => weekdayIndex(day) === dayIndex);
    });

    if (dayCourses.length === 0) continue;

    const dayParts = getZonedDateParts(cursor, zone);
    const notifyAt = zonedDateFromParts({ ...dayParts, hour: summaryHour, minute: 0, second: 0 }, zone);
    if (notifyAt <= now) continue;

    dates.push({ notifyAt, courses: dayCourses });
  }

  return dates;
}

function userScopedStorageKey(base: string, userId: string) {
  return `${base}_${userId || 'guest'}`;
}

function parseStoredAssignmentTasks(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((task): task is AssignmentCalendarTask => (
      typeof task?.id === 'string'
      && typeof task?.title === 'string'
      && typeof task?.dueAt === 'string'
      && !Number.isNaN(new Date(task.dueAt).getTime())
    ));
  } catch {
    return [];
  }
}

function parseStoredCompletedAssignments(value: string | null) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

function normalizeAssignmentReminderOffsets(offsets?: number[]) {
  const allowed = new Set(ASSIGNMENT_REMINDER_OFFSETS);
  const source = Array.isArray(offsets) ? offsets : ASSIGNMENT_REMINDER_OFFSETS;
  const normalized = source
    .filter((minutes) => allowed.has(minutes))
    .filter((minutes, index, values) => values.indexOf(minutes) === index);
  const isLegacyDefault = normalized.length === LEGACY_ASSIGNMENT_REMINDER_OFFSETS.length
    && LEGACY_ASSIGNMENT_REMINDER_OFFSETS.every((minutes) => normalized.includes(minutes));
  if (isLegacyDefault) return ASSIGNMENT_REMINDER_OFFSETS;
  return normalized.length > 0 ? normalized : ASSIGNMENT_REMINDER_OFFSETS;
}

function formatAssignmentReminderOffset(minutes: number) {
  if (minutes >= 1440 && minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? '1 day' : `${days} days`;
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}

function buildUpcomingAssignmentReminderDates(
  assignments: AssignmentCalendarTask[],
  completedAssignments: Record<string, boolean>,
  reminderOffsets: number[],
  daysAhead = ASSIGNMENT_REMINDER_MAX_DAYS_AHEAD
) {
  const now = new Date();
  const end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const offsets = normalizeAssignmentReminderOffsets(reminderOffsets);
  const dates: Array<{ assignment: AssignmentCalendarTask; notifyAt: Date; offsetMinutes: number }> = [];

  for (const assignment of assignments) {
    if (completedAssignments[assignment.id] === true) continue;
    const dueAt = new Date(assignment.dueAt);
    if (dueAt <= now || dueAt > end) continue;

    offsets.forEach((offsetMinutes) => {
      const notifyAt = new Date(dueAt.getTime() - offsetMinutes * 60 * 1000);
      if (notifyAt <= now || notifyAt >= dueAt) return;
      dates.push({ assignment, notifyAt, offsetMinutes });
    });
  }

  return dates.sort((left, right) => left.notifyAt.getTime() - right.notifyAt.getTime());
}

function AuthNavigator({
  stack,
  onPop,
  renderScreen,
}: {
  stack: AuthScreen[];
  onPop: () => void;
  renderScreen: (s: AuthScreen, goBack: () => void) => React.ReactNode;
}) {
  const { width: W } = useWindowDimensions();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const prevLen = useRef(stack.length);
  const wasPushRef = useRef(false);

  // useLayoutEffect fires before the native layer paints, so setValue(W) takes
  // effect before the entering screen is drawn — no single-frame flash at x=0.
  // useNativeDriver:false keeps animation on the JS thread so setValue is always
  // immediately reflected without bridge/native-driver sync issues.
  useLayoutEffect(() => {
    const prev = prevLen.current;
    prevLen.current = stack.length;
    if (stack.length > prev) {
      wasPushRef.current = true;
      slideAnim.setValue(W);
    }
  }, [stack.length]);

  useEffect(() => {
    if (wasPushRef.current) {
      wasPushRef.current = false;
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: false, ...MOTION.spring.screen }).start();
    }
  }, [stack.length]);

  const goBack = () => {
    Animated.timing(slideAnim, { toValue: W, duration: MOTION.duration.screen, easing: MOTION.easing.standard, useNativeDriver: false }).start(() => {
      slideAnim.setValue(0);
      onPop();
    });
  };

  const swipePan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) => gs.dx > 6 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
    onPanResponderMove: (_, gs) => { if (gs.dx > 0) slideAnim.setValue(gs.dx); },
    onPanResponderRelease: (_, gs) => {
      if (gs.dx > W * 0.35 || gs.vx > 0.6) {
        goBack();
      } else {
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: false, ...MOTION.spring.screen }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: false, ...MOTION.spring.screen }).start();
    },
  })).current;

  return (
    <View style={StyleSheet.absoluteFill}>
      {stack.map((screen, index) => {
        const isTop = index === stack.length - 1;
        const key = `${index}-${screen}`;
        return (
          <Animated.View
            key={key}
            style={[
              StyleSheet.absoluteFill,
              isTop && stack.length > 1 ? { transform: [{ translateX: slideAnim }] } : undefined,
            ]}
            {...(isTop && stack.length > 1 ? swipePan.panHandlers : {})}
          >
            {renderScreen(screen, goBack)}
          </Animated.View>
        );
      })}
    </View>
  );
}

function AppContent({ themePreference, onThemeChange }: AppContentProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const compactTabs = windowWidth < 390;
  const tinyTabs = windowWidth < 350;
  const tabHorizontalMargin = tinyTabs ? 8 : compactTabs ? 12 : 16;
  const tabOuterRadius = compactTabs ? 24 : 28;
  const tabInnerHorizontalPadding = tinyTabs ? 5 : compactTabs ? 7 : 10;
  const tabInnerVerticalPadding = tinyTabs ? 3 : compactTabs ? 4 : 5;
  const tabItemVerticalPadding = tinyTabs ? 5 : compactTabs ? 6 : 7;
  const tabItemHorizontalPadding = tinyTabs ? 1 : compactTabs ? 2 : 4;
  const tabIconSize = tinyTabs ? 18 : compactTabs ? 19 : 20;
  const tabLabelFontSize = tinyTabs ? 8.8 : compactTabs ? 9.4 : 10;
  const tabLabelTopMargin = tinyTabs ? 1 : 2;
  const tabPillRadius = compactTabs ? 16 : 19;
  const androidNavigationInset = Platform.OS === 'android' ? Math.max(insets.bottom, 24) : insets.bottom;
  const appBottomInset = Platform.OS === 'android' ? androidNavigationInset + (compactTabs ? 14 : 10) : insets.bottom;
  const tabBarBottomOffset = Platform.OS === 'android'
    ? androidNavigationInset + (compactTabs ? 12 : 10)
    : Math.max(insets.bottom - 6, 8);
  const availableTabWidth = Math.max(0, windowWidth - tabHorizontalMargin * 2);
  const tabSlotWidth = availableTabWidth / 5;
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [authInitializing, setAuthInitializing] = useState(true);
  const [userBootstrapLoading, setUserBootstrapLoading] = useState(false);
  const [userBootstrapSettled, setUserBootstrapSettled] = useState(false);
  const [userBootstrapRequestId, setUserBootstrapRequestId] = useState(0);
  // Ref so the onAuthStateChange closure (created once) always sees current userId.
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = userId;
  const returnToUniversityAfterSignOutRef = useRef(false);
  const suppressNextSignedOutClearRef = useRef(false);
  const pendingAuthUniversityRef = useRef<University | null>(null);

  const requestUserBootstrap = () => {
    setUserBootstrapSettled(false);
    setUserBootstrapLoading(true);
    setUserBootstrapRequestId((value) => value + 1);
  };

  const hydrateUserFromSession = (sessionUser: { id: string; email?: string | null; user_metadata?: Record<string, any> }) => {
    const email = sessionUser.email ?? '';
    requestUserBootstrap();
    setUserId(sessionUser.id);
    setUserEmail(email);
    const metadataSchool =
      typeof sessionUser.user_metadata?.classmate_school === 'string'
        ? sessionUser.user_metadata.classmate_school
        : DEFAULT_UNIVERSITY.name;
    const school = pendingAuthUniversityRef.current?.name ?? metadataSchool;
    const hydratedUniversity = universityForName(school);
    setSelectedUniversity(hydratedUniversity);
    setSelectedQuarter(getAcademicTermForDate(hydratedUniversity.name, new Date()));
  };

  const clearSignedOutState = () => {
    pendingAuthUniversityRef.current = null;
    setUserId(null);
    setUserEmail('');
    setSelectedUniversity(null);
    setExpoPushToken(null);
    setUnreadMessageCount(0);
    profileDetailsRef.current = {};
    setUserProfile(fallbackProfileFromEmail(`student${DEFAULT_UNIVERSITY.domain}`));
    setUserSettings(DEFAULT_USER_SETTINGS);
    setTimetableSettings(DEFAULT_TIMETABLE_SETTINGS);
    setTimetables([]);
    setSelectedTimetableId(null);
    setShowSettings(false);
    setCurrentTab('home');
    setNeedsProfileSetup(false);
    setNeedsFeatureOnboarding(false);
    setShowNotificationPermissionPrompt(false);
    setShowBrandIntro(false);
    setSavingOnboarding(false);
    setForceReviewOnboardingOnce(false);
    setDeletingAccount(false);
    setUserBootstrapRequestId(0);
    setUserBootstrapLoading(false);
    setUserBootstrapSettled(false);
    setAuthStack(returnToUniversityAfterSignOutRef.current ? ['welcome', 'university'] : ['welcome']);
    returnToUniversityAfterSignOutRef.current = false;
  };

  const validateAndHydrateSession = async (
    sessionUser: { id: string; email?: string | null; user_metadata?: Record<string, any> },
    active = true
  ) => {
    let verifiedUser: typeof sessionUser | null = null;
    let error: unknown = null;
    try {
      const result = await withTimeout(supabase.auth.getUser(), AUTH_VALIDATION_TIMEOUT_MS, 'auth session validation');
      verifiedUser = result.data.user;
      error = result.error;
    } catch (caught) {
      error = caught;
    }
    if (!active) return;

    if (error || !verifiedUser || verifiedUser.id !== sessionUser.id) {
      await supabase.auth.signOut();
      clearSignedOutState();
      setAuthInitializing(false);
      return;
    }

    hydrateUserFromSession(verifiedUser);
    setAuthInitializing(false);
  };

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;

      if (error) {
        console.warn('Failed to restore auth session:', error);
        setAuthInitializing(false);
        return;
      }

      const sessionUser = data.session?.user;
      if (sessionUser) {
        await validateAndHydrateSession(sessionUser, active);
        return;
      }
      setAuthInitializing(false);
    }

    void restoreSession();

    return () => {
      active = false;
    };
  }, []);

  // When Supabase internally clears a session (e.g. auto-refresh gets
  // "Invalid Refresh Token"), it fires SIGNED_OUT. Reset all app state so
  // the user lands back on the auth flow instead of seeing a broken session.
  // Guard: only act if the user was actually logged in — the sign-in flow calls
  // supabase.auth.signOut() before starting OAuth and we must not treat that as logout.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        void validateAndHydrateSession(session.user);
        return;
      }

      if (event === 'SIGNED_OUT' && suppressNextSignedOutClearRef.current) {
        suppressNextSignedOutClearRef.current = false;
        return;
      }

      if (event === 'SIGNED_OUT' && userIdRef.current !== null) {
        clearSignedOutState();
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<EditableProfile>(fallbackProfileFromEmail(`student${DEFAULT_UNIVERSITY.domain}`));
  const [userSettings, setUserSettings] = useState<UserSettingsState>(DEFAULT_USER_SETTINGS);
  const profileDetailsRef = useRef<Record<string, any>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingRegion, setSavingRegion] = useState(false);
  const [assignmentCalendarRevision, setAssignmentCalendarRevision] = useState(0);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [authStack, setAuthStack] = useState<AuthScreen[]>(['welcome']);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [needsFeatureOnboarding, setNeedsFeatureOnboarding] = useState(false);
  const [showNotificationPermissionPrompt, setShowNotificationPermissionPrompt] = useState(false);
  const [showBrandIntro, setShowBrandIntro] = useState(false);
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [forceReviewOnboardingOnce, setForceReviewOnboardingOnce] = useState(false);
  const pushAuth = (s: AuthScreen) => setAuthStack((prev) => prev[prev.length - 1] === s ? prev : [...prev, s]);
  const popAuth = () => setAuthStack((prev) => prev.length > 1 ? prev.slice(0, -1) : prev);
  const replaceAuth = (s: AuthScreen) =>
    setAuthStack((prev) => prev.length === 0 ? [s] : [...prev.slice(0, -1), s]);
  const handleAssignmentCalendarChange = useCallback(() => {
    setAssignmentCalendarRevision((revision) => revision + 1);
  }, []);
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);
  const [currentTab, setCurrentTab] = useState<MainTab>('home');
  const [homeTabTapCount, setHomeTabTapCount] = useState(0);
  const [timetableTabTapCount, setTimetableTabTapCount] = useState(0);
  const [gradesTabTapCount, setGradesTabTapCount] = useState(0);
  const [boardTabTapCount, setBoardTabTapCount] = useState(0);
  const [friendsTabTapCount, setFriendsTabTapCount] = useState(0);
  const [showMessages, setShowMessages] = useState(false);
  const [messageTarget, setMessageTarget] = useState<ChatTarget | null>(null);
  const [boardPostOpenRequest, setBoardPostOpenRequest] = useState<BoardPostOpenRequest | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [newBoardPostCount, setNewBoardPostCount] = useState(0);
  const [latestBoardPostCreatedAt, setLatestBoardPostCreatedAt] = useState<string | null>(null);

  const TABS = ['home', 'timetable', 'grades', 'board', 'friends'] as const;
  const tabBarRowRef = useRef<View>(null);
  const tabBarWidthRef = useRef(0);
  const tabBarPageXRef = useRef<number | null>(null);
  const [tabBarReady, setTabBarReady] = useState(false);
  const pillXAnim = useRef(new Animated.Value(0)).current;
  const pillScaleAnim = useRef(new Animated.Value(1)).current;
  const tabIconScaleAnims = useRef(TABS.map(() => new Animated.Value(1))).current;
  const isDraggingPill = useRef(false);
  const pillTouchStartX = useRef(0);
  const pillDragTouchOffsetX = useRef(0);
  const currentTabRef = useRef(currentTab);
  currentTabRef.current = currentTab;

  function triggerTabReset(tab: MainTab) {
    if (tab === 'home') setHomeTabTapCount(c => c + 1);
    else if (tab === 'timetable') setTimetableTabTapCount(c => c + 1);
    else if (tab === 'grades') setGradesTabTapCount(c => c + 1);
    else if (tab === 'board') setBoardTabTapCount(c => c + 1);
    else if (tab === 'friends') setFriendsTabTapCount(c => c + 1);

    setShowCoursePicker(false);
    setRenderCoursePicker(false);
    setEditingCustomCourse(null);
    setFocusedCourseId(null);
    setShowSettings(false);
    setShowMessages(false);
    setMessageTarget(null);
  }

  function shouldStartPillDrag(gs: PanResponderGestureState) {
    const horizontal = Math.abs(gs.dx);
    const vertical = Math.abs(gs.dy);
    return tabBarWidthRef.current > 0 && horizontal > 8 && horizontal > vertical * 1.2;
  }

  const pillPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) => shouldStartPillDrag(gs),
    onMoveShouldSetPanResponderCapture: (_, gs) => shouldStartPillDrag(gs),
    onPanResponderGrant: (evt, gs) => {
      const w = tabBarWidthRef.current;
      if (w <= 0) return;
      const tabW = w / 5;
      const currentX = (pillXAnim as any)._value ?? TABS.indexOf(currentTabRef.current) * tabW;
      const rawTouchX = tabBarPageXRef.current == null
        ? evt.nativeEvent.locationX - gs.dx
        : evt.nativeEvent.pageX - tabBarPageXRef.current - gs.dx;
      const touchX = Math.max(0, Math.min(w, rawTouchX));
      pillTouchStartX.current = touchX;
      // Drag offset: natural offset if pressing on current pill, centered otherwise
      const touchIsOnCurrentPill = touchX >= currentX && touchX <= currentX + tabW;
      pillDragTouchOffsetX.current = touchIsOnCurrentPill ? touchX - currentX : tabW / 2;
      isDraggingPill.current = true;
      triggerLightHaptic();
      Animated.spring(pillScaleAnim, { toValue: 1.12, useNativeDriver: false, ...MOTION.spring.press }).start();
    },
    onPanResponderMove: (_, gs) => {
      if (!isDraggingPill.current) return;
      const w = tabBarWidthRef.current;
      const tabW = w / 5;
      const touchX = pillTouchStartX.current + gs.dx;
      pillXAnim.setValue(Math.max(0, Math.min(w - tabW, touchX - pillDragTouchOffsetX.current)));
    },
    onPanResponderRelease: (_, gs) => {
      Animated.spring(pillScaleAnim, { toValue: 1, useNativeDriver: false, ...MOTION.spring.press }).start();
      if (isDraggingPill.current) {
        const tabW = tabBarWidthRef.current / 5;
        const nearestIdx = Math.max(0, Math.min(4, Math.round((pillXAnim as any)._value / tabW)));
        Animated.spring(pillXAnim, { toValue: nearestIdx * tabW, useNativeDriver: false, ...MOTION.spring.snap }).start();
        const newTab = TABS[nearestIdx];
        if (newTab !== currentTabRef.current) {
          triggerTabReset(newTab);
          triggerSelectionHaptic();
          if (newTab === 'friends') handleOpenFriendsTabRef.current?.();
          else (setCurrentTab as (t: typeof TABS[number]) => void)(newTab);
        }
      } else {
        const tabW = tabBarWidthRef.current / 5;
        Animated.spring(pillXAnim, { toValue: TABS.indexOf(currentTabRef.current) * tabW, useNativeDriver: false, ...MOTION.spring.snap }).start();
      }
      isDraggingPill.current = false;
    },
    onPanResponderTerminate: () => {
      isDraggingPill.current = false;
      const tabW = tabBarWidthRef.current / 5;
      Animated.spring(pillXAnim, { toValue: TABS.indexOf(currentTabRef.current) * tabW, useNativeDriver: false, ...MOTION.spring.snap }).start();
      Animated.spring(pillScaleAnim, { toValue: 1, useNativeDriver: false, ...MOTION.spring.press }).start();
    },
  })).current;

  useEffect(() => {
    if (!tabBarReady || isDraggingPill.current) return;
    const tabW = tabBarWidthRef.current / 5;
    Animated.spring(pillXAnim, { toValue: TABS.indexOf(currentTab) * tabW, useNativeDriver: false, ...MOTION.spring.snap }).start();
  }, [currentTab, tabBarReady]);
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [renderCoursePicker, setRenderCoursePicker] = useState(false);
  const [editingCustomCourse, setEditingCustomCourse] = useState<Course | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState<Quarter>(getAcademicTermForDate(DEFAULT_UNIVERSITY.name, new Date()));
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [selectedTimetableId, setSelectedTimetableId] = useState<string | null>(null);
  const [focusedCourseId, setFocusedCourseId] = useState<string | null>(null);
  const [timetableSettings, setTimetableSettings] = useState<TimetableSettings>(DEFAULT_TIMETABLE_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const settingsBackdropAnim = useRef(new Animated.Value(0)).current;
  const settingsSheetAnim = useRef(new Animated.Value(windowHeight)).current;
  const pickerTranslateY = useRef(new Animated.Value(windowHeight)).current;
  const seenFriendRequestIdsRef = useRef<Set<string>>(new Set());
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const seenCommentIdsRef = useRef<Set<string>>(new Set());
  const seenLikeKeysRef = useRef<Set<string>>(new Set());
  const lastSocialNotificationErrorRef = useRef(0);
  const currentSchool = selectedUniversity?.name ?? DEFAULT_UNIVERSITY.name;
  const schoolTimeZone = normalizeTimeZone(getSchoolConfig(currentSchool).timeZone);
  const effectiveTimeZone = normalizeTimeZone(userSettings.timeZone, schoolTimeZone);

  const activeKey = quarterKey(selectedQuarter);
  const quarterTimetables = timetables.filter((t) => t.quarterKey === activeKey);
  const activeTimetable = quarterTimetables.find((t) => t.id === selectedTimetableId) ?? quarterTimetables[0] ?? null;
  const activeCourses = activeTimetable?.courses ?? [];

  const academicQuarter = getAcademicTermForDate(currentSchool, new Date());
  const academicQuarterKey = quarterKey(academicQuarter);
  const homeQuarterKey = timetables.some((t) => t.quarterKey === academicQuarterKey) ? academicQuarterKey : activeKey;
  const homeQuarterTimetables = timetables.filter((t) => t.quarterKey === homeQuarterKey);
  const homeTimetable =
    homeQuarterTimetables.find((t) => t.name === 'My Schedule')
    ?? (homeQuarterKey === activeKey ? activeTimetable : null)
    ?? homeQuarterTimetables[0]
    ?? null;
  const homeQuarterCourses = homeTimetable?.courses ?? [];

  const USER_ID = userId ?? '';
  const displayUserName = buildDisplayName({ ...userProfile, email: userEmail || userProfile.email });

  const loadUnreadMessageCount = useCallback(async () => {
    if (!USER_ID) return 0;

    const { data: participantData, error: participantError } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', USER_ID);

    if (participantError) {
      if (participantError.code !== 'PGRST205') {
        console.warn('Failed to load unread message participants:', participantError);
      }
      return 0;
    }

    const participants = (participantData ?? []) as ConversationParticipantUnreadRow[];
    const conversationIds = participants.map((row) => row.conversation_id);
    if (conversationIds.length === 0) return 0;

    const { data: scopedConversationData, error: scopedConversationError } = await supabase
      .from('conversations')
      .select('id')
      .eq('school', currentSchool)
      .in('id', conversationIds);

    if (scopedConversationError) {
      if (scopedConversationError.code !== 'PGRST205') {
        console.warn('Failed to scope unread conversations:', scopedConversationError);
      }
      return 0;
    }

    const scopedConversationIds = ((scopedConversationData ?? []) as Array<{ id: string }>).map((row) => row.id);
    if (scopedConversationIds.length === 0) return 0;

    const { data: messageData, error: messageError } = await supabase
      .from('conversation_messages')
      .select('id, conversation_id, sender_id, created_at, deleted_at')
      .in('conversation_id', scopedConversationIds)
      .neq('sender_id', USER_ID)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(500);

    if (messageError) {
      if (messageError.code !== 'PGRST205') {
        console.warn('Failed to load unread messages:', messageError);
      }
      return 0;
    }

    const lastReadByConversation = Object.fromEntries(
      participants
        .filter((row) => scopedConversationIds.includes(row.conversation_id))
        .map((row) => [row.conversation_id, row.last_read_at])
    );

    return ((messageData ?? []) as ConversationUnreadMessageRow[]).filter((message) => {
      const lastReadAt = lastReadByConversation[message.conversation_id];
      return !lastReadAt || new Date(message.created_at) > new Date(lastReadAt);
    }).length;
  }, [USER_ID, currentSchool]);

  useEffect(() => {
    if (!USER_ID) {
      setUnreadMessageCount(0);
      return;
    }

    let cancelled = false;
    let startupTimer: ReturnType<typeof setTimeout> | null = null;

    const refreshUnreadMessages = async () => {
      const count = await loadUnreadMessageCount();
      if (!cancelled) setUnreadMessageCount(count);
    };

    startupTimer = setTimeout(() => {
      void refreshUnreadMessages();
    }, MESSAGE_BADGE_INITIAL_DELAY_MS);
    const interval = setInterval(() => {
      void refreshUnreadMessages();
    }, MESSAGE_BADGE_REFRESH_INTERVAL_MS);

    const channel = supabase
      .channel(`message-badge:${USER_ID}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversation_messages' },
        () => {
          void refreshUnreadMessages();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_messages' },
        () => {
          void refreshUnreadMessages();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${USER_ID}` },
        () => {
          void refreshUnreadMessages();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (startupTimer) clearTimeout(startupTimer);
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [USER_ID, loadUnreadMessageCount]);

  const boardLastSeenKey = useCallback(() => {
    if (!USER_ID) return null;
    return `board_last_seen_${currentSchool}_${USER_ID}`;
  }, [USER_ID, currentSchool]);

  const loadNewBoardPostSnapshot = useCallback(async () => {
    if (!USER_ID) return { count: 0, latestCreatedAt: null as string | null };

    const { data, error } = await supabase
      .from('posts')
      .select('id, created_at')
      .eq('school', currentSchool)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      if (error.code !== 'PGRST205') {
        console.warn('Failed to load new board post badge:', error);
      }
      return { count: 0, latestCreatedAt: null as string | null };
    }

    const rows = (data ?? []) as BoardPostTimestampRow[];
    const latestCreatedAt = rows[0]?.created_at ?? null;
    if (!latestCreatedAt) return { count: 0, latestCreatedAt: null as string | null };

    const storageKey = boardLastSeenKey();
    if (!storageKey) return { count: 0, latestCreatedAt };

    let lastSeenAt: string | null = null;
    try {
      lastSeenAt = await AsyncStorage.getItem(storageKey);
    } catch (storageError) {
      console.warn('Failed to read board last-seen marker:', storageError);
    }

    if (!lastSeenAt) {
      try {
        await AsyncStorage.setItem(storageKey, latestCreatedAt);
      } catch (storageError) {
        console.warn('Failed to seed board last-seen marker:', storageError);
      }
      return { count: 0, latestCreatedAt };
    }

    const lastSeenTime = new Date(lastSeenAt).getTime();
    const count = rows.filter((post) => new Date(post.created_at).getTime() > lastSeenTime).length;
    return { count, latestCreatedAt };
  }, [USER_ID, boardLastSeenKey, currentSchool]);

  const markBoardPostsSeen = useCallback(async () => {
    const storageKey = boardLastSeenKey();
    if (!storageKey || !latestBoardPostCreatedAt) return;
    try {
      await AsyncStorage.setItem(storageKey, latestBoardPostCreatedAt);
      setNewBoardPostCount(0);
    } catch (storageError) {
      console.warn('Failed to update board last-seen marker:', storageError);
    }
  }, [boardLastSeenKey, latestBoardPostCreatedAt]);

  useEffect(() => {
    if (!USER_ID) {
      setNewBoardPostCount(0);
      setLatestBoardPostCreatedAt(null);
      return;
    }

    let cancelled = false;
    let startupTimer: ReturnType<typeof setTimeout> | null = null;

    const refreshNewBoardPosts = async () => {
      const snapshot = await loadNewBoardPostSnapshot();
      if (!cancelled) {
        setNewBoardPostCount(snapshot.count);
        setLatestBoardPostCreatedAt(snapshot.latestCreatedAt);
      }
    };

    startupTimer = setTimeout(() => {
      void refreshNewBoardPosts();
    }, BOARD_BADGE_INITIAL_DELAY_MS);
    const interval = setInterval(() => {
      void refreshNewBoardPosts();
    }, BOARD_BADGE_REFRESH_INTERVAL_MS);

    const channel = supabase
      .channel(`board-badge:${USER_ID}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        () => {
          void refreshNewBoardPosts();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (startupTimer) clearTimeout(startupTimer);
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [USER_ID, loadNewBoardPostSnapshot]);

  useEffect(() => {
    if (currentTab === 'board' && newBoardPostCount > 0) {
      void markBoardPostsSeen();
    }
  }, [currentTab, markBoardPostsSeen, newBoardPostCount]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      void Notifications.setNotificationChannelAsync('reminders', {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setUserBootstrapSettled(false);
      return;
    }

    let active = true;

    async function loadUserPreferences() {
      setUserBootstrapSettled(false);
      setUserBootstrapLoading(true);
      const fallback = fallbackProfileFromEmail(userEmail || `student${DEFAULT_UNIVERSITY.domain}`);
      let settingsDetails: Record<string, any> | null | undefined;
      const themeStorageKey = scopedPreferenceStorageKey('theme_preference', currentSchool, userId);
      const timetableSettingsStorageKey = scopedPreferenceStorageKey('timetable_settings', currentSchool, userId);

      try {
        let cachedThemePreference: ThemePreference | null = null;
        try {
          cachedThemePreference = normalizeThemePreference(await AsyncStorage.getItem(themeStorageKey));
        } catch (error) {
          console.warn('Failed to load cached theme preference:', error);
        }
        if (!active) return;
        if (cachedThemePreference) {
          onThemeChange(cachedThemePreference);
        }

        const { data: profileRow, error: profileError } = await withTimeout(
          supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .eq('school', currentSchool)
            .maybeSingle(),
          USER_BOOTSTRAP_TIMEOUT_MS,
          'profile bootstrap'
        );

        if (profileError) {
          console.warn('Failed to load profile:', profileError);
        }

        const { data: settingsRow, error: settingsError } = await withTimeout(
          supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle(),
          USER_BOOTSTRAP_TIMEOUT_MS,
          'settings bootstrap'
        );

        if (settingsError && settingsError.code !== 'PGRST205') {
          console.warn('Failed to load user settings:', settingsError);
        }

        if (!active) return;

        settingsDetails =
          (settingsRow as Record<string, any> | null | undefined)?.profile_details as Record<string, any> | null | undefined;
        profileDetailsRef.current = settingsDetails && typeof settingsDetails === 'object' ? { ...settingsDetails } : {};
        const forceFeatureOnboarding = forceReviewOnboardingOnce && isReviewAccountEmail(userEmail);
        const storedThemePreference = normalizeThemePreference(settingsDetails?.themePreference)
          ?? cachedThemePreference;
        if (storedThemePreference) {
          onThemeChange(storedThemePreference);
          void AsyncStorage.setItem(themeStorageKey, storedThemePreference);
        }
        const storedTimetableSettings = normalizeTimetableSettings(settingsDetails?.timetableSettings)
          ?? await readStoredTimetableSettings(timetableSettingsStorageKey);
        if (storedTimetableSettings) {
          setTimetableSettings(storedTimetableSettings);
          void AsyncStorage.setItem(timetableSettingsStorageKey, JSON.stringify(storedTimetableSettings));
        } else {
          setTimetableSettings(DEFAULT_TIMETABLE_SETTINGS);
        }

        setUserProfile(
          profileFromSources(
            (profileRow as Record<string, any> | null | undefined) ?? null,
            userEmail || fallback.email,
            settingsDetails
          )
        );
        setNeedsProfileSetup(false);

        if (!profileRow && !settingsRow) {
          setNeedsFeatureOnboarding(true);
          setShowNotificationPermissionPrompt(false);
        } else if (!settingsRow) {
          setNeedsFeatureOnboarding(true);
          setShowNotificationPermissionPrompt(false);
        } else if (settingsDetails?.profileSetupComplete === false) {
          setNeedsFeatureOnboarding(true);
          setShowNotificationPermissionPrompt(false);
        } else if (hasCompletedProfileSetup(settingsDetails)) {
          if (forceFeatureOnboarding || needsInitialOnboarding(settingsDetails)) {
            setNeedsFeatureOnboarding(true);
            setShowNotificationPermissionPrompt(false);
          } else {
            setNeedsFeatureOnboarding(false);
            setShowNotificationPermissionPrompt(false);
          }
        }

        setUserSettings({
          timetableVisibility: ((settingsRow as Record<string, any> | null | undefined)?.timetable_visibility as TimetableVisibility | undefined) ?? DEFAULT_USER_SETTINGS.timetableVisibility,
          boardProfileVisible: settingsDetails?.boardProfileVisible === true,
          notifications: {
            ...DEFAULT_NOTIFICATION_PREFERENCES,
            ...(((settingsRow as Record<string, any> | null | undefined)?.notification_settings as NotificationPreferences | undefined) ?? {}),
            messages: true,
          },
          pushPermissionStatus: ((settingsRow as Record<string, any> | null | undefined)?.push_permission_status as PushPermissionStatus | undefined) ?? DEFAULT_USER_SETTINGS.pushPermissionStatus,
          language: normalizeLanguagePreference(settingsDetails?.language),
          timeZone: normalizeTimeZone(settingsDetails?.timeZone, getSchoolConfig(currentSchool).timeZone),
          dateFormat: normalizeDateFormatPreference(settingsDetails?.dateFormat),
        });
        setExpoPushToken(((settingsRow as Record<string, any> | null | undefined)?.expo_push_token as string | undefined) ?? null);
      } catch (error) {
        console.warn('Failed to bootstrap user preferences:', error);
        if (!active) return;
        profileDetailsRef.current = {};
        setUserProfile(fallback);
        setUserSettings({
          ...DEFAULT_USER_SETTINGS,
          timeZone: normalizeTimeZone(getSchoolConfig(currentSchool).timeZone),
        });
        setExpoPushToken(null);
        setNeedsProfileSetup(false);
        setNeedsFeatureOnboarding(false);
        setShowNotificationPermissionPrompt(false);
      } finally {
        if (active) {
          pendingAuthUniversityRef.current = null;
          setUserBootstrapLoading(false);
          setUserBootstrapSettled(true);
        }
      }
    }

    loadUserPreferences();

    return () => {
      active = false;
    };
  }, [currentSchool, forceReviewOnboardingOnce, userBootstrapRequestId, userEmail, userId]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let bootstrapTimerId: ReturnType<typeof setTimeout> | null = null;

    const buildLikeKey = (like: LikeNotificationRow) => `${like.target_type}:${like.target_id}:${like.user_id}`;
    const notificationEnabled =
      userSettings.notifications.pushNotifications && userSettings.pushPermissionStatus === 'granted';

    if (!notificationEnabled) return;

    function logSocialNotificationError(label: string, error: unknown) {
      const now = Date.now();
      if (isMissingSchoolColumnError(error)) {
        return;
      }
      if (isNetworkRequestError(error)) {
        if (now - lastSocialNotificationErrorRef.current < 60000) return;
        lastSocialNotificationErrorRef.current = now;
        console.warn(`${label}: network unavailable, will retry quietly.`);
        return;
      }
      console.warn(label, error);
    }

    function logSnapshotQueryError(label: string, error: unknown) {
      if (!error) return;
      logSocialNotificationError(label, error);
    }

    async function presentInAppNotification(title: string, body: string, data: Record<string, string>) {
      if (!notificationEnabled) return;
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data,
            sound: true,
            ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
          },
          trigger: null,
        });
      } catch (error) {
        console.warn('Failed to present in-app notification:', error);
      }
    }

    async function loadSocialNotificationSnapshot(): Promise<SocialNotificationSnapshot> {
      const [
        { data: friendRequestData, error: friendRequestError },
        { data: myPosts, error: postsError },
        { data: myComments, error: myCommentsError },
      ] = await Promise.all([
        supabase
          .from('friend_requests')
          .select('id, sender_id, receiver_id, status, created_at')
          .eq('school', currentSchool)
          .eq('receiver_id', userId)
          .eq('status', 'pending')
          .order('created_at', { ascending: true }),
        supabase
          .from('posts')
          .select('id, title')
          .eq('user_id', userId)
          .eq('school', currentSchool),
        supabase
          .from('post_comments')
          .select('id, post_id')
          .eq('school', currentSchool)
          .eq('user_id', userId),
      ]);

      logSnapshotQueryError('Failed to load friend request notifications:', friendRequestError);
      logSnapshotQueryError('Failed to load post ids for notifications:', postsError);
      logSnapshotQueryError('Failed to load my comment ids for notifications:', myCommentsError);

      let messageRows: ConversationMessageNotificationRow[] = [];
      const { data: myConversationRows, error: myConversationError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId);

      if (myConversationError) {
        if (myConversationError.code !== 'PGRST205') {
          logSnapshotQueryError('Failed to load conversation notification participants:', myConversationError);
        }
      } else {
        const conversationIds = ((myConversationRows ?? []) as Array<{ conversation_id: string }>)
          .map((row) => row.conversation_id);

        if (conversationIds.length > 0) {
          const { data: scopedConversations, error: scopedConversationError } = await supabase
            .from('conversations')
            .select('id')
            .eq('school', currentSchool)
            .in('id', conversationIds);

          if (scopedConversationError) {
            if (scopedConversationError.code !== 'PGRST205') {
              logSnapshotQueryError('Failed to scope message notifications:', scopedConversationError);
            }
          }
          const scopedConversationIds = ((scopedConversations ?? []) as Array<{ id: string }>).map((row) => row.id);
          if (scopedConversationIds.length === 0) {
            messageRows = [];
          } else {
          const { data: messageData, error: messageError } = await supabase
            .from('conversation_messages')
            .select('id, conversation_id, sender_id, content, created_at')
            .in('conversation_id', scopedConversationIds)
            .neq('sender_id', userId)
            .order('created_at', { ascending: false })
            .limit(100);

          if (messageError) {
            if (messageError.code !== 'PGRST205') {
              logSnapshotQueryError('Failed to load message notifications:', messageError);
            }
          } else {
            messageRows = ((messageData ?? []) as ConversationMessageNotificationRow[]).reverse();
          }
          }
        }
      }

      const postRows = (myPosts ?? []) as Array<{ id: string; title: string }>;
      const postIds = postRows.map((post) => post.id);
      const postTitlesById = Object.fromEntries(postRows.map((post) => [post.id, post.title]));
      const rawMyCommentRows = (myComments ?? []) as Array<{ id: string; post_id: string }>;
      const schoolPostIdsForComments = new Set(postIds);
      const commentedPostIds = Array.from(new Set(rawMyCommentRows.map((comment) => comment.post_id)))
        .filter((postId) => !schoolPostIdsForComments.has(postId));
      if (commentedPostIds.length > 0) {
        const { data: commentedPosts, error: commentedPostsError } = await supabase
          .from('posts')
          .select('id')
          .eq('school', currentSchool)
          .in('id', commentedPostIds);
        logSnapshotQueryError('Failed to scope comment notifications by school:', commentedPostsError);
        ((commentedPosts ?? []) as Array<{ id: string }>).forEach((post) => schoolPostIdsForComments.add(post.id));
      }
      const myCommentRows = rawMyCommentRows.filter((comment) => schoolPostIdsForComments.has(comment.post_id));
      const myCommentIds = new Set(myCommentRows.map((comment) => comment.id));
      const myCommentIdList = Array.from(myCommentIds);

      if (postIds.length === 0 && myCommentIdList.length === 0) {
        return {
          friendRequests: (friendRequestData ?? []) as FriendRequestNotificationRow[],
          messages: messageRows,
          comments: [],
          likes: [],
          postTitlesById,
          myCommentIds,
        };
      }

      const commentQueries: any[] = [];
      if (postIds.length > 0) {
        commentQueries.push(
          supabase
            .from('post_comments')
            .select('id, post_id, user_id, content, created_at, parent_comment_id')
            .eq('school', currentSchool)
            .in('post_id', postIds)
            .neq('user_id', userId)
            .order('created_at', { ascending: true })
            .limit(100)
        );
      }
      if (myCommentIdList.length > 0) {
        commentQueries.push(
          supabase
            .from('post_comments')
            .select('id, post_id, user_id, content, created_at, parent_comment_id')
            .eq('school', currentSchool)
            .in('parent_comment_id', myCommentIdList)
            .neq('user_id', userId)
            .order('created_at', { ascending: true })
            .limit(100)
        );
      }

      const commentResults = await Promise.all(commentQueries);
      const mergedComments = new Map<string, CommentNotificationRow>();
      commentResults.forEach(({ data, error }) => {
        if (error) {
          logSnapshotQueryError('Failed to load comment notifications:', error);
          return;
        }
        ((data ?? []) as CommentNotificationRow[]).forEach((row) => mergedComments.set(row.id, row));
      });

      const likeQueries: any[] = [];
      if (postIds.length > 0) {
        likeQueries.push(
          supabase
            .from('post_votes')
            .select('post_id, user_id')
            .eq('school', currentSchool)
            .in('post_id', postIds)
            .neq('user_id', userId)
        );
      }
      if (myCommentIdList.length > 0) {
        likeQueries.push(
          supabase
            .from('post_comment_votes')
            .select('comment_id, user_id')
            .eq('school', currentSchool)
            .in('comment_id', myCommentIdList)
            .neq('user_id', userId)
        );
      }

      const likeResults = await Promise.all(likeQueries);
      const mergedLikes = new Map<string, LikeNotificationRow>();
      likeResults.forEach(({ data, error }, index) => {
        if (error) {
          logSnapshotQueryError('Failed to load like notifications:', error);
          return;
        }

        if (index === 0 && postIds.length > 0) {
          ((data ?? []) as Array<{ post_id: string; user_id: string }>).forEach((row) => {
            const key = `post:${row.post_id}:${row.user_id}`;
            mergedLikes.set(key, {
              target_type: 'post',
              target_id: row.post_id,
              post_id: row.post_id,
              user_id: row.user_id,
            });
          });
          return;
        }

        ((data ?? []) as Array<{ comment_id: string; user_id: string }>).forEach((row) => {
          const key = `comment:${row.comment_id}:${row.user_id}`;
          mergedLikes.set(key, {
            target_type: 'comment',
            target_id: row.comment_id,
            comment_id: row.comment_id,
            user_id: row.user_id,
          });
        });
      });

      return {
        friendRequests: (friendRequestData ?? []) as FriendRequestNotificationRow[],
        messages: messageRows,
        comments: Array.from(mergedComments.values()).sort((a, b) => (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )),
        likes: Array.from(mergedLikes.values()),
        postTitlesById,
        myCommentIds,
      };
    }

    async function bootstrapSocialNotificationState() {
      let snapshot: SocialNotificationSnapshot;
      try {
        snapshot = await loadSocialNotificationSnapshot();
      } catch (error) {
        logSocialNotificationError('Failed to bootstrap social notifications:', error);
        return;
      }
      if (cancelled) return;

      seenFriendRequestIdsRef.current = new Set(snapshot.friendRequests.map((request) => request.id));
      seenMessageIdsRef.current = new Set(snapshot.messages.map((message) => message.id));
      seenCommentIdsRef.current = new Set(snapshot.comments.map((comment) => comment.id));
      seenLikeKeysRef.current = new Set(snapshot.likes.map(buildLikeKey));
    }

    async function pollSocialNotifications() {
      let snapshot: SocialNotificationSnapshot;
      try {
        snapshot = await loadSocialNotificationSnapshot();
      } catch (error) {
        logSocialNotificationError('Failed to poll social notifications:', error);
        return;
      }
      if (cancelled) return;

      const previousFriendRequestIds = seenFriendRequestIdsRef.current;
      const previousMessageIds = seenMessageIdsRef.current;
      const previousCommentIds = seenCommentIdsRef.current;
      const previousLikeKeys = seenLikeKeysRef.current;

      if (userSettings.notifications.friendRequests) {
        for (const request of snapshot.friendRequests) {
          if (!previousFriendRequestIds.has(request.id)) {
            await presentInAppNotification(
              'New friend request',
              'Someone wants to connect with you on ClassMate.',
              { type: 'friend-request', requestId: request.id }
            );
          }
        }
      }

      if (userSettings.notifications.messages) {
        for (const message of snapshot.messages) {
          if (!previousMessageIds.has(message.id)) {
            await presentInAppNotification(
              'New message',
              truncateNotificationText(message.content || 'Open Messages to read it.'),
              {
                type: 'conversation-message',
                messageId: message.id,
                conversationId: message.conversation_id,
                senderId: message.sender_id,
              }
            );
          }
        }
      }

      if (userSettings.notifications.comments) {
        for (const comment of snapshot.comments) {
          if (!previousCommentIds.has(comment.id)) {
            const postTitle = snapshot.postTitlesById[comment.post_id];
            await presentInAppNotification(
              comment.parent_comment_id && snapshot.myCommentIds.has(comment.parent_comment_id)
                ? 'New reply to your comment'
                : 'New comment on your post',
              comment.parent_comment_id && snapshot.myCommentIds.has(comment.parent_comment_id)
                ? 'Someone replied to one of your board comments.'
                : postTitle
                  ? `Someone commented on "${truncateNotificationText(postTitle, 40)}".`
                  : 'Someone commented on your board post.',
              { type: 'post-comment', commentId: comment.id, postId: comment.post_id }
            );
          }
        }
      }

      if (userSettings.notifications.likes) {
        for (const like of snapshot.likes) {
          const likeKey = buildLikeKey(like);
          if (!previousLikeKeys.has(likeKey)) {
            const postTitle = like.post_id ? snapshot.postTitlesById[like.post_id] : null;
            await presentInAppNotification(
              like.target_type === 'comment' ? 'New like on your comment' : 'New like on your post',
              like.target_type === 'comment'
                ? 'Someone liked one of your board comments.'
                : postTitle
                  ? `Someone liked "${truncateNotificationText(postTitle, 40)}".`
                  : 'Someone liked your board post.',
              {
                type: like.target_type === 'comment' ? 'comment-like' : 'post-like',
                targetId: like.target_id,
                actorId: like.user_id,
              }
            );
          }
        }
      }

      seenFriendRequestIdsRef.current = new Set(snapshot.friendRequests.map((request) => request.id));
      seenMessageIdsRef.current = new Set(snapshot.messages.map((message) => message.id));
      seenCommentIdsRef.current = new Set(snapshot.comments.map((comment) => comment.id));
      seenLikeKeysRef.current = new Set(snapshot.likes.map(buildLikeKey));
    }

    bootstrapTimerId = setTimeout(() => {
      void bootstrapSocialNotificationState().then(() => {
        if (cancelled) return;
        intervalId = setInterval(() => {
          void pollSocialNotifications();
        }, SOCIAL_NOTIFICATION_REFRESH_INTERVAL_MS);
      });
    }, SOCIAL_NOTIFICATION_BOOTSTRAP_DELAY_MS);

    return () => {
      cancelled = true;
      if (bootstrapTimerId) clearTimeout(bootstrapTimerId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentSchool, userId, userSettings.notifications, userSettings.pushPermissionStatus]);

  useEffect(() => {
    if (!userId) return;

    const reminderUserId = userId;
    let cancelled = false;
    let rescheduleTimerId: ReturnType<typeof setTimeout> | null = null;

    async function rescheduleReminderNotifications() {
      await cancelScheduledClassMateReminders(reminderUserId, currentSchool);

      const notifications = userSettings.notifications;
      if (!notifications.pushNotifications || userSettings.pushPermissionStatus !== 'granted') return;

      const selectedQuarterKey = quarterKey(selectedQuarter);
      const currentQuarter = getAcademicTermForDate(currentSchool, new Date());
      const quarterMatchesCurrent =
        currentQuarter.year === selectedQuarter.year && currentQuarter.quarter === selectedQuarter.quarter;

      if (notifications.dailyScheduleSummary && quarterMatchesCurrent) {
	        const dailySummaries = buildDailyScheduleSummaryDates(
	          activeCourses,
	          effectiveTimeZone,
	          14,
	          normalizeDailyScheduleSummaryHour(notifications.dailyScheduleSummaryHour)
	        );
        for (const summary of dailySummaries) {
          if (cancelled) return;
          const classCount = summary.courses.length;
          const summaryTitle = classCount === 1 ? 'You have 1 class today' : `You have ${classCount} classes today`;
          const summaryBody = buildDailyScheduleNotificationBody(summary.courses);

          await Notifications.scheduleNotificationAsync({
            identifier: reminderNotificationIdentifier(reminderUserId, currentSchool, 'daily-summary', [
              selectedQuarterKey,
              summary.notifyAt.toISOString(),
            ]),
            content: {
              title: summaryTitle,
              body: summaryBody,
              data: { type: 'daily-schedule-summary', count: String(classCount), school: currentSchool, quarterKey: selectedQuarterKey },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: summary.notifyAt,
            },
          });
        }
      }

      if (notifications.classReminders && quarterMatchesCurrent) {
	        const classReminders = buildUpcomingClassReminderDates(activeCourses, notifications.classReminderMinutes, effectiveTimeZone);
        for (const reminder of classReminders) {
          if (cancelled) return;
          await Notifications.scheduleNotificationAsync({
            identifier: reminderNotificationIdentifier(reminderUserId, currentSchool, 'class', [
              selectedQuarterKey,
              reminder.course.id,
              reminder.notifyAt.toISOString(),
            ]),
            content: {
              title: `${reminder.course.code} starts soon`,
              body: `${reminder.course.title} begins in ${notifications.classReminderMinutes} minutes${reminder.course.location ? ` at ${reminder.course.location}` : ''}.`,
              data: { type: 'class-reminder', courseId: reminder.course.id, school: currentSchool, quarterKey: selectedQuarterKey },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: reminder.notifyAt,
            },
          });
        }
      }

      if (notifications.assignmentReminders) {
        const assignmentTasksStorageKey = userScopedStorageKey('assignment_calendar_tasks_cache', reminderUserId);
        const assignmentCompletedStorageKey = userScopedStorageKey('assignment_calendar_completed', reminderUserId);
        const legacyAssignmentTasksStorageKey = userScopedStorageKey('canvas_assignments_cache', reminderUserId);
        const legacyAssignmentCompletedStorageKey = userScopedStorageKey('canvas_assignments_completed', reminderUserId);
        const [
          storedAssignmentTasks,
          storedCompletedAssignments,
          legacyAssignmentTasks,
          legacyCompletedAssignments,
        ] = await AsyncStorage.multiGet([
          assignmentTasksStorageKey,
          assignmentCompletedStorageKey,
          legacyAssignmentTasksStorageKey,
          legacyAssignmentCompletedStorageKey,
        ]).then((entries) => entries.map(([, value]) => value));

        if (cancelled) return;
        const assignmentTasks = parseStoredAssignmentTasks(storedAssignmentTasks ?? legacyAssignmentTasks);
        const completedAssignments = parseStoredCompletedAssignments(storedCompletedAssignments ?? legacyCompletedAssignments);
        const assignmentReminders = buildUpcomingAssignmentReminderDates(
          assignmentTasks,
          completedAssignments,
          notifications.assignmentReminderOffsets
        );

        for (const reminder of assignmentReminders) {
          if (cancelled) return;
          const offsetLabel = formatAssignmentReminderOffset(reminder.offsetMinutes);
          const courseLabel = reminder.assignment.courseCode ? `${reminder.assignment.courseCode}: ` : '';
          await Notifications.scheduleNotificationAsync({
            identifier: reminderNotificationIdentifier(reminderUserId, currentSchool, 'assignment', [
              reminder.assignment.id,
              reminder.offsetMinutes,
              reminder.notifyAt.toISOString(),
            ]),
            content: {
              title: `Assignment due in ${offsetLabel}`,
              body: truncateNotificationText(`${courseLabel}${reminder.assignment.title}`, 178),
              data: { type: 'assignment-reminder', assignmentId: reminder.assignment.id, school: currentSchool },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: reminder.notifyAt,
            },
          });
        }
      }

      if (notifications.sportsGameReminders && schoolFeatureEnabled(currentSchool, 'sports')) {
        try {
          const events = await fetchSportsEventsForSchool(currentSchool, { maxDaysAhead: 14, includePastDays: 0 });

          for (const event of events) {
            if (cancelled) return;
            const notifyAt = new Date(event.date.getTime() - notifications.sportsGameReminderMinutes * 60 * 1000);
            if (notifyAt <= new Date()) continue;

            await Notifications.scheduleNotificationAsync({
              identifier: reminderNotificationIdentifier(reminderUserId, currentSchool, 'sports', [
                event.id,
                notifyAt.toISOString(),
              ]),
              content: {
                title: `${event.sport} game reminder`,
                body: `${event.title} starts in ${notifications.sportsGameReminderMinutes} minutes${event.location ? ` at ${event.location}` : ''}.`,
                data: { type: 'sports-reminder', eventId: event.id, school: currentSchool },
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: notifyAt,
              },
            });
          }
        } catch (error) {
          console.warn('Failed to schedule sports reminders:', error);
        }
      }
    }

    rescheduleTimerId = setTimeout(() => {
      void rescheduleReminderNotifications();
    }, REMINDER_RESCHEDULE_DELAY_MS);

    return () => {
      cancelled = true;
      if (rescheduleTimerId) clearTimeout(rescheduleTimerId);
    };
  }, [activeCourses, assignmentCalendarRevision, currentSchool, effectiveTimeZone, selectedQuarter.quarter, selectedQuarter.year, userId, userSettings]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      setTimetables([]);
      setSelectedTimetableId(null);

      let { data, error } = await supabase
        .from('timetables')
        .select('id, name, quarter_key, courses, order')
        .eq('user_id', USER_ID)
        .eq('school', currentSchool);

      if (error && currentSchool === DEFAULT_UNIVERSITY.name && isMissingSchoolColumnError(error)) {
        const fallback = await supabase
          .from('timetables')
          .select('id, name, quarter_key, courses, order')
          .eq('user_id', USER_ID);
        data = fallback.data;
        error = fallback.error;
      }

      if (cancelled) return;
      if (error) { console.warn('Failed to load timetables:', error); return; }

      const loaded: Timetable[] = (data ?? [])
        .map((row: any, i: number) => ({
          id: row.id,
          name: row.name,
          quarterKey: row.quarter_key,
          courses: row.courses as Course[],
          order: row.order ?? i,
        }))
        .sort((a: Timetable, b: Timetable) => a.order - b.order);

      setTimetables(loaded);

      const preferredQuarter = await fetchPreferredSeededQuarter(currentSchool, activeKey);
      if (cancelled) return;

      const targetQuarter = preferredQuarter ?? selectedQuarter;
      const targetKey = quarterKey(targetQuarter);
      if (targetKey !== activeKey) setSelectedQuarter(targetQuarter);

      if (loaded.length === 0) {
        // New user — bootstrap with an empty 'My Schedule' for a quarter that has data for this school.
        await createTimetable(targetKey, 'My Schedule');
      } else {
        const forCurrentQuarter = loaded.filter((t) => t.quarterKey === targetKey);
        if (forCurrentQuarter.length > 0) {
          setSelectedTimetableId(forCurrentQuarter[0].id);
        } else if (preferredQuarter) {
          await createTimetable(targetKey, 'My Schedule');
        }
      }
    }
    load();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, currentSchool]);

  async function saveTimetable(t: Timetable) {
    let { error } = await supabase.from('timetables').upsert({
      id: t.id,
      user_id: USER_ID,
      school: currentSchool,
      quarter_key: t.quarterKey,
      name: t.name,
      courses: t.courses,
      order: t.order,
      updated_at: new Date().toISOString(),
    });
    if (error && currentSchool === DEFAULT_UNIVERSITY.name && isMissingSchoolColumnError(error)) {
      const fallback = await supabase.from('timetables').upsert({
        id: t.id,
        user_id: USER_ID,
        quarter_key: t.quarterKey,
        name: t.name,
        courses: t.courses,
        order: t.order,
        updated_at: new Date().toISOString(),
      });
      error = fallback.error;
    }
    if (error) console.warn('Failed to save timetable:', error);
  }

  async function createTimetable(qKey: string, name: string): Promise<Timetable | null> {
    const nextOrder = timetables.filter((t) => t.quarterKey === qKey).length;
    let { data, error } = await supabase
      .from('timetables')
      .insert({ user_id: USER_ID, school: currentSchool, quarter_key: qKey, name, courses: [], order: nextOrder })
      .select()
      .single();

    if (error && currentSchool === DEFAULT_UNIVERSITY.name && isMissingSchoolColumnError(error)) {
      const fallback = await supabase
        .from('timetables')
        .insert({ user_id: USER_ID, quarter_key: qKey, name, courses: [], order: nextOrder })
        .select()
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error || !data) { console.warn('Failed to create timetable:', error); return null; }

    const created: Timetable = {
      id: data.id,
      name: data.name,
      quarterKey: data.quarter_key,
      courses: [],
      order: data.order ?? nextOrder,
    };

    setTimetables((prev) => [...prev, created]);
    setSelectedTimetableId(created.id);
    return created;
  }

  const handleToggleCourse = async (course: Course) => {
    let target: Timetable | null = activeTimetable;

    // Auto-create a timetable if none exists for this quarter
    if (!target) {
      const created = await createTimetable(activeKey, 'My Schedule');
      if (!created) return;
      target = created;
    }

    const isAdded = target.courses.some((c) => c.id === course.id);
    const newCourses = isAdded
      ? target.courses.filter((c) => c.id !== course.id)
      : [...target.courses, course];

    const updated = { ...target, courses: newCourses };
    setTimetables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    await saveTimetable(updated);
    triggerSuccessHaptic();
  };

  const replaceVersionRef = useRef(0);
  const handleReplaceCourse = async (oldId: string, newCourse: Course) => {
    if (!activeTimetable) return;
    const timetableId = activeTimetable.id;
    const version = ++replaceVersionRef.current;
    let updated: Timetable | undefined;
    setTimetables((prev) => {
      const target = prev.find((t) => t.id === timetableId);
      if (!target) return prev;
      const newCourses = target.courses.map((c) => (c.id === oldId ? newCourse : c));
      updated = { ...target, courses: newCourses };
      return prev.map((t) => (t.id === timetableId ? updated! : t));
    });
    if (!updated) return;
    await saveTimetable(updated);
    if (replaceVersionRef.current !== version) return;
    triggerSuccessHaptic();
  };

  const handleResolveCourseConflicts = async (oldIds: string[], newCourse: Course) => {
    let target: Timetable | null = activeTimetable;

    if (!target) {
      const created = await createTimetable(activeKey, 'My Schedule');
      if (!created) return;
      target = created;
    }

    const oldIdSet = new Set(oldIds);
    let insertedNewCourse = false;
    const newCourses: Course[] = [];

    target.courses.forEach((existingCourse) => {
      if (oldIdSet.has(existingCourse.id)) {
        if (!insertedNewCourse) {
          newCourses.push(newCourse);
          insertedNewCourse = true;
        }
        return;
      }

      if (existingCourse.id !== newCourse.id) {
        newCourses.push(existingCourse);
      }
    });

    if (!insertedNewCourse) newCourses.push(newCourse);

    const updated = { ...target, courses: newCourses };
    setTimetables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    await saveTimetable(updated);
    triggerSuccessHaptic();
  };

  const openSettingsSheet = () => {
    settingsBackdropAnim.setValue(0);
    settingsSheetAnim.setValue(windowHeight);
    setShowSettings(true);
    Animated.parallel([
      Animated.spring(settingsSheetAnim, { toValue: 0, useNativeDriver: true, ...MOTION.spring.sheet }),
      Animated.timing(settingsBackdropAnim, { toValue: 1, duration: MOTION.duration.sheetIn, easing: MOTION.easing.standard, useNativeDriver: true }),
    ]).start();
  };

  const closeSettingsSheet = () => {
    Animated.parallel([
      Animated.timing(settingsSheetAnim, { toValue: windowHeight, duration: MOTION.duration.sheetOut, easing: MOTION.easing.exit, useNativeDriver: true }),
      Animated.timing(settingsBackdropAnim, { toValue: 0, duration: MOTION.duration.sheetOut, easing: MOTION.easing.exit, useNativeDriver: true }),
    ]).start(() => setShowSettings(false));
  };

  const handleChangeQuarter = (q: Quarter) => {
    setSelectedQuarter(q);
    const key = quarterKey(q);
    const forQuarter = timetables.filter((t) => t.quarterKey === key);
    setSelectedTimetableId(forQuarter.length > 0 ? forQuarter[0].id : null);
  };

  const handleSelectTimetable = (id: string) => {
    setSelectedTimetableId(id);
  };

  const handleCreateTimetable = async () => {
    if (quarterTimetables.length === 0) { await createTimetable(activeKey, 'My Schedule'); return; }
    const usedNames = new Set(quarterTimetables.map((t) => t.name));
    let code = 66; // 'B'
    while (usedNames.has(`Plan ${String.fromCharCode(code)}`)) code++;
    await createTimetable(activeKey, `Plan ${String.fromCharCode(code)}`);
  };

  const handleAddQuarter = async (q: Quarter) => {
    const qk = quarterKey(q);
    setSelectedQuarter(q);
    const existing = timetables.filter((t) => t.quarterKey === qk);
    const mySchedule = existing.find((t) => t.name === 'My Schedule');
    if (mySchedule) {
      setSelectedTimetableId(mySchedule.id);
    } else {
      await createTimetable(qk, 'My Schedule');
    }
  };

  const CURRENT_QUARTER: Quarter = resolveCurrentTerm(currentSchool, timetables);

  const handleDeleteTimetable = async () => {
    if (!activeTimetable) return;
    let { error } = await supabase.from('timetables').delete().eq('id', activeTimetable.id).eq('school', currentSchool);
    if (error && currentSchool === DEFAULT_UNIVERSITY.name && isMissingSchoolColumnError(error)) {
      const fallback = await supabase.from('timetables').delete().eq('id', activeTimetable.id);
      error = fallback.error;
    }
    if (error) { console.warn('Failed to delete timetable:', error); return; }

    const remaining = quarterTimetables.filter((t) => t.id !== activeTimetable.id);
    let updatedTimetables = timetables.filter((t) => t.id !== activeTimetable.id);

    // If 'My Schedule' no longer exists in this quarter, promote the first remaining one
    if (remaining.length > 0 && !remaining.some((t) => t.name === 'My Schedule')) {
      const toRename = remaining[0];
      const renameResult = await supabase.from('timetables').update({ name: 'My Schedule' }).eq('id', toRename.id).eq('school', currentSchool);
      if (renameResult.error && currentSchool === DEFAULT_UNIVERSITY.name && isMissingSchoolColumnError(renameResult.error)) {
        await supabase.from('timetables').update({ name: 'My Schedule' }).eq('id', toRename.id);
      }
      updatedTimetables = updatedTimetables.map((t) =>
        t.id === toRename.id ? { ...t, name: 'My Schedule' } : t
      );
    }

    setTimetables(updatedTimetables);

    if (remaining.length > 0) {
      setSelectedTimetableId(remaining[0].id);
    } else {
      // Quarter is now empty — switch to current quarter
      const currentQk = quarterKey(CURRENT_QUARTER);
      setSelectedQuarter(CURRENT_QUARTER);
      const currentQTimetables = updatedTimetables.filter((t) => t.quarterKey === currentQk);
      setSelectedTimetableId(currentQTimetables.length > 0 ? currentQTimetables[0].id : null);
    }
  };

  const handleReorderTimetables = async (orderedIds: string[]) => {
    const updated = timetables
      .map((t) => {
        const newOrder = orderedIds.indexOf(t.id);
        return newOrder === -1 ? t : { ...t, order: newOrder };
      })
      .sort((a, b) => a.order - b.order);
    setTimetables(updated);
    await Promise.all(
      orderedIds.map((id, newOrder) => {
        const t = timetables.find((x) => x.id === id);
        if (!t) return Promise.resolve();
        return supabase.from('timetables').update({ order: newOrder }).eq('id', id).eq('school', currentSchool)
          .then((result) => {
            if (result.error && currentSchool === DEFAULT_UNIVERSITY.name && isMissingSchoolColumnError(result.error)) {
              return supabase.from('timetables').update({ order: newOrder }).eq('id', id);
            }
            return result;
          });
      })
    );
  };

  const handleFocusCourse = (courseId: string | null) => {
    setFocusedCourseId(null);
    setTimeout(() => setFocusedCourseId(courseId), 0);
  };

  useEffect(() => {
    const screenHeight = windowHeight;

    if (showCoursePicker) {
      setRenderCoursePicker(true);
      pickerTranslateY.setValue(screenHeight);
      Animated.timing(pickerTranslateY, {
        toValue: 0,
        duration: MOTION.duration.sheetIn,
        easing: MOTION.easing.standard,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(pickerTranslateY, {
      toValue: screenHeight,
      duration: MOTION.duration.sheetOut,
      easing: MOTION.easing.exit,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setRenderCoursePicker(false);
    });
  }, [pickerTranslateY, showCoursePicker, windowHeight]);

  const handleLogout = () => {
    suppressNextSignedOutClearRef.current = true;
    void supabase.auth.signOut().finally(() => {
      setTimeout(() => {
        suppressNextSignedOutClearRef.current = false;
      }, 1000);
    });
    void Notifications.cancelAllScheduledNotificationsAsync();
    clearSignedOutState();
  };

  const handleBackToUniversityFromOnboarding = () => {
    returnToUniversityAfterSignOutRef.current = true;
    suppressNextSignedOutClearRef.current = true;
    void supabase.auth.signOut().finally(() => {
      setTimeout(() => {
        suppressNextSignedOutClearRef.current = false;
      }, 1000);
    });
    void Notifications.cancelAllScheduledNotificationsAsync();
    clearSignedOutState();
  };

  const deleteAccountStorageObjects = async (accountUserId: string) => {
    const folder = accountUserId;
    const paths: string[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const { data, error } = await supabase.storage
        .from('board-attachments')
        .list(folder, { limit, offset });

      if (error) {
        if (error.message.toLowerCase().includes('bucket')) return;
        throw error;
      }

      const batch = (data ?? [])
        .filter((item) => item.name && item.name !== '.emptyFolderPlaceholder')
        .map((item) => `${folder}/${item.name}`);
      paths.push(...batch);

      if (!data || data.length < limit) break;
      offset += limit;
    }

    for (let index = 0; index < paths.length; index += 100) {
      const batch = paths.slice(index, index + 100);
      const { error } = await supabase.storage.from('board-attachments').remove(batch);
      if (error) throw error;
    }
  };

  const handleDeleteAccount = async () => {
    if (!userId || deletingAccount) return;

    Alert.alert(
      'Delete account?',
      'This will permanently delete your profile, friends, class schedules, grades, messages, board posts, comments, reviews, and uploaded files. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete everything?',
              'Your ClassMate account and account-related data will be permanently removed.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Account',
                  style: 'destructive',
                  onPress: () => {
                    void (async () => {
                      setDeletingAccount(true);
                      try {
                        await deleteAccountStorageObjects(userId);
                      } catch (error: any) {
                        setDeletingAccount(false);
                        Alert.alert('Could not delete uploaded files', error?.message ?? 'Try again in a moment.');
                        return;
                      }

                      const { error } = await supabase.rpc('delete_current_user');
                      setDeletingAccount(false);

                      if (error) {
                        Alert.alert(
                          'Could not delete account',
                          error.code === 'PGRST202' || error.message.includes('delete_current_user')
                            ? 'The account deletion SQL is not installed yet. Run supabase/sql/delete_account.sql in Supabase first.'
                            : error.message
                        );
                        return;
                      }

                      handleLogout();
                    })();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

	  const saveUserSettingsRow = async (
    nextSettings: UserSettingsState,
    nextProfile: EditableProfile = userProfile,
    nextExpoPushToken: string | null = expoPushToken,
    profileSetupComplete = !needsProfileSetup,
    onboardingComplete = !needsFeatureOnboarding
  ) => {
    if (!userId) throw new Error('missing-user-id');

    const nextProfileDetails = {
      ...profileDetailsRef.current,
      ...profileDetailsFromProfile(
        nextProfile,
        nextSettings.boardProfileVisible,
        profileSetupComplete,
        onboardingComplete,
      ),
      language: nextSettings.language,
      timeZone: nextSettings.timeZone,
      dateFormat: nextSettings.dateFormat,
      themePreference: normalizeThemePreference(profileDetailsRef.current.themePreference) ?? themePreference,
      timetableSettings: normalizeTimetableSettings(profileDetailsRef.current.timetableSettings) ?? timetableSettings,
    };
    profileDetailsRef.current = nextProfileDetails;

    const payload = {
      user_id: userId,
      timetable_visibility: nextSettings.timetableVisibility,
      notification_settings: nextSettings.notifications,
      push_permission_status: nextSettings.pushPermissionStatus,
      expo_push_token: nextExpoPushToken,
      profile_details: nextProfileDetails,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('user_settings').upsert(payload);
    if (error) {
      console.warn('Failed to save user settings:', error);
      Alert.alert(
        'Could not save settings',
        error.code === 'PGRST205'
          ? 'The user_settings table is missing in Supabase. Run the required SQL first.'
          : error.message
      );
      throw error;
	    }
	  };

	  const handleThemePreferenceChange = (nextThemePreference: ThemePreference) => {
	    onThemeChange(nextThemePreference);
	    profileDetailsRef.current = { ...profileDetailsRef.current, themePreference: nextThemePreference };
	    void AsyncStorage.setItem(
	      scopedPreferenceStorageKey('theme_preference', currentSchool, USER_ID),
	      nextThemePreference
	    );
	    if (userId) {
	      void saveUserSettingsRow(userSettings).catch(() => {});
	    }
	    triggerSuccessHaptic();
	  };

	  const handleTimetableSettingsApply = (nextSettings: TimetableSettings) => {
	    const normalized = normalizeTimetableSettings(nextSettings) ?? DEFAULT_TIMETABLE_SETTINGS;
	    setTimetableSettings(normalized);
	    profileDetailsRef.current = { ...profileDetailsRef.current, timetableSettings: normalized };
	    void AsyncStorage.setItem(
	      scopedPreferenceStorageKey('timetable_settings', currentSchool, USER_ID),
	      JSON.stringify(normalized)
	    );
	    if (userId) {
	      void saveUserSettingsRow(userSettings).catch(() => {});
	    }
	  };

	  const resolveExpoProjectId = () => {
    return (
      Constants.easConfig?.projectId ||
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ||
      '29e496cc-1ff6-4471-9d56-e1b9128d7196'
    );
  };

  const registerExpoPushToken = async (): Promise<string | null> => {
    try {
      const projectId = resolveExpoProjectId();
      if (!projectId) {
        console.warn('Expo push registration skipped: no EAS projectId configured.');
        return null;
      }

      const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenResponse.data;
      setExpoPushToken(token);
      return token;
    } catch (error) {
      console.warn('Failed to register Expo push token:', error);
      return null;
    }
  };

  const handleSaveProfile = async (nextProfile: EditableProfile): Promise<boolean> => {
    if (!userId) return false;

    setSavingProfile(true);
    const shouldStartOnboarding = needsProfileSetup;
    const safeEmail = userEmail || nextProfile.email;
    const next = { ...nextProfile, email: safeEmail };
    const nextName = buildDisplayName(next);

    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      email: safeEmail,
      name: nextName,
      major: next.major,
      year: next.year,
      school: currentSchool,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setSavingProfile(false);
      Alert.alert('Could not save profile', error.message);
      return false;
    }

    const nextSettings = { ...userSettings };
    try {
      await saveUserSettingsRow(nextSettings, next, expoPushToken, true, !shouldStartOnboarding);
      setUserProfile(next);
      setNeedsProfileSetup(false);
      if (shouldStartOnboarding) {
        setNeedsFeatureOnboarding(true);
        setShowNotificationPermissionPrompt(false);
        setShowBrandIntro(false);
      }
      return true;
    } catch {
      return false;
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveOnboardingProfile = async (nextProfile: EditableProfile): Promise<boolean> => {
    if (!userId) return false;

    setSavingOnboarding(true);
    const safeEmail = userEmail || nextProfile.email;
    const next = { ...nextProfile, email: safeEmail };
    const nextName = buildDisplayName(next);

    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      email: safeEmail,
      name: nextName,
      major: next.major,
      year: next.year,
      school: currentSchool,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setSavingOnboarding(false);
      Alert.alert('Could not save profile', error.message);
      return false;
    }

    try {
      await saveUserSettingsRow(userSettings, next, expoPushToken, true, false);
      setUserProfile(next);
      setNeedsProfileSetup(false);
      return true;
    } catch {
      return false;
    } finally {
      setSavingOnboarding(false);
    }
  };

  const handleCompleteFeatureOnboarding = () => {
    void handleCompleteNotificationPrompt(false);
  };

  const handleCompleteNotificationPrompt = async (enabled: boolean) => {
    setSavingOnboarding(true);
    try {
      let nextPermissionStatus = userSettings.pushPermissionStatus;
      let nextToken = expoPushToken;
      const nextNotifications = {
        ...userSettings.notifications,
        pushNotifications: enabled,
      };

      if (enabled) {
        nextPermissionStatus = await handleRequestPushPermissions();
        if (nextPermissionStatus === 'granted') {
          nextToken = await registerExpoPushToken();
        } else {
          nextNotifications.pushNotifications = false;
          nextToken = null;
          setExpoPushToken(null);
          Alert.alert(
            'Notifications stay off for now',
            nextPermissionStatus === 'denied'
              ? 'You can turn them back on later in Settings > Notifications.'
              : 'Push notifications are not available right now, but you can try again later in Settings.'
          );
        }
      } else {
        nextToken = null;
        setExpoPushToken(null);
      }

      const nextSettings = {
        ...userSettings,
        notifications: nextNotifications,
        pushPermissionStatus: nextPermissionStatus,
      };

      await saveUserSettingsRow(nextSettings, userProfile, nextToken, true, true);
      setUserSettings(nextSettings);
      setShowNotificationPermissionPrompt(false);
      setShowBrandIntro(!isReviewAccountEmail(userEmail));
      setNeedsFeatureOnboarding(false);
      setForceReviewOnboardingOnce(false);
    } catch {
      return;
    } finally {
      setSavingOnboarding(false);
    }
  };

  const handleSaveVisibility = async ({
    timetableVisibility,
    boardProfileVisible,
  }: {
    timetableVisibility: TimetableVisibility;
    boardProfileVisible: boolean;
  }): Promise<boolean> => {
    setSavingVisibility(true);
    const nextSettings = { ...userSettings, timetableVisibility, boardProfileVisible };
    try {
      await saveUserSettingsRow(nextSettings);
      setUserSettings(nextSettings);
      return true;
    } catch {
      return false;
    } finally {
      setSavingVisibility(false);
    }
  };

  const handleSaveRegion = async ({
    language,
    timeZone,
    dateFormat,
  }: {
    language: LanguagePreference;
    timeZone: string;
    dateFormat: DateFormatPreference;
  }): Promise<boolean> => {
    setSavingRegion(true);
    const nextSettings = {
      ...userSettings,
      language,
      timeZone,
      dateFormat,
    };
    try {
      await saveUserSettingsRow(nextSettings);
      setUserSettings(nextSettings);
      return true;
    } catch {
      return false;
    } finally {
      setSavingRegion(false);
    }
  };

  const handleRequestPushPermissions = async (): Promise<PushPermissionStatus> => {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('reminders', {
          name: 'Reminders',
          importance: Notifications.AndroidImportance.HIGH,
        });
      }
      const existing = await Notifications.getPermissionsAsync();
      let status = existing.status;

      if (status !== 'granted') {
        const requested = await Notifications.requestPermissionsAsync();
        status = requested.status;
      }

      if (status === 'granted') return 'granted';
      if (status === 'denied') return 'denied';
      return 'undetermined';
    } catch (error) {
      console.warn('Failed to request notification permissions:', error);
      return 'unavailable';
    }
  };

  const handleSaveNotifications = async (
    notifications: NotificationPreferences,
    pushPermissionStatus: PushPermissionStatus
  ): Promise<boolean> => {
    setSavingNotifications(true);
    const nextSettings = {
      ...userSettings,
      notifications,
      pushPermissionStatus,
    };
    try {
      let nextToken = expoPushToken;
      if (notifications.pushNotifications && pushPermissionStatus === 'granted') {
        nextToken = await registerExpoPushToken();
      }
      if (!notifications.pushNotifications) {
        nextToken = null;
        setExpoPushToken(null);
      }
      await saveUserSettingsRow(nextSettings, userProfile, nextToken);
      setUserSettings(nextSettings);
      return true;
    } catch {
      return false;
    } finally {
      setSavingNotifications(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    if (!userSettings.notifications.pushNotifications) return;
    if (userSettings.pushPermissionStatus !== 'granted') return;
    if (expoPushToken) return;

    let cancelled = false;

    async function syncPushToken() {
      const token = await registerExpoPushToken();
      if (cancelled || !token) return;
      try {
        await saveUserSettingsRow(userSettings, userProfile, token);
      } catch {
        return;
      }
    }

    void syncPushToken();

    return () => {
      cancelled = true;
    };
  }, [
    expoPushToken,
    userId,
    userProfile,
    userSettings,
  ]);

  const handleOpenFriendsTabRef = useRef<(() => void) | null>(null);
  const handleOpenFriendsTab = () => {
    setCurrentTab('friends');
  };
  handleOpenFriendsTabRef.current = handleOpenFriendsTab;

  const handleTabPress = (tab: MainTab) => {
    triggerSelectionHaptic();
    triggerTabReset(tab);
    if (tab === 'friends') {
      handleOpenFriendsTab();
    } else {
      setCurrentTab(tab);
    }
  };

  const openMessages = (target?: ChatTarget | null) => {
    setMessageTarget(target ?? null);
    setShowMessages(true);
  };

	  const closeMessages = () => {
	    setShowMessages(false);
	    setMessageTarget(null);
	    void loadUnreadMessageCount().then(setUnreadMessageCount);
	  };

  const openBoardPostFromMessages = (postId: string) => {
    setShowMessages(false);
    setMessageTarget(null);
    setBoardPostOpenRequest({ postId, requestId: Date.now() });
    setCurrentTab('board');
    void loadUnreadMessageCount().then(setUnreadMessageCount);
  };

	  useEffect(() => {
	    if (Platform.OS !== 'android') return undefined;
	    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
	      if (showCoursePicker) {
	        setShowCoursePicker(false);
	        return true;
	      }
	      if (showMessages) {
	        closeMessages();
	        return true;
	      }
	      if (showSettings) {
	        closeSettingsSheet();
	        return true;
	      }
	      if (!userId && authStack.length > 1) {
	        popAuth();
	        return true;
	      }
	      if (currentTab !== 'home') {
	        setCurrentTab('home');
	        return true;
	      }
	      return false;
	    });
	    return () => subscription.remove();
	  }, [authStack.length, currentTab, showCoursePicker, showMessages, showSettings, userId]);

	  // ── auth screens ─────────────────────────────────────────────────────────────

  if (authInitializing) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? '#09111d' : '#f4f7ff', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="small" color={colors.brand} />
      </View>
    );
  }

  if (!userId) {
    const renderAuthScreen = (name: AuthScreen, goBack: () => void) => {
      if (name === 'welcome') {
        return <WelcomeScreen onGetStarted={() => pushAuth('university')} />;
      }
      if (name === 'university') {
        return (
          <UniversitySelectionScreen
            onBack={goBack}
            onContinue={(uni) => {
              pendingAuthUniversityRef.current = uni;
              setSelectedUniversity(uni);
              setSelectedQuarter(getAcademicTermForDate(uni.name, new Date()));
              pushAuth('signup');
            }}
          />
        );
      }
      if (name === 'signup') {
        const signupUniversity = selectedUniversity ?? DEFAULT_UNIVERSITY;
        return (
          <SignUpScreen
            university={signupUniversity}
            onBack={goBack}
            onSignedUp={(id, email, university) => {
              pendingAuthUniversityRef.current = university;
              setSelectedUniversity(university);
              setSelectedQuarter(getAcademicTermForDate(university.name, new Date()));
              requestUserBootstrap();
              setUserId(id);
              setUserEmail(email);
              setUserProfile(fallbackProfileFromEmail(email));
              setNeedsProfileSetup(false);
              setNeedsFeatureOnboarding(true);
              setForceReviewOnboardingOnce(false);
              setShowNotificationPermissionPrompt(false);
              setShowBrandIntro(false);
            }}
            onGoToSignIn={() => replaceAuth('signin')}
          />
        );
      }
      const signInUniversity = selectedUniversity ?? DEFAULT_UNIVERSITY;
      return (
        <SignInScreen
          university={signInUniversity}
          onBack={goBack}
          onSignedIn={(id, email, university) => {
            const shouldForceReviewOnboarding = isReviewAccountEmail(email);
            pendingAuthUniversityRef.current = university;
            setSelectedUniversity(university);
            setSelectedQuarter(getAcademicTermForDate(university.name, new Date()));
            setForceReviewOnboardingOnce(shouldForceReviewOnboarding);
            setNeedsFeatureOnboarding(shouldForceReviewOnboarding);
            requestUserBootstrap();
            setUserId(id);
            setUserEmail(email);
            setUserProfile(fallbackProfileFromEmail(email));
            setNeedsProfileSetup(false);
            setShowNotificationPermissionPrompt(false);
            setShowBrandIntro(false);
          }}
          onGoToSignUp={() => pushAuth('signup')}
        />
      );
    };

    return <AuthNavigator stack={authStack} onPop={popAuth} renderScreen={renderAuthScreen} />;
  }

  if (userBootstrapLoading || !userBootstrapSettled) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? '#09111d' : '#f4f7ff', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="small" color={colors.brand} />
      </View>
    );
  }

  const renderFeatureOnboarding = () => (
    <FeatureOnboardingScreen
      onFinish={handleCompleteFeatureOnboarding}
      onCompleteNotifications={handleCompleteNotificationPrompt}
      onBackToUniversity={handleBackToUniversityFromOnboarding}
      finishing={savingOnboarding}
      initialProfile={userProfile}
      userEmail={userEmail}
      schoolName={selectedUniversity?.name ?? DEFAULT_UNIVERSITY.name}
      onSaveProfile={handleSaveOnboardingProfile}
    />
  );
  const reviewAccountRequiresOnboarding =
    isReviewAccountEmail(userEmail) && (forceReviewOnboardingOnce || needsFeatureOnboarding);

  if (reviewAccountRequiresOnboarding) {
    return renderFeatureOnboarding();
  }

  if (showNotificationPermissionPrompt) {
    return (
      <NotificationPermissionScreen
        onEnable={() => handleCompleteNotificationPrompt(true)}
        onSkip={() => handleCompleteNotificationPrompt(false)}
        saving={savingOnboarding}
      />
    );
  }

  if (showBrandIntro) {
    return <ClassMateIntroScreen schoolName={currentSchool} onComplete={() => setShowBrandIntro(false)} />;
  }

  if (needsFeatureOnboarding) {
    return renderFeatureOnboarding();
  }

  // ── main app ──────────────────────────────────────────────────────────────────

  let content = null;

  if (currentTab === 'home') {
    content = (
      <HomeScreen
        key={`home-${homeTabTapCount}`}
        activeCourses={homeQuarterCourses}
        selectedQuarter={homeQuarterKey === academicQuarterKey ? academicQuarter : selectedQuarter}
        onOpenSettings={openSettingsSheet}
        userId={USER_ID}
        topInset={insets.top}
        bottomInset={appBottomInset}
        scrollToTopTrigger={homeTabTapCount}
	        school={currentSchool}
	        timeZone={effectiveTimeZone}
	        onAssignmentCalendarChange={handleAssignmentCalendarChange}
	      />
    );
  } else if (currentTab === 'timetable') {
    content = (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TimetableScreen
          key={`timetable-${timetableTabTapCount}`}
          activeCourses={activeCourses}
          selectedQuarter={selectedQuarter}
          focusedCourseId={focusedCourseId}
          onFocusCourse={handleFocusCourse}
          onChangeQuarter={handleChangeQuarter}
          onOpenCoursePicker={() => setShowCoursePicker(true)}
          onRemoveCourse={handleToggleCourse}
          onEditCustomCourse={(course) => { setEditingCustomCourse(course); setShowCoursePicker(true); }}
          school={currentSchool}
          userId={USER_ID}
          timetables={timetables}
          quarterTimetables={quarterTimetables}
          activeTimetableId={activeTimetable?.id ?? null}
          onSelectTimetable={handleSelectTimetable}
          onCreateTimetable={handleCreateTimetable}
          onDeleteTimetable={handleDeleteTimetable}
          onReorderTimetables={handleReorderTimetables}
          onAddQuarter={handleAddQuarter}
          settings={timetableSettings}
	          onSettingsApply={handleTimetableSettingsApply}
          topInset={insets.top}
          bottomInset={appBottomInset}
          scrollToTopTrigger={timetableTabTapCount}
        />
      </View>
    );
  } else if (currentTab === 'grades') {
    content = (
      <GradesScreen
        key={`grades-${gradesTabTapCount}`}
        timetables={timetables}
        userId={USER_ID}
        school={currentSchool}
        topInset={insets.top}
        bottomInset={appBottomInset}
        scrollToTopTrigger={gradesTabTapCount}
      />
    );
  } else if (currentTab === 'board') {
    content = (
      <BoardScreen
        key={`board-${boardTabTapCount}`}
        school={currentSchool}
        userId={USER_ID}
        boardAuthorName={userProfile.nickname.trim() || displayUserName}
        boardProfileVisible={userSettings.boardProfileVisible}
        topInset={insets.top}
        bottomInset={appBottomInset}
        scrollToTopTrigger={boardTabTapCount}
        onOpenMessages={() => openMessages(null)}
        onOpenChat={openMessages}
        unreadMessageCount={unreadMessageCount}
        openPostId={boardPostOpenRequest?.postId ?? null}
        openPostRequestId={boardPostOpenRequest?.requestId ?? 0}
        onOpenPostHandled={(postId) => {
          setBoardPostOpenRequest((request) => (
            request?.postId === postId ? null : request
          ));
        }}
      />
    );
  } else if (currentTab === 'friends') {
    content = (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <FriendsScreen
          key={`friends-${friendsTabTapCount}`}
          userId={USER_ID}
          userEmail={userEmail}
          school={currentSchool}
          activeCourses={homeQuarterKey === academicQuarterKey ? homeQuarterCourses : []}
          selectedQuarter={academicQuarter}
          topInset={insets.top}
          bottomInset={appBottomInset}
          scrollToTopTrigger={friendsTabTapCount}
          onOpenMessages={() => openMessages(null)}
          onOpenChat={openMessages}
          unreadMessageCount={unreadMessageCount}
        />
      </View>
    );
  }

  const TabItem = ({
    label,
    icon,
    active,
    onPress,
    scaleAnim,
    badgeCount,
    badgeLabel,
  }: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    active: boolean;
    onPress: () => void;
    scaleAnim: Animated.Value;
    badgeCount?: number;
    badgeLabel?: string;
  }) => (
    <TouchableOpacity
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: tabItemVerticalPadding,
        paddingHorizontal: tabItemHorizontalPadding,
        minWidth: 0,
      }}
      onPressIn={() => Animated.spring(scaleAnim, { toValue: 1.25, useNativeDriver: true, tension: 300, friction: 10 }).start()}
      onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }).start()}
      onPress={onPress}
    >
      <Animated.View style={{ position: 'relative', transform: [{ scale: scaleAnim }] }}>
        <Ionicons name={icon} size={tabIconSize} color={active ? colors.brand : colors.text} />
        {(badgeCount ?? 0) > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: -7,
              right: -15,
              minWidth: badgeLabel ? 28 : 17,
              height: 17,
              borderRadius: 9,
              paddingHorizontal: badgeLabel ? 5 : 0,
              backgroundColor: badgeLabel ? colors.brand : colors.destructive,
              borderWidth: 1.5,
              borderColor: isDark ? 'rgba(30,30,34,0.95)' : 'rgba(255,255,255,0.96)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: 'white', fontSize: badgeLabel ? 8 : 9, fontWeight: '900' }}>
              {badgeLabel ?? (badgeCount && badgeCount > 99 ? '99+' : badgeCount)}
            </Text>
          </View>
        ) : null}
      </Animated.View>
      <Text
        style={{
          marginTop: tabLabelTopMargin,
          fontSize: tabLabelFontSize,
          color: active ? colors.brand : colors.text,
          fontWeight: active ? '600' : '400',
          maxWidth: Math.max(42, tabSlotWidth - 8),
        }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgSecondary }}>
      {content}

      <View
        style={{
          position: 'absolute',
          left: tabHorizontalMargin,
          right: tabHorizontalMargin,
          bottom: tabBarBottomOffset,
          padding: 1,
          borderRadius: tabOuterRadius,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.86)',
          backgroundColor: isDark ? 'rgba(30,30,34,0.72)' : 'rgba(255,255,255,0.86)',
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            paddingHorizontal: tabInnerHorizontalPadding,
            paddingVertical: tabInnerVerticalPadding,
            borderRadius: Math.max(0, tabOuterRadius - 1),
            backgroundColor: isDark ? 'rgba(20,20,24,0.26)' : 'rgba(255,255,255,0.16)',
          }}
        >
          <View
            ref={tabBarRowRef}
            style={{ flexDirection: 'row' }}
            {...pillPanResponder.panHandlers}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w <= 0) return;
              tabBarRowRef.current?.measureInWindow((x) => {
                tabBarPageXRef.current = x;
              });
              tabBarWidthRef.current = w;
              if (!tabBarReady) {
                pillXAnim.setValue(TABS.indexOf(currentTab) * (w / 5));
                setTabBarReady(true);
              }
            }}
          >
            {/* Active pill */}
            {tabBarReady && (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: tabBarWidthRef.current / 5,
                  borderRadius: tabPillRadius,
                  backgroundColor: isDark ? 'rgba(122,162,255,0.10)' : 'rgba(65,105,225,0.06)',
                  transform: [{ translateX: pillXAnim }, { scale: pillScaleAnim }],
                }}
              />
            )}
            <TabItem label="Today" icon="home-outline" active={currentTab === 'home'} scaleAnim={tabIconScaleAnims[0]} onPress={() => handleTabPress('home')} />
            <TabItem label="Timetable" icon="calendar-outline" active={currentTab === 'timetable'} scaleAnim={tabIconScaleAnims[1]} onPress={() => handleTabPress('timetable')} />
            <TabItem label="Grades" icon="school-outline" active={currentTab === 'grades'} scaleAnim={tabIconScaleAnims[2]} onPress={() => handleTabPress('grades')} />
            <TabItem
              label="Board"
              icon="clipboard-outline"
              active={currentTab === 'board'}
              scaleAnim={tabIconScaleAnims[3]}
              badgeCount={currentTab === 'board' ? 0 : newBoardPostCount}
              badgeLabel="NEW"
              onPress={() => handleTabPress('board')}
            />
            <TabItem
              label="ClassMates"
              icon="person-add-outline"
              active={currentTab === 'friends'}
              scaleAnim={tabIconScaleAnims[4]}
              badgeCount={unreadMessageCount}
              onPress={() => handleTabPress('friends')}
            />
          </View>
        </View>
      </View>

      <Modal
        visible={showSettings}
        transparent
        animationType="none"
        onRequestClose={closeSettingsSheet}
      >
        <Animated.View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: settingsBackdropAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.4)'] }) }}>
          <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} activeOpacity={1} onPress={closeSettingsSheet} />
          <Animated.View style={{ height: '92%', transform: [{ translateY: settingsSheetAnim }] }}>
            <SettingsScreen
              visible={showSettings}
              onClose={closeSettingsSheet}
              onLogout={handleLogout}
              onDeleteAccount={handleDeleteAccount}
              deletingAccount={deletingAccount}
              userName={displayUserName}
              userEmail={userEmail}
              userId={userId ?? ''}
              school={currentSchool}
              userProfile={userProfile}
              userSettings={userSettings}
              themePreference={themePreference}
	              onThemeChange={handleThemePreferenceChange}
              onSaveProfile={handleSaveProfile}
              onSaveVisibility={handleSaveVisibility}
              onSaveNotifications={handleSaveNotifications}
              onSaveRegion={handleSaveRegion}
              onRequestPushPermissions={handleRequestPushPermissions}
              savingProfile={savingProfile}
              savingVisibility={savingVisibility}
              savingNotifications={savingNotifications}
              savingRegion={savingRegion}
            />
          </Animated.View>
        </Animated.View>
      </Modal>

      <Modal
        visible={showMessages}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeMessages}
      >
        {showMessages ? (
          <MessagesScreen
            onClose={closeMessages}
            openChatWith={messageTarget}
            userId={USER_ID}
            school={currentSchool}
            onOpenSourcePost={openBoardPostFromMessages}
          />
        ) : null}
      </Modal>

      {renderCoursePicker && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 20,
            elevation: 20,
            transform: [{ translateY: pickerTranslateY }],
          }}
        >
          <CoursePickerScreen
            activeCourses={activeCourses}
            onToggleCourse={handleToggleCourse}
            onFocusCourse={handleFocusCourse}
            onClose={() => setShowCoursePicker(false)}
            selectedQuarter={selectedQuarter}
            timetableSettings={timetableSettings}
            userId={USER_ID}
            school={currentSchool}
            editingCustomCourse={editingCustomCourse}
            onReplaceCourse={handleReplaceCourse}
            onResolveCourseConflicts={handleResolveCourseConflicts}
            onEditingHandled={() => setEditingCustomCourse(null)}
          />
        </Animated.View>
      )}
    </View>
  );
}

export default function App() {
  const [themePreference, setThemePreference] = useState<ThemePreference>('auto');
  const [themePreferenceBootstrapped, setThemePreferenceBootstrapped] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadLastThemePreference() {
      try {
        const storedPreference = await readLastThemePreference();
        if (active && storedPreference) {
          setThemePreference(storedPreference);
        }
      } catch (error) {
        console.warn('Failed to load last theme preference:', error);
      } finally {
        if (active) {
          setThemePreferenceBootstrapped(true);
        }
      }
    }

    void loadLastThemePreference();

    return () => {
      active = false;
    };
  }, []);

  const handleThemeChange = useCallback((nextThemePreference: ThemePreference) => {
    setThemePreference(nextThemePreference);
    void AsyncStorage.setItem(LAST_THEME_PREFERENCE_STORAGE_KEY, nextThemePreference);
  }, []);

  return (
    <SafeAreaProvider>
      {themePreferenceBootstrapped ? (
        <ThemeProvider preference={themePreference}>
          <AppErrorBoundary>
            <AppContent themePreference={themePreference} onThemeChange={handleThemeChange} />
          </AppErrorBoundary>
        </ThemeProvider>
      ) : (
        <View style={{ flex: 1, backgroundColor: '#09111d', alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color="#7aa2ff" />
        </View>
      )}
    </SafeAreaProvider>
  );
}

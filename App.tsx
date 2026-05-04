import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Easing, LogBox, Modal, PanResponder, Platform, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
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
import { Course, Quarter, Timetable, TimetableSettings, DEFAULT_TIMETABLE_SETTINGS, quarterKey } from './src/data/courses';
import { DEFAULT_UNIVERSITY, getAcademicTermForDate, resolveCurrentTerm, schoolFeatureEnabled, universityForName, type University } from './src/data/schools';
import {
  buildDisplayName,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_USER_SETTINGS,
  fallbackProfileFromEmail,
  hasCompletedProfileSetup,
  needsInitialOnboarding,
  normalizeDateFormatPreference,
  normalizeLanguagePreference,
  normalizeTimeZonePreference,
  profileDetailsFromProfile,
  profileFromSources,
} from './src/data/userPreferences';
import { fetchSportsEventsForSchool } from './src/data/sportsEvents';
import { supabase } from './src/lib/supabase';
import { isMissingSchoolColumnError } from './src/lib/supabaseErrors';
import type { ChatTarget } from './src/data/messages';
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

type AuthScreen = 'welcome' | 'university' | 'signin' | 'signup';

function parseQuarterKeyValue(key: string): Quarter | null {
  const idx = key.indexOf('-');
  if (idx <= 0) return null;
  const year = key.slice(0, idx);
  const quarter = key.slice(idx + 1);
  if (!year || !quarter) return null;
  return { year, quarter };
}

async function fetchPreferredSeededQuarter(school: string, preferredKey: string): Promise<Quarter | null> {
  const { count: preferredCount } = await supabase
    .from('sections')
    .select('id', { count: 'exact', head: true })
    .eq('school', school)
    .eq('quarter_key', preferredKey);

  if ((preferredCount ?? 0) > 0) return parseQuarterKeyValue(preferredKey);

  const { data, error } = await supabase
    .from('sections')
    .select('quarter_key')
    .eq('school', school)
    .limit(5000);

  if (error) {
    console.error('Failed to resolve seeded quarter:', error);
    return null;
  }

  const seededKeys = [...new Set((data ?? []).map((row: any) => row.quarter_key).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a));
  return seededKeys.length > 0 ? parseQuarterKeyValue(seededKeys[0]) : null;
}

const REVIEW_ACCOUNT_EMAILS = new Set(['review@classmate.app']);

function isReviewAccountEmail(email: string | null | undefined) {
  return REVIEW_ACCOUNT_EMAILS.has((email ?? '').trim().toLowerCase());
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
  const match = rawStart.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return rawStart;

  const hour24 = Number(match[1]);
  const minute = match[2];
  if (!Number.isFinite(hour24)) return rawStart;

  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minute} ${suffix}`;
}

function buildDailyScheduleNotificationBody(courses: Course[]) {
  const sortedCourses = courses.slice().sort((a, b) => courseStartMinutes(a) - courseStartMinutes(b));
  const visibleCourses = sortedCourses.slice(0, 4);
  const items = visibleCourses.map((course) => (
    `${course.code} ${formatNotificationStartTime(course.time)}${course.location ? ` @ ${course.location}` : ''}`
  ));
  const remaining = Math.max(0, sortedCourses.length - visibleCourses.length);
  const body = remaining > 0
    ? `${items.join(' · ')} · +${remaining} more`
    : items.join(' · ');

  return truncateNotificationText(body || 'Open ClassMate to see your full schedule for today.', 178);
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

function buildUpcomingClassReminderDates(courses: Course[], reminderMinutes: number, daysAhead = 14) {
  const now = new Date();
  const end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const dates: Array<{ course: Course; notifyAt: Date }> = [];

  for (const course of courses) {
    if (course.time === 'TBA' || course.days === 'TBA') continue;
    const location = course.location?.toLowerCase() ?? '';
    if (location.includes('online') || location.includes('remote')) continue;

    const { hour, minute } = parseTimeStart(course.time);
    const courseDays = parseCourseDays(course.days);

    for (let cursor = new Date(now); cursor <= end; cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)) {
      if (!courseDays.some((day) => weekdayIndex(day) === cursor.getDay())) continue;

      const classStart = new Date(cursor);
      classStart.setHours(hour, minute, 0, 0);
      const notifyAt = new Date(classStart.getTime() - reminderMinutes * 60 * 1000);

      if (notifyAt <= now || classStart <= now) continue;
      dates.push({ course, notifyAt });
    }
  }

  return dates;
}

function buildDailyScheduleSummaryDates(courses: Course[], daysAhead = 14, summaryHour = 8) {
  const now = new Date();
  const end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const dates: Array<{ notifyAt: Date; courses: Course[] }> = [];

  for (let cursor = new Date(now); cursor <= end; cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)) {
    const dayCourses = courses.filter((course) => {
      if (course.time === 'TBA' || course.days === 'TBA') return false;
      return parseCourseDays(course.days).some((day) => weekdayIndex(day) === cursor.getDay());
    });

    if (dayCourses.length === 0) continue;

    const notifyAt = new Date(cursor);
    notifyAt.setHours(summaryHour, 0, 0, 0);
    if (notifyAt <= now) continue;

    dates.push({ notifyAt, courses: dayCourses });
  }

  return dates;
}


const AUTH_SCREEN_W = Dimensions.get('window').width;

function AuthNavigator({
  stack,
  onPop,
  renderScreen,
}: {
  stack: AuthScreen[];
  onPop: () => void;
  renderScreen: (s: AuthScreen, goBack: () => void) => React.ReactNode;
}) {
  const W = AUTH_SCREEN_W;
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
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: false, tension: 100, friction: 16 }).start();
    }
  }, [stack.length]);

  const goBack = () => {
    Animated.timing(slideAnim, { toValue: W, duration: 260, useNativeDriver: false }).start(() => {
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
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: false, tension: 100, friction: 16 }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: false, tension: 100, friction: 16 }).start();
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
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [authInitializing, setAuthInitializing] = useState(true);
  const [userBootstrapLoading, setUserBootstrapLoading] = useState(false);
  // Ref so the onAuthStateChange closure (created once) always sees current userId.
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = userId;
  const returnToUniversityAfterSignOutRef = useRef(false);
  const suppressNextSignedOutClearRef = useRef(false);
  const pendingAuthUniversityRef = useRef<University | null>(null);

  const hydrateUserFromSession = (sessionUser: { id: string; email?: string | null; user_metadata?: Record<string, any> }) => {
    const email = sessionUser.email ?? '';
    const isReviewAccount = isReviewAccountEmail(email);
    setUserBootstrapLoading(true);
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
    if (isReviewAccount) {
      setForceReviewOnboardingOnce(true);
      setNeedsFeatureOnboarding(true);
      setShowNotificationPermissionPrompt(false);
      setShowBrandIntro(false);
    }
  };

  const clearSignedOutState = () => {
    pendingAuthUniversityRef.current = null;
    setUserId(null);
    setUserEmail('');
    setSelectedUniversity(null);
    setExpoPushToken(null);
    setUnreadMessageCount(0);
    setUserProfile(fallbackProfileFromEmail(`student${DEFAULT_UNIVERSITY.domain}`));
    setUserSettings(DEFAULT_USER_SETTINGS);
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
    setUserBootstrapLoading(false);
    setAuthStack(returnToUniversityAfterSignOutRef.current ? ['welcome', 'university'] : ['welcome']);
    returnToUniversityAfterSignOutRef.current = false;
  };

  const validateAndHydrateSession = async (
    sessionUser: { id: string; email?: string | null; user_metadata?: Record<string, any> },
    active = true
  ) => {
    const { data, error } = await supabase.auth.getUser();
    if (!active) return;

    if (error || !data.user || data.user.id !== sessionUser.id) {
      await supabase.auth.signOut();
      clearSignedOutState();
      setAuthInitializing(false);
      return;
    }

    hydrateUserFromSession(data.user);
    setAuthInitializing(false);
  };

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;

      if (error) {
        console.error('Failed to restore auth session:', error);
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
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingRegion, setSavingRegion] = useState(false);
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
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);
  const [currentTab, setCurrentTab] = useState<'home' | 'timetable' | 'grades' | 'board' | 'friends'>('home');
  const [homeTabTapCount, setHomeTabTapCount] = useState(0);
  const [timetableTabTapCount, setTimetableTabTapCount] = useState(0);
  const [gradesTabTapCount, setGradesTabTapCount] = useState(0);
  const [boardTabTapCount, setBoardTabTapCount] = useState(0);
  const [friendsTabTapCount, setFriendsTabTapCount] = useState(0);
  const [showMessages, setShowMessages] = useState(false);
  const [messageTarget, setMessageTarget] = useState<ChatTarget | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  const TABS = ['home', 'timetable', 'grades', 'board', 'friends'] as const;
  const tabBarWidthRef = useRef(0);
  const [tabBarReady, setTabBarReady] = useState(false);
  const pillXAnim = useRef(new Animated.Value(0)).current;
  const pillScaleAnim = useRef(new Animated.Value(1)).current;
  const isDraggingPill = useRef(false);
  const pillDragStartX = useRef(0);
  const currentTabRef = useRef(currentTab);
  currentTabRef.current = currentTab;

  const pillPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      isDraggingPill.current = false;
      pillDragStartX.current = (pillXAnim as any)._value;
      Animated.spring(pillScaleAnim, { toValue: 1.15, useNativeDriver: false, tension: 300, friction: 10 }).start();
    },
    onPanResponderMove: (_, gs) => {
      if (Math.abs(gs.dx) > 5) isDraggingPill.current = true;
      if (!isDraggingPill.current) return;
      const w = tabBarWidthRef.current;
      const tabW = w / 5;
      pillXAnim.setValue(Math.max(0, Math.min(w - tabW, pillDragStartX.current + gs.dx)));
    },
    onPanResponderRelease: (_, gs) => {
      Animated.spring(pillScaleAnim, { toValue: 1, useNativeDriver: false, tension: 300, friction: 10 }).start();
      if (isDraggingPill.current) {
        const tabW = tabBarWidthRef.current / 5;
        const nearestIdx = Math.max(0, Math.min(4, Math.round((pillXAnim as any)._value / tabW)));
        Animated.spring(pillXAnim, { toValue: nearestIdx * tabW, useNativeDriver: false, tension: 160, friction: 18 }).start();
        const newTab = TABS[nearestIdx];
        if (newTab !== currentTabRef.current) {
          if (newTab === 'friends') handleOpenFriendsTabRef.current?.();
          else (setCurrentTab as (t: typeof TABS[number]) => void)(newTab);
        }
      } else {
        const tab = currentTabRef.current;
        if (tab === 'home') setHomeTabTapCount(c => c + 1);
        else if (tab === 'timetable') setTimetableTabTapCount(c => c + 1);
        else if (tab === 'grades') setGradesTabTapCount(c => c + 1);
        else if (tab === 'board') setBoardTabTapCount(c => c + 1);
        else if (tab === 'friends') setFriendsTabTapCount(c => c + 1);
      }
      isDraggingPill.current = false;
    },
    onPanResponderTerminate: () => {
      isDraggingPill.current = false;
      const tabW = tabBarWidthRef.current / 5;
      Animated.spring(pillXAnim, { toValue: TABS.indexOf(currentTabRef.current) * tabW, useNativeDriver: false, tension: 160, friction: 18 }).start();
      Animated.spring(pillScaleAnim, { toValue: 1, useNativeDriver: false, tension: 300, friction: 10 }).start();
    },
  })).current;

  useEffect(() => {
    if (!tabBarReady || isDraggingPill.current) return;
    const tabW = tabBarWidthRef.current / 5;
    Animated.spring(pillXAnim, { toValue: TABS.indexOf(currentTab) * tabW, useNativeDriver: false, tension: 160, friction: 18 }).start();
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
  const settingsSheetAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const pickerTranslateY = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const seenFriendRequestIdsRef = useRef<Set<string>>(new Set());
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const seenCommentIdsRef = useRef<Set<string>>(new Set());
  const seenLikeKeysRef = useRef<Set<string>>(new Set());
  const lastSocialNotificationErrorRef = useRef(0);
  const currentSchool = selectedUniversity?.name ?? DEFAULT_UNIVERSITY.name;

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
      .is('deleted_at', null);

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

    const refreshUnreadMessages = async () => {
      const count = await loadUnreadMessageCount();
      if (!cancelled) setUnreadMessageCount(count);
    };

    void refreshUnreadMessages();
    const interval = setInterval(() => {
      void refreshUnreadMessages();
    }, 30000);

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
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [USER_ID, loadUnreadMessageCount]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      void Notifications.setNotificationChannelAsync('reminders', {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    let active = true;

    async function loadUserPreferences() {
      setUserBootstrapLoading(true);
      const fallback = fallbackProfileFromEmail(userEmail || `student${DEFAULT_UNIVERSITY.domain}`);
      let settingsDetails: Record<string, any> | null | undefined;

      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .eq('school', currentSchool)
        .maybeSingle();

      if (profileError) {
        console.error('Failed to load profile:', profileError);
      }

      const { data: settingsRow, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (settingsError && settingsError.code !== 'PGRST205') {
        console.error('Failed to load user settings:', settingsError);
      }

      if (!active) return;

      settingsDetails =
        (settingsRow as Record<string, any> | null | undefined)?.profile_details as Record<string, any> | null | undefined;
      const forceFeatureOnboarding = forceReviewOnboardingOnce && isReviewAccountEmail(userEmail);

      setUserProfile(
        profileFromSources(
          (profileRow as Record<string, any> | null | undefined) ?? null,
          userEmail || fallback.email,
          settingsDetails
        )
      );

      if (!profileRow && !settingsRow) {
        setNeedsProfileSetup(false);
        setNeedsFeatureOnboarding(true);
        setShowNotificationPermissionPrompt(false);
      } else if (!settingsRow) {
        setNeedsProfileSetup(false);
        setNeedsFeatureOnboarding(true);
        setShowNotificationPermissionPrompt(false);
      } else if (settingsDetails?.profileSetupComplete === false) {
        setNeedsProfileSetup(false);
        setNeedsFeatureOnboarding(true);
        setShowNotificationPermissionPrompt(false);
      } else if (hasCompletedProfileSetup(settingsDetails)) {
        setNeedsProfileSetup(false);
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
        timeZone: normalizeTimeZonePreference(settingsDetails?.timeZone),
        dateFormat: normalizeDateFormatPreference(settingsDetails?.dateFormat),
      });
      setExpoPushToken(((settingsRow as Record<string, any> | null | undefined)?.expo_push_token as string | undefined) ?? null);
      pendingAuthUniversityRef.current = null;
      setUserBootstrapLoading(false);
    }

    loadUserPreferences();

    return () => {
      active = false;
    };
  }, [currentSchool, forceReviewOnboardingOnce, userEmail, userId]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

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
      console.error(label, error);
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
        console.error('Failed to present in-app notification:', error);
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
            .order('created_at', { ascending: true });

          if (messageError) {
            if (messageError.code !== 'PGRST205') {
              logSnapshotQueryError('Failed to load message notifications:', messageError);
            }
          } else {
            messageRows = (messageData ?? []) as ConversationMessageNotificationRow[];
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

    void bootstrapSocialNotificationState().then(() => {
      if (cancelled) return;
      intervalId = setInterval(() => {
        void pollSocialNotifications();
      }, 30000);
    });

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentSchool, userId, userSettings.notifications, userSettings.pushPermissionStatus]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function rescheduleReminderNotifications() {
      await Notifications.cancelAllScheduledNotificationsAsync();

      const notifications = userSettings.notifications;
      if (!notifications.pushNotifications || userSettings.pushPermissionStatus !== 'granted') return;

      const currentQuarter = getAcademicTermForDate(currentSchool, new Date());
      const quarterMatchesCurrent =
        currentQuarter.year === selectedQuarter.year && currentQuarter.quarter === selectedQuarter.quarter;

      if (notifications.dailyScheduleSummary && quarterMatchesCurrent) {
        const dailySummaries = buildDailyScheduleSummaryDates(
          activeCourses,
          14,
          normalizeDailyScheduleSummaryHour(notifications.dailyScheduleSummaryHour)
        );
        for (const summary of dailySummaries) {
          if (cancelled) return;
          const classCount = summary.courses.length;
          const summaryTitle = classCount === 1 ? 'You have 1 class today' : `You have ${classCount} classes today`;
          const summaryBody = buildDailyScheduleNotificationBody(summary.courses);

          await Notifications.scheduleNotificationAsync({
            content: {
              title: summaryTitle,
              body: summaryBody,
              data: { type: 'daily-schedule-summary', count: String(classCount) },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: summary.notifyAt,
            },
          });
        }
      }

      if (notifications.classReminders && quarterMatchesCurrent) {
        const classReminders = buildUpcomingClassReminderDates(activeCourses, notifications.classReminderMinutes);
        for (const reminder of classReminders) {
          if (cancelled) return;
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `${reminder.course.code} starts soon`,
              body: `${reminder.course.title} begins in ${notifications.classReminderMinutes} minutes${reminder.course.location ? ` at ${reminder.course.location}` : ''}.`,
              data: { type: 'class-reminder', courseId: reminder.course.id },
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
              content: {
                title: `${event.sport} game reminder`,
                body: `${event.title} starts in ${notifications.sportsGameReminderMinutes} minutes${event.location ? ` at ${event.location}` : ''}.`,
                data: { type: 'sports-reminder', eventId: event.id },
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: notifyAt,
              },
            });
          }
        } catch (error) {
          console.error('Failed to schedule sports reminders:', error);
        }
      }
    }

    void rescheduleReminderNotifications();

    return () => {
      cancelled = true;
    };
  }, [activeCourses, currentSchool, selectedQuarter.quarter, selectedQuarter.year, userId, userSettings]);

  // Load all timetables from Supabase on mount (or when user logs in)
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      setTimetables([]);
      setSelectedTimetableId(null);

      let { data, error } = await supabase
        .from('timetables')
        .select('*')
        .eq('user_id', USER_ID)
        .eq('school', currentSchool);

      if (error && currentSchool === DEFAULT_UNIVERSITY.name && isMissingSchoolColumnError(error)) {
        const fallback = await supabase
          .from('timetables')
          .select('*')
          .eq('user_id', USER_ID);
        data = fallback.data;
        error = fallback.error;
      }

      if (cancelled) return;
      if (error) { console.error('Failed to load timetables:', error); return; }

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
    if (error) console.error('Failed to save timetable:', error);
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

    if (error || !data) { console.error('Failed to create timetable:', error); return null; }

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
  };

  const handleReplaceCourse = async (oldId: string, newCourse: Course) => {
    const target = activeTimetable;
    if (!target) return;
    const newCourses = target.courses.map((c) => (c.id === oldId ? newCourse : c));
    const updated = { ...target, courses: newCourses };
    setTimetables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    await saveTimetable(updated);
  };

  const openSettingsSheet = () => {
    settingsBackdropAnim.setValue(0);
    settingsSheetAnim.setValue(Dimensions.get('window').height);
    setShowSettings(true);
    Animated.parallel([
      Animated.spring(settingsSheetAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 16 }),
      Animated.timing(settingsBackdropAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  };

  const closeSettingsSheet = () => {
    Animated.parallel([
      Animated.timing(settingsSheetAnim, { toValue: Dimensions.get('window').height, duration: 220, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(settingsBackdropAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
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
    if (error) { console.error('Failed to delete timetable:', error); return; }

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
    const screenHeight = Dimensions.get('window').height;

    if (showCoursePicker) {
      setRenderCoursePicker(true);
      pickerTranslateY.setValue(screenHeight);
      Animated.timing(pickerTranslateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(pickerTranslateY, {
      toValue: screenHeight,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setRenderCoursePicker(false);
    });
  }, [pickerTranslateY, showCoursePicker]);

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

    const payload = {
      user_id: userId,
      timetable_visibility: nextSettings.timetableVisibility,
      notification_settings: nextSettings.notifications,
      push_permission_status: nextSettings.pushPermissionStatus,
      expo_push_token: nextExpoPushToken,
      profile_details: {
        ...profileDetailsFromProfile(
          nextProfile,
          nextSettings.boardProfileVisible,
          profileSetupComplete,
          onboardingComplete
        ),
        language: nextSettings.language,
        timeZone: nextSettings.timeZone,
        dateFormat: nextSettings.dateFormat,
      },
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('user_settings').upsert(payload);
    if (error) {
      console.error('Failed to save user settings:', error);
      Alert.alert(
        'Could not save settings',
        error.code === 'PGRST205'
          ? 'The user_settings table is missing in Supabase. Run the required SQL first.'
          : error.message
      );
      throw error;
    }
  };

  const resolveExpoProjectId = () => {
    return (
      Constants.easConfig?.projectId ||
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ||
      undefined
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
      setShowBrandIntro(true);
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
      console.error('Failed to request notification permissions:', error);
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

  const openMessages = (target?: ChatTarget | null) => {
    setMessageTarget(target ?? null);
    setShowMessages(true);
  };

  const closeMessages = () => {
    setShowMessages(false);
    setMessageTarget(null);
    void loadUnreadMessageCount().then(setUnreadMessageCount);
  };

  // ── auth screens ─────────────────────────────────────────────────────────────

  if (authInitializing) {
    return <View style={{ flex: 1, backgroundColor: isDark ? '#09111d' : '#f4f7ff' }} />;
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
              setUserBootstrapLoading(true);
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
            setUserBootstrapLoading(true);
            setForceReviewOnboardingOnce(shouldForceReviewOnboarding);
            setNeedsFeatureOnboarding(shouldForceReviewOnboarding);
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

  if (userBootstrapLoading) {
    return <View style={{ flex: 1, backgroundColor: isDark ? '#09111d' : '#f4f7ff' }} />;
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
    return <ClassMateIntroScreen onComplete={() => setShowBrandIntro(false)} />;
  }

  if (needsFeatureOnboarding) {
    return (
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
  }

  // ── main app ──────────────────────────────────────────────────────────────────

  let content = null;

  if (currentTab === 'home') {
    content = (
      <HomeScreen
        activeCourses={homeQuarterCourses}
        selectedQuarter={homeQuarterKey === academicQuarterKey ? academicQuarter : selectedQuarter}
        onOpenSettings={openSettingsSheet}
        userId={USER_ID}
        bottomInset={insets.bottom}
        scrollToTopTrigger={homeTabTapCount}
        school={currentSchool}
      />
    );
  } else if (currentTab === 'timetable') {
    content = (
      <View style={{ flex: 1, paddingTop: 62, backgroundColor: colors.bg }}>
        <TimetableScreen
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
          onSettingsApply={setTimetableSettings}
          bottomInset={insets.bottom}
          scrollToTopTrigger={timetableTabTapCount}
        />
      </View>
    );
  } else if (currentTab === 'grades') {
    content = (
      <GradesScreen
        timetables={timetables}
        userId={USER_ID}
        school={currentSchool}
        bottomInset={insets.bottom}
        scrollToTopTrigger={gradesTabTapCount}
      />
    );
  } else if (currentTab === 'board') {
    content = (
      <BoardScreen
        school={currentSchool}
        userId={USER_ID}
        boardAuthorName={userProfile.nickname.trim() || displayUserName}
        boardProfileVisible={userSettings.boardProfileVisible}
        bottomInset={insets.bottom}
        scrollToTopTrigger={boardTabTapCount}
        onOpenMessages={() => openMessages(null)}
        onOpenChat={openMessages}
        unreadMessageCount={unreadMessageCount}
      />
    );
  } else if (currentTab === 'friends') {
    content = (
      <View style={{ flex: 1, paddingTop: 62, backgroundColor: colors.bg }}>
        <FriendsScreen
          userId={USER_ID}
          userEmail={userEmail}
          school={currentSchool}
          activeCourses={homeQuarterKey === academicQuarterKey ? homeQuarterCourses : []}
          selectedQuarter={academicQuarter}
          bottomInset={insets.bottom}
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
  }: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    active: boolean;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 7,
        paddingHorizontal: 4,
      }}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={active ? colors.brand : colors.text} />
      <Text
        style={{
          marginTop: 2,
          fontSize: 10,
          color: active ? colors.brand : colors.text,
          fontWeight: active ? '600' : '400',
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
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
          left: 16,
          right: 16,
          bottom: insets.bottom - 6,
          padding: 1,
          borderRadius: 28,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.86)',
          backgroundColor: isDark ? 'rgba(30,30,34,0.72)' : 'rgba(236,242,255,0.80)',
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: isDark ? 0.28 : 0.16,
          shadowRadius: 24,
          elevation: 14,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 27,
            backgroundColor: isDark ? 'rgba(20,20,24,0.26)' : 'rgba(255,255,255,0.16)',
          }}
        >
          <View
            style={{ flexDirection: 'row' }}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w <= 0) return;
              tabBarWidthRef.current = w;
              if (!tabBarReady) {
                pillXAnim.setValue(TABS.indexOf(currentTab) * (w / 5));
                setTabBarReady(true);
              }
            }}
          >
            {/* Glass pill — behind tab items so icons render on top */}
            {tabBarReady && (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: tabBarWidthRef.current / 5,
                  borderRadius: 19,
                  overflow: 'hidden',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.38)',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.7)',
                  shadowColor: '#fff',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: isDark ? 0.06 : 0.35,
                  shadowRadius: 6,
                  transform: [{ translateX: pillXAnim }, { scale: pillScaleAnim }],
                }}
              />
            )}
            <TabItem label="Today" icon="home-outline" active={currentTab === 'home'} onPress={() => { if (currentTab === 'home') setHomeTabTapCount(c => c + 1); else setCurrentTab('home'); }} />
            <TabItem label="Timetable" icon="calendar-outline" active={currentTab === 'timetable'} onPress={() => { if (currentTab === 'timetable') setTimetableTabTapCount(c => c + 1); else setCurrentTab('timetable'); }} />
            <TabItem label="Grades" icon="school-outline" active={currentTab === 'grades'} onPress={() => { if (currentTab === 'grades') setGradesTabTapCount(c => c + 1); else setCurrentTab('grades'); }} />
            <TabItem label="Board" icon="clipboard-outline" active={currentTab === 'board'} onPress={() => { if (currentTab === 'board') setBoardTabTapCount(c => c + 1); else setCurrentTab('board'); }} />
            <TabItem label="ClassMates" icon="person-add-outline" active={currentTab === 'friends'} onPress={() => { if (currentTab === 'friends') setFriendsTabTapCount(c => c + 1); else handleOpenFriendsTab(); }} />
            {/* Transparent drag-capture layer — on top so PanResponder receives touches */}
            {tabBarReady && (
              <Animated.View
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: tabBarWidthRef.current / 5,
                  transform: [{ translateX: pillXAnim }],
                }}
                {...pillPanResponder.panHandlers}
              />
            )}
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
              school={currentSchool}
              userProfile={userProfile}
              userSettings={userSettings}
              themePreference={themePreference}
              onThemeChange={onThemeChange}
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
            onEditingHandled={() => setEditingCustomCourse(null)}
          />
        </Animated.View>
      )}
    </View>
  );
}

export default function App() {
  const [themePreference, setThemePreference] = useState<ThemePreference>('auto');
  return (
    <SafeAreaProvider>
      <ThemeProvider preference={themePreference}>
        <AppErrorBoundary>
          <AppContent themePreference={themePreference} onThemeChange={setThemePreference} />
        </AppErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

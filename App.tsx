import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Easing, Platform, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { ThemeProvider, ThemePreference, useTheme } from './src/context/ThemeContext';
import HomeScreen from './src/screens/HomeScreen';
import TimetableScreen from './src/screens/TimetableScreen';
import GradesScreen from './src/screens/GradesScreen';
import CoursePickerScreen from './src/screens/CoursePickerScreen';
import FriendsScreen from './src/screens/FriendsScreen';
import BoardScreen from './src/screens/BoardScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import UniversitySelectionScreen from './src/screens/UniversitySelectionScreen';
import SignInScreen from './src/screens/SignInScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import { Course, Quarter, Timetable, TimetableSettings, DEFAULT_TIMETABLE_SETTINGS, quarterKey } from './src/data/courses';
import {
  buildDisplayName,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_USER_SETTINGS,
  fallbackProfileFromEmail,
  profileDetailsFromProfile,
  profileFromSources,
} from './src/data/userPreferences';
import { parseSportsCalendar } from './src/data/sportsEvents';
import { supabase } from './src/lib/supabase';
import type { University } from './src/screens/UniversitySelectionScreen';
import type { EditableProfile, NotificationPreferences, PushPermissionStatus, TimetableVisibility, UserSettingsState } from './src/data/userPreferences';

type AuthScreen = 'welcome' | 'university' | 'signin' | 'signup';

type AppContentProps = { themePreference: ThemePreference; onThemeChange: (v: ThemePreference) => void };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getAcademicQuarterForDate(date: Date): Quarter {
  const month = date.getMonth();
  if (month <= 2) return { year: String(date.getFullYear()), quarter: 'Winter' };
  if (month <= 5) return { year: String(date.getFullYear()), quarter: 'Spring' };
  return { year: String(date.getFullYear()), quarter: 'Fall' };
}

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

function weekdayIndex(day: string) {
  const map: Record<string, number> = { Su: 0, M: 1, T: 2, W: 3, Th: 4, F: 5, Sa: 6 };
  return map[day] ?? -1;
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

function AppContent({ themePreference, onThemeChange }: AppContentProps) {
  const { colors, isDark } = useTheme();
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userProfile, setUserProfile] = useState<EditableProfile>(fallbackProfileFromEmail('student@uci.edu'));
  const [userSettings, setUserSettings] = useState<UserSettingsState>(DEFAULT_USER_SETTINGS);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [useCelsius, setUseCelsius] = useState(true);
  const [authScreen, setAuthScreen] = useState<AuthScreen>('welcome');
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);
  const [currentTab, setCurrentTab] = useState<'home' | 'timetable' | 'grades' | 'board' | 'friends'>('home');
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [renderCoursePicker, setRenderCoursePicker] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<Quarter>({ year: '2026', quarter: 'Spring' });
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [selectedTimetableId, setSelectedTimetableId] = useState<string | null>(null);
  const [focusedCourseId, setFocusedCourseId] = useState<string | null>(null);
  const [timetableSettings, setTimetableSettings] = useState<TimetableSettings>(DEFAULT_TIMETABLE_SETTINGS);
  const [showMessages, setShowMessages] = useState(false);
  const [messagesOpenWith, setMessagesOpenWith] = useState<string | null>(null);
  const pickerTranslateY = useRef(new Animated.Value(Dimensions.get('window').height)).current;

  const activeKey = quarterKey(selectedQuarter);
  const quarterTimetables = timetables.filter((t) => t.quarterKey === activeKey);
  const activeTimetable = quarterTimetables.find((t) => t.id === selectedTimetableId) ?? quarterTimetables[0] ?? null;
  const activeCourses = activeTimetable?.courses ?? [];

  const USER_ID = userId ?? 'guest';
  const isGuestUser = !!userId?.startsWith('guest');
  const displayUserName = buildDisplayName({ ...userProfile, email: userEmail || userProfile.email });
  const currentSchool = selectedUniversity?.name ?? 'UC Irvine';

  useEffect(() => {
    if (!userId || !userEmail || isGuestUser) return;
    async function ensureProfile() {
      const fallbackName = userEmail.split('@')[0]
        .split(/[._-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ') || 'Student';

      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        email: userEmail,
        name: fallbackName,
        school: currentSchool,
        updated_at: new Date().toISOString(),
      });

      if (error) console.error('Failed to ensure profile:', error);
    }
    ensureProfile();
  }, [currentSchool, isGuestUser, userEmail, userId]);

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

    if (isGuestUser) {
      const fallback = fallbackProfileFromEmail(userEmail || `${userId}@uci.edu`);
      setUserProfile(fallback);
      setUserSettings({
        ...DEFAULT_USER_SETTINGS,
        notifications: {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
        },
      });
      return;
    }

    let active = true;

    async function loadUserPreferences() {
      const fallback = fallbackProfileFromEmail(userEmail || 'student@uci.edu');

      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
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

      setUserProfile(
        profileFromSources(
          (profileRow as Record<string, any> | null | undefined) ?? null,
          userEmail || fallback.email,
          (settingsRow as Record<string, any> | null | undefined)?.profile_details as Record<string, any> | null | undefined
        )
      );

      setUserSettings({
        timetableVisibility: ((settingsRow as Record<string, any> | null | undefined)?.timetable_visibility as TimetableVisibility | undefined) ?? DEFAULT_USER_SETTINGS.timetableVisibility,
        notifications: {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          ...(((settingsRow as Record<string, any> | null | undefined)?.notification_settings as NotificationPreferences | undefined) ?? {}),
        },
        pushPermissionStatus: ((settingsRow as Record<string, any> | null | undefined)?.push_permission_status as PushPermissionStatus | undefined) ?? DEFAULT_USER_SETTINGS.pushPermissionStatus,
      });
    }

    loadUserPreferences();

    return () => {
      active = false;
    };
  }, [isGuestUser, userEmail, userId]);

  useEffect(() => {
    if (!userId || isGuestUser) return;

    let cancelled = false;

    async function rescheduleReminderNotifications() {
      await Notifications.cancelAllScheduledNotificationsAsync();

      const notifications = userSettings.notifications;
      if (!notifications.pushNotifications || userSettings.pushPermissionStatus !== 'granted') return;

      const currentQuarter = getAcademicQuarterForDate(new Date());
      const quarterMatchesCurrent =
        currentQuarter.year === selectedQuarter.year && currentQuarter.quarter === selectedQuarter.quarter;

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

      if (notifications.sportsGameReminders && currentSchool === 'UC Irvine') {
        try {
          const response = await fetch('https://ucirvinesports.com/calendar.ics');
          const text = await response.text();
          const events = parseSportsCalendar(text, { maxDaysAhead: 14, includePastDays: 0 });

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
  }, [activeCourses, currentSchool, isGuestUser, selectedQuarter.quarter, selectedQuarter.year, userId, userSettings]);

  // Load all timetables from Supabase on mount (or when user logs in)
  useEffect(() => {
    if (!userId) return;
    async function load() {
      const { data, error } = await supabase
        .from('timetables')
        .select('*')
        .eq('user_id', USER_ID);

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

      if (loaded.length === 0) {
        // New user — bootstrap with an empty 'My Schedule' for the current quarter
        await createTimetable(activeKey, 'My Schedule');
      } else {
        // Auto-select first timetable for the default quarter
        const forCurrentQuarter = loaded.filter((t) => t.quarterKey === activeKey);
        if (forCurrentQuarter.length > 0) {
          setSelectedTimetableId(forCurrentQuarter[0].id);
        }
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function saveTimetable(t: Timetable) {
    const { error } = await supabase.from('timetables').upsert({
      id: t.id,
      user_id: USER_ID,
      quarter_key: t.quarterKey,
      name: t.name,
      courses: t.courses,
      order: t.order,
      updated_at: new Date().toISOString(),
    });
    if (error) console.error('Failed to save timetable:', error);
  }

  async function createTimetable(qKey: string, name: string): Promise<Timetable | null> {
    const nextOrder = timetables.filter((t) => t.quarterKey === qKey).length;
    const { data, error } = await supabase
      .from('timetables')
      .insert({ user_id: USER_ID, quarter_key: qKey, name, courses: [], order: nextOrder })
      .select()
      .single();

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
    let code = 65; // 'A'
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

  const CURRENT_QUARTER: Quarter = { year: '2026', quarter: 'Spring' };

  const handleDeleteTimetable = async () => {
    if (!activeTimetable) return;
    const { error } = await supabase.from('timetables').delete().eq('id', activeTimetable.id);
    if (error) { console.error('Failed to delete timetable:', error); return; }

    const remaining = quarterTimetables.filter((t) => t.id !== activeTimetable.id);
    let updatedTimetables = timetables.filter((t) => t.id !== activeTimetable.id);

    // If 'My Schedule' no longer exists in this quarter, promote the first remaining one
    if (remaining.length > 0 && !remaining.some((t) => t.name === 'My Schedule')) {
      const toRename = remaining[0];
      await supabase.from('timetables').update({ name: 'My Schedule' }).eq('id', toRename.id);
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
        return supabase.from('timetables').update({ order: newOrder }).eq('id', id);
      })
    );
  };

  const handleOpenMessages = (name: string) => {
    setMessagesOpenWith(name || null);
    setShowMessages(true);
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
    void Notifications.cancelAllScheduledNotificationsAsync();
    setUserId(null);
    setUserEmail('');
    setUserProfile(fallbackProfileFromEmail('student@uci.edu'));
    setUserSettings(DEFAULT_USER_SETTINGS);
    setTimetables([]);
    setSelectedTimetableId(null);
    setAuthScreen('welcome');
  };

  const saveUserSettingsRow = async (
    nextSettings: UserSettingsState,
    nextProfile: EditableProfile = userProfile
  ) => {
    if (!userId || isGuestUser) {
      Alert.alert('Sign in required', 'Please sign in with your university account to save settings.');
      throw new Error('guest-user-settings');
    }

    const payload = {
      user_id: userId,
      timetable_visibility: nextSettings.timetableVisibility,
      notification_settings: nextSettings.notifications,
      push_permission_status: nextSettings.pushPermissionStatus,
      profile_details: profileDetailsFromProfile(nextProfile),
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

  const handleSaveProfile = async (nextProfile: EditableProfile): Promise<boolean> => {
    if (!userId || isGuestUser) {
      Alert.alert('Sign in required', 'Please sign in with your university account to save your profile.');
      return false;
    }

    setSavingProfile(true);
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
      await saveUserSettingsRow(nextSettings, next);
      setUserProfile(next);
      return true;
    } catch {
      return false;
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveVisibility = async (visibility: TimetableVisibility): Promise<boolean> => {
    setSavingVisibility(true);
    const nextSettings = { ...userSettings, timetableVisibility: visibility };
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
      await saveUserSettingsRow(nextSettings);
      setUserSettings(nextSettings);
      return true;
    } catch {
      return false;
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleOpenFriendsTab = () => {
    if (isGuestUser) {
      Alert.alert(
        'Sign in required',
        'ClassMates is available only for signed-in university accounts. Sign in with Google to search classmates, send requests, and view shared schedules.'
      );
      return;
    }
    setCurrentTab('friends');
  };

  // ── auth screens ─────────────────────────────────────────────────────────────

  if (!userId) {
    if (authScreen === 'welcome') {
      return (
        <WelcomeScreen
          onGetStarted={() => setAuthScreen('university')}
        />
      );
    }
    if (authScreen === 'university') {
      return (
        <UniversitySelectionScreen
          onBack={() => setAuthScreen('welcome')}
          onContinue={(uni) => { setSelectedUniversity(uni); setAuthScreen('signin'); }}
        />
      );
    }
    if (authScreen === 'signup') {
      return (
        <SignUpScreen
          university={selectedUniversity ?? undefined}
          onBack={() => setAuthScreen('university')}
          onSignedUp={(id) => setUserId(id)}
          onGoToSignIn={() => setAuthScreen('signin')}
        />
      );
    }
    return (
      <SignInScreen
        university={selectedUniversity ?? { id: '1', name: 'UC Irvine', domain: '@uci.edu', location: 'Irvine, CA', logo: 'UCI' }}
        onBack={() => setAuthScreen('university')}
        onSignedIn={(id, email) => { setUserId(id); setUserEmail(email); }}
        onGoToSignUp={() => setAuthScreen('signup')}
        onGuest={(id) => setUserId(id)}
      />
    );
  }

  // ── main app ──────────────────────────────────────────────────────────────────

  let content = null;

  if (currentTab === 'home') {
    content = (
      <HomeScreen
        activeCourses={activeCourses}
        onGoToTimetable={() => setCurrentTab('timetable')}
        onGoToGrades={() => setCurrentTab('grades')}
        onLogout={handleLogout}
        userName={displayUserName}
        userEmail={userEmail}
        userProfile={userProfile}
        userSettings={userSettings}
        useCelsius={useCelsius}
        onUseCelsiusChange={setUseCelsius}
        themePreference={themePreference}
        onThemeChange={onThemeChange}
        onSaveProfile={handleSaveProfile}
        onSaveVisibility={handleSaveVisibility}
        onSaveNotifications={handleSaveNotifications}
        onRequestPushPermissions={handleRequestPushPermissions}
        savingProfile={savingProfile}
        savingVisibility={savingVisibility}
        savingNotifications={savingNotifications}
      />
    );
  } else if (currentTab === 'timetable') {
    content = (
      <View style={{ flex: 1, paddingTop: 60, backgroundColor: colors.bg }}>
        <TimetableScreen
          activeCourses={activeCourses}
          selectedQuarter={selectedQuarter}
          focusedCourseId={focusedCourseId}
          onFocusCourse={handleFocusCourse}
          onChangeQuarter={handleChangeQuarter}
          onOpenCoursePicker={() => setShowCoursePicker(true)}
          onRemoveCourse={handleToggleCourse}
          school={selectedUniversity?.name ?? 'UC Irvine'}
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
        />
      </View>
    );
  } else if (currentTab === 'grades') {
    content = <GradesScreen timetables={timetables} userId={USER_ID} />;
  } else if (currentTab === 'board') {
    content = <BoardScreen onOpenMessages={handleOpenMessages} school={selectedUniversity?.name ?? 'UC Irvine'} userId={USER_ID} />;
  } else if (currentTab === 'friends') {
    content = (
      <View style={{ flex: 1, paddingTop: 60, backgroundColor: colors.bg }}>
        <FriendsScreen
          onOpenMessages={handleOpenMessages}
          userId={USER_ID}
          userEmail={userEmail}
          school={selectedUniversity?.name ?? 'UC Irvine'}
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
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      onPress={onPress}
    >
      <Ionicons name={icon} size={22} color={active ? colors.brand : colors.textTertiary} />
      <Text
        style={{
          marginTop: 4,
          fontSize: 12,
          color: active ? colors.brand : colors.textTertiary,
          fontWeight: active ? '600' : '400',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaProvider>
    <View style={{ flex: 1, backgroundColor: colors.bgSecondary }}>
      {content}

      <View
        style={{
          flexDirection: 'row',
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: 10,
          paddingBottom: 14,
          backgroundColor: colors.card,
        }}
      >
        <TabItem label="Home" icon="home-outline" active={currentTab === 'home'} onPress={() => setCurrentTab('home')} />
        <TabItem label="Timetable" icon="calendar-outline" active={currentTab === 'timetable'} onPress={() => setCurrentTab('timetable')} />
        <TabItem label="Grades" icon="school-outline" active={currentTab === 'grades'} onPress={() => setCurrentTab('grades')} />
        <TabItem label="Board" icon="clipboard-outline" active={currentTab === 'board'} onPress={() => setCurrentTab('board')} />
        <TabItem label="ClassMates" icon="person-add-outline" active={currentTab === 'friends'} onPress={handleOpenFriendsTab} />
      </View>

      {showMessages && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, elevation: 30 }}>
          <MessagesScreen
            onClose={() => { setShowMessages(false); setMessagesOpenWith(null); }}
            openChatWith={messagesOpenWith}
          />
        </View>
      )}

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
            school={selectedUniversity?.name ?? 'UC Irvine'}
          />
        </Animated.View>
      )}
    </View>
    </SafeAreaProvider>
  );
}

export default function App() {
  const [themePreference, setThemePreference] = useState<ThemePreference>('auto');
  return (
    <ThemeProvider preference={themePreference}>
      <AppContent themePreference={themePreference} onThemeChange={setThemePreference} />
    </ThemeProvider>
  );
}

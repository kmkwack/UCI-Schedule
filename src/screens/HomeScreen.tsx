import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PanResponder, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { Course, Quarter, blockColorKey, pastelForCourse, quarterKey, quarterLabel } from '../data/courses';
import { formatSportsEventTime, parseSportsCalendar, type SportsEvent } from '../data/sportsEvents';
import type { TimetableVisibility } from '../data/userPreferences';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';

type Props = {
  activeCourses: Course[];
  selectedQuarter: Quarter;
  onOpenSettings: () => void;
  userId: string;
  bottomInset?: number;
  scrollToTopTrigger?: number;
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
  sharedCourseIds: string[];
  sharedCourseCodes: string[];
};

type HeroCardItem =
  | { type: 'completedSummary'; courses: Course[] }
  | { type: 'upcomingSummary'; courses: Course[] }
  | { type: 'course'; course: Course };

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const QUARTER_DATES: Record<string, { start: string; end: string }> = {
  '2024-Fall': { start: '2024-09-26', end: '2024-12-13T23:59:59' },
  '2025-Winter': { start: '2025-01-06', end: '2025-03-21T23:59:59' },
  '2025-Spring': { start: '2025-03-31', end: '2025-06-13T23:59:59' },
  '2025-Fall': { start: '2025-09-25', end: '2025-12-12T23:59:59' },
  '2026-Winter': { start: '2026-01-05', end: '2026-03-20T23:59:59' },
  '2026-Spring': { start: '2026-03-30', end: '2026-06-12T23:59:59' },
  '2026-Fall': { start: '2026-09-24', end: '2026-12-11T23:59:59' },
  '2027-Winter': { start: '2027-01-04', end: '2027-03-19T23:59:59' },
  '2027-Spring': { start: '2027-03-29', end: '2027-06-11T23:59:59' },
};

const RAINY_CODES = new Set([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99]);

const WMO_DESCRIPTIONS: Record<number, { label: string; icon: ComponentProps<typeof Ionicons>['name'] }> = {
  0: { label: 'Clear Sky', icon: 'sunny-outline' },
  1: { label: 'Mainly Clear', icon: 'sunny-outline' },
  2: { label: 'Partly Cloudy', icon: 'partly-sunny-outline' },
  3: { label: 'Overcast', icon: 'cloud-outline' },
  45: { label: 'Foggy', icon: 'cloud-outline' },
  48: { label: 'Icy Fog', icon: 'cloud-outline' },
  51: { label: 'Light Drizzle', icon: 'rainy-outline' },
  53: { label: 'Drizzle', icon: 'rainy-outline' },
  55: { label: 'Heavy Drizzle', icon: 'rainy-outline' },
  61: { label: 'Light Rain', icon: 'rainy-outline' },
  63: { label: 'Rain', icon: 'rainy-outline' },
  65: { label: 'Heavy Rain', icon: 'rainy-outline' },
  71: { label: 'Light Snow', icon: 'snow-outline' },
  73: { label: 'Snow', icon: 'snow-outline' },
  75: { label: 'Heavy Snow', icon: 'snow-outline' },
  80: { label: 'Rain Showers', icon: 'rainy-outline' },
  81: { label: 'Rain Showers', icon: 'rainy-outline' },
  82: { label: 'Heavy Showers', icon: 'thunderstorm-outline' },
  95: { label: 'Thunderstorm', icon: 'thunderstorm-outline' },
  96: { label: 'Thunderstorm', icon: 'thunderstorm-outline' },
  99: { label: 'Thunderstorm', icon: 'thunderstorm-outline' },
};

function getQuarterBounds(selectedQuarter: Quarter) {
  const key = `${selectedQuarter.year}-${selectedQuarter.quarter}`;
  const range = QUARTER_DATES[key];
  if (!range) {
    const fallbackStart = new Date(`${selectedQuarter.year}-01-01`);
    const fallbackEnd = new Date(`${selectedQuarter.year}-03-31T23:59:59`);
    return { start: fallbackStart, end: fallbackEnd };
  }
  return { start: new Date(range.start), end: new Date(range.end) };
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

function getDateLabel(now: Date, selectedQuarter: Quarter, quarterStart: Date, quarterEnd: Date) {
  const dayName = DAY_LABELS[now.getDay()];
  const month = MONTH_LABELS[now.getMonth()];
  const date = now.getDate();
  const week = getWeekNumber(now, quarterStart, quarterEnd);
  return `${month} ${date} ${dayName} · ${quarterLabel(selectedQuarter)} · Week ${week}`;
}

function formatEventDayLabel(date: Date) {
  const dayName = DAY_LABELS[date.getDay()];
  const month = MONTH_LABELS[date.getMonth()];
  return `${dayName}, ${month} ${date.getDate()}`;
}

function formatRelativeEventDayLabel(date: Date, now: Date) {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (target.getTime() === today.getTime()) return 'Today';
  if (target.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return formatEventDayLabel(date);
}

function getTodayDayCode(): string | null {
  const day = new Date().getDay();
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

function extractStartHour(timeRange: string) {
  const start = timeRange.split(' - ')[0];
  const [hour, minute] = start.split(':').map(Number);
  return hour + minute / 60;
}

function extractEndHour(timeRange: string) {
  const end = timeRange.split(' - ')[1];
  const [hour, minute] = end.split(':').map(Number);
  return hour + minute / 60;
}

function dateFromHour(baseDate: Date, hourValue: number) {
  const hours = Math.floor(hourValue);
  const minutes = Math.round((hourValue - hours) * 60);
  const next = new Date(baseDate);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function formatClock(date: Date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
  const [start, end] = timeRange.split(' - ');
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);

  const formatPart = (hour: number, minute: number) => {
    const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${normalizedHour}:${minute.toString().padStart(2, '0')}`;
  };

  const startPeriod = startHour >= 12 ? 'PM' : 'AM';
  const endPeriod = endHour >= 12 ? 'PM' : 'AM';

  if (startPeriod === endPeriod) {
    return `${formatPart(startHour, startMinute)}-${formatPart(endHour, endMinute)} ${endPeriod}`;
  }

  return `${formatPart(startHour, startMinute)} ${startPeriod}-${formatPart(endHour, endMinute)} ${endPeriod}`;
}

function buildCourseMatchKey(course: Pick<Course, 'id' | 'code' | 'days' | 'time'>) {
  if (course.id?.trim()) return course.id.trim();
  return `${course.code}|${course.days}|${course.time}`;
}

function coursesMatch(a: Pick<Course, 'id' | 'code' | 'days' | 'time'>, b: Pick<Course, 'id' | 'code' | 'days' | 'time'>) {
  return buildCourseMatchKey(a) === buildCourseMatchKey(b)
    || (a.code === b.code && a.days === b.days && a.time === b.time);
}

function displayTemperature(tempC: number | null, useCelsius: boolean) {
  if (tempC === null) return '--°';
  return useCelsius ? `${Math.round(tempC)}°` : `${Math.round((tempC * 9) / 5 + 32)}°`;
}

function weatherInsightText(tempC: number | null, weatherCode: number | null, useCelsius: boolean) {
  if (tempC === null) return 'Weather is loading for campus.';
  const tempLabel = displayTemperature(tempC, useCelsius);
  if (weatherCode !== null && RAINY_CODES.has(weatherCode)) {
    return `${tempLabel} and wet on campus right now. Umbrella recommended.`;
  }
  if (tempC <= 12) return `${tempLabel} on campus. A light layer should feel better on the walk over.`;
  if (tempC >= 27) return `${tempLabel} on campus. Expect a warmer walk between buildings.`;
  return `${tempLabel} and comfortable for getting around campus.`;
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

export default function HomeScreen({
  activeCourses,
  selectedQuarter,
  onOpenSettings,
  userId,
  bottomInset = 0,
  scrollToTopTrigger = 0,
}: Props) {
  const { colors, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [useCelsius, setUseCelsius] = useState(true);
  const [sportsEvents, setSportsEvents] = useState<SportsEvent[]>([]);
  const [sportsLoading, setSportsLoading] = useState(true);
  const [tempC, setTempC] = useState<number | null>(null);
  const [weatherCode, setWeatherCode] = useState<number | null>(null);
  const [classmateMatches, setClassmateMatches] = useState<ClassmateMatch[]>([]);
  const [now, setNow] = useState(() => new Date());

  const selectedQuarterKey = quarterKey(selectedQuarter);
  const { start: quarterStart, end: quarterEnd } = getQuarterBounds(selectedQuarter);

  useEffect(() => {
    async function loadWeather() {
      const cached = await AsyncStorage.getItem('weather_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        setTempC(parsed.tempC ?? null);
        setWeatherCode(parsed.weatherCode ?? null);
      }
      try {
        const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=33.6405&longitude=-117.8443&current=temperature_2m,weathercode&temperature_unit=celsius');
        const json = await response.json();
        const nextTempC = json.current?.temperature_2m ?? null;
        const nextWeatherCode = json.current?.weathercode ?? null;
        setTempC(nextTempC);
        setWeatherCode(nextWeatherCode);
        void AsyncStorage.setItem('weather_cache', JSON.stringify({ tempC: nextTempC, weatherCode: nextWeatherCode }));
      } catch {}
    }

    void loadWeather();
  }, []);

  useEffect(() => {
    async function loadSports() {
      const cached = await AsyncStorage.getItem('sports_cache');
      if (cached) {
        setSportsEvents(JSON.parse(cached).map((event: any) => ({ ...event, date: new Date(event.date) })));
        setSportsLoading(false);
      }
      try {
        const response = await fetch('https://ucirvinesports.com/calendar');
        const text = await response.text();
        const events = parseSportsCalendar(text, { maxDaysAhead: 7, includePastDays: 0 });
        setSportsEvents(events);
        void AsyncStorage.setItem('sports_cache', JSON.stringify(events));
      } catch {}
      setSportsLoading(false);
    }

    void loadSports();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollToTopTrigger > 0) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scrollToTopTrigger]);

  const homeScheduleSignature = useMemo(
    () => activeCourses.map((course) => buildCourseMatchKey(course)).sort().join(','),
    [activeCourses]
  );

  useEffect(() => {
    if (!userId || activeCourses.length === 0) {
      setClassmateMatches([]);
      return;
    }

    let cancelled = false;

    async function loadClassmates() {
      const cacheKey = `home_classmates_${userId}_${selectedQuarterKey}_${homeScheduleSignature}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached && !cancelled) {
        try {
          setClassmateMatches(JSON.parse(cached) as ClassmateMatch[]);
        } catch {}
      }

      const { data: requestRows, error: requestError } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id, status')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

      if (cancelled) return;
      if (requestError) {
        console.error('Failed to load classmates for home:', requestError);
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

      const [
        { data: profilesData, error: profilesError },
        { data: settingsData, error: settingsError },
        { data: timetableData, error: timetableError },
      ] = await Promise.all([
        supabase.from('profiles').select('id, name, email').in('id', acceptedIds),
        supabase.from('user_settings').select('user_id, timetable_visibility').in('user_id', acceptedIds),
        supabase.from('timetables').select('user_id, name, courses').eq('quarter_key', selectedQuarterKey).in('user_id', acceptedIds),
      ]);

      if (cancelled) return;
      if (profilesError) console.error('Failed to load home classmate profiles:', profilesError);
      if (settingsError) console.error('Failed to load home classmate visibility:', settingsError);
      if (timetableError) console.error('Failed to load home classmate timetables:', timetableError);

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
        const sharedCourses = activeCourses.filter((course) => friendCourses.some((friendCourse) => coursesMatch(course, friendCourse)));

        if (!profile || sharedCourses.length === 0) return [];

        return [{
          id: friendId,
          name: profile.name?.trim() || (profile.email?.split('@')[0] ?? 'Classmate'),
          email: profile.email ?? '',
          sharedCourseIds: sharedCourses.map((course) => buildCourseMatchKey(course)),
          sharedCourseCodes: Array.from(new Set(sharedCourses.map((course) => course.code))),
        }];
      }).sort((left, right) => {
        if (right.sharedCourseIds.length !== left.sharedCourseIds.length) {
          return right.sharedCourseIds.length - left.sharedCourseIds.length;
        }
        return left.name.localeCompare(right.name);
      });

      setClassmateMatches(matches);
      void AsyncStorage.setItem(cacheKey, JSON.stringify(matches));
    }

    void loadClassmates();

    return () => {
      cancelled = true;
    };
  }, [activeCourses, homeScheduleSignature, selectedQuarterKey, userId]);

  const todayCode = getTodayDayCode();
  const todayCourses = useMemo(
    () => (todayCode
      ? activeCourses
          .filter((course) => course.days !== 'TBA' && course.time !== 'TBA' && getDaysArray(course.days).includes(todayCode))
          .sort((left, right) => extractStartHour(left.time) - extractStartHour(right.time))
      : []),
    [activeCourses, todayCode]
  );

  const nowHour = now.getHours() + now.getMinutes() / 60;
  const upcomingClasses = todayCourses.filter((course) => extractStartHour(course.time) > nowHour);
  const completedClasses = todayCourses.filter((course) => extractEndHour(course.time) <= nowHour).length;
  const currentClass = todayCourses.find((course) => extractStartHour(course.time) <= nowHour && extractEndHour(course.time) >= nowHour) ?? null;
  const previousClass = [...todayCourses].reverse().find((course) => extractEndHour(course.time) <= nowHour) ?? null;
  const nextClass = upcomingClasses[0] ?? null;
  const completedCourseList = todayCourses.filter((course) => extractEndHour(course.time) <= nowHour);
  const upcomingCourseList = todayCourses.filter((course) => extractStartHour(course.time) > nowHour);
  const heroItems: HeroCardItem[] = [
    ...(completedCourseList.length > 0 ? [{ type: 'completedSummary' as const, courses: completedCourseList }] : []),
    ...(currentClass ? [{ type: 'course' as const, course: currentClass }] : []),
    ...(upcomingCourseList.length > 0 ? [{ type: 'upcomingSummary' as const, courses: upcomingCourseList }] : []),
  ];
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);

  const daysRemaining = getDaysRemainingInQuarter(now, quarterEnd);
  const quarterProgress = clamp(
    (now.getTime() - quarterStart.getTime()) / Math.max(quarterEnd.getTime() - quarterStart.getTime(), 1),
    0,
    1
  );
  const heroProgress = todayCourses.length === 0 ? 0 : completedClasses / todayCourses.length;

  const visibleCampusEvents = useMemo(
    () => sportsEvents.slice(0, 12),
    [sportsEvents]
  );

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

  const twoColumnWidth = Math.max((windowWidth - 18 * 2 - 12) / 2, 0);
  const heroCardWidth = Math.max(windowWidth - 36, 0);
  const activeHeroItem = heroItems[activeHeroIndex] ?? null;
  const heroAccent = activeHeroItem?.type === 'course'
    ? pastelForCourse(blockColorKey(activeHeroItem.course)).border
    : activeHeroItem?.type === 'upcomingSummary'
      ? colors.brand
    : colors.brand;

  useEffect(() => {
    if (heroItems.length === 0) {
      setActiveHeroIndex(0);
      return;
    }

    const targetIndex = currentClass
      ? Math.max(0, heroItems.findIndex((item) => item.type === 'course' && buildCourseMatchKey(item.course) === buildCourseMatchKey(currentClass)))
      : nextClass
        ? Math.max(0, heroItems.findIndex((item) => item.type === 'upcomingSummary'))
        : 0;
    setActiveHeroIndex(targetIndex);
  }, [heroItems.length, currentClass?.id, nextClass?.id]);

  const heroPanResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dx) < 45 && Math.abs(gesture.vx) < 0.35) return;
        setActiveHeroIndex((prev) => clamp(
          prev + (gesture.dx < 0 ? 1 : -1),
          0,
          Math.max(heroItems.length - 1, 0)
        ));
      },
    }),
    [heroItems.length]
  );

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: 62, paddingHorizontal: 18, paddingBottom: bottomInset + 84 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.8 }}>Today</Text>
          <TouchableOpacity
            onPress={onOpenSettings}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.card,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: '#0f172a',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: isDark ? 0.2 : 0.08,
              shadowRadius: 14,
              elevation: 4,
            }}>
              <Ionicons name="person-outline" size={18} color={colors.brand} />
            </View>
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 4 }}>
          {getDateLabel(now, selectedQuarter, quarterStart, quarterEnd)}
        </Text>
      </View>

      <View style={{ marginBottom: 14, width: heroCardWidth }}>
        {activeHeroItem ? (
          <>
            {(() => {
                const item = activeHeroItem;
                const course = item.type === 'course' ? item.course : null;
                const summaryCourses = item.type !== 'course' ? item.courses : [];
                const firstSummaryCourse = summaryCourses[0] ?? null;
                const lastSummaryCourse = summaryCourses[summaryCourses.length - 1] ?? null;
                const isCurrent = course ? extractStartHour(course.time) <= nowHour && extractEndHour(course.time) >= nowHour : false;
                const startDate = course
                  ? dateFromHour(now, extractStartHour(course.time))
                  : firstSummaryCourse
                    ? dateFromHour(now, extractStartHour(firstSummaryCourse.time))
                    : now;
                const endDate = course
                  ? dateFromHour(now, extractEndHour(course.time))
                  : lastSummaryCourse
                    ? dateFromHour(now, extractEndHour(lastSummaryCourse.time))
                    : now;
                const accent = course
                  ? pastelForCourse(blockColorKey(course)).border
                  : item.type === 'completedSummary'
                    ? colors.textTertiary
                    : colors.brand;
                const courseKey = course ? buildCourseMatchKey(course) : '';
                const courseClassmates = course
                  ? classmateMatches.filter((match) => match.sharedCourseIds.includes(courseKey))
                  : [];
                const progress = isCurrent
                  ? clamp((now.getTime() - startDate.getTime()) / Math.max(endDate.getTime() - startDate.getTime(), 1), 0, 1)
                  : item.type === 'completedSummary'
                    ? 1
                    : 0;
                const label = item.type === 'completedSummary'
                  ? 'Completed'
                  : item.type === 'upcomingSummary'
                    ? 'Coming up'
                    : 'Ends in';
                const value = item.type === 'course'
                  ? formatDuration((endDate.getTime() - now.getTime()) / 60000)
                  : `${summaryCourses.length} class${summaryCourses.length === 1 ? '' : 'es'}`;
                const title = course?.title ?? '';
                const detail = course
                  ? `${formatHeroTimeRange(course.time)} · ${course.location ?? 'Location TBA'}`
                  : '';
                const itemKey = item.type === 'course'
                  ? buildCourseMatchKey(item.course)
                  : `${item.type}-${summaryCourses.map((summaryCourse) => buildCourseMatchKey(summaryCourse)).join('|')}`;

                return (
                  <View key={itemKey} style={{ width: heroCardWidth }} {...(heroItems.length > 1 ? heroPanResponder.panHandlers : {})}>
                    <View style={{
                      ...raisedCardStyle,
                      backgroundColor: colors.card,
                      padding: 22,
                      shadowOpacity: 0,
                      shadowRadius: 0,
                      elevation: 0,
                    }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          {item.type === 'course' ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} />
                              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textTertiary }}>
                                Current class
                              </Text>
                            </View>
                          ) : null}
                          <Text style={{ fontSize: 28, lineHeight: 32, fontWeight: '800', color: colors.text }}>
                            {label}
                          </Text>
                          <Text style={{ fontSize: 28, lineHeight: 32, fontWeight: '800', color: colors.text }}>
                            {value}
                          </Text>
                          {item.type === 'course' ? (
                            <>
                              <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 12 }}>
                                {title}
                              </Text>
                              {courseClassmates.length > 0 ? (
                                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 6 }}>
                                  {courseClassmates.length === 1
                                    ? '1 friend also has this class'
                                    : `${courseClassmates.length} friends also have this class`}
                                </Text>
                              ) : null}
                              <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 6 }}>
                                {detail}
                              </Text>
                            </>
                          ) : (
                            <View style={{ marginTop: 12, gap: 8 }}>
                              {summaryCourses.map((summaryCourse) => (
                                <View
                                  key={buildCourseMatchKey(summaryCourse)}
                                  style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}
                                >
                                  <View style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: 3.5,
                                    backgroundColor: accent,
                                  }} />
                                  <View style={{ flex: 1 }}>
                                    <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>
                                      {summaryCourse.code}
                                    </Text>
                                    <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
                                      {formatHeroTimeRange(summaryCourse.time)} · {summaryCourse.location ?? 'Location TBA'}
                                    </Text>
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                        <View style={{ width: 74, alignItems: 'flex-end' }}>
                          <ProgressRing
                            progress={heroProgress}
                            primaryLabel={`${completedClasses}/${Math.max(todayCourses.length, 1)}`}
                            secondaryLabel="done"
                            color={accent}
                            trackColor={colors.bgTertiary}
                            textColor={colors.text}
                            subTextColor={colors.textTertiary}
                          />
                        </View>
                      </View>

                      <View style={{ marginTop: 20 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text style={{ fontSize: 12, color: colors.textTertiary }}>
                            {formatClock(startDate)}
                          </Text>
                          <Text style={{ fontSize: 12, color: colors.textTertiary }}>
                            {formatClock(endDate)}
                          </Text>
                        </View>
                        <View style={{ position: 'relative', height: 16, justifyContent: 'center' }}>
                          <View style={{ height: isCurrent || item.type === 'completedSummary' ? 7 : 4, borderRadius: 999, backgroundColor: colors.bgTertiary }} />
                          {isCurrent || item.type === 'completedSummary' ? (
                            <View
                              style={{
                                position: 'absolute',
                                left: 0,
                                width: `${progress * 100}%`,
                                height: 7,
                                borderRadius: 999,
                                backgroundColor: item.type === 'completedSummary' ? colors.textTertiary : accent,
                              }}
                            />
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </View>
                );
            })()}
            {heroItems.length > 1 ? (
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 }}>
                {heroItems.map((item, index) => (
                  <View
                    key={`${item.type}-${index}-dot`}
                    style={{
                      width: index === activeHeroIndex ? 16 : 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: index === activeHeroIndex ? heroAccent : colors.bgTertiary,
                    }}
                  />
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <View>
            <View style={{
              ...raisedCardStyle,
              backgroundColor: colors.card,
              padding: 22,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 28, lineHeight: 32, fontWeight: '800', color: colors.text }}>
                    {todayCourses.length > 0 ? 'You are clear for the rest of today' : 'No classes on your schedule today'}
                  </Text>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 12 }}>
                    Take a lighter campus day
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 6 }}>
                    Open your timetable to add a class or switch plans.
                  </Text>
                </View>
                <View style={{ width: 74, alignItems: 'flex-end' }}>
                  <ProgressRing
                    progress={heroProgress}
                    primaryLabel={`${completedClasses}/${Math.max(todayCourses.length, 1)}`}
                    secondaryLabel="done"
                    color={colors.brand}
                    trackColor={colors.bgTertiary}
                    textColor={colors.text}
                    subTextColor={colors.textTertiary}
                  />
                </View>
              </View>
            </View>
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
        <View style={{
          ...raisedCardStyle,
          width: twoColumnWidth,
          backgroundColor: colors.card,
          padding: 18,
        }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
            {quarterLabel(selectedQuarter)}
          </Text>
          <View style={{ alignItems: 'center', marginTop: 16 }}>
            <ProgressRing
              progress={quarterProgress}
              primaryLabel={`${Math.round(quarterProgress * 100)}%`}
              secondaryLabel={`${daysRemaining} days left`}
              color={colors.brand}
              trackColor={colors.bgTertiary}
              textColor={colors.text}
              subTextColor={colors.textTertiary}
              size={112}
              strokeWidth={7}
            />
          </View>
        </View>

        <View style={{
          ...raisedCardStyle,
          width: twoColumnWidth,
          backgroundColor: colors.card,
          padding: 18,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                Weather
              </Text>
              <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text, lineHeight: 32, marginTop: 8 }}>
                {displayTemperature(tempC, useCelsius)}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 6 }}>
                {weatherCode === null ? 'Loading...' : (WMO_DESCRIPTIONS[weatherCode]?.label ?? 'Clear Sky')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Ionicons
                name={weatherCode === null ? 'cloud-outline' : (WMO_DESCRIPTIONS[weatherCode]?.icon ?? 'sunny-outline')}
                size={24}
                color={colors.brand}
              />
              <View style={{
                flexDirection: 'row',
                backgroundColor: colors.inputBg,
                borderRadius: 999,
                padding: 3,
                marginTop: 12,
              }}>
                {[
                  { label: 'C', active: useCelsius, onPress: () => setUseCelsius(true) },
                  { label: 'F', active: !useCelsius, onPress: () => setUseCelsius(false) },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.label}
                    onPress={option.onPress}
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 9,
                      paddingVertical: 5,
                      backgroundColor: option.active ? colors.brand : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: option.active ? '#ffffff' : colors.textSecondary }}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
          <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textTertiary, marginTop: 12 }}>
            {weatherInsightText(tempC, weatherCode, useCelsius)}
          </Text>
        </View>
      </View>

      <View>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 }}>
          Campus Events
        </Text>
        <View style={{
          ...raisedCardStyle,
          backgroundColor: colors.card,
          padding: 18,
        }}>
          {visibleCampusEvents.length > 0 ? (
            <View style={{ gap: 14 }}>
              {visibleCampusEvents.map((event, index) => (
                <View
                  key={`${event.id}-${event.location}-${index}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 12,
                    paddingTop: index === 0 ? 0 : 14,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: colors.borderSubtle,
                  }}
                >
                  <View style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: event.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name={event.icon} size={20} color={event.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                      {event.title}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                      {formatRelativeEventDayLabel(event.date, now)} · {formatSportsEventTime(event.date, event.timeLabel)}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 3 }}>
                      {event.location}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>
              {sportsLoading ? 'Loading campus events...' : 'No upcoming campus events right now.'}
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

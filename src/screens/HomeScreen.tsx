import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActionSheetIOS, ActivityIndicator, Alert, Animated, Keyboard, Linking, Modal, PanResponder, Platform, ScrollView, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import Svg, { Circle } from 'react-native-svg';
import { Course, Quarter, blockColorKey, pastelForCourse, quarterKey } from '../data/courses';
import { getSportsVenueForEvent, type SportsVenue } from '../data/campusLocations';
import { fetchSportsEventsForSchool, formatSportsEventTime, type SportsEvent } from '../data/sportsEvents';
import { academicSystemNoun, getSchoolConfig, schoolCampusLabel, schoolFeatureEnabled, termLabel } from '../data/schools';
import type { TimetableVisibility } from '../data/userPreferences';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { isMissingSchoolColumnError } from '../lib/supabaseErrors';

type Props = {
  activeCourses: Course[];
  selectedQuarter: Quarter;
  onOpenSettings: () => void;
  userId: string;
  school: string;
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

function isOnConflictTargetError(error: any) {
  const message = String(error?.message ?? '').toLowerCase();
  return error?.code === '42P10' || message.includes('no unique or exclusion constraint');
}

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
  '2026-Summer1': { start: '2026-06-22', end: '2026-07-29T23:59:59' },
  '2026-Summer10wk': { start: '2026-06-22', end: '2026-08-28T23:59:59' },
  '2026-Summer2': { start: '2026-08-03', end: '2026-09-09T23:59:59' },
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

const SUMMARY_CARD_HEIGHT = 204;
const SUMMARY_CARD_PADDING = 18;
const WEATHER_DOT_ROW_HEIGHT = 20;
const WEATHER_INSIGHT_LINE_HEIGHT = 18;
const WEATHER_INSIGHT_LINES = 3;

function getQuarterBounds(selectedQuarter: Quarter) {
  const key = `${selectedQuarter.year}-${selectedQuarter.quarter}`;
  const range = QUARTER_DATES[key];
  if (!range) {
    const fallbackByTerm: Record<string, { start: string; end: string }> = {
      Spring: { start: `${selectedQuarter.year}-01-10`, end: `${selectedQuarter.year}-05-15T23:59:59` },
      Summer: { start: `${selectedQuarter.year}-06-01`, end: `${selectedQuarter.year}-08-15T23:59:59` },
      Fall: { start: `${selectedQuarter.year}-08-20`, end: `${selectedQuarter.year}-12-20T23:59:59` },
    };
    const fallback = fallbackByTerm[selectedQuarter.quarter] ?? { start: `${selectedQuarter.year}-01-01`, end: `${selectedQuarter.year}-03-31T23:59:59` };
    const fallbackStart = new Date(fallback.start);
    const fallbackEnd = new Date(fallback.end);
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

function getDateLabel(now: Date, selectedQuarter: Quarter, quarterStart: Date, quarterEnd: Date, school: string) {
  const dayName = DAY_LABELS[now.getDay()];
  const month = MONTH_LABELS[now.getMonth()];
  const date = now.getDate();
  const week = getWeekNumber(now, quarterStart, quarterEnd);
  return `${month} ${date} ${dayName} · ${termLabel(selectedQuarter, school, true)} · Week ${week}`;
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

function formatSportsEventDetailDate(event: SportsEvent) {
  return `${formatEventDayLabel(event.date)} · ${formatSportsEventTime(event.date, event.timeLabel)}`;
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

async function openSportsVenueInMaps(venue: SportsVenue, school: string) {
  const query = encodeURIComponent(`${schoolCampusLabel(school)} ${venue.name}`);
  const appleMapsUrl = `https://maps.apple.com/?ll=${venue.latitude},${venue.longitude}&q=${query}`;
  try {
    await Linking.openURL(appleMapsUrl);
  } catch {}
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

function formatSunTime(value: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
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
  school,
  bottomInset = 0,
  scrollToTopTrigger = 0,
}: Props) {
  const { colors, isDark } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const sportsEventScrollRef = useRef<ScrollView>(null);
  const sportsEventCommentInputRef = useRef<TextInput>(null);
  const [useCelsius, setUseCelsius] = useState(true);
  const [tempUnitLoaded, setTempUnitLoaded] = useState(false);
  const tempToggleAnim = useRef(new Animated.Value(0)).current;
  const [tempPillWidth, setTempPillWidth] = useState(0);
  const weatherPagerRef = useRef<ScrollView>(null);
  const [activeWeatherIndex, setActiveWeatherIndex] = useState(0);
  const [sportsEvents, setSportsEvents] = useState<SportsEvent[]>([]);
  const [sportsLoading, setSportsLoading] = useState(true);
  const [tempC, setTempC] = useState<number | null>(null);
  const [weatherCode, setWeatherCode] = useState<number | null>(null);
  const [sunriseTime, setSunriseTime] = useState<string | null>(null);
  const [sunsetTime, setSunsetTime] = useState<string | null>(null);
  const [classmateMatches, setClassmateMatches] = useState<ClassmateMatch[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [selectedSportsEvent, setSelectedSportsEvent] = useState<SportsEvent | null>(null);
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
  const [sportsEventKeyboardVisible, setSportsEventKeyboardVisible] = useState(false);
  const [sportsEventKeyboardHeight, setSportsEventKeyboardHeight] = useState(0);

  const selectedQuarterKey = quarterKey(selectedQuarter);
  const { start: quarterStart, end: quarterEnd } = getQuarterBounds(selectedQuarter);
  const sportsEventSheetHeight = Math.round(windowHeight * 0.88);
  const sportsEventCommentFooterPadding = sportsEventKeyboardVisible ? 8 : Math.max(bottomInset, 12) + 10;
  const sportsEventScrollBottomPadding = sportsEventKeyboardVisible ? 92 : 18;
  const resetSportsEventDetailScroll = useCallback(() => {
    [0, 80, 180].forEach((delay) => {
      setTimeout(() => sportsEventScrollRef.current?.scrollTo({ y: 0, animated: false }), delay);
    });
  }, []);
  const scrollSportsEventDetailToEnd = useCallback((animated = true, delay = 0) => {
    const run = () => sportsEventScrollRef.current?.scrollToEnd({ animated });
    if (delay > 0) {
      setTimeout(run, delay);
      return;
    }
    requestAnimationFrame(run);
  }, []);
  const settleSportsEventComposer = useCallback((animated = true) => {
    [0, 90, 180, 340].forEach((delay) => scrollSportsEventDetailToEnd(animated, delay));
  }, [scrollSportsEventDetailToEnd]);

  useEffect(() => {
    selectedSportsEventRef.current = selectedSportsEvent;
  }, [selectedSportsEvent]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setSportsEventKeyboardVisible(true);
      setSportsEventKeyboardHeight(Math.max(event.endCoordinates?.height ?? 0, 0));
      if (selectedSportsEventRef.current) settleSportsEventComposer(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setSportsEventKeyboardVisible(false);
      setSportsEventKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [settleSportsEventComposer]);

  useEffect(() => {
    async function loadTempUnit() {
      const stored = await AsyncStorage.getItem('temp_unit');
      if (stored === 'F') {
        setUseCelsius(false);
        tempToggleAnim.setValue(1);
      }
      setTempUnitLoaded(true);
    }
    void loadTempUnit();
  }, []);

  useEffect(() => {
    if (!tempUnitLoaded) return;
    void AsyncStorage.setItem('temp_unit', useCelsius ? 'C' : 'F');
  }, [useCelsius, tempUnitLoaded]);

  useEffect(() => {
    async function loadWeather() {
      const weatherConfig = getSchoolConfig(school);
      const weatherCacheKey = `weather_cache_${weatherConfig.id}`;
      const cached = await AsyncStorage.getItem(weatherCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        setTempC(parsed.tempC ?? null);
        setWeatherCode(parsed.weatherCode ?? null);
        setSunriseTime(parsed.sunriseTime ?? null);
        setSunsetTime(parsed.sunsetTime ?? null);
      }
      try {
        const params = new URLSearchParams({
          latitude: String(weatherConfig.coordinates.latitude),
          longitude: String(weatherConfig.coordinates.longitude),
          current: 'temperature_2m,weathercode',
          daily: 'sunrise,sunset',
          timezone: weatherConfig.timeZone,
          forecast_days: '1',
          temperature_unit: 'celsius',
        });
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
        const json = await response.json();
        const nextTempC = json.current?.temperature_2m ?? null;
        const nextWeatherCode = json.current?.weathercode ?? null;
        const nextSunriseTime = json.daily?.sunrise?.[0] ?? null;
        const nextSunsetTime = json.daily?.sunset?.[0] ?? null;
        setTempC(nextTempC);
        setWeatherCode(nextWeatherCode);
        setSunriseTime(nextSunriseTime);
        setSunsetTime(nextSunsetTime);
        void AsyncStorage.setItem(weatherCacheKey, JSON.stringify({
          tempC: nextTempC,
          weatherCode: nextWeatherCode,
          sunriseTime: nextSunriseTime,
          sunsetTime: nextSunsetTime,
        }));
      } catch {}
    }

    void loadWeather();
  }, [school]);

  useEffect(() => {
    let cancelled = false;

    async function loadSports() {
      const sportsCacheKey = `sports_cache_${school}`;
      setSportsEvents([]);
      setSportsEventListParticipation({});
      setSportsEventUserRsvps({});
      selectedSportsEventRef.current = null;
      setSelectedSportsEvent(null);
      setSportsEventRsvp(null);
      setSportsEventGoingCount(0);
      setSportsEventComments([]);
      setSportsLoading(true);

      if (!schoolFeatureEnabled(school, 'sports')) {
        if (!cancelled) setSportsLoading(false);
        return;
      }

      const cached = await AsyncStorage.getItem(sportsCacheKey);
      if (cached && !cancelled) {
        setSportsEvents(JSON.parse(cached).map((event: any) => (
          normalizeSportsEventForDisplay({ ...event, date: new Date(event.date) })
        )));
        setSportsLoading(false);
      }
      try {
        const events = await fetchSportsEventsForSchool(school, { maxDaysAhead: 7, includePastDays: 0 });
        const normalizedEvents = events.map(normalizeSportsEventForDisplay);
        if (cancelled) return;
        setSportsEvents(normalizedEvents);
        void AsyncStorage.setItem(sportsCacheKey, JSON.stringify(normalizedEvents));
      } catch {}
      if (!cancelled) setSportsLoading(false);
    }

    void loadSports();
    return () => {
      cancelled = true;
    };
  }, [school]);

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
      const cacheKey = `home_classmates_${userId}_${school}_${selectedQuarterKey}_${homeScheduleSignature}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached && !cancelled) {
        try {
          setClassmateMatches(JSON.parse(cached) as ClassmateMatch[]);
        } catch {}
      }

      const { data: requestRows, error: requestError } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id, status')
        .eq('school', school)
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
        supabase.from('profiles').select('id, name, email').eq('school', school).in('id', acceptedIds),
        supabase.from('user_settings').select('user_id, timetable_visibility').in('user_id', acceptedIds),
        supabase.from('timetables').select('user_id, name, courses').eq('school', school).eq('quarter_key', selectedQuarterKey).in('user_id', acceptedIds),
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
  }, [activeCourses, homeScheduleSignature, school, selectedQuarterKey, userId]);

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
  const activeHeroIndexRef = useRef(0);
  const heroSlideAnim = useRef(new Animated.Value(0)).current;
  const heroOpacityAnim = useRef(new Animated.Value(1)).current;

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
  const visibleSportsEventIds = useMemo(
    () => visibleCampusEvents.map((event) => event.id).join('|'),
    [visibleCampusEvents]
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
  const weatherPageWidth = Math.max(twoColumnWidth - SUMMARY_CARD_PADDING * 2, 0);
  const weatherPagerHeight = SUMMARY_CARD_HEIGHT - SUMMARY_CARD_PADDING * 2 - WEATHER_DOT_ROW_HEIGHT;
  const heroCardWidth = Math.max(windowWidth - 36, 0);
  const activeHeroItem = heroItems[activeHeroIndex] ?? null;
  const heroAccent = activeHeroItem?.type === 'course'
    ? pastelForCourse(blockColorKey(activeHeroItem.course)).border
    : activeHeroItem?.type === 'upcomingSummary'
      ? colors.brand
    : colors.brand;
  const selectedSportsVenue = selectedSportsEvent ? getSportsVenueForEvent(school, selectedSportsEvent) : null;
  const sportsGoingAccent = getSchoolConfig(school).accent;
  const sportsGoingAccentBg = `${sportsGoingAccent}14`;
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
        if (error.code !== 'PGRST205' && !isMissingSchoolColumnError(error)) console.error('Failed to load sports event participation:', error);
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
      console.error('Failed to load sports event RSVPs:', rsvpResult.error);
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
      console.error('Failed to load sports event comments:', commentsResult.error);
    }

    setSportsEventDetailLoading(false);
  }

  function openSportsEvent(event: SportsEvent) {
    selectedSportsEventRef.current = event;
    setSelectedSportsEvent(event);
    setSportsEventCommentInput('');
    setSportsEventRsvp(sportsEventUserRsvps[event.id] ?? null);
    setSportsEventGoingCount(sportsEventListParticipation[event.id] ?? 0);
    setSportsEventComments([]);
    setSavingSportsEventRsvp(false);
    resetSportsEventDetailScroll();
    void loadSportsEventSocial(event);
  }

  function closeSportsEvent() {
    Keyboard.dismiss();
    selectedSportsEventRef.current = null;
    setSelectedSportsEvent(null);
    setSportsEventCommentInput('');
    setSportsEventComments([]);
    setSportsEventDetailLoading(false);
    setSavingSportsEventRsvp(false);
    setSubmittingSportsEventComment(false);
    setDeletingSportsEventCommentId(null);
    setSportsEventKeyboardVisible(false);
    setSportsEventKeyboardHeight(0);
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
      if (result.error.code !== 'PGRST205') console.error('Failed to save sports event RSVP:', result.error);
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

    const { data, error } = await supabase
      .from('sports_event_comments')
      .insert({
        school,
        event_id: event.id,
        user_id: userId,
        content,
      })
      .select('id, event_id, user_id, content, created_at')
      .single();

    if (selectedSportsEventRef.current?.id !== event.id) return;

    if (error) {
      console.error('Failed to post sports event comment:', error);
      setSportsEventComments((current) => current.filter((comment) => comment.id !== optimisticId));
      setSportsEventCommentInput(content);
      setSubmittingSportsEventComment(false);
      Alert.alert(
        'Comment failed',
        error.code === 'PGRST205'
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

    const { error } = await supabase
      .from('sports_event_comments')
      .delete()
      .eq('school', school)
      .eq('id', comment.id)
      .eq('user_id', userId);

    if (selectedSportsEventRef.current?.id !== event.id) {
      setDeletingSportsEventCommentId(null);
      return;
    }

    if (error) {
      console.error('Failed to delete sports event comment:', error);
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

  useEffect(() => {
    if (heroItems.length === 0) {
      setActiveHeroIndex(0);
      activeHeroIndexRef.current = 0;
      return;
    }

    const targetIndex = currentClass
      ? Math.max(0, heroItems.findIndex((item) => item.type === 'course' && buildCourseMatchKey(item.course) === buildCourseMatchKey(currentClass)))
      : nextClass
        ? Math.max(0, heroItems.findIndex((item) => item.type === 'upcomingSummary'))
        : 0;
    setActiveHeroIndex(targetIndex);
    activeHeroIndexRef.current = targetIndex;
  }, [heroItems.length, currentClass?.id, nextClass?.id]);

  function moveHeroTo(nextIndex: number) {
    const boundedNextIndex = clamp(nextIndex, 0, Math.max(heroItems.length - 1, 0));
    const currentIndex = activeHeroIndexRef.current;
    if (boundedNextIndex === currentIndex) return;

    const direction = boundedNextIndex > currentIndex ? 1 : -1;
    Animated.parallel([
      Animated.timing(heroSlideAnim, {
        toValue: -direction * 34,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(heroOpacityAnim, {
        toValue: 0.35,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => {
      activeHeroIndexRef.current = boundedNextIndex;
      setActiveHeroIndex(boundedNextIndex);
      heroSlideAnim.setValue(direction * 34);
      heroOpacityAnim.setValue(0.35);
      Animated.parallel([
        Animated.spring(heroSlideAnim, {
          toValue: 0,
          tension: 95,
          friction: 13,
          useNativeDriver: true,
        }),
        Animated.timing(heroOpacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }

  const heroPanResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dx) < 45 && Math.abs(gesture.vx) < 0.35) return;
        moveHeroTo(activeHeroIndexRef.current + (gesture.dx < 0 ? 1 : -1));
      },
    }),
    [heroItems.length]
  );

  return (
    <>
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
        <Text
          numberOfLines={1}
          style={{ fontSize: 12, fontWeight: '800', color: colors.textTertiary, marginTop: 2 }}
        >
          {schoolCampusLabel(school)}
        </Text>
        <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 4 }}>
          {getDateLabel(now, selectedQuarter, quarterStart, quarterEnd, school)}
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
                  <Animated.View
                    key={itemKey}
                    style={{
                      width: heroCardWidth,
                      opacity: heroOpacityAnim,
                      transform: [{ translateX: heroSlideAnim }],
                    }}
                    {...(heroItems.length > 1 ? heroPanResponder.panHandlers : {})}
                  >
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
                            primaryLabel={heroProgressLabel}
                            secondaryLabel={heroProgressSubLabel}
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
                  </Animated.View>
                );
            })()}
            {heroItems.length > 1 ? (
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 }}>
                {heroItems.map((item, index) => (
                  <TouchableOpacity
                    key={`${item.type}-${index}-dot`}
                    onPress={() => moveHeroTo(index)}
                    hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                    activeOpacity={0.75}
                    style={{
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 18,
                      height: 18,
                    }}
                  >
                    <View
                      style={{
                      width: index === activeHeroIndex ? 16 : 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: index === activeHeroIndex ? heroAccent : colors.bgTertiary,
                      }}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <View>
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
                  <Text style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginTop: 7 }}>
                    Open your timetable to add a class or switch plans.
                  </Text>
                </View>
                <View style={{ width: 56, alignItems: 'flex-end' }}>
                  <ProgressRing
                    progress={heroProgress}
                    primaryLabel={heroProgressLabel}
                    secondaryLabel={heroProgressSubLabel}
                    color={colors.brand}
                    trackColor={colors.bgTertiary}
                    textColor={colors.text}
                    subTextColor={colors.textTertiary}
                    size={56}
                    strokeWidth={5}
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
          height: SUMMARY_CARD_HEIGHT,
          backgroundColor: colors.card,
          padding: SUMMARY_CARD_PADDING,
        }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
            {termLabel(selectedQuarter, school)}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 3 }}>
            {academicSystemNoun(school, true)} progress
          </Text>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 4 }}>
            <ProgressRing
              progress={quarterProgress}
              primaryLabel={`${Math.round(quarterProgress * 100)}%`}
              secondaryLabel={`${daysRemaining} days left`}
              color={colors.brand}
              trackColor={colors.bgTertiary}
              textColor={colors.text}
              subTextColor={colors.textTertiary}
              size={92}
              strokeWidth={6}
            />
          </View>
        </View>

        <View style={{
          ...raisedCardStyle,
          width: twoColumnWidth,
          height: SUMMARY_CARD_HEIGHT,
          backgroundColor: colors.card,
          padding: SUMMARY_CARD_PADDING,
        }}>
          <ScrollView
            ref={weatherPagerRef}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(event) => {
              setActiveWeatherIndex(clamp(Math.round(event.nativeEvent.contentOffset.x / Math.max(weatherPageWidth, 1)), 0, 1));
            }}
            style={{ width: weatherPageWidth, height: weatherPagerHeight, flexGrow: 0 }}
          >
            <View style={{ width: weatherPageWidth }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                    Weather
                  </Text>
                  <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text, lineHeight: 32, marginTop: 8 }}>
                    {displayTemperature(tempC, useCelsius)}
                  </Text>
                  <Text numberOfLines={1} style={{ fontSize: 13, color: colors.textSecondary, marginTop: 6 }}>
                    {weatherCode === null ? 'Loading...' : (WMO_DESCRIPTIONS[weatherCode]?.label ?? 'Clear Sky')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Ionicons
                    name={weatherCode === null ? 'cloud-outline' : (WMO_DESCRIPTIONS[weatherCode]?.icon ?? 'sunny-outline')}
                    size={24}
                    color={colors.brand}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      const next = !useCelsius;
                      setUseCelsius(next);
                      Animated.spring(tempToggleAnim, {
                        toValue: next ? 0 : 1,
                        tension: 220,
                        friction: 18,
                        useNativeDriver: true,
                      }).start();
                    }}
                    style={{
                      flexDirection: 'row',
                      backgroundColor: colors.inputBg,
                      borderRadius: 999,
                      padding: 3,
                      marginTop: 12,
                      overflow: 'hidden',
                    }}
                  >
                    <Animated.View
                      style={{
                        position: 'absolute',
                        left: 3,
                        top: 3,
                        bottom: 3,
                        width: tempPillWidth,
                        borderRadius: 999,
                        backgroundColor: colors.brand,
                        transform: [{
                          translateX: tempToggleAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, tempPillWidth],
                          }),
                        }],
                      }}
                    />
                    {(['C', 'F'] as const).map((label, idx) => {
                      const active = label === 'C' ? useCelsius : !useCelsius;
                      return (
                        <View
                          key={label}
                          onLayout={idx === 0 ? (e) => setTempPillWidth(e.nativeEvent.layout.width) : undefined}
                          style={{ paddingHorizontal: 9, paddingVertical: 5 }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: active ? '#ffffff' : colors.textSecondary }}>
                            {label}
                          </Text>
                        </View>
                      );
                    })}
                  </TouchableOpacity>
                </View>
              </View>
              <Text
                numberOfLines={WEATHER_INSIGHT_LINES}
                style={{
                  fontSize: 12,
                  lineHeight: WEATHER_INSIGHT_LINE_HEIGHT,
                  color: colors.textTertiary,
                  marginTop: 12,
                  height: WEATHER_INSIGHT_LINE_HEIGHT * WEATHER_INSIGHT_LINES,
                }}
              >
                {weatherInsightText(tempC, weatherCode, useCelsius)}
              </Text>
            </View>

            <View style={{ width: weatherPageWidth }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                    Sunlight
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 7 }}>
                    Today on campus
                  </Text>
                </View>
                <Ionicons name="sunny-outline" size={24} color={colors.brand} />
              </View>
              <View style={{ marginTop: 14, gap: 9 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ fontSize: 12, color: colors.textTertiary, fontWeight: '700' }}>Sunrise</Text>
                  <Text style={{ fontSize: 15, color: colors.text, fontWeight: '800' }}>{formatSunTime(sunriseTime)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ fontSize: 12, color: colors.textTertiary, fontWeight: '700' }}>Sunset</Text>
                  <Text style={{ fontSize: 15, color: colors.text, fontWeight: '800' }}>{formatSunTime(sunsetTime)}</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 6 }}>
            {[0, 1].map((index) => (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  setActiveWeatherIndex(index);
                  weatherPagerRef.current?.scrollTo({ x: weatherPageWidth * index, animated: true });
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ width: 16, height: 14, alignItems: 'center', justifyContent: 'center' }}
              >
                <View
                  style={{
                    width: activeWeatherIndex === index ? 14 : 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: activeWeatherIndex === index ? colors.brand : colors.bgTertiary,
                  }}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <View>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 }}>
          Sports Events
        </Text>
        <View style={{
          ...raisedCardStyle,
          backgroundColor: colors.card,
          padding: 18,
        }}>
          {visibleCampusEvents.length > 0 ? (
            <View style={{ gap: 14 }}>
              {visibleCampusEvents.map((event, index) => (
                (() => {
                  const participationCount = sportsEventListParticipation[event.id] ?? 0;
                  return (
                    <TouchableOpacity
                      key={`${event.id}-${event.location}-${index}`}
                      onPress={() => openSportsEvent(event)}
                      activeOpacity={0.78}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5, flexWrap: 'wrap' }}>
                          <View
                            style={{
                              borderRadius: 999,
                              backgroundColor: event.isHome ? colors.brandBg : colors.bgTertiary,
                              borderWidth: 1,
                              borderColor: event.isHome ? `${colors.brand}44` : colors.borderSubtle,
                              paddingHorizontal: 7,
                              paddingVertical: 3,
                            }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '800', color: event.isHome ? colors.brand : colors.textSecondary }}>
                              {sportsHomeAwayLabel(event)}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                            {formatRelativeEventDayLabel(event.date, now)} · {formatSportsEventTime(event.date, event.timeLabel)}
                          </Text>
                        </View>
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          alignSelf: 'flex-start',
                          borderRadius: 999,
                          backgroundColor: sportsGoingAccentBg,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          marginTop: 7,
                        }}>
                          <Ionicons name="people-outline" size={11} color={sportsGoingAccent} />
                          <Text style={{ color: sportsGoingAccent, fontSize: 10, fontWeight: '800' }}>
                            {participationCount > 99 ? '99+' : participationCount} going
                          </Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                  );
                })()
              ))}
            </View>
          ) : (
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>
              {sportsLoading ? 'Loading sports events...' : 'No upcoming sports events right now.'}
            </Text>
          )}
        </View>
      </View>
      </ScrollView>

      <Modal
        visible={!!selectedSportsEvent}
        transparent
        animationType="slide"
        onRequestClose={closeSportsEvent}
      >
        <View
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.34)' }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={closeSportsEvent}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}
          />
          {selectedSportsEvent ? (
            <View
              style={{
                zIndex: 1,
                elevation: 1,
                maxHeight: '88%',
                height: sportsEventSheetHeight,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                backgroundColor: colors.bg,
                paddingTop: 10,
                paddingBottom: 0,
                overflow: 'hidden',
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
                    backgroundColor: selectedSportsEvent.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name={selectedSportsEvent.icon} size={23} color={selectedSportsEvent.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 24, lineHeight: 29, fontWeight: '800', color: colors.text }}>
                      {selectedSportsEvent.title}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 5 }}>
                      {formatSportsEventDetailDate(selectedSportsEvent)}
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
                  marginBottom: sportsEventKeyboardHeight,
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
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

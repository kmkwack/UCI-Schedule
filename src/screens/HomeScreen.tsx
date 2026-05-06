import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const HOME_SPORTS_FETCH_DELAY_MS = 250;
const HOME_CLASSMATES_FETCH_DELAY_MS = 1000;

const SUMMARY_CARD_HEIGHT = 204;
const SUMMARY_CARD_PADDING = 18;
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

function parseIcsDate(value: string, allDay: boolean) {
  const dateOnly = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day), allDay ? 23 : 0, allDay ? 59 : 0, 0);
  }

  const dateTime = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!dateTime) return null;
  const [, year, month, day, hour, minute, second, isUtc] = dateTime;
  if (isUtc) {
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second ?? 0)));
  }
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second ?? 0));
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

function parseCalendarTasksFromIcs(text: string): CalendarTask[] {
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
      const dueAt = start ? parseIcsDate(start.value.trim(), allDay) : null;

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

function formatCalendarTaskDueLabel(assignment: CalendarTask, now: Date) {
  const due = new Date(assignment.dueAt);
  const dayLabel = formatRelativeEventDayLabel(due, now);
  const prefix = due.getTime() < now.getTime() ? 'Past due' : 'Due';
  if (assignment.allDay) return `${prefix} ${dayLabel}`;
  return `${prefix} ${dayLabel} · ${due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function isCalendarTaskOverdue(assignment: CalendarTask, completed: boolean, now: Date) {
  return !completed && new Date(assignment.dueAt).getTime() < now.getTime();
}

function isPastCalendarTask(assignment: CalendarTask, now: Date) {
  return new Date(assignment.dueAt).getTime() < now.getTime();
}

function isCalendarTaskCompleted(assignment: CalendarTask, completedTasks: Record<string, boolean>, now: Date) {
  const stored = completedTasks[assignment.id];
  if (stored !== undefined) return stored;
  return isPastCalendarTask(assignment, now);
}

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

function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function shortWeekdayLabel(date: Date) {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function getSportsCardStatus(event: SportsEvent, now: Date) {
  const eventTime = event.date.getTime();
  const diffMs = eventTime - now.getTime();
  const sameDay = startOfLocalDay(event.date).getTime() === startOfLocalDay(now).getTime();
  if (diffMs >= 0 && diffMs <= 60 * 60 * 1000) return 'Starting Soon';
  if (sameDay) return 'Game Day';
  return 'Next Game';
}

function formatSportsCardTiming(event: SportsEvent, now: Date) {
  const time = formatSportsEventTime(event.date, event.timeLabel);
  const diffDays = Math.max(1, Math.ceil((startOfLocalDay(event.date).getTime() - startOfLocalDay(now).getTime()) / (24 * 60 * 60 * 1000)));
  const sameDay = startOfLocalDay(event.date).getTime() === startOfLocalDay(now).getTime();
  if (sameDay) return `${event.date.getHours() >= 17 ? 'Tonight' : 'Today'} · ${time}`;
  if (diffDays === 1) return `Tomorrow · ${time}`;
  return `in ${diffDays} days · ${shortWeekdayLabel(event.date)} · ${time}`;
}

function sportsCardActionLabel(event: SportsEvent, eventCount: number, now: Date) {
  const status = getSportsCardStatus(event, now);
  if (status === 'Starting Soon') return 'Directions';
  if (status === 'Game Day') return 'View details';
  return `View all ${eventCount}`;
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
  bottomInset = 0,
  scrollToTopTrigger = 0,
}: Props) {
  const { colors, isDark } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const sportsEventScrollRef = useRef<ScrollView>(null);
  const sportsEventCommentInputRef = useRef<TextInput>(null);
  const [sportsEvents, setSportsEvents] = useState<SportsEvent[]>([]);
  const [sportsLoading, setSportsLoading] = useState(false);
  const [calendarProvider, setCalendarProvider] = useState<CalendarProviderId>(DEFAULT_CALENDAR_PROVIDER_ID);
  const [calendarFeedUrl, setCalendarFeedUrl] = useState<string | null>(null);
  const [calendarFeedInput, setCalendarFeedInput] = useState('');
  const [showCalendarSetup, setShowCalendarSetup] = useState(false);
  const [calendarTasks, setCalendarTasks] = useState<CalendarTask[]>([]);
  const [calendarTasksLoading, setCalendarTasksLoading] = useState(false);
  const [calendarTasksError, setCalendarTasksError] = useState<string | null>(null);
  const [calendarLastSyncedAt, setCalendarLastSyncedAt] = useState<string | null>(null);
  const [completedCalendarTasks, setCompletedCalendarTasks] = useState<Record<string, boolean>>({});
  const [showPastAssignments, setShowPastAssignments] = useState(false);
  const [classmateMatches, setClassmateMatches] = useState<ClassmateMatch[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [selectedSportsEvent, setSelectedSportsEvent] = useState<SportsEvent | null>(null);
  const [showSportsEventsList, setShowSportsEventsList] = useState(false);
  const [showSportsMoreList, setShowSportsMoreList] = useState(false);
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
  const calendarProviderStorageKey = userScopedStorageKey('assignment_calendar_provider', userId);
  const calendarFeedStorageKey = userScopedStorageKey('assignment_calendar_feed', userId);
  const calendarTasksStorageKey = userScopedStorageKey('assignment_calendar_tasks_cache', userId);
  const calendarCompletedStorageKey = userScopedStorageKey('assignment_calendar_completed', userId);
  const calendarLastSyncStorageKey = userScopedStorageKey('assignment_calendar_last_sync', userId);
  const legacyCalendarFeedStorageKey = userScopedStorageKey('canvas_calendar_feed', userId);
  const legacyCalendarTasksStorageKey = userScopedStorageKey('canvas_assignments_cache', userId);
  const legacyCalendarCompletedStorageKey = userScopedStorageKey('canvas_assignments_completed', userId);
  const legacyCalendarLastSyncStorageKey = userScopedStorageKey('canvas_assignments_last_sync', userId);
  const { start: quarterStart, end: quarterEnd } = getQuarterBounds(selectedQuarter);
  const sportsEventSheetHeight = Math.round(windowHeight * 0.88);
  const sportsListSheetHeight = Math.round(windowHeight * 0.72);
  const pastAssignmentsSheetHeight = Math.round(windowHeight * 0.74);
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

  const selectedCalendarProvider = getCalendarProviderOption(calendarProvider);

  const syncCalendarTasks = useCallback(async (feedUrl: string) => {
    const trimmedUrl = feedUrl.trim();
    if (!trimmedUrl) return;
    setCalendarTasksLoading(true);
    setCalendarTasksError(null);
    try {
      const response = await fetch(trimmedUrl);
      if (!response.ok) throw new Error(`Calendar feed returned ${response.status}`);
      const text = await response.text();
      const parsedTasks = parseCalendarTasksFromIcs(text);
      const syncedAt = new Date().toISOString();
      setCalendarTasks(parsedTasks);
      setCalendarLastSyncedAt(syncedAt);
      void AsyncStorage.multiSet([
        [calendarTasksStorageKey, JSON.stringify(parsedTasks)],
        [calendarLastSyncStorageKey, syncedAt],
      ]);
    } catch {
      setCalendarTasksError('Could not refresh this calendar feed. Check the link and try again.');
    } finally {
      setCalendarTasksLoading(false);
    }
  }, [calendarTasksStorageKey, calendarLastSyncStorageKey]);

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
      setCalendarProvider(resolvedProvider);
      setCalendarFeedUrl(resolvedFeedUrl);
      setCalendarFeedInput(resolvedFeedUrl ?? '');
      setCalendarLastSyncedAt(resolvedLastSync);

      if (resolvedTasks) {
        try {
          setCalendarTasks(JSON.parse(resolvedTasks) as CalendarTask[]);
        } catch {}
      } else {
        setCalendarTasks([]);
      }

      if (resolvedCompleted) {
        try {
          setCompletedCalendarTasks(JSON.parse(resolvedCompleted) as Record<string, boolean>);
        } catch {
          setCompletedCalendarTasks({});
        }
      } else {
        setCompletedCalendarTasks({});
      }

      if (!storedFeedUrl && legacyFeedUrl) {
        void AsyncStorage.multiSet([
          [calendarProviderStorageKey, DEFAULT_CALENDAR_PROVIDER_ID],
          [calendarFeedStorageKey, legacyFeedUrl],
          ...(legacyTasks ? [[calendarTasksStorageKey, legacyTasks] as [string, string]] : []),
          ...(legacyCompleted ? [[calendarCompletedStorageKey, legacyCompleted] as [string, string]] : []),
          ...(legacyLastSync ? [[calendarLastSyncStorageKey, legacyLastSync] as [string, string]] : []),
        ]);
      }

      if (resolvedFeedUrl) void syncCalendarTasks(resolvedFeedUrl);
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
    setCalendarFeedUrl(trimmedUrl);
    setShowCalendarSetup(false);
    await AsyncStorage.multiSet([
      [calendarProviderStorageKey, calendarProvider],
      [calendarFeedStorageKey, trimmedUrl],
    ]);
    void syncCalendarTasks(trimmedUrl);
  }

  async function disconnectCalendarFeed() {
    setCalendarFeedUrl(null);
    setCalendarFeedInput('');
    setCalendarTasks([]);
    setCalendarTasksError(null);
    setCalendarLastSyncedAt(null);
    setCompletedCalendarTasks({});
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
    setShowCalendarSetup(false);
  }

  function toggleCalendarTask(assignment: CalendarTask) {
    setCompletedCalendarTasks((current) => {
      const isPast = isPastCalendarTask(assignment, now);
      const currentlyCompleted = isCalendarTaskCompleted(assignment, current, now);
      const next = { ...current };
      if (currentlyCompleted) {
        if (isPast) {
          next[assignment.id] = false;
        } else {
          delete next[assignment.id];
        }
      } else {
        next[assignment.id] = true;
      }
      void AsyncStorage.setItem(calendarCompletedStorageKey, JSON.stringify(next));
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
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

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
      setSportsLoading(false);

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

      refreshTimer = setTimeout(() => {
        void (async () => {
          try {
            const events = await fetchSportsEventsForSchool(school, { maxDaysAhead: 7, includePastDays: 0 });
            const normalizedEvents = events.map(normalizeSportsEventForDisplay);
            if (cancelled) return;
            setSportsEvents(normalizedEvents);
            void AsyncStorage.setItem(sportsCacheKey, JSON.stringify(normalizedEvents));
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
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    async function loadClassmates() {
      const cacheKey = `home_classmates_${userId}_${school}_${selectedQuarterKey}_${homeScheduleSignature}`;
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

    refreshTimer = setTimeout(() => {
      void loadClassmates();
    }, HOME_CLASSMATES_FETCH_DELAY_MS);

    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
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
  const nextSportsEvent = visibleCampusEvents[0] ?? null;
  const remainingSportsEventCount = Math.max(visibleCampusEvents.length - 1, 0);
  const nextSportsStatus = nextSportsEvent ? getSportsCardStatus(nextSportsEvent, now) : null;
  const todaySportsEvents = useMemo(() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const real = sportsEvents.filter((e) => {
      const d = new Date(e.date.getFullYear(), e.date.getMonth(), e.date.getDate());
      return d.getTime() === today.getTime();
    });
    // TODO: remove placeholder events once real data is available
    const placeholders: typeof sportsEvents = real.length === 0 ? [
      { id: '__demo_1', title: "Baseball vs Long Beach State", location: 'Anteater Ballpark', icon: 'baseball-outline', color: '#f97316', bg: '#fff7ed', date: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0), timeLabel: '6:00 PM', sport: 'Baseball', opponent: 'Long Beach State', isHome: true },
      { id: '__demo_2', title: "Women's Tennis vs USC", location: 'ITS Tennis Center', icon: 'tennisball-outline', color: '#eab308', bg: '#fefce8', date: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0), timeLabel: '2:00 PM', sport: "Women's Tennis", opponent: 'USC', isHome: true },
      { id: '__demo_3', title: "Men's Basketball at UCLA", location: 'Pauley Pavilion', icon: 'basketball-outline', color: '#3b82f6', bg: '#eff6ff', date: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0), timeLabel: '8:00 PM', sport: "Men's Basketball", opponent: 'UCLA', isHome: false },
    ] : [];
    return [...real, ...placeholders];
  }, [sportsEvents, now]);
  const moreSportsEvents = useMemo(() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const nextTwo = sportsEvents.filter((e) => {
      const d = new Date(e.date.getFullYear(), e.date.getMonth(), e.date.getDate());
      const offset = Math.round((d.getTime() - today.getTime()) / 86400000);
      return offset >= 1 && offset <= 2;
    });
    return [...todaySportsEvents.slice(2), ...nextTwo];
  }, [sportsEvents, todaySportsEvents, now]);
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
  const selectedSportsVenue = selectedSportsEvent ? getSportsVenueForEvent(school, selectedSportsEvent) : null;
  const sportsGoingAccent = getSchoolConfig(school).accent;
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

  function openSportsEvent(event: SportsEvent) {
    setShowSportsEventsList(false);
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
                            <Text style={{ fontSize: 28, lineHeight: 32, fontWeight: '800', color: colors.text }}>
                              {label}
                            </Text>
                            <Text style={{ fontSize: 28, lineHeight: 32, fontWeight: '800', color: colors.text }}>
                              {value}
                            </Text>
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
                        /* Coming up: fixed header row + expanding course list below */
                        <View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 22, lineHeight: 26, fontWeight: '800', color: colors.text }}>
                                {label}
                              </Text>
                              <Text style={{ fontSize: 22, lineHeight: 26, fontWeight: '800', color: colors.text }}>
                                {value}
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
                          <View style={{ marginTop: 14, gap: 10 }}>
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
                        </View>
                      )}

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
          </View>
        )}
      </View>

      <View style={{ marginBottom: 14 }}>
        <View
          style={{
            ...raisedCardStyle,
            backgroundColor: colors.card,
            padding: SUMMARY_CARD_PADDING,
            justifyContent: 'space-between',
          }}
        >
          {/* Today's events */}
          <View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
              Today:
            </Text>
            {todaySportsEvents.length > 0 ? (
              <View style={{ gap: 8, marginTop: 10 }}>
                {todaySportsEvents.slice(0, 2).map((event) => (
                  <TouchableOpacity
                    key={event.id}
                    onPress={() => openSportsEvent(event)}
                    activeOpacity={0.75}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}
                  >
                    <View style={{
                      width: 30, height: 30, borderRadius: 15,
                      backgroundColor: event.bg,
                      alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Ionicons name={event.icon} size={15} color={event.color} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>
                        {event.title}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                        {formatSportsEventTime(event.date, event.timeLabel)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 10 }}>
                No events today
              </Text>
            )}
          </View>
          {/* More button */}
          <TouchableOpacity
            onPress={() => setShowSportsMoreList(true)}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}
          >
            <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textSecondary }}>
              {moreSportsEvents.length > 0
                ? `${moreSportsEvents.length} more event${moreSportsEvents.length === 1 ? '' : 's'}`
                : 'More'}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </View>

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
              {pastCalendarTaskCount > 0 ? (
                <TouchableOpacity
                  onPress={() => setShowPastAssignments(true)}
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
                    Past Assignments
                  </Text>
                </TouchableOpacity>
              ) : null}
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
                  {incompleteCalendarTaskCount} open
                </Text>
                <TouchableOpacity
                  onPress={() => setShowCalendarSetup(true)}
                  style={{
                    paddingHorizontal: 11,
                    paddingVertical: 7,
                    borderRadius: 999,
                    backgroundColor: colors.bgTertiary,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textSecondary }}>
                    Manage
                  </Text>
                </TouchableOpacity>
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
                        {completed ? <Ionicons name="checkmark" size={16} color="white" /> : null}
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
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
                            {formatCalendarTaskDueLabel(assignment, now)}
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
                onPress={() => setShowCalendarSetup(true)}
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
                  onPress={() => setShowPastAssignments(true)}
                  style={{
                    marginTop: 10,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: colors.brandBg,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.brand }}>
                    View Past Assignments
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
                Connect Calendar
              </Text>
              <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary, textAlign: 'center', marginTop: 7 }}>
                Choose your LMS, paste its calendar feed once, then ClassMate turns deadlines into a checklist.
              </Text>
              <TouchableOpacity
                onPress={() => setShowCalendarSetup(true)}
                style={{
                  marginTop: 15,
                  paddingHorizontal: 18,
                  paddingVertical: 11,
                  borderRadius: 999,
                  backgroundColor: colors.brand,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: 'white' }}>
                  Add Calendar Feed
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
      </ScrollView>

      <Modal
        visible={showSportsEventsList}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSportsEventsList(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.34)' }}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowSportsEventsList(false)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View
            style={{
              maxHeight: '78%',
              height: sportsListSheetHeight,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              backgroundColor: colors.bg,
              paddingTop: 10,
              paddingBottom: Math.max(bottomInset, 18) + 8,
              overflow: 'hidden',
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
                onPress={() => setShowSportsEventsList(false)}
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
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={2} style={{ fontSize: 16, lineHeight: 20, fontWeight: '800', color: colors.text }}>
                            {event.title}
                          </Text>
                          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 6 }}>
                            {formatRelativeEventDayLabel(event.date, now)} · {formatSportsEventTime(event.date, event.timeLabel)}
                          </Text>
                        </View>
                        <View
                          style={{
                            borderRadius: 999,
                            backgroundColor: event.isHome ? colors.brandBg : colors.bgTertiary,
                            borderWidth: 1,
                            borderColor: event.isHome ? `${colors.brand}44` : colors.borderSubtle,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '800', color: event.isHome ? colors.brand : colors.textSecondary }}>
                            {sportsHomeAwayLabel(event)}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 9 }}>
                        <Ionicons name="people-outline" size={12} color={sportsGoingAccent} />
                        <Text style={{ color: sportsGoingAccent, fontSize: 11, fontWeight: '800' }}>
                          {(sportsEventListParticipation[event.id] ?? 0) > 99 ? '99+' : (sportsEventListParticipation[event.id] ?? 0)} going
                        </Text>
                      </View>
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
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSportsMoreList}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSportsMoreList(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.34)' }}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowSportsMoreList(false)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View
            style={{
              maxHeight: '78%',
              height: sportsListSheetHeight,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              backgroundColor: colors.bg,
              paddingTop: 10,
              paddingBottom: Math.max(bottomInset, 18) + 8,
              overflow: 'hidden',
            }}
          >
            <View style={{ alignItems: 'center', paddingBottom: 12 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, marginBottom: 12 }}>
              <View>
                <Text style={{ fontSize: 24, lineHeight: 29, fontWeight: '800', color: colors.text }}>
                  Next 2 Days
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                  {moreSportsEvents.length} upcoming
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSportsMoreList(false)}
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
              {moreSportsEvents.length > 0 ? (
                <View style={{ gap: 10 }}>
                  {moreSportsEvents.map((event, index) => (
                    <TouchableOpacity
                      key={`${event.id}-more-${index}`}
                      onPress={() => { setShowSportsMoreList(false); openSportsEvent(event); }}
                      activeOpacity={0.78}
                      style={{
                        borderRadius: 18,
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: colors.borderSubtle,
                        padding: 14,
                      }}
                    >
                      <Text numberOfLines={2} style={{ fontSize: 16, lineHeight: 20, fontWeight: '800', color: colors.text }}>
                        {event.title}
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 5 }}>
                        {formatRelativeEventDayLabel(event.date, now)} · {formatSportsEventTime(event.date, event.timeLabel)}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
                        <View style={{
                          borderRadius: 999,
                          backgroundColor: event.isHome ? colors.brandBg : colors.bgTertiary,
                          borderWidth: 1,
                          borderColor: event.isHome ? `${colors.brand}44` : colors.borderSubtle,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                        }}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: event.isHome ? colors.brand : colors.textSecondary }}>
                            {sportsHomeAwayLabel(event)}
                          </Text>
                        </View>
                        <Ionicons name="people-outline" size={12} color={sportsGoingAccent} />
                        <Text style={{ color: sportsGoingAccent, fontSize: 11, fontWeight: '800' }}>
                          {(sportsEventListParticipation[event.id] ?? 0) > 99 ? '99+' : (sportsEventListParticipation[event.id] ?? 0)} going
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
                    No events in the next 2 days
                  </Text>
                  <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary, textAlign: 'center', marginTop: 7 }}>
                    Check back soon for upcoming sports events.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPastAssignments}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPastAssignments(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.34)' }}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowPastAssignments(false)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View
            style={{
              maxHeight: '80%',
              height: pastAssignmentsSheetHeight,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              backgroundColor: colors.bg,
              paddingTop: 10,
              paddingBottom: Math.max(bottomInset, 18) + 8,
              overflow: 'hidden',
            }}
          >
            <View style={{ alignItems: 'center', paddingBottom: 12 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, marginBottom: 12 }}>
              <View>
                <Text style={{ fontSize: 24, lineHeight: 29, fontWeight: '800', color: colors.text }}>
                  Past Assignments
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                  {pastCalendarTaskCount} assignment{pastCalendarTaskCount === 1 ? '' : 's'} hidden from Home
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowPastAssignments(false)}
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
                          {completed ? <Ionicons name="checkmark" size={16} color="white" /> : null}
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
                              {formatCalendarTaskDueLabel(assignment, now)}
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
                    No past assignments
                  </Text>
                  <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary, textAlign: 'center', marginTop: 7 }}>
                    Deadlines move here after they pass.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCalendarSetup}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCalendarSetup(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.34)' }}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowCalendarSetup(false)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View
            style={{
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              backgroundColor: colors.bg,
              paddingHorizontal: 18,
              paddingTop: 10,
              paddingBottom: Math.max(bottomInset, 18) + 12,
            }}
          >
            <View style={{ alignItems: 'center', paddingBottom: 12 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 24, lineHeight: 29, fontWeight: '800', color: colors.text }}>
                  Assignment Calendar
                </Text>
                <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary, marginTop: 6 }}>
                  Pick your LMS and paste its .ics or iCal feed link to keep deadlines synced on this device.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowCalendarSetup(false)}
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
                LMS source
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
                value={calendarFeedInput}
                onChangeText={setCalendarFeedInput}
                placeholder={selectedCalendarProvider.placeholder}
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={{ minHeight: 44, fontSize: 14, color: colors.text }}
              />
            </View>

            {calendarTasksError ? (
              <Text style={{ fontSize: 12, color: '#EF4444', marginTop: 10 }}>
                {calendarTasksError}
              </Text>
            ) : null}

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
                marginTop: 16,
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
        </View>
      </Modal>

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

import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

export type SportsEvent = {
  id: string;
  title: string;
  location: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  color: string;
  bg: string;
  date: Date;
  timeLabel?: string;
  sport: string;
  opponent: string;
  isHome: boolean;
};

const SPORT_STYLES: Record<string, { icon: ComponentProps<typeof Ionicons>['name']; color: string; bg: string }> = {
  Baseball: { icon: 'baseball-outline', color: '#f97316', bg: '#fff7ed' },
  Softball: { icon: 'baseball-outline', color: '#f97316', bg: '#fff7ed' },
  Basketball: { icon: 'basketball-outline', color: '#3b82f6', bg: '#eff6ff' },
  Soccer: { icon: 'football-outline', color: '#22c55e', bg: '#f0fdf4' },
  Tennis: { icon: 'tennisball-outline', color: '#eab308', bg: '#fefce8' },
  Volleyball: { icon: 'trophy-outline', color: '#8b5cf6', bg: '#f5f3ff' },
  'Water Polo': { icon: 'water-outline', color: '#06b6d4', bg: '#ecfeff' },
  'Track & Field': { icon: 'fitness-outline', color: '#f43f5e', bg: '#fff1f2' },
  Golf: { icon: 'flag-outline', color: '#10b981', bg: '#ecfdf5' },
  'Cross Country': { icon: 'walk-outline', color: '#64748b', bg: '#f8fafc' },
};

const SPORT_SCHEDULE_PATHS: Record<string, string> = {
  Baseball: '/sports/baseball/schedule',
  "Men's Basketball": '/sports/mens-basketball/schedule',
  "Women's Basketball": '/sports/womens-basketball/schedule',
  "Men's Cross Country": '/sports/mens-cross-country/schedule',
  "Women's Cross Country": '/sports/womens-cross-country/schedule',
  "Men's Golf": '/sports/mens-golf/schedule',
  "Women's Golf": '/sports/womens-golf/schedule',
  "Men's Soccer": '/sports/mens-soccer/schedule',
  "Women's Soccer": '/sports/womens-soccer/schedule',
  "Men's Tennis": '/sports/mens-tennis/schedule',
  "Women's Tennis": '/sports/womens-tennis/schedule',
  "Men's Track & Field": '/sports/mens-track-and-field/schedule',
  "Women's Track & Field": '/sports/womens-track-and-field/schedule',
  "Men's Volleyball": '/sports/mens-volleyball/schedule',
  "Women's Volleyball": '/sports/womens-volleyball/schedule',
  "Men's Water Polo": '/sports/mens-water-polo/schedule',
  "Women's Water Polo": '/sports/womens-water-polo/schedule',
};

const SPORTS_SCHEDULE_FETCH_TIMEOUT_MS = 3500;

function getSportStyle(sport: string) {
  const normalized = sport.replace(/^(Men's|Women's)\s+/i, '');
  return SPORT_STYLES[normalized] ?? {
    icon: 'trophy-outline' as ComponentProps<typeof Ionicons>['name'],
    color: '#f97316',
    bg: '#fff7ed',
  };
}

function parseDTSTART(val: string): Date {
  const y = val.slice(0, 4);
  const mo = val.slice(4, 6);
  const d = val.slice(6, 8);
  if (!val.includes('T')) return new Date(`${y}-${mo}-${d}T00:00:00Z`);
  const h = val.slice(9, 11);
  const m = val.slice(11, 13);
  return new Date(`${y}-${mo}-${d}T${h}:${m}:00Z`);
}

function parseLocation(loc: string): string {
  const unescaped = loc.replace(/\\,/g, ',');
  const parts = unescaped.split(', ');
  if (parts.length >= 3) return parts.slice(2).join(', ');
  return unescaped;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/<!--\[-->/g, '')
    .replace(/<!--\]-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function htmlToLines(value: string): string[] {
  return decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|li|p|h[1-6]|span|a|time|td|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function normalizeLookup(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/^#\d+\s+/, '')
    .replace(/^RV\s+/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function dateMatchesLine(date: Date, line: string): boolean {
  const monthLong = date.toLocaleString('en-US', { month: 'long' });
  const monthShort = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  const year = date.getFullYear();
  const lower = line.toLowerCase();

  return [
    `${monthLong} ${day}`.toLowerCase(),
    `${monthShort} ${day}`.toLowerCase(),
    `${monthShort}. ${day}`.toLowerCase(),
    `${monthLong}. ${day}`.toLowerCase(),
    `${monthShort} ${day}, ${year}`.toLowerCase(),
    `${monthShort}. ${day}, ${year}`.toLowerCase(),
  ].some((token) => lower.includes(token));
}

function isScheduleLocationCandidate(line: string): boolean {
  const lower = line.toLowerCase();
  if (
    lower === 'vs' ||
    lower === 'at' ||
    lower.includes('image') ||
    lower.includes('game info') ||
    lower.includes('box score') ||
    lower.includes('recap') ||
    lower.includes('watch') ||
    lower.includes('listen') ||
    lower.includes('stats') ||
    lower.includes('tv:') ||
    lower.includes('radio:') ||
    lower.includes('select sport') ||
    lower.includes('all sports') ||
    lower.includes('no filter selected') ||
    lower.includes('upcoming event') ||
    lower.includes('sponsored by') ||
    lower.includes('add to calendar') ||
    lower.includes('view type') ||
    line.length > 90 ||
    /^[wl],?\s/.test(lower) ||
    /^\d+\s+days?$/.test(lower) ||
    /^\d+\s+hours?$/.test(lower) ||
    /^\d+\s+minutes?$/.test(lower) ||
    /^\d+\s+seconds?$/.test(lower) ||
    /\b\d{1,2}:\d{2}\s*(am|pm|a\.m\.|p\.m\.)\b/i.test(line) ||
    /\b(tba|postponed|canceled|cancelled)\b/i.test(line) ||
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\.?\s+\d{1,2}/i.test(line) ||
    /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday),\s+/i.test(line)
  ) {
    return false;
  }

  return (
    /,\s*(ca|calif\.?|az|ar|hi|ny|pa|wa|or|nv|ut|tx|fl|il|oh|nc|sc|ga|co|ma|md|dc|va)\b/i.test(line) ||
    /\b(stadium|center|centre|court|ballpark|complex|gymnasium|arena|park|course|pool|facility)\b/i.test(line) ||
    (/\bfield\b/i.test(line) && !/\btrack\s*(?:&|and)\s*field\b/i.test(line))
  );
}

function cleanScheduleLocation(line: string): string {
  const cleaned = line
    .replace(/\s+/g, ' ')
    .replace(/\s+\|\s+/g, ' ')
    .trim();
  const halfway = Math.floor(cleaned.length / 2);
  if (cleaned.length % 2 === 0 && cleaned.slice(0, halfway) === cleaned.slice(halfway)) {
    return cleaned.slice(0, halfway).trim();
  }
  return cleaned;
}

function isGenericSportsLocation(location: string): boolean {
  const normalized = location.trim().toLowerCase();
  return !normalized || ['uci athletics', 'uci campus', 'venue tba', 'tba', 'away'].includes(normalized);
}

async function fetchScheduleText(path: string): Promise<string | null> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = setTimeout(() => controller?.abort(), SPORTS_SCHEDULE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`https://ucirvinesports.com${path}`, {
      signal: controller?.signal,
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function findLocationInSportSchedule(event: SportsEvent, html: string): string | null {
  const lines = htmlToLines(html);
  const opponent = normalizeLookup(event.opponent);
  if (!opponent) return null;
  const sport = normalizeLookup(event.sport);
  const year = String(event.date.getFullYear());
  const scheduleHeading = `${year} ${sport} schedule`;
  const exactScheduleStartIndex = lines.findIndex((line) => normalizeLookup(line) === scheduleHeading);
  const fallbackScheduleStartIndex = lines.findIndex((line) => {
    const normalized = normalizeLookup(line);
    return normalized.includes(year) && normalized.includes(sport) && normalized.includes('schedule');
  });
  const scheduleStartIndex = exactScheduleStartIndex >= 0 ? exactScheduleStartIndex : fallbackScheduleStartIndex;
  const searchableLines = scheduleStartIndex >= 0 ? lines.slice(scheduleStartIndex) : lines;

  for (let index = 0; index < searchableLines.length; index += 1) {
    if (!normalizeLookup(searchableLines[index]).includes(opponent)) continue;

    const start = Math.max(0, index - 8);
    const end = Math.min(searchableLines.length, index + 18);
    const window = searchableLines.slice(start, end);
    if (!window.some((line) => dateMatchesLine(event.date, line))) continue;

    const locationLine = window.find((line) => (
      normalizeLookup(line) !== opponent &&
      normalizeLookup(line) !== sport &&
      isScheduleLocationCandidate(line)
    ));

    if (locationLine) return cleanScheduleLocation(locationLine);
  }

  return null;
}

const MONTH_ABBR: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function parseCompositeCalendarDate(dateText: string, timeText: string): Date | null {
  // e.g. dateText = "Apr. 28, 2026" or "Apr 28, 2026"
  const dateMatch = dateText.match(/([A-Za-z]{3})\.?\s+(\d{1,2}),\s+(\d{4})/);
  if (!dateMatch) return null;
  const monthIdx = MONTH_ABBR[dateMatch[1]];
  if (monthIdx === undefined) return null;
  const day = parseInt(dateMatch[2], 10);
  const year = parseInt(dateMatch[3], 10);

  // e.g. timeText = "6:00 PM", "TBA", "12:30 AM"
  let hour = 12;
  let minute = 0;
  if (timeText !== 'TBA') {
    const timeMatch = timeText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (timeMatch) {
      hour = parseInt(timeMatch[1], 10);
      minute = parseInt(timeMatch[2], 10);
      const isPM = timeMatch[3].toUpperCase() === 'PM';
      if (isPM && hour !== 12) hour += 12;
      if (!isPM && hour === 12) hour = 0;
    }
  }

  return new Date(year, monthIdx, day, hour, minute);
}

function parseUpcomingHtmlSummary(summary: string): { sport: string; opponent: string; isHome: boolean } | null {
  const cleaned = summary
    .replace(/^UCI\s+/i, '')
    .replace(/^UC Irvine\s+/i, '')
    .trim();
  const versusMatch = cleaned.match(/^(.*?)\s+(?:versus|vs\.?|vs)\s+(.+)$/i);
  if (versusMatch) {
    return {
      sport: versusMatch[1].trim(),
      opponent: versusMatch[2].trim().replace(/^#\d+\s+/, ''),
      isHome: true,
    };
  }
  const atMatch = cleaned.match(/^(.*?)\s+at\s+(.+)$/i);
  if (atMatch) {
    return {
      sport: atMatch[1].trim(),
      opponent: atMatch[2].trim().replace(/^#\d+\s+/, ''),
      isHome: false,
    };
  }
  return null;
}

function parseSummary(raw: string): { sport: string; opponent: string; isHome: boolean } | null {
  const s = raw.replace(/^\[.\]\s*/, '').replace(/^UCI\s+/, '');
  const vsIdx = s.indexOf(' vs ');
  const atIdx = s.indexOf(' at ');
  let sport: string;
  let rest: string;
  let isHome: boolean;

  if (vsIdx !== -1 && (atIdx === -1 || vsIdx < atIdx)) {
    sport = s.slice(0, vsIdx).trim();
    rest = s.slice(vsIdx + 4).trim();
    isHome = true;
  } else if (atIdx !== -1) {
    sport = s.slice(0, atIdx).trim();
    rest = s.slice(atIdx + 4).trim();
    isHome = false;
  } else {
    return null;
  }

  const dashIdx = rest.indexOf(' - ');
  const opponent = (dashIdx !== -1 ? rest.slice(0, dashIdx) : rest).trim().replace(/^#\d+\s+/, '');
  return { sport, opponent, isHome };
}

export function formatSportsEventTime(date: Date, timeLabel?: string): string {
  return timeLabel
    ? timeLabel
    : date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function dedupeSportsEvents(events: SportsEvent[]) {
  const seen = new Set<string>();
  const deduped: SportsEvent[] = [];

  for (const event of events) {
    const signature = [
      event.title,
      event.location,
      event.date.toISOString(),
      event.timeLabel ?? '',
    ].join('|');

    if (seen.has(signature)) continue;
    seen.add(signature);
    deduped.push(event);
  }

  return deduped;
}

function parseSportsCompositeCalendarHtml(
  text: string,
  options?: { maxDaysAhead?: number; includePastDays?: number }
): SportsEvent[] {
  const maxDaysAhead = options?.maxDaysAhead ?? 2;
  const includePastDays = options?.includePastDays ?? 0;
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const results: SportsEvent[] = [];
  const h3Matches = text.match(/<h3[^>]*>([\s\S]*?)<\/h3>/gi) ?? [];

  for (const match of h3Matches) {
    const heading = stripHtml(match);
    if (!heading.startsWith('Upcoming Event:')) continue;

    const parsedHeading = heading.match(/^Upcoming Event:\s*(.+?)\s+on\s+([A-Za-z]{3,4}\.?\s+\d{1,2},\s+\d{4})\s+at\s+(.+)$/i);
    if (!parsedHeading) continue;

    const [, summary, dateText, timeTextRaw] = parsedHeading;
    const parsed = parseUpcomingHtmlSummary(summary);
    if (!parsed) continue;

    const timeLabel = timeTextRaw.trim();
    const date = parseCompositeCalendarDate(dateText, timeLabel);
    if (!date) continue;

    const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayOffset = Math.round((eventDay.getTime() - todayMidnight.getTime()) / 86400000);
    if (dayOffset < -includePastDays || dayOffset > maxDaysAhead) continue;

    const sportLabel = parsed.sport;
    const style = getSportStyle(parsed.sport);

    results.push({
      id: `${parsed.sport}-${parsed.opponent}-${date.toISOString()}`,
      title: `${sportLabel} ${parsed.isHome ? 'vs' : 'at'} ${parsed.opponent}`,
      location: parsed.isHome ? 'Venue TBA' : 'Away',
      icon: style.icon,
      color: style.color,
      bg: style.bg,
      date,
      timeLabel,
      sport: sportLabel,
      opponent: parsed.opponent,
      isHome: parsed.isHome,
    });
  }

  return dedupeSportsEvents(results.sort((a, b) => a.date.getTime() - b.date.getTime()));
}

export function parseSportsCalendar(
  text: string,
  options?: { maxDaysAhead?: number; includePastDays?: number }
): SportsEvent[] {
  if (!text.includes('BEGIN:VEVENT')) {
    return parseSportsCompositeCalendarHtml(text, options);
  }
  const maxDaysAhead = options?.maxDaysAhead ?? 2;
  const includePastDays = options?.includePastDays ?? 0;
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const results: SportsEvent[] = [];

  for (const block of unfolded.split('BEGIN:VEVENT').slice(1)) {
    const get = (key: string) => {
      const match = block.match(new RegExp(`^${key}[^:]*:(.+)$`, 'm'));
      return match ? match[1].trim() : '';
    };

    const dtstart = get('DTSTART');
    const summary = get('SUMMARY');
    const location = get('LOCATION');
    const uid = get('UID');
    if (!dtstart || !summary) continue;

    const date = parseDTSTART(dtstart);
    if (isNaN(date.getTime())) continue;

    const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayOffset = Math.round((eventDay.getTime() - today.getTime()) / 86400000);
    if (dayOffset < -includePastDays || dayOffset > maxDaysAhead) continue;

    const parsed = parseSummary(summary);
    if (!parsed) continue;

    const { sport, opponent, isHome } = parsed;
    const style = getSportStyle(sport);
    const sportLabel = sport;

    results.push({
      id: uid || String(date.getTime()),
      title: `${sportLabel} ${isHome ? 'vs' : 'at'} ${opponent}`,
      location: parseLocation(location) || (isHome ? 'Venue TBA' : 'Away'),
      icon: style.icon,
      color: style.color,
      bg: style.bg,
      date,
      timeLabel: undefined,
      sport: sportLabel,
      opponent,
      isHome,
    });
  }

  return dedupeSportsEvents(results.sort((a, b) => a.date.getTime() - b.date.getTime()));
}

export async function enrichSportsEventsWithScheduleVenues(events: SportsEvent[]): Promise<SportsEvent[]> {
  const eventsNeedingVenue = events.filter((event) => isGenericSportsLocation(event.location));
  if (eventsNeedingVenue.length === 0) return events;

  const uniqueSports = Array.from(new Set(eventsNeedingVenue.map((event) => event.sport)));
  const scheduleTexts: Record<string, string> = {};

  await Promise.all(uniqueSports.map(async (sport) => {
    const path = SPORT_SCHEDULE_PATHS[sport];
    if (!path) return;
    const text = await fetchScheduleText(path);
    if (text) scheduleTexts[sport] = text;
  }));

  return events.map((event) => {
    if (!isGenericSportsLocation(event.location)) return event;
    const scheduleText = scheduleTexts[event.sport];
    if (!scheduleText) return event;

    const location = findLocationInSportSchedule(event, scheduleText);
    if (!location) return event;

    return {
      ...event,
      location,
    };
  });
}

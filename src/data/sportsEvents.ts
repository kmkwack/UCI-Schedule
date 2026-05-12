import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { sportsFeedForSchool, type SportsFeedConfig } from './schools';

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

type SportsFetchOptions = { maxDaysAhead?: number; includePastDays?: number };
type SchedulePageConfig = Extract<SportsFeedConfig, { kind: 'schedule-pages' }>['pages'][number];

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
const TEAM_SCHEDULE_FETCH_TIMEOUT_MS = 10000;
const TEAM_SCHEDULE_FETCH_CONCURRENCY = 4;

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

function parseScheduleTime(timeLabel: string): { hour: number; minute: number; label?: string } {
  const raw = timeLabel.replace(/\s+/g, ' ').trim();
  const normalized = raw
    .replace(/\./g, '')
    .replace(/\s+(EDT|EST|CDT|CST|MDT|MST|PDT|PST|ET|CT|MT|PT)$/i, '')
    .trim()
    .toUpperCase();

  if (!normalized || normalized === '-' || /^(TBA|TBD|CANCELED|CANCELLED|POSTPONED)$/.test(normalized)) {
    return { hour: 12, minute: 0, label: /CANCELED|CANCELLED|POSTPONED/.test(normalized) ? raw : 'TBA' };
  }
  if (normalized === 'NOON') return { hour: 12, minute: 0, label: raw };

  const match = normalized.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/);
  if (!match) return { hour: 12, minute: 0, label: raw || 'TBA' };

  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const isPm = match[3] === 'PM';
  if (isPm && hour !== 12) hour += 12;
  if (!isPm && hour === 12) hour = 0;
  return { hour, minute, label: raw };
}

function scheduleDateFromParts(year: number, month: string, day: string, timeLabel: string): Date | null {
  const monthIdx = MONTH_ABBR[month.slice(0, 3)];
  if (monthIdx === undefined) return null;
  const time = parseScheduleTime(timeLabel);
  return new Date(year, monthIdx, parseInt(day, 10), time.hour, time.minute);
}

function cleanOpponentName(value: string) {
  return decodeHtmlEntities(value)
    .replace(/\bOpens in a new window\b.*$/i, '')
    .replace(/^#\d+\s*/, '')
    .replace(/^RV\s+/i, '')
    .replace(/\s+(Updated Start Time.*|Doubleheader.*|Free Admission.*|Live on BTN.*|Homecoming.*)$/i, '')
    .replace(/\s+(Midweek Deals.*|Bark in the Park.*|Boilermaker Kids Club.*|No Fly Zone.*)$/i, '')
    .replace(/\s+(Picklepalooza.*|Riley Children's Day.*|Class of \d{4}.*|Senior Day.*|Star Wars Night.*)$/i, '')
    .replace(/\s+(Country Night.*|Fraternity Night.*|Sorority Night.*|Carnival Night.*|Purdue .*Giveaway.*|Upside Down.*)$/i, '')
    .replace(/\s+(Cannon Trophy Game|Old Oaken Bucket Game|Shillelagh Trophy Game)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripResultSuffix(value: string) {
  return value
    .replace(/\s+-\s*$/i, '')
    .replace(/\s*(?:W|L|T),?\s+\d[\d\s,\-.]*$/i, '')
    .replace(/\s+(?:Win|Loss)\s+\d[\d\s,\-.]*$/i, '')
    .replace(/\s+(?:Canceled|Cancelled|Postponed)$/i, '')
    .trim();
}

function splitOpponentAndLocation(value: string, fallbackLocation: string) {
  const cleaned = stripResultSuffix(value);
  const locationMatch = cleaned.match(/^(.+?)\s+([A-Z][A-Za-z0-9 .'"&-]+,\s*(?:[A-Z]{2}|(?:[A-Z]\.){2,}|[A-Z][a-z]+\.?)(?:\s*\/\s*[^()]+)?(?:\s+\(.+\))?)$/);
  if (!locationMatch) {
    return { opponent: cleanOpponentName(cleaned), location: fallbackLocation };
  }
  return {
    opponent: cleanOpponentName(locationMatch[1]),
    location: cleanScheduleLocation(locationMatch[2]),
  };
}

function makeSchedulePageEvent(
  sport: string,
  date: Date,
  timeLabel: string,
  opponent: string,
  location: string,
  isHome: boolean
): SportsEvent | null {
  if (!opponent || isNaN(date.getTime())) return null;
  const style = getSportStyle(sport);
  const cleanOpponent = cleanOpponentName(opponent);
  const cleanLocation = cleanScheduleLocation(location || (isHome ? 'Venue TBA' : 'Away'));
  return {
    id: `${sport}-${cleanOpponent}-${date.toISOString()}-${cleanLocation}`,
    title: `${sport} ${isHome ? 'vs' : 'at'} ${cleanOpponent}`,
    location: cleanLocation || (isHome ? 'Venue TBA' : 'Away'),
    icon: style.icon,
    color: style.color,
    bg: style.bg,
    date,
    timeLabel: parseScheduleTime(timeLabel).label,
    sport,
    opponent: cleanOpponent,
    isHome,
  };
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

function eventFromSidearmGame(game: any): SportsEvent | null {
  const dateValue = game?.date_utc ?? game?.date;
  const date = dateValue ? new Date(dateValue) : null;
  if (!date || isNaN(date.getTime())) return null;
  const sport = game?.sport?.title ?? game?.sport?.short_display ?? 'Sports';
  const opponent = game?.opponent?.title ?? game?.opponent?.name ?? game?.opponent_name ?? 'Opponent TBA';
  const indicator = String(game?.location_indicator ?? game?.at_vs ?? '').toUpperCase();
  const isHome = indicator === 'H' || indicator === 'VS' || indicator === 'V';
  const style = getSportStyle(sport);
  const timeLabel = game?.time || (game?.tbd ? 'TBA' : undefined);
  return {
    id: String(game?.id ?? `${sport}-${opponent}-${date.toISOString()}`),
    title: `${sport} ${isHome ? 'vs' : 'at'} ${opponent}`,
    location: game?.location || (isHome ? 'Venue TBA' : 'Away'),
    icon: style.icon,
    color: style.color,
    bg: style.bg,
    date,
    timeLabel: timeLabel === 'All Day' ? 'TBA' : timeLabel,
    sport,
    opponent,
    isHome,
  };
}

function filterSportsEventsByWindow(events: SportsEvent[], options?: { maxDaysAhead?: number; includePastDays?: number }) {
  const maxDaysAhead = options?.maxDaysAhead ?? 2;
  const includePastDays = options?.includePastDays ?? 0;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return events.filter((event) => {
    const eventDay = new Date(event.date.getFullYear(), event.date.getMonth(), event.date.getDate());
    const dayOffset = Math.round((eventDay.getTime() - today.getTime()) / 86400000);
    return dayOffset >= -includePastDays && dayOffset <= maxDaysAhead;
  });
}

function scheduleYearFromLines(lines: string[], month?: string) {
  const heading = lines.find((line) => /\b\d{4}\b.*\bSchedule\b/i.test(line));
  const seasonMatch = heading?.match(/\b(\d{4})\s*[-–]\s*(\d{2}|\d{4})\b/);
  if (seasonMatch && month) {
    const startYear = parseInt(seasonMatch[1], 10);
    const endYear = seasonMatch[2].length === 2
      ? parseInt(`${String(startYear).slice(0, 2)}${seasonMatch[2]}`, 10)
      : parseInt(seasonMatch[2], 10);
    const monthIdx = MONTH_ABBR[month.slice(0, 3)];
    if (monthIdx !== undefined) return monthIdx <= 7 ? endYear : startYear;
  }
  const match = heading?.match(/\b(\d{4})\b/);
  return match ? parseInt(match[1], 10) : new Date().getFullYear();
}

function scheduleYearFromSeason(season: string | undefined, month: string) {
  if (!season) return new Date().getFullYear();
  const seasonMatch = season.match(/^(\d{4})\s*[-–]\s*(\d{2}|\d{4})$/);
  if (seasonMatch) {
    const startYear = parseInt(seasonMatch[1], 10);
    const endYear = seasonMatch[2].length === 2
      ? parseInt(`${String(startYear).slice(0, 2)}${seasonMatch[2]}`, 10)
      : parseInt(seasonMatch[2], 10);
    const monthIdx = MONTH_ABBR[month.slice(0, 3)];
    if (monthIdx !== undefined) return monthIdx <= 7 ? endYear : startYear;
  }
  const yearMatch = season.match(/\b(\d{4})\b/);
  return yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
}

function scheduleDateFromLines(lines: string[], month: string, day: string, timeLabel: string): Date | null {
  return scheduleDateFromParts(scheduleYearFromLines(lines, month), month, day, timeLabel);
}

function parseUmdTextScheduleEvents(text: string, page: SchedulePageConfig, options?: SportsFetchOptions) {
  const lines = htmlToLines(text);
  const year = scheduleYearFromLines(lines);
  const headerIndex = lines.findIndex((line) => /^Date\s+Time\s+At\s+Opponent\s+Location/i.test(line));
  if (headerIndex < 0) return [];

  const events: SportsEvent[] = [];
  const scheduleLines = lines.slice(headerIndex + 1);

  for (let index = 0; index < scheduleLines.length; index += 1) {
    const line = scheduleLines[index];
    const match = line.match(/^([A-Za-z]{3})\s+(\d{1,2})\s+\([^)]+\)\s*(.*?)\s+(Home|Away|Neutral)\s*(.+)$/i);
    if (match) {
      const [, month, day, rawTime, marker, rawOpponentLocation] = match;
      if (/\b(Canceled|Cancelled|Postponed)\b/i.test(rawOpponentLocation)) continue;
      const date = scheduleDateFromParts(year, month, day, rawTime.trim());
      if (!date) continue;
      const isHome = marker.toLowerCase() === 'home';
      const parsed = splitOpponentAndLocation(rawOpponentLocation, isHome ? 'College Park, MD' : marker);
      const event = makeSchedulePageEvent(page.sport, date, rawTime.trim(), parsed.opponent, parsed.location, isHome);
      if (event) events.push(event);
      continue;
    }

    const dateMatch = line.match(/^([A-Za-z]{3})\s+(\d{1,2})\s+\([^)]+\)$/i);
    if (!dateMatch) continue;

    let cursor = index + 1;
    let rawTime = 'TBA';
    if (isScheduleTimeLine(scheduleLines[cursor] ?? '')) {
      rawTime = scheduleLines[cursor];
      cursor += 1;
    }

    const marker = scheduleLines[cursor] ?? '';
    if (!/^(Home|Away|Neutral)$/i.test(marker)) continue;
    cursor += 1;

    const opponent = scheduleLines[cursor] ?? '';
    const location = scheduleLines[cursor + 1] ?? (marker.toLowerCase() === 'home' ? 'College Park, MD' : marker);
    if (!opponent || /\b(Canceled|Cancelled|Postponed)\b/i.test(opponent)) continue;

    const [, month, day] = dateMatch;
    const date = scheduleDateFromParts(year, month, day, rawTime.trim());
    if (!date) continue;
    const isHome = marker.toLowerCase() === 'home';
    const event = makeSchedulePageEvent(page.sport, date, rawTime.trim(), opponent, location, isHome);
    if (event) events.push(event);
  }

  return dedupeSportsEvents(filterSportsEventsByWindow(events, options).sort((a, b) => a.date.getTime() - b.date.getTime()));
}

function isShortScheduleDateLine(line: string) {
  return /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s*([A-Za-z]{3})\.?\s+(\d{1,2})$/i.test(line);
}

function parseWmtScheduleDateAt(lines: string[], index: number) {
  const singleLineMatch = lines[index]?.match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s*([A-Za-z]{3})\.?\s+(\d{1,2})$/i);
  if (singleLineMatch) {
    return {
      month: singleLineMatch[2],
      day: singleLineMatch[3],
      nextIndex: index + 1,
    };
  }

  const weekdayMatch = lines[index]?.match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/i);
  const monthDayMatch = lines[index + 1]?.match(/^([A-Za-z]{3})\.?\s+(\d{1,2})$/i);
  if (!weekdayMatch || !monthDayMatch) return null;

  return {
    month: monthDayMatch[1],
    day: monthDayMatch[2],
    nextIndex: index + 2,
  };
}

function isAtVsLine(line: string) {
  return /^(?:#\d+\s*)?(at|vs\.?)(?:\s*#\d+)?$/i.test(line.trim());
}

function isScheduleTimeLine(line: string) {
  const normalized = line.trim();
  return /^(TBA|TBD|Noon|Canceled|Cancelled|Postponed)$/i.test(normalized)
    || /^\d{1,2}(?::\d{2})?\s*(AM|PM)(?:\s+[A-Z]{2,4})?$/i.test(normalized);
}

function isScheduleResultLine(line: string) {
  return /^(W|L|T)\s+(Win|Loss)?\s*\d/i.test(line)
    || /^(Canceled|Cancelled|Postponed)$/i.test(line)
    || /^\(\d+\s+Innings?\)$/i.test(line);
}

function isSchedulePageNoise(line: string) {
  const lower = line.toLowerCase();
  return !line
    || lower.includes('opens in a new window')
    || lower.includes('box score')
    || lower.includes('recap')
    || lower.includes('photo')
    || lower.includes('preview')
    || lower.includes('tickets')
    || lower.includes('live stats')
    || lower.includes('stream')
    || lower.includes('listen')
    || lower.includes('pdf')
    || lower.includes('schedule stats')
    || lower.includes('date teams location')
    || lower === 'loading'
    || lower === 'print';
}

function parseWmtScheduleEvents(text: string, page: SchedulePageConfig, options?: SportsFetchOptions) {
  const lines = htmlToLines(text);
  const startIndex = lines.findIndex((line) => line.replace(/^#+\s*/, '').trim() === 'Schedule Events');
  if (startIndex < 0) return [];

  const scheduleLines = lines.slice(startIndex + 1);
  const events: SportsEvent[] = [];

  for (let index = 0; index < scheduleLines.length; index += 1) {
    const parsedDate = parseWmtScheduleDateAt(scheduleLines, index);
    if (!parsedDate) continue;

    const nextDateIndex = scheduleLines.findIndex((line, innerIndex) => (
      innerIndex >= parsedDate.nextIndex
        && (isShortScheduleDateLine(line) || !!parseWmtScheduleDateAt(scheduleLines, innerIndex))
    ));
    const rawBlock = scheduleLines.slice(parsedDate.nextIndex, nextDateIndex >= 0 ? nextDateIndex : scheduleLines.length);
    const block = rawBlock.filter((line) => !isSchedulePageNoise(line));
    if (block.length < 2) continue;

    let cursor = 0;
    let isHome = true;
    const marker = block[cursor] ?? '';
    if (isAtVsLine(marker)) {
      isHome = !marker.replace(/^#\d+\s*/, '').toLowerCase().startsWith('at');
      cursor += 1;
    }

    const opponent = block[cursor] ?? '';
    const location = block[cursor + 1] ?? (isHome ? 'West Lafayette, IN' : 'Away');
    const timeLabel = block.slice(cursor + 2).find((line) => isScheduleTimeLine(line)) ?? 'TBA';
    if (/^(Canceled|Cancelled|Postponed)$/i.test(timeLabel)) continue;
    if (!opponent || isScheduleResultLine(opponent)) continue;

    const date = scheduleDateFromLines(lines, parsedDate.month, parsedDate.day, timeLabel);
    if (!date) continue;
    const event = makeSchedulePageEvent(page.sport, date, timeLabel, opponent, location, isHome);
    if (event) events.push(event);

    if (nextDateIndex >= 0) index = nextDateIndex - 1;
  }

  return dedupeSportsEvents(filterSportsEventsByWindow(events, options).sort((a, b) => a.date.getTime() - b.date.getTime()));
}

function parseWmtTableScheduleEvents(text: string, page: SchedulePageConfig, options?: SportsFetchOptions) {
  const selectedSeason = text.match(/<option value="([^"]+)"\s+selected>/i)?.[1];
  const chunks = text.split(/<div class="schedule__table_item schedule__table_item--inner\s+/).slice(1);
  const events: SportsEvent[] = [];

  chunks.forEach((chunk) => {
    const itemType = chunk.match(/^([a-z-]+)/i)?.[1]?.toLowerCase() ?? '';
    const dateLabel = stripHtml(chunk.match(/<div class="title">\s*<time>([\s\S]*?)<\/time>/i)?.[1] ?? '');
    const dateMatch = dateLabel.match(/(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)?\.?\s*([A-Za-z]{3,})\.?\s+(\d{1,2})/i);
    if (!dateMatch) return;

    const opponent = stripHtml(chunk.match(/<div class="name">\s*<span>([\s\S]*?)<\/span>/i)?.[1] ?? '');
    if (!opponent) return;

    const location = stripHtml(
      chunk.match(/<div class="location">[\s\S]*?<div class="name">\s*<span>([\s\S]*?)<\/span>/i)?.[1] ?? ''
    );
    const locationIndex = chunk.indexOf('<div class="location">');
    const afterLocation = locationIndex >= 0 ? chunk.slice(locationIndex) : chunk;
    const afterLocationBlock = afterLocation.replace(/^[\s\S]*?<\/div>\s*<\/div>\s*/, '');
    const timeLabel = stripHtml(afterLocationBlock.match(/^<span>([\s\S]*?)<\/span>/i)?.[1] ?? 'TBA');
    if (/^(Canceled|Cancelled|Postponed)$/i.test(timeLabel)) return;

    const [, month, day] = dateMatch;
    const date = scheduleDateFromParts(scheduleYearFromSeason(selectedSeason, month), month, day, timeLabel);
    if (!date) return;

    const isHome = itemType !== 'away';
    const event = makeSchedulePageEvent(page.sport, date, timeLabel, opponent, location || (isHome ? 'Venue TBA' : 'Away'), isHome);
    if (event) events.push(event);
  });

  return dedupeSportsEvents(filterSportsEventsByWindow(events, options).sort((a, b) => a.date.getTime() - b.date.getTime()));
}

async function fetchSchedulePageEvents(feed: Extract<SportsFeedConfig, { kind: 'schedule-pages' }>, options?: SportsFetchOptions) {
  const fetchPage = async (page: SchedulePageConfig) => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = setTimeout(() => controller?.abort(), TEAM_SCHEDULE_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(`${feed.baseUrl}${page.path}`, {
        headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Mozilla/5.0' },
        signal: controller?.signal,
      });
      if (!response.ok) return [];
      const text = await response.text();
      if (page.parser === 'umd-text') return parseUmdTextScheduleEvents(text, page, options);
      if (page.parser === 'wmt-table') return parseWmtTableScheduleEvents(text, page, options);
      return parseWmtScheduleEvents(text, page, options);
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  };

  const results: SportsEvent[][] = [];
  let nextIndex = 0;
  const workerCount = Math.min(TEAM_SCHEDULE_FETCH_CONCURRENCY, feed.pages.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < feed.pages.length) {
      const pageIndex = nextIndex;
      nextIndex += 1;
      results[pageIndex] = await fetchPage(feed.pages[pageIndex]);
    }
  }));

  const events = results.flat();
  return dedupeSportsEvents(events.sort((a, b) => a.date.getTime() - b.date.getTime()));
}

function parseSidearmComponentsEvents(text: string, options?: { maxDaysAhead?: number; includePastDays?: number }) {
  const eventsIndex = text.indexOf('"type":"events"');
  if (eventsIndex < 0) return [];
  const start = text.lastIndexOf('var obj = ', eventsIndex);
  if (start < 0) return [];
  const jsonStart = start + 'var obj = '.length;
  const windowsEnd = text.indexOf(';\r\n    if (!("sidearmComponents"', eventsIndex);
  const unixEnd = text.indexOf(';\n    if (!("sidearmComponents"', eventsIndex);
  const end = windowsEnd >= 0 ? windowsEnd : unixEnd;
  if (end < 0) return [];
  try {
    const obj = JSON.parse(text.slice(jsonStart, end));
    const events = (obj.data ?? []).map(eventFromSidearmGame).filter(Boolean) as SportsEvent[];
    return dedupeSportsEvents(filterSportsEventsByWindow(events, options).sort((a, b) => a.date.getTime() - b.date.getTime()));
  } catch {
    return [];
  }
}

async function fetchSidearmResponsiveEvents(feed: Extract<SportsFeedConfig, { kind: 'sidearm-responsive' }>, options?: { maxDaysAhead?: number; includePastDays?: number }) {
  const now = new Date();
  const months = [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1)];
  const events: SportsEvent[] = [];
  for (const month of months) {
    const url = new URL(`${feed.baseUrl}/services/responsive-calendar.ashx`);
    url.searchParams.set('type', 'month');
    url.searchParams.set('sport', '0');
    url.searchParams.set('location', 'all');
    url.searchParams.set('date', `${month.getMonth() + 1}/1/${month.getFullYear()}`);
    url.searchParams.set('year', String(month.getFullYear()));
    const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!response.ok) continue;
    const days = await response.json();
    (Array.isArray(days) ? days : []).forEach((day: any) => {
      (day.events ?? []).forEach((game: any) => {
        const event = eventFromSidearmGame(game);
        if (event) events.push(event);
      });
    });
  }
  return dedupeSportsEvents(filterSportsEventsByWindow(events, options).sort((a, b) => a.date.getTime() - b.date.getTime()));
}

export function formatSportsEventTime(date: Date, timeLabel?: string, timeZone?: string): string {
  return timeLabel
    ? timeLabel
    : date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, ...(timeZone ? { timeZone } : {}) });
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

export async function fetchSportsEventsForSchool(school: string, options?: { maxDaysAhead?: number; includePastDays?: number }) {
  const feed = sportsFeedForSchool(school);
  if (!feed) return [];
  if (feed.kind === 'sidearm-responsive') return fetchSidearmResponsiveEvents(feed, options);
  if (feed.kind === 'schedule-pages') return fetchSchedulePageEvents(feed, options);

  const response = await fetch(feed.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!response.ok) return [];
  const text = await response.text();
  if (feed.kind === 'sidearm-components') return parseSidearmComponentsEvents(text, options);

  const events = parseSportsCalendar(text, options);
  return feed.kind === 'uci-calendar' ? enrichSportsEventsWithScheduleVenues(events) : events;
}

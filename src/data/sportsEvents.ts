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

function parseCompositeCalendarDate(dateText: string, timeText: string): Date | null {
  const normalizedDate = dateText.replace(/\b([A-Za-z]{3})\./g, '$1');
  const normalizedTime = timeText === 'TBA' ? '12:00 PM' : timeText;
  const parsed = new Date(`${normalizedDate} ${normalizedTime}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const timeStr = timeLabel
    ? timeLabel
    : date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (eventDay.getTime() === today.getTime()) return `Today, ${timeStr}`;
  if (eventDay.getTime() === tomorrow.getTime()) return `Tomorrow, ${timeStr}`;
  return `${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, ${timeStr}`;
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

    const sportShort = parsed.sport.replace(/^(Men's|Women's)\s+/i, '');
    const style = getSportStyle(parsed.sport);

    results.push({
      id: `${sportShort}-${parsed.opponent}-${date.toISOString()}`,
      title: `${sportShort} ${parsed.isHome ? 'vs' : 'at'} ${parsed.opponent}`,
      location: parsed.isHome ? 'UCI Athletics' : 'Away',
      icon: style.icon,
      color: style.color,
      bg: style.bg,
      date,
      timeLabel,
      sport: sportShort,
      opponent: parsed.opponent,
      isHome: parsed.isHome,
    });
  }

  return results.sort((a, b) => a.date.getTime() - b.date.getTime());
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
    const sportShort = sport.replace(/^(Men's|Women's)\s+/i, '');

    results.push({
      id: uid || String(date.getTime()),
      title: `${sportShort} ${isHome ? 'vs' : 'at'} ${opponent}`,
      location: parseLocation(location) || (isHome ? 'UCI Campus' : 'Away'),
      icon: style.icon,
      color: style.color,
      bg: style.bg,
      date,
      timeLabel: undefined,
      sport: sportShort,
      opponent,
      isHome,
    });
  }

  return results.sort((a, b) => a.date.getTime() - b.date.getTime());
}

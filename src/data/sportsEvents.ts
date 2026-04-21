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

export function formatSportsEventTime(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (eventDay.getTime() === today.getTime()) return `Today, ${timeStr}`;
  if (eventDay.getTime() === tomorrow.getTime()) return `Tomorrow, ${timeStr}`;
  return `${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, ${timeStr}`;
}

export function parseSportsCalendar(
  text: string,
  options?: { maxDaysAhead?: number; includePastDays?: number }
): SportsEvent[] {
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
      sport: sportShort,
      opponent,
      isHome,
    });
  }

  return results.sort((a, b) => a.date.getTime() - b.date.getTime());
}

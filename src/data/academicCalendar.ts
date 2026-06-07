import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export type AcademicEventCategory =
  | 'instruction'   // quarter/semester start & end
  | 'enrollment'    // add/drop
  | 'passnopass'    // P/NP · S/U · Credit/No Credit deadline
  | 'withdrawal'    // course or term withdrawal (W grade)
  | 'deadline'      // grade submission, other admin
  | 'holiday'       // no class days
  | 'finals'        // finals period
  | 'graduation';   // commencement

export type AcademicEvent = {
  id: string;
  title: string;
  subtitle?: string;
  date: string;       // "YYYY-MM-DD"
  endDate?: string;   // "YYYY-MM-DD" for multi-day ranges
  category: AcademicEventCategory;
  url?: string;
};

// Ionicons name + brand-toned accent — consistent with app's design language
export const CATEGORY_CONFIG: Record<AcademicEventCategory, { ionIcon: string; accent: string }> = {
  instruction: { ionIcon: 'book-outline',             accent: '#4169E1' },
  enrollment:  { ionIcon: 'pencil-outline',            accent: '#4169E1' },
  passnopass:  { ionIcon: 'swap-horizontal-outline',   accent: '#4169E1' },
  withdrawal:  { ionIcon: 'exit-outline',              accent: '#4169E1' },
  deadline:    { ionIcon: 'time-outline',              accent: '#4169E1' },
  holiday:     { ionIcon: 'sunny-outline',             accent: '#4169E1' },
  finals:      { ionIcon: 'document-text-outline',     accent: '#4169E1' },
  graduation:  { ionIcon: 'school-outline',            accent: '#4169E1' },
};

// ─── Local fallback data ──────────────────────────────────────────────────────
// Used when Supabase is unreachable. Keep in sync with supabase/academic_calendar.sql.
// Source: https://reg.uci.edu/calendars/quarterly/2025-2026/quarterly25-26.html

const LOCAL_FALLBACK: Record<string, Record<string, AcademicEvent[]>> = {
  'UC Irvine': {
    '2025-Fall': [
      { id: 'uci-fa25-start',        title: 'Instruction Begins',       date: '2025-09-22', category: 'instruction' },
      { id: 'uci-fa25-adddrop',      title: 'Add/Drop Deadline',        subtitle: 'No dean\'s approval needed (5 PM)', date: '2025-10-10', category: 'enrollment',  url: 'https://reg.uci.edu/calendars/quarterly/2025-2026/quarterly25-26.html' },
      { id: 'uci-fa25-pnp',          title: 'P/NP Change Deadline',     subtitle: 'Last drop without W grade (5 PM)',  date: '2025-11-07', category: 'passnopass',  url: 'https://reg.uci.edu/enrollment/grading/passnopass.html' },
      { id: 'uci-fa25-veterans',     title: 'Veterans Day',             subtitle: 'No classes',                        date: '2025-11-11', category: 'holiday' },
      { id: 'uci-fa25-thanksgiving', title: 'Thanksgiving',             subtitle: 'No classes',                        date: '2025-11-27', endDate: '2025-11-28', category: 'holiday' },
      { id: 'uci-fa25-withdraw',     title: 'Withdrawal Deadline',      subtitle: 'W grade assigned (5 PM)',           date: '2025-12-05', category: 'withdrawal',  url: 'https://reg.uci.edu/calendars/quarterly/2025-2026/quarterly25-26.html' },
      { id: 'uci-fa25-lastday',      title: 'Last Day of Instruction',  date: '2025-12-05', category: 'instruction' },
      { id: 'uci-fa25-finals',       title: 'Finals Week',              date: '2025-12-06', endDate: '2025-12-12',   category: 'finals',      url: 'https://reg.uci.edu/calendars/quarterly/2025-2026/quarterly25-26.html' },
      { id: 'uci-fa25-grades',       title: 'Final Grades Due',         subtitle: 'Grades available 10 PM',           date: '2025-12-18', category: 'deadline' },
    ],
    '2026-Winter': [
      { id: 'uci-wi26-start',      title: 'Instruction Begins',       date: '2026-01-05', category: 'instruction' },
      { id: 'uci-wi26-mlk',        title: 'MLK Day',                  subtitle: 'No classes',                     date: '2026-01-19', category: 'holiday' },
      { id: 'uci-wi26-adddrop',    title: 'Add/Drop Deadline',        subtitle: 'No dean\'s approval needed (5 PM)', date: '2026-01-16', category: 'enrollment',  url: 'https://reg.uci.edu/calendars/quarterly/2025-2026/quarterly25-26.html' },
      { id: 'uci-wi26-pnp',        title: 'P/NP Change Deadline',     subtitle: 'Last drop without W grade (5 PM)',  date: '2026-02-13', category: 'passnopass',  url: 'https://reg.uci.edu/enrollment/grading/passnopass.html' },
      { id: 'uci-wi26-presidents', title: "Presidents' Day",          subtitle: 'No classes',                     date: '2026-02-16', category: 'holiday' },
      { id: 'uci-wi26-withdraw',   title: 'Withdrawal Deadline',      subtitle: 'W grade assigned (5 PM)',         date: '2026-03-13', category: 'withdrawal',  url: 'https://reg.uci.edu/calendars/quarterly/2025-2026/quarterly25-26.html' },
      { id: 'uci-wi26-lastday',    title: 'Last Day of Instruction',  date: '2026-03-13', category: 'instruction' },
      { id: 'uci-wi26-finals',     title: 'Finals Week',              date: '2026-03-14', endDate: '2026-03-20',  category: 'finals',      url: 'https://reg.uci.edu/calendars/quarterly/2025-2026/quarterly25-26.html' },
      { id: 'uci-wi26-grades',     title: 'Final Grades Due',         subtitle: 'Grades available 10 PM',         date: '2026-03-26', category: 'deadline' },
    ],
    '2026-Spring': [
      { id: 'uci-sp26-start',       title: 'Instruction Begins',       date: '2026-03-30', category: 'instruction' },
      { id: 'uci-sp26-adddrop',     title: 'Add/Drop Deadline',        subtitle: 'No dean\'s approval needed (5 PM)', date: '2026-04-10', category: 'enrollment',  url: 'https://reg.uci.edu/calendars/quarterly/2025-2026/quarterly25-26.html' },
      { id: 'uci-sp26-pnp',         title: 'P/NP Change Deadline',     subtitle: 'Last drop without W grade (5 PM)',  date: '2026-05-08', category: 'passnopass',  url: 'https://reg.uci.edu/enrollment/grading/passnopass.html' },
      { id: 'uci-sp26-memorial',    title: 'Memorial Day',             subtitle: 'No classes',                     date: '2026-05-25', category: 'holiday' },
      { id: 'uci-sp26-withdraw',    title: 'Withdrawal Deadline',      subtitle: 'W grade assigned (5 PM)',         date: '2026-06-05', category: 'withdrawal',  url: 'https://reg.uci.edu/calendars/quarterly/2025-2026/quarterly25-26.html' },
      { id: 'uci-sp26-lastday',     title: 'Last Day of Instruction',  date: '2026-06-05', category: 'instruction' },
      { id: 'uci-sp26-finals',      title: 'Finals Week',              date: '2026-06-06', endDate: '2026-06-12',  category: 'finals',      url: 'https://reg.uci.edu/calendars/quarterly/2025-2026/quarterly25-26.html' },
      { id: 'uci-sp26-grades',      title: 'Final Grades Due',         subtitle: 'Grades available 10 PM',         date: '2026-06-18', category: 'deadline' },
      { id: 'uci-sp26-commencement',title: 'Commencement',             date: '2026-06-13', category: 'graduation' },
    ],
    '2026-Fall': [
      { id: 'uci-fa26-start',        title: 'Instruction Begins',       date: '2026-09-21', category: 'instruction' },
      { id: 'uci-fa26-adddrop',      title: 'Add/Drop Deadline',        subtitle: 'No dean\'s approval needed (5 PM)', date: '2026-10-09', category: 'enrollment',  url: 'https://reg.uci.edu/calendars/quarterly/2026-2027/quarterly26-27.html' },
      { id: 'uci-fa26-pnp',          title: 'P/NP Change Deadline',     subtitle: 'Last drop without W grade (5 PM)',  date: '2026-11-06', category: 'passnopass',  url: 'https://reg.uci.edu/enrollment/grading/passnopass.html' },
      { id: 'uci-fa26-veterans',     title: 'Veterans Day',             subtitle: 'No classes',                     date: '2026-11-11', category: 'holiday' },
      { id: 'uci-fa26-thanksgiving', title: 'Thanksgiving',             subtitle: 'No classes',                     date: '2026-11-26', endDate: '2026-11-27', category: 'holiday' },
      { id: 'uci-fa26-withdraw',     title: 'Withdrawal Deadline',      subtitle: 'W grade assigned (5 PM)',         date: '2026-12-04', category: 'withdrawal' },
      { id: 'uci-fa26-lastday',      title: 'Last Day of Instruction',  date: '2026-12-04', category: 'instruction' },
      { id: 'uci-fa26-finals',       title: 'Finals Week',              date: '2026-12-05', endDate: '2026-12-11',  category: 'finals',      url: 'https://reg.uci.edu/calendars/quarterly/2026-2027/quarterly26-27.html' },
    ],
  },
};

// ─── Supabase fetch ───────────────────────────────────────────────────────────

const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
const cacheKey = (school: string, qKey: string) => `academic_cal_v1_${school}_${qKey}`;

type CacheEntry = { fetchedAt: number; events: AcademicEvent[] };

function rowToEvent(row: any): AcademicEvent {
  return {
    id:       String(row.id),
    title:    String(row.title),
    subtitle: row.subtitle ?? undefined,
    date:     String(row.date),
    endDate:  row.end_date ?? undefined,
    category: row.category as AcademicEventCategory,
    url:      row.url ?? undefined,
  };
}

/** Fetch events from Supabase, with 24 h AsyncStorage cache. Falls back to local data. */
export async function fetchAcademicEvents(school: string, quarterKey: string): Promise<AcademicEvent[]> {
  const key = cacheKey(school, quarterKey);

  // 1. Try cache first (instant)
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const entry: CacheEntry = JSON.parse(raw);
      if (Date.now() - entry.fetchedAt < CACHE_TTL_MS) {
        return entry.events;
      }
    }
  } catch {}

  // 2. Try Supabase
  try {
    const { data, error } = await supabase
      .from('academic_calendar')
      .select('id, title, subtitle, date, end_date, category, url')
      .eq('school', school)
      .eq('quarter_key', quarterKey)
      .order('date', { ascending: true });

    if (!error && data && data.length > 0) {
      const events = data.map(rowToEvent);
      // Save to cache
      const entry: CacheEntry = { fetchedAt: Date.now(), events };
      void AsyncStorage.setItem(key, JSON.stringify(entry));
      return events;
    }
  } catch {}

  // 3. Local fallback
  return (LOCAL_FALLBACK[school]?.[quarterKey] ?? [])
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Days from today until event start (negative = past). */
export function daysUntilEvent(event: AcademicEvent, now: Date): number {
  const today = new Date(now.toISOString().slice(0, 10) + 'T00:00:00');
  const eventDate = new Date(event.date + 'T00:00:00');
  return Math.round((eventDate.getTime() - today.getTime()) / 86_400_000);
}

/** Invalidate cache so next fetch pulls fresh data from Supabase. */
export async function invalidateAcademicCalendarCache(school: string, quarterKey: string) {
  try {
    await AsyncStorage.removeItem(cacheKey(school, quarterKey));
  } catch {}
}

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
  isCustom?: boolean; // true if added by the user themselves (deletable)
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

// ─── Term boundaries (for "is this term still in session?") ───────────────────

/**
 * Resolve the academic end date of a term from the local calendar data.
 * Prefers the end of finals; falls back to the last day of instruction.
 * Returns a Date at end-of-day (local), or null if we have no data for the term.
 *
 * Used to decide whether class reminders should still fire — month-based term
 * detection (getAcademicTermForDate) keeps reporting a term as "current" until
 * the month boundary, even after finals are over, which caused reminders to keep
 * firing for classes that already ended.
 */
export function getTermEndDate(school: string, quarterKey: string): Date | null {
  const events = LOCAL_FALLBACK[school]?.[quarterKey];
  if (!events || events.length === 0) return null;

  const finals = events.find((e) => e.category === 'finals');
  const lastInstruction = events
    .filter((e) => e.category === 'instruction')
    .sort((a, b) => (a.endDate ?? a.date).localeCompare(b.endDate ?? b.date))
    .pop();

  const endStr = (finals?.endDate ?? finals?.date) ?? (lastInstruction?.endDate ?? lastInstruction?.date);
  if (!endStr) return null;
  // end of that calendar day
  return new Date(`${endStr}T23:59:59`);
}

/** Start date of a term (Instruction Begins), or null if unknown. */
export function getTermStartDate(school: string, quarterKey: string): Date | null {
  const events = LOCAL_FALLBACK[school]?.[quarterKey];
  if (!events || events.length === 0) return null;
  const start = events
    .filter((e) => e.category === 'instruction')
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!start) return null;
  return new Date(`${start.date}T00:00:00`);
}

/**
 * Whether a term is currently in its active instruction/finals window.
 * If we have no calendar data for the term, returns true (don't suppress).
 */
export function isTermInSession(school: string, quarterKey: string, now: Date = new Date()): boolean {
  const end = getTermEndDate(school, quarterKey);
  if (end && now > end) return false;          // term is over (past finals)
  const start = getTermStartDate(school, quarterKey);
  if (start && now < start) return false;       // term hasn't started yet
  return true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Remove duplicate events from a merged (official + custom) list.
 * Dedupes first by `id`, then by a content fingerprint (title+date+endDate),
 * which catches cases where the same event was seeded twice with different ids
 * (e.g. duplicate rows in the academic_calendar table) or a user re-added an
 * event that already exists officially.
 */
export function dedupeAcademicEvents(events: AcademicEvent[]): AcademicEvent[] {
  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();
  const result: AcademicEvent[] = [];
  for (const event of events) {
    if (seenIds.has(event.id)) continue;
    const fingerprint = `${event.title.trim().toLowerCase()}|${event.date}|${event.endDate ?? ''}`;
    if (seenFingerprints.has(fingerprint)) continue;
    seenIds.add(event.id);
    seenFingerprints.add(fingerprint);
    result.push(event);
  }
  return result;
}

/** Days from today until event start (negative = past). */
export function daysUntilEvent(event: AcademicEvent, now: Date): number {
  const today = new Date(now.toISOString().slice(0, 10) + 'T00:00:00');
  const eventDate = new Date(event.date + 'T00:00:00');
  return Math.round((eventDate.getTime() - today.getTime()) / 86_400_000);
}

// ─── User-added personal academic events ─────────────────────────────────────

function rowToCustomEvent(row: any): AcademicEvent {
  return {
    id:       String(row.id),
    title:    String(row.title),
    subtitle: row.subtitle ?? undefined,
    date:     String(row.date),
    endDate:  row.end_date ?? undefined,
    category: row.category as AcademicEventCategory,
    isCustom: true,
  };
}

/** Fetch the events a user has personally added for a given school + term. */
export async function fetchUserAcademicEvents(userId: string, school: string, quarterKey: string): Promise<AcademicEvent[]> {
  try {
    const { data, error } = await supabase
      .from('user_academic_events')
      .select('id, title, subtitle, date, end_date, category')
      .eq('user_id', userId)
      .eq('school', school)
      .eq('quarter_key', quarterKey)
      .order('date', { ascending: true });

    if (!error && data) return data.map(rowToCustomEvent);
  } catch {}
  return [];
}

/** Add a personal academic event. Returns the created event, or null on failure. */
export async function addUserAcademicEvent(
  userId: string,
  school: string,
  quarterKey: string,
  input: { title: string; date: string; endDate?: string; subtitle?: string; category?: AcademicEventCategory }
): Promise<AcademicEvent | null> {
  try {
    const { data, error } = await supabase
      .from('user_academic_events')
      .insert({
        user_id: userId,
        school,
        quarter_key: quarterKey,
        title: input.title,
        subtitle: input.subtitle ?? null,
        date: input.date,
        end_date: input.endDate ?? null,
        category: input.category ?? 'deadline',
      })
      .select('id, title, subtitle, date, end_date, category')
      .single();

    if (!error && data) return rowToCustomEvent(data);
  } catch {}
  return null;
}

/** Delete a personal academic event the user added themselves. */
export async function deleteUserAcademicEvent(eventId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_academic_events')
      .delete()
      .eq('id', eventId);
    return !error;
  } catch {
    return false;
  }
}

/** Invalidate cache so next fetch pulls fresh data from Supabase. */
export async function invalidateAcademicCalendarCache(school: string, quarterKey: string) {
  try {
    await AsyncStorage.removeItem(cacheKey(school, quarterKey));
  } catch {}
}

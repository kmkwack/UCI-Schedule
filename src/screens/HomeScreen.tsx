import { useState, useEffect, ComponentProps } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Course } from '../data/courses';
import SettingsScreen from './SettingsScreen';

type Props = {
  activeCourses: Course[];
  onGoToTimetable: () => void;
  onGoToGrades: () => void;
};

type SportsEvent = {
  id: string;
  title: string;
  time: string;
  location: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  color: string;
  bg: string;
};

const SPORT_STYLES: Record<string, { icon: ComponentProps<typeof Ionicons>['name']; color: string; bg: string }> = {
  'Baseball':      { icon: 'baseball-outline',    color: '#f97316', bg: '#fff7ed' },
  'Softball':      { icon: 'baseball-outline',    color: '#f97316', bg: '#fff7ed' },
  'Basketball':    { icon: 'basketball-outline',  color: '#3b82f6', bg: '#eff6ff' },
  'Soccer':        { icon: 'football-outline',    color: '#22c55e', bg: '#f0fdf4' },
  'Tennis':        { icon: 'tennisball-outline',  color: '#eab308', bg: '#fefce8' },
  'Volleyball':    { icon: 'trophy-outline',      color: '#8b5cf6', bg: '#f5f3ff' },
  'Water Polo':    { icon: 'water-outline',       color: '#06b6d4', bg: '#ecfeff' },
  'Track & Field': { icon: 'fitness-outline',     color: '#f43f5e', bg: '#fff1f2' },
  'Golf':          { icon: 'flag-outline',        color: '#10b981', bg: '#ecfdf5' },
  'Cross Country': { icon: 'walk-outline',        color: '#64748b', bg: '#f8fafc' },
};

function getSportStyle(sport: string) {
  const normalized = sport.replace(/^(Men's|Women's)\s+/i, '');
  return SPORT_STYLES[normalized] ?? { icon: 'trophy-outline' as ComponentProps<typeof Ionicons>['name'], color: '#f97316', bg: '#fff7ed' };
}

function parseDTSTART(val: string): Date {
  const y = val.slice(0, 4), mo = val.slice(4, 6), d = val.slice(6, 8);
  if (!val.includes('T')) return new Date(`${y}-${mo}-${d}T00:00:00Z`);
  const h = val.slice(9, 11), m = val.slice(11, 13);
  return new Date(`${y}-${mo}-${d}T${h}:${m}:00Z`);
}

function parseLocation(loc: string): string {
  const unescaped = loc.replace(/\\,/g, ',');
  const parts = unescaped.split(', ');
  if (parts.length >= 3) return parts.slice(2).join(', ');
  return unescaped;
}

function formatEventTime(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (eventDay.getTime() === today.getTime()) return `Today, ${timeStr}`;
  if (eventDay.getTime() === tomorrow.getTime()) return `Tomorrow, ${timeStr}`;
  return `${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, ${timeStr}`;
}

function parseSummary(raw: string): { sport: string; opponent: string; isHome: boolean } | null {
  const s = raw.replace(/^\[.\]\s*/, '').replace(/^UCI\s+/, '');
  const vsIdx = s.indexOf(' vs ');
  const atIdx = s.indexOf(' at ');
  let sport: string, rest: string, isHome: boolean;
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

function parseICalEvents(text: string): SportsEvent[] {
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const now = new Date();
  const results: Array<{ date: Date; event: SportsEvent }> = [];

  for (const block of unfolded.split('BEGIN:VEVENT').slice(1)) {
    const get = (key: string) => {
      const m = block.match(new RegExp(`^${key}[^:]*:(.+)$`, 'm'));
      return m ? m[1].trim() : '';
    };
    const dtstart = get('DTSTART');
    const summary = get('SUMMARY');
    const location = get('LOCATION');
    const uid = get('UID');
    if (!dtstart || !summary) continue;
    const date = parseDTSTART(dtstart);
    if (isNaN(date.getTime())) continue;
    const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOffset = Math.round((eventDay.getTime() - today.getTime()) / 86400000);
    if (dayOffset < 0 || dayOffset > 2) continue;
    const parsed = parseSummary(summary);
    if (!parsed) continue;
    const { sport, opponent, isHome } = parsed;
    const style = getSportStyle(sport);
    const sportShort = sport.replace(/^(Men's|Women's)\s+/i, '');
    results.push({
      date,
      event: {
        id: uid || String(date.getTime()),
        title: `${sportShort} ${isHome ? 'vs' : 'at'} ${opponent}`,
        time: formatEventTime(date),
        location: parseLocation(location) || (isHome ? 'UCI Campus' : 'Away'),
        icon: style.icon,
        color: style.color,
        bg: style.bg,
      },
    });
  }

  results.sort((a, b) => a.date.getTime() - b.date.getTime());
  return results.map(e => e.event);
}

const QUOTES = [
  { text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.', author: 'Winston Churchill' },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'It always seems impossible until it\'s done.', author: 'Nelson Mandela' },
  { text: 'Don\'t watch the clock; do what it does. Keep going.', author: 'Sam Levenson' },
];

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Approximate Spring 2026 quarter start: March 30, 2026
const QUARTER_START = new Date('2026-03-30');

function getWeekNumber(): number {
  const now = new Date();
  const diff = now.getTime() - QUARTER_START.getTime();
  const week = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, Math.min(week, 10));
}

function getDateLabel(): string {
  const now = new Date();
  const dayName = DAY_LABELS[now.getDay()];
  const month = MONTH_LABELS[now.getMonth()];
  const date = now.getDate();
  const week = getWeekNumber();
  return `${dayName}, ${month} ${date} · Week ${week}`;
}

function getTodayDayCode(): string | null {
  const day = new Date().getDay();
  if (day === 1) return 'M';
  if (day === 2) return 'T';
  if (day === 3) return 'W';
  if (day === 4) return 'Th';
  if (day === 5) return 'F';
  return null;
}

function extractStartHour(timeRange: string): number {
  const start = timeRange.split(' - ')[0];
  const [hour, minute] = start.split(':').map(Number);
  return hour + minute / 60;
}

function formatTime(timeRange: string): string {
  // Convert "09:00 - 10:50" to "9:00 - 10:50 AM"
  const [start, end] = timeRange.split(' - ');
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const period = eh >= 12 ? 'PM' : 'AM';
  const fmtH = (h: number) => h > 12 ? h - 12 : h === 0 ? 12 : h;
  const fmtM = (m: number) => m === 0 ? '' : `:${m.toString().padStart(2, '0')}`;
  return `${fmtH(sh)}${fmtM(sm)} - ${fmtH(eh)}${fmtM(em)} ${period}`;
}

export default function HomeScreen({ activeCourses }: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const [sportsEvents, setSportsEvents] = useState<SportsEvent[]>([]);
  const [useCelsius, setUseCelsius] = useState(true);
  const [showTempPicker, setShowTempPicker] = useState(false);

  useEffect(() => {
    fetch('https://ucirvinesports.com/calendar.ics')
      .then(r => r.text())
      .then(text => setSportsEvents(parseICalEvents(text)))
      .catch(() => {});
  }, []);
  const todayCode = getTodayDayCode();
  const todayCourses = todayCode
    ? activeCourses
        .filter((c) => {
          // handle multi-day strings like "MWF" — check if today's code is in it
          if (todayCode === 'Th') return c.days.includes('Th');
          if (todayCode === 'T') return c.days.includes('T') && !c.days.includes('Th');
          return c.days.includes(todayCode);
        })
        .sort((a, b) => extractStartHour(a.time) - extractStartHour(b.time))
    : [];

  const nowHour = new Date().getHours() + new Date().getMinutes() / 60;
  const nextClass = todayCourses.find(c => extractStartHour(c.time) > nowHour) ?? null;
  const quote = QUOTES[new Date().getDay() % QUOTES.length];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f7f8fa' }}
      contentContainerStyle={{ paddingTop: 60, paddingHorizontal: 16, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#111827' }}>Home</Text>
        <TouchableOpacity
          onPress={() => setShowSettings(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: '#e8edf9', alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="person-outline" size={18} color="#4169E1" />
          </View>
        </TouchableOpacity>
      </View>
      <Text style={{ fontSize: 14, color: '#9ca3af', marginTop: 0, marginBottom: 20 }}>
        {getDateLabel()}
      </Text>

      <SettingsScreen visible={showSettings} onClose={() => setShowSettings(false)} />

      {/* Your Day card */}
      <View style={{
        backgroundColor: 'white', borderRadius: 20, padding: 20, marginBottom: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
      }}>
        <Text style={{ fontSize: 13, color: '#9ca3af', fontWeight: '500', marginBottom: 10 }}>Your Day</Text>

        {/* Class count */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
          <Text style={{ fontSize: 52, fontWeight: 'bold', color: '#111827', lineHeight: 56 }}>
            {todayCourses.length}
          </Text>
          <Text style={{ fontSize: 18, color: '#374151' }}>classes today</Text>
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: '#f3f4f6', marginBottom: 16 }} />

        {/* Quote */}
        <Text style={{ fontSize: 14, color: '#374151', fontStyle: 'italic', lineHeight: 20, marginBottom: 6 }}>
          "{quote.text}"
        </Text>
        <Text style={{ fontSize: 13, color: '#9ca3af' }}>— {quote.author}</Text>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: '#f3f4f6', marginTop: 16, marginBottom: 16 }} />

        {/* Coming Up */}
        <Text style={{ fontSize: 13, color: '#9ca3af', fontWeight: '500', marginBottom: 12 }}>Coming Up</Text>
        {nextClass ? (
          <View style={{ flexDirection: 'row' }}>
            {/* Left accent bar */}
            <View style={{ width: 3, borderRadius: 2, backgroundColor: '#6366f1', marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 }}>
                {nextClass.title || nextClass.code}
              </Text>
              <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 2 }}>
                {formatTime(nextClass.time)}
              </Text>
              {nextClass.location && (
                <Text style={{ fontSize: 13, color: '#9ca3af' }}>{nextClass.location}</Text>
              )}
            </View>
          </View>
        ) : (
          <Text style={{ fontSize: 14, color: '#9ca3af' }}>No more classes today</Text>
        )}
      </View>

      {/* Weather card */}
      <View style={{
        backgroundColor: '#e8edf9', borderRadius: 20, padding: 20, marginBottom: 16,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <TouchableOpacity
          onPress={() => setShowTempPicker(v => !v)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}
        >
          <Ionicons name="settings-outline" size={15} color="#4169E1" style={{ opacity: 0.6 }} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, color: '#4169E1', fontWeight: '600', opacity: 0.7, marginBottom: 8 }}>Weather</Text>
          {showTempPicker && (
            <View style={{
              flexDirection: 'row', gap: 8, marginBottom: 10,
            }}>
              {(['°C', '°F'] as const).map(unit => {
                const isCel = unit === '°C';
                const active = useCelsius === isCel;
                return (
                  <TouchableOpacity
                    key={unit}
                    onPress={() => { setUseCelsius(isCel); setShowTempPicker(false); }}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20,
                      backgroundColor: active ? '#4169E1' : 'rgba(65,105,225,0.12)',
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: active ? 'white' : '#4169E1' }}>{unit}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <Text style={{ fontSize: 42, fontWeight: 'bold', color: '#111827', lineHeight: 46 }}>
            {useCelsius ? '22°' : '72°'}
          </Text>
          <Text style={{ fontSize: 15, color: '#4169E1', marginTop: 4, opacity: 0.8 }}>Partly Cloudy</Text>
        </View>
        <Ionicons name="cloud-outline" size={56} color="#4169E1" style={{ opacity: 0.4 }} />
      </View>

      {/* Campus Events card */}
      <View style={{
        backgroundColor: 'white', borderRadius: 20, padding: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Ionicons name="calendar-outline" size={16} color="#374151" />
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>Campus Events</Text>
        </View>

        {sportsEvents.length === 0 ? (
          <Text style={{ fontSize: 14, color: '#9ca3af' }}>Loading upcoming games…</Text>
        ) : sportsEvents.map((event, index) => (
          <View key={event.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{
                width: 42, height: 42, borderRadius: 21,
                backgroundColor: event.bg, alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name={event.icon} size={20} color={event.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 }}>
                  {event.title}
                </Text>
                <Text style={{ fontSize: 13, color: '#6b7280' }}>{event.time}</Text>
                <Text style={{ fontSize: 13, color: '#9ca3af' }}>{event.location}</Text>
              </View>
            </View>
            {index < sportsEvents.length - 1 && (
              <View style={{ height: 1, backgroundColor: '#f3f4f6', marginVertical: 14 }} />
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

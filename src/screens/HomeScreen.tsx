import { useState, useEffect, ComponentProps } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Course, pastelForCourse, blockColorKey } from '../data/courses';
import SettingsScreen from './SettingsScreen';
import { useTheme, ThemePreference } from '../context/ThemeContext';

type Props = {
  activeCourses: Course[];
  onGoToTimetable: () => void;
  onGoToGrades: () => void;
  onLogout?: () => void;
  userEmail?: string;
  useCelsius: boolean;
  onUseCelsiusChange: (v: boolean) => void;
  themePreference?: ThemePreference;
  onThemeChange?: (v: ThemePreference) => void;
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

function getDaysArray(daysString: string): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < daysString.length) {
    const two = daysString.slice(i, i + 2);
    if (two === 'Th') { result.push('Th'); i += 2; continue; }
    if (two === 'Tu') { result.push('T');  i += 2; continue; }
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

const WMO_DESCRIPTIONS: Record<number, { label: string; icon: ComponentProps<typeof Ionicons>['name'] }> = {
  0:  { label: 'Clear Sky',       icon: 'sunny-outline' },
  1:  { label: 'Mainly Clear',    icon: 'sunny-outline' },
  2:  { label: 'Partly Cloudy',   icon: 'partly-sunny-outline' },
  3:  { label: 'Overcast',        icon: 'cloud-outline' },
  45: { label: 'Foggy',           icon: 'cloud-outline' },
  48: { label: 'Icy Fog',         icon: 'cloud-outline' },
  51: { label: 'Light Drizzle',   icon: 'rainy-outline' },
  53: { label: 'Drizzle',         icon: 'rainy-outline' },
  55: { label: 'Heavy Drizzle',   icon: 'rainy-outline' },
  61: { label: 'Light Rain',      icon: 'rainy-outline' },
  63: { label: 'Rain',            icon: 'rainy-outline' },
  65: { label: 'Heavy Rain',      icon: 'rainy-outline' },
  71: { label: 'Light Snow',      icon: 'snow-outline' },
  73: { label: 'Snow',            icon: 'snow-outline' },
  75: { label: 'Heavy Snow',      icon: 'snow-outline' },
  80: { label: 'Rain Showers',    icon: 'rainy-outline' },
  81: { label: 'Rain Showers',    icon: 'rainy-outline' },
  82: { label: 'Heavy Showers',   icon: 'thunderstorm-outline' },
  95: { label: 'Thunderstorm',    icon: 'thunderstorm-outline' },
  96: { label: 'Thunderstorm',    icon: 'thunderstorm-outline' },
  99: { label: 'Thunderstorm',    icon: 'thunderstorm-outline' },
};

export default function HomeScreen({ activeCourses, onLogout, userEmail, useCelsius, onUseCelsiusChange, themePreference, onThemeChange }: Props) {
  const { colors } = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const [sportsEvents, setSportsEvents] = useState<SportsEvent[]>([]);
  const [tempC, setTempC] = useState<number | null>(null);
  const [weatherCode, setWeatherCode] = useState<number | null>(null);

  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=33.6405&longitude=-117.8443&current=temperature_2m,weathercode&temperature_unit=celsius')
      .then(r => r.json())
      .then(json => {
        setTempC(json.current?.temperature_2m ?? null);
        setWeatherCode(json.current?.weathercode ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('https://ucirvinesports.com/calendar.ics')
      .then(r => r.text())
      .then(text => setSportsEvents(parseICalEvents(text)))
      .catch(() => {});
  }, []);
  const todayCode = getTodayDayCode();
  const todayCourses = todayCode
    ? activeCourses
        .filter((c) => c.days !== 'TBA' && c.time !== 'TBA' && getDaysArray(c.days).includes(todayCode))
        .sort((a, b) => extractStartHour(a.time) - extractStartHour(b.time))
    : [];

  const nowHour = new Date().getHours() + new Date().getMinutes() / 60;
  const upcomingClasses = todayCourses.filter(c => extractStartHour(c.time) > nowHour);
  const quote = QUOTES[new Date().getDay() % QUOTES.length];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bgSecondary }}
      contentContainerStyle={{ paddingTop: 60, paddingHorizontal: 16, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 32, fontWeight: 'bold', color: colors.text }}>Home</Text>
        <TouchableOpacity
          onPress={() => setShowSettings(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: colors.brandBg, alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="person-outline" size={18} color={colors.brand} />
          </View>
        </TouchableOpacity>
      </View>
      <Text style={{ fontSize: 14, color: colors.textTertiary, marginTop: 0, marginBottom: 20 }}>
        {getDateLabel()}
      </Text>

      <SettingsScreen visible={showSettings} onClose={() => setShowSettings(false)} onLogout={onLogout} userEmail={userEmail} useCelsius={useCelsius} onUseCelsiusChange={onUseCelsiusChange} themePreference={themePreference} onThemeChange={onThemeChange} />

      {/* Your Day card */}
      <View style={{
        backgroundColor: colors.card, borderRadius: 20, padding: 20, marginBottom: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
      }}>
        <Text style={{ fontSize: 13, color: colors.textTertiary, fontWeight: '500', marginBottom: 10 }}>Your Day</Text>

        {/* Class count */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
          <Text style={{ fontSize: 52, fontWeight: 'bold', color: colors.text, lineHeight: 56 }}>
            {todayCourses.length}
          </Text>
          <Text style={{ fontSize: 18, color: colors.textSecondary }}>classes today</Text>
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginBottom: 16 }} />

        {/* Quote */}
        <Text style={{ fontSize: 14, color: colors.textSecondary, fontStyle: 'italic', lineHeight: 20, marginBottom: 6 }}>
          "{quote.text}"
        </Text>
        <Text style={{ fontSize: 13, color: colors.textTertiary }}>— {quote.author}</Text>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginTop: 16, marginBottom: 16 }} />

        {/* Coming Up */}
        <Text style={{ fontSize: 13, color: colors.textTertiary, fontWeight: '500', marginBottom: 12 }}>Coming Up</Text>
        {upcomingClasses.length > 0 ? (
          <View style={{ gap: 12 }}>
            {upcomingClasses.map((c) => (
              <View key={c.id} style={{ flexDirection: 'row' }}>
                <View style={{ width: 3, borderRadius: 2, backgroundColor: pastelForCourse(blockColorKey(c)).border, marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
                    {c.title || c.code}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 2 }}>
                    {formatTime(c.time)}
                  </Text>
                  {c.location && (
                    <Text style={{ fontSize: 13, color: colors.textTertiary }}>{c.location}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ fontSize: 14, color: colors.textTertiary }}>No more classes today</Text>
        )}
      </View>

      {/* Weather card */}
      <View style={{
        backgroundColor: colors.brandBg, borderRadius: 20, padding: 20, marginBottom: 16,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, color: colors.brand, fontWeight: '600', opacity: 0.7, marginBottom: 8 }}>Weather</Text>
          <Text style={{ fontSize: 42, fontWeight: 'bold', color: colors.text, lineHeight: 46 }}>
            {tempC === null ? '--°' : useCelsius ? `${Math.round(tempC)}°` : `${Math.round(tempC * 9 / 5 + 32)}°`}
          </Text>
          <Text style={{ fontSize: 15, color: colors.brand, marginTop: 4, opacity: 0.8 }}>
            {weatherCode === null ? 'Loading…' : (WMO_DESCRIPTIONS[weatherCode]?.label ?? 'Clear Sky')}
          </Text>
        </View>
        <Ionicons
          name={weatherCode === null ? 'cloud-outline' : (WMO_DESCRIPTIONS[weatherCode]?.icon ?? 'sunny-outline')}
          size={56}
          color={colors.brand}
          style={{ opacity: 0.4 }}
        />
      </View>

      {/* Campus Events card */}
      <View style={{
        backgroundColor: colors.card, borderRadius: 20, padding: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Campus Events</Text>
        </View>

        {sportsEvents.length === 0 ? (
          <Text style={{ fontSize: 14, color: colors.textTertiary }}>Loading upcoming games…</Text>
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
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 }}>
                  {event.title}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>{event.time}</Text>
                <Text style={{ fontSize: 13, color: colors.textTertiary }}>{event.location}</Text>
              </View>
            </View>
            {index < sportsEvents.length - 1 && (
              <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginVertical: 14 }} />
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

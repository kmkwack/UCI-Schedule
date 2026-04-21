import { useState, useEffect, type ComponentProps } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Course, pastelForCourse, blockColorKey } from '../data/courses';
import { formatSportsEventTime, parseSportsCalendar, type SportsEvent } from '../data/sportsEvents';
import SettingsScreen from './SettingsScreen';
import { useTheme, ThemePreference } from '../context/ThemeContext';
import type { EditableProfile, NotificationPreferences, PushPermissionStatus, TimetableVisibility, UserSettingsState } from '../data/userPreferences';

type Props = {
  activeCourses: Course[];
  onGoToTimetable: () => void;
  onGoToGrades: () => void;
  onLogout?: () => void;
  userName?: string;
  userEmail?: string;
  userProfile: EditableProfile;
  userSettings: UserSettingsState;
  useCelsius: boolean;
  onUseCelsiusChange: (v: boolean) => void;
  themePreference?: ThemePreference;
  onThemeChange?: (v: ThemePreference) => void;
  onSaveProfile: (profile: EditableProfile) => Promise<boolean>;
  onSaveVisibility: (visibility: TimetableVisibility) => Promise<boolean>;
  onSaveNotifications: (notifications: NotificationPreferences, pushPermissionStatus: PushPermissionStatus) => Promise<boolean>;
  onRequestPushPermissions: () => Promise<PushPermissionStatus>;
  savingProfile?: boolean;
  savingVisibility?: boolean;
  savingNotifications?: boolean;
};

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

export default function HomeScreen({
  activeCourses,
  onLogout,
  userName,
  userEmail,
  userProfile,
  userSettings,
  useCelsius,
  onUseCelsiusChange,
  themePreference,
  onThemeChange,
  onSaveProfile,
  onSaveVisibility,
  onSaveNotifications,
  onRequestPushPermissions,
  savingProfile,
  savingVisibility,
  savingNotifications,
}: Props) {
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
      .then(text => setSportsEvents(parseSportsCalendar(text, { maxDaysAhead: 2, includePastDays: 0 })))
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

      <SettingsScreen
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onLogout={onLogout}
        userName={userName}
        userEmail={userEmail}
        userProfile={userProfile}
        userSettings={userSettings}
        useCelsius={useCelsius}
        onUseCelsiusChange={onUseCelsiusChange}
        themePreference={themePreference}
        onThemeChange={onThemeChange}
        onSaveProfile={onSaveProfile}
        onSaveVisibility={onSaveVisibility}
        onSaveNotifications={onSaveNotifications}
        onRequestPushPermissions={onRequestPushPermissions}
        savingProfile={savingProfile}
        savingVisibility={savingVisibility}
        savingNotifications={savingNotifications}
      />

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
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>{formatSportsEventTime(event.date)}</Text>
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

import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Course } from '../data/courses';

type Props = {
  activeCourses: Course[];
  onGoToTimetable: () => void;
  onGoToGrades: () => void;
};

const QUOTES = [
  { text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.', author: 'Winston Churchill' },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'It always seems impossible until it\'s done.', author: 'Nelson Mandela' },
  { text: 'Don\'t watch the clock; do what it does. Keep going.', author: 'Sam Levenson' },
];

const CAMPUS_EVENTS = [
  { id: '1', title: 'Basketball vs State University', time: 'Tomorrow, 7:00 PM', location: 'Main Arena', icon: 'trophy-outline' as const, color: '#f97316', bg: '#fff7ed' },
  { id: '2', title: 'Soccer Match - Home Game', time: 'Saturday, 3:00 PM', location: 'University Stadium', icon: 'basketball-outline' as const, color: '#22c55e', bg: '#f0fdf4' },
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

  const nextClass = todayCourses[0] ?? null;
  const quote = QUOTES[new Date().getDay() % QUOTES.length];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f7f8fa' }}
      contentContainerStyle={{ paddingTop: 60, paddingHorizontal: 16, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#111827' }}>Home</Text>
      <Text style={{ fontSize: 14, color: '#9ca3af', marginTop: 4, marginBottom: 20 }}>
        {getDateLabel()}
      </Text>

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
        backgroundColor: '#eef2ff', borderRadius: 20, padding: 20, marginBottom: 16,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <View>
          <Text style={{ fontSize: 13, color: '#6366f1', fontWeight: '600', marginBottom: 8 }}>Weather</Text>
          <Text style={{ fontSize: 42, fontWeight: 'bold', color: '#111827', lineHeight: 46 }}>22°</Text>
          <Text style={{ fontSize: 15, color: '#6366f1', marginTop: 4 }}>Partly Cloudy</Text>
        </View>
        <Ionicons name="cloud-outline" size={56} color="#a5b4fc" />
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

        {CAMPUS_EVENTS.map((event, index) => (
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
            {index < CAMPUS_EVENTS.length - 1 && (
              <View style={{ height: 1, backgroundColor: '#f3f4f6', marginVertical: 14 }} />
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

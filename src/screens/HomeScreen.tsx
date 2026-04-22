import { useState, useEffect, useRef, type ComponentProps } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, ScrollView, TouchableOpacity, Animated, Easing, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Course, pastelForCourse, blockColorKey } from '../data/courses';
import { formatSportsEventTime, parseSportsCalendar, type SportsEvent } from '../data/sportsEvents';
import { useTheme } from '../context/ThemeContext';

type Props = {
  activeCourses: Course[];
  onGoToTimetable: () => void;
  onGoToGrades: () => void;
  onOpenSettings: () => void;
  bottomInset?: number;
  scrollToTopTrigger?: number;
};


const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Approximate Spring 2026 quarter start: March 30, 2026
const QUARTER_START = new Date('2026-03-30');
// Approximate end of Spring 2026 finals week
const QUARTER_END = new Date('2026-06-12T23:59:59');

function getWeekNumber(): number {
  const now = new Date();
  const diff = now.getTime() - QUARTER_START.getTime();
  const week = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, Math.min(week, 10));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getQuarterProgress(now: Date) {
  const total = QUARTER_END.getTime() - QUARTER_START.getTime();
  const elapsed = now.getTime() - QUARTER_START.getTime();
  return clamp(elapsed / Math.max(total, 1), 0, 1);
}

function getDaysRemainingInQuarter(now: Date) {
  const diff = QUARTER_END.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

function getDateLabel(): string {
  const now = new Date();
  const dayName = DAY_LABELS[now.getDay()];
  const month = MONTH_LABELS[now.getMonth()];
  const date = now.getDate();
  const week = getWeekNumber();
  return `${dayName}, ${month} ${date} · Week ${week}`;
}

function formatEventDayLabel(date: Date) {
  const dayName = DAY_LABELS[date.getDay()];
  const month = MONTH_LABELS[date.getMonth()];
  return `${dayName}, ${month} ${date.getDate()}`;
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

function extractEndHour(timeRange: string): number {
  const end = timeRange.split(' - ')[1];
  const [hour, minute] = end.split(':').map(Number);
  return hour + minute / 60;
}

function getCourseProgress(nowHour: number, timeRange: string) {
  const start = extractStartHour(timeRange);
  const end = extractEndHour(timeRange);
  if (nowHour <= start) return 0;
  if (nowHour >= end) return 1;
  return (nowHour - start) / Math.max(end - start, 0.01);
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
  onGoToTimetable,
  onGoToGrades,
  onOpenSettings,
  bottomInset = 0,
  scrollToTopTrigger = 0,
}: Props) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [useCelsius, setUseCelsius] = useState(true);
  const [sportsEvents, setSportsEvents] = useState<SportsEvent[]>([]);
  const [tempC, setTempC] = useState<number | null>(null);
  const [weatherCode, setWeatherCode] = useState<number | null>(null);
  const currentStopPulse = useState(() => new Animated.Value(0))[0];
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    async function loadWeather() {
      const cached = await AsyncStorage.getItem('weather_cache');
      if (cached) {
        const { tempC, weatherCode } = JSON.parse(cached);
        setTempC(tempC);
        setWeatherCode(weatherCode);
      }
      try {
        const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=33.6405&longitude=-117.8443&current=temperature_2m,weathercode&temperature_unit=celsius');
        const json = await r.json();
        const tempC = json.current?.temperature_2m ?? null;
        const weatherCode = json.current?.weathercode ?? null;
        setTempC(tempC);
        setWeatherCode(weatherCode);
        AsyncStorage.setItem('weather_cache', JSON.stringify({ tempC, weatherCode }));
      } catch {}
    }
    loadWeather();
  }, []);

  useEffect(() => {
    async function loadSports() {
      const cached = await AsyncStorage.getItem('sports_cache');
      if (cached) setSportsEvents(JSON.parse(cached).map((e: any) => ({ ...e, date: new Date(e.date) })));
      try {
        const r = await fetch('https://ucirvinesports.com/calendar.ics');
        const text = await r.text();
        const events = parseSportsCalendar(text, { maxDaysAhead: 2, includePastDays: 0 });
        setSportsEvents(events);
        AsyncStorage.setItem('sports_cache', JSON.stringify(events));
      } catch {}
    }
    loadSports();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 16);
    return () => clearInterval(interval);
  }, []);

  const todayCode = getTodayDayCode();
  const todayCourses = todayCode
    ? activeCourses
        .filter((c) => c.days !== 'TBA' && c.time !== 'TBA' && getDaysArray(c.days).includes(todayCode))
        .sort((a, b) => extractStartHour(a.time) - extractStartHour(b.time))
    : [];

  const nowHour = now.getHours() + now.getMinutes() / 60;
  const upcomingClasses = todayCourses.filter(c => extractStartHour(c.time) > nowHour);
  const completedClasses = todayCourses.filter(c => extractEndHour(c.time) <= nowHour).length;
  const currentClass = todayCourses.find(c => extractStartHour(c.time) <= nowHour && extractEndHour(c.time) >= nowHour) ?? null;
  const routeProgress = todayCourses.length === 0
    ? 0
    : (completedClasses + (currentClass ? getCourseProgress(nowHour, currentClass.time) : 0)) / todayCourses.length;
  const quarterProgress = getQuarterProgress(now);
  const quarterPercent = quarterProgress * 100;
  const daysRemaining = getDaysRemainingInQuarter(now);
  const groupedSportsEvents = sportsEvents.reduce<Array<{ dayLabel: string; events: SportsEvent[] }>>((groups, event) => {
    const dayLabel = formatEventDayLabel(event.date);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.dayLabel === dayLabel) {
      lastGroup.events.push(event);
    } else {
      groups.push({ dayLabel, events: [event] });
    }
    return groups;
  }, []);
  const raisedCardStyle = {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  } as const;
  const insetCardStyle = {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  } as const;
  const routeWidth = Math.max(windowWidth - 88, 260);

  useEffect(() => {
    if (!currentClass) {
      currentStopPulse.stopAnimation();
      currentStopPulse.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(currentStopPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(currentStopPulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [currentClass, currentStopPulse]);

  useEffect(() => {
    if (scrollToTopTrigger > 0) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scrollToTopTrigger]);

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: colors.bgSecondary }}
        contentContainerStyle={{ paddingTop: 64, paddingHorizontal: 16, paddingBottom: bottomInset + 70 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.text }}>Home</Text>
        <TouchableOpacity
          onPress={onOpenSettings}
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
      <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 0, marginBottom: 16 }}>
        {getDateLabel()}
      </Text>

      {/* Your Day card */}
      <View style={{
        ...raisedCardStyle,
        backgroundColor: colors.card,
        padding: 18,
        marginBottom: 16,
      }}>
        <Text style={{ fontSize: 13, color: colors.textTertiary, fontWeight: '500', marginBottom: 10 }}>Your Day</Text>

        {/* Class count */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
          <Text style={{ fontSize: 44, fontWeight: 'bold', color: colors.text, lineHeight: 48 }}>
            {upcomingClasses.length + (currentClass ? 1 : 0)}
          </Text>
          <Text style={{ fontSize: 16, color: colors.text }}>
            {upcomingClasses.length + (currentClass ? 1 : 0) === 1 ? 'class left today' : 'classes left today'}
          </Text>
        </View>

        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '600' }}>
              {completedClasses} completed
            </Text>
            <Text style={{ fontSize: 13, color: colors.brand, fontWeight: '700' }}>
              {Math.round(routeProgress * 100)}%
            </Text>
          </View>
          {todayCourses.length > 0 ? (
            <View style={{ alignItems: 'center' }}>
              {(() => {
                const ROUTE_WIDTH = routeWidth;
                const STOP_WIDTH = 72;
                const trackStart = STOP_WIDTH / 2;
                const trackEnd = ROUTE_WIDTH - STOP_WIDTH / 2;
                const TRACK_WIDTH = Math.max(trackEnd - trackStart, 0);
                const progressWidth = TRACK_WIDTH * routeProgress;

                return (
                  <View style={{ width: ROUTE_WIDTH }}>
                    <View style={{ position: 'relative', height: 30, marginBottom: 6 }}>
                      {todayCourses.length > 1 ? (
                        <>
                          <View
                            style={{
                              position: 'absolute',
                              left: trackStart,
                              right: STOP_WIDTH / 2,
                              top: 13,
                              height: 5,
                              borderRadius: 999,
                              backgroundColor: colors.bgTertiary,
                            }}
                          />
                          <View
                            style={{
                              position: 'absolute',
                              left: trackStart,
                              top: 13,
                              width: Math.max(progressWidth, 8),
                              height: 5,
                              borderRadius: 999,
                              backgroundColor: colors.brand,
                            }}
                          />
                        </>
                      ) : (
                        <View
                          style={{
                            position: 'absolute',
                            left: trackStart - 22,
                            right: STOP_WIDTH / 2 - 22,
                            top: 13,
                            height: 5,
                            borderRadius: 999,
                            backgroundColor: colors.bgTertiary,
                          }}
                        />
                      )}

                      {todayCourses.map((course, index) => {
                          const start = extractStartHour(course.time);
                          const end = extractEndHour(course.time);
                          const isCompleted = nowHour > end;
                          const isCurrent = nowHour >= start && nowHour <= end;
                          const stopLeft = todayCourses.length === 1
                            ? ROUTE_WIDTH / 2 - STOP_WIDTH / 2
                            : ((TRACK_WIDTH / Math.max(todayCourses.length - 1, 1)) * index);
                          const pulseScale = currentStopPulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.32],
                          });
                          const pulseOpacity = currentStopPulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.16, 0.34],
                          });

                          return (
                            <View
                              key={course.id}
                              style={{
                                position: 'absolute',
                                left: stopLeft,
                                top: 0,
                                width: STOP_WIDTH,
                                alignItems: 'center',
                              }}
                            >
                              <View style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>
                                {isCurrent ? (
                                  <Animated.View
                                    style={{
                                      position: 'absolute',
                                      width: 22,
                                      height: 22,
                                      borderRadius: 11,
                                      backgroundColor: colors.brand,
                                      opacity: pulseOpacity,
                                      transform: [{ scale: pulseScale }],
                                    }}
                                  />
                                ) : null}
                                <View
                                  style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: 9,
                                    borderWidth: 3,
                                    borderColor: isCompleted || isCurrent ? colors.brand : colors.borderSubtle,
                                    backgroundColor: colors.card,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    shadowColor: '#0f172a',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.12,
                                    shadowRadius: 8,
                                    elevation: 3,
                                  }}
                                >
                                  {isCurrent ? (
                                    <View
                                      style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: 3,
                                        backgroundColor: colors.brand,
                                      }}
                                    />
                                  ) : null}
                                </View>
                              </View>
                            </View>
                          );
                        })}
                    </View>

                    <View style={{ position: 'relative', height: 18 }}>
                      {todayCourses.map((course, index) => {
                        const stopLeft = todayCourses.length === 1
                          ? ROUTE_WIDTH / 2 - STOP_WIDTH / 2
                          : ((TRACK_WIDTH / Math.max(todayCourses.length - 1, 1)) * index);
                        return (
                          <View
                            key={`${course.id}-label`}
                            style={{
                              position: 'absolute',
                              left: stopLeft,
                              top: 0,
                              width: STOP_WIDTH,
                              alignItems: 'center',
                            }}
                          >
                            <Text
                              numberOfLines={2}
                              style={{
                                fontSize: 11,
                                lineHeight: 11,
                                textAlign: 'center',
                                color: colors.textSecondary,
                                fontWeight: '500',
                              }}
                            >
                              {course.code}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })()}
            </View>
          ) : (
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              No scheduled stops today.
            </Text>
          )}
        </View>

        <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginTop: 2, marginBottom: 10 }} />

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

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginTop: 16, marginBottom: 16 }} />

        <View style={{ marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 }}>
            <View>
              <Text style={{ fontSize: 13, color: colors.textTertiary, fontWeight: '500', marginBottom: 4 }}>
                Quarter Progress
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                {daysRemaining} days until finals end
              </Text>
            </View>
            <Text
              style={{
                width: 128,
                fontSize: 15,
                fontWeight: '600',
                color: colors.brand,
                textAlign: 'right',
                fontVariant: ['tabular-nums'],
              }}
            >
              {quarterPercent.toFixed(8)}%
            </Text>
          </View>
          <View style={{ height: 10, borderRadius: 999, backgroundColor: colors.bgTertiary, overflow: 'hidden', marginBottom: 10 }}>
            <View
              style={{
                width: `${Math.max(quarterPercent, 6)}%`,
                height: '100%',
                borderRadius: 999,
                backgroundColor: colors.brand,
              }}
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12, color: colors.textTertiary }}>Quarter Start</Text>
            <Text style={{ fontSize: 12, color: colors.textTertiary }}>Finals End</Text>
          </View>
        </View>
      </View>

      {/* Weather card */}
      <View style={{
        ...raisedCardStyle,
        backgroundColor: colors.brandBg,
        padding: 18,
        marginBottom: 16,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, color: colors.brand, fontWeight: '600', opacity: 0.7, marginBottom: 8 }}>Weather</Text>
          <Text style={{ fontSize: 36, fontWeight: 'bold', color: colors.text, lineHeight: 40 }}>
            {tempC === null ? '--°' : useCelsius ? `${Math.round(tempC)}°` : `${Math.round(tempC * 9 / 5 + 32)}°`}
          </Text>
          <Text style={{ fontSize: 15, color: colors.brand, marginTop: 4, opacity: 0.8 }}>
            {weatherCode === null ? 'Loading…' : (WMO_DESCRIPTIONS[weatherCode]?.label ?? 'Clear Sky')}
          </Text>
        </View>
        <Ionicons
          name={weatherCode === null ? 'cloud-outline' : (WMO_DESCRIPTIONS[weatherCode]?.icon ?? 'sunny-outline')}
          size={48}
          color={colors.brand}
          style={{ opacity: 0.4 }}
        />
      </View>

      {/* Campus Events card */}
      <View style={{
        ...raisedCardStyle,
        backgroundColor: colors.card,
        padding: 20,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Campus Events</Text>
        </View>

        {sportsEvents.length === 0 ? (
          <Text style={{ fontSize: 14, color: colors.textTertiary }}>Loading upcoming games…</Text>
        ) : groupedSportsEvents.map((group, groupIndex) => (
          <View key={group.dayLabel} style={{ marginBottom: groupIndex === groupedSportsEvents.length - 1 ? 0 : 18 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 12 }}>
              {group.dayLabel}
            </Text>
            {group.events.map((event, index) => (
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
                {index < group.events.length - 1 && (
                  <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginVertical: 14 }} />
                )}
              </View>
            ))}
            {groupIndex < groupedSportsEvents.length - 1 && (
              <View style={{ height: 1, backgroundColor: colors.border, marginTop: 16 }} />
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { Course, Quarter, QUARTERS, quarterKey, quarterLabel, colorForDepartment } from '../data/courses';

type Props = {
  activeCourses: Course[];
  selectedQuarter: Quarter;
  onChangeQuarter: (q: Quarter) => void;
  onOpenCoursePicker: () => void;
};

const DEFAULT_DAYS = ['M', 'T', 'W', 'Th', 'F'];
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 17;

const TIME_LABEL_WIDTH = 52;
const SIDE_PADDING = 12;
const TIMETABLE_CARD_PADDING = 12;

function parseHour(time: string) {
  const [hourStr, minuteStr] = time.split(':');
  return Number(hourStr) + Number(minuteStr) / 60;
}

function getCourseStartHour(timeRange: string) {
  return parseHour(timeRange.split(' - ')[0]);
}

function getCourseEndHour(timeRange: string) {
  return parseHour(timeRange.split(' - ')[1]);
}

function getDaysArray(daysString: string) {
  const result: string[] = [];
  let i = 0;
  while (i < daysString.length) {
    const two = daysString.slice(i, i + 2);
    if (two === 'Th') { result.push('Th'); i += 2; continue; }
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

function formatHourLabel(hour: number) {
  return `${hour.toString().padStart(2, '0')}:00`;
}

export default function TimetableScreen({
  activeCourses,
  selectedQuarter,
  onChangeQuarter,
  onOpenCoursePicker,
}: Props) {
  const [gridWidth, setGridWidth] = useState(0);
  const screenHeight = Dimensions.get('window').height;

  const visibleDays = useMemo(() => {
    const usedDays = new Set<string>();
    activeCourses.forEach((course) => getDaysArray(course.days).forEach((d) => usedDays.add(d)));
    const days = [...DEFAULT_DAYS];
    if (usedDays.has('Sa')) days.push('Sa');
    if (usedDays.has('Su')) days.push('Su');
    return days;
  }, [activeCourses]);

  const { displayStartHour, displayEndHour } = useMemo(() => {
    if (activeCourses.length === 0) {
      return { displayStartHour: DEFAULT_START_HOUR, displayEndHour: DEFAULT_END_HOUR };
    }
    const earliest = Math.min(...activeCourses.map((c) => getCourseStartHour(c.time)));
    const latest = Math.max(...activeCourses.map((c) => getCourseEndHour(c.time)));
    return {
      displayStartHour: Math.min(DEFAULT_START_HOUR, Math.floor(earliest)),
      displayEndHour: Math.max(DEFAULT_END_HOUR, Math.ceil(latest)),
    };
  }, [activeCourses]);

  const totalHours = displayEndHour - displayStartHour;
  const timetableHeight = Math.max(420, screenHeight - 370);
  const hourHeight = timetableHeight / totalHours;
  const hourLabels = Array.from({ length: totalHours + 1 }, (_, i) => displayStartHour + i);

  const usableGridWidth =
    gridWidth > 0
      ? gridWidth - TIME_LABEL_WIDTH
      : Dimensions.get('window').width - SIDE_PADDING * 2 - TIMETABLE_CARD_PADDING * 2 - TIME_LABEL_WIDTH;

  const dayColumnWidth = usableGridWidth / visibleDays.length;

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f8fa' }}>
      <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
        <Text style={{ fontSize: 28, fontWeight: 'bold' }}>Timetable</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 10 }}
          contentContainerStyle={{ paddingRight: 8 }}
        >
          {QUARTERS.map((q) => {
            const isActive = quarterKey(q) === quarterKey(selectedQuarter);
            return (
              <TouchableOpacity
                key={quarterKey(q)}
                onPress={() => onChangeQuarter(q)}
                style={{
                  backgroundColor: isActive ? '#2563eb' : '#f3f4f6',
                  borderRadius: 20,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  marginRight: 8,
                  borderWidth: 1,
                  borderColor: isActive ? '#2563eb' : '#e5e7eb',
                }}
              >
                <Text style={{ color: isActive ? 'white' : '#374151', fontWeight: isActive ? '700' : '400', fontSize: 13 }}>
                  {quarterLabel(q)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          onPress={onOpenCoursePicker}
          style={{
            marginTop: 10,
            backgroundColor: '#007AFF',
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: 'white', fontWeight: '600' }}>+ Add Class</Text>
        </TouchableOpacity>
      </View>

      <View
        style={{
          marginHorizontal: SIDE_PADDING,
          backgroundColor: 'white',
          borderRadius: 16,
          overflow: 'hidden',
          paddingBottom: 12,
        }}
        onLayout={(e) => {
          setGridWidth(e.nativeEvent.layout.width - TIMETABLE_CARD_PADDING * 2);
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            paddingTop: 12,
            paddingBottom: 8,
            paddingHorizontal: TIMETABLE_CARD_PADDING,
            borderBottomWidth: 1,
            borderBottomColor: '#eee',
            backgroundColor: 'white',
          }}
        >
          <View style={{ width: TIME_LABEL_WIDTH }} />
          {visibleDays.map((day) => (
            <View key={day} style={{ width: dayColumnWidth, alignItems: 'center' }}>
              <Text style={{ fontWeight: '700', fontSize: 12 }}>{day}</Text>
            </View>
          ))}
        </View>

        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: TIMETABLE_CARD_PADDING,
            paddingTop: 4,
            height: timetableHeight + 12,
          }}
        >
          <View style={{ width: TIME_LABEL_WIDTH, height: timetableHeight }}>
            {hourLabels.map((hour, index) => (
              <View key={hour} style={{ position: 'absolute', top: index * hourHeight - 8, left: 0 }}>
                <Text style={{ fontSize: 11, color: 'gray' }}>{formatHourLabel(hour)}</Text>
              </View>
            ))}
          </View>

          <View
            style={{
              width: dayColumnWidth * visibleDays.length,
              height: timetableHeight,
              position: 'relative',
              backgroundColor: 'white',
            }}
          >
            {hourLabels.map((hour, index) => (
              <View
                key={hour}
                style={{
                  position: 'absolute',
                  top: index * hourHeight,
                  left: 0,
                  right: 0,
                  height: 1,
                  backgroundColor: '#e5e5e5',
                }}
              />
            ))}

            <View style={{ flexDirection: 'row', height: timetableHeight }}>
              {visibleDays.map((day) => (
                <View
                  key={day}
                  style={{ width: dayColumnWidth, borderRightWidth: 1, borderRightColor: '#e5e5e5' }}
                />
              ))}
            </View>

            {activeCourses.flatMap((course) => {
              const courseDays = getDaysArray(course.days);
              const startHour = getCourseStartHour(course.time);
              const endHour = getCourseEndHour(course.time);
              const top = (startHour - displayStartHour) * hourHeight;
              const height = (endHour - startHour) * hourHeight;

              return courseDays.map((day) => {
                const dayIndex = visibleDays.indexOf(day);
                if (dayIndex === -1) return null;
                return (
                  <View
                    key={`${course.id}-${day}`}
                    style={{
                      position: 'absolute',
                      top,
                      left: dayIndex * dayColumnWidth + 2,
                      width: dayColumnWidth - 4,
                      height,
                      backgroundColor: colorForDepartment(course.department),
                      borderRadius: 8,
                      padding: 5,
                    }}
                  >
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 10 }} numberOfLines={2}>
                      {course.code}
                    </Text>
                    <Text style={{ color: 'white', fontSize: 8 }} numberOfLines={1}>{course.time}</Text>
                    <Text style={{ color: 'white', fontSize: 8 }} numberOfLines={1}>{course.professor}</Text>
                  </View>
                );
              });
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

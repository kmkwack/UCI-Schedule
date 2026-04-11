import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Dimensions } from 'react-native';
import { Course } from '../data/courses';

type Props = {
  selectedCourses: Course[];
  previewCourse: Course | null;
};

const DEFAULT_DAYS = ['M', 'T', 'W', 'Th', 'F'];
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 17;

const TIME_LABEL_WIDTH = 42;
const PREVIEW_HEIGHT = 250;
const HOUR_HEIGHT = 70;
const MIN_DAY_WIDTH = 62;

function parseHour(time: string) {
  const [hourStr, minuteStr] = time.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  return hour + minute / 60;
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

    if (two === 'Th') {
      result.push('Th');
      i += 2;
      continue;
    }
    if (two === 'Sa') {
      result.push('Sa');
      i += 2;
      continue;
    }
    if (two === 'Su') {
      result.push('Su');
      i += 2;
      continue;
    }

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
  return `${hour}:00`;
}

function colorForCourse(course: Course) {
  if (course.department === 'ECON') return '#7eb6ff';
  if (course.department === 'MGMT') return '#cfae5a';
  if (course.department === 'ART') return '#a7cf6f';
  if (course.department === 'BIO') return '#d07c70';
  return '#60a5fa';
}

export default function PreviewTimetable({
  selectedCourses,
  previewCourse,
}: Props) {
  const verticalScrollRef = useRef<ScrollView>(null);
  const horizontalScrollRef = useRef<ScrollView>(null);

  const shouldRenderPreview =
    previewCourse &&
    !selectedCourses.some((course) => course.id === previewCourse.id);

  const allVisibleCourses = shouldRenderPreview
    ? [...selectedCourses, previewCourse!]
    : selectedCourses;

  const visibleDays = useMemo(() => {
    const usedDays = new Set<string>();

    allVisibleCourses.forEach((course) => {
      getDaysArray(course.days).forEach((day) => usedDays.add(day));
    });

    const days = [...DEFAULT_DAYS];
    if (usedDays.has('Sa')) days.push('Sa');
    if (usedDays.has('Su')) days.push('Su');
    return days;
  }, [allVisibleCourses]);

  const { displayStartHour, displayEndHour } = useMemo(() => {
    if (allVisibleCourses.length === 0) {
      return {
        displayStartHour: DEFAULT_START_HOUR,
        displayEndHour: DEFAULT_END_HOUR,
      };
    }

    const earliest = Math.min(
      ...allVisibleCourses.map((course) => getCourseStartHour(course.time))
    );
    const latest = Math.max(
      ...allVisibleCourses.map((course) => getCourseEndHour(course.time))
    );

    return {
      displayStartHour: Math.min(DEFAULT_START_HOUR, Math.floor(earliest)),
      displayEndHour: Math.max(DEFAULT_END_HOUR, Math.ceil(latest)),
    };
  }, [allVisibleCourses]);

  const totalHours = displayEndHour - displayStartHour;
  const totalHeight = totalHours * HOUR_HEIGHT;

  const screenWidth = Dimensions.get('window').width;
  const baseGridWidth = screenWidth - 32 - TIME_LABEL_WIDTH;
  const dayColumnWidth = Math.max(MIN_DAY_WIDTH, baseGridWidth / 5);
  const actualGridWidth = dayColumnWidth * visibleDays.length;

  const hourLabels = Array.from(
    { length: totalHours + 1 },
    (_, index) => displayStartHour + index
  );

  useEffect(() => {
    if (!previewCourse) return;

    const start = getCourseStartHour(previewCourse.time);
    const targetY = Math.max((start - displayStartHour) * HOUR_HEIGHT - 50, 0);

    setTimeout(() => {
      verticalScrollRef.current?.scrollTo({ y: targetY, animated: true });
    }, 80);

    const previewDays = getDaysArray(previewCourse.days);
    if (previewDays.includes('Sa') || previewDays.includes('Su')) {
      setTimeout(() => {
        horizontalScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [previewCourse, displayStartHour]);

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 8,
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#e5e7eb',
      }}
    >
      <ScrollView
        ref={horizontalScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
      >
        <View>
          <View
            style={{
              flexDirection: 'row',
              paddingTop: 12,
              paddingBottom: 8,
              paddingHorizontal: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#e5e7eb',
              backgroundColor: 'white',
            }}
          >
            <View style={{ width: TIME_LABEL_WIDTH }} />
            {visibleDays.map((day) => (
              <View
                key={day}
                style={{
                  width: dayColumnWidth,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#374151', fontWeight: '600', fontSize: 12 }}>
                  {day}
                </Text>
              </View>
            ))}
          </View>

          <ScrollView
            ref={verticalScrollRef}
            style={{ height: PREVIEW_HEIGHT }}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={{ flexDirection: 'row', paddingHorizontal: 12 }}>
              <View style={{ width: TIME_LABEL_WIDTH, height: totalHeight }}>
                {hourLabels.map((hour, index) => (
                  <View
                    key={hour}
                    style={{
                      position: 'absolute',
                      top: index * HOUR_HEIGHT - 8,
                      left: 0,
                    }}
                  >
                    <Text style={{ color: '#9ca3af', fontSize: 11 }}>
                      {formatHourLabel(hour)}
                    </Text>
                  </View>
                ))}
              </View>

              <View
                style={{
                  width: actualGridWidth,
                  height: totalHeight,
                  position: 'relative',
                }}
              >
                {hourLabels.map((hour, index) => (
                  <View
                    key={hour}
                    style={{
                      position: 'absolute',
                      top: index * HOUR_HEIGHT,
                      left: 0,
                      right: 0,
                      height: 1,
                      backgroundColor: '#e5e7eb',
                    }}
                  />
                ))}

                <View style={{ flexDirection: 'row', height: totalHeight }}>
                  {visibleDays.map((day) => (
                    <View
                      key={day}
                      style={{
                        width: dayColumnWidth,
                        borderRightWidth: 1,
                        borderRightColor: '#e5e7eb',
                      }}
                    />
                  ))}
                </View>

                {selectedCourses.flatMap((course) => {
                  const days = getDaysArray(course.days);
                  const start = getCourseStartHour(course.time);
                  const end = getCourseEndHour(course.time);
                  const top = (start - displayStartHour) * HOUR_HEIGHT;
                  const height = (end - start) * HOUR_HEIGHT;

                  return days.map((day) => {
                    const dayIndex = visibleDays.indexOf(day);
                    if (dayIndex === -1) return null;

                    return (
                      <View
                        key={`selected-${course.id}-${day}`}
                        style={{
                          position: 'absolute',
                          top,
                          left: dayIndex * dayColumnWidth + 2,
                          width: dayColumnWidth - 4,
                          height,
                          backgroundColor: colorForCourse(course),
                          borderRadius: 8,
                          padding: 5,
                        }}
                      >
                        <Text
                          style={{ color: 'white', fontSize: 10, fontWeight: '700' }}
                          numberOfLines={2}
                        >
                          {course.title}
                        </Text>
                      </View>
                    );
                  });
                })}

                {shouldRenderPreview &&
                  previewCourse &&
                  getDaysArray(previewCourse.days).map((day) => {
                    const dayIndex = visibleDays.indexOf(day);
                    if (dayIndex === -1) return null;

                    const start = getCourseStartHour(previewCourse.time);
                    const end = getCourseEndHour(previewCourse.time);
                    const top = (start - displayStartHour) * HOUR_HEIGHT;
                    const height = (end - start) * HOUR_HEIGHT;

                    return (
                      <View
                        key={`preview-${previewCourse.id}-${day}`}
                        style={{
                          position: 'absolute',
                          top,
                          left: dayIndex * dayColumnWidth + 2,
                          width: dayColumnWidth - 4,
                          height,
                          backgroundColor: '#9ca3af',
                          opacity: 0.45,
                          borderRadius: 8,
                          padding: 5,
                          borderWidth: 1,
                          borderColor: '#ffffff',
                        }}
                      >
                        <Text
                          style={{ color: 'white', fontSize: 10, fontWeight: '700' }}
                          numberOfLines={2}
                        >
                          {previewCourse.title}
                        </Text>
                      </View>
                    );
                  })}
              </View>
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}
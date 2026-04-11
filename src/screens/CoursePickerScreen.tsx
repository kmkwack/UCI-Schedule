import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Alert,
} from 'react-native';
import { Course, courses } from '../data/courses';
import PreviewTimetable from '../components/PreviewTimetable';

type Props = {
  addedCourses: number[];
  onToggleCourse: (id: number) => void;
  onClose: () => void;
};

const deptFilters = ['All', 'ECON', 'MGMT', 'ART', 'BIO'];
const dayFilters = ['All', 'M', 'T', 'W', 'Th', 'F', 'Sa', 'Su'];

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

function formatStars(rating: number) {
  const rounded = Math.round(rating);
  return '★'.repeat(rounded) + '☆'.repeat(5 - rounded);
}

export default function CoursePickerScreen({
  addedCourses,
  onToggleCourse,
  onClose,
}: Props) {
  const [searchText, setSearchText] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedDay, setSelectedDay] = useState('All');
  const [previewCourse, setPreviewCourse] = useState<Course | null>(null);

  const selectedCourses = courses.filter((course) =>
    addedCourses.includes(course.id)
  );

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesSearch =
        course.code.toLowerCase().includes(searchText.toLowerCase()) ||
        course.title.toLowerCase().includes(searchText.toLowerCase()) ||
        course.professor.toLowerCase().includes(searchText.toLowerCase());

      const matchesDept =
        selectedDept === 'All' || course.department === selectedDept;

      const matchesDay =
        selectedDay === 'All' || getDaysArray(course.days).includes(selectedDay);

      return matchesSearch && matchesDept && matchesDay;
    });
  }, [searchText, selectedDept, selectedDay]);

  const isConflict = (candidate: Course) => {
    const candidateDays = getDaysArray(candidate.days);
    const candidateStart = getCourseStartHour(candidate.time);
    const candidateEnd = getCourseEndHour(candidate.time);

    return selectedCourses.find((existing) => {
      const existingDays = getDaysArray(existing.days);
      const sharedDay = candidateDays.some((day) => existingDays.includes(day));
      if (!sharedDay) return false;

      const existingStart = getCourseStartHour(existing.time);
      const existingEnd = getCourseEndHour(existing.time);

      return !(candidateEnd <= existingStart || candidateStart >= existingEnd);
    });
  };

  const handleAddToTable = (course: Course) => {
    const conflictCourse = isConflict(course);

    if (conflictCourse) {
      Alert.alert(
        'Add subject',
        `This schedule conflicts with '${conflictCourse.title}'. The subject will be removed if you add this. Add this subject?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add',
            onPress: () => {
              if (addedCourses.includes(conflictCourse.id)) {
                onToggleCourse(conflictCourse.id);
              }
              if (!addedCourses.includes(course.id)) {
                onToggleCourse(course.id);
              }
              setPreviewCourse(null);
            },
          },
        ]
      );
      return;
    }

    if (!addedCourses.includes(course.id)) {
      onToggleCourse(course.id);
    }
    setPreviewCourse(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f8fa', paddingTop: 54 }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingBottom: 10,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f7f8fa',
        }}
      >
        <TouchableOpacity onPress={onClose}>
          <Text style={{ color: '#111827', fontSize: 30 }}>×</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity
            style={{
              borderWidth: 1,
              borderColor: '#d1d5db',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 999,
              marginRight: 8,
              backgroundColor: 'white',
            }}
          >
            <Text style={{ color: '#374151', fontWeight: '600' }}>Wizard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              borderWidth: 1,
              borderColor: '#d1d5db',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: 'white',
            }}
          >
            <Text style={{ color: '#374151', fontWeight: '600' }}>
              Add manually
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <PreviewTimetable
        selectedCourses={selectedCourses}
        previewCourse={previewCourse}
      />

      <View
        style={{
          flex: 1,
          marginTop: 12,
          backgroundColor: 'white',
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          overflow: 'hidden',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
        }}
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search by course, title, or professor"
            placeholderTextColor="#9ca3af"
            style={{
              backgroundColor: '#f3f4f6',
              color: '#111827',
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
              marginBottom: 10,
            }}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 10 }}
          >
            {deptFilters.map((dept) => {
              const selected = selectedDept === dept;
              return (
                <TouchableOpacity
                  key={dept}
                  onPress={() => setSelectedDept(dept)}
                  style={{
                    backgroundColor: selected ? '#eff6ff' : '#f3f4f6',
                    borderRadius: 20,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    marginRight: 8,
                    borderWidth: 1,
                    borderColor: selected ? '#3b82f6' : '#e5e7eb',
                  }}
                >
                  <Text style={{ color: selected ? '#2563eb' : '#374151' }}>
                    {dept}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {dayFilters.map((day) => {
              const selected = selectedDay === day;
              return (
                <TouchableOpacity
                  key={day}
                  onPress={() => setSelectedDay(day)}
                  style={{
                    backgroundColor: selected ? '#eff6ff' : '#f3f4f6',
                    borderRadius: 20,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    marginRight: 8,
                    borderWidth: 1,
                    borderColor: selected ? '#3b82f6' : '#e5e7eb',
                  }}
                >
                  <Text style={{ color: selected ? '#2563eb' : '#374151' }}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={{
                backgroundColor: '#f3f4f6',
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 10,
                marginRight: 8,
                borderWidth: 1,
                borderColor: '#e5e7eb',
              }}
            >
              <Text style={{ color: '#374151' }}>Sort: Popular</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <FlatList
          data={filteredCourses}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
          renderItem={({ item }) => {
            const isAdded = addedCourses.includes(item.id);
            const isPreview = previewCourse?.id === item.id;

            return (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setPreviewCourse(item)}
                style={{
                  paddingVertical: 18,
                  borderBottomWidth: 1,
                  borderBottomColor: '#f3f4f6',
                  backgroundColor: isPreview ? '#fff7ed' : 'transparent',
                  borderRadius: 12,
                  paddingHorizontal: 8,
                  marginBottom: 2,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 16 }}>
                    <Text
                      style={{
                        color: '#111827',
                        fontWeight: '700',
                        fontSize: 18,
                      }}
                    >
                      {item.title}
                    </Text>

                    <Text style={{ color: '#4b5563', marginTop: 4, fontSize: 16 }}>
                      {item.professor}
                    </Text>

                    <Text style={{ color: '#6b7280', marginTop: 10, fontSize: 14 }}>
                      {item.days}
                    </Text>
                    <Text style={{ color: '#6b7280', fontSize: 14 }}>{item.time}</Text>
                    <Text style={{ color: '#6b7280', fontSize: 14 }}>
                      {item.location ?? 'TBA'}
                    </Text>
                    <Text style={{ color: '#6b7280', fontSize: 14 }}>
                      {item.units ?? 4} units · {item.code}
                    </Text>

                    {isPreview && (
                      <View style={{ marginTop: 14 }}>
                        <TouchableOpacity
                          onPress={() => handleAddToTable(item)}
                          style={{
                            backgroundColor: '#ef4444',
                            paddingVertical: 12,
                            paddingHorizontal: 18,
                            borderRadius: 999,
                            alignSelf: 'flex-start',
                          }}
                        >
                          <Text
                            style={{
                              color: 'white',
                              fontWeight: '700',
                              fontSize: 16,
                            }}
                          >
                            Add to table
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: '#f59e0b', fontSize: 18 }}>
                      {formatStars(item.rating)}
                    </Text>
                    <Text style={{ color: '#6b7280', marginTop: 4, fontSize: 14 }}>
                      Added {item.addedCount}
                    </Text>
                    {isAdded && (
                      <Text style={{ color: '#10b981', marginTop: 6, fontSize: 13 }}>
                        Added
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </View>
  );
}
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Course, Quarter, UCI_DEPARTMENTS, quarterLabel } from '../data/courses';
import PreviewTimetable from '../components/PreviewTimetable';

type Props = {
  activeCourses: Course[];
  onToggleCourse: (course: Course) => void;
  onClose: () => void;
  selectedQuarter: Quarter;
};

type CatalogCourse = {
  id: string;
  department: string;
  courseNumber: string;
  title: string;
  units?: string;
};

type WebsocTime = { hour: number; minute: number };

type WebsocSection = {
  sectionCode: string;
  sectionType: string;
  sectionNum: string;
  units: string;
  instructors: string[];
  meetings: {
    timeIsTBA: boolean;
    bldg: string[];
    days: string;
    startTime: WebsocTime;
    endTime: WebsocTime;
  }[];
  isCancelled: boolean;
};

type WebsocCourse = {
  courseTitle: string;
  courseNumber: string;
  sections: WebsocSection[];
};

const BASE = 'https://anteaterapi.com/v2/rest';

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatWebsocTime(start: WebsocTime, end: WebsocTime): string {
  return `${pad2(start.hour)}:${pad2(start.minute)} - ${pad2(end.hour)}:${pad2(end.minute)}`;
}

function formatLocation(raw: string | undefined): string {
  if (!raw) return 'TBA';
  const up = raw.toUpperCase();
  if (up.includes('VRTL') || up.includes('ON LINE') || up.includes('ONLINE')) return 'Online';
  return raw;
}

const SECTION_TYPE_ORDER: Record<string, number> = { Lec: 0, Dis: 1, Lab: 2 };

function sortSections(sections: WebsocSection[]): WebsocSection[] {
  return [...sections].sort((a, b) => {
    const typeA = SECTION_TYPE_ORDER[a.sectionType] ?? 3;
    const typeB = SECTION_TYPE_ORDER[b.sectionType] ?? 3;
    if (typeA !== typeB) return typeA - typeB;
    // Letter prefix of sectionNum (e.g. "A" from "A1")
    const letA = a.sectionNum.replace(/\d+$/, '');
    const letB = b.sectionNum.replace(/\d+$/, '');
    const letCmp = letA.localeCompare(letB);
    if (letCmp !== 0) return letCmp;
    // Numeric suffix (e.g. 1 from "A1")
    const numA = parseInt(a.sectionNum.replace(/^[A-Za-z]+/, '')) || 0;
    const numB = parseInt(b.sectionNum.replace(/^[A-Za-z]+/, '')) || 0;
    return numA - numB;
  });
}

function mapWebsocSection(section: WebsocSection, course: WebsocCourse, dept: string): Course {
  const meeting = section.meetings?.[0];
  const time = meeting?.timeIsTBA ? 'TBA' : formatWebsocTime(meeting.startTime, meeting.endTime);
  return {
    id: section.sectionCode,
    code: `${dept} ${course.courseNumber}`,
    title: course.courseTitle,
    professor: section.instructors?.[0] ?? 'TBA',
    days: meeting?.days ?? 'TBA',
    time,
    department: dept,
    addedCount: 0,
    rating: 0,
    location: formatLocation(meeting?.bldg?.[0]),
    units: parseFloat(section.units) || undefined,
    sectionLabel: `${section.sectionType} ${section.sectionNum}`,
  };
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

function parseHour(time: string) {
  const [h, m] = time.split(':');
  return Number(h) + Number(m) / 60;
}

function getCourseStartHour(t: string) { return parseHour(t.split(' - ')[0]); }
function getCourseEndHour(t: string) { return parseHour(t.split(' - ')[1]); }

export default function CoursePickerScreen({
  activeCourses,
  onToggleCourse,
  onClose,
  selectedQuarter,
}: Props) {
  const [searchText, setSearchText] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);
  const [deptSearch, setDeptSearch] = useState('');
  const [catalogCourses, setCatalogCourses] = useState<CatalogCourse[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [sectionsMap, setSectionsMap] = useState<Record<string, Course[]>>({});
  const [previewCourse, setPreviewCourse] = useState<Course | null>(null);

  // Single websoc call fetches all courses + sections for the department/quarter
  useEffect(() => {
    if (!selectedDept) {
      setCatalogCourses([]);
      setSectionsMap({});
      setExpandedCourseId(null);
      setPreviewCourse(null);
      return;
    }

    setCatalogLoading(true);
    setCatalogCourses([]);
    setSectionsMap({});
    setExpandedCourseId(null);
    setPreviewCourse(null);

    const params = new URLSearchParams({
      department: selectedDept,
      year: selectedQuarter.year,
      quarter: selectedQuarter.quarter,
    });

    fetch(`${BASE}/websoc?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) return;

        const schools: { departments: { deptCode: string; courses: WebsocCourse[] }[] }[] =
          data.data?.schools ?? [];

        // Use a map to deduplicate courses that appear under multiple schools
        const catalogMap: Record<string, CatalogCourse> = {};
        const newSectionsMap: Record<string, Course[]> = {};

        schools.forEach((school) => {
          school.departments.forEach((dept) => {
            dept.courses.forEach((course) => {
              const validSections = sortSections(course.sections.filter((s) => !s.isCancelled))
                .map((s) => mapWebsocSection(s, course, dept.deptCode));

              if (validSections.length === 0) return;

              const courseId = `${dept.deptCode}${course.courseNumber}`;

              if (catalogMap[courseId]) {
                // Merge sections from duplicate entries, avoiding duplicate section codes
                const existing = newSectionsMap[courseId] ?? [];
                const existingIds = new Set(existing.map((s) => s.id));
                const newSections = validSections.filter((s) => !existingIds.has(s.id));
                newSectionsMap[courseId] = [...existing, ...newSections];
              } else {
                catalogMap[courseId] = {
                  id: courseId,
                  department: dept.deptCode,
                  courseNumber: course.courseNumber,
                  title: course.courseTitle,
                  units: validSections[0]?.units?.toString(),
                };
                newSectionsMap[courseId] = validSections;
              }
            });
          });
        });

        setCatalogCourses(Object.values(catalogMap));
        setSectionsMap(newSectionsMap);
      })
      .catch(() => setCatalogCourses([]))
      .finally(() => setCatalogLoading(false));
  }, [selectedDept, selectedQuarter]);

  const handleExpandCourse = (course: CatalogCourse) => {
    if (expandedCourseId === course.id) {
      setExpandedCourseId(null);
      setPreviewCourse(null);
    } else {
      setExpandedCourseId(course.id);
      setPreviewCourse(null);
    }
  };

  const isConflict = (candidate: Course) => {
    if (candidate.time === 'TBA' || candidate.days === 'TBA') return undefined;
    const candidateDays = getDaysArray(candidate.days);
    const candidateStart = getCourseStartHour(candidate.time);
    const candidateEnd = getCourseEndHour(candidate.time);

    return activeCourses.find((existing) => {
      if (existing.id === candidate.id) return false;
      if (existing.time === 'TBA' || existing.days === 'TBA') return false;
      const existingDays = getDaysArray(existing.days);
      if (!candidateDays.some((d) => existingDays.includes(d))) return false;
      const existingStart = getCourseStartHour(existing.time);
      const existingEnd = getCourseEndHour(existing.time);
      return !(candidateEnd <= existingStart || candidateStart >= existingEnd);
    });
  };

  const handleAddToTable = (course: Course) => {
    const isAdded = activeCourses.some((c) => c.id === course.id);
    if (isAdded) {
      onToggleCourse(course);
      setPreviewCourse(null);
      return;
    }

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
              onToggleCourse(conflictCourse);
              onToggleCourse(course);
              setPreviewCourse(null);
            },
          },
        ]
      );
      return;
    }

    onToggleCourse(course);
    setPreviewCourse(null);
  };

  const filteredCatalog = useMemo(() => {
    const list = !searchText
      ? catalogCourses
      : catalogCourses.filter((c) => {
          const q = searchText.toLowerCase();
          if (
            c.courseNumber.toLowerCase().includes(q) ||
            c.title.toLowerCase().includes(q) ||
            c.department.toLowerCase().includes(q) ||
            `${c.department} ${c.courseNumber}`.toLowerCase().includes(q)
          ) return true;
          // Also match against professor names in any section
          return (sectionsMap[c.id] ?? []).some((s) =>
            s.professor.toLowerCase().includes(q)
          );
        });

    return [...list].sort((a, b) => {
      const numA = parseInt(a.courseNumber) || 0;
      const numB = parseInt(b.courseNumber) || 0;
      if (numA !== numB) return numA - numB;
      const suffixA = a.courseNumber.replace(/^\d+/, '');
      const suffixB = b.courseNumber.replace(/^\d+/, '');
      return suffixA.localeCompare(suffixB);
    });
  }, [catalogCourses, searchText, sectionsMap]);

  const filteredDepts = useMemo(() => {
    if (!deptSearch) return UCI_DEPARTMENTS;
    const q = deptSearch.toLowerCase();
    return UCI_DEPARTMENTS.filter((d) => d.toLowerCase().includes(q));
  }, [deptSearch]);

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f8fa', paddingTop: 54 }}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingBottom: 10,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <TouchableOpacity onPress={onClose}>
          <Text style={{ color: '#111827', fontSize: 30 }}>×</Text>
        </TouchableOpacity>

        <Text style={{ fontWeight: '700', fontSize: 15, color: '#374151' }}>
          {quarterLabel(selectedQuarter)}
        </Text>

        <View style={{ width: 32 }} />
      </View>

      <PreviewTimetable selectedCourses={activeCourses} previewCourse={previewCourse} />

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
            placeholder="Search title, code (e.g. ECON 100A), or professor"
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

          {/* Department dropdown */}
          <TouchableOpacity
            onPress={() => { setDeptDropdownOpen(true); setDeptSearch(''); }}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: selectedDept ? '#eff6ff' : '#f3f4f6',
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 13,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: selectedDept ? '#3b82f6' : '#e5e7eb',
            }}
          >
            <Text style={{ color: selectedDept ? '#2563eb' : '#9ca3af', fontSize: 15, fontWeight: selectedDept ? '600' : '400' }}>
              {selectedDept || 'Select a department…'}
            </Text>
            <Text style={{ color: '#9ca3af', fontSize: 12 }}>▼</Text>
          </TouchableOpacity>

          {/* Department picker modal */}
          <Modal visible={deptDropdownOpen} animationType="slide" transparent>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' }}>
              <View style={{ backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, maxHeight: '70%' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
                  <Text style={{ flex: 1, fontSize: 17, fontWeight: '700' }}>Select Department</Text>
                  <TouchableOpacity onPress={() => setDeptDropdownOpen(false)}>
                    <Text style={{ fontSize: 26, color: '#9ca3af' }}>×</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
                  <TextInput
                    value={deptSearch}
                    onChangeText={setDeptSearch}
                    placeholder="Search departments…"
                    placeholderTextColor="#9ca3af"
                    autoFocus
                    style={{
                      backgroundColor: '#f3f4f6',
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      fontSize: 15,
                    }}
                  />
                </View>

                <FlatList
                  data={filteredDepts}
                  keyExtractor={(item) => item}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
                  renderItem={({ item }) => {
                    const isSelected = selectedDept === item;
                    return (
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedDept(item);
                          setDeptDropdownOpen(false);
                        }}
                        style={{
                          paddingVertical: 14,
                          borderBottomWidth: 1,
                          borderBottomColor: '#f3f4f6',
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 15, color: isSelected ? '#2563eb' : '#111827', fontWeight: isSelected ? '700' : '400' }}>
                          {item}
                        </Text>
                        {isSelected && <Text style={{ color: '#2563eb' }}>✓</Text>}
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </View>
          </Modal>
        </View>

        {/* Content */}
        {!selectedDept ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 }}>
            <Text style={{ color: '#9ca3af', fontSize: 15 }}>Select a department to browse courses</Text>
          </View>
        ) : catalogLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 }}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={{ color: '#9ca3af', marginTop: 12 }}>Loading {selectedDept} courses for {quarterLabel(selectedQuarter)}…</Text>
            <Text style={{ color: '#c4c9d4', marginTop: 6, fontSize: 12 }}>Filtering out courses with no sections</Text>
          </View>
        ) : filteredCatalog.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 }}>
            <Text style={{ color: '#9ca3af', fontSize: 15 }}>No courses found</Text>
          </View>
        ) : (
          <FlatList
            data={filteredCatalog}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
            renderItem={({ item }) => {
              const isExpanded = expandedCourseId === item.id;
              const sections = sectionsMap[item.id] ?? [];

              return (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => handleExpandCourse(item)}
                  style={{
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: '#f3f4f6',
                  }}
                >
                  {/* Course header row */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={{ color: '#111827', fontWeight: '700', fontSize: 16 }}>
                        {item.department} {item.courseNumber}
                      </Text>
                      <Text style={{ color: '#4b5563', marginTop: 2, fontSize: 14 }}>{item.title}</Text>
                      {item.units != null && (
                        <Text style={{ color: '#9ca3af', marginTop: 2, fontSize: 12 }}>
                          {item.units} units
                        </Text>
                      )}
                    </View>
                    <Text style={{ color: '#9ca3af', fontSize: 18, marginTop: 2 }}>
                      {isExpanded ? '▲' : '▼'}
                    </Text>
                  </View>

                  {/* Expanded sections */}
                  {isExpanded && (
                    <View style={{ marginTop: 10 }}>
                      {sections.length === 0 ? (
                        <Text style={{ color: '#9ca3af', fontSize: 13, paddingVertical: 8 }}>
                          No sections found for {quarterLabel(selectedQuarter)}
                        </Text>
                      ) : (
                        sections.map((course) => {
                          const isAdded = activeCourses.some((c) => c.id === course.id);
                          const isPreviewing = previewCourse?.id === course.id;

                          return (
                            <TouchableOpacity
                              key={course.id}
                              activeOpacity={0.85}
                              onPress={() => setPreviewCourse(isPreviewing ? null : course)}
                              style={{
                                backgroundColor: isPreviewing ? '#eff6ff' : '#f9fafb',
                                borderRadius: 12,
                                padding: 12,
                                marginBottom: 8,
                                borderWidth: 1,
                                borderColor: isPreviewing ? '#3b82f6' : '#f3f4f6',
                              }}
                            >
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontWeight: '600', fontSize: 13, color: '#111827' }}>
                                    {course.id} · {course.sectionLabel ?? course.id}
                                  </Text>
                                  <Text style={{ color: '#4b5563', fontSize: 13, marginTop: 3 }}>
                                    {course.professor}
                                  </Text>
                                  {course.units != null && (
                                    <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
                                      {course.units} {course.units === 1 ? 'unit' : 'units'}
                                    </Text>
                                  )}
                                  <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
                                    {course.location}
                                  </Text>
                                  <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 1 }}>
                                    {course.days} · {course.time}
                                  </Text>
                                </View>

                                <TouchableOpacity
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleAddToTable(course);
                                  }}
                                  style={{
                                    backgroundColor: isAdded ? '#e5e7eb' : '#ef4444',
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 999,
                                    alignSelf: 'flex-start',
                                    marginTop: 2,
                                  }}
                                >
                                  <Text style={{ color: isAdded ? '#374151' : 'white', fontWeight: '700', fontSize: 13 }}>
                                    {isAdded ? 'Remove' : 'Add'}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </View>
  );
}

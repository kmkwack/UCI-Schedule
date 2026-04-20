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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Course, Quarter, TimetableSettings, DEFAULT_TIMETABLE_SETTINGS, UCI_DEPARTMENTS, quarterLabel, quarterKey } from '../data/courses';
import PreviewTimetable from '../components/PreviewTimetable';
import { supabase } from '../lib/supabase';

type Props = {
  activeCourses: Course[];
  onToggleCourse: (course: Course) => void;
  onFocusCourse: (courseId: string | null) => void;
  onClose: () => void;
  selectedQuarter: Quarter;
  timetableSettings?: TimetableSettings;
};

type CatalogCourse = {
  id: string;
  department: string;
  courseNumber: string;
  title: string;
  units?: string;
};


type SectionEnrollment = {
  status: string;          // "OPEN" | "Waitl" | "FULL" | "NewOnly"
  enrolled: number;
  capacity: number;
  waitlist: number;
  waitlistCap: number;
};

type GradeDistribution = {
  averageGPA: number | null;
  gradeACount: number;
  gradeBCount: number;
  gradeCCount: number;
  gradeDCount: number;
  gradeFCount: number;
  gradePCount: number;
  gradeNPCount: number;
};

type CourseReview = {
  id: string;
  author: string;
  rating: number;
  date: string;
  content: string;
  semester: string;
  difficulty: number;
  workload: number;
};

const MOCK_REVIEWS: CourseReview[] = [
  {
    id: 'r1', author: 'Anonymous', rating: 5, date: '2025-12-15',
    content: 'Excellent course! The professor explains complex concepts very intuitively. Assignments are challenging but fair. Highly recommend.',
    semester: 'Fall 2025', difficulty: 4, workload: 4,
  },
  {
    id: 'r2', author: 'Student123', rating: 4, date: '2025-12-10',
    content: 'Great course overall. Very useful and applicable material. Exams were tough but the curve helps. Make sure to attend all lectures.',
    semester: 'Fall 2025', difficulty: 5, workload: 5,
  },
  {
    id: 'r3', author: 'UCIAnteater', rating: 4, date: '2025-11-20',
    content: 'Interesting content with well-organized lectures. Homework reinforced the material well. The midterm was harder than expected.',
    semester: 'Fall 2025', difficulty: 3, workload: 4,
  },
];


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
  onFocusCourse,
  onClose,
  selectedQuarter,
  timetableSettings = DEFAULT_TIMETABLE_SETTINGS,
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
  const [enrollmentCache, setEnrollmentCache] = useState<Record<string, SectionEnrollment>>({});
  const [enrollmentLoadingIds, setEnrollmentLoadingIds] = useState<Set<string>>(new Set());
  const [reviewsCourse, setReviewsCourse] = useState<CatalogCourse | null>(null);
  const [reviewsInstructor, setReviewsInstructor] = useState<string>('');
  const [gradesCache, setGradesCache] = useState<Record<string, GradeDistribution | null>>({});
  const [gradeLoading, setGradeLoading] = useState(false);
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewDifficulty, setNewReviewDifficulty] = useState(3);
  const [newReviewWorkload, setNewReviewWorkload] = useState(3);
  const [newReviewContent, setNewReviewContent] = useState('');
  const [extraReviews, setExtraReviews] = useState<CourseReview[]>([]);

  // Fetch courses + sections from Supabase (pre-seeded from Anteater API)
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

    const qk = quarterKey(selectedQuarter);

    supabase
      .from('sections')
      .select('*')
      .eq('department', selectedDept)
      .eq('quarter_key', qk)
      .then(({ data, error }) => {
        if (error) { console.error('Supabase fetch failed:', error); setCatalogLoading(false); return; }

        const rows = data ?? [];

        // Group rows by course (e.g. "EECS125")
        const catalogMap: Record<string, CatalogCourse> = {};
        const rawSections: Record<string, any[]> = {};

        rows.forEach((row: any) => {
          const courseNumber = row.code.slice(row.department.length).trim();
          const courseId = `${row.department}${courseNumber}`;

          if (!catalogMap[courseId]) {
            catalogMap[courseId] = {
              id: courseId,
              department: row.department,
              courseNumber,
              title: row.title,
              units: row.units?.toString(),
            };
            rawSections[courseId] = [];
          } else {
            // Use the highest unit count seen across all sections (Dis sections are often 0)
            const existing = parseInt(catalogMap[courseId].units ?? '0') || 0;
            const incoming = row.units ?? 0;
            if (incoming > existing) {
              catalogMap[courseId].units = incoming.toString();
            }
          }
          rawSections[courseId].push(row);
        });

        // Build sectionsMap: sort sections then map to Course objects
        const newSectionsMap: Record<string, Course[]> = {};
        Object.entries(rawSections).forEach(([courseId, sectionRows]) => {
          const sorted = sectionRows.slice().sort((a, b) => {
            const typeOrder = (t: string) => ({ Lec: 0, Dis: 1, Lab: 2 }[t] ?? 3);
            const aType = a.section_label?.split(' ')[0] ?? '';
            const bType = b.section_label?.split(' ')[0] ?? '';
            if (typeOrder(aType) !== typeOrder(bType)) return typeOrder(aType) - typeOrder(bType);
            return (a.section_label ?? '').localeCompare(b.section_label ?? '', undefined, { numeric: true });
          });

          newSectionsMap[courseId] = sorted.map((row: any): Course => ({
            id: row.id,
            code: row.code,
            title: row.title,
            professor: row.professor ?? '',
            days: row.days ?? 'TBA',
            time: row.time ?? 'TBA',
            department: row.department,
            addedCount: 0,
            rating: 0,
            location: row.location ?? undefined,
            units: row.units ?? undefined,
            sectionLabel: row.section_label ?? undefined,
          }));
        });

        setCatalogCourses(Object.values(catalogMap));
        setSectionsMap(newSectionsMap);
      })
      .finally(() => setCatalogLoading(false));
  }, [selectedDept, selectedQuarter]);

  // Reset instructor selection when a different course's reviews are opened
  useEffect(() => {
    setReviewsInstructor('');
  }, [reviewsCourse]);

  // Fetch grade distribution from Anteater API (with client-side cache)
  useEffect(() => {
    if (!reviewsCourse) return;
    const { department, courseNumber } = reviewsCourse;
    const instructor = reviewsInstructor || undefined;
    const cacheKey = `${department}${courseNumber}${instructor ?? ''}`;
    if (cacheKey in gradesCache) return;

    setGradeLoading(true);
    const params = new URLSearchParams({ department, courseNumber });
    if (instructor) params.append('instructor', instructor);

    fetch(`https://anteaterapi.com/v2/rest/grades/aggregate?${params}`)
      .then((r) => r.json())
      .then((json) => {
        const dist: GradeDistribution | null = json?.data?.gradeDistribution ?? null;
        setGradesCache((prev) => ({ ...prev, [cacheKey]: dist }));
      })
      .catch(() => setGradesCache((prev) => ({ ...prev, [cacheKey]: null })))
      .finally(() => setGradeLoading(false));
  }, [reviewsCourse, reviewsInstructor]);

  const fetchEnrollment = async (course: CatalogCourse) => {
    if (enrollmentLoadingIds.has(course.id)) return;
    // Check if all sections for this course are already cached
    const sections = sectionsMap[course.id] ?? [];
    if (sections.length > 0 && sections.every((s) => s.id in enrollmentCache)) return;

    setEnrollmentLoadingIds((prev) => new Set(prev).add(course.id));
    try {
      const { year, quarter } = selectedQuarter;
      const url = `https://anteaterapi.com/v2/rest/websoc?department=${encodeURIComponent(course.department)}&courseNumber=${encodeURIComponent(course.courseNumber)}&year=${year}&quarter=${quarter}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!json.ok) return;

      const updates: Record<string, SectionEnrollment> = {};
      for (const school of json.data?.schools ?? []) {
        for (const dept of school.departments ?? []) {
          for (const c of dept.courses ?? []) {
            for (const s of c.sections ?? []) {
              updates[s.sectionCode] = {
                status: s.status ?? 'OPEN',
                enrolled: parseInt(s.numCurrentlyEnrolled?.totalEnrolled ?? '0') || 0,
                capacity: parseInt(s.maxCapacity ?? '0') || 0,
                waitlist: parseInt(s.numOnWaitlist ?? '0') || 0,
                waitlistCap: parseInt(s.numWaitlistCap ?? '0') || 0,
              };
            }
          }
        }
      }
      setEnrollmentCache((prev) => ({ ...prev, ...updates }));
    } catch (_) {
      // silently fail — section rows just won't show status
    } finally {
      setEnrollmentLoadingIds((prev) => { const s = new Set(prev); s.delete(course.id); return s; });
    }
  };

  const handleExpandCourse = (course: CatalogCourse) => {
    if (expandedCourseId === course.id) {
      setExpandedCourseId(null);
      setPreviewCourse(null);
    } else {
      setExpandedCourseId(course.id);
      setPreviewCourse(null);
      fetchEnrollment(course);
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
      onFocusCourse(null);
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
              onFocusCourse(course.id);
              setPreviewCourse(course);
            },
          },
        ]
      );
      return;
    }

    onToggleCourse(course);
    onFocusCourse(course.id);
    setPreviewCourse(course);
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

    const stripH = (s: string) => s.replace(/^H/i, '');
    return [...list].sort((a, b) => {
      const numA = parseInt(stripH(a.courseNumber)) || 0;
      const numB = parseInt(stripH(b.courseNumber)) || 0;
      if (numA !== numB) return numA - numB;
      const suffixA = stripH(a.courseNumber).replace(/^\d+/, '');
      const suffixB = stripH(b.courseNumber).replace(/^\d+/, '');
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

      <PreviewTimetable
        selectedCourses={activeCourses}
        previewCourse={previewCourse}
        onBackgroundPress={onClose}
        settings={timetableSettings}
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
              backgroundColor: selectedDept ? '#eef1fb' : '#f3f4f6',
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 13,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: selectedDept ? '#3b82f6' : '#e5e7eb',
            }}
          >
            <Text style={{ color: selectedDept ? '#4169E1' : '#9ca3af', fontSize: 15, fontWeight: selectedDept ? '600' : '400' }}>
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
                        <Text style={{ fontSize: 15, color: isSelected ? '#4169E1' : '#111827', fontWeight: isSelected ? '700' : '400' }}>
                          {item}
                        </Text>
                        {isSelected && <Text style={{ color: '#4169E1' }}>✓</Text>}
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
            <ActivityIndicator size="large" color="#4169E1" />
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
                          const enroll = enrollmentCache[course.id];
                          const statusColor = !enroll ? '#9ca3af'
                            : enroll.status === 'OPEN' ? '#16a34a'
                            : enroll.status === 'Waitl' ? '#d97706'
                            : '#dc2626';
                          const statusLabel = !enroll ? null
                            : enroll.status === 'OPEN' ? 'Open'
                            : enroll.status === 'Waitl' ? 'Waitlist'
                            : enroll.status === 'NewOnly' ? 'New Only'
                            : 'Full';

                          return (
                            <TouchableOpacity
                              key={course.id}
                              activeOpacity={0.85}
                              onPress={() => setPreviewCourse(isPreviewing ? null : course)}
                              style={{
                                backgroundColor: isPreviewing ? '#eef1fb' : '#f9fafb',
                                borderRadius: 12,
                                padding: 12,
                                marginBottom: 8,
                                borderWidth: 1,
                                borderColor: isPreviewing ? '#3b82f6' : '#f3f4f6',
                              }}
                            >
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <View style={{ flex: 1 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                    <Text style={{ fontWeight: '600', fontSize: 13, color: '#111827' }}>
                                      {course.id} · {course.sectionLabel ?? course.id}
                                    </Text>
                                    {statusLabel && (
                                      <View style={{ backgroundColor: `${statusColor}18`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor }}>{statusLabel}</Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text style={{ color: '#4b5563', fontSize: 13, marginTop: 1 }}>
                                    {course.professor}
                                  </Text>
                                  {enroll && (
                                    <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
                                      {enroll.enrolled}/{enroll.capacity} enrolled
                                      {enroll.status === 'Waitl' ? ` · ${enroll.waitlist}/${enroll.waitlistCap} waitlist` : ''}
                                    </Text>
                                  )}
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

                                <View style={{ alignItems: 'flex-end', gap: 6 }}>
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
                                      alignSelf: 'flex-end',
                                    }}
                                  >
                                    <Text style={{ color: isAdded ? '#374151' : 'white', fontWeight: '700', fontSize: 13 }}>
                                      {isAdded ? 'Remove' : 'Add'}
                                    </Text>
                                  </TouchableOpacity>
                                  {course.sectionLabel?.startsWith('Lec') && (
                                    <TouchableOpacity
                                      onPress={(e) => {
                                        e.stopPropagation();
                                        setReviewsCourse(item);
                                      }}
                                      style={{
                                        paddingHorizontal: 10, paddingVertical: 5,
                                        borderRadius: 999, backgroundColor: '#4169E1',
                                        alignSelf: 'flex-end',
                                      }}
                                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                                    >
                                      <Text style={{ fontSize: 11, color: 'white', fontWeight: '600' }}>Reviews</Text>
                                    </TouchableOpacity>
                                  )}
                                </View>
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

      {/* ── Reviews / Write Review — single Modal to avoid iOS stacking limit ── */}
      <Modal
        visible={!!reviewsCourse}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (showWriteReview) { setShowWriteReview(false); }
          else { setReviewsCourse(null); }
        }}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View style={{
              backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24,
              maxHeight: '90%', flex: 1,
            }}>

              {/* ── Reviews list view ── */}
              {!showWriteReview && (
                <>
                  {/* Header */}
                  <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 }}>
                          {reviewsCourse?.department} {reviewsCourse?.courseNumber}
                        </Text>
                        <Text style={{ fontSize: 13, color: '#6b7280' }}>{reviewsCourse?.title}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => { setReviewsCourse(null); setShowWriteReview(false); }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close" size={22} color="#6b7280" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
                    {/* ── Grade Distribution ── */}
                    {reviewsCourse && (() => {
                      const professors = [...new Set(
                        (sectionsMap[reviewsCourse.id] ?? [])
                          .map((s) => s.professor)
                          .filter((p) => p && !p.includes('STAFF'))
                      )];
                      const cacheKey = `${reviewsCourse.department}${reviewsCourse.courseNumber}${reviewsInstructor}`;
                      const grades = gradesCache[cacheKey];
                      const allEntries = grades ? [
                        { label: 'A', count: grades.gradeACount, color: '#22c55e' },
                        { label: 'B', count: grades.gradeBCount, color: '#4169E1' },
                        { label: 'C', count: grades.gradeCCount, color: '#f59e0b' },
                        { label: 'D', count: grades.gradeDCount, color: '#f97316' },
                        { label: 'F', count: grades.gradeFCount, color: '#ef4444' },
                        { label: 'P', count: grades.gradePCount, color: '#14b8a6' },
                        { label: 'NP', count: grades.gradeNPCount, color: '#9ca3af' },
                      ].filter((e) => e.count > 0) : [];
                      const total = allEntries.reduce((s, e) => s + e.count, 0);
                      return (
                        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 10 }}>Grade Distribution</Text>
                          {/* Professor selector */}
                          {professors.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            {['', ...professors].map((p) => {
                              const isSelected = reviewsInstructor === p;
                              return (
                                <TouchableOpacity
                                  key={p || '__all__'}
                                  onPress={() => setReviewsInstructor(p)}
                                  style={{
                                    paddingHorizontal: 12, paddingVertical: 7,
                                    borderRadius: 999,
                                    backgroundColor: isSelected ? '#4169E1' : '#f3f4f6',
                                    borderWidth: 1,
                                    borderColor: isSelected ? '#4169E1' : '#e5e7eb',
                                  }}
                                >
                                  <Text style={{ fontSize: 12, fontWeight: '600', color: isSelected ? 'white' : '#374151' }}>
                                    {p === '' ? 'All Professors' : p.split(',')[0]}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </ScrollView>
                          )}
                          {/* Chart */}
                          {gradeLoading ? (
                            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                              <ActivityIndicator size="small" color="#4169E1" />
                            </View>
                          ) : !grades || allEntries.length === 0 ? (
                            <Text style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 12 }}>
                              No grade data available
                            </Text>
                          ) : (
                            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                              <View style={{ alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f4ff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, minWidth: 72 }}>
                                <Text style={{ fontSize: 26, fontWeight: '800', color: '#4169E1' }}>
                                  {grades.averageGPA != null ? grades.averageGPA.toFixed(2) : '—'}
                                </Text>
                                <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>avg GPA</Text>
                              </View>
                              <View style={{ flex: 1, gap: 5 }}>
                                {allEntries.map((entry) => {
                                  const pct = total > 0 ? entry.count / total : 0;
                                  return (
                                    <View key={entry.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#374151', width: 18, textAlign: 'right' }}>{entry.label}</Text>
                                      <View style={{ flex: 1, height: 10, backgroundColor: '#f3f4f6', borderRadius: 5, overflow: 'hidden' }}>
                                        <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: entry.color, borderRadius: 5 }} />
                                      </View>
                                      <Text style={{ fontSize: 11, color: '#6b7280', width: 34, textAlign: 'right' }}>{(pct * 100).toFixed(0)}%</Text>
                                    </View>
                                  );
                                })}
                                <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                                  Based on {total.toLocaleString()} students · all available terms
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>
                      );
                    })()}

                    {/* ── Student reviews ── */}
                    <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <View style={{ flexDirection: 'row', gap: 2 }}>
                          {[1,2,3,4,5].map(i => (
                            <Ionicons key={i} name={i <= 4 ? 'star' : 'star-half'} size={16} color="#f59e0b" />
                          ))}
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>4.3</Text>
                        <Text style={{ fontSize: 13, color: '#9ca3af' }}>
                          {MOCK_REVIEWS.length + extraReviews.length} reviews
                        </Text>
                      </View>
                    {[...MOCK_REVIEWS, ...extraReviews].map((review) => (
                      <View key={review.id} style={{ backgroundColor: '#f9fafb', borderRadius: 14, padding: 14, marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <Text style={{ fontWeight: '700', fontSize: 14, color: '#111827' }}>{review.author}</Text>
                              <Text style={{ fontSize: 12, color: '#9ca3af' }}>{review.semester}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 2 }}>
                              {[1,2,3,4,5].map(i => (
                                <Ionicons key={i} name={i <= review.rating ? 'star' : 'star-outline'} size={13} color={i <= review.rating ? '#f59e0b' : '#d1d5db'} />
                              ))}
                            </View>
                          </View>
                          <Text style={{ fontSize: 12, color: '#9ca3af' }}>{review.date}</Text>
                        </View>
                        <Text style={{ fontSize: 13, color: '#374151', lineHeight: 19, marginBottom: 8 }}>{review.content}</Text>
                        <View style={{ flexDirection: 'row', gap: 16 }}>
                          <Text style={{ fontSize: 12, color: '#9ca3af' }}>
                            Difficulty: <Text style={{ fontWeight: '700', color: '#6b7280' }}>{review.difficulty}/5</Text>
                          </Text>
                          <Text style={{ fontSize: 12, color: '#9ca3af' }}>
                            Workload: <Text style={{ fontWeight: '700', color: '#6b7280' }}>{review.workload}/5</Text>
                          </Text>
                        </View>
                      </View>
                    ))}
                    </View>
                  </ScrollView>

                  {/* Footer */}
                  <View style={{ paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
                    <TouchableOpacity
                      onPress={() => setShowWriteReview(true)}
                      style={{ backgroundColor: '#4169E1', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
                    >
                      <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Write a Review</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* ── Write review view ── */}
              {showWriteReview && (
                <>
                  {/* Header */}
                  <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <TouchableOpacity onPress={() => setShowWriteReview(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="chevron-back" size={22} color="#6b7280" />
                      </TouchableOpacity>
                      <View>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Write a Review</Text>
                        <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>
                          {reviewsCourse?.department} {reviewsCourse?.courseNumber}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => { setReviewsCourse(null); setShowWriteReview(false); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={22} color="#6b7280" />
                    </TouchableOpacity>
                  </View>

                  <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 20 }} keyboardShouldPersistTaps="handled">
                    {/* Overall Rating */}
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 10 }}>Overall Rating</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                      {[1,2,3,4,5].map(r => (
                        <TouchableOpacity key={r} onPress={() => setNewReviewRating(r)}>
                          <Ionicons name={r <= newReviewRating ? 'star' : 'star-outline'} size={36} color={r <= newReviewRating ? '#f59e0b' : '#d1d5db'} />
                        </TouchableOpacity>
                      ))}
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#374151', marginLeft: 4 }}>{newReviewRating}/5</Text>
                    </View>

                    {/* Difficulty */}
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 10 }}>
                      Difficulty (1 = Easy, 5 = Hard)
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                      {[1,2,3,4,5].map(l => (
                        <TouchableOpacity
                          key={l}
                          onPress={() => setNewReviewDifficulty(l)}
                          style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: newReviewDifficulty === l ? '#4169E1' : '#f3f4f6' }}
                        >
                          <Text style={{ fontWeight: '700', color: newReviewDifficulty === l ? 'white' : '#374151' }}>{l}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Workload */}
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 10 }}>
                      Workload (1 = Light, 5 = Heavy)
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                      {[1,2,3,4,5].map(l => (
                        <TouchableOpacity
                          key={l}
                          onPress={() => setNewReviewWorkload(l)}
                          style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: newReviewWorkload === l ? '#4169E1' : '#f3f4f6' }}
                        >
                          <Text style={{ fontWeight: '700', color: newReviewWorkload === l ? 'white' : '#374151' }}>{l}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Review text */}
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 10 }}>Your Review</Text>
                    <TextInput
                      value={newReviewContent}
                      onChangeText={setNewReviewContent}
                      placeholder="Share your experience with this course..."
                      placeholderTextColor="#9ca3af"
                      multiline
                      textAlignVertical="top"
                      style={{
                        backgroundColor: '#f9fafb', borderRadius: 14,
                        borderWidth: 1, borderColor: '#e5e7eb',
                        paddingHorizontal: 14, paddingVertical: 12,
                        fontSize: 14, color: '#111827', minHeight: 120,
                        marginBottom: 20,
                      }}
                    />

                    {/* Submit */}
                    <TouchableOpacity
                      onPress={() => {
                        if (!newReviewContent.trim()) return;
                        setExtraReviews(prev => [...prev, {
                          id: `user-${Date.now()}`,
                          author: 'You',
                          rating: newReviewRating,
                          date: new Date().toISOString().slice(0, 10),
                          content: newReviewContent.trim(),
                          semester: 'Spring 2026',
                          difficulty: newReviewDifficulty,
                          workload: newReviewWorkload,
                        }]);
                        setNewReviewRating(5);
                        setNewReviewDifficulty(3);
                        setNewReviewWorkload(3);
                        setNewReviewContent('');
                        setShowWriteReview(false);
                      }}
                      disabled={!newReviewContent.trim()}
                      style={{
                        backgroundColor: newReviewContent.trim() ? '#4169E1' : '#d1d5db',
                        borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 8,
                      }}
                    >
                      <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Submit Review</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </>
              )}

            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

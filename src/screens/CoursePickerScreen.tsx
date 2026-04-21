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
import { Ionicons } from '@expo/vector-icons';
import { Course, Quarter, TimetableSettings, DEFAULT_TIMETABLE_SETTINGS, UCI_DEPARTMENTS, quarterLabel, quarterKey } from '../data/courses';
import PreviewTimetable from '../components/PreviewTimetable';
import { supabase } from '../lib/supabase';
import * as Linking from 'expo-linking';
import ReviewsModal from '../components/ReviewsModal';

const RMP_SCHOOL_IDS: Record<string, string> = { 'UC Irvine': '1074' };

function rmpUrl(professor: string, school: string) {
  const sid = RMP_SCHOOL_IDS[school];
  const base = `https://www.ratemyprofessors.com/search/professors?q=${encodeURIComponent(professor)}`;
  return sid ? `${base}&sid=${sid}` : base;
}

type Props = {
  activeCourses: Course[];
  onToggleCourse: (course: Course) => void;
  onFocusCourse: (courseId: string | null) => void;
  onClose: () => void;
  selectedQuarter: Quarter;
  timetableSettings?: TimetableSettings;
  userId: string;
  school: string;
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
  userId,
  school,
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

  // Global search state (cross-department, triggers when no dept selected + text >= 2)
  const [globalCatalog, setGlobalCatalog] = useState<CatalogCourse[]>([]);
  const [globalSectionsMap, setGlobalSectionsMap] = useState<Record<string, Course[]>>({});
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);

  function buildCatalogFromRows(rows: any[]): { catalog: CatalogCourse[]; sections: Record<string, Course[]> } {
    const catalogMap: Record<string, CatalogCourse> = {};
    const rawSections: Record<string, any[]> = {};

    rows.forEach((row: any) => {
      const courseNumber = row.code.slice(row.department.length).trim();
      const courseId = `${row.department}${courseNumber}`;
      if (!catalogMap[courseId]) {
        catalogMap[courseId] = { id: courseId, department: row.department, courseNumber, title: row.title, units: row.units?.toString() };
        rawSections[courseId] = [];
      } else {
        const existing = parseInt(catalogMap[courseId].units ?? '0') || 0;
        const incoming = row.units ?? 0;
        if (incoming > existing) catalogMap[courseId].units = incoming.toString();
      }
      rawSections[courseId].push(row);
    });

    const sections: Record<string, Course[]> = {};
    Object.entries(rawSections).forEach(([courseId, sectionRows]) => {
      const sorted = sectionRows.slice().sort((a, b) => {
        const typeOrder = (t: string) => ({ Lec: 0, Dis: 1, Lab: 2 }[t] ?? 3);
        const aType = a.section_label?.split(' ')[0] ?? '';
        const bType = b.section_label?.split(' ')[0] ?? '';
        if (typeOrder(aType) !== typeOrder(bType)) return typeOrder(aType) - typeOrder(bType);
        return (a.section_label ?? '').localeCompare(b.section_label ?? '', undefined, { numeric: true });
      });
      sections[courseId] = sorted.map((row: any): Course => ({
        id: row.id.split('::')[0],
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

    return { catalog: Object.values(catalogMap), sections };
  }

  // Global search: fires when search text >= 2 and no dept selected
  useEffect(() => {
    if (selectedDept || searchText.trim().length < 2) {
      setGlobalCatalog([]);
      setGlobalSectionsMap({});
      return;
    }

    const q = searchText.trim();
    // Normalize "eecs125" → "eecs 125" so it matches DB codes stored with a space
    const qNorm = q.replace(/^([a-zA-Z]+)\s*(\d+.*)$/i, '$1 $2').trim();
    setGlobalSearchLoading(true);

    const timer = setTimeout(async () => {
      const qk = quarterKey(selectedQuarter);
      const baseClauses = `code.ilike.%${q}%,title.ilike.%${q}%,professor.ilike.%${q}%`;
      const orClause = qNorm !== q
        ? `${baseClauses},code.ilike.%${qNorm}%`
        : baseClauses;
      const { data, error } = await supabase
        .from('sections')
        .select('*')
        .eq('quarter_key', qk)
        .or(orClause)
        .order('code', { ascending: true })
        .limit(500);

      if (!error && data) {
        const { catalog, sections } = buildCatalogFromRows(data);
        setGlobalCatalog(catalog);
        setGlobalSectionsMap(sections);
      }
      setGlobalSearchLoading(false);
    }, 400);

    return () => { clearTimeout(timer); setGlobalSearchLoading(false); };
  }, [searchText, selectedDept, selectedQuarter]);

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

        const { catalog, sections } = buildCatalogFromRows(data ?? []);
        setCatalogCourses(catalog);
        setSectionsMap(sections);
      })
      .finally(() => setCatalogLoading(false));
  }, [selectedDept, selectedQuarter]);

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

  const isGlobalSearch = !selectedDept && searchText.trim().length >= 2;

  const filteredCatalog = useMemo(() => {
    const stripH = (s: string) => s.replace(/^H/i, '');
    const sortCatalog = (list: CatalogCourse[]) =>
      [...list].sort((a, b) => {
        // In global search, sort by department first, then course number
        if (isGlobalSearch && a.department !== b.department)
          return a.department.localeCompare(b.department);
        const numA = parseInt(stripH(a.courseNumber)) || 0;
        const numB = parseInt(stripH(b.courseNumber)) || 0;
        if (numA !== numB) return numA - numB;
        const suffixA = stripH(a.courseNumber).replace(/^\d+/, '');
        const suffixB = stripH(b.courseNumber).replace(/^\d+/, '');
        return suffixA.localeCompare(suffixB);
      });

    if (isGlobalSearch) return sortCatalog(globalCatalog);

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
          return (sectionsMap[c.id] ?? []).some((s) =>
            s.professor.toLowerCase().includes(q)
          );
        });

    return sortCatalog(list);
  }, [catalogCourses, searchText, sectionsMap, isGlobalSearch, globalCatalog]);

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
          <Modal visible={deptDropdownOpen} animationType="slide" transparent onRequestClose={() => setDeptDropdownOpen(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' }}>
              <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setDeptDropdownOpen(false)} />
              <View style={{ backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, maxHeight: '70%' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
                  <Text style={{ flex: 1, fontSize: 17, fontWeight: '700' }}>Select Department</Text>
                  <TouchableOpacity onPress={() => { setDeptDropdownOpen(false); setSelectedDept(''); }}>
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
        {!selectedDept && !isGlobalSearch ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 }}>
            <Ionicons name="search-outline" size={32} color="#d1d5db" style={{ marginBottom: 10 }} />
            <Text style={{ color: '#9ca3af', fontSize: 15, textAlign: 'center', paddingHorizontal: 24 }}>
              Search by course name, code, or professor — or select a department below
            </Text>
          </View>
        ) : (catalogLoading && selectedDept) || (globalSearchLoading && isGlobalSearch) ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 }}>
            <ActivityIndicator size="large" color="#4169E1" />
            <Text style={{ color: '#9ca3af', marginTop: 12 }}>
              {isGlobalSearch ? `Searching "${searchText.trim()}"…` : `Loading ${selectedDept} courses for ${quarterLabel(selectedQuarter)}…`}
            </Text>
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
              const activeSectionsMap = isGlobalSearch ? globalSectionsMap : sectionsMap;
              const sections = activeSectionsMap[item.id] ?? [];

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
                                  {['Lec', 'Lab', 'Sem'].some(t => course.sectionLabel?.startsWith(t)) && (
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
                                  {(() => {
                                    const prof = course.professor;
                                    if (!prof || prof === 'STAFF' || prof.trim() === '') return null;
                                    const profRmpUrl = rmpUrl(prof, school);
                                    return (
                                      <TouchableOpacity
                                        onPress={(e) => { e.stopPropagation(); Linking.openURL(profRmpUrl); }}
                                        style={{ backgroundColor: '#f0f4ff', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: '#c7d4f9', alignSelf: 'flex-end' }}
                                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                                      >
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#4169E1' }}>RMP</Text>
                                      </TouchableOpacity>
                                    );
                                  })()}
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

      {reviewsCourse && (
        <ReviewsModal
          visible={!!reviewsCourse}
          onClose={() => setReviewsCourse(null)}
          courseCode={`${reviewsCourse.department} ${reviewsCourse.courseNumber}`}
          department={reviewsCourse.department}
          courseNumber={reviewsCourse.courseNumber}
          title={reviewsCourse.title}
          professors={[...new Set(
            ((isGlobalSearch ? globalSectionsMap : sectionsMap)[reviewsCourse.id] ?? [])
              .map((s) => s.professor)
              .filter((p): p is string => !!p && !p.includes('STAFF'))
          )]}
          school={school}
          userId={userId}
          semesterLabel={quarterLabel(selectedQuarter)}
        />
      )}
    </View>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View, Text, TouchableOpacity, Dimensions, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Course, Quarter, Timetable, TimetableTheme, TimetableSettings, QUARTERS, quarterKey, quarterLabel, getBlockColors } from '../data/courses';
import { supabase } from '../lib/supabase';

type Props = {
  activeCourses: Course[];
  selectedQuarter: Quarter;
  focusedCourseId: string | null;
  onFocusCourse: (courseId: string) => void;
  onChangeQuarter: (q: Quarter) => void;
  onOpenCoursePicker: () => void;
  quarterTimetables: Timetable[];
  activeTimetableId: string | null;
  onSelectTimetable: (id: string) => void;
  timetables: Timetable[];
  onCreateTimetable: () => void;
  onDeleteTimetable: () => void;
  onAddQuarter: (q: Quarter) => void;
  settings: TimetableSettings;
  onSettingsApply: (s: TimetableSettings) => void;
};

const DEFAULT_DAYS = ['M', 'T', 'W', 'Th', 'F'];
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 17;

const TIME_LABEL_WIDTH = 44;
const GRID_LEFT_PAD = 16;

const DAY_LABEL: Record<string, string> = {
  M: 'Mon', T: 'Tue', W: 'Wed', Th: 'Thu', F: 'Fri', Sa: 'Sat', Su: 'Sun',
};


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
  return `${hour}:00`;
}

function getProfLastName(professor: string) {
  const last = professor.split(',')[0].trim();
  if (!last) return professor;
  return last.charAt(0).toUpperCase() + last.slice(1).toLowerCase();
}

export default function TimetableScreen({
  activeCourses,
  selectedQuarter,
  focusedCourseId,
  onFocusCourse,
  onChangeQuarter,
  onOpenCoursePicker,
  quarterTimetables,
  activeTimetableId,
  onSelectTimetable,
  timetables,
  onCreateTimetable,
  onDeleteTimetable,
  onAddQuarter,
  settings,
  onSettingsApply,
}: Props) {
  const [gridWidth, setGridWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [scrollAreaHeight, setScrollAreaHeight] = useState(0);
  const [showQuarterDropdown, setShowQuarterDropdown] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showAddQuarterModal, setShowAddQuarterModal] = useState(false);
  const [addableQuarters, setAddableQuarters] = useState<Quarter[]>([]);
  const [loadingAddableQuarters, setLoadingAddableQuarters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Pending settings (in the modal, before Apply is tapped)
  const [pendingTheme, setPendingTheme] = useState<TimetableTheme>('default');
  const [pendingShowCode, setPendingShowCode] = useState(true);
  const [pendingShowClassName, setPendingShowClassName] = useState(true);
  const [pendingShowRoomNumber, setPendingShowRoomNumber] = useState(true);
  const [pendingShowInstructor, setPendingShowInstructor] = useState(true);
  const [pendingShowTime, setPendingShowTime] = useState(true);

  // Destructure applied settings from props
  const { theme, showCode, showClassName, showRoomNumber, showInstructor, showTime } = settings;

  const horizontalScrollRef = useRef<ScrollView>(null);
  const verticalScrollRef = useRef<ScrollView>(null);
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  const scheduledCourses = useMemo(
    () => activeCourses.filter((course) => course.time !== 'TBA' && course.days !== 'TBA'),
    [activeCourses]
  );

  const tbaCourses = useMemo(
    () => activeCourses.filter((course) => course.time === 'TBA' || course.days === 'TBA'),
    [activeCourses]
  );

  const visibleDays = useMemo(() => {
    const usedDays = new Set<string>();
    scheduledCourses.forEach((course) => getDaysArray(course.days).forEach((d) => usedDays.add(d)));
    const days = [...DEFAULT_DAYS];
    if (usedDays.has('Sa')) days.push('Sa');
    if (usedDays.has('Su')) days.push('Su');
    return days;
  }, [scheduledCourses]);

  const { displayStartHour, displayEndHour } = useMemo(() => {
    if (scheduledCourses.length === 0) {
      return { displayStartHour: DEFAULT_START_HOUR, displayEndHour: DEFAULT_END_HOUR };
    }
    const earliest = Math.min(...scheduledCourses.map((c) => getCourseStartHour(c.time)));
    const latest = Math.max(...scheduledCourses.map((c) => getCourseEndHour(c.time)));
    return {
      displayStartHour: Math.min(DEFAULT_START_HOUR, Math.floor(earliest)),
      displayEndHour: Math.max(DEFAULT_END_HOUR, Math.ceil(latest)),
    };
  }, [scheduledCourses]);

  const totalHours = displayEndHour - displayStartHour;
  const HOUR_HEIGHT = 72; // fixed px per hour — always taller than viewport → enables scrolling
  const timetableHeight = totalHours * HOUR_HEIGHT + HOUR_HEIGHT; // extra row so last label isn't clipped
  const hourHeight = HOUR_HEIGHT;
  const hourLabels = Array.from({ length: totalHours + 1 }, (_, i) => displayStartHour + i);

  const usableGridWidth =
    gridWidth > 0
      ? gridWidth - TIME_LABEL_WIDTH
      : screenWidth - GRID_LEFT_PAD - TIME_LABEL_WIDTH;

  const dayColumnWidth = usableGridWidth / visibleDays.length;

  useEffect(() => {
    if (!focusedCourseId || viewportWidth === 0 || viewportHeight === 0) return;

    const focusedCourse = scheduledCourses.find((course) => course.id === focusedCourseId);
    if (!focusedCourse) return;

    const courseDays = getDaysArray(focusedCourse.days);
    const dayIndex = visibleDays.indexOf(courseDays[0]);
    if (dayIndex === -1) return;

    const startHour = getCourseStartHour(focusedCourse.time);
    const endHour = getCourseEndHour(focusedCourse.time);
    const top = (startHour - displayStartHour) * hourHeight;
    const height = Math.max((endHour - startHour) * hourHeight, 48);
    const left = dayIndex * dayColumnWidth;

    const horizontalTarget = Math.max(left + dayColumnWidth / 2 - viewportWidth / 2, 0);
    const verticalTarget = Math.max(top + height / 2 - viewportHeight / 2, 0);

    requestAnimationFrame(() => {
      horizontalScrollRef.current?.scrollTo({ x: horizontalTarget, animated: true });
      verticalScrollRef.current?.scrollTo({ y: verticalTarget, animated: true });
    });
  }, [
    dayColumnWidth,
    displayStartHour,
    focusedCourseId,
    hourHeight,
    scheduledCourses,
    viewportHeight,
    viewportWidth,
    visibleDays,
  ]);

  async function openAddQuarterModal() {
    setLoadingAddableQuarters(true);
    setShowAddQuarterModal(true);

    const existingQks = new Set(timetables.map((t) => t.quarterKey));

    // Build the full candidate list matching the seeder range (2020–2026)
    const allCandidates: Quarter[] = [];
    for (let year = 2020; year <= 2026; year++) {
      allCandidates.push(
        { year: String(year), quarter: 'Winter' },
        { year: String(year), quarter: 'Spring' },
        { year: String(year), quarter: 'Fall' },
      );
    }

    // Filter out quarters the user already has, then check Supabase in parallel
    const unclaimed = allCandidates.filter((q) => !existingQks.has(quarterKey(q)));

    const results = await Promise.all(
      unclaimed.map(async (q) => {
        const { count } = await supabase
          .from('sections')
          .select('*', { count: 'exact', head: true })
          .eq('quarter_key', quarterKey(q));
        return (count ?? 0) > 0 ? q : null;
      })
    );

    // Show most recent first
    setAddableQuarters(results.filter((q): q is Quarter => q !== null).reverse());
    setLoadingAddableQuarters(false);
  }

  function openSettings() {
    // Sync pending state from currently applied settings
    setPendingTheme(settings.theme);
    setPendingShowCode(settings.showCode);
    setPendingShowClassName(settings.showClassName);
    setPendingShowRoomNumber(settings.showRoomNumber);
    setPendingShowInstructor(settings.showInstructor);
    setPendingShowTime(settings.showTime);
    setShowSettings(true);
  }

  function applySettings() {
    onSettingsApply({
      theme: pendingTheme,
      showCode: pendingShowCode,
      showClassName: pendingShowClassName,
      showRoomNumber: pendingShowRoomNumber,
      showInstructor: pendingShowInstructor,
      showTime: pendingShowTime,
    });
    setShowSettings(false);
  }

  function confirmDelete() {
    Alert.alert(
      'Delete Timetable',
      'Are you sure you want to delete the current timetable? All data regarding this timetable will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setShowSettings(false);
            onDeleteTimetable();
          },
        },
      ]
    );
  }

  const THEMES: { key: Theme; label: string }[] = [
    { key: 'default', label: 'Default' },
    { key: 'minimal', label: 'Minimal' },
    { key: 'colorful', label: 'Colorful' },
    { key: 'dark', label: 'Dark' },
  ];

  const DISPLAY_OPTIONS: { key: string; label: string }[] = [
    { key: 'code',       label: 'Code' },
    { key: 'className',  label: 'Class Name' },
    { key: 'roomNumber', label: 'Room Number' },
    { key: 'instructor', label: 'Instructor' },
    { key: 'time',       label: 'Time' },
  ];

  const pendingDisplayMap: Record<string, boolean> = {
    code:       pendingShowCode,
    className:  pendingShowClassName,
    roomNumber: pendingShowRoomNumber,
    instructor: pendingShowInstructor,
    time:       pendingShowTime,
  };

  function toggleDisplay(key: string) {
    if (key === 'code')       setPendingShowCode((v) => !v);
    else if (key === 'className')  setPendingShowClassName((v) => !v);
    else if (key === 'roomNumber') setPendingShowRoomNumber((v) => !v);
    else if (key === 'instructor') setPendingShowInstructor((v) => !v);
    else if (key === 'time')       setPendingShowTime((v) => !v);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme === 'dark' ? '#0f172a' : '#fff' }}>

      {/* Quarter dropdown modal */}
      <Modal transparent animationType="fade" visible={showQuarterDropdown} onRequestClose={() => setShowQuarterDropdown(false)}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowQuarterDropdown(false)}>
          <View
            style={{
              position: 'absolute',
              top: 96,
              right: 52,
              backgroundColor: 'white',
              borderRadius: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 8,
              minWidth: 160,
              overflow: 'hidden',
            }}
          >
            {Array.from(new Set(timetables.map((t) => t.quarterKey)))
              .sort((a, b) => {
                const QORDER: Record<string, number> = { Winter: 0, Spring: 1, Fall: 2 };
                const [aYear, aQ] = a.split('-');
                const [bYear, bQ] = b.split('-');
                if (bYear !== aYear) return Number(bYear) - Number(aYear);
                return QORDER[bQ] - QORDER[aQ];
              })
              .map((qk, index) => {
                const [year, quarter] = qk.split('-');
                const q: Quarter = { year, quarter };
                return { q, qk, index };
              })
              .map(({ q, qk, index }) => {
              const isActive = qk === quarterKey(selectedQuarter);
              return (
                <TouchableOpacity
                  key={qk}
                  onPress={() => { onChangeQuarter(q); setShowQuarterDropdown(false); }}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor: isActive ? '#eef1fb' : 'white',
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: '#f3f4f6',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text style={{ color: isActive ? '#4169E1' : '#374151', fontWeight: isActive ? '700' : '400', fontSize: 14 }}>
                    {quarterLabel(q)}
                  </Text>
                  {isActive && <Ionicons name="checkmark" size={16} color="#4169E1" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add menu modal (+ Add button) */}
      <Modal transparent animationType="fade" visible={showAddMenu} onRequestClose={() => setShowAddMenu(false)}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowAddMenu(false)}>
          <View
            style={{
              position: 'absolute',
              top: 96,
              right: 16,
              backgroundColor: 'white',
              borderRadius: 14,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 16,
              elevation: 10,
              minWidth: 180,
              overflow: 'hidden',
            }}
          >
            <TouchableOpacity
              onPress={() => { setShowAddMenu(false); onOpenCoursePicker(); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 15 }}
            >
              <Ionicons name="add" size={19} color="#374151" />
              <Text style={{ fontSize: 15, color: '#111827', fontWeight: '500' }}>Add Course</Text>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: '#f3f4f6' }} />
            <TouchableOpacity
              onPress={() => { setShowAddMenu(false); onCreateTimetable(); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 15 }}
            >
              <Ionicons name="calendar-outline" size={19} color="#374151" />
              <Text style={{ fontSize: 15, color: '#111827', fontWeight: '500' }}>Add Timetable</Text>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: '#f3f4f6' }} />
            <TouchableOpacity
              onPress={() => { setShowAddMenu(false); openAddQuarterModal(); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 15 }}
            >
              <Ionicons name="earth-outline" size={19} color="#374151" />
              <Text style={{ fontSize: 15, color: '#111827', fontWeight: '500' }}>Add Quarter</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Quarter modal */}
      <Modal transparent animationType="fade" visible={showAddQuarterModal} onRequestClose={() => setShowAddQuarterModal(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setShowAddQuarterModal(false)}>
          <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
            <View style={{ backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>Select Quarter</Text>
                <TouchableOpacity onPress={() => setShowAddQuarterModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={24} color="#374151" />
                </TouchableOpacity>
              </View>
              {loadingAddableQuarters ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <Text style={{ color: '#9ca3af', fontSize: 14 }}>Loading quarters…</Text>
                </View>
              ) : addableQuarters.length === 0 ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <Text style={{ color: '#9ca3af', fontSize: 14 }}>No new quarters available</Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
                  {addableQuarters.map((q, index) => (
                    <TouchableOpacity
                      key={quarterKey(q)}
                      onPress={() => { setShowAddQuarterModal(false); onAddQuarter(q); }}
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        paddingHorizontal: 24, paddingVertical: 16,
                        borderTopWidth: index === 0 ? 0 : 1, borderTopColor: '#f3f4f6',
                      }}
                    >
                      <Text style={{ fontSize: 16, color: '#111827' }}>{quarterLabel(q)}</Text>
                      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Settings bottom sheet */}
      <Modal transparent animationType="slide" visible={showSettings} onRequestClose={() => setShowSettings(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View
            style={{
              backgroundColor: 'white',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingBottom: 40,
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 24,
                paddingTop: 24,
                paddingBottom: 16,
                borderBottomWidth: 1,
                borderBottomColor: '#f0f0f0',
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>Timetable Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Timetable Theme */}
              <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#6b7280', marginBottom: 12 }}>
                  Timetable Theme
                </Text>
                {THEMES.map((t, index) => {
                  const isSelected = pendingTheme === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      onPress={() => setPendingTheme(t.key)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 14,
                        paddingVertical: 14,
                        borderTopWidth: index === 0 ? 0 : 1,
                        borderTopColor: '#f3f4f6',
                      }}
                    >
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          borderWidth: 2,
                          borderColor: isSelected ? '#4169E1' : '#374151',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isSelected && (
                          <View
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 6,
                              backgroundColor: '#4169E1',
                            }}
                          />
                        )}
                      </View>
                      <Text style={{ fontSize: 15, color: '#111827', fontWeight: '500' }}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Display Information */}
              <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#6b7280', marginBottom: 12 }}>
                  Display Information
                </Text>
                {DISPLAY_OPTIONS.map((opt, index) => {
                  const isChecked = pendingDisplayMap[opt.key];
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      onPress={() => toggleDisplay(opt.key)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 14,
                        paddingVertical: 14,
                        borderTopWidth: index === 0 ? 0 : 1,
                        borderTopColor: '#f3f4f6',
                      }}
                    >
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          backgroundColor: isChecked ? '#4169E1' : 'white',
                          borderWidth: 2,
                          borderColor: isChecked ? '#4169E1' : '#9ca3af',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isChecked && <Ionicons name="checkmark" size={14} color="white" />}
                      </View>
                      <Text style={{ fontSize: 15, color: '#111827', fontWeight: '500' }}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: '#f0f0f0', marginTop: 8 }} />

              {/* Apply Settings */}
              <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
                <TouchableOpacity
                  onPress={applySettings}
                  style={{
                    backgroundColor: '#4169E1',
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>Apply Settings</Text>
                </TouchableOpacity>
              </View>

              {/* Delete Current Timetable */}
              <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
                <TouchableOpacity
                  onPress={confirmDelete}
                  style={{
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: 'center',
                    borderWidth: 1.5,
                    borderColor: '#fca5a5',
                    backgroundColor: '#fff5f5',
                  }}
                >
                  <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>
                    Delete Current Timetable
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        {/* Row 1: Title + Quarter picker + three-dots */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: theme === 'dark' ? '#f1f5f9' : '#111827' }}>
            Timetable
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <TouchableOpacity
              onPress={() => setShowQuarterDropdown(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: theme === 'dark' ? '#334155' : '#e5e7eb',
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 7,
                backgroundColor: theme === 'dark' ? '#1e293b' : 'white',
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme === 'dark' ? '#e2e8f0' : '#374151' }}>
                {quarterLabel(selectedQuarter)}
              </Text>
              <Ionicons name="chevron-down" size={14} color={theme === 'dark' ? '#94a3b8' : '#6b7280'} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openSettings}
              style={{
                padding: 6,
                borderRadius: 8,
                backgroundColor: theme === 'dark' ? '#1e293b' : 'transparent',
              }}
            >
              <Ionicons name="ellipsis-vertical" size={20} color={theme === 'dark' ? '#94a3b8' : '#374151'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Row 2: Plan tabs + + Add */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}
          >
            {quarterTimetables.map((t) => {
              const isActive = t.id === activeTimetableId;
              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => onSelectTimetable(t.id)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 7,
                    borderRadius: 20,
                    backgroundColor: isActive ? '#4169E1' : (theme === 'dark' ? '#1e293b' : 'white'),
                    borderWidth: 1.5,
                    borderColor: isActive ? '#4169E1' : (theme === 'dark' ? '#334155' : '#d1d5db'),
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isActive ? 'white' : (theme === 'dark' ? '#94a3b8' : '#374151') }}>
                    {t.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity onPress={() => setShowAddMenu(true)} style={{ paddingVertical: 7 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#4169E1' }}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* TBA / Online courses — above the grid */}
      {tbaCourses.length > 0 && (
        <View style={{
          paddingHorizontal: 16, paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: theme === 'dark' ? '#1e293b' : '#ececec',
          backgroundColor: theme === 'dark' ? '#0f172a' : '#fff',
        }}>
<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {tbaCourses.map((course) => {
              const { bg, text, border } = getBlockColors(course, theme);
              return (
                <TouchableOpacity
                  key={course.id}
                  activeOpacity={0.85}
                  onPress={() => onFocusCourse(course.id)}
                  style={{
                    backgroundColor: bg, borderRadius: 8,
                    borderWidth: 1, borderColor: border,
                    paddingHorizontal: 10, paddingVertical: 8,
                    minWidth: 100, maxWidth: 160,
                  }}
                >
                  {showCode && (
                    <Text style={{ color: text, fontWeight: '800', fontSize: 10, lineHeight: 13 }} numberOfLines={1}>
                      {course.code}
                    </Text>
                  )}
                  {showClassName && (
                    <Text style={{ color: text, fontWeight: '600', fontSize: 9, lineHeight: 12, opacity: 0.85 }} numberOfLines={2}>
                      {course.title}
                    </Text>
                  )}
                  {showInstructor && (
                    <Text style={{ color: text, fontSize: 9, opacity: 0.7, marginTop: 2 }} numberOfLines={1}>
                      {getProfLastName(course.professor)}
                    </Text>
                  )}
                  <Text style={{ color: text, fontSize: 8, opacity: 0.55, marginTop: 2, fontWeight: '600' }}>
                    {course.location?.toLowerCase().includes('online') || course.location?.toLowerCase().includes('remote') ? 'Online' : 'TBA'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Grid container */}
      <View
        style={{ flex: 1 }}
        onLayout={(e) => setGridWidth(e.nativeEvent.layout.width - GRID_LEFT_PAD)}
      >
        {/* Day headers row */}
        <View
          style={{
            flexDirection: 'row',
            borderTopWidth: 1,
            borderTopColor: theme === 'dark' ? '#1e293b' : '#ececec',
            borderBottomWidth: 1,
            borderBottomColor: theme === 'dark' ? '#1e293b' : '#ececec',
            paddingLeft: GRID_LEFT_PAD,
            backgroundColor: theme === 'dark' ? '#0f172a' : '#fff',
          }}
        >
          <View style={{ width: TIME_LABEL_WIDTH }} />
          {visibleDays.map((day) => (
            <View key={day} style={{ width: dayColumnWidth, alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: theme === 'dark' ? '#64748b' : '#4b5563' }}>
                {DAY_LABEL[day]}
              </Text>
            </View>
          ))}
        </View>

        {/* Scroll area wrapper — measures the true available height for the viewport */}
        <View
          style={{ flex: 1 }}
          onLayout={(e) => setScrollAreaHeight(e.nativeEvent.layout.height)}
        >
        {/* Scrollable grid */}
        <ScrollView
          ref={horizontalScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          bounces={false}
          style={scrollAreaHeight > 0 ? { height: scrollAreaHeight } : { flex: 1 }}
          onLayout={(e) => setViewportWidth(e.nativeEvent.layout.width - TIME_LABEL_WIDTH - GRID_LEFT_PAD)}
        >
          <ScrollView
            ref={verticalScrollRef}
            style={scrollAreaHeight > 0 ? { height: scrollAreaHeight } : { flex: 1 }}
            showsVerticalScrollIndicator={false}
            bounces={false}
            onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
          >
            {/* paddingTop gives room so the 8:00 label isn't clipped at the scroll boundary */}
            <View style={{ paddingTop: 8 }}>
            <View
              style={{
                flexDirection: 'row',
                paddingLeft: GRID_LEFT_PAD,
              }}
            >
              {/* Time labels */}
              <View style={{ width: TIME_LABEL_WIDTH, height: timetableHeight }}>
                {hourLabels.map((hour, index) => (
                  <View key={hour} style={{ position: 'absolute', top: index * hourHeight - 6, left: 0 }}>
                    <Text style={{ fontSize: 11, color: theme === 'dark' ? '#475569' : '#9ca3af' }}>
                      {formatHourLabel(hour)}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Day columns + course blocks */}
              <View
                style={{
                  width: dayColumnWidth * visibleDays.length,
                  height: timetableHeight,
                  position: 'relative',
                }}
              >
                {/* Hour lines */}
                {hourLabels.map((hour, index) => (
                  <View
                    key={hour}
                    style={{
                      position: 'absolute',
                      top: index * hourHeight,
                      left: 0,
                      right: 0,
                      height: 1,
                      backgroundColor: theme === 'dark' ? '#1e293b' : '#ececec',
                    }}
                  />
                ))}

                {/* Day column separators */}
                <View style={{ flexDirection: 'row', height: timetableHeight }}>
                  {visibleDays.map((day, index) => (
                    <View
                      key={day}
                      style={{
                        width: dayColumnWidth,
                        borderRightWidth: index === visibleDays.length - 1 ? 0 : 1,
                        borderRightColor: theme === 'dark' ? '#1e293b' : '#ececec',
                      }}
                    />
                  ))}
                </View>

                {/* Course blocks */}
                {scheduledCourses.flatMap((course) => {
                  const courseDays = getDaysArray(course.days);
                  const startHour = getCourseStartHour(course.time);
                  const endHour = getCourseEndHour(course.time);
                  const top = (startHour - displayStartHour) * hourHeight;
                  const height = (endHour - startHour) * hourHeight;
                  const { bg, text, border } = getBlockColors(course, theme);

                  return courseDays.map((day) => {
                    const dayIndex = visibleDays.indexOf(day);
                    if (dayIndex === -1) return null;
                    return (
                      <TouchableOpacity
                        key={`${course.id}-${day}`}
                        activeOpacity={0.85}
                        onPress={() => onFocusCourse(course.id)}
                        style={{
                          position: 'absolute',
                          top: top + 2,
                          left: dayIndex * dayColumnWidth + 2,
                          width: dayColumnWidth - 4,
                          height: height - 4,
                          backgroundColor: bg,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: border,
                          paddingLeft: 6,
                          paddingRight: 4,
                          paddingTop: 5,
                          paddingBottom: 4,
                          overflow: 'hidden',
                        }}
                      >
                        {showCode && (
                          <Text
                            style={{ color: text, fontWeight: '800', fontSize: 10, lineHeight: 13 }}
                            numberOfLines={1}
                          >
                            {course.code}
                          </Text>
                        )}
                        {showClassName && (
                          <Text
                            style={{ color: text, fontWeight: '600', fontSize: 9, lineHeight: 12, opacity: 0.85 }}
                            numberOfLines={2}
                          >
                            {course.title}
                          </Text>
                        )}
                        {showRoomNumber && course.location ? (
                          <Text
                            style={{ color: text, fontSize: 9, opacity: 0.75, marginTop: 2 }}
                            numberOfLines={1}
                          >
                            {course.location}
                          </Text>
                        ) : null}
                        {showInstructor && (
                          <Text
                            style={{ color: text, fontSize: 9, opacity: 0.7, marginTop: 1 }}
                            numberOfLines={1}
                          >
                            {getProfLastName(course.professor)}
                          </Text>
                        )}
                        {showTime && (
                          <Text
                            style={{ color: text, fontSize: 8, opacity: 0.6, marginTop: 1 }}
                            numberOfLines={1}
                          >
                            {course.time}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  });
                })}
              </View>
            </View>

</View>
          </ScrollView>
        </ScrollView>
        </View>
      </View>
    </View>
  );
}

import { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal,
  Animated, Easing, Dimensions, LayoutAnimation,
  Platform, UIManager,
} from 'react-native';
import Svg, { Path, Circle, Line, Defs, ClipPath, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Course, Quarter, Timetable, quarterKey, quarterLabel } from '../data/courses';
import { supabase } from '../lib/supabase';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = { timetables: Timetable[]; userId: string };

// The actual current quarter — never changes based on app navigation
const CURRENT_QUARTER: Quarter = { year: '2026', quarter: 'Spring' };
const CURRENT_QK = quarterKey(CURRENT_QUARTER);

// ── constants ─────────────────────────────────────────────────────────────────

const GRADE_OPTIONS = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F', 'P', 'NP'];

const GRADE_POINTS: Record<string, number> = {
  'A+': 4.0, 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7,
  'C+': 2.3, 'C': 2.0, 'C-': 1.7, 'D': 1.0, 'F': 0.0,
  // P and NP do not affect GPA — omitted intentionally
};


// ── GPA chart ─────────────────────────────────────────────────────────────────

// Monotone cubic interpolation — smooth curve that never overshoots data points.
// Based on the Fritsch-Carlson method.
function buildMonotonePath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n < 2) return '';

  // Step 1: compute slopes between consecutive points
  const dx: number[] = [], dy: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    dy[i] = pts[i + 1].y - pts[i].y;
    m[i]  = dy[i] / dx[i];
  }

  // Step 2: initialize tangents
  const t: number[] = new Array(n);
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) {
      t[i] = 0; // flat at direction change — prevents overshoot
    } else {
      t[i] = (m[i - 1] + m[i]) / 2;
    }
  }

  // Step 3: Fritsch-Carlson monotonicity constraint
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i];
    const h = Math.sqrt(a * a + b * b);
    if (h > 3) { t[i] = (3 / h) * a * m[i]; t[i + 1] = (3 / h) * b * m[i]; }
  }

  // Step 4: build SVG cubic bezier path
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const cp1x = pts[i].x     + dx[i] / 3;
    const cp1y = pts[i].y     + t[i]  * dx[i] / 3;
    const cp2x = pts[i + 1].x - dx[i] / 3;
    const cp2y = pts[i + 1].y - t[i + 1] * dx[i] / 3;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${pts[i + 1].x} ${pts[i + 1].y}`;
  }
  return d;
}

function GpaChart({ history }: { history: { label: string; gpa: number }[] }) {
  const screenWidth = Dimensions.get('window').width;
  const chartWidth  = screenWidth - 64 - 36;
  const chartHeight = 140;
  const vPad = 8; // vertical padding so top/bottom dots aren't clipped
  const pad = 8;

  const dataMin = history.length > 0 ? Math.min(...history.map(d => d.gpa)) : 0;
  const dataMax = history.length > 0 ? Math.max(...history.map(d => d.gpa)) : 4;
  // Round down to nearest 0.5 for minY, up to nearest 0.5 for maxY, with at least 0.5 range
  const minY = Math.max(0, Math.floor(dataMin * 2) / 2 - 0.5);
  const maxY = Math.min(4, Math.ceil(dataMax * 2) / 2 + 0.5);
  const range = maxY - minY;
  // Generate y-axis labels evenly spaced
  const yLabelCount = 5;
  const yLabels = Array.from({ length: yLabelCount }, (_, i) =>
    Math.round((maxY - (i / (yLabelCount - 1)) * range) * 100) / 100
  );

  const animWidth = useRef(new Animated.Value(0)).current;
  const [clipW, setClipW] = useState(0);

  useEffect(() => {
    animWidth.setValue(0);
    const id = animWidth.addListener(({ value }) => setClipW(value));
    Animated.timing(animWidth, {
      toValue: chartWidth + pad,
      duration: 1600,
      delay: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => animWidth.removeListener(id);
  }, [animWidth, chartWidth, history]);

  if (history.length === 0) {
    return (
      <View style={{ height: 80, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#9ca3af', fontSize: 13 }}>No past quarter data yet</Text>
      </View>
    );
  }

  const pts = history.map((d, i) => ({
    x: history.length === 1
      ? chartWidth / 2
      : pad + i * ((chartWidth - pad * 2) / (history.length - 1)),
    y: vPad + (1 - (d.gpa - minY) / (maxY - minY)) * (chartHeight - vPad * 2),
    label: d.label,
    gpa: d.gpa,
  }));

  const pathD = buildMonotonePath(pts);

  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        {/* Y axis */}
        <View style={{ width: 36, height: chartHeight, justifyContent: 'space-between' }}>
          {yLabels.map(l => (
            <Text key={l} style={{ fontSize: 10, color: '#9ca3af', marginTop: -4 }}>{l}</Text>
          ))}
        </View>

        {/* Chart */}
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <ClipPath id="revealClip">
              {/* plain Rect — not animated, updated via state */}
              <Path d={`M 0 -10 H ${clipW} V ${chartHeight + 10} H 0 Z`} />
            </ClipPath>
          </Defs>

          {/* Grid lines */}
          {yLabels.map(l => {
            const y = vPad + (1 - (l - minY) / (maxY - minY)) * (chartHeight - vPad * 2);
            return <Line key={l} x1={0} y1={y} x2={chartWidth} y2={y} stroke="#f3f4f6" strokeWidth={1} />;
          })}

          {/* Animated line + dots */}
          <G clipPath="url(#revealClip)">
            <Path d={pathD} fill="none" stroke="#4169E1" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            {pts.map(p => (
              <Circle key={p.label} cx={p.x} cy={p.y} r={5} fill="#4169E1" stroke="white" strokeWidth={2} />
            ))}
          </G>
        </Svg>
      </View>

      {/* X labels */}
      <View style={{ flexDirection: 'row', marginLeft: 36, marginTop: 8, paddingHorizontal: pad }}>
        {pts.map((p, i) => (
          <View key={p.label} style={{
            position: 'absolute',
            left: p.x - 22,
            width: 44,
            alignItems: 'center',
          }}>
            <Text style={{ fontSize: 10, color: '#9ca3af' }}>{p.label}</Text>
          </View>
        ))}
      </View>
      <View style={{ height: 20 }} />
    </View>
  );
}

// ── grade badge ───────────────────────────────────────────────────────────────

function GradeBadge({ grade, onPress }: { grade?: string; onPress: () => void }) {
  if (grade) {
    return (
      <TouchableOpacity onPress={onPress} style={{
        minWidth: 44, height: 36, borderRadius: 10,
        backgroundColor: '#f3f4f6', alignItems: 'center',
        justifyContent: 'center', paddingHorizontal: 10,
      }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#374151' }}>{grade}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity onPress={onPress} style={{
      height: 36, borderRadius: 10, borderWidth: 1.5,
      borderColor: '#e5e7eb', paddingHorizontal: 12,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: 13, color: '#9ca3af', fontWeight: '500' }}>Select Grade</Text>
    </TouchableOpacity>
  );
}

// ── grade picker modal ────────────────────────────────────────────────────────

function GradePickerModal({
  visible, current, currentUnits, onSelect, onSetUnits, onClose,
}: {
  visible: boolean;
  current?: string;
  currentUnits: number;
  onSelect: (g: string) => void;
  onSetUnits: (u: number) => void;
  onClose: () => void;
}) {
  const [showUnitsPicker, setShowUnitsPicker] = useState(false);

  useEffect(() => { if (!visible) setShowUnitsPicker(false); }, [visible]);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}
        activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
          <View style={{
            backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20,
            padding: 20, paddingBottom: 36,
          }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 16 }}>Select Grade</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {GRADE_OPTIONS.map(g => {
                const selected = current === g;
                const isWide = g === 'NP';
                return (
                  <TouchableOpacity
                    key={g}
                    onPress={() => { onSelect(g); onClose(); }}
                    style={{
                      width: isWide ? 76 : 58, height: 44, borderRadius: 12,
                      backgroundColor: selected ? '#4169E1' : '#f3f4f6',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '700', color: selected ? 'white' : '#374151' }}>{g}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                onPress={() => setShowUnitsPicker(v => !v)}
                style={{
                  height: 44, borderRadius: 12, paddingHorizontal: 14,
                  backgroundColor: showUnitsPicker ? '#4169E1' : '#f3f4f6',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: showUnitsPicker ? 'white' : '#374151' }}>
                  Edit Units
                </Text>
              </TouchableOpacity>
            </View>

            {showUnitsPicker && (
              <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#6b7280', marginBottom: 12 }}>
                  Units (current: {currentUnits})
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {[1, 2, 3, 4, 5].map(u => (
                    <TouchableOpacity
                      key={u}
                      onPress={() => { onSetUnits(u); setShowUnitsPicker(false); }}
                      style={{
                        width: 52, height: 44, borderRadius: 12,
                        backgroundColor: currentUnits === u ? '#4169E1' : '#f3f4f6',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 16, fontWeight: '700', color: currentUnits === u ? 'white' : '#374151' }}>
                        {u}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── past semester section ─────────────────────────────────────────────────────

function PastQuarterSection({
  label, qk, courses, grades, unitOverrides, onEditGrade, defaultExpanded,
}: {
  label: string;
  qk: string;
  courses: Course[];
  grades: Record<string, string>;
  unitOverrides: Record<string, number>;
  onEditGrade: (key: string) => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(p => !p);
  };

  return (
    <View style={{
      backgroundColor: 'white', borderRadius: 16, marginBottom: 12, overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    }}>
      <TouchableOpacity onPress={toggle} style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 16,
      }}>
        <View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>{label}</Text>
          <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{courses.length} course{courses.length !== 1 ? 's' : ''}</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#9ca3af" />
      </TouchableOpacity>

      {expanded && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
          {courses.map(c => (
            <View key={c.id} style={{
              backgroundColor: 'white', borderRadius: 12, padding: 14,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              borderWidth: 1, borderColor: '#f3f4f6',
            }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>{c.title || c.code}</Text>
                <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{unitOverrides[`${qk}|${c.id}`] ?? c.units ?? 0} credits</Text>
              </View>
              <GradeBadge grade={grades[`${qk}|${c.id}`]} onPress={() => onEditGrade(`${qk}|${c.id}`)} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── main screen ───────────────────────────────────────────────────────────────

export default function GradesScreen({ timetables, userId }: Props) {
  const currentTimetable = timetables.find(t => t.quarterKey === CURRENT_QK) ?? null;
  const activeCourses = currentTimetable?.courses ?? [];
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [unitOverrides, setUnitOverrides] = useState<Record<string, number>>({});
  const [pickerCourseId, setPickerCourseId] = useState<string | null>(null);

  // Compound key: "2026-Spring|36120" — prevents collisions if section codes repeat across years
  const gk = (qk: string, courseId: string) => `${qk}|${courseId}`;

  // Load grades from Supabase on mount
  useEffect(() => {
    async function loadGrades() {
      const { data, error } = await supabase
        .from('grades')
        .select('quarter_key, course_id, grade')
        .eq('user_id', userId);
      if (error) { console.error('Failed to load grades:', error); return; }
      const loaded: Record<string, string> = {};
      (data ?? []).forEach((row: any) => { loaded[gk(row.quarter_key, row.course_id)] = row.grade; });
      setGrades(loaded);
    }
    loadGrades();
  }, [userId]);

  // key is the compound "qk|courseId" string
  async function handleSetGrade(key: string, grade: string) {
    setGrades(prev => ({ ...prev, [key]: grade }));
    const [qk, courseId] = key.split('|');
    const { error } = await supabase
      .from('grades')
      .upsert(
        { user_id: userId, quarter_key: qk, course_id: courseId, grade },
        { onConflict: 'user_id,quarter_key,course_id' }
      );
    if (error) console.error('Failed to save grade:', error);
  }

  // Past quarters: any timetable whose quarter key is before Spring 2026, derived from timetables directly
  const QORDER_MAP: Record<string, number> = { Winter: 0, Spring: 1, Fall: 2 };

  function parseQk(qk: string): Quarter {
    const dash = qk.indexOf('-');
    return { year: qk.slice(0, dash), quarter: qk.slice(dash + 1) };
  }

  function isBeforeCurrent(qk: string): boolean {
    const q = parseQk(qk);
    const curYear = parseInt(CURRENT_QUARTER.year);
    const qYear   = parseInt(q.year);
    if (qYear !== curYear) return qYear < curYear;
    return QORDER_MAP[q.quarter] < QORDER_MAP[CURRENT_QUARTER.quarter];
  }

  const pastQuarterItems = useMemo(() => {
    const pastQks = Array.from(new Set(
      timetables.filter(t => isBeforeCurrent(t.quarterKey)).map(t => t.quarterKey)
    ));

    // Sort most recent first
    pastQks.sort((a, b) => {
      const qa = parseQk(a), qb = parseQk(b);
      const yearDiff = parseInt(qb.year) - parseInt(qa.year);
      if (yearDiff !== 0) return yearDiff;
      return QORDER_MAP[qb.quarter] - QORDER_MAP[qa.quarter];
    });

    return pastQks.map(qk => {
      const q = parseQk(qk);
      const tt = timetables.find(t => t.quarterKey === qk && t.courses.length > 0);
      if (!tt) return null;
      const courses = tt.courses.filter(c => (c.units ?? 0) > 0);
      if (courses.length === 0) return null;
      return { label: quarterLabel(q), qk, courses };
    }).filter((x): x is { label: string; qk: string; courses: Course[] } => x !== null);
  }, [timetables]);

  // Effective units: use local override if set, otherwise fall back to Supabase value
  const getUnits = (qk: string, c: Course) => unitOverrides[gk(qk, c.id)] ?? c.units ?? 0;

  // GPA history for chart: past quarters + current quarter, chronological order
  const gpaHistory = useMemo(() => {
    const quarterGpa = (qk: string, courses: Course[]) => {
      const graded = courses.filter(c => {
        const g = grades[gk(qk, c.id)];
        return g && GRADE_POINTS[g] !== undefined;
      });
      const totalCredits = graded.reduce((s, c) => s + getUnits(qk, c), 0);
      const totalPoints  = graded.reduce((s, c) => s + GRADE_POINTS[grades[gk(qk, c.id)]] * getUnits(qk, c), 0);
      return totalCredits > 0 ? totalPoints / totalCredits : 0;
    };

    return [
      ...pastQuarterItems.slice().reverse().map(({ label, qk, courses }) => ({
        label, gpa: quarterGpa(qk, courses),
      })),
      { label: quarterLabel(CURRENT_QUARTER), gpa: quarterGpa(CURRENT_QK, activeCourses) },
    ].filter(p => p.gpa > 0);
  }, [pastQuarterItems, grades, activeCourses, unitOverrides]);

  const { gpa, credits, courseCount } = useMemo(() => {
    const gradedActive = activeCourses.filter(c => getUnits(CURRENT_QK, c) > 0).filter(c => {
      const g = grades[gk(CURRENT_QK, c.id)];
      return g && GRADE_POINTS[g] !== undefined;
    });
    const activeCredits = gradedActive.reduce((s, c) => s + getUnits(CURRENT_QK, c), 0);
    const activePoints  = gradedActive.reduce((s, c) => s + GRADE_POINTS[grades[gk(CURRENT_QK, c.id)]] * getUnits(CURRENT_QK, c), 0);

    const pastCourses = pastQuarterItems.flatMap(({ qk, courses }) =>
      courses.map(c => ({ ...c, _qk: qk }))
    );
    const gradedPast = pastCourses.filter(c => {
      const g = grades[gk(c._qk, c.id)];
      return g && GRADE_POINTS[g] !== undefined;
    });
    const pastCredits = gradedPast.reduce((s, c) => s + getUnits(c._qk, c), 0);
    const pastPoints  = gradedPast.reduce((s, c) => s + GRADE_POINTS[grades[gk(c._qk, c.id)]] * getUnits(c._qk, c), 0);

    const totalCredits = pastCredits + activeCredits;
    const gpaVal = totalCredits > 0 ? (pastPoints + activePoints) / totalCredits : 0;

    return {
      gpa: gpaVal > 0 ? gpaVal.toFixed(2) : '—',
      credits: pastQuarterItems.flatMap(({ qk, courses }) => courses.map(c => ({ c, qk }))).reduce((s, { c, qk }) => s + getUnits(qk, c), 0)
             + activeCourses.filter(c => getUnits(CURRENT_QK, c) > 0).reduce((s, c) => s + getUnits(CURRENT_QK, c), 0),
      courseCount: pastQuarterItems.flatMap(q => q.courses).length + activeCourses.filter(c => getUnits(CURRENT_QK, c) > 0).length,
    };
  }, [grades, activeCourses, pastQuarterItems, unitOverrides]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f7f8fa' }} contentContainerStyle={{ paddingTop: 60, paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#111827', marginBottom: 20 }}>Grades</Text>

      {/* Stats row */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'GPA',     value: gpa },
          { label: 'Credits', value: String(credits) },
          { label: 'Courses', value: String(courseCount) },
        ].map(stat => (
          <View key={stat.label} style={{
            flex: 1, backgroundColor: 'white', borderRadius: 16, padding: 14,
            shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
          }}>
            <Text style={{ fontSize: 12, color: '#9ca3af', fontWeight: '500' }}>{stat.label}</Text>
            <Text style={{ fontSize: 26, fontWeight: 'bold', color: '#111827', marginTop: 4 }}>{stat.value}</Text>
          </View>
        ))}
      </View>

      {/* GPA Trend card */}
      <View style={{
        backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 24,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
      }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 14 }}>GPA Trend</Text>
        <GpaChart history={gpaHistory} />
      </View>

      {/* Current quarter */}
      <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 12 }}>
        Current Quarter
      </Text>

      {activeCourses.filter(c => (c.units ?? 0) > 0).length === 0 ? (
        <View style={{
          backgroundColor: 'white', borderRadius: 16, padding: 20,
          alignItems: 'center', marginBottom: 24,
        }}>
          <Text style={{ color: '#9ca3af', fontSize: 14 }}>No courses added yet</Text>
        </View>
      ) : (
        <View style={{ gap: 10, marginBottom: 24 }}>
          {activeCourses.filter(c => getUnits(CURRENT_QK, c) > 0).map(course => (
            <View key={course.id} style={{
              backgroundColor: 'white', borderRadius: 14, padding: 16,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
            }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>
                  {course.title || course.code}
                </Text>
                <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>
                  {getUnits(CURRENT_QK, course)} credits
                </Text>
              </View>
              <GradeBadge
                grade={grades[gk(CURRENT_QK, course.id)]}
                onPress={() => setPickerCourseId(gk(CURRENT_QK, course.id))}
              />
            </View>
          ))}
        </View>
      )}

      {/* Past quarters */}
      {pastQuarterItems.length > 0 && (
        <>
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 12 }}>
            Past Quarters
          </Text>
          {pastQuarterItems.map((item, idx) => (
            <PastQuarterSection
              key={item.label}
              label={item.label}
              qk={item.qk}
              courses={item.courses}
              grades={grades}
              unitOverrides={unitOverrides}
              onEditGrade={setPickerCourseId}
              defaultExpanded={idx === 0}
            />
          ))}
        </>
      )}

      {/* Grade picker modal */}
      <GradePickerModal
        visible={pickerCourseId !== null}
        current={pickerCourseId ? grades[pickerCourseId] : undefined}
        currentUnits={(() => {
          if (!pickerCourseId) return 0;
          const [qk, courseId] = pickerCourseId.split('|');
          if (unitOverrides[pickerCourseId] !== undefined) return unitOverrides[pickerCourseId];
          const allCourses = qk === CURRENT_QK
            ? activeCourses
            : (pastQuarterItems.find(i => i.qk === qk)?.courses ?? []);
          return allCourses.find(c => c.id === courseId)?.units ?? 0;
        })()}
        onSelect={g => { if (pickerCourseId) { handleSetGrade(pickerCourseId, g); } }}
        onSetUnits={u => { if (pickerCourseId) setUnitOverrides(prev => ({ ...prev, [pickerCourseId]: u })); }}
        onClose={() => setPickerCourseId(null)}
      />
    </ScrollView>
  );
}

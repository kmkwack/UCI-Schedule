import { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal,
  Animated, Easing, Dimensions, LayoutAnimation,
  Platform, UIManager,
} from 'react-native';
import Svg, { Path, Circle, Line, Defs, ClipPath, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Course } from '../data/courses';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = { activeCourses: Course[] };

// ── constants ─────────────────────────────────────────────────────────────────

const GRADE_OPTIONS = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'];

const GRADE_POINTS: Record<string, number> = {
  'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7,
  'C+': 2.3, 'C': 2.0, 'C-': 1.7, 'D': 1.0, 'F': 0.0,
};

const GPA_HISTORY = [
  { label: 'Fall 23',   gpa: 3.28 },
  { label: 'Spring 24', gpa: 3.58 },
  { label: 'Fall 24',   gpa: 3.65 },
  { label: 'Spring 25', gpa: 3.72 },
  { label: 'Fall 25',   gpa: 3.78 },
];

const PAST_SEMESTERS = [
  {
    key: 'Spring 2025',
    courses: [
      { id: 'ps1', title: 'Data Structures',   credits: 4, grade: 'A'  },
      { id: 'ps2', title: 'Calculus II',        credits: 3, grade: 'A-' },
      { id: 'ps3', title: 'Chemistry',          credits: 4, grade: 'B+' },
      { id: 'ps4', title: 'Economics',          credits: 3, grade: 'A'  },
    ],
  },
  {
    key: 'Fall 2024',
    courses: [
      { id: 'f1', title: 'Intro to Programming', credits: 4, grade: 'A'  },
      { id: 'f2', title: 'Calculus I',            credits: 4, grade: 'B+' },
      { id: 'f3', title: 'English Composition',   credits: 3, grade: 'A-' },
    ],
  },
  {
    key: 'Spring 2024',
    courses: [
      { id: 'sp24a', title: 'Discrete Math',    credits: 4, grade: 'B+' },
      { id: 'sp24b', title: 'Physics I',        credits: 4, grade: 'A-' },
      { id: 'sp24c', title: 'Writing 39C',      credits: 4, grade: 'A'  },
    ],
  },
];

const PAST_CREDITS = PAST_SEMESTERS.reduce(
  (sum, sem) => sum + sem.courses.reduce((s, c) => s + c.credits, 0), 0
);
const PAST_COURSE_COUNT = PAST_SEMESTERS.reduce((sum, sem) => sum + sem.courses.length, 0);

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

function GpaChart() {
  const screenWidth = Dimensions.get('window').width;
  const chartWidth  = screenWidth - 64 - 36;
  const chartHeight = 140;
  const minY = 3.0, maxY = 4.0;
  const yLabels = [4, 3.75, 3.5, 3.25, 3];
  const pad = 8;

  const animWidth = useRef(new Animated.Value(0)).current;
  const [clipW, setClipW] = useState(0);

  useEffect(() => {
    const id = animWidth.addListener(({ value }) => setClipW(value));
    Animated.timing(animWidth, {
      toValue: chartWidth + pad,
      duration: 1600,
      delay: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => animWidth.removeListener(id);
  }, [animWidth, chartWidth]);

  const pts = GPA_HISTORY.map((d, i) => ({
    x: pad + i * ((chartWidth - pad * 2) / (GPA_HISTORY.length - 1)),
    y: chartHeight - ((d.gpa - minY) / (maxY - minY)) * chartHeight,
    ...d,
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
            const y = chartHeight - ((l - minY) / (maxY - minY)) * chartHeight;
            return <Line key={l} x1={0} y1={y} x2={chartWidth} y2={y} stroke="#f3f4f6" strokeWidth={1} />;
          })}

          {/* Animated line + dots */}
          <G clipPath="url(#revealClip)">
            <Path d={pathD} fill="none" stroke="#4f6ef7" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            {pts.map(p => (
              <Circle key={p.label} cx={p.x} cy={p.y} r={5} fill="#4f6ef7" stroke="white" strokeWidth={2} />
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
  visible, current, onSelect, onClose,
}: {
  visible: boolean; current?: string;
  onSelect: (g: string) => void; onClose: () => void;
}) {
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
                return (
                  <TouchableOpacity
                    key={g}
                    onPress={() => { onSelect(g); onClose(); }}
                    style={{
                      width: 58, height: 44, borderRadius: 12,
                      backgroundColor: selected ? '#4f6ef7' : '#f3f4f6',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '700', color: selected ? 'white' : '#374151' }}>{g}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── past semester section ─────────────────────────────────────────────────────

function PastSemesterSection({ sem }: { sem: typeof PAST_SEMESTERS[0] }) {
  const [expanded, setExpanded] = useState(sem.key === 'Spring 2025');

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
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>{sem.key}</Text>
          <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{sem.courses.length} courses</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#9ca3af" />
      </TouchableOpacity>

      {expanded && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
          {sem.courses.map(c => (
            <View key={c.id} style={{
              backgroundColor: 'white', borderRadius: 12, padding: 14,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              borderWidth: 1, borderColor: '#f3f4f6',
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>{c.title}</Text>
                <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{c.credits} credits</Text>
              </View>
              <View style={{
                minWidth: 44, height: 36, borderRadius: 10,
                backgroundColor: '#f3f4f6', alignItems: 'center',
                justifyContent: 'center', paddingHorizontal: 10,
              }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#374151' }}>{c.grade}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── main screen ───────────────────────────────────────────────────────────────

export default function GradesScreen({ activeCourses }: Props) {
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [pickerCourseId, setPickerCourseId] = useState<string | null>(null);

  const { gpa, credits, courseCount } = useMemo(() => {
    const gradedActive = activeCourses.filter(c => grades[c.id]);
    const activeCredits = gradedActive.reduce((s, c) => s + (c.units ?? 3), 0);
    const activePoints  = gradedActive.reduce((s, c) => s + GRADE_POINTS[grades[c.id]] * (c.units ?? 3), 0);

    const pastPoints  = PAST_SEMESTERS.flatMap(s => s.courses).reduce((s, c) => s + GRADE_POINTS[c.grade] * c.credits, 0);
    const totalCreditsPts = PAST_CREDITS + activeCredits;
    const gpaVal = totalCreditsPts > 0 ? (pastPoints + activePoints) / totalCreditsPts : 3.85;

    return {
      gpa: gpaVal.toFixed(2),
      credits: PAST_CREDITS + activeCourses.reduce((s, c) => s + (c.units ?? 3), 0),
      courseCount: PAST_COURSE_COUNT + activeCourses.length,
    };
  }, [grades, activeCourses]);

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
        <GpaChart />
      </View>

      {/* Current quarter */}
      <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 12 }}>
        Current Quarter/Semester
      </Text>

      {activeCourses.length === 0 ? (
        <View style={{
          backgroundColor: 'white', borderRadius: 16, padding: 20,
          alignItems: 'center', marginBottom: 24,
        }}>
          <Text style={{ color: '#9ca3af', fontSize: 14 }}>No courses added yet</Text>
        </View>
      ) : (
        <View style={{ gap: 10, marginBottom: 24 }}>
          {activeCourses.map(course => (
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
                  {course.units ?? 3} credits
                </Text>
              </View>
              <GradeBadge
                grade={grades[course.id]}
                onPress={() => setPickerCourseId(course.id)}
              />
            </View>
          ))}
        </View>
      )}

      {/* Past semesters */}
      <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 12 }}>
        Past Semesters
      </Text>
      {PAST_SEMESTERS.map(sem => (
        <PastSemesterSection key={sem.key} sem={sem} />
      ))}

      {/* Grade picker modal */}
      <GradePickerModal
        visible={pickerCourseId !== null}
        current={pickerCourseId ? grades[pickerCourseId] : undefined}
        onSelect={g => pickerCourseId && setGrades(prev => ({ ...prev, [pickerCourseId]: g }))}
        onClose={() => setPickerCourseId(null)}
      />
    </ScrollView>
  );
}

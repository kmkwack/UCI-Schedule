import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, TouchableOpacity, ScrollView, Modal,
  Animated, Easing, LayoutAnimation,
  Platform, UIManager,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path, Circle, Line, Defs, ClipPath, G, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Course, Quarter, Timetable, quarterKey, quarterLabel, resolveCurrentQuarter } from '../data/courses';
import { gradeScaleForSchool } from '../data/schools';
import { supabase } from '../lib/supabase';
import { isMissingSchoolColumnError } from '../lib/supabaseErrors';
import { useTheme } from '../context/ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = { timetables: Timetable[]; userId: string; school: string; topInset?: number; bottomInset?: number; scrollToTopTrigger?: number };
type GradeRow = { school?: string; quarter_key: string; course_id: string; grade: string };

let gradesSchoolColumnUnavailable = false;

// ── constants ─────────────────────────────────────────────────────────────────

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

function compactQuarterLabel(label: string) {
  const yearMatch = label.match(/\b(\d{4})\b/);
  const year = yearMatch ? `'${yearMatch[1].slice(-2)}` : '';
  const normalized = label.replace(/\b\d{4}\b/g, '').replace(/\s+/g, '').toLowerCase();
  const term =
    normalized.includes('winter') ? 'W' :
    normalized.includes('spring') ? 'Sp' :
    normalized.includes('fall') ? 'F' :
    normalized.includes('summer2') || normalized.includes('summersession2') ? 'S2' :
    normalized.includes('summer1') || normalized.includes('summersession1') ? 'S1' :
    normalized.includes('summer') ? 'Su' :
    label.replace(/\s+/g, ' ').trim().slice(0, 5);
  return year ? `${term} ${year}` : term;
}

function visibleXAxisIndices(pointCount: number, chartWidth: number) {
  if (pointCount <= 1) return [0];
  const maxLabels = Math.max(2, Math.min(pointCount, Math.floor(chartWidth / 64)));
  if (pointCount <= maxLabels) {
    return Array.from({ length: pointCount }, (_, i) => i);
  }
  const indices = new Set<number>();
  for (let i = 0; i < maxLabels; i++) {
    indices.add(Math.round((i * (pointCount - 1)) / (maxLabels - 1)));
  }
  indices.add(0);
  indices.add(pointCount - 1);
  return Array.from(indices).sort((a, b) => a - b);
}

function GpaChart({ history, maxGpa }: { history: { label: string; gpa: number }[]; maxGpa: number }) {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(0);
  const yAxisWidth = 46;
  const chartWidth = Math.max(220, (containerWidth || screenWidth - 72) - yAxisWidth);
  const chartHeight = 150;
  const vPad = 12; // vertical padding so top/bottom dots aren't clipped
  const hPad = 10;

  const dataMin = history.length > 0 ? Math.min(...history.map(d => d.gpa)) : 0;
  const dataMax = history.length > 0 ? Math.max(...history.map(d => d.gpa)) : maxGpa;
  // Round down to nearest 0.5 for minY, up to nearest 0.5 for maxY, with at least 0.5 range
  const minY = Math.max(0, Math.floor(dataMin * 2) / 2 - 0.5);
  const maxY = Math.min(maxGpa, Math.ceil(dataMax * 2) / 2 + 0.5);
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
      toValue: chartWidth + hPad,
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
        <Text style={{ color: colors.textTertiary, fontSize: 13 }}>No past term data yet</Text>
      </View>
    );
  }

  const pts = history.map((d, i) => ({
    x: history.length === 1
      ? chartWidth / 2
      : hPad + i * ((chartWidth - hPad * 2) / (history.length - 1)),
    y: vPad + (1 - (d.gpa - minY) / (maxY - minY)) * (chartHeight - vPad * 2),
    label: d.label,
    gpa: d.gpa,
  }));
  const xLabelIndices = visibleXAxisIndices(pts.length, chartWidth);
  const xLabelWidth = 48;

  const pathD = buildMonotonePath(pts);
  const baselineY = chartHeight - vPad;
  const areaD = pts.length > 1
    ? `${pathD} L ${pts[pts.length - 1].x} ${baselineY} L ${pts[0].x} ${baselineY} Z`
    : '';
  const latest = history[history.length - 1];
  const best = history.reduce((winner, item) => (item.gpa > winner.gpa ? item : winner), history[0]);

  return (
    <View onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'Latest', value: latest.gpa.toFixed(2) },
          { label: 'Best', value: best.gpa.toFixed(2) },
        ].map(item => (
          <View
            key={item.label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 6,
              backgroundColor: colors.brandBg,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
            }}
          >
            <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '700' }}>{item.label}</Text>
            <Text style={{ fontSize: 12, color: colors.brand, fontWeight: '800' }}>{item.value}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row' }}>
        {/* Y axis */}
        <View style={{ width: yAxisWidth, height: chartHeight, position: 'relative' }}>
          {yLabels.map(l => {
            const y = vPad + (1 - (l - minY) / (maxY - minY)) * (chartHeight - vPad * 2);
            return (
              <Text
                key={l}
                style={{
                  position: 'absolute',
                  top: y - 7,
                  right: 12,
                  fontSize: 11,
                  lineHeight: 14,
                  color: colors.textTertiary,
                  fontWeight: '600',
                }}
              >
                {Number.isInteger(l) ? l.toFixed(0) : l.toFixed(2).replace(/0$/, '')}
              </Text>
            );
          })}
        </View>

        {/* Chart */}
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="gpaFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#4169E1" stopOpacity="0.22" />
              <Stop offset="1" stopColor="#4169E1" stopOpacity="0.02" />
            </LinearGradient>
            <ClipPath id="revealClip">
              {/* plain Rect — not animated, updated via state */}
              <Path d={`M 0 -10 H ${clipW} V ${chartHeight + 10} H 0 Z`} />
            </ClipPath>
          </Defs>

          {/* Grid lines */}
          {yLabels.map(l => {
            const y = vPad + (1 - (l - minY) / (maxY - minY)) * (chartHeight - vPad * 2);
            return <Line key={l} x1={0} y1={y} x2={chartWidth} y2={y} stroke={colors.borderSubtle} strokeWidth={1} />;
          })}

          {/* Animated line + dots */}
          <G clipPath="url(#revealClip)">
            {areaD ? <Path d={areaD} fill="url(#gpaFill)" /> : null}
            {pathD ? (
              <Path d={pathD} fill="none" stroke="#4169E1" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            ) : null}
            {pts.map((p, index) => (
              <Circle key={`${p.label}-${index}`} cx={p.x} cy={p.y} r={6} fill="#4169E1" stroke={colors.card} strokeWidth={2.5} />
            ))}
          </G>
        </Svg>
      </View>

      {/* X labels */}
      <View style={{ marginLeft: yAxisWidth, marginTop: 9, height: 22, position: 'relative' }}>
        {xLabelIndices.map((index) => {
          const p = pts[index];
          return (
          <View key={`${p.label}-${index}`} style={{
            position: 'absolute',
            left: Math.max(0, Math.min(p.x - xLabelWidth / 2, chartWidth - xLabelWidth)),
            width: xLabelWidth,
            alignItems: 'center',
          }}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ fontSize: 10.5, lineHeight: 14, color: colors.textTertiary, textAlign: 'center', fontWeight: '700' }}
            >
              {compactQuarterLabel(p.label)}
            </Text>
          </View>
          );
        })}
      </View>
    </View>
  );
}

// ── grade badge ───────────────────────────────────────────────────────────────

function GradeBadge({ grade, onPress }: { grade?: string; onPress: () => void }) {
  const { colors } = useTheme();
  if (grade) {
    return (
      <TouchableOpacity onPress={onPress} style={{
        minWidth: 44, height: 36, borderRadius: 10,
        backgroundColor: colors.inputBg, alignItems: 'center',
        justifyContent: 'center', paddingHorizontal: 10,
      }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textSecondary }}>{grade}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity onPress={onPress} style={{
      height: 36, borderRadius: 10, borderWidth: 1.5,
      borderColor: colors.border, paddingHorizontal: 12,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: 13, color: colors.textTertiary, fontWeight: '500' }}>Select Grade</Text>
    </TouchableOpacity>
  );
}

// ── grade picker modal ────────────────────────────────────────────────────────

function groupedLetterGrades(gradeOptions: string[]) {
  const used = new Set<string>();
  const rows = ['A', 'B', 'C', 'D'].map((letter) => {
    const grades = [`${letter}+`, letter, `${letter}-`].filter((grade) => gradeOptions.includes(grade));
    grades.forEach((grade) => used.add(grade));
    return { letter, grades };
  }).filter((row) => row.grades.length > 0);

  if (gradeOptions.includes('F')) {
    rows.push({ letter: 'F', grades: ['F'] });
    used.add('F');
  }

  return {
    rows,
    otherGrades: gradeOptions.filter((grade) => !used.has(grade)),
  };
}

function GradePickerModal({
  visible, current, currentUnits, gradeOptions, onSelect, onSetUnits, onClose,
}: {
  visible: boolean;
  current?: string;
  currentUnits: number;
  gradeOptions: string[];
  onSelect: (g: string) => void;
  onSetUnits: (u: number) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const { rows: letterGradeRows, otherGrades } = useMemo(() => groupedLetterGrades(gradeOptions), [gradeOptions]);
  const sheetMaxHeight = Math.min(screenHeight * 0.72, 580);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}
        activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
          <View style={{
            backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
            paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34,
            maxHeight: sheetMaxHeight,
          }}>
            <View style={{ alignItems: 'center', paddingBottom: 14 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Grade</Text>
              </View>
              {current ? (
                <View style={{ minWidth: 48, height: 36, borderRadius: 18, backgroundColor: colors.brandBg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.brand }}>{current}</Text>
                </View>
              ) : null}
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.bgTertiary }}>
                {letterGradeRows.map((row, index) => (
                  <View
                    key={row.letter}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: colors.borderSubtle,
                    }}
                  >
                    <View style={{ width: 30 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textTertiary }}>{row.letter}</Text>
                    </View>
                    <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
                      {row.grades.map((grade) => {
                        const selected = current === grade;
                        return (
                          <TouchableOpacity
                            key={grade}
                            onPress={() => { onSelect(grade); onClose(); }}
                            activeOpacity={0.78}
                            style={{
                              flex: row.grades.length === 1 ? 0 : 1,
                              minWidth: row.grades.length === 1 ? 78 : 0,
                              height: 44,
                              borderRadius: 14,
                              backgroundColor: selected ? colors.brand : colors.card,
                              borderWidth: 1,
                              borderColor: selected ? colors.brand : colors.borderSubtle,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text style={{ fontSize: 16, fontWeight: '800', color: selected ? 'white' : colors.text }}>
                              {grade}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>

              {otherGrades.length > 0 ? (
                <View style={{ marginTop: 18 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textTertiary, marginBottom: 10 }}>
                    Other
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {otherGrades.map((grade) => {
                      const selected = current === grade;
                      return (
                        <TouchableOpacity
                          key={grade}
                          onPress={() => { onSelect(grade); onClose(); }}
                          activeOpacity={0.78}
                          style={{
                            minWidth: 62,
                            height: 42,
                            borderRadius: 14,
                            paddingHorizontal: 14,
                            backgroundColor: selected ? colors.brand : colors.inputBg,
                            borderWidth: 1,
                            borderColor: selected ? colors.brand : colors.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{ fontSize: 14, fontWeight: '800', color: selected ? 'white' : colors.textSecondary }}>
                            {grade}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: colors.borderSubtle, paddingTop: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textTertiary, marginBottom: 10 }}>
                  Units
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[1, 2, 3, 4, 5].map(u => (
                    <TouchableOpacity
                      key={u}
                      onPress={() => onSetUnits(u)}
                      activeOpacity={0.78}
                      style={{
                        flex: 1,
                        height: 42,
                        borderRadius: 14,
                        backgroundColor: currentUnits === u ? colors.brand : colors.inputBg,
                        borderWidth: 1,
                        borderColor: currentUnits === u ? colors.brand : colors.border,
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 16, fontWeight: '700', color: currentUnits === u ? 'white' : colors.textSecondary }}>
                        {u}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── past semester section ─────────────────────────────────────────────────────

function PastQuarterSection({
  label, qk, courses, grades, unitOverrides, gradePoints, onEditGrade, defaultExpanded,
}: {
  label: string;
  qk: string;
  courses: Course[];
  grades: Record<string, string>;
  unitOverrides: Record<string, number>;
  gradePoints: Record<string, number>;
  onEditGrade: (key: string) => void;
  defaultExpanded?: boolean;
}) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const summary = useMemo(() => {
    const rows = courses.map(course => {
      const key = `${qk}|${course.id}`;
      const units = unitOverrides[key] ?? course.units ?? 0;
      const grade = grades[key];
      return { units, grade };
    });
    const gradedRows = rows.filter(row => !!row.grade);
    const gpaRows = rows.filter(row => row.grade && gradePoints[row.grade] !== undefined);
    const totalUnits = rows.reduce((sum, row) => sum + row.units, 0);
    const gpaUnits = gpaRows.reduce((sum, row) => sum + row.units, 0);
    const gpaPoints = gpaRows.reduce((sum, row) => sum + gradePoints[row.grade as string] * row.units, 0);
    return {
      gpa: gpaUnits > 0 ? (gpaPoints / gpaUnits).toFixed(2) : '—',
      totalUnits,
      gpaUnits,
      gradedCount: gradedRows.length,
    };
  }, [courses, gradePoints, grades, qk, unitOverrides]);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(p => !p);
  };

  return (
    <View style={{
      backgroundColor: colors.card,
      borderRadius: 20,
      marginBottom: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.72)',
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 5,
    }}>
      <TouchableOpacity onPress={toggle} style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 17,
      }}>
        <View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{label}</Text>
          <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>
            GPA {summary.gpa} · {summary.totalUnits} units · {summary.gradedCount}/{courses.length} graded
          </Text>
        </View>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.bgTertiary,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#0f172a',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
          <View
            style={{
              backgroundColor: colors.bg,
              borderRadius: 16,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
            }}
          >
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { label: 'GPA', value: summary.gpa },
                { label: 'Units', value: String(summary.totalUnits) },
                { label: 'Graded', value: `${summary.gradedCount}/${courses.length}` },
                { label: 'GPA Units', value: String(summary.gpaUnits) },
              ].map(item => (
                <View
                  key={item.label}
                  style={{
                    flex: 1,
                    borderRadius: 13,
                    paddingVertical: 11,
                    paddingHorizontal: 8,
                    backgroundColor: colors.inputBg,
                    alignItems: 'center',
                    minHeight: 62,
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '600', textAlign: 'center' }}>{item.label}</Text>
                  <Text style={{ fontSize: 17, color: colors.text, fontWeight: '800', marginTop: 4 }}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>
          {courses.map(c => (
            <View key={c.id} style={{
              backgroundColor: colors.bg, borderRadius: 14, padding: 14,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              borderWidth: 1, borderColor: colors.borderSubtle,
              shadowColor: '#0f172a',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.05,
              shadowRadius: 12,
              elevation: 2,
            }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{c.title || c.code}</Text>
                <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{unitOverrides[`${qk}|${c.id}`] ?? c.units ?? 0} credits</Text>
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

export default function GradesScreen({ timetables, userId, school, topInset = 0, bottomInset = 0, scrollToTopTrigger = 0 }: Props) {
  const { colors } = useTheme();
  const gradeScale = gradeScaleForSchool(school);
  const gradePoints = gradeScale.points;
  const CURRENT_QUARTER: Quarter = resolveCurrentQuarter(timetables);
  const CURRENT_QK = quarterKey(CURRENT_QUARTER);
  const currentTimetable = timetables.find(t => t.quarterKey === CURRENT_QK && t.name === 'My Schedule') ?? null;
  const activeCourses = currentTimetable?.courses ?? [];
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [unitOverrides, setUnitOverrides] = useState<Record<string, number>>({});
  const [pickerCourseId, setPickerCourseId] = useState<string | null>(null);

  // Compound key: "2026-Spring|36120" — prevents collisions if section codes repeat across years
  const gk = (qk: string, courseId: string) => `${qk}|${courseId}`;

  const cacheKey = `grades_${encodeURIComponent(school)}_${userId}`;

  useEffect(() => {
    async function loadGrades() {
      // Load cache first for instant display
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) setGrades(JSON.parse(cached));

      // Then fetch from Supabase and update. Some deployed databases may not have
      // the school-scoped grades migration yet, so keep a silent legacy fallback.
      let data: GradeRow[] | null = null;
      if (gradesSchoolColumnUnavailable) {
        const legacyResult = await supabase
          .from('grades')
          .select('quarter_key, course_id, grade')
          .eq('user_id', userId);
        if (legacyResult.error) {
          console.warn('Failed to load grades:', legacyResult.error);
          return;
        }
        data = legacyResult.data;
      } else {
        const scopedResult = await supabase
          .from('grades')
          .select('school, quarter_key, course_id, grade')
          .eq('user_id', userId)
          .eq('school', school);
        if (scopedResult.error && isMissingSchoolColumnError(scopedResult.error)) {
          gradesSchoolColumnUnavailable = true;
          const legacyResult = await supabase
            .from('grades')
            .select('quarter_key, course_id, grade')
            .eq('user_id', userId);
          if (legacyResult.error) {
            console.warn('Failed to load grades:', legacyResult.error);
            return;
          }
          data = legacyResult.data;
        } else if (scopedResult.error) {
          console.warn('Failed to load grades:', scopedResult.error);
          return;
        } else {
          data = (scopedResult.data ?? null) as GradeRow[] | null;
        }
      }
      const loaded: Record<string, string> = {};
      (data ?? []).forEach((row: any) => { loaded[gk(row.quarter_key, row.course_id)] = row.grade; });
      setGrades(loaded);
      AsyncStorage.setItem(cacheKey, JSON.stringify(loaded));
    }
    loadGrades();
  }, [cacheKey, school, userId]);

  // key is the compound "qk|courseId" string
  async function handleSetGrade(key: string, grade: string) {
    const updated = { ...grades, [key]: grade };
    setGrades(updated);
    AsyncStorage.setItem(cacheKey, JSON.stringify(updated));
    const [qk, courseId] = key.split('|');
    if (gradesSchoolColumnUnavailable) {
      const legacyResult = await supabase
        .from('grades')
        .upsert(
          { user_id: userId, quarter_key: qk, course_id: courseId, grade },
          { onConflict: 'user_id,quarter_key,course_id' }
        );
      if (legacyResult.error) console.warn('Failed to save grade:', legacyResult.error);
    } else {
      const scopedResult = await supabase
        .from('grades')
        .upsert(
          { user_id: userId, school, quarter_key: qk, course_id: courseId, grade },
          { onConflict: 'user_id,school,quarter_key,course_id' }
        );
      if (scopedResult.error && isMissingSchoolColumnError(scopedResult.error)) {
        gradesSchoolColumnUnavailable = true;
        const legacyResult = await supabase
          .from('grades')
          .upsert(
            { user_id: userId, quarter_key: qk, course_id: courseId, grade },
            { onConflict: 'user_id,quarter_key,course_id' }
          );
        if (legacyResult.error) console.warn('Failed to save grade:', legacyResult.error);
      } else if (scopedResult.error) {
        console.warn('Failed to save grade:', scopedResult.error);
      }
    }
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
      const tt = timetables.find(t => t.quarterKey === qk && t.name === 'My Schedule' && t.courses.length > 0);
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
        return g && gradePoints[g] !== undefined;
      });
      const totalCredits = graded.reduce((s, c) => s + getUnits(qk, c), 0);
      const totalPoints  = graded.reduce((s, c) => s + gradePoints[grades[gk(qk, c.id)]] * getUnits(qk, c), 0);
      return totalCredits > 0 ? totalPoints / totalCredits : 0;
    };

    return [
      ...pastQuarterItems.slice().reverse().map(({ label, qk, courses }) => ({
        label, gpa: quarterGpa(qk, courses),
      })),
      { label: quarterLabel(CURRENT_QUARTER), gpa: quarterGpa(CURRENT_QK, activeCourses) },
    ].filter(p => p.gpa > 0);
  }, [pastQuarterItems, grades, activeCourses, unitOverrides, gradePoints]);

  const { gpa, credits, courseCount } = useMemo(() => {
    const gradedActive = activeCourses.filter(c => getUnits(CURRENT_QK, c) > 0).filter(c => {
      const g = grades[gk(CURRENT_QK, c.id)];
      return g && gradePoints[g] !== undefined;
    });
    const activeCredits = gradedActive.reduce((s, c) => s + getUnits(CURRENT_QK, c), 0);
    const activePoints  = gradedActive.reduce((s, c) => s + gradePoints[grades[gk(CURRENT_QK, c.id)]] * getUnits(CURRENT_QK, c), 0);

    const pastCourses = pastQuarterItems.flatMap(({ qk, courses }) =>
      courses.map(c => ({ ...c, _qk: qk }))
    );
    const gradedPast = pastCourses.filter(c => {
      const g = grades[gk(c._qk, c.id)];
      return g && gradePoints[g] !== undefined;
    });
    const pastCredits = gradedPast.reduce((s, c) => s + getUnits(c._qk, c), 0);
    const pastPoints  = gradedPast.reduce((s, c) => s + gradePoints[grades[gk(c._qk, c.id)]] * getUnits(c._qk, c), 0);

    const totalCredits = pastCredits + activeCredits;
    const gpaVal = totalCredits > 0 ? (pastPoints + activePoints) / totalCredits : 0;

    return {
      gpa: gpaVal > 0 ? gpaVal.toFixed(2) : '—',
      credits: pastQuarterItems.flatMap(({ qk, courses }) => courses.map(c => ({ c, qk }))).reduce((s, { c, qk }) => s + getUnits(qk, c), 0)
             + activeCourses.filter(c => getUnits(CURRENT_QK, c) > 0).reduce((s, c) => s + getUnits(CURRENT_QK, c), 0),
      courseCount: pastQuarterItems.flatMap(q => q.courses).length + activeCourses.filter(c => getUnits(CURRENT_QK, c) > 0).length,
    };
  }, [grades, activeCourses, pastQuarterItems, unitOverrides, gradePoints]);

  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (scrollToTopTrigger > 0) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scrollToTopTrigger]);

  return (
    <ScrollView ref={scrollRef} style={{ flex: 1, backgroundColor: colors.bgSecondary }} contentContainerStyle={{ paddingTop: topInset + 14, paddingHorizontal: 18, paddingBottom: bottomInset + 70 }} showsVerticalScrollIndicator={false}>
      <Text style={{ fontSize: 30, fontWeight: '800', letterSpacing: 0, color: colors.text, marginBottom: 16 }}>Grades</Text>

      {/* Stats row */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'GPA',     value: gpa },
          { label: 'Credits', value: String(credits) },
          { label: 'Courses', value: String(courseCount) },
        ].map(stat => (
          <View key={stat.label} style={{
            flex: 1,
            backgroundColor: colors.card,
            borderRadius: 18,
            padding: 14,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.72)',
            shadowColor: '#0f172a',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.08,
            shadowRadius: 18,
            elevation: 4,
          }}>
            <Text style={{ fontSize: 12, color: colors.textTertiary, fontWeight: '500' }}>{stat.label}</Text>
            <Text style={{ fontSize: 26, fontWeight: 'bold', color: colors.text, marginTop: 4 }}>{stat.value}</Text>
          </View>
        ))}
      </View>

      {/* GPA Trend card */}
      <View style={{
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 18,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.72)',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 5,
      }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 14 }}>GPA Trend</Text>
        <GpaChart history={gpaHistory} maxGpa={gradeScale.maxGpa} />
      </View>

      {/* Current term */}
      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 12 }}>
        Current Term
      </Text>
      <PastQuarterSection
        label={quarterLabel(CURRENT_QUARTER)}
        qk={CURRENT_QK}
        courses={activeCourses.filter(c => getUnits(CURRENT_QK, c) > 0)}
        grades={grades}
        unitOverrides={unitOverrides}
        gradePoints={gradePoints}
        onEditGrade={setPickerCourseId}
        defaultExpanded={false}
      />

      {/* Past terms */}
      {pastQuarterItems.length > 0 && (
        <>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 12 }}>
            Past Terms
          </Text>
          {pastQuarterItems.map((item, idx) => (
            <PastQuarterSection
              key={item.label}
              label={item.label}
              qk={item.qk}
              courses={item.courses}
              grades={grades}
              unitOverrides={unitOverrides}
              gradePoints={gradePoints}
              onEditGrade={setPickerCourseId}
              defaultExpanded={false}
            />
          ))}
        </>
      )}

      {/* Grade picker modal */}
      <GradePickerModal
        visible={pickerCourseId !== null}
        current={pickerCourseId ? grades[pickerCourseId] : undefined}
        gradeOptions={gradeScale.options}
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

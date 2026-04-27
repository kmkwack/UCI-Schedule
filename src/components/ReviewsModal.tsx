import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Modal, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Linking, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { QUARTERS, quarterLabel } from '../data/courses';

type FinalExam = {
  day?: number; month?: number; bldg?: string;
  dayOfWeek?: string; examStatus?: string;
  startTime?: { hour: number; minute: number };
  endTime?: { hour: number; minute: number };
};

type CourseInfo = {
  finalExam: FinalExam | string | null;
  restrictions: string | null;
  prerequisiteLink: string | null;
  sectionComment: string | null;
};

const RESTRICTION_LABELS: Record<string, string> = {
  A: 'Prerequisite required',
  B: 'Authorization code required',
  C: 'Fee required',
  D: 'Pass/Not Pass only',
  E: 'Freshmen only',
  F: 'Sophomores only',
  G: 'Lower-division only',
  H: 'Juniors only',
  I: 'Seniors only',
  J: 'Upper-division only',
  K: 'Graduate students only',
  L: 'Majors only',
  M: 'Non-majors only',
  N: 'School majors only',
  O: 'Non-school majors only',
  R: 'Biomedical Pass/Fail',
  S: 'Satisfactory/Unsatisfactory only',
  X: 'Separate authorization codes required',
};

function decodeRestrictions(raw: string | null): string | null {
  if (!raw) return null;
  const labels = raw.toUpperCase().split('').map(c => RESTRICTION_LABELS[c] ?? c).filter(Boolean);
  return labels.length ? labels.join(' · ') : null;
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatMonthName(month?: number) {
  if (month == null || Number.isNaN(month)) return null;
  if (month >= 0 && month <= 11) return MONTH_NAMES[month];
  if (month >= 1 && month <= 12) return MONTH_NAMES[month - 1];
  return null;
}

function formatFinalExam(fe: FinalExam | string | null): string | null {
  if (!fe) return null;
  if (typeof fe === 'string') return fe;
  if (fe.examStatus === 'NO_FINAL' || fe.examStatus === 'TBA') return fe.examStatus === 'NO_FINAL' ? 'No final exam' : 'TBA';
  const parts: string[] = [];
  if (fe.dayOfWeek) parts.push(fe.dayOfWeek);
  const monthName = formatMonthName(fe.month);
  if (monthName && fe.day != null) parts.push(`${monthName} ${fe.day}`);
  const fmt = (t?: { hour: number; minute: number }) =>
    t ? `${t.hour}:${String(t.minute).padStart(2, '0')}` : null;
  const start = fmt(fe.startTime), end = fmt(fe.endTime);
  if (start && end) parts.push(`${start} – ${end}`);
  if (fe.bldg) parts.push(`@ ${fe.bldg}`);
  return parts.length ? parts.join(' · ') : null;
}

function finalExamFallback(sectionComment?: string | null): string {
  const trimmed = sectionComment?.trim() ?? '';
  if (trimmed && /final|exam/i.test(trimmed)) {
    return trimmed;
  }
  return 'Final exam details are not available in the current course data. Check WebSOC, Canvas, or your instructor for the latest final exam information.';
}

const courseInfoCache: Record<string, CourseInfo> = {};

type GradeDistribution = {
  averageGPA: number | null;
  gradeACount: number; gradeBCount: number; gradeCCount: number;
  gradeDCount: number; gradeFCount: number; gradePCount: number; gradeNPCount: number;
};

type CourseReview = {
  id: string; userId: string; author: string; rating: number; date: string;
  content: string; semester: string; quarter: string; difficulty: number; workload: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  sectionId?: string | null;
  courseCode: string;    // e.g. "ECON 100A"
  department: string;    // e.g. "ECON"
  courseNumber: string;  // e.g. "100A"
  sectionType: string;   // e.g. "Lec", "Lab", "Dis"
  title: string;
  professors: string[];  // non-STAFF professors
  school: string;
  userId: string;
  semesterLabel: string; // e.g. "Spring 2026"
  quarterKey: string;
};

export default function ReviewsModal({
  visible, onClose, sectionId, courseCode, department, courseNumber, sectionType, title,
  professors, school, userId, semesterLabel, quarterKey,
}: Props) {
  const { colors } = useTheme();
  const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(null);
  const [courseInfoLoading, setCourseInfoLoading] = useState(false);
  const [instructor, setInstructor] = useState('');
  const [gradesCache, setGradesCache] = useState<Record<string, GradeDistribution | null>>({});
  const [gradeLoading, setGradeLoading] = useState(false);
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [difficulty, setDifficulty] = useState(3);
  const [workload, setWorkload] = useState(3);
  const [content, setContent] = useState('');
  const [quarterTaken, setQuarterTaken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const writeReviewScrollRef = useRef<ScrollView>(null);
  const reviewInputRef = useRef<TextInput>(null);

  function scrollToReviewComposer(animated = true) {
    requestAnimationFrame(() => {
      setTimeout(() => {
        writeReviewScrollRef.current?.scrollToEnd({ animated });
      }, 140);
    });
  }

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setInstructor('');
      setShowWriteReview(false);
      setEditingReviewId(null);
      setRating(5); setDifficulty(3); setWorkload(3); setContent('');
      setQuarterTaken(semesterLabel);
      setCourseInfo(null);
      fetchReviews();
      fetchCourseInfo();
    }
  }, [visible, courseCode, quarterKey]);

  useEffect(() => {
    if (!visible || !showWriteReview) return;

    scrollToReviewComposer(false);
    const focusTimer = setTimeout(() => {
      scrollToReviewComposer();
      reviewInputRef.current?.focus();
    }, 220);

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const keyboardShow = Keyboard.addListener(showEvent, () => scrollToReviewComposer());

    return () => {
      clearTimeout(focusTimer);
      keyboardShow.remove();
    };
  }, [showWriteReview, visible]);

  // Fetch grade distribution
  useEffect(() => {
    if (!visible) return;
    const cacheKey = `${department}${courseNumber}${instructor}`;
    if (cacheKey in gradesCache) return;
    setGradeLoading(true);
    const params = new URLSearchParams({ department, courseNumber });
    if (instructor) params.append('instructor', instructor);
    fetch(`https://anteaterapi.com/v2/rest/grades/aggregate?${params}`)
      .then((r) => r.json())
      .then((json) => {
        setGradesCache((prev) => ({ ...prev, [cacheKey]: json?.data?.gradeDistribution ?? null }));
      })
      .catch(() => setGradesCache((prev) => ({ ...prev, [cacheKey]: null })))
      .finally(() => setGradeLoading(false));
  }, [visible, instructor]);

  async function fetchCourseInfo() {
    const rowId = sectionId ? `${sectionId}::${quarterKey}` : null;
    const cacheKey = rowId ? `${rowId}` : `${courseCode}::${quarterKey}`;
    if (courseInfoCache[cacheKey]) {
      setCourseInfo(courseInfoCache[cacheKey]);
      return;
    }
    setCourseInfoLoading(true);
    let rows: Array<{
      final_exam: FinalExam | string | null;
      restrictions: string | null;
      prerequisite_link: string | null;
      section_comment: string | null;
    }> = [];

    if (rowId) {
      const { data } = await supabase
        .from('sections')
        .select('final_exam, restrictions, prerequisite_link, section_comment')
        .eq('id', rowId)
        .limit(1);
      rows = (data ?? []) as typeof rows;
    }

    if (rows.length === 0) {
      const { data } = await supabase
        .from('sections')
        .select('final_exam, restrictions, prerequisite_link, section_comment')
        .eq('code', courseCode)
        .eq('quarter_key', quarterKey)
        .limit(25);
      rows = (data ?? []) as typeof rows;
    }

    const preferred =
      rows.find((row) => row.final_exam) ??
      rows.find((row) => row.section_comment?.trim()) ??
      rows.find((row) => row.restrictions || row.prerequisite_link) ??
      rows[0];

    const info: CourseInfo = {
      finalExam: preferred?.final_exam ?? null,
      restrictions: preferred?.restrictions ?? null,
      prerequisiteLink: preferred?.prerequisite_link ?? null,
      sectionComment: preferred?.section_comment ?? null,
    };
    courseInfoCache[cacheKey] = info;
    setCourseInfo(info);
    setCourseInfoLoading(false);
  }

  async function fetchReviews() {
    setReviewsLoading(true);
    const { data, error } = await supabase
      .from('reviews').select('*')
      .eq('school', school).eq('course_code', courseCode).eq('section_type', sectionType)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setReviews(data.map((r: any) => ({
        id: r.id, userId: r.user_id, author: r.author, rating: r.rating,
        date: r.created_at.slice(0, 10), content: r.content,
        semester: r.semester, quarter: r.quarter ?? r.semester ?? '',
        difficulty: r.difficulty, workload: r.workload,
      })));
    }
    setReviewsLoading(false);
  }

  async function handleSubmit() {
    if (!content.trim()) return;
    Keyboard.dismiss();
    setSubmitting(true);
    let error;
    if (editingReviewId) {
      ({ error } = await supabase.from('reviews').update({
        rating, difficulty, workload, content: content.trim(),
        quarter: quarterTaken || semesterLabel,
      }).eq('id', editingReviewId));
    } else {
      ({ error } = await supabase.from('reviews').insert({
        school, course_code: courseCode, department, course_number: courseNumber,
        section_type: sectionType,
        user_id: userId, author: 'Anonymous',
        rating, difficulty, workload, content: content.trim(),
        semester: semesterLabel, quarter: quarterTaken || semesterLabel,
      }));
    }
    setSubmitting(false);
    if (error) {
      Alert.alert('Could not submit review', error.message);
      console.error('Review insert error:', error);
      return;
    }
    setRating(5); setDifficulty(3); setWorkload(3); setContent(''); setQuarterTaken(semesterLabel);
    setEditingReviewId(null);
    setShowWriteReview(false);
    await fetchReviews();
  }

  function handleEdit(review: CourseReview) {
    setRating(review.rating);
    setDifficulty(review.difficulty);
    setWorkload(review.workload);
    setContent(review.content);
    setQuarterTaken(review.quarter || semesterLabel);
    setEditingReviewId(review.id);
    setShowWriteReview(true);
  }

  async function handleDelete(reviewId: string) {
    const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
    if (error) { Alert.alert('Could not delete review', error.message); return; }
    setReviews(prev => prev.filter(r => r.id !== reviewId));
  }

  const cacheKey = `${department}${courseNumber}${instructor}`;
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
  const visibleEntries = allEntries.filter((e) => !['P', 'NP'].includes(e.label) || (total > 0 && Math.round(e.count / total * 100) >= 1));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (showWriteReview) { setShowWriteReview(false); }
        else { onClose(); }
      }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.card }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
          <View style={{ flex: 1 }}>

            {/* ── Reviews list ── */}
            {!showWriteReview && (
              <>
                <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 }}>{courseCode}</Text>
                      <Text style={{ fontSize: 13, color: colors.textSecondary }}>{title}</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close" size={22} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
                  {/* Course Info — restrictions, finals, prereqs, comment */}
                  {courseInfoLoading ? (
                    <View style={{ paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color={colors.brand} />
                    </View>
                  ) : courseInfo && (() => {
                    const finalStr = formatFinalExam(courseInfo.finalExam) ?? finalExamFallback(courseInfo.sectionComment);
                    const restrictionStr = decodeRestrictions(courseInfo.restrictions);
                    const comment = courseInfo.sectionComment?.trim() || null;
                    return (
                      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle, gap: 10 }}>
                        {restrictionStr ? (
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                            <Ionicons name="lock-closed-outline" size={14} color={colors.textTertiary} style={{ marginTop: 1 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Restrictions</Text>
                              <Text style={{ fontSize: 13, color: colors.text }}>{restrictionStr}</Text>
                            </View>
                          </View>
                        ) : null}
                        {courseInfo.prerequisiteLink ? (
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                            <Ionicons name="link-outline" size={14} color={colors.textTertiary} style={{ marginTop: 1 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Prerequisites</Text>
                              <TouchableOpacity onPress={() => Linking.openURL(courseInfo.prerequisiteLink!)}>
                                <Text style={{ fontSize: 13, color: colors.brand, textDecorationLine: 'underline' }}>View prerequisites ›</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : null}
                        {finalStr ? (
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                            <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} style={{ marginTop: 1 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Final Exam</Text>
                              <Text style={{ fontSize: 13, color: colors.text }}>{finalStr}</Text>
                            </View>
                          </View>
                        ) : null}
                        {(() => {
                          const prof = instructor || professors[0] || '';
                          if (!prof || prof === 'STAFF' || prof.trim() === '') return null;
                          const lastName = prof.includes(',') ? prof.substring(0, prof.indexOf(',')) : prof;
                          const sid = school === 'UC Irvine' ? '1074' : '';
                          const url = sid
                            ? `https://www.ratemyprofessors.com/search/professors/${sid}?q=${encodeURIComponent(lastName)}`
                            : `https://www.ratemyprofessors.com/search/professors?q=${encodeURIComponent(lastName)}`;
                          return (
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                              <Ionicons name="star-outline" size={14} color={colors.textTertiary} style={{ marginTop: 1 }} />
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Rate My Professors</Text>
                                <TouchableOpacity onPress={() => Linking.openURL(url)}>
                                  <Text style={{ fontSize: 13, color: colors.brand, textDecorationLine: 'underline' }}>{prof} on RateMyProfessors ›</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })()}
                        {comment ? (
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                            <Ionicons name="information-circle-outline" size={14} color={colors.textTertiary} style={{ marginTop: 1 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Note</Text>
                              <Text style={{ fontSize: 13, color: colors.text }}>{comment}</Text>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    );
                  })()}

                  {/* Grade Distribution */}
                  <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Grade Distribution</Text>
                    {professors.length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {['', ...professors].map((p) => {
                            const isSel = instructor === p;
                            return (
                              <TouchableOpacity
                                key={p || '__all__'}
                                onPress={() => setInstructor(p)}
                                style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: isSel ? colors.brand : colors.bgTertiary, borderWidth: 1, borderColor: isSel ? colors.brand : colors.border }}
                              >
                                <Text style={{ fontSize: 12, fontWeight: '600', color: isSel ? 'white' : colors.textSecondary }}>
                                  {p === '' ? 'All Professors' : p.split(',')[0]}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </ScrollView>
                    )}
                    {gradeLoading ? (
                      <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                        <ActivityIndicator size="small" color={colors.brand} />
                      </View>
                    ) : !grades || visibleEntries.length === 0 ? (
                      <Text style={{ fontSize: 13, color: colors.textTertiary, textAlign: 'center', paddingVertical: 12 }}>No grade data available</Text>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                        <View style={{ alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandBg, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, minWidth: 72 }}>
                          <Text style={{ fontSize: 26, fontWeight: '800', color: colors.brand }}>
                            {grades.averageGPA != null ? grades.averageGPA.toFixed(2) : '—'}
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>avg GPA</Text>
                        </View>
                        <View style={{ flex: 1, gap: 5 }}>
                          {visibleEntries.map((entry) => {
                            const pct = total > 0 ? entry.count / total : 0;
                            return (
                              <View key={entry.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, width: 18, textAlign: 'right' }}>{entry.label}</Text>
                                <View style={{ flex: 1, height: 10 }}>
                                  <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: entry.color, borderRadius: 5 }} />
                                </View>
                                <Text style={{ fontSize: 11, color: colors.textSecondary, width: 34, textAlign: 'right' }}>{(pct * 100).toFixed(0)}%</Text>
                              </View>
                            );
                          })}
                          <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 2 }}>Based on {total.toLocaleString()} students · all available terms</Text>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Student reviews */}
                  <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                    {reviewsLoading ? (
                      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                        <ActivityIndicator size="small" color={colors.brand} />
                      </View>
                    ) : reviews.length === 0 ? (
                      <Text style={{ fontSize: 13, color: colors.textTertiary, textAlign: 'center', paddingVertical: 20 }}>
                        No reviews yet. Be the first to write one!
                      </Text>
                    ) : (
                      <>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                          {(() => {
                            const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
                            return (
                              <>
                                <View style={{ flexDirection: 'row', gap: 2 }}>
                                  {[1,2,3,4,5].map(i => <Ionicons key={i} name={i <= Math.round(avg) ? 'star' : 'star-outline'} size={16} color="#f59e0b" />)}
                                </View>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{avg.toFixed(1)}</Text>
                                <Text style={{ fontSize: 13, color: colors.textTertiary }}>{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</Text>
                              </>
                            );
                          })()}
                        </View>
                        {reviews.map((review) => (
                          <View key={review.id} style={{ backgroundColor: colors.bgSecondary, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                              <View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    {review.quarter ? (
                                    <View style={{ backgroundColor: colors.brandBg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.brand }}>{review.quarter}</Text>
                                    </View>
                                  ) : null}
                                </View>
                                <View style={{ flexDirection: 'row', gap: 2 }}>
                                  {[1,2,3,4,5].map(i => <Ionicons key={i} name={i <= review.rating ? 'star' : 'star-outline'} size={13} color={i <= review.rating ? '#f59e0b' : colors.border} />)}
                                </View>
                              </View>
                              <Text style={{ fontSize: 12, color: colors.textTertiary }}>{review.date}</Text>
                            </View>
                            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 8 }}>{review.content}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <View style={{ flexDirection: 'row', gap: 16 }}>
                                <Text style={{ fontSize: 12, color: colors.textTertiary }}>Difficulty: <Text style={{ fontWeight: '700', color: colors.textSecondary }}>{review.difficulty}/5</Text></Text>
                                <Text style={{ fontSize: 12, color: colors.textTertiary }}>Workload: <Text style={{ fontWeight: '700', color: colors.textSecondary }}>{review.workload}/5</Text></Text>
                              </View>
                              {review.userId === userId && (
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                  <TouchableOpacity onPress={() => handleEdit(review)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                                    <Ionicons name="pencil-outline" size={15} color={colors.brand} />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={() => Alert.alert('Delete Review', 'Are you sure you want to delete this review?', [
                                      { text: 'Cancel', style: 'cancel' },
                                      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(review.id) },
                                    ])}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  >
                                    <Ionicons name="trash-outline" size={15} color={colors.destructive} />
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                </ScrollView>

                <View style={{ paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.borderSubtle }}>
                  <TouchableOpacity
                    onPress={() => setShowWriteReview(true)}
                    style={{ backgroundColor: colors.brand, borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
                  >
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Write a Review</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ── Write review ── */}
            {showWriteReview && (
              <>
                <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity onPress={() => setShowWriteReview(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <View>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{editingReviewId ? 'Edit Review' : 'Write a Review'}</Text>
                      <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{courseCode}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  ref={writeReviewScrollRef}
                  contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 }}
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 10 }}>Quarter Taken</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {[...QUARTERS].reverse().map((q) => {
                        const label = quarterLabel(q);
                        const selected = quarterTaken === label;
                        return (
                          <TouchableOpacity
                            key={label}
                            onPress={() => setQuarterTaken(label)}
                            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: selected ? colors.brand : colors.bgTertiary, borderWidth: 1, borderColor: selected ? colors.brand : colors.border }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: '600', color: selected ? 'white' : colors.textSecondary }}>{label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>

                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 10 }}>Overall Rating</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    {[1,2,3,4,5].map(r => (
                      <TouchableOpacity key={r} onPress={() => setRating(r)}>
                        <Ionicons name={r <= rating ? 'star' : 'star-outline'} size={36} color={r <= rating ? '#f59e0b' : colors.border} />
                      </TouchableOpacity>
                    ))}
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textSecondary, marginLeft: 4 }}>{rating}/5</Text>
                  </View>

                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 10 }}>Difficulty (1 = Easy, 5 = Hard)</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                    {[1,2,3,4,5].map(l => (
                      <TouchableOpacity key={l} onPress={() => setDifficulty(l)}
                        style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: difficulty === l ? colors.brand : colors.bgTertiary }}>
                        <Text style={{ fontWeight: '700', color: difficulty === l ? 'white' : colors.textSecondary }}>{l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 10 }}>Workload (1 = Light, 5 = Heavy)</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                    {[1,2,3,4,5].map(l => (
                      <TouchableOpacity key={l} onPress={() => setWorkload(l)}
                        style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: workload === l ? colors.brand : colors.bgTertiary }}>
                        <Text style={{ fontWeight: '700', color: workload === l ? 'white' : colors.textSecondary }}>{l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 10 }}>Your Review</Text>
                  <TextInput
                    ref={reviewInputRef}
                    value={content}
                    onChangeText={setContent}
                    onFocus={() => scrollToReviewComposer()}
                    placeholder="Share your experience with this course..."
                    placeholderTextColor={colors.placeholder}
                    multiline
                    textAlignVertical="top"
                    style={{ backgroundColor: colors.inputBg, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text, minHeight: 120, marginBottom: 20 }}
                  />
                  <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={!content.trim() || submitting}
                    style={{ backgroundColor: content.trim() ? colors.brand : colors.border, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 8 }}
                  >
                    {submitting
                      ? <ActivityIndicator size="small" color="white" />
                      : <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>{editingReviewId ? 'Save Changes' : 'Submit Review'}</Text>}
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}

          </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

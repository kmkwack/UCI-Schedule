import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Modal, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';

type GradeDistribution = {
  averageGPA: number | null;
  gradeACount: number; gradeBCount: number; gradeCCount: number;
  gradeDCount: number; gradeFCount: number; gradePCount: number; gradeNPCount: number;
};

type CourseReview = {
  id: string; author: string; rating: number; date: string;
  content: string; semester: string; difficulty: number; workload: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  courseCode: string;    // e.g. "ECON 100A"
  department: string;    // e.g. "ECON"
  courseNumber: string;  // e.g. "100A"
  title: string;
  professors: string[];  // non-STAFF professors
  school: string;
  userId: string;
  semesterLabel: string; // e.g. "Spring 2026"
};

export default function ReviewsModal({
  visible, onClose, courseCode, department, courseNumber, title,
  professors, school, userId, semesterLabel,
}: Props) {
  const { colors } = useTheme();
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
  const [submitting, setSubmitting] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setInstructor('');
      setShowWriteReview(false);
      setRating(5); setDifficulty(3); setWorkload(3); setContent('');
      fetchReviews();
    }
  }, [visible, courseCode]);

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

  async function fetchReviews() {
    setReviewsLoading(true);
    const { data, error } = await supabase
      .from('reviews').select('*')
      .eq('school', school).eq('course_code', courseCode)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setReviews(data.map((r: any) => ({
        id: r.id, author: r.author, rating: r.rating,
        date: r.created_at.slice(0, 10), content: r.content,
        semester: r.semester, difficulty: r.difficulty, workload: r.workload,
      })));
    }
    setReviewsLoading(false);
  }

  async function handleSubmit() {
    if (!content.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('reviews').insert({
      school, course_code: courseCode, department, course_number: courseNumber,
      user_id: userId, author: 'Anonymous',
      rating, difficulty, workload, content: content.trim(), semester: semesterLabel,
    });
    setSubmitting(false);
    if (!error) {
      setRating(5); setDifficulty(3); setWorkload(3); setContent('');
      setShowWriteReview(false);
      await fetchReviews();
    }
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (showWriteReview) { setShowWriteReview(false); }
        else { onClose(); }
      }}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', flex: 1 }}>

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
                    ) : !grades || allEntries.length === 0 ? (
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
                          {allEntries.map((entry) => {
                            const pct = total > 0 ? entry.count / total : 0;
                            return (
                              <View key={entry.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, width: 18, textAlign: 'right' }}>{entry.label}</Text>
                                <View style={{ flex: 1, height: 10, backgroundColor: colors.bgTertiary, borderRadius: 5, overflow: 'hidden' }}>
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
                                  <Text style={{ fontWeight: '700', fontSize: 14, color: colors.text }}>{review.author}</Text>
                                  <Text style={{ fontSize: 12, color: colors.textTertiary }}>{review.semester}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 2 }}>
                                  {[1,2,3,4,5].map(i => <Ionicons key={i} name={i <= review.rating ? 'star' : 'star-outline'} size={13} color={i <= review.rating ? '#f59e0b' : colors.border} />)}
                                </View>
                              </View>
                              <Text style={{ fontSize: 12, color: colors.textTertiary }}>{review.date}</Text>
                            </View>
                            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 8 }}>{review.content}</Text>
                            <View style={{ flexDirection: 'row', gap: 16 }}>
                              <Text style={{ fontSize: 12, color: colors.textTertiary }}>Difficulty: <Text style={{ fontWeight: '700', color: colors.textSecondary }}>{review.difficulty}/5</Text></Text>
                              <Text style={{ fontSize: 12, color: colors.textTertiary }}>Workload: <Text style={{ fontWeight: '700', color: colors.textSecondary }}>{review.workload}/5</Text></Text>
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
                      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Write a Review</Text>
                      <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{courseCode}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 20 }} keyboardShouldPersistTaps="handled">
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
                    value={content}
                    onChangeText={setContent}
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
                      : <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Submit Review</Text>}
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}

          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

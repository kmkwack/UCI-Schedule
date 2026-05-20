import { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Modal, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Linking, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { getSchoolConfig, buildTermCandidates, termLabel } from '../data/schools';
import { EmptyState, SkeletonBlock } from './Polish';
import { triggerSuccessHaptic } from '../utils/haptics';

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
  prerequisiteText: string | null;
  prerequisiteSourceKnown: boolean;
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

const COLLAPSED_RESTRICTION_COUNT = 4;
const LONG_RESTRICTION_LENGTH = 120;

function decodeBasicHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function normalizeMetadataText(raw: string) {
  return decodeBasicHtmlEntities(raw)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|div)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/[•·]+/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .trim();
}

function uniqueCleanItems(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (!item || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeRestrictionItem(value: string) {
  const cleaned = value
    .replace(/^restrictions?:\s*/i, '')
    .replace(/^student\s+must\s+be\s+(?:a|an)\s+/i, '')
    .replace(/^student\s+must\s+be\s+/i, '')
    .replace(/^must\s+be\s+(?:a|an)\s+/i, '')
    .replace(/^must\s+be\s+/i, '')
    .replace(/[.;,\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : '';
}

function decodeRestrictions(raw: string | null): string[] {
  if (!raw) return [];

  const normalized = normalizeMetadataText(raw);
  const compactCode = normalized.replace(/[\s,;./|:_-]+/g, '').toUpperCase();
  const hasReadableWords = /\b[a-z]{2,}\b/.test(raw);
  const looksLikeCompactCodes = compactCode.length > 0
    && compactCode.length <= 12
    && /^[A-Z]+$/.test(compactCode)
    && !hasReadableWords;

  if (looksLikeCompactCodes) {
    return uniqueCleanItems(
      compactCode
        .split('')
        .map((code) => RESTRICTION_LABELS[code] ?? '')
        .filter(Boolean)
    );
  }

  const sentenceText = normalized
    .replace(/\s*;\s*/g, '\n')
    .replace(/\s*\.\s+/g, '.\n');

  return uniqueCleanItems(
    sentenceText
      .split(/\n+/)
      .map(normalizeRestrictionItem)
      .filter((item) => item.length > 1)
  );
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

const courseInfoCache: Record<string, CourseInfo> = {};
const uciCatalogCourseCache: Record<string, { prerequisiteText: string | null; restrictionText: string | null; prerequisiteSourceKnown: boolean }> = {};

function sectionIdLookupCandidates(sectionId?: string | null, qKey?: string) {
  const trimmed = sectionId?.trim();
  if (!trimmed) return [];
  const candidates = new Set([trimmed]);
  if (qKey && !trimmed.includes('::')) candidates.add(`${trimmed}::${qKey}`);
  return [...candidates];
}

function normalizePrerequisiteLink(link?: string | null): string | null {
  const trimmed = link?.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

function normalizePrerequisiteText(value?: string | null): string | null {
  const cleaned = normalizeMetadataText(value ?? '').replace(/[.;,\s]+$/g, '').trim();
  if (!cleaned) return null;
  if (/^(none|n\/a|no prerequisites?)$/i.test(cleaned)) return null;
  if (/^prerequisites?\s+var(?:y|ies)$/i.test(cleaned)) return 'No fixed prerequisites listed';
  return cleaned;
}

async function fetchUciCatalogCourseInfo(department: string, courseNumber: string) {
  const cacheKey = `${department}::${courseNumber}`;
  if (uciCatalogCourseCache[cacheKey]) return uciCatalogCourseCache[cacheKey];

  try {
    const params = new URLSearchParams({ department, courseNumber });
    const response = await fetch(`https://anteaterapi.com/v2/rest/courses?${params.toString()}`);
    const json = await response.json();
    const course = Array.isArray(json?.data) ? json.data[0] : null;
    const info = {
      prerequisiteText: normalizePrerequisiteText(course?.prerequisiteText),
      restrictionText: normalizeMetadataText(course?.restriction ?? '') || null,
      prerequisiteSourceKnown: Boolean(course),
    };
    uciCatalogCourseCache[cacheKey] = info;
    return info;
  } catch (_) {
    const empty = { prerequisiteText: null, restrictionText: null, prerequisiteSourceKnown: false };
    uciCatalogCourseCache[cacheKey] = empty;
    return empty;
  }
}

type GradeDistribution = {
  averageGPA: number | null;
  gradeACount: number; gradeBCount: number; gradeCCount: number;
  gradeDCount: number; gradeFCount: number; gradePCount: number; gradeNPCount: number;
};

type CourseReview = {
  id: string; userId: string; author: string; rating: number; date: string;
  content: string; semester: string; quarter: string; difficulty: number; workload: number;
};

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function oneDecimal(value: number | null) {
  return value == null ? '—' : value.toFixed(1);
}

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
  const [showAllRestrictions, setShowAllRestrictions] = useState(false);
  const [androidKeyboardInset, setAndroidKeyboardInset] = useState(0);
  const writeReviewScrollRef = useRef<ScrollView>(null);
  const reviewInputRef = useRef<TextInput>(null);
  const schoolConfig = getSchoolConfig(school);
  const supportsOfficialGradeDistribution = schoolConfig.gradeDistributionSource === 'anteaterapi';
  const reviewTermOptions = useMemo(
    () => buildTermCandidates(school, 2019, new Date().getFullYear() + 1).reverse(),
    [school]
  );

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
      setShowAllRestrictions(false);
      fetchReviews();
      fetchCourseInfo();
    }
  }, [visible, sectionId, courseCode, quarterKey, school]);

  useEffect(() => {
    if (!visible || !showWriteReview) {
      setAndroidKeyboardInset(0);
      return;
    }

    scrollToReviewComposer(false);
    const focusTimer = setTimeout(() => {
      scrollToReviewComposer();
      reviewInputRef.current?.focus();
    }, 220);

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const keyboardShow = Keyboard.addListener(showEvent, (event) => {
      setAndroidKeyboardInset(Platform.OS === 'android' ? Math.max(event.endCoordinates?.height ?? 0, 0) : 0);
      scrollToReviewComposer();
    });
    const keyboardHide = Keyboard.addListener(hideEvent, () => setAndroidKeyboardInset(0));

    return () => {
      clearTimeout(focusTimer);
      keyboardShow.remove();
      keyboardHide.remove();
    };
  }, [showWriteReview, visible]);

  // Fetch grade distribution
  useEffect(() => {
    if (!visible) return;
    const cacheKey = `${department}${courseNumber}${instructor}`;
    if (cacheKey in gradesCache) return;
    if (!supportsOfficialGradeDistribution) {
      setGradesCache((prev) => ({ ...prev, [cacheKey]: null }));
      return;
    }
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
  }, [visible, instructor, school, department, courseNumber, supportsOfficialGradeDistribution]);

  async function fetchCourseInfo() {
    const sectionCandidates = sectionIdLookupCandidates(sectionId, quarterKey);
    const cacheKey = sectionCandidates.length > 0
      ? `${school}::section::${sectionCandidates.join('|')}`
      : `${school}::course::${courseCode}::${quarterKey}`;
    if (courseInfoCache[cacheKey]) {
      setCourseInfo(courseInfoCache[cacheKey]);
      return;
    }
    let rows: Array<{
      final_exam: FinalExam | string | null;
      restrictions: string | null;
      prerequisite_link: string | null;
      section_comment: string | null;
    }> = [];
    let coursePrerequisiteLink: string | null = null;
    let catalogPrerequisiteText: string | null = null;
    let catalogRestrictionText: string | null = null;
    let prerequisiteSourceKnown = false;

    if (sectionCandidates.length > 0) {
      const { data } = await supabase
        .from('sections')
        .select('final_exam, restrictions, prerequisite_link, section_comment')
        .eq('school', school)
        .in('id', sectionCandidates)
        .limit(sectionCandidates.length);
      rows = (data ?? []) as typeof rows;
    }

    if (rows.length === 0 && sectionCandidates.length === 0) {
      const { data } = await supabase
        .from('sections')
        .select('final_exam, restrictions, prerequisite_link, section_comment')
        .eq('school', school)
        .eq('code', courseCode)
        .eq('quarter_key', quarterKey)
        .limit(25);
      rows = (data ?? []) as typeof rows;
    }

    if (sectionCandidates.length > 0 && !rows.some((row) => normalizePrerequisiteLink(row.prerequisite_link))) {
      const { data } = await supabase
        .from('sections')
        .select('prerequisite_link')
        .eq('school', school)
        .eq('code', courseCode)
        .eq('quarter_key', quarterKey)
        .not('prerequisite_link', 'is', null)
        .neq('prerequisite_link', '')
        .limit(1);
      coursePrerequisiteLink = (data?.[0] as { prerequisite_link?: string | null } | undefined)?.prerequisite_link ?? null;
    }

    if (school === 'UC Irvine') {
      const catalogInfo = await fetchUciCatalogCourseInfo(department, courseNumber);
      catalogPrerequisiteText = catalogInfo.prerequisiteText;
      catalogRestrictionText = catalogInfo.restrictionText;
      prerequisiteSourceKnown = catalogInfo.prerequisiteSourceKnown;
    }

    const preferred =
      rows.find((row) => row.final_exam) ??
      rows.find((row) => row.restrictions || row.prerequisite_link) ??
      rows[0];

    const info: CourseInfo = {
      finalExam: preferred?.final_exam ?? null,
      restrictions: preferred?.restrictions || catalogRestrictionText,
      prerequisiteLink: normalizePrerequisiteLink(preferred?.prerequisite_link) ?? normalizePrerequisiteLink(coursePrerequisiteLink),
      prerequisiteText: catalogPrerequisiteText,
      prerequisiteSourceKnown,
      sectionComment: preferred?.section_comment ?? null,
    };
    courseInfoCache[cacheKey] = info;
    setCourseInfo(info);
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
      }).eq('id', editingReviewId).eq('school', school).eq('user_id', userId));
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
    triggerSuccessHaptic();
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
    const { error } = await supabase.from('reviews').delete().eq('id', reviewId).eq('school', school).eq('user_id', userId);
    if (error) { Alert.alert('Could not delete review', error.message); return; }
    setReviews(prev => prev.filter(r => r.id !== reviewId));
    triggerSuccessHaptic();
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
  const hasGradeDistribution = Boolean(grades && visibleEntries.length > 0);
  const showGradeDistribution = true;
  const gradeDistributionTitle = instructor ? 'Professor Grade Distribution' : 'Grade Distribution for Course';
  const reviewStats = useMemo(() => ({
    rating: average(reviews.map((review) => review.rating)),
    difficulty: average(reviews.map((review) => review.difficulty)),
    workload: average(reviews.map((review) => review.workload)),
  }), [reviews]);
  const officialFinalText = courseInfo ? formatFinalExam(courseInfo.finalExam) : null;
  const hasFinalExamInfo = Boolean(officialFinalText);
  const prerequisiteLink = courseInfo?.prerequisiteLink ?? null;
  const prerequisiteText = courseInfo?.prerequisiteText ?? null;
  const prerequisiteSourceKnown = courseInfo?.prerequisiteSourceKnown === true;
  const shouldShowRestrictions = courseInfo !== null;
  const shouldShowPrerequisites = courseInfo !== null;
  const restrictionsEmptyText = schoolConfig.id === 'uci' ? 'No restrictions listed' : 'Not supported';
  const prerequisiteDisplayText = prerequisiteText ?? (prerequisiteSourceKnown && !prerequisiteLink ? 'No prerequisites' : null);
  const prerequisiteEmptyText = prerequisiteSourceKnown ? 'No prerequisites' : 'Prerequisite data is not available yet';
  const prerequisiteBodyText = prerequisiteDisplayText;
  const hasPrerequisiteInfo = Boolean(prerequisiteDisplayText || prerequisiteLink || prerequisiteSourceKnown);
  const restrictionItems = courseInfo ? decodeRestrictions(courseInfo.restrictions).filter((item) => {
    if (!hasPrerequisiteInfo) return true;
    return item.toLowerCase() !== 'prerequisite required';
  }) : [];
  const visibleRestrictionItems = showAllRestrictions
    ? restrictionItems
    : restrictionItems.slice(0, COLLAPSED_RESTRICTION_COUNT);
  const hiddenRestrictionCount = Math.max(0, restrictionItems.length - visibleRestrictionItems.length);
  const restrictionNeedsToggle = hiddenRestrictionCount > 0
    || restrictionItems.some((item) => item.length > LONG_RESTRICTION_LENGTH);
  const rmpProfessor = instructor || professors[0] || '';
  const showRmpLink = Boolean(rmpProfessor && rmpProfessor !== 'STAFF' && rmpProfessor.trim());
  const rmpLastName = rmpProfessor.includes(',') ? rmpProfessor.substring(0, rmpProfessor.indexOf(',')) : rmpProfessor;
  const rmpUrl = schoolConfig.rmpSchoolId
    ? `https://www.ratemyprofessors.com/search/professors/${schoolConfig.rmpSchoolId}?q=${encodeURIComponent(rmpLastName)}`
    : `https://www.ratemyprofessors.com/search/professors?q=${encodeURIComponent(rmpLastName)}`;
  const showCourseInfoDetails = Boolean(courseInfo && (
    shouldShowRestrictions ||
    shouldShowPrerequisites ||
    hasFinalExamInfo
  ) || showRmpLink);
  const courseInfoDividerColor = colors.border === '#374151' ? colors.border : '#d6dce8';
  const showDividerAfterRestrictions = shouldShowRestrictions && (shouldShowPrerequisites || hasFinalExamInfo || showRmpLink);
  const showDividerAfterPrerequisites = shouldShowPrerequisites && (hasFinalExamInfo || showRmpLink);
  const showDividerAfterFinalExam = hasFinalExamInfo && showRmpLink;
  const renderCourseInfoDivider = (visible: boolean) => visible ? (
    <View style={{ height: 1, marginHorizontal: 13, backgroundColor: courseInfoDividerColor }} />
  ) : null;
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
                  {showCourseInfoDetails ? (
                    <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}>
                      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.bgSecondary, overflow: 'hidden' }}>
                        {shouldShowRestrictions ? (
                          <>
                            <View style={{ padding: 13 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <View style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderSubtle }}>
                                  <Ionicons name="lock-closed-outline" size={14} color={colors.textTertiary} />
                                </View>
                                <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: colors.text }}>Restrictions</Text>
                              </View>
                              {restrictionItems.length > 0 ? (
                                <View style={{ gap: 5 }}>
                                  {visibleRestrictionItems.map((item) => (
                                    <View key={item} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textTertiary, marginTop: 7 }} />
                                      <Text
                                        style={{ flex: 1, fontSize: 13, lineHeight: 18, color: colors.text }}
                                        numberOfLines={showAllRestrictions ? undefined : 2}
                                      >
                                        {item}
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              ) : (
                                <Text style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}>{restrictionsEmptyText}</Text>
                              )}
                              {restrictionNeedsToggle ? (
                                <TouchableOpacity onPress={() => setShowAllRestrictions((current) => !current)} style={{ marginTop: 7, alignSelf: 'flex-start' }}>
                                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.brand }}>
                                    {showAllRestrictions
                                      ? 'Show less'
                                      : hiddenRestrictionCount > 0
                                        ? `Show ${hiddenRestrictionCount} more`
                                        : 'Show full text'}
                                  </Text>
                                </TouchableOpacity>
                              ) : null}
                            </View>
                            {renderCourseInfoDivider(showDividerAfterRestrictions)}
                          </>
                        ) : null}
                        {shouldShowPrerequisites ? (
                          <>
                            <View style={{ padding: 13 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <View style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderSubtle }}>
                                  <Ionicons name="git-branch-outline" size={14} color={colors.textTertiary} />
                                </View>
                                <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: colors.text }}>Prerequisites</Text>
                                {prerequisiteLink ? (
                                  <TouchableOpacity
                                    onPress={() => Linking.openURL(prerequisiteLink)}
                                    style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
                                  >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                      <Ionicons name="open-outline" size={12} color={colors.brand} />
                                      <Text style={{ fontSize: 12, fontWeight: '800', color: colors.brand }}>Open</Text>
                                    </View>
                                  </TouchableOpacity>
                                ) : null}
                              </View>
                              <Text style={{ fontSize: 13, lineHeight: 18, color: prerequisiteBodyText || prerequisiteLink ? colors.text : colors.textSecondary }}>
                                {prerequisiteBodyText ?? (prerequisiteLink ? 'Prerequisite details are available from the official course page.' : prerequisiteEmptyText)}
                              </Text>
                            </View>
                            {renderCourseInfoDivider(showDividerAfterPrerequisites)}
                          </>
                        ) : null}
                        {officialFinalText ? (
                          <>
                            <View style={{ padding: 13 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderSubtle }}>
                                  <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>Final Exam</Text>
                                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{officialFinalText}</Text>
                                </View>
                              </View>
                            </View>
                            {renderCourseInfoDivider(showDividerAfterFinalExam)}
                          </>
                        ) : null}
                        {showRmpLink ? (
                          <View style={{ padding: 13 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <View style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderSubtle }}>
                                <Ionicons name="star-outline" size={14} color={colors.textTertiary} />
                              </View>
                              <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: colors.text }}>Rate My Professors</Text>
                              <TouchableOpacity
                                onPress={() => Linking.openURL(rmpUrl)}
                                style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Ionicons name="open-outline" size={12} color={colors.brand} />
                                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.brand }}>Open</Text>
                                </View>
                              </TouchableOpacity>
                            </View>
                            <Text numberOfLines={2} ellipsizeMode="tail" style={{ fontSize: 13, lineHeight: 18, color: colors.text }}>
                              {rmpProfessor}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  ) : null}

                  {/* Grade Distribution */}
                  {showGradeDistribution ? (
                    <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Grade Distribution</Text>
                      <Text style={{ fontSize: 12, lineHeight: 17, color: colors.textSecondary, marginTop: 3, marginBottom: 10 }}>{gradeDistributionTitle}</Text>
                      {supportsOfficialGradeDistribution && professors.length > 0 && (
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
                      <View style={{ backgroundColor: colors.bgSecondary, borderRadius: 18, borderWidth: 1, borderColor: colors.borderSubtle, padding: 14 }}>
                        {!supportsOfficialGradeDistribution ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="stats-chart-outline" size={16} color={colors.textTertiary} />
                            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>
                              Grade distribution is not supported yet
                            </Text>
                          </View>
                        ) : gradeLoading ? (
                          <View style={{ gap: 10 }}>
                            <SkeletonBlock height={58} radius={16} />
                            <SkeletonBlock height={10} radius={999} />
                            <SkeletonBlock height={10} radius={999} width="82%" />
                            <SkeletonBlock height={10} radius={999} width="70%" />
                          </View>
                        ) : hasGradeDistribution ? (
                          <View style={{ gap: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                              <View style={{ alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandBg, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, minWidth: 74 }}>
                                <Text style={{ fontSize: 26, fontWeight: '800', color: colors.brand }}>
                                  {grades?.averageGPA != null ? grades.averageGPA.toFixed(2) : '—'}
                                </Text>
                                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>avg GPA</Text>
                              </View>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>Official grade history</Text>
                                <Text style={{ fontSize: 12, lineHeight: 17, color: colors.textSecondary, marginTop: 3 }}>
                                  Based on {total.toLocaleString()} students across available terms.
                                </Text>
                              </View>
                            </View>
                            <View style={{ gap: 7 }}>
                              {visibleEntries.map((entry) => {
                                const pct = total > 0 ? entry.count / total : 0;
                                return (
                                  <View key={entry.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                                    <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textSecondary, width: 20, textAlign: 'right' }}>{entry.label}</Text>
                                    <View style={{ flex: 1, height: 10, borderRadius: 999, backgroundColor: colors.card, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderSubtle }}>
                                      <View style={{ width: `${Math.max(pct * 100, 2)}%`, height: '100%', backgroundColor: entry.color, borderRadius: 999 }} />
                                    </View>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, width: 36, textAlign: 'right' }}>{(pct * 100).toFixed(0)}%</Text>
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                        ) : (
                          <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Ionicons name="stats-chart-outline" size={16} color={colors.textTertiary} />
                              <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.text }}>
                                No grade distribution available yet
                              </Text>
                            </View>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginTop: 7 }}>
                              {instructor ? 'Switch back to All Professors to view the course-wide grade distribution.' : 'ClassMate reviews can still be used below.'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ) : null}

                  {/* Student reviews */}
                  <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                    {reviewsLoading ? (
                      <View style={{ gap: 10, paddingVertical: 6 }}>
                        <SkeletonBlock height={112} radius={18} />
                        <SkeletonBlock height={82} radius={16} />
                        <SkeletonBlock height={82} radius={16} width="94%" />
                      </View>
                    ) : (
                      <>
                        <View style={{ backgroundColor: colors.brandBg, borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.borderSubtle }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase', color: colors.brand }}>Reviews</Text>
                              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 5 }}>
                                {reviews.length > 0 ? `${oneDecimal(reviewStats.rating)} student rating` : 'No reviews yet'}
                              </Text>
                              <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginTop: 5 }}>
                                {reviews.length > 0
                                  ? `${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'} from classmates who saved this course.`
                                  : 'Help the next person understand the workload, pacing, grading style, and what to watch for.'}
                              </Text>
                            </View>
                            <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
                              <Ionicons name="chatbubbles-outline" size={25} color={colors.brand} />
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                            {[
                              { label: 'Rating', value: oneDecimal(reviewStats.rating), suffix: '/5' },
                              { label: 'Difficulty', value: oneDecimal(reviewStats.difficulty), suffix: '/5' },
                              { label: 'Workload', value: oneDecimal(reviewStats.workload), suffix: '/5' },
                            ].map((item) => (
                              <View key={item.label} style={{ flex: 1, backgroundColor: colors.card, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' }}>
                                <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
                                  {item.value}<Text style={{ fontSize: 11, color: colors.textTertiary }}>{item.value === '—' ? '' : item.suffix}</Text>
                                </Text>
                                <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 2 }}>{item.label}</Text>
                              </View>
                            ))}
                          </View>
                        </View>

                        {reviews.length === 0 ? (
                          <EmptyState
                            compact
                            icon="chatbubbles-outline"
                            title="No reviews yet"
                            body="Be the first classmate to leave a practical note about workload, pacing, and grading."
                          />
                        ) : null}

                        {reviews.map((review) => (
                          <View key={review.id} style={{ backgroundColor: colors.bgSecondary, borderRadius: 16, borderWidth: 1, borderColor: colors.borderSubtle, padding: 14, marginBottom: 10 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                                    {review.quarter ? (
                                    <View style={{ backgroundColor: colors.brandBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, maxWidth: '100%' }}>
                                      <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 11, fontWeight: '700', color: colors.brand }}>{review.quarter}</Text>
                                    </View>
                                  ) : null}
                                </View>
                                <View style={{ flexDirection: 'row', gap: 2 }}>
                                  {[1,2,3,4,5].map(i => <Ionicons key={i} name={i <= review.rating ? 'star' : 'star-outline'} size={13} color={i <= review.rating ? '#f59e0b' : colors.border} />)}
                                </View>
                              </View>
                              <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 12, color: colors.textTertiary }}>{review.date}</Text>
                            </View>
                            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 8 }}>{review.content}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                              <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                {[
                                  { label: 'Difficulty', value: review.difficulty },
                                  { label: 'Workload', value: review.workload },
                                ].map((item) => (
                                  <View key={item.label} style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderSubtle }}>
                                    <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                                      {item.label} <Text style={{ fontWeight: '800', color: colors.textSecondary }}>{item.value}/5</Text>
                                    </Text>
                                  </View>
                                ))}
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
                  contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: androidKeyboardInset > 0 ? androidKeyboardInset + 36 : 36 }}
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 10 }}>Quarter Taken</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {reviewTermOptions.map((q) => {
                        const label = termLabel(q, school, false);
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

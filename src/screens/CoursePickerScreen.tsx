import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  LayoutAnimation,
  UIManager,
  Platform,
  PanResponder,
  Modal,
  Keyboard,
  Dimensions,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Course, Quarter, TimetableSettings, DEFAULT_TIMETABLE_SETTINGS, quarterKey } from '../data/courses';
import { getSchoolConfig, termLabel } from '../data/schools';
import { departmentsForSchoolId } from '../data/schoolDepartments';
import PreviewTimetable from '../components/PreviewTimetable';
import { supabase } from '../lib/supabase';
import ReviewsModal from '../components/ReviewsModal';

// GE category codes match what Anteater API stores in geCategories[]
const GE_CATEGORIES = [
  { code: 'GE-1A', label: 'GE Ia — Lower Division Writing' },
  { code: 'GE-1B', label: 'GE Ib — Upper Division Writing' },
  { code: 'GE-2',  label: 'GE II — Science and Technology' },
  { code: 'GE-3',  label: 'GE III — Social & Behavioral Sciences' },
  { code: 'GE-4',  label: 'GE IV — Arts and Humanities' },
  { code: 'GE-5A', label: 'GE Va — Quantitative Reasoning (Lower)' },
  { code: 'GE-5B', label: 'GE Vb — Quantitative Reasoning (Upper)' },
  { code: 'GE-6',  label: 'GE VI — Language Other Than English' },
  { code: 'GE-7',  label: 'GE VII — Multicultural Studies' },
  { code: 'GE-8',  label: 'GE VIII — International/Global Issues' },
];

type Props = {
  activeCourses: Course[];
  onToggleCourse: (course: Course) => void;
  onFocusCourse: (courseId: string | null) => void;
  onClose: () => void;
  selectedQuarter: Quarter;
  timetableSettings?: TimetableSettings;
  userId: string;
  school: string;
  editingCustomCourse?: Course | null;
  onReplaceCourse?: (oldId: string, newCourse: Course) => void;
  onResolveCourseConflicts?: (oldIds: string[], newCourse: Course) => void;
  onEditingHandled?: () => void;
};

type CatalogCourse = {
  id: string;
  department: string;
  courseNumber: string;
  title: string;
  units?: string;
};

const CUSTOM_DAY_OPTIONS = [
  { key: 'M', label: 'M' },
  { key: 'T', label: 'T' },
  { key: 'W', label: 'W' },
  { key: 'Th', label: 'Th' },
  { key: 'F', label: 'F' },
  { key: 'Sa', label: 'Sa' },
  { key: 'Su', label: 'Su' },
];

const DAY_FILTER_OPTIONS = [
  { key: 'M', label: 'Mon' },
  { key: 'T', label: 'Tue' },
  { key: 'W', label: 'Wed' },
  { key: 'Th', label: 'Thu' },
  { key: 'F', label: 'Fri' },
  { key: 'Sa', label: 'Sat' },
  { key: 'Su', label: 'Sun' },
];

const CUSTOM_COLOR_OPTIONS = [
  '#7C9BFF',
  '#8B5CF6',
  '#14B8A6',
  '#22C55E',
  '#F59E0B',
  '#F97316',
  '#F43F5E',
  '#64748B',
];

type CustomCourseDraft = {
  name: string;
  shortLabel: string;
  professor: string;
  location: string;
  customColor: string;
  units: string;
  startTime: string;
  endTime: string;
  selectedDays: string[];
};

const EMPTY_CUSTOM_DRAFT: CustomCourseDraft = {
  name: '',
  shortLabel: '',
  professor: '',
  location: '',
  customColor: CUSTOM_COLOR_OPTIONS[0],
  units: '',
  startTime: '',
  endTime: '',
  selectedDays: ['M', 'W', 'F'],
};

type SectionEnrollment = {
  status: string;          // "OPEN" | "Waitl" | "FULL" | "NewOnly"
  enrolled: number;
  capacity: number;
  waitlist: number;
  waitlistCap: number;
};

type ReviewSummary = {
  average: number | null;
  count: number;
};

const SECTION_SELECT_COLUMNS = 'id,code,title,department,professor,days,time,location,units,section_label';
const COURSE_PICKER_ACCENT = '#4169E1';
const COURSE_PICKER_ACCENT_SOFT = '#EEF3FF';
const COURSE_PICKER_ACCENT_BORDER = '#C7D4FF';
const departmentMemoryCache = new Map<string, string[]>();

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

function normalizeCustomTimeInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function isValidTimeInput(value: string, allow24Hour = false) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(':').map(Number);
  if (allow24Hour && hours === 24 && minutes === 0) return true;
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function buildCustomCourse(draft: CustomCourseDraft): Course {
  const trimmedName = draft.name.trim();
  const trimmedShortLabel = draft.shortLabel.trim();
  const trimmedProfessor = draft.professor.trim();
  const trimmedLocation = draft.location.trim();
  const trimmedUnits = draft.units.trim();
  const time = `${draft.startTime} - ${draft.endTime}`;
  const days = draft.selectedDays.join('');
  const shortCode = (trimmedShortLabel || trimmedName).toUpperCase();

  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    code: shortCode,
    title: trimmedName,
    professor: trimmedProfessor,
    days,
    time,
    department: 'CUSTOM',
    location: trimmedLocation || undefined,
    units: trimmedUnits ? Number(trimmedUnits) : undefined,
    sectionLabel: undefined,
    customColor: draft.customColor,
  };
}

function courseToCustomDraft(course: Course): CustomCourseDraft {
  const [startTime = '', endTime = ''] = course.time.split(' - ');
  const shortLabel = course.code !== course.title.toUpperCase() ? course.code : '';
  return {
    name: course.title,
    shortLabel,
    professor: course.professor ?? '',
    location: course.location ?? '',
    customColor: course.customColor ?? CUSTOM_COLOR_OPTIONS[0],
    units: course.units != null ? String(course.units) : '',
    startTime,
    endTime,
    selectedDays: getDaysArray(course.days),
  };
}

export default function CoursePickerScreen({
  activeCourses,
  onToggleCourse,
  onFocusCourse,
  onClose,
  selectedQuarter,
  timetableSettings = DEFAULT_TIMETABLE_SETTINGS,
  userId,
  school,
  editingCustomCourse,
  onReplaceCourse,
  onResolveCourseConflicts,
  onEditingHandled,
}: Props) {
  const insets = useSafeAreaInsets();
  const schoolConfig = getSchoolConfig(school);
  const courseAccent = COURSE_PICKER_ACCENT;
  const courseAccentSoft = COURSE_PICKER_ACCENT_SOFT;
  const courseAccentBorder = COURSE_PICKER_ACCENT_BORDER;
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
  const [searchText, setSearchText] = useState('');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [selectedGE, setSelectedGE] = useState('');
  const [selectedDayFilters, setSelectedDayFilters] = useState<string[]>([]);
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);
  const deptSheetSlideAnim = useRef(new Animated.Value(600)).current;
  const deptBackdropAnim = useRef(new Animated.Value(0)).current;
  const customizeBackdropAnim = useRef(new Animated.Value(0)).current;
  const customizeSheetAnim = useRef(new Animated.Value(600)).current;
  const customizeKeyboardAnim = useRef(new Animated.Value(0)).current;
  const closeDeptModalRef = useRef<(() => void) | null>(null);
  const deptDragPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gs) => {
      if (gs.dy > 0) deptSheetSlideAnim.setValue(gs.dy);
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > 80 || gs.vy > 0.8) {
        closeDeptModalRef.current?.();
      } else {
        Animated.spring(deptSheetSlideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 18 }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(deptSheetSlideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 18 }).start();
    },
  })).current;
  const [deptSearch, setDeptSearch] = useState('');
  const [showGESublist, setShowGESublist] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [catalogCourses, setCatalogCourses] = useState<CatalogCourse[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [expandedCourseIds, setExpandedCourseIds] = useState<Record<string, boolean>>({});
  const [sectionsMap, setSectionsMap] = useState<Record<string, Course[]>>({});
  const [previewCourse, setPreviewCourse] = useState<Course | null>(null);
  const [enrollmentCache, setEnrollmentCache] = useState<Record<string, SectionEnrollment>>({});
  const [enrollmentLoadingIds, setEnrollmentLoadingIds] = useState<Set<string>>(new Set());
  const [reviewSummaryCache, setReviewSummaryCache] = useState<Record<string, ReviewSummary>>({});
  const [savedCountCache, setSavedCountCache] = useState<Record<string, number>>({});
  const [savedByCurrentUserSectionIds, setSavedByCurrentUserSectionIds] = useState<Set<string>>(new Set());
  const [reviewsCourse, setReviewsCourse] = useState<Course | null>(null);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [customCourseDraft, setCustomCourseDraft] = useState<CustomCourseDraft>(EMPTY_CUSTOM_DRAFT);
  const editingCourseIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!editingCustomCourse) return;
    editingCourseIdRef.current = editingCustomCourse.id;
    setCustomCourseDraft(courseToCustomDraft(editingCustomCourse));
    customizeBackdropAnim.setValue(0);
    customizeSheetAnim.setValue(600);
    setShowCustomizeModal(true);
    Animated.parallel([
      Animated.spring(customizeSheetAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 16 }),
      Animated.timing(customizeBackdropAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [editingCustomCourse]);

  function openDeptModal() {
    setDeptSearch('');
    deptSheetSlideAnim.setValue(600);
    deptBackdropAnim.setValue(0);
    setDeptDropdownOpen(true);
    Animated.parallel([
      Animated.spring(deptSheetSlideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 16 }),
      Animated.timing(deptBackdropAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }

  function closeDeptModal(callback?: () => void) {
    Animated.parallel([
      Animated.timing(deptSheetSlideAnim, { toValue: 600, duration: 220, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(deptBackdropAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      setDeptDropdownOpen(false);
      setShowGESublist(false);
      callback?.();
    });
  }
  closeDeptModalRef.current = closeDeptModal;

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
        location: row.location ?? undefined,
        units: row.units ?? undefined,
        sectionLabel: row.section_label ?? undefined,
      }));
    });

    return { catalog: Object.values(catalogMap), sections };
  }

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      Animated.timing(customizeKeyboardAnim, {
        toValue: e.endCoordinates.height,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
    });
    const hide = Keyboard.addListener('keyboardWillHide', (e) => {
      setKeyboardHeight(0);
      Animated.timing(customizeKeyboardAnim, {
        toValue: 0,
        duration: (e as any).duration || 250,
        useNativeDriver: false,
      }).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  const hasSelectedDepartments = selectedDepts.length > 0;
  const hasSelectedCategory = hasSelectedDepartments || !!selectedGE;
  const shouldLoadSavedCounts = hasSelectedCategory || searchText.trim().length >= 2;
  const selectedDeptKey = selectedDepts.join('|');
  const isUciSchool = schoolConfig.id === 'uci';
  const localDepartmentOptions = useMemo(() => departmentsForSchoolId(schoolConfig.id), [schoolConfig.id]);
  const activeCourseIds = useMemo(() => new Set(activeCourses.map((course) => course.id)), [activeCourses]);
  const departmentOptions = availableDepartments.length > 0
    ? availableDepartments
    : localDepartmentOptions;

  useEffect(() => {
    const qk = quarterKey(selectedQuarter);
    let cancelled = false;
    const cachedDepartments = departmentMemoryCache.get(school);
    const instantDepartments = cachedDepartments?.length ? cachedDepartments : localDepartmentOptions;

    setAvailableDepartments(instantDepartments);

    void (async () => {
      const departmentsSet = new Set<string>(instantDepartments);
      let hasAuthoritativeDepartments = departmentsSet.size > 0;
      const { data: departmentRows, error: departmentError } = await supabase
        .from('school_departments')
        .select('department')
        .eq('school', school)
        .eq('active', true)
        .order('department', { ascending: true });

      if (cancelled) return;
      if (!departmentError && departmentRows && departmentRows.length > 0) {
        departmentRows.forEach((row: any) => {
          if (row.department) departmentsSet.add(row.department);
        });
        hasAuthoritativeDepartments = departmentsSet.size > 0;
        if (departmentsSet.size > 0) {
          const departments = [...departmentsSet].sort((a, b) => a.localeCompare(b));
          departmentMemoryCache.set(school, departments);
          setAvailableDepartments(departments);
        }
      }

      const PAGE_SIZE = 1000;
      let sectionError: any = null;
      let selectedTermDepartmentCount = 0;

      async function scanSectionDepartments(queryQuarterKey?: string) {
        let from = 0;
        while (!cancelled) {
          let query = supabase
            .from('sections')
            .select('department')
            .eq('school', school)
            .range(from, from + PAGE_SIZE - 1);

          if (queryQuarterKey) query = query.eq('quarter_key', queryQuarterKey);

          const { data, error } = await query;

          if (error) {
            sectionError = error;
            break;
          }

          (data ?? []).forEach((row: any) => {
            if (row.department) {
              departmentsSet.add(row.department);
              if (queryQuarterKey) selectedTermDepartmentCount += 1;
            }
          });

          if (!data || data.length < PAGE_SIZE) break;
          from += PAGE_SIZE;
        }
      }

      if (!hasAuthoritativeDepartments) {
        await scanSectionDepartments(qk);
      }

      // If the selected term has no rows yet, still show the school's departments
      // so the picker is not blank while the user switches to a seeded term.
      // For supported schools with local indexes, avoid scanning every historical
      // row; seeders should backfill school_departments as the long-term source.
      if (!cancelled && !hasAuthoritativeDepartments && selectedTermDepartmentCount === 0 && localDepartmentOptions.length === 0) {
        await scanSectionDepartments();
      }

      if (cancelled) return;
      if (departmentsSet.size === 0 && (departmentError || sectionError)) {
        console.warn('Failed to load departments:', departmentError ?? sectionError);
        setAvailableDepartments([]);
        return;
      }

      const departments = [...departmentsSet].sort((a, b) => a.localeCompare(b));
      departmentMemoryCache.set(school, departments);
      setAvailableDepartments(departments);
    })();

    return () => {
      cancelled = true;
    };
  }, [localDepartmentOptions, selectedQuarter, school]);

  // Global search: fires when search text >= 2 and no category selected
  useEffect(() => {
    if (hasSelectedCategory || searchText.trim().length < 2) {
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
      const baseClauses = `code.ilike.%${q}%,title.ilike.%${q}%,professor.ilike.%${q}%,id.ilike.%${q}%`;
      const orClause = qNorm !== q
        ? `${baseClauses},code.ilike.%${qNorm}%,id.ilike.%${qNorm}%`
        : baseClauses;
      const { data, error } = await supabase
        .from('sections')
        .select(SECTION_SELECT_COLUMNS)
        .eq('school', school)
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
  }, [searchText, hasSelectedCategory, selectedQuarter, school]);

  useEffect(() => {
    if (!shouldLoadSavedCounts || !userId) {
      setSavedCountCache({});
      setSavedByCurrentUserSectionIds(new Set());
      return;
    }

    const qk = quarterKey(selectedQuarter);
    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase
        .from('timetables')
        .select('user_id, courses')
        .eq('school', school)
        .eq('quarter_key', qk);

      if (cancelled) return;
      if (error) {
        console.warn('Failed to load ClassMate saved counts:', error);
        setSavedCountCache({});
        setSavedByCurrentUserSectionIds(new Set());
        return;
      }

      const sectionUsers = new Map<string, Set<string>>();
      const currentUserSectionIds = new Set<string>();
      ((data ?? []) as Array<{ user_id: string; courses: Course[] | null }>).forEach((row) => {
        const uid = row.user_id;
        const seenSections = new Set<string>();
        (row.courses ?? []).forEach((course) => {
          if (!course?.id) return;
          seenSections.add(course.id);
        });
        seenSections.forEach((sectionId) => {
          const users = sectionUsers.get(sectionId) ?? new Set<string>();
          users.add(uid);
          sectionUsers.set(sectionId, users);
          if (uid === userId) currentUserSectionIds.add(sectionId);
        });
      });

      setSavedCountCache(
        Object.fromEntries(Array.from(sectionUsers.entries()).map(([sectionId, users]) => [sectionId, users.size]))
      );
      setSavedByCurrentUserSectionIds(currentUserSectionIds);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedQuarter, school, shouldLoadSavedCounts, userId]);

  // Fetch courses from Supabase when one or more departments are selected
  useEffect(() => {
    if (!hasSelectedDepartments) {
      if (!selectedGE) {
        setCatalogCourses([]);
        setSectionsMap({});
        setExpandedCourseIds({});
        setPreviewCourse(null);
      }
      return;
    }

    setCatalogLoading(true);
    setCatalogCourses([]);
    setSectionsMap({});
    setExpandedCourseIds({});
    setPreviewCourse(null);

    const qk = quarterKey(selectedQuarter);
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('sections')
          .select(SECTION_SELECT_COLUMNS)
          .eq('school', school)
          .in('department', selectedDepts)
          .eq('quarter_key', qk)
          .order('code', { ascending: true });
        if (cancelled) return;
        if (error) { console.warn('Supabase fetch failed:', error); return; }
        const { catalog, sections } = buildCatalogFromRows(data ?? []);
        setCatalogCourses(catalog);
        setSectionsMap(sections);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasSelectedDepartments, selectedDeptKey, selectedGE, selectedQuarter, school]);

  // Fetch GE courses from Supabase when a GE category is selected
  useEffect(() => {
    if (!selectedGE) {
      if (!hasSelectedDepartments) {
        setCatalogCourses([]);
        setSectionsMap({});
        setExpandedCourseIds({});
        setPreviewCourse(null);
      }
      return;
    }

    setCatalogLoading(true);
    setCatalogCourses([]);
    setSectionsMap({});
    setExpandedCourseIds({});
    setPreviewCourse(null);

    const qk = quarterKey(selectedQuarter);
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('sections')
          .select(SECTION_SELECT_COLUMNS)
          .eq('school', school)
          .eq('quarter_key', qk)
          .contains('ge_categories', [selectedGE]);
        if (cancelled) return;
        if (error) { console.warn('GE fetch failed:', error); return; }
        const { catalog, sections } = buildCatalogFromRows(data ?? []);
        setCatalogCourses(catalog);
        setSectionsMap(sections);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedGE, hasSelectedDepartments, selectedQuarter, school]);

  const fetchEnrollment = async (course: CatalogCourse) => {
    if (schoolConfig.id !== 'uci') return;
    if (enrollmentLoadingIds.has(course.id)) return;
    // Check if all sections for this course are already cached
    const sections = (isGlobalSearch ? globalSectionsMap : sectionsMap)[course.id] ?? [];
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

  const fetchReviewSummary = async (courseCode: string, sectionType: string) => {
    const cacheKey = `${courseCode}::${sectionType}`;
    if (reviewSummaryCache[cacheKey]?.count) return;

    const { data, error } = await supabase
      .from('reviews')
      .select('rating')
      .eq('school', school)
      .eq('course_code', courseCode)
      .eq('section_type', sectionType);

    if (error) {
      console.warn('Failed to load ClassMate review summary:', error);
      setReviewSummaryCache((prev) => ({ ...prev, [cacheKey]: { average: null, count: 0 } }));
      return;
    }

    const ratings = ((data ?? []) as Array<{ rating: number | null }>)
      .map((row) => Number(row.rating))
      .filter((value) => Number.isFinite(value));

    setReviewSummaryCache((prev) => ({
      ...prev,
      [cacheKey]: {
        average: ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null,
        count: ratings.length,
      },
    }));
  };

  const handleExpandCourse = (course: CatalogCourse) => {
    const nextExpanded = !expandedCourseIds[course.id];
    if (nextExpanded) {
      LayoutAnimation.configureNext({
        duration: 280,
        create: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.opacity },
        update: { type: LayoutAnimation.Types.easeOut },
        delete: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.opacity },
      });
    } else {
      LayoutAnimation.configureNext({
        duration: 280,
        create: { type: LayoutAnimation.Types.easeIn, property: LayoutAnimation.Properties.opacity },
        update: { type: LayoutAnimation.Types.easeIn },
        delete: { type: LayoutAnimation.Types.easeIn, property: LayoutAnimation.Properties.opacity },
      });
    }
    setExpandedCourseIds((prev) => {
      const next = { ...prev };
      if (nextExpanded) next[course.id] = true;
      else delete next[course.id];
      return next;
    });
    if (nextExpanded) {
      fetchEnrollment(course);
      const activeSections = (isGlobalSearch ? globalSectionsMap : sectionsMap)[course.id] ?? [];
      const courseCode = `${course.department} ${course.courseNumber}`.trim();
      const sectionTypes = [...new Set(activeSections.map(s => s.sectionLabel?.split(' ')[0]).filter((t): t is string => !!t))];
      for (const st of sectionTypes) void fetchReviewSummary(courseCode, st);
    }
    setPreviewCourse(null);
  };

  const visibleSavedCountForSection = (sectionId: string) => {
    const cachedCount = savedCountCache[sectionId] ?? 0;
    const wasSavedByCurrentUser = savedByCurrentUserSectionIds.has(sectionId);
    const isCurrentlySaved = activeCourseIds.has(sectionId);
    return Math.max(
      0,
      cachedCount
        + (isCurrentlySaved && !wasSavedByCurrentUser ? 1 : 0)
        - (!isCurrentlySaved && wasSavedByCurrentUser ? 1 : 0)
    );
  };

  const getConflicts = (candidate: Course) => {
    if (candidate.time === 'TBA' || candidate.days === 'TBA') return [];
    const candidateDays = getDaysArray(candidate.days);
    const candidateStart = getCourseStartHour(candidate.time);
    const candidateEnd = getCourseEndHour(candidate.time);

    return activeCourses.filter((existing) => {
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
    const isAdded = activeCourseIds.has(course.id);
    if (isAdded) {
      onToggleCourse(course);
      onFocusCourse(null);
      setPreviewCourse(null);
      return;
    }

    const conflictCourses = getConflicts(course);
    if (conflictCourses.length > 0) {
      const conflictLabel = conflictCourses.length === 1
        ? `'${conflictCourses[0].title}'`
        : `${conflictCourses.length} existing classes`;
      Alert.alert(
        'Add subject',
        `This schedule conflicts with ${conflictLabel}. The existing ${conflictCourses.length === 1 ? 'class' : 'classes'} will be removed from your timetable if you add this. Add this subject?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add',
            onPress: () => {
              if (onResolveCourseConflicts) {
                onResolveCourseConflicts(conflictCourses.map((conflict) => conflict.id), course);
              } else if (onReplaceCourse && conflictCourses.length === 1) {
                onReplaceCourse(conflictCourses[0].id, course);
              } else {
                onToggleCourse(course);
              }
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

  const resetCustomCourseDraft = () => {
    setCustomCourseDraft(EMPTY_CUSTOM_DRAFT);
  };

  const openCustomizeModal = () => {
    resetCustomCourseDraft();
    customizeBackdropAnim.setValue(0);
    customizeSheetAnim.setValue(600);
    customizeKeyboardAnim.setValue(0);
    setShowCustomizeModal(true);
    Animated.parallel([
      Animated.spring(customizeSheetAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 16 }),
      Animated.timing(customizeBackdropAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  };

  const closeCustomizeModal = () => {
    Animated.parallel([
      Animated.timing(customizeSheetAnim, { toValue: 600, duration: 220, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(customizeBackdropAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      setShowCustomizeModal(false);
      if (editingCourseIdRef.current) {
        editingCourseIdRef.current = null;
        onEditingHandled?.();
      }
    });
  };

  const confirmCloseCustomizeModal = () => {
    const { name, shortLabel, professor, location, units, startTime, endTime } = customCourseDraft;
    const hasInput = [name, shortLabel, professor, location, units, startTime, endTime].some((v) => v.trim() !== '');
    if (!hasInput) { closeCustomizeModal(); return; }
    Alert.alert(
      'Discard block?',
      'Changes will not be saved.',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: closeCustomizeModal },
      ]
    );
  };

  const toggleCustomDay = (dayKey: string) => {
    setCustomCourseDraft((prev) => {
      const exists = prev.selectedDays.includes(dayKey);
      const nextDays = exists
        ? prev.selectedDays.filter((day) => day !== dayKey)
        : [...prev.selectedDays, dayKey].sort(
            (a, b) =>
              CUSTOM_DAY_OPTIONS.findIndex((option) => option.key === a) -
              CUSTOM_DAY_OPTIONS.findIndex((option) => option.key === b)
          );
      return { ...prev, selectedDays: nextDays };
    });
  };

  const toggleDayFilter = (dayKey: string) => {
    setSelectedDayFilters((prev) => {
      const exists = prev.includes(dayKey);
      if (exists) return prev.filter((day) => day !== dayKey);
      return [...prev, dayKey].sort(
        (a, b) =>
          DAY_FILTER_OPTIONS.findIndex((option) => option.key === a) -
          DAY_FILTER_OPTIONS.findIndex((option) => option.key === b)
      );
    });
  };

  const sectionMatchesDayFilter = (course: Course) => {
    if (selectedDayFilters.length === 0) return true;
    if (course.days === 'TBA') return false;
    const courseDays = getDaysArray(course.days);
    return selectedDayFilters.some((day) => courseDays.includes(day));
  };

  const handleCreateCustomCourse = () => {
    const trimmedName = customCourseDraft.name.trim();
    if (!trimmedName) {
        Alert.alert('Missing name', 'Add a name for your custom block.');
      return;
    }
    if (customCourseDraft.selectedDays.length === 0) {
      Alert.alert('Missing days', 'Choose at least one day for this class.');
      return;
    }
    if (!isValidTimeInput(customCourseDraft.startTime) || !isValidTimeInput(customCourseDraft.endTime, true)) {
      Alert.alert('Invalid time', 'Use 24-hour time in HH:MM format. End time can be 24:00.');
      return;
    }
    if (parseHour(customCourseDraft.endTime) <= parseHour(customCourseDraft.startTime)) {
      Alert.alert('Invalid range', 'End time needs to be later than the start time.');
      return;
    }

    Keyboard.dismiss();
    const customCourse = buildCustomCourse(customCourseDraft);
    closeCustomizeModal();

    const oldId = editingCourseIdRef.current;
    if (oldId && onReplaceCourse) {
      onReplaceCourse(oldId, { ...customCourse, id: oldId });
      editingCourseIdRef.current = null;
      onEditingHandled?.();
    } else {
      handleAddToTable(customCourse);
      setPreviewCourse(customCourse);
    }

    resetCustomCourseDraft();
  };

  const isGlobalSearch = !hasSelectedCategory && searchText.trim().length >= 2;

  const filteredCatalog = useMemo(() => {
    const stripH = (s: string) => s.replace(/^H/i, '');
    const shouldGroupByDepartment = isGlobalSearch || selectedDepts.length > 1;
    const sortCatalog = (list: CatalogCourse[]) =>
      [...list].sort((a, b) => {
        if (shouldGroupByDepartment && a.department !== b.department)
          return a.department.localeCompare(b.department);
        const numA = parseInt(stripH(a.courseNumber)) || 0;
        const numB = parseInt(stripH(b.courseNumber)) || 0;
        if (numA !== numB) return numA - numB;
        const suffixA = stripH(a.courseNumber).replace(/^\d+/, '');
        const suffixB = stripH(b.courseNumber).replace(/^\d+/, '');
        return suffixA.localeCompare(suffixB);
      });

    const activeSectionsMap = isGlobalSearch ? globalSectionsMap : sectionsMap;
    const applyDayFilter = (list: CatalogCourse[]) => {
      if (selectedDayFilters.length === 0) return list;
      return list.filter((course) => (activeSectionsMap[course.id] ?? []).some(sectionMatchesDayFilter));
    };

    if (isGlobalSearch) return sortCatalog(applyDayFilter(globalCatalog));

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
            s.professor.toLowerCase().includes(q) ||
            s.id.toLowerCase().includes(q)
          );
        });

    return sortCatalog(applyDayFilter(list));
  }, [catalogCourses, searchText, sectionsMap, isGlobalSearch, globalCatalog, globalSectionsMap, selectedDayFilters, selectedDepts.length]);

  const filteredDepts = useMemo(() => {
    if (!deptSearch) return departmentOptions;
    const q = deptSearch.toLowerCase();
    return departmentOptions.filter((d) => d.toLowerCase().includes(q));
  }, [departmentOptions, deptSearch]);

  const filteredGECategories = useMemo(() => {
    if (!deptSearch) return GE_CATEGORIES;
    const q = deptSearch.toLowerCase();
    return GE_CATEGORIES.filter((g) => g.label.toLowerCase().includes(q) || g.code.toLowerCase().includes(q));
  }, [deptSearch]);

  const selectedGELabel = selectedGE ? GE_CATEGORIES.find((g) => g.code === selectedGE)?.label ?? selectedGE : '';
  const selectedCategorySummary = hasSelectedDepartments
    ? selectedDepts.length === 1
      ? selectedDepts[0]
      : `${selectedDepts.length} departments selected`
    : selectedGELabel;

  const clearSelectedCategory = () => {
    setSelectedDepts([]);
    setSelectedGE('');
    setCatalogCourses([]);
    setSectionsMap({});
    setExpandedCourseIds({});
    setPreviewCourse(null);
  };

  const toggleSelectedDept = (dept: string) => {
    setSelectedGE('');
    setSelectedDepts((prev) => {
      const exists = prev.includes(dept);
      if (exists) return prev.filter((item) => item !== dept);
      return [...prev, dept].sort((a, b) => departmentOptions.indexOf(a) - departmentOptions.indexOf(b));
    });
    setExpandedCourseIds({});
    setPreviewCourse(null);
  };

  const removeSelectedDept = (dept: string) => {
    setSelectedDepts((prev) => prev.filter((item) => item !== dept));
    setExpandedCourseIds({});
    setPreviewCourse(null);
  };

  const customFieldLabelStyle = {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 5,
  } as const;

  const customInputStyle = {
    height: 42,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 0,
    color: '#111827',
    fontSize: 14,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: '#f7f8fa', paddingTop: 54 }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
        }}
      >
        <TouchableOpacity onPress={onClose} style={{ width: 44, height: 36, justifyContent: 'center', zIndex: 1 }}>
          <Text style={{ color: '#111827', fontSize: 30 }}>×</Text>
        </TouchableOpacity>

        <Text
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            textAlign: 'center',
            fontWeight: '700',
            fontSize: 15,
            color: '#374151',
          }}
        >
          {termLabel(selectedQuarter, school, true)}
        </Text>

        <TouchableOpacity
          onPress={openCustomizeModal}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 999,
            backgroundColor: courseAccentSoft,
            borderWidth: 1,
            borderColor: courseAccentBorder,
            zIndex: 1,
          }}
        >
          <Text style={{ color: courseAccent, fontSize: 12, fontWeight: '700' }}>Customize</Text>
        </TouchableOpacity>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 14, paddingHorizontal: 14, marginBottom: 10 }}>
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search title, code (e.g. ECON 100A), or professor"
              placeholderTextColor="#9ca3af"
              style={{ flex: 1, color: '#111827', paddingVertical: 12 }}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>

          {/* Department / GE dropdown */}
          <TouchableOpacity
            onPress={() => { Keyboard.dismiss(); openDeptModal(); }}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: hasSelectedCategory ? courseAccentSoft : '#f3f4f6',
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 13,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: hasSelectedCategory ? courseAccent : '#e5e7eb',
            }}
          >
            <Text
              numberOfLines={1}
              style={{ flex: 1, color: hasSelectedCategory ? courseAccent : '#9ca3af', fontSize: 15, fontWeight: hasSelectedCategory ? '600' : '400' }}
            >
              {selectedCategorySummary || 'Department or GE category…'}
            </Text>
            <Text style={{ color: '#9ca3af', fontSize: 12 }}>▼</Text>
          </TouchableOpacity>

          <View style={{ marginBottom: 10 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
              {selectedDepts.map((dept) => (
                <TouchableOpacity
                  key={dept}
                  onPress={() => removeSelectedDept(dept)}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    maxWidth: 210,
                    paddingLeft: 12,
                    paddingRight: 9,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: courseAccentSoft,
                    borderWidth: 1,
                    borderColor: courseAccent,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{ flexShrink: 1, fontSize: 12, fontWeight: '700', color: courseAccent }}
                  >
                    {dept}
                  </Text>
                  <Ionicons name="close" size={14} color={courseAccent} />
                </TouchableOpacity>
              ))}
              {!!selectedGELabel && (
                <TouchableOpacity
                  onPress={clearSelectedCategory}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    maxWidth: 210,
                    paddingLeft: 12,
                    paddingRight: 9,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: courseAccentSoft,
                    borderWidth: 1,
                    borderColor: courseAccent,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{ flexShrink: 1, fontSize: 12, fontWeight: '700', color: courseAccent }}
                  >
                    {selectedGELabel}
                  </Text>
                  <Ionicons name="close" size={14} color={courseAccent} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setSelectedDayFilters([])}
                activeOpacity={0.8}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: selectedDayFilters.length === 0 ? courseAccent : '#f3f4f6',
                  borderWidth: 1,
                  borderColor: selectedDayFilters.length === 0 ? courseAccent : '#e5e7eb',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: selectedDayFilters.length === 0 ? 'white' : '#6b7280' }}>
                  Any day
                </Text>
              </TouchableOpacity>
              {DAY_FILTER_OPTIONS.map((day) => {
                const selected = selectedDayFilters.includes(day.key);
                return (
                  <TouchableOpacity
                    key={day.key}
                    onPress={() => toggleDayFilter(day.key)}
                    activeOpacity={0.8}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: selected ? courseAccentSoft : '#f3f4f6',
                      borderWidth: 1,
                      borderColor: selected ? courseAccent : '#e5e7eb',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: selected ? courseAccent : '#6b7280' }}>
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Department / GE picker modal */}
          <Modal
            visible={deptDropdownOpen}
            animationType="none"
            transparent
            onRequestClose={() => closeDeptModal()}
          >
            <Animated.View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: deptBackdropAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.3)'] }) }}>
              <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => closeDeptModal()} />
              <Animated.View style={{ backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, maxHeight: keyboardHeight > 0 ? Dimensions.get('window').height - keyboardHeight - 60 : Dimensions.get('window').height * 0.7, marginBottom: Math.max(0, keyboardHeight - 34), transform: [{ translateY: deptSheetSlideAnim }] }}>

                {/* Drag handle */}
                <View style={{ alignItems: 'center', paddingBottom: 8, marginTop: -4 }} {...deptDragPan.panHandlers}>
                  <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#d1d5db' }} />
                </View>

                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
                  {showGESublist ? (
                    <TouchableOpacity onPress={() => { setShowGESublist(false); setDeptSearch(''); }} style={{ marginRight: 10 }}>
                      <Ionicons name="chevron-back" size={22} color="#111827" />
                    </TouchableOpacity>
                  ) : null}
                  <Text style={{ flex: 1, fontSize: 17, fontWeight: '700' }}>
                    {showGESublist ? 'GE Categories' : 'Department filters'}
                  </Text>
                  {hasSelectedCategory && (
                    <TouchableOpacity onPress={clearSelectedCategory} style={{ marginRight: 14 }}>
                      <Text style={{ fontSize: 14, color: '#9ca3af', fontWeight: '700' }}>Clear</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => closeDeptModal()}>
                    <Text style={{ fontSize: 14, color: courseAccent, fontWeight: '800' }}>Done</Text>
                  </TouchableOpacity>
                </View>

                {/* Search bar */}
                <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 12, paddingHorizontal: 14 }}>
                    <TextInput
                      value={deptSearch}
                      onChangeText={setDeptSearch}
                      placeholder={showGESublist ? 'Search GE categories…' : 'Search departments…'}
                      placeholderTextColor="#9ca3af"
                      style={{ flex: 1, paddingVertical: 10, fontSize: 15 }}
                    />
                    {deptSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setDeptSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={18} color="#9ca3af" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {showGESublist ? (
                  /* GE sub-list */
                  <FlatList
                    data={filteredGECategories}
                    keyExtractor={(item) => item.code}
                    extraData={selectedGE}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
                    renderItem={({ item: ge }) => {
                      const isSelected = selectedGE === ge.code;
                      return (
                        <TouchableOpacity
                          onPress={() => { Keyboard.dismiss(); closeDeptModal(() => { setSelectedGE(ge.code); setSelectedDepts([]); setDeptSearch(''); }); }}
                          style={{
                            paddingVertical: 14,
                            borderBottomWidth: 1,
                            borderBottomColor: '#f3f4f6',
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ fontSize: 15, color: isSelected ? courseAccent : '#111827', fontWeight: isSelected ? '700' : '400' }}>
                            {ge.label}
                          </Text>
                          {isSelected && <Ionicons name="checkmark" size={18} color={courseAccent} />}
                        </TouchableOpacity>
                      );
                    }}
                  />
                ) : (
                  /* Main dept list with single GE row at top */
                  <FlatList
                    data={filteredDepts}
                    keyExtractor={(item) => `dept-${item}`}
                    extraData={`${selectedDeptKey}|${selectedGE}`}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
                    ListHeaderComponent={
                      <>
                        <TouchableOpacity
                          onPress={() => { Keyboard.dismiss(); closeDeptModal(clearSelectedCategory); }}
                          style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                          <Text style={{ fontSize: 15, color: !hasSelectedCategory ? courseAccent : '#111827', fontWeight: !hasSelectedCategory ? '700' : '400' }}>
                            All Departments
                          </Text>
                          {!hasSelectedCategory && <Ionicons name="checkmark" size={18} color={courseAccent} />}
                        </TouchableOpacity>
                        {isUciSchool && !deptSearch && (
                          <TouchableOpacity
                          onPress={() => { Keyboard.dismiss(); setShowGESublist(true); setDeptSearch(''); }}
                          style={{
                            paddingVertical: 14,
                            borderTopWidth: 1,
                            borderTopColor: '#e5e7eb',
                            borderBottomWidth: 1,
                            borderBottomColor: '#e5e7eb',
                            marginBottom: 4,
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ fontSize: 15, color: selectedGE ? courseAccent : '#111827', fontWeight: selectedGE ? '700' : '500' }}>
                            {selectedGE ? GE_CATEGORIES.find(g => g.code === selectedGE)?.label : 'GE Categories'}
                          </Text>
                          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                        </TouchableOpacity>
                        )}
                      </>
                    }
                    renderItem={({ item }) => {
                      const isSelected = selectedDepts.includes(item);
                      return (
                        <TouchableOpacity
                          onPress={() => { Keyboard.dismiss(); toggleSelectedDept(item); }}
                          style={{
                            paddingVertical: 14,
                            borderBottomWidth: 1,
                            borderBottomColor: '#f3f4f6',
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ fontSize: 15, color: isSelected ? courseAccent : '#111827', fontWeight: isSelected ? '700' : '400' }}>
                            {item}
                          </Text>
                          {isSelected && <Ionicons name="checkmark" size={18} color={courseAccent} />}
                        </TouchableOpacity>
                      );
                    }}
                  />
                )}
              </Animated.View>
            </Animated.View>
          </Modal>
        </View>

        {/* Content */}
        {!hasSelectedCategory && !isGlobalSearch ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 }}>
            <Ionicons name="search-outline" size={32} color="#d1d5db" style={{ marginBottom: 10 }} />
            <Text style={{ color: '#9ca3af', fontSize: 15, textAlign: 'center', paddingHorizontal: 24 }}>
              Search by course name, code, or professor — or select departments below
            </Text>
          </View>
        ) : filteredCatalog.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 }}>
            <Text style={{ color: '#9ca3af', fontSize: 15 }}>
              {(catalogLoading && hasSelectedCategory) || (globalSearchLoading && isGlobalSearch)
                ? 'Courses will appear here'
                : 'No courses found'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredCatalog}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
            renderItem={({ item }) => {
              const isExpanded = !!expandedCourseIds[item.id];
              const activeSectionsMap = isGlobalSearch ? globalSectionsMap : sectionsMap;
              const sections = (activeSectionsMap[item.id] ?? []).filter(sectionMatchesDayFilter);

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
                          {selectedDayFilters.length > 0
                            ? 'No sections match selected days'
                            : `No sections found for ${termLabel(selectedQuarter, school, true)}`}
                        </Text>
                      ) : (
                        sections.map((course) => {
                          const isAdded = activeCourseIds.has(course.id);
                          const isPreviewing = previewCourse?.id === course.id;
                          const enroll = enrollmentCache[course.id];
                          const sectionType = course.sectionLabel?.split(' ')[0] ?? '';
                          const reviewSummary = reviewSummaryCache[`${item.department} ${item.courseNumber}::${sectionType}`.trim()] ?? { average: null, count: 0 };
                          const savedCount = visibleSavedCountForSection(course.id);
                          const statusColor = !enroll ? '#9ca3af'
                            : enroll.status === 'OPEN' ? '#16a34a'
                            : enroll.status === 'Waitl' ? '#d97706'
                            : '#dc2626';
                          const statusLabel = !enroll ? null
                            : enroll.status === 'OPEN' ? 'Open'
                            : enroll.status === 'Waitl' ? 'Waitlist'
                            : enroll.status === 'NewOnly' ? 'New Only'
                            : 'Full';
                          const enrollmentLabel = enroll
                            ? `${enroll.enrolled}/${enroll.capacity} enrolled`
                            : null;
                          const waitlistLabel = enroll?.status === 'Waitl'
                            ? `${enroll.waitlist}/${enroll.waitlistCap} waitlist`
                            : null;

                          return (
                            <TouchableOpacity
                              key={course.id}
                              activeOpacity={0.85}
                              onPress={() => setPreviewCourse(isPreviewing ? null : course)}
                              style={{
                                backgroundColor: isPreviewing ? courseAccentSoft : '#f9fafb',
                                borderRadius: 12,
                                paddingHorizontal: 10,
                                paddingVertical: 8,
                                marginBottom: 6,
                                borderWidth: 1,
                                borderColor: isPreviewing ? courseAccent : '#f3f4f6',
                              }}
                            >
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <View style={{ flex: 1 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                    <Text style={{ fontWeight: '600', fontSize: 13, color: '#111827' }}>
                                      {course.id} · {course.sectionLabel ?? course.id}
                                    </Text>
                                    {statusLabel && (
                                      <View style={{ backgroundColor: `${statusColor}18`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor }}>{statusLabel}</Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text style={{ color: '#4b5563', fontSize: 12, marginTop: 1 }}>
                                    {course.professor}
                                  </Text>
                                  <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 1 }}>
                                    {[course.days, course.time, course.location].filter(Boolean).join(' · ')}
                                  </Text>
                                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 }}>
                                    {enrollmentLabel ? (
                                      <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 4,
                                        borderRadius: 999,
                                        backgroundColor: '#eef2f7',
                                        paddingHorizontal: 8,
                                        paddingVertical: 4,
                                      }}>
                                        <Ionicons name="person-outline" size={11} color="#64748b" />
                                        <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '700' }}>
                                          {enrollmentLabel}
                                        </Text>
                                      </View>
                                    ) : null}
                                    {waitlistLabel ? (
                                      <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 4,
                                        borderRadius: 999,
                                        backgroundColor: '#fff7ed',
                                        paddingHorizontal: 8,
                                        paddingVertical: 4,
                                      }}>
                                        <Ionicons name="time-outline" size={11} color="#d97706" />
                                        <Text style={{ color: '#d97706', fontSize: 10, fontWeight: '700' }}>
                                          {waitlistLabel}
                                        </Text>
                                      </View>
                                    ) : null}
                                    <View style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 4,
                                      borderRadius: 999,
                                      backgroundColor: courseAccentSoft,
                                      paddingHorizontal: 8,
                                      paddingVertical: 4,
                                    }}>
                                      <Ionicons name="people-outline" size={11} color={courseAccent} />
                                      <Text style={{ color: courseAccent, fontSize: 10, fontWeight: '800' }}>
                                        {savedCount} saved
                                      </Text>
                                    </View>
                                  </View>
                                </View>

                                <View style={{ alignItems: 'flex-end', justifyContent: 'flex-start', alignSelf: 'stretch', gap: 6 }}>
                                  <TouchableOpacity
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      handleAddToTable(course);
                                    }}
                                    style={{
                                      backgroundColor: isAdded ? '#e5e7eb' : '#ef4444',
                                      paddingHorizontal: 11,
                                      paddingVertical: 5,
                                      borderRadius: 999,
                                      alignSelf: 'flex-end',
                                    }}
                                  >
                                    <Text style={{ color: isAdded ? '#374151' : 'white', fontWeight: '700', fontSize: 13 }}>
                                      {isAdded ? 'Remove' : 'Add'}
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      setReviewsCourse(course);
                                    }}
                                    style={{
                                      paddingHorizontal: 10, paddingVertical: 5,
                                      borderRadius: 999, backgroundColor: courseAccent,
                                      alignSelf: 'flex-end',
                                    }}
                                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                                  >
                                    <Text style={{ fontSize: 11, color: 'white', fontWeight: '600' }}>Reviews</Text>
                                  </TouchableOpacity>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-end' }}>
                                    <Ionicons name="star" size={11} color="#f59e0b" />
                                    <Text style={{ color: '#6b7280', fontSize: 10 }}>
                                      {reviewSummary.average == null
                                        ? 'No ratings yet'
                                        : `${reviewSummary.average.toFixed(1)} (${reviewSummary.count})`}
                                    </Text>
                                  </View>
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
          sectionId={reviewsCourse.id}
          courseCode={reviewsCourse.code}
          department={reviewsCourse.department}
          courseNumber={reviewsCourse.code.slice(reviewsCourse.department.length).trim()}
          sectionType={reviewsCourse.sectionLabel?.split(' ')[0] ?? 'Lec'}
          title={reviewsCourse.title}
          professors={[...new Set(
            [reviewsCourse.professor].filter((p): p is string => !!p && !p.includes('STAFF'))
          )]}
          school={school}
          userId={userId}
          semesterLabel={termLabel(selectedQuarter, school)}
          quarterKey={quarterKey(selectedQuarter)}
        />
      )}

      <Modal
        visible={showCustomizeModal}
        animationType="none"
        transparent
        onRequestClose={confirmCloseCustomizeModal}
      >
        <Animated.View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: customizeBackdropAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0)', 'rgba(15,23,42,0.28)'] }) }}>
          <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} activeOpacity={1} onPress={confirmCloseCustomizeModal} />
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <Animated.View
            style={{
              backgroundColor: 'white',
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: Math.max(insets.bottom + 8, 18),
              maxHeight: Dimensions.get('window').height * 0.9,
              transform: [{ translateY: customizeSheetAnim }],
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Customize Block</Text>
                <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>
                  Add any custom class, event, shift, or study block.
                </Text>
              </View>
              <TouchableOpacity onPress={confirmCloseCustomizeModal}>
                <Text style={{ fontSize: 26, color: '#9ca3af' }}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              <View style={{ gap: 8 }}>
                <View>
                  <TextInput
                    value={customCourseDraft.name}
                    onChangeText={(value) => setCustomCourseDraft((prev) => ({ ...prev, name: value }))}
                    placeholder="Club Meeting"
                    placeholderTextColor="#9ca3af"
                    clearButtonMode="while-editing"
                    style={customInputStyle}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={customFieldLabelStyle}>Short Label</Text>
                    <TextInput
                      value={customCourseDraft.shortLabel}
                      onChangeText={(value) => setCustomCourseDraft((prev) => ({ ...prev, shortLabel: value }))}
                      placeholder="Optional"
                      placeholderTextColor="#9ca3af"
                      clearButtonMode="while-editing"
                      style={customInputStyle}
                    />
                  </View>
                  <View style={{ width: 92 }}>
                    <Text style={customFieldLabelStyle}>Units</Text>
                    <TextInput
                      value={customCourseDraft.units}
                      onChangeText={(value) =>
                        setCustomCourseDraft((prev) => ({ ...prev, units: value.replace(/[^0-9.]/g, '').slice(0, 4) }))
                      }
                      placeholder="Optional"
                      placeholderTextColor="#9ca3af"
                      keyboardType="decimal-pad"
                      style={customInputStyle}
                    />
                  </View>
                </View>

                <View>
                  <Text style={customFieldLabelStyle}>Days</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
                    {CUSTOM_DAY_OPTIONS.map((option) => {
                      const isSelected = customCourseDraft.selectedDays.includes(option.key);
                      return (
                        <TouchableOpacity
                          key={option.key}
                          onPress={() => toggleCustomDay(option.key)}
                          style={{
                            minWidth: 36,
                            paddingHorizontal: 0,
                            paddingVertical: 7,
                            borderRadius: 11,
                            backgroundColor: isSelected ? courseAccent : '#f3f4f6',
                            borderWidth: 1,
                            borderColor: isSelected ? courseAccent : '#e5e7eb',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 1,
                          }}
                        >
                          <Text style={{ color: isSelected ? 'white' : '#4b5563', fontWeight: '700', fontSize: 11 }}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View>
                  <Text style={customFieldLabelStyle}>Color</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
                    {CUSTOM_COLOR_OPTIONS.map((color) => {
                      const isSelected = customCourseDraft.customColor === color;
                      return (
                        <TouchableOpacity
                          key={color}
                          onPress={() => setCustomCourseDraft((prev) => ({ ...prev, customColor: color }))}
                          style={{
                            width: 27,
                            height: 27,
                            borderRadius: 999,
                            backgroundColor: color,
                            borderWidth: isSelected ? 3 : 1.5,
                            borderColor: isSelected ? '#111827' : 'rgba(255,255,255,0.9)',
                            shadowColor: color,
                            shadowOpacity: isSelected ? 0.28 : 0.14,
                            shadowRadius: isSelected ? 8 : 5,
                            shadowOffset: { width: 0, height: 3 },
                            elevation: isSelected ? 4 : 2,
                          }}
                        />
                      );
                    })}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={customFieldLabelStyle}>Start Time</Text>
                    <TextInput
                      value={customCourseDraft.startTime}
                      onChangeText={(value) =>
                        setCustomCourseDraft((prev) => ({ ...prev, startTime: normalizeCustomTimeInput(value) }))
                      }
                      placeholder="13:00"
                      placeholderTextColor="#9ca3af"
                      keyboardType="number-pad"
                      maxLength={5}
                      style={customInputStyle}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={customFieldLabelStyle}>End Time</Text>
                    <TextInput
                      value={customCourseDraft.endTime}
                      onChangeText={(value) =>
                        setCustomCourseDraft((prev) => ({ ...prev, endTime: normalizeCustomTimeInput(value) }))
                      }
                      placeholder="14:20"
                      placeholderTextColor="#9ca3af"
                      keyboardType="number-pad"
                      maxLength={5}
                      style={customInputStyle}
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={customFieldLabelStyle}>Location</Text>
                    <TextInput
                      value={customCourseDraft.location}
                      onChangeText={(value) => setCustomCourseDraft((prev) => ({ ...prev, location: value }))}
                      placeholder="Optional"
                      placeholderTextColor="#9ca3af"
                      clearButtonMode="while-editing"
                      style={customInputStyle}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={customFieldLabelStyle}>Instructor</Text>
                    <TextInput
                      value={customCourseDraft.professor}
                      onChangeText={(value) => setCustomCourseDraft((prev) => ({ ...prev, professor: value }))}
                      placeholder="Optional"
                      placeholderTextColor="#9ca3af"
                      clearButtonMode="while-editing"
                      style={customInputStyle}
                    />
                  </View>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleCreateCustomCourse}
                style={{
                  marginTop: 10,
                  marginBottom: 0,
                  backgroundColor: courseAccent,
                  borderRadius: 14,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: 'white', fontSize: 15, fontWeight: '800' }}>Add Custom Block</Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </View>
  );
}

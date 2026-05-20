import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Keyboard, KeyboardAvoidingView, LayoutAnimation, PanResponder, Platform, TextInput, UIManager, View, Text, TouchableOpacity, ScrollView, Modal, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Course, Quarter, Timetable, TimetableTheme, TimetableSettings, quarterKey, formatCourseTimeRange12, formatHourLabel12, getBlockColors, normalizeTimetableTheme, professorDisplayName, professorIsKnown, blockColorKey, colorForCourse, vividColorForCourse } from '../data/courses';
import { buildTermCandidates, getSchoolConfig, schoolCampusLabel, termLabel, termOrderValue } from '../data/schools';
import { getCampusMapLocation, isUnmappableLocation, type CampusMapLocation } from '../data/campusLocations';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import ReviewsModal from '../components/ReviewsModal';
import ErrorScreen from '../components/ErrorScreen';
import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';
import MapView, { Marker } from 'react-native-maps';
import { triggerSuccessHaptic } from '../utils/haptics';
import {
  HORIZONTAL_SWIPE_ACTIVATION_DX,
  HORIZONTAL_SWIPE_DOMINANCE_RATIO,
  MOTION,
  SHEET_DRAG_DISMISS_DISTANCE,
  SHEET_DRAG_DISMISS_VELOCITY,
  SHEET_CORNER_RADIUS,
  SHEET_INITIAL_TRANSLATE_Y,
} from '../utils/motion';

function rmpUrl(professor: string, school: string) {
  const sid = getSchoolConfig(school).rmpSchoolId;
  const lastName = professor.includes(',') ? professor.substring(0, professor.indexOf(',')) : professor;
  return sid
    ? `https://www.ratemyprofessors.com/search/professors/${sid}?q=${encodeURIComponent(lastName)}`
    : `https://www.ratemyprofessors.com/search/professors?q=${encodeURIComponent(lastName)}`;
}

function mapSearchUrl(location: string, school: string) {
  const campusHint = schoolCampusLabel(school);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${campusHint} ${location}`)}`;
}

function appleMapsUrl(location: string, school: string) {
  const campusHint = schoolCampusLabel(school);
  return `maps://?q=${encodeURIComponent(`${campusHint} ${location}`)}`;
}

function appleMapsCoordinateUrl(location: CampusMapLocation) {
  return `maps://?ll=${location.latitude},${location.longitude}&q=${encodeURIComponent(location.name)}`;
}

function cleanLocationText(value: string | null | undefined) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function comparableLocationText(value: string | null | undefined) {
  return cleanLocationText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isGenericCampusLocation(value: string | null | undefined, school: string) {
  const cleaned = cleanLocationText(value);
  if (!cleaned) return true;
  if (/(online|remote|virtual)/i.test(cleaned)) return false;

  const normalized = comparableLocationText(cleaned);
  if (!normalized) return true;
  if (['tba', 'to be announced', 'arranged', 'none', 'n/a'].includes(normalized)) return true;
  if (/\bcampus$/.test(normalized)) return true;

  const config = getSchoolConfig(school);
  const phrases = [
    school,
    config.name,
    config.shortName,
    config.campus,
    config.location,
    ...config.location.split(',').map((part) => part.trim()),
  ];
  let remainder = normalized;
  [...new Set(phrases.map(comparableLocationText).filter((phrase) => phrase.length > 1))]
    .sort((a, b) => b.length - a.length)
    .forEach((phrase) => {
      remainder = remainder.replace(new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'g'), ' ');
    });
  remainder = remainder
    .replace(/\b(main|campus|online|remote|virtual|university|college|institute|school|state|of|the|at|and)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return !remainder;
}

function displayCourseLocation(value: string | null | undefined, school: string) {
  const cleaned = cleanLocationText(value);
  if (!cleaned || isGenericCampusLocation(cleaned, school)) return undefined;
  return cleaned;
}

function parseHexColor(hex: string) {
  const cleaned = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  return {
    r: parseInt(cleaned.slice(0, 2), 16),
    g: parseInt(cleaned.slice(2, 4), 16),
    b: parseInt(cleaned.slice(4, 6), 16),
  };
}

function mixTimetableHex(colorA: string, colorB: string, ratio: number) {
  const a = parseHexColor(colorA);
  const b = parseHexColor(colorB);
  if (!a || !b) return colorA;
  const toHex = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
  return `#${toHex(a.r + (b.r - a.r) * ratio)}${toHex(a.g + (b.g - a.g) * ratio)}${toHex(a.b + (b.b - a.b) * ratio)}`;
}

function alphaTimetableHex(color: string, alpha: number) {
  const rgb = parseHexColor(color);
  if (!rgb) return color;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

function getTimetableBlockColors(course: Course, themeInput: TimetableTheme | string, isDark: boolean) {
  const theme = normalizeTimetableTheme(themeInput);
  if (!isDark) return getBlockColors(course, theme);

  const accent = course.customColor
    ?? (theme === 'colorful' ? vividColorForCourse(blockColorKey(course)) : colorForCourse(blockColorKey(course)));

  if (theme === 'minimal') {
    return { bg: '#1f2937', text: '#e5e7eb', border: '#374151' };
  }

  if (theme === 'colorful') {
    return {
      bg: mixTimetableHex(accent, '#0f172a', 0.24),
      text: '#ffffff',
      border: mixTimetableHex(accent, '#000000', 0.18),
    };
  }

  if (theme === 'outline') {
    return {
      bg: alphaTimetableHex(accent, 0.1),
      text: mixTimetableHex(accent, '#ffffff', 0.48),
      border: alphaTimetableHex(accent, 0.58),
    };
  }

  return {
    bg: alphaTimetableHex(accent, theme === 'soft' ? 0.18 : 0.24),
    text: mixTimetableHex(accent, '#ffffff', 0.55),
    border: alphaTimetableHex(accent, theme === 'soft' ? 0.36 : 0.46),
  };
}

async function openMaps(location: string, school: string, mappedLocation?: CampusMapLocation | null) {
  const appleUrl = mappedLocation ? appleMapsCoordinateUrl(mappedLocation) : appleMapsUrl(location, school);
  const fallbackUrl = mapSearchUrl(location, school);

  try {
    await Linking.openURL(appleUrl);
    return;
  } catch (error) {
    console.warn('Apple Maps open failed, falling back to web maps:', error);
  }

  try {
    await Linking.openURL(fallbackUrl);
    return;
  } catch (error) {
    console.warn('Map fallback open failed:', error);
  }

  Alert.alert('Could not open Maps', 'Maps is unavailable on this device right now.');
}

type Props = {
  activeCourses: Course[];
  selectedQuarter: Quarter;
  focusedCourseId: string | null;
  onFocusCourse: (courseId: string) => void;
  onChangeQuarter: (q: Quarter) => void;
  onOpenCoursePicker: () => void;
  onRemoveCourse: (course: Course) => void;
  onEditCustomCourse?: (course: Course) => void;
  school: string;
  userId: string;
  quarterTimetables: Timetable[];
  activeTimetableId: string | null;
  onSelectTimetable: (id: string) => void;
  timetables: Timetable[];
  onCreateTimetable: () => void;
  onDeleteTimetable: () => void;
  onReorderTimetables: (orderedIds: string[]) => void;
  onAddQuarter: (q: Quarter) => void;
  settings: TimetableSettings;
  onSettingsApply: (s: TimetableSettings) => void;
  topInset?: number;
  bottomInset?: number;
  scrollToTopTrigger?: number;
};

type CourseDiscordLinkRow = {
  id: string;
  school: string;
  quarter_key: string;
  course_code: string;
  course_title: string | null;
  discord_url: string;
  submitted_by: string;
  created_at: string;
  updated_at: string;
};

type ScheduleShareFormat = 'story' | 'square' | 'clean';

const SHARE_FORMATS: {
  key: ScheduleShareFormat;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    key: 'story',
    label: 'Instagram Story',
    description: 'Open Instagram with a 9:16 schedule image.',
    icon: 'logo-instagram',
  },
  {
    key: 'square',
    label: 'Instagram Post',
    description: 'Open Instagram with a square feed image.',
    icon: 'logo-instagram',
  },
  {
    key: 'clean',
    label: 'More Sharing Options',
    description: 'Use AirDrop, Messages, Files, or other apps.',
    icon: 'share-outline',
  },
];

function courseDiscordKey(quarterKeyValue: string, courseCode: string) {
  return `${quarterKeyValue}:${courseCode}`;
}

function normalizeDiscordInviteUrl(input: string) {
  const raw = input.trim();
  if (!raw) return null;
  const withoutQuery = raw.split(/[?#]/)[0];
  const match = withoutQuery.match(/^(?:https?:\/\/)?(?:www\.)?(?:discord\.gg\/|discord(?:app)?\.com\/invite\/)([A-Za-z0-9-]{2,64})\/?$/i);
  if (!match?.[1]) return null;
  return `https://discord.gg/${match[1]}`;
}

async function openDiscordInvite(url: string) {
  try {
    await Linking.openURL(url);
  } catch (error) {
    console.warn('Discord invite open failed:', error);
    Alert.alert('Could not open Discord', 'This Discord invite could not be opened on this device.');
  }
}

const seededQuartersCacheBySchool: Record<string, Set<string>> = {};

async function loadSeededQuarterKeys(school: string) {
  const seededKeys = new Set<string>();

  const { data, error } = await supabase
    .from('school_terms')
    .select('quarter_key, section_count')
    .eq('school', school)
    .gt('section_count', 0);

  if (error) console.warn('Failed to load seeded quarters from school_terms:', error);
  (data ?? []).forEach((row: any) => {
    if (row.quarter_key) seededKeys.add(row.quarter_key);
  });

  return seededKeys;
}

async function prefetchSeededQuarters(school: string) {
  if (seededQuartersCacheBySchool[school]) return;
  seededQuartersCacheBySchool[school] = await loadSeededQuarterKeys(school);
}

const DEFAULT_DAYS = ['M', 'T', 'W', 'Th', 'F'];
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 17;

const TIME_LABEL_WIDTH = 36;
const EXPORT_TIME_LABEL_WIDTH = 32;
const GRID_LEFT_PAD = 16;
const GRID_OUTER_HORIZONTAL_PADDING = 30;

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
  return formatHourLabel12(hour);
}

function getProfLastName(professor: string) {
  const displayName = professorDisplayName(professor);
  if (!professorIsKnown(displayName)) return displayName;
  const last = professor.split(',')[0].trim();
  if (!last) return displayName;
  return last.charAt(0).toUpperCase() + last.slice(1).toLowerCase();
}

export default function TimetableScreen({
  activeCourses,
  selectedQuarter,
  focusedCourseId,
  onFocusCourse,
  onChangeQuarter,
  onOpenCoursePicker,
  onRemoveCourse,
  onEditCustomCourse,
  school,
  userId,
  quarterTimetables,
  activeTimetableId,
  onSelectTimetable,
  timetables,
  onCreateTimetable,
  onDeleteTimetable,
  onReorderTimetables,
  onAddQuarter,
  settings,
  onSettingsApply,
  topInset = 0,
  bottomInset = 0,
  scrollToTopTrigger = 0,
}: Props) {
  const { colors, isDark } = useTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const screenWidthRef = useRef(screenWidth);
  useEffect(() => { screenWidthRef.current = screenWidth; }, [screenWidth]);
  const pickerTermLabel = (term: Quarter) => termLabel(term, school, false);
  const [gridWidth, setGridWidth] = useState(
    Math.max(0, screenWidth - GRID_LEFT_PAD - GRID_OUTER_HORIZONTAL_PADDING)
  );
  const timetableScrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (scrollToTopTrigger > 0) timetableScrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scrollToTopTrigger]);

  useEffect(() => { prefetchSeededQuarters(school); }, [school]);
  const [showQuarterDropdown, setShowQuarterDropdown] = useState(false);
  const quarterDropdownAnim = useRef(new Animated.Value(0)).current;
  const quarterItemAnims = useRef<Animated.Value[]>([]);

  const sortedQuarterKeys = useMemo(() => {
    return Array.from(new Set([quarterKey(selectedQuarter), ...timetables.map((t) => t.quarterKey)]))
      .sort((a, b) => {
        const [aYear, aQ] = a.split('-');
        const [bYear, bQ] = b.split('-');
        if (bYear !== aYear) return Number(bYear) - Number(aYear);
        return termOrderValue(bQ, school) - termOrderValue(aQ, school);
      });
  }, [school, selectedQuarter, timetables]);

  while (quarterItemAnims.current.length < sortedQuarterKeys.length) {
    quarterItemAnims.current.push(new Animated.Value(0));
  }

  function openQuarterDropdown() {
    setShowQuarterDropdown(true);
    quarterDropdownAnim.setValue(1);
    quarterItemAnims.current.forEach((v) => v.setValue(0));
    Animated.stagger(45, sortedQuarterKeys.map((_, i) =>
      Animated.spring(quarterItemAnims.current[i], { toValue: 1, useNativeDriver: true, tension: 260, friction: 22 })
    )).start();
  }

  function closeQuarterDropdown() {
    Animated.timing(quarterDropdownAnim, { toValue: 0, duration: MOTION.duration.contentFast, easing: MOTION.easing.exit, useNativeDriver: true }).start(() => {
      setShowQuarterDropdown(false);
    });
  }
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuAnim = useRef(new Animated.Value(0)).current;
  const addMenuItemAnims = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  function openAddMenu() {
    setShowAddMenu(true);
    addMenuAnim.setValue(0);
    addMenuItemAnims.forEach((v) => v.setValue(0));
    Animated.stagger(45, addMenuItemAnims.map((v) =>
      Animated.spring(v, { toValue: 1, useNativeDriver: true, tension: 260, friction: 22 })
    )).start();
    Animated.timing(addMenuAnim, { toValue: 1, duration: 120, useNativeDriver: true }).start();
  }

  function closeAddMenu() {
    Animated.timing(addMenuAnim, { toValue: 0, duration: MOTION.duration.contentFast, easing: MOTION.easing.exit, useNativeDriver: true })
      .start(() => setShowAddMenu(false));
  }

  const [showAddQuarterModal, setShowAddQuarterModal] = useState(false);
  const [addableQuarters, setAddableQuarters] = useState<Quarter[]>([]);
  const [selectedAddYear, setSelectedAddYear] = useState<string | null>(null); // drives header
  const [mountedYear, setMountedYear] = useState<string | null>(null); // keeps quarter list alive during slide-out
  const addYearSlideAnim = useRef(new Animated.Value(screenWidth)).current;
  const addSheetSlideAnim = useRef(new Animated.Value(SHEET_INITIAL_TRANSLATE_Y)).current;
  const addBackdropAnim = useRef(new Animated.Value(0)).current;
  const settingsBackdropAnim = useRef(new Animated.Value(0)).current;
  const settingsSheetAnim = useRef(new Animated.Value(SHEET_INITIAL_TRANSLATE_Y)).current;
  const closeAddQuarterModalRef = useRef<(() => void) | null>(null);
  const addQuarterDragPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gs) => {
      if (gs.dy > 0) addSheetSlideAnim.setValue(gs.dy);
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > SHEET_DRAG_DISMISS_DISTANCE || gs.vy > SHEET_DRAG_DISMISS_VELOCITY) {
        closeAddQuarterModalRef.current?.();
      } else {
        Animated.spring(addSheetSlideAnim, { toValue: 0, useNativeDriver: true, ...MOTION.spring.sheetReset }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(addSheetSlideAnim, { toValue: 0, useNativeDriver: true, ...MOTION.spring.sheetReset }).start();
    },
  })).current;
  const closeSettingsRef = useRef<(() => void) | null>(null);
  const settingsDragPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gs) => {
      if (gs.dy > 0) settingsSheetAnim.setValue(gs.dy);
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > SHEET_DRAG_DISMISS_DISTANCE || gs.vy > SHEET_DRAG_DISMISS_VELOCITY) {
        closeSettingsRef.current?.();
      } else {
        Animated.spring(settingsSheetAnim, { toValue: 0, useNativeDriver: true, ...MOTION.spring.sheetReset }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(settingsSheetAnim, { toValue: 0, useNativeDriver: true, ...MOTION.spring.sheetReset }).start();
    },
  })).current;
  const contentHeightAnim = useRef(new Animated.Value(260)).current;
  const yearListHeightRef = useRef(0);
  const QUARTER_ROW_H = 53;

  function calcListHeight(count: number) {
    return Math.min(360, count * QUARTER_ROW_H);
  }

  function closeAddQuarterModal() {
    Animated.parallel([
      Animated.timing(addSheetSlideAnim, { toValue: SHEET_INITIAL_TRANSLATE_Y, duration: MOTION.duration.sheetOut, easing: MOTION.easing.exit, useNativeDriver: true }),
      Animated.timing(addBackdropAnim, { toValue: 0, duration: MOTION.duration.sheetOut, easing: MOTION.easing.exit, useNativeDriver: true }),
    ]).start(() => {
      setSelectedAddYear(null);
      addYearSlideAnim.setValue(screenWidthRef.current);
      setMountedYear(null);
      setShowAddQuarterModal(false);
    });
  }
  closeAddQuarterModalRef.current = closeAddQuarterModal;

  function drillIntoYear(year: string) {
    const count = addableQuarters.filter((q) => q.year === year).length;
    const targetH = calcListHeight(count);
    setSelectedAddYear(year);
    setMountedYear(year);
    addYearSlideAnim.setValue(screenWidthRef.current);
    Animated.parallel([
      Animated.spring(addYearSlideAnim, { toValue: 0, useNativeDriver: true, ...MOTION.spring.sheet }),
      Animated.spring(contentHeightAnim, { toValue: targetH, useNativeDriver: false, ...MOTION.spring.sheet }),
    ]).start();
  }

  function drillBackToYears() {
    setSelectedAddYear(null); // header switches to "Select Year" immediately
    Animated.parallel([
      Animated.timing(addYearSlideAnim, { toValue: screenWidthRef.current, duration: MOTION.duration.sheetOut, easing: MOTION.easing.exit, useNativeDriver: true }),
      Animated.spring(contentHeightAnim, { toValue: yearListHeightRef.current, useNativeDriver: false, ...MOTION.spring.sheet }),
    ]).start(() => setMountedYear(null)); // quarter list unmounts only after slide-out finishes
  }

  const drillBackRef = useRef(drillBackToYears);
  drillBackRef.current = drillBackToYears;

  const addQuarterSwipePan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) => gs.dx > HORIZONTAL_SWIPE_ACTIVATION_DX && Math.abs(gs.dx) > Math.abs(gs.dy) * HORIZONTAL_SWIPE_DOMINANCE_RATIO,
    onPanResponderMove: (_, gs) => {
      if (gs.dx > 0) addYearSlideAnim.setValue(gs.dx);
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dx > screenWidthRef.current * 0.35 || gs.vx > 0.6) {
        drillBackRef.current();
      } else {
        Animated.spring(addYearSlideAnim, { toValue: 0, useNativeDriver: true, ...MOTION.spring.sheet }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(addYearSlideAnim, { toValue: 0, useNativeDriver: true, ...MOTION.spring.sheet }).start();
    },
  })).current;

  const [showSettings, setShowSettings] = useState(false);
  const [showShareFormatModal, setShowShareFormatModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<ScheduleShareFormat>('clean');
  const [sharingFormat, setSharingFormat] = useState<ScheduleShareFormat | null>(null);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [reviewsCourse, setReviewsCourse] = useState<Course | null>(null);
  const [courseDiscordLinks, setCourseDiscordLinks] = useState<Record<string, CourseDiscordLinkRow | null>>({});
  const [discordLinkLoadingKey, setDiscordLinkLoadingKey] = useState<string | null>(null);
  const [discordLinkCourse, setDiscordLinkCourse] = useState<Course | null>(null);
  const [discordInviteInput, setDiscordInviteInput] = useState('');
  const [discordInviteError, setDiscordInviteError] = useState<string | null>(null);
  const [savingDiscordLink, setSavingDiscordLink] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const skipDetailAnimRef = useRef(false);

  // Pending settings (in the modal, before Apply is tapped)
  const [pendingTheme, setPendingTheme] = useState<TimetableTheme>('pastel');
  const [pendingShowCode, setPendingShowCode] = useState(true);
  const [pendingShowClassName, setPendingShowClassName] = useState(true);
  const [pendingShowRoomNumber, setPendingShowRoomNumber] = useState(true);
  const [pendingShowInstructor, setPendingShowInstructor] = useState(true);
  const [pendingShowTime, setPendingShowTime] = useState(true);

  const { showCode, showClassName, showRoomNumber, showInstructor, showTime } = settings;
  const blockTheme = normalizeTimetableTheme(settings.theme);

  const exportCaptureRef = useRef<View>(null);
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const localOrderRef = useRef<string[]>([]);
  const dragIdRef = useRef<string | null>(null);
  const dragTranslate = useRef(new Animated.Value(0)).current;
  const dragScaleAnim = useRef(new Animated.Value(1)).current;
  const pillXPos = useRef<Record<string, number>>({});
  const pillWidthRef = useRef<Record<string, number>>({});
  const dragOriginalFlexX = useRef(0);
  const onReorderTimetablesRef = useRef(onReorderTimetables);
  useEffect(() => { onReorderTimetablesRef.current = onReorderTimetables; }, [onReorderTimetables]);

  // Enable LayoutAnimation on Android
  if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);
  const scheduledCourses = useMemo(
    () => activeCourses.filter((course) => course.time !== 'TBA' && course.days !== 'TBA'),
    [activeCourses]
  );

  const tbaCourses = useMemo(
    () => activeCourses.filter((course) => course.time === 'TBA' || course.days === 'TBA'),
    [activeCourses]
  );

  const selectedQuarterKey = quarterKey(selectedQuarter);
  const selectedCourseDiscordKey = selectedCourse && selectedCourse.department !== 'CUSTOM'
    ? courseDiscordKey(selectedQuarterKey, selectedCourse.code)
    : null;

  useEffect(() => {
    if (!selectedCourse || !selectedCourseDiscordKey) return;
    if (Object.prototype.hasOwnProperty.call(courseDiscordLinks, selectedCourseDiscordKey)) return;

    const discordKey = selectedCourseDiscordKey;
    const courseCode = selectedCourse.code;
    let cancelled = false;
    setDiscordLinkLoadingKey(discordKey);

    async function loadDiscordLink() {
      try {
        const { data, error } = await supabase
          .from('course_discord_links')
          .select('id, school, quarter_key, course_code, course_title, discord_url, submitted_by, created_at, updated_at')
          .eq('school', school)
          .eq('quarter_key', selectedQuarterKey)
          .eq('course_code', courseCode)
          .maybeSingle();

        if (cancelled) return;
        if (error) {
          if (error.code !== 'PGRST205') console.warn('Failed to load course Discord link:', error);
          setCourseDiscordLinks((current) => ({ ...current, [discordKey]: null }));
          return;
        }
        setCourseDiscordLinks((current) => ({
          ...current,
          [discordKey]: (data as CourseDiscordLinkRow | null) ?? null,
        }));
      } finally {
        if (!cancelled) {
          setDiscordLinkLoadingKey((current) => (current === discordKey ? null : current));
        }
      }
    }

    void loadDiscordLink();

    return () => {
      cancelled = true;
    };
  }, [courseDiscordLinks, school, selectedCourse, selectedCourseDiscordKey, selectedQuarterKey]);

  function openDiscordLinkModal(course: Course) {
    setDiscordInviteInput('');
    setDiscordInviteError(null);
    setSelectedCourse(null);
    setTimeout(() => {
      setDiscordLinkCourse(course);
    }, Platform.OS === 'ios' ? 320 : 0);
  }

  function closeDiscordLinkModal() {
    if (savingDiscordLink) return;
    setDiscordLinkCourse(null);
    setDiscordInviteInput('');
    setDiscordInviteError(null);
  }

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  async function saveDiscordLink() {
    if (!discordLinkCourse) return;
    const normalizedUrl = normalizeDiscordInviteUrl(discordInviteInput);
    if (!normalizedUrl) {
      setDiscordInviteError('Use a Discord invite link like discord.gg/your-class.');
      return;
    }
    setDiscordInviteError(null);

    const qKey = quarterKey(selectedQuarter);
    const linkKey = courseDiscordKey(qKey, discordLinkCourse.code);
    setSavingDiscordLink(true);

    const { data, error } = await supabase
      .from('course_discord_links')
      .insert({
        school,
        quarter_key: qKey,
        course_code: discordLinkCourse.code,
        course_title: discordLinkCourse.title,
        discord_url: normalizedUrl,
        submitted_by: userId,
      })
      .select('id, school, quarter_key, course_code, course_title, discord_url, submitted_by, created_at, updated_at')
      .single();

    setSavingDiscordLink(false);

    if (error) {
      if (error.code === '23505') {
        const { data: existing } = await supabase
          .from('course_discord_links')
          .select('id, school, quarter_key, course_code, course_title, discord_url, submitted_by, created_at, updated_at')
          .eq('school', school)
          .eq('quarter_key', qKey)
          .eq('course_code', discordLinkCourse.code)
          .maybeSingle();
        if (existing) {
          setCourseDiscordLinks((current) => ({ ...current, [linkKey]: existing as CourseDiscordLinkRow }));
        }
        Alert.alert('Discord link already exists', 'Another student already added a Discord invite for this class.');
        closeDiscordLinkModal();
        return;
      }

      Alert.alert(
        'Could not save Discord link',
        error.code === 'PGRST205'
          ? 'The course_discord_links table is missing. Run supabase/sql/course_discord_links.sql first.'
          : error.message
      );
      return;
    }

    setCourseDiscordLinks((current) => ({ ...current, [linkKey]: data as CourseDiscordLinkRow }));
    closeDiscordLinkModal();
  }

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
  const timetableHeight = 64 * totalHours;
  const hourHeight = timetableHeight / totalHours;
  const hourLabels = Array.from({ length: totalHours }, (_, i) => displayStartHour + i);
  const hourBoundaries = Array.from({ length: totalHours + 1 }, (_, i) => displayStartHour + i);

  const usableGridWidth =
    gridWidth > 0
      ? gridWidth + GRID_LEFT_PAD
      : screenWidth - GRID_OUTER_HORIZONTAL_PADDING;

  const timeColumnWidth = Math.min(TIME_LABEL_WIDTH, usableGridWidth * 0.13);
  const dayColumnWidth = (usableGridWidth - timeColumnWidth) / visibleDays.length;
  const compactGrid = visibleDays.length >= 6 || totalHours >= 11;
  const codeFontSize = compactGrid ? 9 : 10;
  const metaFontSize = compactGrid ? 8 : 9;
  const timeFontSize = compactGrid ? 7 : 8;
  const exportSnapshotWidth = exportFormat === 'clean' ? Math.min(screenWidth - 28, 420) : 390;
  const exportCanvasHeight = exportFormat === 'story'
    ? Math.round(exportSnapshotWidth * 16 / 9)
    : exportFormat === 'square'
      ? exportSnapshotWidth
      : undefined;
  const exportOuterPadding = exportFormat === 'clean' ? 14 : exportFormat === 'story' ? 18 : 14;
  const exportCardPadding = exportFormat === 'square' ? 13 : 16;
  const exportHeaderMargin = exportFormat === 'square' ? 10 : 14;
  const exportAvailableGridHeight = exportFormat === 'story'
    ? 366
    : exportFormat === 'square'
      ? 158
      : screenHeight * 0.5;
  // outer padding, card padding, card border, and grid border are removed from the capture width.
  const exportUsableGridWidth = (
    exportSnapshotWidth -
    exportOuterPadding * 2 -
    exportCardPadding * 2 -
    4
  );
  const exportTimeColumnWidth = Math.min(EXPORT_TIME_LABEL_WIDTH, exportUsableGridWidth * 0.12);
  const exportDayColumnWidth = (exportUsableGridWidth - exportTimeColumnWidth) / visibleDays.length;
  const exportHourHeight = Math.max(
    exportFormat === 'square' ? 18 : 22,
    Math.min(exportFormat === 'square' ? 26 : 34, exportAvailableGridHeight / Math.max(totalHours, 1))
  );
  const exportTimetableHeight = exportHourHeight * totalHours;
  const exportCompactGrid = visibleDays.length >= 6 || totalHours >= 9;
  const exportCodeFontSize = exportCompactGrid ? 8 : 9;
  const exportMetaFontSize = exportCompactGrid ? 7 : 8;
  const exportTimeFontSize = exportCompactGrid ? 6 : 7;

  // Sync localOrder from props (skip while dragging), always sorted by order field
  useEffect(() => {
    if (!dragIdRef.current) {
      const o = [...quarterTimetables].sort((a, b) => a.order - b.order).map(t => t.id);
      setLocalOrder(o);
      localOrderRef.current = o;
    }
  }, [quarterTimetables]);

  const orderedTimetables = useMemo(() => {
    if (localOrder.length === 0) return quarterTimetables;
    return localOrder
      .map(id => quarterTimetables.find(t => t.id === id))
      .filter((t): t is Timetable => !!t);
  }, [localOrder, quarterTimetables]);

  const activeTimetable = useMemo(
    () => orderedTimetables.find((t) => t.id === activeTimetableId) ?? orderedTimetables[0] ?? null,
    [orderedTimetables, activeTimetableId]
  );

  function computePillFlexX(id: string, order: string[]): number {
    const GAP = 8;
    let x = 0;
    for (const pid of order) {
      if (pid === id) break;
      x += (pillWidthRef.current[pid] ?? 0) + GAP;
    }
    return x;
  }

  function getNewIndexFromDx(dx: number): number {
    const id = dragIdRef.current;
    if (!id) return -1;
    const order = localOrderRef.current;
    const myMidX = dragOriginalFlexX.current + dx + (pillWidthRef.current[id] ?? 0) / 2;
    let newIdx = 0;
    for (const pid of order) {
      if (pid === id) continue;
      const otherMidX = computePillFlexX(pid, order) + (pillWidthRef.current[pid] ?? 0) / 2;
      if (myMidX > otherMidX) newIdx++;
    }
    return Math.max(0, Math.min(order.length - 1, newIdx));
  }

  const pillPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: () => dragIdRef.current !== null,
      onPanResponderMove: (_, gs) => {
        const id = dragIdRef.current;
        if (!id) return;

        const newIdx = getNewIndexFromDx(gs.dx);
        const order = localOrderRef.current;
        const currentIdx = order.indexOf(id);
        if (newIdx >= 0 && newIdx !== currentIdx) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          const newOrder = [...order];
          newOrder.splice(currentIdx, 1);
          newOrder.splice(newIdx, 0, id);
          setLocalOrder(newOrder);
          localOrderRef.current = newOrder;
        }

        // Compensate translateX so the pill stays under the finger despite its flex position changing
        const flexShift = computePillFlexX(id, localOrderRef.current) - dragOriginalFlexX.current;
        dragTranslate.setValue(gs.dx - flexShift);
      },
      onPanResponderRelease: () => {
        const id = dragIdRef.current;
        if (!id) return;
        Animated.parallel([
          Animated.spring(dragScaleAnim, { toValue: 1, useNativeDriver: true }),
          Animated.spring(dragTranslate, { toValue: 0, useNativeDriver: true }),
        ]).start(() => {
          dragIdRef.current = null;
          setDraggingId(null);
          onReorderTimetablesRef.current(localOrderRef.current);
        });
      },
      onPanResponderTerminate: () => {
        Animated.parallel([
          Animated.spring(dragScaleAnim, { toValue: 1, useNativeDriver: true }),
          Animated.spring(dragTranslate, { toValue: 0, useNativeDriver: true }),
        ]).start(() => {
          dragIdRef.current = null;
          setDraggingId(null);
        });
      },
    })
  ).current;

  function handleLongPressPill(id: string) {
    dragOriginalFlexX.current = computePillFlexX(id, localOrderRef.current);
    dragIdRef.current = id;
    setDraggingId(id);
    dragTranslate.setValue(0);
    Animated.spring(dragScaleAnim, { toValue: 1.1, friction: 6, tension: 200, useNativeDriver: true }).start();
  }

  function triggerAddSheetAnim() {
    addSheetSlideAnim.setValue(SHEET_INITIAL_TRANSLATE_Y);
    addBackdropAnim.setValue(0);
    Animated.parallel([
      Animated.spring(addSheetSlideAnim, { toValue: 0, useNativeDriver: true, ...MOTION.spring.sheet }),
      Animated.timing(addBackdropAnim, { toValue: 1, duration: MOTION.duration.sheetIn, easing: MOTION.easing.standard, useNativeDriver: true }),
    ]).start();
  }

  async function openAddQuarterModal() {
    const existingQks = new Set(timetables.map((t) => t.quarterKey));

    const allCandidates = buildTermCandidates(school, 2019, new Date().getFullYear() + 1);

    triggerAddSheetAnim();
    setShowAddQuarterModal(true);

    const cachedSeededKeys = seededQuartersCacheBySchool[school];
    if (cachedSeededKeys) {
      setAddableQuarters(
        allCandidates
          .filter((q) => !existingQks.has(quarterKey(q)) && cachedSeededKeys.has(quarterKey(q)))
          .reverse()
      );
    }

    const seededKeys = await loadSeededQuarterKeys(school);
    seededQuartersCacheBySchool[school] = seededKeys;
    const seeded = allCandidates.filter((q) => !existingQks.has(quarterKey(q)) && seededKeys.has(quarterKey(q)));

    const uniqueYears = [...new Set(seeded.map((q) => q.year))].length;
    const h = Math.min(360, uniqueYears * 53);
    contentHeightAnim.setValue(h);
    yearListHeightRef.current = h;

    setAddableQuarters(seeded.reverse());
  }

  function openSettings() {
    setPendingTheme(blockTheme);
    setPendingShowCode(settings.showCode);
    setPendingShowClassName(settings.showClassName);
    setPendingShowRoomNumber(settings.showRoomNumber);
    setPendingShowInstructor(settings.showInstructor);
    setPendingShowTime(settings.showTime);
    settingsBackdropAnim.setValue(0);
    settingsSheetAnim.setValue(SHEET_INITIAL_TRANSLATE_Y);
    setShowSettings(true);
    Animated.parallel([
      Animated.timing(settingsBackdropAnim, { toValue: 1, duration: MOTION.duration.sheetIn, easing: MOTION.easing.standard, useNativeDriver: true }),
      Animated.spring(settingsSheetAnim, { toValue: 0, useNativeDriver: true, ...MOTION.spring.sheet }),
    ]).start();
  }

  function closeSettings(callback?: () => void) {
    Animated.parallel([
      Animated.timing(settingsBackdropAnim, { toValue: 0, duration: MOTION.duration.sheetOut, easing: MOTION.easing.exit, useNativeDriver: true }),
      Animated.timing(settingsSheetAnim, { toValue: SHEET_INITIAL_TRANSLATE_Y, duration: MOTION.duration.sheetOut, easing: MOTION.easing.exit, useNativeDriver: true }),
    ]).start(() => {
      setShowSettings(false);
      callback?.();
    });
  }
  closeSettingsRef.current = closeSettings;

  function applySettings() {
    onSettingsApply({
      theme: pendingTheme,
      showCode: pendingShowCode,
      showClassName: pendingShowClassName,
      showRoomNumber: pendingShowRoomNumber,
      showInstructor: pendingShowInstructor,
      showTime: pendingShowTime,
    });
    closeSettings();
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
            closeSettings(onDeleteTimetable);
          },
        },
      ]
    );
  }

  const THEMES: { key: TimetableTheme; label: string }[] = [
    { key: 'pastel', label: 'Pastel' },
    { key: 'soft', label: 'Soft' },
    { key: 'minimal', label: 'Minimal' },
    { key: 'outline', label: 'Outline' },
    { key: 'colorful', label: 'Colorful' },
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

  function waitForExportLayout() {
    return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
  }

  async function createScheduleExportImage(format: ScheduleShareFormat = 'clean') {
    setExportFormat(format);
    await waitForExportLayout();
    await new Promise((resolve) => setTimeout(resolve, 120));
    if (!exportCaptureRef.current) {
      throw new Error('Schedule export view is not ready.');
    }
    return withTimeout(
      captureRef(exportCaptureRef.current, { format: 'png', quality: 1, result: 'tmpfile' }),
      8000,
      'Schedule export timed out.'
    );
  }

  async function createScheduleExportDataUrl(uri: string) {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/png;base64,${base64}`;
  }

  async function saveSchedule() {
    await new Promise<void>((r) => closeSettings(r));
    await new Promise((r) => setTimeout(r, 350));
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to your photo library to save the schedule.');
        return;
      }
      const uri = await createScheduleExportImage('clean');
      await MediaLibrary.saveToLibraryAsync(uri);
      triggerSuccessHaptic();
      Alert.alert('Saved!', 'Your schedule has been saved to your photo library.');
    } catch {
      Alert.alert('Error', 'Could not save the schedule. Please try again.');
    }
  }

  function openShareFormatPicker() {
    closeSettings(() => setShowShareFormatModal(true));
  }

  async function shareSchedule(format: ScheduleShareFormat) {
    setSharingFormat(format);
    try {
      setShowShareFormatModal(false);
      await new Promise((resolve) => setTimeout(resolve, 250));
      const uri = await createScheduleExportImage(format);

      if (format === 'story' || format === 'square') {
      await shareScheduleToInstagram(uri, format);
      triggerSuccessHaptic();
      return;
    }

    await shareScheduleWithSystemSheet(uri, format);
    triggerSuccessHaptic();
    } catch (error) {
      console.warn('Schedule share failed:', error);
      Alert.alert('Error', 'Could not share the schedule. Please try again.');
    } finally {
      setSharingFormat(null);
      setExportFormat('clean');
    }
  }

  async function shareScheduleWithSystemSheet(uri: string, format: ScheduleShareFormat) {
    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (!isSharingAvailable) {
      Alert.alert('Sharing unavailable', 'Sharing is not available on this device right now.');
      return;
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: `${termLabel(selectedQuarter, school)} schedule · ${SHARE_FORMATS.find((item) => item.key === format)?.label ?? 'Share'}`,
    });
  }

  function canUseNativeShareModule() {
    const reactNative = require('react-native') as typeof import('react-native') & {
      TurboModuleRegistry?: { get?: (name: string) => unknown };
    };
    return Boolean(
      reactNative.NativeModules?.RNShare
      || reactNative.TurboModuleRegistry?.get?.('RNShare')
    );
  }

  function showInstagramFallbackAlert(uri: string, format: ScheduleShareFormat) {
    Alert.alert(
      'Could not open Instagram',
      'Make sure Instagram is installed. Direct Instagram sharing also requires a native/TestFlight build, not Expo Go.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Use Share Sheet', onPress: () => { void shareScheduleWithSystemSheet(uri, format); } },
      ]
    );
  }

  async function shareScheduleToInstagram(uri: string, format: ScheduleShareFormat) {
    try {
      if (!canUseNativeShareModule()) {
        showInstagramFallbackAlert(uri, format);
        return;
      }
      const RNShare = require('react-native-share').default as typeof import('react-native-share').default;
      const imageDataUrl = await createScheduleExportDataUrl(uri);

      if (format === 'story') {
        await RNShare.shareSingle({
          social: RNShare.Social.INSTAGRAM_STORIES as any,
          appId: 'com.parksihyun.classmate',
          backgroundImage: imageDataUrl,
          backgroundTopColor: '#f6f8ff',
          backgroundBottomColor: '#4169E1',
        } as any);
        return;
      }

      await RNShare.shareSingle({
        social: RNShare.Social.INSTAGRAM as any,
        url: imageDataUrl,
        type: 'image/png',
        filename: `classmate-${format}-schedule`,
      });
    } catch (error) {
      console.warn('Instagram direct share failed:', error);
      showInstagramFallbackAlert(uri, format);
    }
  }

  function toggleDisplay(key: string) {
    if (key === 'code')       setPendingShowCode((v) => !v);
    else if (key === 'className')  setPendingShowClassName((v) => !v);
    else if (key === 'roomNumber') setPendingShowRoomNumber((v) => !v);
    else if (key === 'instructor') setPendingShowInstructor((v) => !v);
    else if (key === 'time')       setPendingShowTime((v) => !v);
  }

  const gridFrameBg = isDark ? '#0f172a' : '#ffffff';
  const gridFrameBorder = isDark ? '#243041' : '#d9dee8';
  const gridHeaderBg = isDark ? '#0a1628' : '#f5f5f7';
  const gridLine = isDark ? '#1e293b' : '#e0e0e5';
  const gridLabel = isDark ? '#64748b' : '#6b7280';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>

      {/* Quarter dropdown */}
      <Modal transparent visible={showQuarterDropdown} onRequestClose={closeQuarterDropdown}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeQuarterDropdown}>
          <Animated.View
            style={{
              position: 'absolute',
              top: topInset + 44,
              right: 52,
              backgroundColor: colors.card,
              borderRadius: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 8,
              minWidth: 160,
              overflow: 'hidden',
              opacity: quarterDropdownAnim,
            }}
          >
            {(() => {
              const academicYear = (qk: string) => {
                const [yr, qt] = qk.split('-');
                return qt === 'Fall' ? Number(yr) : Number(yr) - 1;
              };
              return sortedQuarterKeys.map((qk, index) => {
                const [year, quarter] = qk.split('-');
                const q: Quarter = { year, quarter };
                const isActive = qk === quarterKey(selectedQuarter);
                const isNewGroup = index > 0 && academicYear(qk) !== academicYear(sortedQuarterKeys[index - 1]);
                const anim = quarterItemAnims.current[index];
                return (
                  <Animated.View
                    key={qk}
                    style={{
                      opacity: anim,
                      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => { onChangeQuarter(q); closeQuarterDropdown(); }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        backgroundColor: isActive ? colors.brandBg : colors.card,
                        borderTopWidth: index === 0 ? 0 : isNewGroup ? 2 : 1,
                        borderTopColor: isNewGroup ? colors.border : colors.borderSubtle,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text style={{ color: isActive ? colors.brand : colors.textSecondary, fontWeight: isActive ? '700' : '400', fontSize: 14 }}>
                        {pickerTermLabel(q)}
                      </Text>
                      {isActive && <Ionicons name="checkmark" size={16} color={colors.brand} />}
                    </TouchableOpacity>
                  </Animated.View>
                );
              });
            })()}
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Add menu modal (+ Add button) */}
      <Modal transparent animationType="none" visible={showAddMenu} onRequestClose={closeAddMenu}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeAddMenu}>
          <Animated.View
            style={{
              position: 'absolute',
              top: topInset + 44,
              right: 16,
              backgroundColor: colors.card,
              borderRadius: 14,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 16,
              elevation: 10,
              minWidth: 180,
              overflow: 'hidden',
              opacity: addMenuAnim,
            }}
          >
            {[
              { icon: 'add', label: 'Add Course', onPress: () => { if (timetables.length > 0) { closeAddMenu(); onOpenCoursePicker(); } }, disabled: timetables.length === 0 },
              { icon: 'calendar-outline', label: 'Add Timetable', onPress: () => { closeAddMenu(); onCreateTimetable(); }, disabled: false },
              { icon: 'earth-outline', label: 'Add Term', onPress: () => { closeAddMenu(); setTimeout(() => openAddQuarterModal(), 200); }, disabled: false },
            ].map((item, i) => (
              <Animated.View
                key={item.label}
                style={{
                  opacity: addMenuItemAnims[i],
                  transform: [{ translateY: addMenuItemAnims[i].interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
                }}
              >
                {i > 0 && <View style={{ height: 1, backgroundColor: colors.borderSubtle }} />}
                <TouchableOpacity
                  onPress={item.onPress}
                  disabled={item.disabled}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 15, opacity: item.disabled ? 0.35 : 1 }}
                >
                  <Ionicons name={item.icon as any} size={19} color={colors.textSecondary} />
                  <Text style={{ fontSize: 15, color: colors.text, fontWeight: '500' }}>{item.label}</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Add Quarter modal */}
      <Modal transparent animationType="none" visible={showAddQuarterModal} onRequestClose={closeAddQuarterModal}>
        <Animated.View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: addBackdropAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.4)'] }) }}>
        <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} activeOpacity={1} onPress={closeAddQuarterModal} />
        <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
            <Animated.View style={{ backgroundColor: colors.card, borderTopLeftRadius: SHEET_CORNER_RADIUS, borderTopRightRadius: SHEET_CORNER_RADIUS, paddingBottom: 40, overflow: 'hidden', transform: [{ translateY: addSheetSlideAnim }] }}>
              {/* Drag handle */}
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }} {...addQuarterDragPan.panHandlers}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
              </View>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}>
                {selectedAddYear ? (
                  <TouchableOpacity onPress={drillBackToYears} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="chevron-back" size={24} color={colors.brand} />
                    <Text style={{ fontSize: 20, fontWeight: '700', color: colors.brand }}>{selectedAddYear}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>Select Year</Text>
                )}
                <TouchableOpacity onPress={closeAddQuarterModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {addableQuarters.length === 0 ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <Text style={{ color: colors.textTertiary, fontSize: 14 }}>No new terms available</Text>
                </View>
              ) : (
                <Animated.View style={{ height: contentHeightAnim, overflow: 'hidden' }}>
                  {/* Year list — always rendered so it's ready when sliding back */}
                  {(() => {
                    const years = [...new Set(addableQuarters.map((q) => q.year))].sort((a, b) => Number(b) - Number(a));
                    return (
                      <ScrollView showsVerticalScrollIndicator={false}>
                        {years.map((year, index) => {
                          const count = addableQuarters.filter((q) => q.year === year).length;
                          return (
                            <TouchableOpacity
                              key={year}
                              onPress={() => drillIntoYear(year)}
                              style={{
                                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                paddingHorizontal: 24, paddingVertical: 16,
                                borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.borderSubtle,
                              }}
                            >
                              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{year}</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={{ fontSize: 14, color: colors.textTertiary }}>{count} term{count !== 1 ? 's' : ''}</Text>
                                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    );
                  })()}

              {/* Term drill-down — absolutely overlays the year list, slides in from right */}
                  {mountedYear && (
                    <Animated.View
                      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.card, transform: [{ translateX: addYearSlideAnim }] }}
                      {...addQuarterSwipePan.panHandlers}
                    >
                      <ScrollView showsVerticalScrollIndicator={false}>
                        {addableQuarters
                          .filter((q) => q.year === mountedYear)
                          .map((q, index) => (
                            <TouchableOpacity
                              key={quarterKey(q)}
                              onPress={() => { closeAddQuarterModal(); onAddQuarter(q); }}
                              style={{
                                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                paddingHorizontal: 24, paddingVertical: 16,
                                borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.borderSubtle,
                              }}
                            >
                              <Text style={{ fontSize: 16, color: colors.text }}>{pickerTermLabel(q)}</Text>
                              <Ionicons name="add-circle-outline" size={20} color={colors.brand} />
                            </TouchableOpacity>
                          ))}
                      </ScrollView>
                    </Animated.View>
                  )}
                </Animated.View>
              )}
            </Animated.View>
        </TouchableOpacity>
        </Animated.View>
      </Modal>

      {/* Settings bottom sheet */}
      <Modal animationType="none" transparent visible={showSettings} onRequestClose={() => closeSettings()}>
        <Animated.View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: settingsBackdropAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.4)'] }) }}>
          <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} activeOpacity={1} onPress={() => closeSettings()} />
          <Animated.View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: SHEET_CORNER_RADIUS,
              borderTopRightRadius: SHEET_CORNER_RADIUS,
              maxHeight: '88%',
              overflow: 'hidden',
              transform: [{ translateY: settingsSheetAnim }],
            }}
          >
            {/* Drag handle */}
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }} {...settingsDragPan.panHandlers}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>

            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 20,
                paddingTop: 8,
                paddingBottom: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.borderSubtle,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Timetable Settings</Text>
              <TouchableOpacity onPress={() => closeSettings()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Math.max(bottomInset + 20, 32) }}
            >
              {/* Block Style */}
              <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Block Style
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {THEMES.map((t) => {
                    const isSelected = pendingTheme === t.key;
                    return (
                      <TouchableOpacity
                        key={t.key}
                        onPress={() => setPendingTheme(t.key)}
                        style={{
                          flex: 1,
                          paddingVertical: 8,
                          borderRadius: 10,
                          alignItems: 'center',
                          backgroundColor: isSelected ? colors.brand : colors.bgTertiary,
                          borderWidth: 1.5,
                          borderColor: isSelected ? colors.brand : colors.border,
                        }}
                      >
                        <Text style={{ fontSize: 12, color: isSelected ? 'white' : colors.textSecondary, fontWeight: isSelected ? '700' : '400' }}>{t.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Display Information */}
              <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Display Information
                </Text>
                <View style={{ marginTop: 2 }}>
                  {DISPLAY_OPTIONS.map((opt) => {
                    const isChecked = pendingDisplayMap[opt.key];
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        onPress={() => toggleDisplay(opt.key)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          paddingVertical: 7,
                        }}
                      >
                        <View
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 5,
                            backgroundColor: isChecked ? colors.brand : colors.card,
                            borderWidth: 1.5,
                            borderColor: isChecked ? colors.brand : colors.textTertiary,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {isChecked && <Ionicons name="checkmark" size={13} color="white" />}
                        </View>
                        <Text style={{ fontSize: 14, color: isChecked ? colors.text : colors.textSecondary, fontWeight: isChecked ? '500' : '400' }}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginTop: 12, marginHorizontal: 20 }} />

              {/* Apply Settings */}
              <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
                <TouchableOpacity
                  onPress={applySettings}
                  style={{
                    backgroundColor: colors.brand,
                    borderRadius: 12,
                    paddingVertical: 13,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 15, fontWeight: '700' }}>Apply Settings</Text>
                </TouchableOpacity>
              </View>

              {/* Save / Share Schedule */}
              <View style={{ paddingHorizontal: 20, paddingTop: 8, flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={saveSchedule}
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    paddingVertical: 13,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                    borderWidth: 1.5,
                    borderColor: colors.border,
                    backgroundColor: colors.bgTertiary,
                  }}
                >
                  <Ionicons name="download-outline" size={16} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={openShareFormatPicker}
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    paddingVertical: 13,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                    borderWidth: 1.5,
                    borderColor: colors.border,
                    backgroundColor: colors.bgTertiary,
                  }}
                >
                  <Ionicons name="share-outline" size={16} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>Share</Text>
                </TouchableOpacity>
              </View>

              {/* Delete Current Timetable */}
              <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
                <TouchableOpacity
                  onPress={confirmDelete}
                  style={{
                    borderRadius: 12,
                    paddingVertical: 13,
                    alignItems: 'center',
                    borderWidth: 1.5,
                    borderColor: colors.destructive,
                    backgroundColor: colors.destructiveBg,
                  }}
                >
                  <Text style={{ color: colors.destructive, fontSize: 14, fontWeight: '600' }}>
                    Delete Current Timetable
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Share format picker */}
      <Modal
        animationType="slide"
        transparent
        visible={showShareFormatModal}
        onRequestClose={() => setShowShareFormatModal(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.38)' }}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowShareFormatModal(false)}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: SHEET_CORNER_RADIUS,
              borderTopRightRadius: SHEET_CORNER_RADIUS,
              paddingTop: 12,
              paddingHorizontal: 20,
              paddingBottom: Math.max(bottomInset + 18, 28),
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -8 },
              shadowOpacity: 0.14,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <View style={{ alignItems: 'center', paddingBottom: 12 }}>
              <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <View>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>Share timetable</Text>
                <Text style={{ marginTop: 3, fontSize: 13, color: colors.textTertiary }}>
                  Pick a format for Instagram, Messages, or anywhere else.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowShareFormatModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 10 }}>
              {SHARE_FORMATS.map((format) => {
                const isSharing = sharingFormat === format.key;
                return (
                  <TouchableOpacity
                    key={format.key}
                    activeOpacity={0.84}
                    disabled={!!sharingFormat}
                    onPress={() => { void shareSchedule(format.key); }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      padding: 14,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: format.key === 'story' ? `${colors.brand}55` : colors.border,
                      backgroundColor: format.key === 'story' ? colors.brandBg : colors.bgTertiary,
                      opacity: sharingFormat && !isSharing ? 0.45 : 1,
                    }}
                  >
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: format.key === 'story' ? colors.brand : colors.card,
                        borderWidth: format.key === 'story' ? 0 : 1,
                        borderColor: colors.border,
                      }}
                    >
                      {isSharing ? (
                        <ActivityIndicator size="small" color={format.key === 'story' ? 'white' : colors.brand} />
                      ) : (
                        <Ionicons
                          name={format.icon}
                          size={20}
                          color={format.key === 'story' ? 'white' : colors.textSecondary}
                        />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{format.label}</Text>
                      <Text style={{ marginTop: 2, fontSize: 12, lineHeight: 17, color: colors.textTertiary }}>
                        {format.description}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Course detail bottom sheet ── */}
      <Modal
        visible={!!selectedCourse}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedCourse(null)}
      >
          {/* Detail sheet */}
          {selectedCourse && (() => {
            const professor = professorDisplayName(selectedCourse.professor);
            const hasRmp = professorIsKnown(selectedCourse.professor);
            const profRmpUrl = hasRmp ? rmpUrl(selectedCourse.professor, school) : null;
            const rawLocation = displayCourseLocation(selectedCourse.location, school) ?? '';
            const hasMapLocation = !isUnmappableLocation(rawLocation);
            const mappedLocation = getCampusMapLocation(school, rawLocation);
            const mapQuery = mappedLocation?.name ?? rawLocation;
            const courseMapUrl = hasMapLocation ? appleMapsUrl(mapQuery, school) : null;
            const selectedQuarterKey = quarterKey(selectedQuarter);
            const discordKey = courseDiscordKey(selectedQuarterKey, selectedCourse.code);
            const discordLinkKnown = Object.prototype.hasOwnProperty.call(courseDiscordLinks, discordKey);
            const discordLink = selectedCourse.department !== 'CUSTOM' ? courseDiscordLinks[discordKey] : null;
            const discordLinkLoading = selectedCourse.department !== 'CUSTOM' && discordLinkLoadingKey === discordKey && !discordLinkKnown;
            return (
              <View style={{ flex: 1, backgroundColor: colors.card }}>
                <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={{ fontSize: 19, fontWeight: '800', color: colors.text }}>{selectedCourse.code}</Text>
                      <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 3, fontWeight: '500' }}>{selectedCourse.title}</Text>
                      {selectedCourse.sectionLabel && (
                        <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{selectedCourse.sectionLabel}</Text>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => setSelectedCourse(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close" size={22} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={{ paddingHorizontal: 20, paddingVertical: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}>
                  {professor ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="person-outline" size={16} color={colors.textTertiary} />
                      <Text style={{ fontSize: 14, color: colors.textSecondary, flex: 1 }}>{professor}</Text>
                      {profRmpUrl && (
                        <TouchableOpacity
                          onPress={() => { void Linking.openURL(profRmpUrl); }}
                          style={{ backgroundColor: colors.brandBg, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: colors.brand }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.brand }}>RMP</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="time-outline" size={16} color={colors.textTertiary} />
                    <Text style={{ fontSize: 14, color: colors.textSecondary }}>{selectedCourse.days} · {formatCourseTimeRange12(selectedCourse.time)}</Text>
                  </View>
                  {rawLocation ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="location-outline" size={16} color={colors.textTertiary} />
                      <Text style={{ fontSize: 14, color: colors.textSecondary }}>{rawLocation}</Text>
                    </View>
                  ) : null}
                  {selectedCourse.units != null ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="school-outline" size={16} color={colors.textTertiary} />
                      <Text style={{ fontSize: 14, color: colors.textSecondary }}>{selectedCourse.units} {selectedCourse.units === 1 ? 'unit' : 'units'}</Text>
                    </View>
                  ) : null}
                </View>
                {mappedLocation ? (
                  <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Location Preview
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => { if (mapQuery) void openMaps(mapQuery, school, mappedLocation); }}
                      style={{
                        borderRadius: 18,
                        overflow: 'hidden',
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.bgTertiary,
                      }}
                    >
                      {Platform.OS === 'web' ? (
                        <View style={{ height: 150, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
                          <Ionicons name="map-outline" size={26} color={colors.brand} />
                          <Text style={{ marginTop: 10, fontSize: 14, fontWeight: '700', color: colors.text }}>{mappedLocation.name}</Text>
                          <Text style={{ marginTop: 4, fontSize: 12, color: colors.textSecondary, textAlign: 'center' }}>
                            Live map preview is available on iOS and Android. Use Maps below on web.
                          </Text>
                        </View>
                      ) : (
                        <MapView
                          style={{ width: '100%', height: 150 }}
                          pointerEvents="none"
                          initialRegion={{
                            latitude: mappedLocation.latitude,
                            longitude: mappedLocation.longitude,
                            latitudeDelta: 0.0035,
                            longitudeDelta: 0.0035,
                          }}
                        >
                          <Marker
                            coordinate={{ latitude: mappedLocation.latitude, longitude: mappedLocation.longitude }}
                            title={mappedLocation.name}
                            description={rawLocation}
                          />
                        </MapView>
                      )}
                      <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{mappedLocation.name}</Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>
                              {rawLocation}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Ionicons name="logo-apple" size={14} color={colors.brand} />
                            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.brand }}>Open</Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                ) : null}
                <View style={{ paddingHorizontal: 20, paddingVertical: 16, gap: 10 }}>
                  {selectedCourse.department !== 'CUSTOM' ? (
                    <TouchableOpacity
                      disabled={discordLinkLoading}
                      onPress={() => {
                        if (discordLink?.discord_url) {
                          void openDiscordInvite(discordLink.discord_url);
                          return;
                        }
                        openDiscordLinkModal(selectedCourse);
                      }}
                      style={{
                        borderRadius: 14,
                        paddingVertical: 14,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 8,
                        borderWidth: discordLink?.discord_url ? 0 : 1.5,
                        borderColor: '#5865F2',
                        backgroundColor: discordLink?.discord_url ? '#5865F2' : colors.brandBg,
                        opacity: discordLinkLoading ? 0.6 : 1,
                      }}
                    >
                      {discordLinkLoading ? (
                        <ActivityIndicator size="small" color="#5865F2" />
                      ) : (
                        <Ionicons name="logo-discord" size={17} color={discordLink?.discord_url ? 'white' : '#5865F2'} />
                      )}
                      <Text style={{ color: discordLink?.discord_url ? 'white' : '#5865F2', fontWeight: '700', fontSize: 15 }}>
                        {discordLinkLoading ? 'Checking Discord...' : discordLink?.discord_url ? 'Join Discord' : 'Add Discord link'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    onPress={() => {
                      setReviewsCourse(selectedCourse);
                    }}
                    style={{
                      borderRadius: 14,
                      paddingVertical: 14,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 8,
                      borderWidth: 0,
                      borderColor: colors.brand,
                      backgroundColor: colors.brand,
                    }}
                  >
                    <Ionicons name="star-outline" size={17} color="white" />
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>Reviews</Text>
                  </TouchableOpacity>
                  {courseMapUrl && !mappedLocation && (
                    <TouchableOpacity
                      onPress={() => { if (mapQuery) void openMaps(mapQuery, school, mappedLocation); }}
                      style={{ borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: colors.brand, backgroundColor: colors.brandBg }}
                    >
                      <Ionicons name="map-outline" size={17} color={colors.brand} />
                      <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 15 }}>Maps</Text>
                    </TouchableOpacity>
                  )}
                  {selectedCourse.department === 'CUSTOM' && onEditCustomCourse && (
                    <TouchableOpacity
                      onPress={() => { onEditCustomCourse(selectedCourse); setSelectedCourse(null); }}
                      style={{ borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: colors.brand, backgroundColor: colors.brandBg }}
                    >
                      <Ionicons name="create-outline" size={17} color={colors.brand} />
                      <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 15 }}>Edit Custom Block</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => { onRemoveCourse(selectedCourse); setSelectedCourse(null); }}
                    style={{ borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: colors.destructive, backgroundColor: colors.destructiveBg }}
                  >
                    <Ionicons name="trash-outline" size={17} color={colors.destructive} />
                    <Text style={{ color: colors.destructive, fontWeight: '700', fontSize: 15 }}>Remove Course</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })()}
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
              professors={
                professorIsKnown(reviewsCourse.professor)
                  ? [reviewsCourse.professor] : []
              }
              school={school}
              userId={userId}
              semesterLabel={termLabel(selectedQuarter, school)}
              quarterKey={quarterKey(selectedQuarter)}
            />
          )}
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={!!discordLinkCourse}
        onRequestClose={closeDiscordLinkModal}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.34)' }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            activeOpacity={1}
            onPress={closeDiscordLinkModal}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'position' : undefined}
            keyboardVerticalOffset={0}
            style={{ width: '100%' }}
            contentContainerStyle={{ width: '100%' }}
          >
            <View
              onStartShouldSetResponder={() => true}
              style={{
                backgroundColor: colors.card,
                borderTopLeftRadius: SHEET_CORNER_RADIUS,
                borderTopRightRadius: SHEET_CORNER_RADIUS,
                paddingHorizontal: 20,
                paddingTop: 16,
                paddingBottom: keyboardVisible ? 12 : Math.max(bottomInset + 12, 16),
                borderTopWidth: 1,
                borderColor: colors.borderSubtle,
              }}
            >
              <View style={{ width: 42, height: 4, borderRadius: 999, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 14 }} />
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>Add Discord link</Text>
                  <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary, marginTop: 6 }}>
                    {discordLinkCourse ? `${discordLinkCourse.code} · ${termLabel(selectedQuarter, school)}` : 'Paste a class invite link.'}
                  </Text>
                </View>
                <TouchableOpacity onPress={closeDiscordLinkModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={22} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>

              <TextInput
                value={discordInviteInput}
                onChangeText={(value) => {
                  setDiscordInviteInput(value);
                  if (discordInviteError) setDiscordInviteError(null);
                }}
                placeholder="discord.gg/your-class"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
                style={{
                  marginTop: 16,
                  minHeight: 44,
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderColor: discordInviteError ? colors.destructive : colors.border,
                  backgroundColor: colors.bgTertiary,
                  color: colors.text,
                  fontSize: 15,
                  fontWeight: '600',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                }}
              />

              {discordInviteError ? (
                <Text style={{ fontSize: 12, lineHeight: 17, color: colors.destructive, marginTop: 8, fontWeight: '700' }}>
                  {discordInviteError}
                </Text>
              ) : null}

              <Text style={{ fontSize: 12, lineHeight: 17, color: colors.textTertiary, marginTop: 8 }}>
                Student-submitted invite links are shared with everyone viewing this class.
              </Text>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  disabled={savingDiscordLink}
                  onPress={closeDiscordLinkModal}
                  style={{ flex: 1, minHeight: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgTertiary, borderWidth: 1, borderColor: colors.border }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textSecondary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={savingDiscordLink}
                  onPress={() => { void saveDiscordLink(); }}
                  style={{ flex: 1.4, minHeight: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#5865F2', flexDirection: 'row', gap: 8, opacity: savingDiscordLink ? 0.72 : 1 }}
                >
                  {savingDiscordLink ? <ActivityIndicator color="white" size="small" /> : <Ionicons name="logo-discord" size={17} color="white" />}
                  <Text style={{ fontSize: 15, fontWeight: '800', color: 'white' }}>
                    {savingDiscordLink ? 'Saving...' : 'Save link'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView
          ref={timetableScrollRef}
          style={{ flex: 1 }}
          scrollEnabled
          showsVerticalScrollIndicator={false}
          bounces
          alwaysBounceVertical={false}
          contentContainerStyle={{ paddingBottom: bottomInset + 96 }}
        >
        {/* Header */}
        <View style={{ paddingHorizontal: 18, paddingBottom: 10, paddingTop: topInset + 6 }}>
          {/* Row 1: Title + Quarter picker + three-dots */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Text style={{ flex: 1, fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: 0 }}>
              Timetable
            </Text>
            <View style={{ maxWidth: Math.max(128, screenWidth * 0.48), flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <TouchableOpacity
                onPress={openQuarterDropdown}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 22,
                  paddingHorizontal: 13,
                  paddingVertical: 8,
                  backgroundColor: colors.card,
                  gap: 4,
                  shadowColor: '#0f172a',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: isDark ? 0.18 : 0.06,
                  shadowRadius: 12,
                  elevation: 3,
                }}
              >
                <Text numberOfLines={1} ellipsizeMode="tail" style={{ flexShrink: 1, minWidth: 0, fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
                  {timetables.length === 0 ? '--' : pickerTermLabel(selectedQuarter)}
                </Text>
                <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={openSettings}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Row 2: Plan tabs + + Add */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEnabled={!draggingId}
              style={{ flex: 1 }}
              contentContainerStyle={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingRight: 4 }}
              {...pillPanResponder.panHandlers}
            >
              {orderedTimetables.map((t) => {
                const isActive = t.id === activeTimetableId;
                const isDragging = t.id === draggingId;
                return (
                  <Animated.View
                    key={t.id}
                    onLayout={(e) => {
                      pillXPos.current[t.id] = e.nativeEvent.layout.x;
                      pillWidthRef.current[t.id] = e.nativeEvent.layout.width;
                    }}
                    style={isDragging ? {
                      transform: [{ translateX: dragTranslate }, { scale: dragScaleAnim }],
                      zIndex: 10,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.18,
                      shadowRadius: 8,
                      elevation: 8,
                    } : {}}
                  >
                    <TouchableOpacity
                      onPress={() => { if (!draggingId) onSelectTimetable(t.id); }}
                      onLongPress={() => handleLongPressPill(t.id)}
                      delayLongPress={400}
                      activeOpacity={0.8}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 9,
                        borderRadius: 22,
                        backgroundColor: isActive ? colors.brand : colors.inputBg,
                        borderWidth: 1.5,
                        borderColor: isActive ? colors.brand : `${colors.borderSubtle}`,
                        shadowColor: '#0f172a',
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: isActive ? (isDark ? 0.28 : 0.14) : (isDark ? 0.1 : 0.04),
                        shadowRadius: isActive ? 14 : 8,
                        elevation: 3,
                      }}
                    >
                      <Text numberOfLines={1} ellipsizeMode="tail" style={{ maxWidth: 132, fontSize: 13, fontWeight: '600', color: isActive ? 'white' : colors.textSecondary }}>
                        {t.name}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </ScrollView>
            <TouchableOpacity onPress={openAddMenu} style={{ paddingVertical: 7, paddingLeft: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.brand }}>+ Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Grid container */}
        <View
          style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 }}
          onLayout={(e) => setGridWidth(e.nativeEvent.layout.width - GRID_LEFT_PAD - GRID_OUTER_HORIZONTAL_PADDING)}
        >
          <View
            style={{
              backgroundColor: gridFrameBg,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: gridFrameBorder,
              overflow: 'hidden',
              shadowColor: isDark ? '#000' : '#cfd6e4',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: isDark ? 0.24 : 0.18,
              shadowRadius: 18,
              elevation: 4,
            }}
          >
              {/* Day headers row */}
              <View
                style={{
                  flexDirection: 'row',
                  borderBottomWidth: 1,
                  borderBottomColor: gridLine,
                  backgroundColor: gridHeaderBg,
                }}
              >
                <View style={{ width: timeColumnWidth }} />
                {visibleDays.map((day) => (
                  <View
                    key={day}
                    style={{
                      width: dayColumnWidth,
                      alignItems: 'center',
                      paddingVertical: compactGrid ? 8 : 10,
                      borderLeftWidth: 1,
                      borderLeftColor: gridLine,
                      backgroundColor: gridHeaderBg,
                    }}
                  >
                    <Text style={{ fontSize: compactGrid ? 11 : 12, fontWeight: '700', color: colors.textSecondary }}>
                      {DAY_LABEL[day]}
                    </Text>
                  </View>
                ))}
              </View>

              <View>
                <View style={{ backgroundColor: gridFrameBg, height: timetableHeight }}>
                  <View
                    style={{
                      flexDirection: 'row',
                    }}
                  >
                    <View style={{ width: timeColumnWidth, height: timetableHeight }}>
                      {hourLabels.map((hour, index) => (
                        <View key={hour} style={{
                          position: 'absolute',
                          top: index * hourHeight,
                          height: hourHeight,
                          left: 0, right: 0,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Text style={{ fontSize: compactGrid ? 10 : 11, fontWeight: '700', color: gridLabel }}>
                            {formatHourLabel(hour)}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <View
                      style={{
                        width: dayColumnWidth * visibleDays.length,
                        height: timetableHeight,
                        position: 'relative',
                      }}
                    >
                      <View style={{ flexDirection: 'row', height: timetableHeight }}>
                        {visibleDays.map((day) => (
                          <View
                            key={day}
                            style={{
                              width: dayColumnWidth,
                              height: timetableHeight,
                              backgroundColor: gridFrameBg,
                              borderLeftWidth: 1,
                              borderLeftColor: gridLine,
                            }}
                          />
                        ))}
                      </View>

                      {hourBoundaries.map((hour, index) => (
                        <View
                          key={hour}
                          style={{
                            position: 'absolute',
                            top: index * hourHeight,
                            left: -timeColumnWidth,
                            right: 0,
                            height: 1,
                            backgroundColor: gridLine,
                          }}
                        />
                      ))}

                      {scheduledCourses.flatMap((course) => {
                        const courseDays = getDaysArray(course.days);
                        const startHour = getCourseStartHour(course.time);
                        const endHour = getCourseEndHour(course.time);
                        const top = (startHour - displayStartHour) * hourHeight;
                        const height = (endHour - startHour) * hourHeight;
                        const { bg, text, border } = getTimetableBlockColors(course, blockTheme, isDark);
                        const courseLocation = displayCourseLocation(course.location, school);

                        return courseDays.map((day) => {
                          const dayIndex = visibleDays.indexOf(day);
                          if (dayIndex === -1) return null;
                          return (
                            <TouchableOpacity
                              key={`${course.id}-${day}`}
                              activeOpacity={0.85}
                              onPress={() => setSelectedCourse(course)}
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
                                paddingLeft: compactGrid ? 5 : 6,
                                paddingRight: 4,
                                paddingTop: compactGrid ? 4 : 5,
                                paddingBottom: 4,
                                overflow: 'hidden',
                              }}
                            >
                                {showCode && (
                                  <Text
                                    style={{ color: text, fontWeight: '800', fontSize: codeFontSize, lineHeight: compactGrid ? 12 : 13 }}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                  >
                                    {course.code}
                                  </Text>
                                )}
                                {showClassName && (
                                  <Text
                                    style={{ color: text, fontWeight: '600', fontSize: metaFontSize, lineHeight: compactGrid ? 10 : 12, opacity: 0.85 }}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                  >
                                    {course.title}
                                  </Text>
                                )}
                                {showRoomNumber && courseLocation ? (
                                  <Text
                                    style={{ color: text, fontSize: metaFontSize, opacity: 0.75, marginTop: 2 }}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                  >
                                    {courseLocation}
                                  </Text>
                                ) : null}
                                {showInstructor && (
                                  <Text
                                    style={{ color: text, fontSize: metaFontSize, opacity: 0.7, marginTop: 1 }}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                  >
                                    {getProfLastName(course.professor)}
                                  </Text>
                                )}
                                {showTime && (
                                  <Text
                                    style={{ color: text, fontSize: timeFontSize, opacity: 0.6, marginTop: 1 }}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                  >
                                    {formatCourseTimeRange12(course.time, { compact: true })}
                                  </Text>
                                )}
                            </TouchableOpacity>
                          );
                        });
                      })}
                    </View>
                  </View>
                </View>
              </View>
          </View>
          </View>

        {/* TBA / Online courses — below the grid */}
        {tbaCourses.length > 0 && (
          <View style={{
            paddingHorizontal: 16, paddingTop: 6, paddingBottom: 0,
            backgroundColor: 'transparent',
          }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {tbaCourses.map((course) => {
                const { bg, text, border } = getTimetableBlockColors(course, blockTheme, isDark);
                const courseLocation = displayCourseLocation(course.location, school);
                return (
                  <TouchableOpacity
                    key={course.id}
                    activeOpacity={0.85}
                    onPress={() => setSelectedCourse(course)}
                    style={{
                      backgroundColor: bg, borderRadius: 8,
                      borderWidth: 1, borderColor: border,
                      paddingHorizontal: 10, paddingVertical: 8,
                      minWidth: 100, maxWidth: 160,
                    }}
                  >
                      {showCode && (
                        <Text style={{ color: text, fontWeight: '800', fontSize: 10, lineHeight: 13 }} numberOfLines={1} ellipsizeMode="tail">
                          {course.code}
                        </Text>
                      )}
                      {showClassName && (
                        <Text style={{ color: text, fontWeight: '600', fontSize: 9, lineHeight: 12, opacity: 0.85 }} numberOfLines={1} ellipsizeMode="tail">
                          {course.title}
                        </Text>
                      )}
                      {showInstructor && (
                        <Text style={{ color: text, fontSize: 9, opacity: 0.7, marginTop: 2 }} numberOfLines={1} ellipsizeMode="tail">
                          {getProfLastName(course.professor)}
                        </Text>
                      )}
                    <Text style={{ color: text, fontSize: 8, opacity: 0.55, marginTop: 2, fontWeight: '600' }}>
                      {courseLocation?.toLowerCase().includes('online') || courseLocation?.toLowerCase().includes('remote') ? 'Online' : 'TBA'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
        </ScrollView>
      </View>

      <ErrorScreen
        visible={showError}
        message={errorMessage}
        onDismiss={() => setShowError(false)}
      />

      <View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: exportSnapshotWidth,
          zIndex: -1,
        }}
      >
        <View
          ref={exportCaptureRef}
          collapsable={false}
          style={{
            width: exportSnapshotWidth,
            ...(exportCanvasHeight ? { height: exportCanvasHeight } : null),
            padding: exportOuterPadding,
            backgroundColor: isDark ? '#0b1220' : '#eef3ff',
            justifyContent: exportFormat === 'story' ? 'space-between' : 'flex-start',
            overflow: 'hidden',
          }}
        >
          {exportFormat !== 'clean' && (
            <View style={{ marginBottom: exportFormat === 'square' ? 9 : 14 }}>
              <View
                style={{
                  alignSelf: 'flex-start',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: isDark ? 'rgba(65,105,225,0.22)' : '#ffffff',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.10)' : '#dbe4ff',
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.brand, letterSpacing: 1 }}>
                  CLASSMATE
                </Text>
              </View>
              <Text
                style={{
                  marginTop: exportFormat === 'square' ? 7 : 12,
                  fontSize: exportFormat === 'square' ? 22 : 28,
                  lineHeight: exportFormat === 'square' ? 26 : 33,
                  fontWeight: '900',
                  color: colors.text,
                  letterSpacing: 0,
                }}
              >
                My {termLabel(selectedQuarter, school)} schedule
              </Text>
              <Text style={{ marginTop: 4, fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>
                {activeTimetable?.name ?? 'My Schedule'} · {scheduledCourses.length} class{scheduledCourses.length === 1 ? '' : 'es'}
              </Text>
            </View>
          )}

          <View
            style={{
              backgroundColor: gridFrameBg,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: gridFrameBorder,
              padding: exportCardPadding,
              shadowColor: isDark ? '#000' : '#cfd6e4',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: isDark ? 0.22 : 0.16,
              shadowRadius: 18,
              elevation: 4,
              flexShrink: 0,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.brand, letterSpacing: 0.6 }}>
                  CLASSMATE
                </Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 4 }}>
                  {pickerTermLabel(selectedQuarter)}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  {activeTimetable?.name ?? 'My Schedule'}
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: colors.brandBg,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.brand }}>
                  {scheduledCourses.length} classes
                </Text>
              </View>
            </View>

            <View
              style={{
                backgroundColor: gridFrameBg,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: gridFrameBorder,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  borderBottomWidth: 1,
                  borderBottomColor: gridLine,
                  backgroundColor: gridHeaderBg,
                }}
              >
                <View style={{ width: exportTimeColumnWidth }} />
                {visibleDays.map((day) => (
                  <View
                    key={`export-header-${day}`}
                    style={{
                      width: exportDayColumnWidth,
                      alignItems: 'center',
                      paddingVertical: exportCompactGrid ? 6 : 8,
                      borderLeftWidth: 1,
                      borderLeftColor: gridLine,
                      backgroundColor: gridHeaderBg,
                    }}
                  >
                    <Text style={{ fontSize: exportCompactGrid ? 10 : 11, fontWeight: '700', color: colors.textSecondary }}>
                      {DAY_LABEL[day]}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{ backgroundColor: gridFrameBg, height: exportTimetableHeight }}>
                <View style={{ flexDirection: 'row' }}>
                  <View style={{ width: exportTimeColumnWidth, height: exportTimetableHeight }}>
                    {hourLabels.map((hour, index) => (
                      <View
                        key={`export-hour-${hour}`}
                        style={{
                          position: 'absolute',
                          top: index * exportHourHeight,
                          height: exportHourHeight,
                          left: 0,
                          right: 0,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontSize: exportCompactGrid ? 9 : 10, fontWeight: '700', color: gridLabel }}>
                          {formatHourLabel(hour)}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View
                    style={{
                      width: exportDayColumnWidth * visibleDays.length,
                      height: exportTimetableHeight,
                      position: 'relative',
                    }}
                  >
                    <View style={{ flexDirection: 'row', height: exportTimetableHeight }}>
                      {visibleDays.map((day) => (
                        <View
                          key={`export-col-${day}`}
                          style={{
                            width: exportDayColumnWidth,
                            height: exportTimetableHeight,
                            backgroundColor: gridFrameBg,
                            borderLeftWidth: 1,
                            borderLeftColor: gridLine,
                          }}
                        />
                      ))}
                    </View>

                    {hourBoundaries.map((hour, index) => (
                      <View
                        key={`export-boundary-${hour}`}
                        style={{
                          position: 'absolute',
                          top: index * exportHourHeight,
                          left: -exportTimeColumnWidth,
                          right: 0,
                          height: 1,
                          backgroundColor: gridLine,
                        }}
                      />
                    ))}

                    {scheduledCourses.flatMap((course) => {
                      const courseDays = getDaysArray(course.days);
                      const startHour = getCourseStartHour(course.time);
                      const endHour = getCourseEndHour(course.time);
                      const top = (startHour - displayStartHour) * exportHourHeight;
                      const height = (endHour - startHour) * exportHourHeight;
                      const { bg, text, border } = getTimetableBlockColors(course, blockTheme, isDark);

                      return courseDays.map((day) => {
                        const dayIndex = visibleDays.indexOf(day);
                        if (dayIndex === -1) return null;
                        const canShowSecondary = height >= 28;
                        const canShowTime = height >= 42;

                        return (
                          <View
                            key={`export-${course.id}-${day}`}
                            style={{
                              position: 'absolute',
                              top: top + 1.5,
                              left: dayIndex * exportDayColumnWidth + 1.5,
                              width: exportDayColumnWidth - 3,
                              height: Math.max(height - 3, 16),
                              backgroundColor: bg,
                              borderRadius: 7,
                              borderWidth: 1,
                              borderColor: border,
                              paddingHorizontal: 4,
                              paddingVertical: 3,
                              overflow: 'hidden',
                            }}
                          >
                              {showCode && (
                                <Text
                                  style={{ color: text, fontWeight: '800', fontSize: exportCodeFontSize, lineHeight: exportCompactGrid ? 10 : 11 }}
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  {course.code}
                                </Text>
                              )}
                              {showClassName && canShowSecondary && (
                                <Text
                                  style={{ color: text, fontWeight: '600', fontSize: exportMetaFontSize, lineHeight: exportCompactGrid ? 9 : 10, opacity: 0.88 }}
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  {course.title}
                                </Text>
                              )}
                              {showTime && canShowTime && (
                                <Text
                                  style={{ color: text, fontSize: exportTimeFontSize, opacity: 0.68, marginTop: 1 }}
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  {formatCourseTimeRange12(course.time, { compact: true })}
                                </Text>
                              )}
                          </View>
                        );
                      });
                    })}
                  </View>
                </View>
              </View>
            </View>

            {tbaCourses.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 }}>
                  TBA / Online
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {tbaCourses.map((course) => {
                    const { bg, text, border } = getTimetableBlockColors(course, blockTheme, isDark);
                    const courseLocation = displayCourseLocation(course.location, school);
                    return (
                      <View
                        key={`export-tba-${course.id}`}
                        style={{
                          backgroundColor: bg,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: border,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                          minWidth: 104,
                          maxWidth: 180,
                        }}
                      >
                          <Text style={{ color: text, fontWeight: '800', fontSize: 10 }} numberOfLines={1} ellipsizeMode="tail">
                            {course.code}
                          </Text>
                          <Text style={{ color: text, fontSize: 8, opacity: 0.82, marginTop: 2 }} numberOfLines={1} ellipsizeMode="tail">
                            {course.title}
                          </Text>
                        <Text style={{ color: text, fontSize: 8, opacity: 0.58, marginTop: 2, fontWeight: '600' }}>
                          {courseLocation?.toLowerCase().includes('online') || courseLocation?.toLowerCase().includes('remote') ? 'Online' : 'TBA'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {exportFormat !== 'clean' && (
            <View
              style={{
                marginTop: exportFormat === 'square' ? 9 : 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text }}>
                Built with ClassMate
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.brand }}>
                Schedule · Classmates · Boards
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

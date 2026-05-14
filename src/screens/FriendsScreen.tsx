import React, { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  PanResponder,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Course,
  Quarter,
  DEFAULT_TIMETABLE_SETTINGS,
  formatCourseTimeRange12,
  formatHourLabel12,
  getBlockColors,
  quarterKey,
} from '../data/courses';
import {
  buildSectionMatchKey,
  getSharedClassMatch,
  isCustomCourse,
  normalizeCourseCode,
  type SharedClassMatch,
} from '../data/sharedClasses';
import { DEFAULT_UNIVERSITY, getAcademicTermForDate, getSchoolConfig, termLabel } from '../data/schools';
import { abbreviateMajor, type TimetableVisibility } from '../data/userPreferences';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { isMissingSchoolColumnError } from '../lib/supabaseErrors';
import type { ChatTarget } from '../data/messages';

function plainTermLabel(term: Quarter) {
  return `${term.quarter} ${term.year}`;
}

type Friend = {
  id: string;
  name: string;
  email: string;
  major: string;
  year: string;
  timetableVisibility: TimetableVisibility;
  timetables: Record<string, Course[]>;
};

type PendingFriend = {
  id: string;
  name: string;
  email: string;
  major: string;
  year: string;
};

type ProfileRow = {
  id: string;
  email: string;
  name: string | null;
  major: string | null;
  year: string | null;
  school: string | null;
};

type FriendRequestRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
};

type TimetableRow = {
  user_id: string;
  quarter_key: string;
  courses: Course[] | null;
};

type UserSettingsRow = {
  user_id: string;
  timetable_visibility: TimetableVisibility | null;
};

type SharedClassGroup = {
  key: string;
  course: Course;
  friends: Friend[];
  matchType: SharedClassMatch;
};

type UserSharedCourseGroup = {
  key: string;
  course: Course;
  courses: Course[];
};

type SharedCourseSummary = {
  course: Course;
  matchType: SharedClassMatch;
};

const DEFAULT_DAYS = ['M', 'T', 'W', 'Th', 'F'];
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 17;
const TIME_LABEL_WIDTH = 44;
const GRID_LEFT_PAD = 16;
const DAY_LABEL: Record<string, string> = {
  M: 'Mon', T: 'Tue', W: 'Wed', Th: 'Thu', F: 'Fri', Sa: 'Sat', Su: 'Sun',
};

function parseHour(time: string | undefined) {
  if (!time || !time.includes(':')) return 0;
  const [h, m] = time.split(':');
  return Number(h) + Number(m) / 60;
}

function startHour(t: string) {
  return parseHour(t?.split(' - ')[0]);
}

function endHour(t: string) {
  return parseHour(t?.split(' - ')[1]);
}

function isValidTime(t: string) {
  return !!t && t !== 'TBA' && t.includes(' - ');
}

function fmtHour(h: number) {
  return formatHourLabel12(h);
}

function parseDays(s: string) {
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const two = s.slice(i, i + 2);
    if (two === 'Th' || two === 'Sa' || two === 'Su') {
      out.push(two);
      i += 2;
      continue;
    }
    const one = s[i];
    if ('MTWF'.includes(one)) out.push(one);
    i++;
  }
  return out;
}

function getProfLastName(professor: string) {
  const last = professor.split(',')[0].trim();
  if (!last) return professor;
  return last.charAt(0).toUpperCase() + last.slice(1).toLowerCase();
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function firstLastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name.trim();
  return parts[0] + ' ' + parts[parts.length - 1];
}

function buildSharedCourseGroupKey(course: Course) {
  if (isCustomCourse(course)) return `section:${buildSectionMatchKey(course)}`;
  return `course:${normalizeCourseCode(course)}`;
}

function strongestSharedClassMatch(userCourses: Course[], friendCourses: Course[]): SharedClassMatch | null {
  let hasSameCourse = false;
  for (const userCourse of userCourses) {
    for (const friendCourse of friendCourses) {
      const match = getSharedClassMatch(userCourse, friendCourse);
      if (match === 'same_section') return 'same_section';
      if (match === 'same_course') hasSameCourse = true;
    }
  }
  return hasSameCourse ? 'same_course' : null;
}

function mapProfileToFriend(
  profile: ProfileRow,
  timetables: Record<string, Course[]> = {},
  timetableVisibility: TimetableVisibility = 'friends'
): Friend {
  return {
    id: profile.id,
    name: profile.name?.trim() || profile.email.split('@')[0],
    email: profile.email,
    major: abbreviateMajor(profile.major) || 'UNDECL',
    year: profile.year?.trim() || 'Student',
    timetableVisibility,
    timetables,
  };
}

type Props = {
  userId: string;
  userEmail?: string;
  school: string;
  activeCourses: Course[];
  selectedQuarter: Quarter;
  topInset?: number;
  bottomInset?: number;
  scrollToTopTrigger?: number;
  onOpenMessages?: () => void;
  onOpenChat?: (target: ChatTarget) => void;
  unreadMessageCount?: number;
};

export default function FriendsScreen({
  userId,
  userEmail,
  school,
  activeCourses: userActiveCourses,
  selectedQuarter,
  topInset = 0,
  bottomInset = 0,
  scrollToTopTrigger = 0,
  onOpenMessages,
  onOpenChat,
  unreadMessageCount = 0,
}: Props) {
  const { colors } = useTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const screenWidthRef = useRef(screenWidth);
  useEffect(() => { screenWidthRef.current = screenWidth; }, [screenWidth]);
  const friendsScrollRef = useRef<ScrollView>(null);
  const requestsScrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (scrollToTopTrigger > 0) {
      friendsScrollRef.current?.scrollTo({ y: 0, animated: true });
      requestsScrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [scrollToTopTrigger]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingFriend[]>([]);
  const [sentRequests, setSentRequests] = useState<PendingFriend[]>([]);
  const [sentRequestIds, setSentRequestIds] = useState<string[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [emailQuery, setEmailQuery] = useState('');
  const [debouncedEmailQuery, setDebouncedEmailQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [friendQuarter, setFriendQuarter] = useState<Quarter>(getAcademicTermForDate(school, new Date()));
  const [showQuarterDropdown, setShowQuarterDropdown] = useState(false);
  const [friendAvailableQuarters, setFriendAvailableQuarters] = useState<string[]>([]);
  const [fetchingQuarters, setFetchingQuarters] = useState(false);
  const quarterDropdownAnim = useRef(new Animated.Value(0)).current;
  const quarterItemAnims = useRef<Animated.Value[]>([]);
  const friendSlideAnim = useRef(new Animated.Value(screenWidth)).current;
  const swipeFriendPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dx > 6 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderMove: (_, gs) => {
        if (gs.dx > 0) friendSlideAnim.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > screenWidthRef.current * 0.35 || gs.vx > 0.6) {
          closeFriendTimetable();
        } else {
          Animated.spring(friendSlideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 16 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(friendSlideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 16 }).start();
      },
    })
  ).current;
  const [gridWidth, setGridWidth] = useState(0);
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [submittingRequestId, setSubmittingRequestId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const schoolDomain = getSchoolConfig(school).domain || DEFAULT_UNIVERSITY.domain;

  const friend = selectedFriendId ? friends.find((f) => f.id === selectedFriendId) ?? null : null;
  const friendQuarterCourses: Course[] = friend
    ? (friend.timetables[quarterKey(friendQuarter)] ?? [])
    : [];
  const uniqueQuarterCourses: Course[] = Array.from(new Map(friendQuarterCourses.map(c => [c.id, c])).values());
  const activeCourses: Course[] = uniqueQuarterCourses.filter(c => isValidTime(c.time) && c.days !== 'TBA');
  const tbaCourses: Course[] = uniqueQuarterCourses.filter(c => !isValidTime(c.time) || c.days === 'TBA');

  const filteredFriends = useMemo(
    () =>
      friends.filter((f) => {
        const q = searchQuery.toLowerCase();
        return f.name.toLowerCase().includes(q) || f.email.toLowerCase().includes(q);
      }),
    [friends, searchQuery]
  );

  const sharedQuarterKey = quarterKey(selectedQuarter);
  const userQuarterCourseGroups = useMemo<UserSharedCourseGroup[]>(() => {
    const groups = new Map<string, UserSharedCourseGroup>();
    userActiveCourses.forEach((course) => {
      const key = buildSharedCourseGroupKey(course);
      const existing = groups.get(key);
      if (existing) {
        existing.courses.push(course);
      } else {
        groups.set(key, { key, course, courses: [course] });
      }
    });
    return Array.from(groups.values());
  }, [userActiveCourses]);

  const sharedClassGroups = useMemo<SharedClassGroup[]>(() => {
    return userQuarterCourseGroups.flatMap((group) => {
      const friendMatches = friends
        .filter((friendRow) => friendRow.timetableVisibility !== 'private')
        .flatMap((friendRow) => {
          const friendCourses = friendRow.timetables[sharedQuarterKey] ?? [];
          const matchType = strongestSharedClassMatch(group.courses, friendCourses);
          return matchType ? [{ friend: friendRow, matchType }] : [];
        });

      if (friendMatches.length === 0) return [];
      const matchType: SharedClassMatch = friendMatches.some((match) => match.matchType === 'same_section') ? 'same_section' : 'same_course';
      return [{
        key: group.key,
        course: group.course,
        friends: friendMatches.map((match) => match.friend),
        matchType,
      }];
    }).sort((left, right) => {
      if (left.matchType !== right.matchType) return left.matchType === 'same_section' ? -1 : 1;
      if (right.friends.length !== left.friends.length) return right.friends.length - left.friends.length;
      return left.course.code.localeCompare(right.course.code);
    });
  }, [friends, sharedQuarterKey, userQuarterCourseGroups]);

  const sharedCoursesByFriendId = useMemo(() => {
    const map: Record<string, SharedCourseSummary[]> = {};
    sharedClassGroups.forEach((group) => {
      group.friends.forEach((friendRow) => {
        if (!map[friendRow.id]) map[friendRow.id] = [];
        map[friendRow.id].push({ course: group.course, matchType: group.matchType });
      });
    });
    return map;
  }, [sharedClassGroups]);
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedEmailQuery(emailQuery.trim()), 300);
    return () => clearTimeout(timeout);
  }, [emailQuery]);

  const classmateCacheKey = `classmates_${userId}_${school}`;

  useEffect(() => {
    if (!userId) return;

    async function loadClassmates() {
      const cached = await AsyncStorage.getItem(classmateCacheKey);
      if (cached) {
        const { friends: cf, pendingRequests: cp, sentRequests: cs, sentRequestIds: csi } = JSON.parse(cached);
        setFriends(cf ?? []);
        setPendingRequests(cp ?? []);
        setSentRequests(cs ?? []);
        setSentRequestIds(csi ?? []);
        setFriendsLoading(false);
      } else {
        setFriendsLoading(true);
      }

      let { data: requestRows, error: requestsError } = await supabase
        .from('friend_requests')
        .select('id, sender_id, receiver_id, status')
        .eq('school', school)
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

      if (requestsError && school === DEFAULT_UNIVERSITY.name && isMissingSchoolColumnError(requestsError)) {
        const fallback = await supabase
          .from('friend_requests')
          .select('id, sender_id, receiver_id, status')
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
        requestRows = fallback.data;
        requestsError = fallback.error;
      }

      if (requestsError) {
        if (isMissingSchoolColumnError(requestsError)) {
          setFriends([]);
          setPendingRequests([]);
          setSentRequests([]);
          setSentRequestIds([]);
          setFriendsLoading(false);
          return;
        }
        console.error('Failed to load friend requests:', requestsError);
        setFriendsLoading(false);
        return;
      }

      const requests = (requestRows ?? []) as FriendRequestRow[];
      const acceptedIds = Array.from(
        new Set(
          requests
            .filter((row) => row.status === 'accepted')
            .map((row) => (row.sender_id === userId ? row.receiver_id : row.sender_id))
        )
      );

      const incomingPendingIds = Array.from(
        new Set(
          requests
            .filter((row) => row.status === 'pending' && row.receiver_id === userId)
            .map((row) => row.sender_id)
        )
      );

      const outgoingPendingIds = Array.from(
        new Set(
          requests
            .filter((row) => row.status === 'pending' && row.sender_id === userId)
            .map((row) => row.receiver_id)
        )
      );

      const profileIds = Array.from(new Set([...acceptedIds, ...incomingPendingIds, ...outgoingPendingIds]));
      let profilesById: Record<string, ProfileRow> = {};

      if (profileIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email, name, major, year, school')
          .eq('school', school)
          .in('id', profileIds);

        if (profilesError) {
          console.error('Failed to load profiles:', profilesError);
        } else {
          profilesById = Object.fromEntries(((profilesData ?? []) as ProfileRow[]).map((row) => [row.id, row]));
        }
      }

      let visibilityByUserId: Record<string, TimetableVisibility> = {};
      if (acceptedIds.length > 0) {
        let { data: settingsRows, error: settingsError } = await supabase
          .rpc('get_friend_timetable_visibility', {
            friend_ids: acceptedIds,
            target_school: school,
          });

        if (settingsError?.code === 'PGRST202' || settingsError?.code === '42883') {
          const fallback = await supabase
            .from('user_settings')
            .select('user_id, timetable_visibility')
            .in('user_id', acceptedIds);
          settingsRows = fallback.data;
          settingsError = fallback.error;
        }

        if (settingsError && settingsError.code !== 'PGRST205') {
          console.error('Failed to load friend visibility settings:', settingsError);
        } else {
          visibilityByUserId = Object.fromEntries(
            ((settingsRows ?? []) as UserSettingsRow[]).map((row) => [
              row.user_id,
              row.timetable_visibility ?? 'friends',
            ])
          );
        }
      }

      const friendTimetablesByUser: Record<string, Record<string, Course[]>> = {};
      if (acceptedIds.length > 0) {
        const { data: timetableRows, error: timetablesError } = await supabase
          .from('timetables')
          .select('user_id, quarter_key, courses')
          .eq('school', school)
          .in('user_id', acceptedIds);

        if (timetablesError) {
          console.error('Failed to load friend timetables:', timetablesError);
        } else {
          for (const row of (timetableRows ?? []) as TimetableRow[]) {
            if ((visibilityByUserId[row.user_id] ?? 'friends') === 'private') continue;
            if (!friendTimetablesByUser[row.user_id]) friendTimetablesByUser[row.user_id] = {};
            friendTimetablesByUser[row.user_id][row.quarter_key] = [
              ...(friendTimetablesByUser[row.user_id][row.quarter_key] ?? []),
              ...(row.courses ?? []),
            ];
          }
        }
      }

      const freshFriends = acceptedIds
        .map((id) => profilesById[id])
        .filter((profile): profile is ProfileRow => !!profile)
        .map((profile) =>
          mapProfileToFriend(
            profile,
            friendTimetablesByUser[profile.id] ?? {},
            visibilityByUserId[profile.id] ?? 'friends'
          )
        );
      const freshPending = incomingPendingIds
        .map((id) => profilesById[id])
        .filter((profile): profile is ProfileRow => !!profile)
        .map((profile) => ({
          id: profile.id,
          name: profile.name?.trim() || profile.email.split('@')[0],
          email: profile.email,
          major: abbreviateMajor(profile.major) || 'UNDECL',
          year: profile.year?.trim() || 'Student',
        }));
      const freshSent = outgoingPendingIds
        .map((id) => profilesById[id])
        .filter((profile): profile is ProfileRow => !!profile)
        .map((profile) => ({
          id: profile.id,
          name: profile.name?.trim() || profile.email.split('@')[0],
          email: profile.email,
          major: abbreviateMajor(profile.major) || 'UNDECL',
          year: profile.year?.trim() || 'Student',
        }));

      setFriends(freshFriends);
      setPendingRequests(freshPending);
      setSentRequests(freshSent);
      setSentRequestIds(outgoingPendingIds);
      setFriendsLoading(false);

      AsyncStorage.setItem(classmateCacheKey, JSON.stringify({
        friends: freshFriends,
        pendingRequests: freshPending,
        sentRequests: freshSent,
        sentRequestIds: outgoingPendingIds,
      }));
    }

    loadClassmates();
  }, [classmateCacheKey, school, userId]);

  useEffect(() => {
    if (!showAddModal || !debouncedEmailQuery || debouncedEmailQuery.length < 2 || !userId) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    async function searchUsers() {
      setSearchLoading(true);
      const existingIds = new Set(friends.map((f) => f.id));
      const pendingIds = new Set(pendingRequests.map((p) => p.id));
      const outgoingIds = new Set(sentRequestIds);

      const emailTerm = debouncedEmailQuery.includes('@')
        ? debouncedEmailQuery.split('@')[0]
        : debouncedEmailQuery;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, name, major, year, school')
        .eq('school', school)
        .or(`email.ilike.%${emailTerm}%,name.ilike.%${debouncedEmailQuery}%`)
        .limit(50);

      if (error) {
        console.error('Failed to search users:', error);
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }

      const term = emailTerm.toLowerCase();
      const nameTerm = debouncedEmailQuery.toLowerCase();

      setSearchResults(
        ((data ?? []) as ProfileRow[])
          .filter((profile) => profile.id !== userId)
          .filter((profile) => !userEmail || profile.email.toLowerCase() !== userEmail.toLowerCase())
          .filter((profile) => !existingIds.has(profile.id))
          .filter((profile) => !pendingIds.has(profile.id))
          .filter((profile) => !outgoingIds.has(profile.id))
          .filter((profile) => {
            const localPart = profile.email.split('@')[0].toLowerCase();
            const nameMatch = (profile.name ?? '').toLowerCase().includes(nameTerm);
            return localPart.includes(term) || nameMatch;
          })
          .map((profile) => mapProfileToFriend(profile))
      );
      setSearchLoading(false);
    }

    searchUsers();
  }, [debouncedEmailQuery, friends, pendingRequests, school, sentRequestIds, showAddModal, userEmail, userId]);

  // Re-fetch the selected friend's timetables when their view opens or dropdown opens
  useEffect(() => {
    if (!selectedFriendId) return;
    async function refreshFriendTimetables() {
      const { data: rows, error } = await supabase
        .from('timetables')
        .select('quarter_key, courses')
        .eq('school', school)
        .eq('user_id', selectedFriendId);
      if (error || !rows || rows.length === 0) return;
      const timetables: Record<string, Course[]> = {};
      for (const row of rows as { quarter_key: string; courses: Course[] | null }[]) {
        timetables[row.quarter_key] = [
          ...(timetables[row.quarter_key] ?? []),
          ...(row.courses ?? []),
        ];
      }
      setFriends((prev) =>
        prev.map((f) => (f.id === selectedFriendId ? { ...f, timetables } : f))
      );
    }
    refreshFriendTimetables();
  }, [school, selectedFriendId]);

  function openFriendTimetable(friendId: string) {
    friendSlideAnim.setValue(screenWidthRef.current);
    setSelectedFriendId(friendId);
    Animated.spring(friendSlideAnim, { toValue: 0, useNativeDriver: true, tension: 120, friction: 18 }).start();
  }

  function closeFriendTimetable() {
    Animated.timing(friendSlideAnim, { toValue: screenWidthRef.current, duration: 220, useNativeDriver: true }).start(() => {
      setSelectedFriendId(null);
      friendSlideAnim.setValue(screenWidthRef.current);
    });
  }

  function parseQuarterKey(key: string): Quarter {
    const idx = key.indexOf('-');
    return { year: key.slice(0, idx), quarter: key.slice(idx + 1) };
  }

  function closeQuarterDropdown() {
    Animated.timing(quarterDropdownAnim, { toValue: 0, duration: 150, easing: Easing.in(Easing.ease), useNativeDriver: true })
      .start(() => setShowQuarterDropdown(false));
  }

  const openQuarterDropdown = async () => {
    quarterDropdownAnim.setValue(1);
    quarterItemAnims.current.forEach((v) => v.setValue(0));
    setShowQuarterDropdown(true);
    if (!selectedFriendId) return;
    setFetchingQuarters(true);
    const { data, error } = await supabase
      .from('timetables')
      .select('quarter_key')
      .eq('school', school)
      .eq('user_id', selectedFriendId);
    if (!error && data) {
      const keys = [...new Set((data as { quarter_key: string }[]).map(r => r.quarter_key))];
      keys.sort((a, b) => b.localeCompare(a));
      while (quarterItemAnims.current.length < keys.length) {
        quarterItemAnims.current.push(new Animated.Value(0));
      }
      quarterItemAnims.current.forEach((v) => v.setValue(0));
      setFriendAvailableQuarters(keys);
      if (keys.length > 0) {
        setFriendQuarter(parseQuarterKey(keys[0]));
      }
      Animated.stagger(45, keys.map((_, i) =>
        Animated.spring(quarterItemAnims.current[i], { toValue: 1, useNativeDriver: true, tension: 260, friction: 22 })
      )).start();
    }
    setFetchingQuarters(false);
  };

  const closeAddModal = () => {
    setEmailQuery('');
    setDebouncedEmailQuery('');
    setSearchResults([]);
    setShowAddModal(false);
  };

  const sendFriendRequest = async (target: Friend) => {
    if (!userId) return;

    setSubmittingRequestId(target.id);
    let { data: existingRows, error: existingError } = await supabase
      .from('friend_requests')
      .select('id, status')
      .eq('school', school)
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${userId})`);

    if (existingError && school === DEFAULT_UNIVERSITY.name && isMissingSchoolColumnError(existingError)) {
      const fallback = await supabase
        .from('friend_requests')
        .select('id, status')
        .or(`and(sender_id.eq.${userId},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${userId})`);
      existingRows = fallback.data;
      existingError = fallback.error;
    }

    if (existingError) {
      setSubmittingRequestId(null);
      Alert.alert('Could not send request', existingError.message);
      return;
    }

    const activeRow = (existingRows ?? []).find(r => r.status === 'pending' || r.status === 'accepted');
    if (activeRow) {
      setSubmittingRequestId(null);
      Alert.alert('Request already exists', 'You already have a pending or active friend request with this user.');
      return;
    }

    let { error } = await supabase.from('friend_requests').insert({
      school,
      sender_id: userId,
      receiver_id: target.id,
      status: 'pending',
    });

    if (error && school === DEFAULT_UNIVERSITY.name && isMissingSchoolColumnError(error)) {
      const fallback = await supabase.from('friend_requests').insert({
        sender_id: userId,
        receiver_id: target.id,
        status: 'pending',
      });
      error = fallback.error;
    }

    setSubmittingRequestId(null);

    if (error) {
      Alert.alert('Could not send request', error.message);
      return;
    }

    setSentRequestIds((prev) => [...prev, target.id]);
    setSentRequests((prev) => [...prev, {
      id: target.id, name: target.name, email: target.email,
      major: target.major, year: target.year,
    }]);
    Alert.alert('Request sent', `Your friend request was sent to ${target.name}.`);
  };

  const handleRespondToRequest = async (requesterId: string, status: 'accepted' | 'rejected') => {
    if (status === 'accepted') {
      let { error } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('school', school)
        .eq('sender_id', requesterId)
        .eq('receiver_id', userId)
        .eq('status', 'pending');

      if (error && school === DEFAULT_UNIVERSITY.name && isMissingSchoolColumnError(error)) {
        const fallback = await supabase
          .from('friend_requests')
          .update({ status: 'accepted' })
          .eq('sender_id', requesterId)
          .eq('receiver_id', userId)
          .eq('status', 'pending');
        error = fallback.error;
      }

      if (error) {
        Alert.alert('Request update failed', error.message);
        return;
      }

      const request = pendingRequests.find((row) => row.id === requesterId);
      setPendingRequests((prev) => prev.filter((row) => row.id !== requesterId));
      if (request) setFriends((prev) => [...prev, { ...request, timetableVisibility: 'friends', timetables: {} }]);
    } else {
      let { error } = await supabase
        .from('friend_requests')
        .delete()
        .eq('school', school)
        .eq('sender_id', requesterId)
        .eq('receiver_id', userId)
        .eq('status', 'pending');

      if (error && school === DEFAULT_UNIVERSITY.name && isMissingSchoolColumnError(error)) {
        const fallback = await supabase
          .from('friend_requests')
          .delete()
          .eq('sender_id', requesterId)
          .eq('receiver_id', userId)
          .eq('status', 'pending');
        error = fallback.error;
      }

      if (error) {
        Alert.alert('Request update failed', error.message);
        return;
      }

      setPendingRequests((prev) => prev.filter((row) => row.id !== requesterId));
    }
  };

  const handleCancelRequest = async (receiverId: string) => {
    let { error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('school', school)
      .eq('sender_id', userId)
      .eq('receiver_id', receiverId)
      .eq('status', 'pending');

    if (error && school === DEFAULT_UNIVERSITY.name && isMissingSchoolColumnError(error)) {
      const fallback = await supabase
        .from('friend_requests')
        .delete()
        .eq('sender_id', userId)
        .eq('receiver_id', receiverId)
        .eq('status', 'pending');
      error = fallback.error;
    }

    if (error) {
      Alert.alert('Could not cancel request', error.message);
      return;
    }

    setSentRequests((prev) => prev.filter((r) => r.id !== receiverId));
    setSentRequestIds((prev) => prev.filter((id) => id !== receiverId));
  };

  const handleDeleteFriend = async (friendId: string) => {
    let [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('friend_requests').delete().eq('school', school).eq('sender_id', userId).eq('receiver_id', friendId),
      supabase.from('friend_requests').delete().eq('school', school).eq('sender_id', friendId).eq('receiver_id', userId),
    ]);

    if (school === DEFAULT_UNIVERSITY.name && ((e1 && isMissingSchoolColumnError(e1)) || (e2 && isMissingSchoolColumnError(e2)))) {
      const [fallback1, fallback2] = await Promise.all([
        supabase.from('friend_requests').delete().eq('sender_id', userId).eq('receiver_id', friendId),
        supabase.from('friend_requests').delete().eq('sender_id', friendId).eq('receiver_id', userId),
      ]);
      e1 = fallback1.error;
      e2 = fallback2.error;
    }

    if (e1 || e2) {
      Alert.alert('Could not remove friend', (e1 ?? e2)!.message);
      return;
    }

    setFriends((prev) => prev.filter((f) => f.id !== friendId));
    setSentRequestIds((prev) => prev.filter((id) => id !== friendId));
  };

  const visibleDays = useMemo(() => {
    const used = new Set<string>();
    activeCourses.forEach((c) => parseDays(c.days).forEach((d) => used.add(d)));
    const days = [...DEFAULT_DAYS];
    if (used.has('Sa')) days.push('Sa');
    if (used.has('Su')) days.push('Su');
    return days;
  }, [activeCourses]);

  const { displayStart, displayEnd } = useMemo(() => {
    if (!activeCourses.length) return { displayStart: DEFAULT_START_HOUR, displayEnd: DEFAULT_END_HOUR };
    const earliest = Math.min(...activeCourses.map((c) => startHour(c.time)));
    const latest = Math.max(...activeCourses.map((c) => endHour(c.time)));
    return {
      displayStart: Math.min(DEFAULT_START_HOUR, Math.floor(earliest)),
      displayEnd: Math.max(DEFAULT_END_HOUR, Math.ceil(latest)),
    };
  }, [activeCourses]);

  const totalHours = displayEnd - displayStart;
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const timetableHeight = scrollViewHeight > 0 ? scrollViewHeight - 14 : 400;
  const hourPx = timetableHeight / (totalHours + 1);
  const hourLabels = Array.from({ length: totalHours + 1 }, (_, i) => displayStart + i);
  const usableW =
    gridWidth > 0
      ? gridWidth - TIME_LABEL_WIDTH
      : screenWidth - GRID_LEFT_PAD - 24 - TIME_LABEL_WIDTH;
  const dayColW = usableW / visibleDays.length;
  const compactGrid = visibleDays.length >= 6 || totalHours >= 11;

  const timetableTheme = DEFAULT_TIMETABLE_SETTINGS.theme;
  const gridFrameBg = colors.card;
  const gridFrameBorder = colors.border;
  const gridHeaderBg = colors.bgTertiary;
  const gridLine = colors.border;
  const gridLabel = colors.textTertiary;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* ClassMates list — always rendered so it shows behind the sliding overlay */}
      <View style={{ flex: 1 }}>
        <Modal
          transparent
          animationType="fade"
          visible={showAddModal}
          onRequestClose={closeAddModal}
        >
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <TouchableOpacity
              style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' }}
              activeOpacity={1}
              onPress={() => { Keyboard.dismiss(); closeAddModal(); }}
            />
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              pointerEvents="box-none"
            >
              <View style={{
                backgroundColor: colors.card, borderRadius: 18, padding: 24, width: 300,
                maxHeight: Math.max(360, screenHeight - 64),
                shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.18, shadowRadius: 16, elevation: 10,
              }}>
                  <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                  <View>
                  <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 16, color: colors.text }}>
                    Add Friend
                  </Text>
                  <View style={{
                    backgroundColor: colors.brandBg,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 11,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.brand, marginBottom: 4 }}>
                      Search by Name or Email
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
                      Enter a name or university email to find another student and send them a friend request.
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 }}>
                    Name or Email
                  </Text>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    backgroundColor: colors.inputBg,
                    marginBottom: 16,
                  }}>
                    <Ionicons name="search-outline" size={16} color={colors.placeholder} />
                    <TextInput
                      placeholder={`Name or student${schoolDomain}`}
                      placeholderTextColor={colors.placeholder}
                      value={emailQuery}
                      onChangeText={setEmailQuery}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="search"
                      autoFocus
                      style={{ flex: 1, fontSize: 15, color: colors.text }}
                    />
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 }}>
                    Search Results
                  </Text>
                  </View>
                  </TouchableWithoutFeedback>
                  <View style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    overflow: 'hidden',
                    marginBottom: 18,
                    backgroundColor: colors.bg,
                  }}>
                    {!emailQuery.trim() ? (
                      <View style={{ paddingHorizontal: 14, paddingVertical: 16, backgroundColor: colors.bgSecondary }}>
                        <Text style={{ fontSize: 13, color: colors.textTertiary }}>
                          Type a name or email above to start searching.
                        </Text>
                      </View>
                    ) : emailQuery.trim().length < 2 ? (
                      <View style={{ paddingHorizontal: 14, paddingVertical: 16, backgroundColor: colors.bgSecondary }}>
                        <Text style={{ fontSize: 13, color: colors.textTertiary }}>
                          Type at least 2 characters to search.
                        </Text>
                      </View>
                    ) : searchLoading ? (
                      <View style={{ paddingHorizontal: 14, paddingVertical: 16, backgroundColor: colors.bgSecondary }}>
                        <Text style={{ fontSize: 13, color: colors.textTertiary }}>
                          Searching users...
                        </Text>
                      </View>
                    ) : searchResults.length === 0 ? (
                      <View style={{ paddingHorizontal: 14, paddingVertical: 16, backgroundColor: colors.bgSecondary }}>
                        <Text style={{ fontSize: 13, color: colors.textTertiary }}>
                          No user matched that search.
                        </Text>
                      </View>
                    ) : (
                      <ScrollView style={{ maxHeight: 294 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true}>
                        {searchResults.map((user, index) => (
                          <View
                            key={user.id}
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 14,
                              borderTopWidth: index === 0 ? 0 : 1,
                              borderTopColor: colors.borderSubtle,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                            }}
                          >
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{firstLastName(user.name)}</Text>
                              <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{user.email}</Text>
                              <Text numberOfLines={2} ellipsizeMode="tail" style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
                                {user.major} • {user.year}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => { Keyboard.dismiss(); sendFriendRequest(user); }}
                              disabled={submittingRequestId === user.id}
                              style={{
                                backgroundColor: colors.brand,
                                borderRadius: 16,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                opacity: submittingRequestId === user.id ? 0.7 : 1,
                              }}
                            >
                              <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>
                                {submittingRequestId === user.id ? 'Sending...' : 'Send Request'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      onPress={closeAddModal}
                      style={{
                        flex: 1, paddingVertical: 11, borderRadius: 10,
                        borderWidth: 1, borderColor: colors.border, alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <View style={{ paddingHorizontal: 18, paddingTop: topInset + 4, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 30, fontWeight: '800', letterSpacing: 0, color: colors.text }}>ClassMates</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {onOpenMessages ? (
              <TouchableOpacity
                onPress={onOpenMessages}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ position: 'relative' }}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.text} />
                {unreadMessageCount > 0 ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: -7,
                      right: -10,
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      paddingHorizontal: 4,
                      backgroundColor: colors.destructive,
                      borderWidth: 2,
                      borderColor: colors.bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: 'white', fontSize: 9, fontWeight: '800' }}>
                      {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => setShowAddModal(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="person-add-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ paddingHorizontal: 18, marginBottom: 14 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: colors.card,
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 12,
            gap: 9,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: '#0f172a',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.05,
            shadowRadius: 16,
            elevation: 3,
          }}>
            <Ionicons name="search-outline" size={18} color={colors.placeholder} />
            <TextInput
              placeholder="Search classmates..."
              placeholderTextColor={colors.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{ flex: 1, fontSize: 15, color: colors.text }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={colors.placeholder} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={{ flexDirection: 'row', paddingHorizontal: 18, gap: 8, marginBottom: 4, alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => setActiveTab('friends')}
              style={{
                flexShrink: 1,
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                backgroundColor: activeTab === 'friends' ? colors.brand : colors.bgTertiary,
              }}
            >
              <Text numberOfLines={1} ellipsizeMode="tail" style={{
                fontSize: 14, fontWeight: '600',
                color: activeTab === 'friends' ? 'white' : colors.textSecondary,
              }}>
                ClassMates ({friends.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setActiveTab('requests'); setEditMode(false); }}
              style={{
                flexShrink: 1,
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                backgroundColor: activeTab === 'requests' ? colors.brand : colors.bgTertiary,
                flexDirection: 'row', alignItems: 'center', gap: 4,
              }}
            >
              <Text numberOfLines={1} ellipsizeMode="tail" style={{
                fontSize: 14, fontWeight: '600',
                color: activeTab === 'requests' ? 'white' : colors.textSecondary,
              }}>
                Requests
              </Text>
              {(pendingRequests.length + sentRequests.length) > 0 && (
                <View style={{
                  width: 18, height: 18, borderRadius: 9,
                  backgroundColor: activeTab === 'requests' ? 'rgba(255,255,255,0.3)' : colors.destructive,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: 'white' }}>{pendingRequests.length + sentRequests.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {activeTab === 'friends' && (
            <TouchableOpacity
              onPress={() => setEditMode((prev) => !prev)}
              style={{
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                backgroundColor: editMode ? colors.destructive : colors.bgTertiary,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: editMode ? 'white' : colors.textSecondary }}>
                {editMode ? 'Done' : 'Edit'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginTop: 12 }} />

        {activeTab === 'friends' ? (
          <ScrollView ref={friendsScrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: bottomInset + 70 }}>
          <View style={{ paddingHorizontal: 18, marginTop: 12, marginBottom: 12 }}>
            <View style={{
              borderRadius: 18,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}>
              <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 5 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: colors.textTertiary }}>
                  {sharedClassGroups.length > 0 ? 'SHARED CLASSES THIS TERM' : 'NO SHARED CLASSES THIS TERM'}
                </Text>
              </View>
              {sharedClassGroups.length > 0 ? (
                sharedClassGroups.slice(0, 4).map((group, index) => (
                  <View key={group.key}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, gap: 10 }}>
                      <View style={{
                        borderRadius: 8,
                        backgroundColor: getBlockColors(group.course, 'minimal').bg,
                        borderWidth: 1,
                        borderColor: getBlockColors(group.course, 'minimal').border,
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        minWidth: 96,
                        alignItems: 'center',
                      }}>
                          <Text numberOfLines={1} ellipsizeMode="tail" style={{
                            fontSize: 12,
                            fontWeight: '800',
                            color: getBlockColors(group.course, 'minimal').text,
                          }}>
                            {group.course.code}
                          </Text>
                      </View>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                        {group.friends.slice(0, 4).map((sharedFriend, friendIndex) => (
                          <View
                            key={sharedFriend.id}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 13,
                              backgroundColor: colors.brand,
                              borderWidth: 2,
                              borderColor: colors.card,
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginLeft: friendIndex === 0 ? 0 : -7,
                            }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '800', color: 'white' }}>
                              {getInitials(sharedFriend.name).slice(0, 1)}
                            </Text>
                          </View>
                        ))}
                        {group.friends.length > 4 ? (
                          <View style={{
                            width: 26,
                            height: 26,
                            borderRadius: 13,
                            backgroundColor: colors.bgTertiary,
                            borderWidth: 2,
                            borderColor: colors.card,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginLeft: -7,
                          }}>
                            <Text style={{ fontSize: 9, fontWeight: '800', color: colors.textSecondary }}>
                              +{group.friends.length - 4}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textTertiary }}>
                        {group.friends.length}
                      </Text>
                    </View>
                    {index < Math.min(sharedClassGroups.length, 4) - 1 ? (
                      <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginHorizontal: 14 }} />
                    ) : null}
                  </View>
                ))
              ) : userQuarterCourseGroups.length > 0 ? <View style={{ height: 7 }} /> : (
                <View style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{
                      width: 36,
                      height: 36,
                      borderRadius: 11,
                      backgroundColor: colors.bgTertiary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Ionicons name="calendar-outline" size={17} color={colors.textTertiary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>No classes in {plainTermLabel(selectedQuarter)}</Text>
                      <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>Add classes to see overlaps here.</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>

          {friendsLoading ? (
            <View style={{ minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <ActivityIndicator size="small" color={colors.brand} />
              <Text style={{ fontSize: 15, color: colors.textTertiary }}>Loading classmates...</Text>
            </View>
          ) : filteredFriends.length === 0 ? (
            <View style={{ minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 18 }}>
              <Ionicons name="people-outline" size={60} color={colors.border} />
              <Text style={{ fontSize: 16, color: colors.textTertiary, fontWeight: '500' }}>No friends yet</Text>
              <Text style={{ fontSize: 13, color: colors.border }}>Tap the icon above to search by name or email</Text>
            </View>
          ) : (
            <>
              {filteredFriends.map((f, index) => (
                <View key={f.id}>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingHorizontal: 16, paddingVertical: 14,
                  }}>
                    <View style={{
                      width: 50, height: 50, borderRadius: 25,
                      backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center',
                      marginRight: 12,
                    }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>
                        {getInitials(f.name)}
                      </Text>
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{firstLastName(f.name)}</Text>
                      <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{f.email}</Text>
                      <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
                        {f.major} • {f.year}
                      </Text>
                      {sharedCoursesByFriendId[f.id]?.length > 0 ? (
                        <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 12, color: colors.brand, marginTop: 4, fontWeight: '700' }}>
                          {(() => {
                            const summaries = sharedCoursesByFriendId[f.id];
                            const visibleCodes = summaries.slice(0, 2).map((summary) => summary.course.code).join(' • ');
                            const overflowCount = summaries.length - 2;
                            return overflowCount > 0 ? `${visibleCodes} +${overflowCount}` : visibleCodes;
                          })()}
                        </Text>
                      ) : null}
                      {f.timetableVisibility === 'private' && (
                        <Text style={{ fontSize: 11, color: colors.brand, marginTop: 4, fontWeight: '700' }}>
                          Timetable is private
                        </Text>
                      )}
                    </View>

                    {!editMode && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 }}>
                        {onOpenChat ? (
                          <TouchableOpacity
                            onPress={() => onOpenChat({ id: f.id, kind: 'friend', name: f.name })}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 18,
                              backgroundColor: colors.bgTertiary,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.text} />
                          </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                          onPress={() => {
                            if (f.timetableVisibility === 'private') {
                              Alert.alert('Private timetable', `${f.name} has chosen to keep their timetable private.`);
                              return;
                            }
                            openFriendTimetable(f.id);
                          }}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 6,
                            backgroundColor: f.timetableVisibility === 'private' ? colors.bgTertiary : colors.brand,
                            borderRadius: 20,
                            paddingHorizontal: 12, paddingVertical: 7,
                          }}
                        >
                          <Ionicons name={f.timetableVisibility === 'private' ? 'lock-closed-outline' : 'calendar-outline'} size={14} color={f.timetableVisibility === 'private' ? colors.textTertiary : 'white'} />
                          <Text style={{ color: f.timetableVisibility === 'private' ? colors.textTertiary : 'white', fontSize: 13, fontWeight: '600' }}>
                            {f.timetableVisibility === 'private' ? 'Private' : 'Timetable'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {editMode ? (
                      <TouchableOpacity
                        onPress={() =>
                          Alert.alert('Remove ClassMate', `Remove ${f.name} from your ClassMates?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: () => handleDeleteFriend(f.id) },
                          ])
                        }
                        style={{
                          width: 36, height: 36, borderRadius: 18,
                          backgroundColor: colors.destructive, alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="remove-outline" size={20} color="white" />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {index < filteredFriends.length - 1 && (
                    <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginHorizontal: 16 }} />
                  )}
                </View>
              ))}
            </>
          )}
          </ScrollView>
        ) : friendsLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <ActivityIndicator size="small" color={colors.brand} />
            <Text style={{ fontSize: 15, color: colors.textTertiary }}>Loading requests...</Text>
          </View>
        ) : pendingRequests.length === 0 && sentRequests.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Ionicons name="person-add-outline" size={60} color={colors.border} />
            <Text style={{ fontSize: 16, color: colors.textTertiary, fontWeight: '500' }}>No pending requests</Text>
          </View>
        ) : (
          <ScrollView ref={requestsScrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: bottomInset + 70 }}>
            {pendingRequests.length > 0 && (
              <>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
                  RECEIVED
                </Text>
                {pendingRequests.map((req, index) => (
                  <View key={req.id}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}>
                      <View style={{
                        width: 50, height: 50, borderRadius: 25,
                        backgroundColor: colors.textTertiary, alignItems: 'center', justifyContent: 'center', marginRight: 12,
                      }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>{getInitials(req.name)}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{firstLastName(req.name)}</Text>
                        <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{req.email}</Text>
                        <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{req.major} • {req.year}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRespondToRequest(req.id, 'accepted')}
                        style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}
                      >
                        <Ionicons name="checkmark" size={18} color="white" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRespondToRequest(req.id, 'rejected')}
                        style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgTertiary, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Ionicons name="close" size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    {index < pendingRequests.length - 1 && (
                      <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginHorizontal: 16 }} />
                    )}
                  </View>
                ))}
              </>
            )}

            {sentRequests.length > 0 && (
              <>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
                  SENT
                </Text>
                {sentRequests.map((req, index) => (
                  <View key={req.id}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}>
                      <View style={{
                        width: 50, height: 50, borderRadius: 25,
                        backgroundColor: colors.textTertiary, alignItems: 'center', justifyContent: 'center', marginRight: 12,
                      }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>{getInitials(req.name)}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{firstLastName(req.name)}</Text>
                        <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{req.email}</Text>
                        <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{req.major} • {req.year}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleCancelRequest(req.id)}
                        style={{ height: 36, borderRadius: 18, paddingHorizontal: 14, backgroundColor: colors.bgTertiary, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                    {index < sentRequests.length - 1 && (
                      <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginHorizontal: 16 }} />
                    )}
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        )}
      </View>

      {/* Friend timetable overlay — slides in from the right over the classmates list */}
      {friend && (
        <Animated.View
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: colors.bg,
            transform: [{ translateX: friendSlideAnim }],
          }}
          {...swipeFriendPan.panHandlers}
        >
          <Modal transparent visible={showQuarterDropdown} onRequestClose={closeQuarterDropdown}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeQuarterDropdown}>
              <Animated.View style={{
                position: 'absolute', top: topInset + 58, right: 16,
                backgroundColor: colors.card, borderRadius: 12,
                shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
                minWidth: 160, overflow: 'hidden',
                opacity: quarterDropdownAnim,
              }}>
                {fetchingQuarters ? (
                  <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                    <ActivityIndicator size="small" color={colors.brand} style={{ marginBottom: 6 }} />
                    <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Loading…</Text>
                  </View>
                ) : friendAvailableQuarters.length === 0 ? (
                  <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 14 }}>No terms found</Text>
                  </View>
                ) : friendAvailableQuarters.map((key, i) => {
                  const q = parseQuarterKey(key);
                  const active = key === quarterKey(friendQuarter);
                  const anim = quarterItemAnims.current[i];
                  return (
                    <Animated.View
                      key={key}
                      style={{
                        opacity: anim,
                        transform: [{ translateY: anim ? anim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) : 0 }],
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => { setFriendQuarter(q); closeQuarterDropdown(); }}
                        style={{
                          paddingHorizontal: 16, paddingVertical: 12,
                          backgroundColor: active ? colors.brandBg : colors.card,
                          borderTopWidth: i === 0 ? 0 : 1,
                          borderTopColor: colors.borderSubtle,
                          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        }}
                      >
                        <Text style={{ color: active ? colors.brand : colors.text, fontWeight: active ? '700' : '400', fontSize: 14 }}>
                          {plainTermLabel(q)}
                        </Text>
                        {active && <Ionicons name="checkmark" size={16} color={colors.brand} />}
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </Animated.View>
            </TouchableOpacity>
          </Modal>

          {/* Fixed header */}
          <View style={{ paddingHorizontal: 16, paddingTop: topInset + 8, paddingBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, marginRight: 8 }}>
                <TouchableOpacity onPress={closeFriendTimetable} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="chevron-back" size={24} color={colors.brand} />
                </TouchableOpacity>
                <View style={{
                  width: 34, height: 34, borderRadius: 17,
                  backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center',
                  marginRight: 4, flexShrink: 0,
                }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: 'white' }}>
                    {getInitials(friend.name)}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 22, fontWeight: 'bold', color: colors.text }}>{firstLastName(friend.name)}</Text>
                  <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{friend.email}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  onPress={openQuarterDropdown}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: colors.card, borderRadius: 20,
                    paddingHorizontal: 12, paddingVertical: 7,
                    borderWidth: 1, borderColor: colors.border, gap: 4,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>{plainTermLabel(friendQuarter)}</Text>
                  <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Scrollable grid + banner */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
          >
            <View
              style={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: 10 }}
              onLayout={(e) => setGridWidth(e.nativeEvent.layout.width - GRID_LEFT_PAD - 24)}
            >
              <View style={{
                backgroundColor: gridFrameBg,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: gridFrameBorder,
                overflow: 'hidden',
                shadowColor: '#cfd6e4',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.18,
                shadowRadius: 18,
                elevation: 4,
              }}>
                {/* Day headers */}
                <View style={{
                  flexDirection: 'row',
                  borderBottomWidth: 1,
                  borderBottomColor: gridLine,
                  paddingLeft: GRID_LEFT_PAD,
                  backgroundColor: gridHeaderBg,
                }}>
                  <View style={{ width: TIME_LABEL_WIDTH }} />
                  {visibleDays.map((day) => (
                    <View key={day} style={{
                      width: dayColW,
                      alignItems: 'center',
                      paddingVertical: compactGrid ? 8 : 10,
                      borderLeftWidth: 1,
                      borderLeftColor: gridLine,
                      backgroundColor: gridHeaderBg,
                    }}>
                      <Text style={{ fontSize: compactGrid ? 11 : 12, fontWeight: '700', color: colors.textSecondary }}>{DAY_LABEL[day]}</Text>
                    </View>
                  ))}
                </View>

                {/* Grid body */}
                <View>
                  <View style={{ backgroundColor: gridFrameBg, height: timetableHeight }}>
                    <View style={{ flexDirection: 'row', paddingLeft: GRID_LEFT_PAD }}>
                      {/* Time labels */}
                      <View style={{ width: TIME_LABEL_WIDTH, height: timetableHeight }}>
                        {hourLabels.map((h, index) => (
                          <View key={h} style={{
                            position: 'absolute',
                            top: index * hourPx,
                            height: hourPx,
                            left: -GRID_LEFT_PAD,
                            right: 0,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Text style={{ fontSize: compactGrid ? 10 : 11, fontWeight: '700', color: gridLabel }}>{fmtHour(h)}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Day columns */}
                      <View style={{ width: dayColW * visibleDays.length, height: timetableHeight, position: 'relative' }}>
                        <View style={{ flexDirection: 'row', height: timetableHeight }}>
                          {visibleDays.map((day) => (
                            <View key={day} style={{
                              width: dayColW, height: timetableHeight,
                              backgroundColor: gridFrameBg,
                              borderLeftWidth: 1, borderLeftColor: gridLine,
                            }} />
                          ))}
                        </View>

                        {/* Hour lines extending through time column */}
                        {hourLabels.map((h, index) => (
                          <View key={h} style={{
                            position: 'absolute',
                            top: index * hourPx,
                            left: -(TIME_LABEL_WIDTH + GRID_LEFT_PAD),
                            right: 0,
                            height: 1,
                            backgroundColor: gridLine,
                          }} />
                        ))}

                        {activeCourses.flatMap((course) => {
                          const sh = startHour(course.time);
                          const eh = endHour(course.time);
                          const top = (sh - displayStart) * hourPx;
                          const height = (eh - sh) * hourPx;
                          const { bg, text, border } = getBlockColors(course, timetableTheme);
                          return parseDays(course.days).map((day) => {
                            const col = visibleDays.indexOf(day);
                            if (col === -1) return null;
                            return (
                              <View
                                key={`${course.id}-${day}`}
                                style={{
                                  position: 'absolute',
                                  top: top + 2, left: col * dayColW + 2,
                                  width: dayColW - 4, height: height - 4,
                                  backgroundColor: bg, borderRadius: 8,
                                  borderWidth: 1, borderColor: border,
                                  paddingLeft: compactGrid ? 5 : 6, paddingRight: 4,
                                  paddingTop: compactGrid ? 4 : 5, paddingBottom: 4,
                                  overflow: 'hidden',
                                }}
                              >
                                  <Text style={{ color: text, fontWeight: '800', fontSize: compactGrid ? 9 : 10, lineHeight: compactGrid ? 12 : 13 }} numberOfLines={1} ellipsizeMode="tail">{course.code}</Text>
                                  <Text style={{ color: text, fontWeight: '600', fontSize: compactGrid ? 8 : 9, lineHeight: compactGrid ? 10 : 12, opacity: 0.85 }} numberOfLines={1} ellipsizeMode="tail">{course.title}</Text>
                                  {course.location ? (
                                    <Text style={{ color: text, fontSize: compactGrid ? 8 : 9, opacity: 0.75, marginTop: 2 }} numberOfLines={1} ellipsizeMode="tail">{course.location}</Text>
                                  ) : null}
                                  <Text style={{ color: text, fontSize: compactGrid ? 8 : 9, opacity: 0.7, marginTop: 1 }} numberOfLines={1} ellipsizeMode="tail">{getProfLastName(course.professor)}</Text>
                                  <Text style={{ color: text, fontSize: compactGrid ? 7 : 8, opacity: 0.6, marginTop: 1 }} numberOfLines={1} ellipsizeMode="tail">{formatCourseTimeRange12(course.time, { compact: true })}</Text>
                              </View>
                            );
                          });
                        })}
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {tbaCourses.length > 0 && (
              <View style={{ paddingHorizontal: 12, marginTop: 4, marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {tbaCourses.map((course) => {
                    const { bg, text, border } = getBlockColors(course, timetableTheme);
                    return (
                      <View key={course.id} style={{
                        backgroundColor: bg, borderRadius: 8, borderWidth: 1, borderColor: border,
                        paddingHorizontal: 10, paddingVertical: 8, minWidth: 100, maxWidth: 160,
                      }}>
                          <Text style={{ color: text, fontWeight: '800', fontSize: compactGrid ? 9 : 10 }} numberOfLines={1} ellipsizeMode="tail">{course.code}</Text>
                          <Text style={{ color: text, fontWeight: '600', fontSize: compactGrid ? 8 : 9, opacity: 0.85 }} numberOfLines={1} ellipsizeMode="tail">{course.title}</Text>
                          <Text style={{ color: text, fontSize: compactGrid ? 8 : 9, opacity: 0.7, marginTop: 2 }} numberOfLines={1} ellipsizeMode="tail">{getProfLastName(course.professor)}</Text>
                        <Text style={{ color: text, fontSize: 8, opacity: 0.55, marginTop: 2, fontWeight: '600' }}>
                          {course.location?.toLowerCase().includes('online') || course.location?.toLowerCase().includes('remote') ? 'Online' : 'TBA'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
              <View style={{
                backgroundColor: colors.brandBg,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}>
                <Ionicons name="lock-closed-outline" size={16} color={colors.brand} />
                <Text style={{ color: colors.brand, fontSize: 13, fontWeight: '600', flex: 1 }}>
                  Friend timetables are view-only. You can browse this schedule, but only your friend can edit it.
                </Text>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Alert,
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Course,
  Quarter,
  QUARTERS,
  DEFAULT_TIMETABLE_SETTINGS,
  getBlockColors,
  quarterKey,
  quarterLabel,
} from '../data/courses';
import type { TimetableVisibility } from '../data/userPreferences';
import type { ChatTarget } from '../data/messages';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';

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

const DEFAULT_DAYS = ['M', 'T', 'W', 'Th', 'F'];
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 17;
const TIME_LABEL_WIDTH = 52;
const SIDE_PADDING = 12;
const CARD_PADDING = 12;
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
  return `${h.toString().padStart(2, '0')}:00`;
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

function mapProfileToFriend(
  profile: ProfileRow,
  timetables: Record<string, Course[]> = {},
  timetableVisibility: TimetableVisibility = 'friends'
): Friend {
  return {
    id: profile.id,
    name: profile.name?.trim() || profile.email.split('@')[0],
    email: profile.email,
    major: profile.major?.trim() || 'Undeclared',
    year: profile.year?.trim() || 'Student',
    timetableVisibility,
    timetables,
  };
}

type Props = {
  onOpenMessages?: (target?: ChatTarget | null) => void;
  userId: string;
  userEmail?: string;
  school: string;
};

export default function FriendsScreen({ onOpenMessages, userId, userEmail, school }: Props) {
  const { colors } = useTheme();
  const isGuestUser = userId.startsWith('guest');
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
  const [friendQuarter, setFriendQuarter] = useState<Quarter>({ year: '2026', quarter: 'Spring' });
  const [showQuarterDropdown, setShowQuarterDropdown] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [submittingRequestId, setSubmittingRequestId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  const screenHeight = Dimensions.get('window').height;
  const friend = selectedFriendId ? friends.find((f) => f.id === selectedFriendId) ?? null : null;
  const friendQuarterCourses: Course[] = friend
    ? (friend.timetables[quarterKey(friendQuarter)] ?? [])
    : [];
  const activeCourses: Course[] = friendQuarterCourses.filter(c => isValidTime(c.time) && c.days !== 'TBA');
  const tbaCourses: Course[] = friendQuarterCourses.filter(c => !isValidTime(c.time) || c.days === 'TBA');

  const filteredFriends = useMemo(
    () =>
      friends.filter((f) => {
        const q = searchQuery.toLowerCase();
        return f.name.toLowerCase().includes(q) || f.email.toLowerCase().includes(q);
      }),
    [friends, searchQuery]
  );

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedEmailQuery(emailQuery.trim()), 300);
    return () => clearTimeout(timeout);
  }, [emailQuery]);

  const classmateCacheKey = `classmates_${userId}`;

  useEffect(() => {
    if (!userId || isGuestUser) return;

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

      const { data: requestRows, error: requestsError } = await supabase
        .from('friend_requests')
        .select('id, sender_id, receiver_id, status')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

      if (requestsError) {
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
          .in('id', profileIds);

        if (profilesError) {
          console.error('Failed to load profiles:', profilesError);
        } else {
          profilesById = Object.fromEntries(((profilesData ?? []) as ProfileRow[]).map((row) => [row.id, row]));
        }
      }

      let visibilityByUserId: Record<string, TimetableVisibility> = {};
      if (acceptedIds.length > 0) {
        const { data: settingsRows, error: settingsError } = await supabase
          .from('user_settings')
          .select('user_id, timetable_visibility')
          .in('user_id', acceptedIds);

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
          major: profile.major?.trim() || 'Undeclared',
          year: profile.year?.trim() || 'Student',
        }));
      const freshSent = outgoingPendingIds
        .map((id) => profilesById[id])
        .filter((profile): profile is ProfileRow => !!profile)
        .map((profile) => ({
          id: profile.id,
          name: profile.name?.trim() || profile.email.split('@')[0],
          email: profile.email,
          major: profile.major?.trim() || 'Undeclared',
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
  }, [isGuestUser, userId]);

  useEffect(() => {
    if (!showAddModal || !debouncedEmailQuery || !userId || isGuestUser) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    async function searchUsers() {
      setSearchLoading(true);
      const existingIds = new Set(friends.map((f) => f.id));
      const pendingIds = new Set(pendingRequests.map((p) => p.id));
      const outgoingIds = new Set(sentRequestIds);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, name, major, year, school')
        .eq('school', school)
        .ilike('email', `%${debouncedEmailQuery}%`)
        .limit(8);

      if (error) {
        console.error('Failed to search users:', error);
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }

      setSearchResults(
        ((data ?? []) as ProfileRow[])
          .filter((profile) => profile.id !== userId)
          .filter((profile) => !userEmail || profile.email.toLowerCase() !== userEmail.toLowerCase())
          .filter((profile) => !existingIds.has(profile.id))
          .filter((profile) => !pendingIds.has(profile.id))
          .filter((profile) => !outgoingIds.has(profile.id))
          .map((profile) => mapProfileToFriend(profile))
      );
      setSearchLoading(false);
    }

    searchUsers();
  }, [debouncedEmailQuery, friends, isGuestUser, pendingRequests, school, sentRequestIds, showAddModal, userEmail, userId]);

  const closeAddModal = () => {
    setEmailQuery('');
    setDebouncedEmailQuery('');
    setSearchResults([]);
    setShowAddModal(false);
  };

  const sendFriendRequest = async (target: Friend) => {
    if (!userId || isGuestUser) {
      Alert.alert('Sign in required', 'Please sign in to send a friend request.');
      return;
    }

    setSubmittingRequestId(target.id);
    const { data: existingRows, error: existingError } = await supabase
      .from('friend_requests')
      .select('id, status')
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${userId})`);

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

    const { error } = await supabase.from('friend_requests').insert({
      sender_id: userId,
      receiver_id: target.id,
      status: 'pending',
    });

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
    closeAddModal();
    Alert.alert('Request sent', `Your friend request was sent to ${target.name}.`);
  };

  const handleRespondToRequest = async (requesterId: string, status: 'accepted' | 'rejected') => {
    if (status === 'accepted') {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('sender_id', requesterId)
        .eq('receiver_id', userId)
        .eq('status', 'pending');

      if (error) {
        Alert.alert('Request update failed', error.message);
        return;
      }

      const request = pendingRequests.find((row) => row.id === requesterId);
      setPendingRequests((prev) => prev.filter((row) => row.id !== requesterId));
      if (request) setFriends((prev) => [...prev, { ...request, timetableVisibility: 'friends', timetables: {} }]);
    } else {
      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .eq('sender_id', requesterId)
        .eq('receiver_id', userId)
        .eq('status', 'pending');

      if (error) {
        Alert.alert('Request update failed', error.message);
        return;
      }

      setPendingRequests((prev) => prev.filter((row) => row.id !== requesterId));
    }
  };

  const handleCancelRequest = async (receiverId: string) => {
    const { error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('sender_id', userId)
      .eq('receiver_id', receiverId)
      .eq('status', 'pending');

    if (error) {
      Alert.alert('Could not cancel request', error.message);
      return;
    }

    setSentRequests((prev) => prev.filter((r) => r.id !== receiverId));
    setSentRequestIds((prev) => prev.filter((id) => id !== receiverId));
  };

  const handleDeleteFriend = async (friendId: string) => {
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('friend_requests').delete().eq('sender_id', userId).eq('receiver_id', friendId),
      supabase.from('friend_requests').delete().eq('sender_id', friendId).eq('receiver_id', userId),
    ]);

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
  const timetableHeight = Math.max(320, Math.min(448, screenHeight - 390));
  const gridViewportHeight = timetableHeight;
  const hourPx = timetableHeight / totalHours;
  const hourLabels = Array.from({ length: totalHours + 1 }, (_, i) => displayStart + i);
  const usableW =
    gridWidth > 0
      ? gridWidth - TIME_LABEL_WIDTH
      : Dimensions.get('window').width - SIDE_PADDING * 2 - CARD_PADDING * 2 - TIME_LABEL_WIDTH;
  const dayColW = usableW / visibleDays.length;
  const compactGrid = visibleDays.length >= 6 || totalHours >= 11;
  const courseCodeFontSize = compactGrid ? 9 : 10;
  const courseMetaFontSize = compactGrid ? 8 : 9;
  const courseTimeFontSize = compactGrid ? 7 : 8;
  const tbaCodeFontSize = compactGrid ? 9 : 10;
  const tbaMetaFontSize = compactGrid ? 8 : 9;

  if (friend) {
    const timetableTheme = DEFAULT_TIMETABLE_SETTINGS.theme;
    const gridFrameBg = colors.card;
    const gridFrameBorder = colors.border;
    const gridHeaderBg = colors.bgTertiary;
    const gridLine = colors.border;
    const gridLabel = colors.textTertiary;
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgSecondary }}>
        <Modal transparent animationType="fade" visible={showQuarterDropdown} onRequestClose={() => setShowQuarterDropdown(false)}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowQuarterDropdown(false)}>
            <View style={{
              position: 'absolute', top: 90, right: 16,
              backgroundColor: colors.card, borderRadius: 12,
              shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
              minWidth: 160, overflow: 'hidden',
            }}>
              {QUARTERS.filter(q => {
                const courses = friend.timetables[quarterKey(q)];
                return courses && courses.length > 0;
              }).map((q, i) => {
                const active = quarterKey(q) === quarterKey(friendQuarter);
                return (
                  <TouchableOpacity
                    key={quarterKey(q)}
                    onPress={() => {
                      setFriendQuarter(q);
                      setShowQuarterDropdown(false);
                    }}
                    style={{
                      paddingHorizontal: 16, paddingVertical: 12,
                      backgroundColor: active ? colors.brandBg : colors.card,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: colors.borderSubtle,
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ color: active ? colors.brand : colors.text, fontWeight: active ? '700' : '400', fontSize: 14 }}>
                      {quarterLabel(q)}
                    </Text>
                    {active && <Ionicons name="checkmark" size={16} color={colors.brand} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </Modal>

        <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TouchableOpacity onPress={() => setSelectedFriendId(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-back" size={24} color={colors.brand} />
              </TouchableOpacity>
              <View style={{
                width: 34, height: 34, borderRadius: 17,
                backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center',
                marginRight: 4,
              }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: 'white' }}>
                  {getInitials(friend.name)}
                </Text>
              </View>
              <View>
                <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.text }}>{friend.name}</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{friend.email}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setShowQuarterDropdown(true)}
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: colors.card, borderRadius: 20,
                paddingHorizontal: 12, paddingVertical: 7,
                borderWidth: 1, borderColor: colors.border, gap: 4,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>{quarterLabel(friendQuarter)}</Text>
              <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
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

        <View
          style={{
            marginHorizontal: SIDE_PADDING, backgroundColor: colors.card,
            borderRadius: 16, overflow: 'hidden', paddingBottom: 12,
          }}
          onLayout={(e) => setGridWidth(e.nativeEvent.layout.width - CARD_PADDING * 2)}
        >
          {tbaCourses.length > 0 && (
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: 6,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                backgroundColor: colors.card,
              }}
            >
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {tbaCourses.map((course) => {
                  const { bg, text, border } = getBlockColors(course, timetableTheme);
                  return (
                    <View
                      key={course.id}
                      style={{
                        backgroundColor: bg,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: border,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        minWidth: 100,
                        maxWidth: 160,
                      }}
                    >
                      <Text style={{ color: text, fontWeight: '800', fontSize: tbaCodeFontSize, lineHeight: compactGrid ? 12 : 13 }} numberOfLines={1}>
                        {course.code}
                      </Text>
                      <Text style={{ color: text, fontWeight: '600', fontSize: tbaMetaFontSize, lineHeight: compactGrid ? 10 : 12, opacity: 0.85 }} numberOfLines={2}>
                        {course.title}
                      </Text>
                      <Text style={{ color: text, fontSize: tbaMetaFontSize, opacity: 0.7, marginTop: 2 }} numberOfLines={1}>
                        {getProfLastName(course.professor)}
                      </Text>
                      <Text style={{ color: text, fontSize: 8, opacity: 0.55, marginTop: 2, fontWeight: '600' }}>
                        {course.location?.toLowerCase().includes('online') || course.location?.toLowerCase().includes('remote') ? 'Online' : 'TBA'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          <View
            style={{
              paddingHorizontal: CARD_PADDING,
              paddingTop: 12,
              paddingBottom: 2,
            }}
          >
            <View
              style={{
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
              }}
            >
              <View>
                <View style={{
                  flexDirection: 'row',
                  paddingLeft: CARD_PADDING,
                  backgroundColor: gridHeaderBg,
                }}>
                  <View style={{ width: TIME_LABEL_WIDTH }} />
                  {visibleDays.map((day) => (
                    <View
                      key={`scroll-header-${day}`}
                      style={{
                        width: dayColW,
                        alignItems: 'center',
                        paddingVertical: compactGrid ? 8 : 10,
                        borderLeftWidth: 1,
                        borderLeftColor: gridLine,
                        backgroundColor: gridHeaderBg,
                      }}
                    >
                      <Text style={{ fontWeight: '700', fontSize: compactGrid ? 11 : 12, color: colors.textSecondary }}>{DAY_LABEL[day]}</Text>
                    </View>
                  ))}
                </View>

                <View style={{
                  flexDirection: 'row',
                  paddingLeft: CARD_PADDING,
                  height: gridViewportHeight,
                  backgroundColor: gridFrameBg,
                }}>
                  <View style={{ width: TIME_LABEL_WIDTH, height: gridViewportHeight }}>
                    {hourLabels.map((h, i) => (
                      <View key={`line-${h}`} style={{ position: 'absolute', top: i * hourPx, left: 0, right: 0, height: 1, backgroundColor: gridLine }} />
                    ))}
                    {hourLabels.map((h, i) => (
                      <View key={h} style={{ position: 'absolute', top: i * hourPx + hourPx / 2 - 7, left: 0, right: 4, alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: compactGrid ? 10 : 11, fontWeight: '700', color: gridLabel }}>{fmtHour(h)}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={{
                    width: dayColW * visibleDays.length,
                    height: gridViewportHeight,
                    position: 'relative',
                    backgroundColor: gridFrameBg,
                  }}>
                    <View style={{ flexDirection: 'row', height: gridViewportHeight }}>
                      {visibleDays.map((day) => (
                        <View
                          key={day}
                          style={{
                            width: dayColW,
                            height: gridViewportHeight,
                            backgroundColor: gridFrameBg,
                            borderLeftWidth: 1,
                            borderLeftColor: gridLine,
                          }}
                        />
                      ))}
                    </View>

                    {hourLabels.map((h, i) => (
                      <View
                        key={h}
                        style={{
                          position: 'absolute',
                          top: i * hourPx,
                          left: 0,
                          right: 0,
                          height: 1,
                          backgroundColor: gridLine,
                        }}
                      />
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
                          <TouchableOpacity
                            key={`${course.id}-${day}`}
                            activeOpacity={0.85}
                            onPress={() => {}}
                            style={{
                              position: 'absolute',
                              top: top + 2,
                              left: col * dayColW + 2,
                              width: dayColW - 4,
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
                            <Text style={{ color: text, fontWeight: '800', fontSize: courseCodeFontSize, lineHeight: compactGrid ? 12 : 13 }} numberOfLines={1}>
                              {course.code}
                            </Text>
                            <Text style={{ color: text, fontWeight: '600', fontSize: courseMetaFontSize, lineHeight: compactGrid ? 10 : 12, opacity: 0.85 }} numberOfLines={2}>
                              {course.title}
                            </Text>
                            {course.location ? (
                              <Text style={{ color: text, fontSize: courseMetaFontSize, opacity: 0.75, marginTop: 2 }} numberOfLines={1}>
                                {course.location}
                              </Text>
                            ) : null}
                            <Text style={{ color: text, fontSize: courseMetaFontSize, opacity: 0.7, marginTop: 1 }} numberOfLines={1}>
                              {getProfLastName(course.professor)}
                            </Text>
                            <Text style={{ color: text, fontSize: courseTimeFontSize, opacity: 0.6, marginTop: 1 }} numberOfLines={1}>
                              {course.time}
                            </Text>
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
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Modal
        transparent
        animationType="fade"
        visible={showAddModal}
        onRequestClose={closeAddModal}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}
            activeOpacity={1}
            onPress={closeAddModal}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={{
                backgroundColor: colors.card, borderRadius: 18, padding: 24, width: 300,
                shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.18, shadowRadius: 16, elevation: 10,
              }}>
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
                    Search by Email
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
                    Enter a university email below to search for another student and send them a friend request.
                  </Text>
                </View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 }}>
                  University Email
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
                  <Ionicons name="mail-outline" size={16} color={colors.placeholder} />
                  <TextInput
                    placeholder="student@uci.edu"
                    placeholderTextColor={colors.placeholder}
                    value={emailQuery}
                    onChangeText={setEmailQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="search"
                    autoFocus
                    style={{ flex: 1, fontSize: 15, color: colors.text }}
                  />
                </View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 }}>
                  Search Results
                </Text>
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
                        Type an email above to start searching for a user.
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
                        No user matched that email search.
                      </Text>
                    </View>
                  ) : (
                    searchResults.map((user, index) => (
                      <TouchableOpacity
                        key={user.id}
                        onPress={() => sendFriendRequest(user)}
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
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{user.name}</Text>
                          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{user.email}</Text>
                          <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
                            {user.major} • {user.year}
                          </Text>
                        </View>
                        <View style={{
                          backgroundColor: colors.brand,
                          borderRadius: 16,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          opacity: submittingRequestId === user.id ? 0.7 : 1,
                        }}>
                          <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>
                            {submittingRequestId === user.id ? 'Sending...' : 'Send Request'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))
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
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.text }}>ClassMates</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {onOpenMessages && (
            <TouchableOpacity onPress={() => onOpenMessages?.(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowAddModal(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="person-add-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: colors.inputBg, borderRadius: 12,
          paddingHorizontal: 12, paddingVertical: 10, gap: 8,
        }}>
          <Ionicons name="search-outline" size={18} color={colors.placeholder} />
          <TextInput
            placeholder="Search classmates..."
            placeholderTextColor={colors.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ flex: 1, fontSize: 15, color: colors.text }}
          />
        </View>
      </View>

      <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4, alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => setActiveTab('friends')}
            style={{
              paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
              backgroundColor: activeTab === 'friends' ? colors.brand : colors.bgTertiary,
            }}
          >
            <Text style={{
              fontSize: 14, fontWeight: '600',
              color: activeTab === 'friends' ? 'white' : colors.textSecondary,
            }}>
              ClassMates ({friends.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { setActiveTab('requests'); setEditMode(false); }}
            style={{
              paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
              backgroundColor: activeTab === 'requests' ? colors.brand : colors.bgTertiary,
              flexDirection: 'row', alignItems: 'center', gap: 4,
            }}
          >
            <Text style={{
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
        friendsLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Text style={{ fontSize: 15, color: colors.textTertiary }}>Loading classmates...</Text>
          </View>
        ) : filteredFriends.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Ionicons name="people-outline" size={60} color={colors.border} />
            <Text style={{ fontSize: 16, color: colors.textTertiary, fontWeight: '500' }}>No friends yet</Text>
            <Text style={{ fontSize: 13, color: colors.border }}>Tap the icon above to search by email and send a request</Text>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
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

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{f.name}</Text>
                    <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{f.email}</Text>
                    <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
                      {f.major} • {f.year}
                    </Text>
                    {f.timetableVisibility === 'private' && (
                      <Text style={{ fontSize: 11, color: colors.brand, marginTop: 4, fontWeight: '700' }}>
                        Timetable is private
                      </Text>
                    )}
                  </View>

                  {!editMode && (
                    <TouchableOpacity
                      onPress={() => {
                        if (f.timetableVisibility === 'private') {
                          Alert.alert('Private timetable', `${f.name} has chosen to keep their timetable private.`);
                          return;
                        }
                        setSelectedFriendId(f.id);
                      }}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        backgroundColor: f.timetableVisibility === 'private' ? colors.bgTertiary : colors.brand,
                        borderRadius: 20,
                        paddingHorizontal: 12, paddingVertical: 7, marginRight: 8,
                      }}
                    >
                      <Ionicons name={f.timetableVisibility === 'private' ? 'lock-closed-outline' : 'calendar-outline'} size={14} color={f.timetableVisibility === 'private' ? colors.textTertiary : 'white'} />
                      <Text style={{ color: f.timetableVisibility === 'private' ? colors.textTertiary : 'white', fontSize: 13, fontWeight: '600' }}>
                        {f.timetableVisibility === 'private' ? 'Private' : 'Timetable'}
                      </Text>
                    </TouchableOpacity>
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
                      <Ionicons name="trash-outline" size={16} color="white" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => onOpenMessages?.({ id: f.id, name: f.name })}
                      style={{
                        width: 36, height: 36, borderRadius: 18,
                        backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="paper-plane-outline" size={16} color="white" />
                    </TouchableOpacity>
                  )}
                </View>

                {index < filteredFriends.length - 1 && (
                  <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginHorizontal: 16 }} />
                )}
              </View>
            ))}
          </ScrollView>
        )
      ) : friendsLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Text style={{ fontSize: 15, color: colors.textTertiary }}>Loading requests...</Text>
        </View>
      ) : pendingRequests.length === 0 && sentRequests.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Ionicons name="person-add-outline" size={60} color={colors.border} />
          <Text style={{ fontSize: 16, color: colors.textTertiary, fontWeight: '500' }}>No pending requests</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
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
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{req.name}</Text>
                      <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{req.email}</Text>
                      <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{req.major} • {req.year}</Text>
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
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{req.name}</Text>
                      <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{req.email}</Text>
                      <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{req.major} • {req.year}</Text>
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
  );
}

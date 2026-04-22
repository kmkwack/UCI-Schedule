import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Easing, PanResponder, Platform, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { ThemeProvider, ThemePreference, useTheme } from './src/context/ThemeContext';
import HomeScreen from './src/screens/HomeScreen';
import TimetableScreen from './src/screens/TimetableScreen';
import GradesScreen from './src/screens/GradesScreen';
import CoursePickerScreen from './src/screens/CoursePickerScreen';
import FriendsScreen from './src/screens/FriendsScreen';
import BoardScreen from './src/screens/BoardScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import UniversitySelectionScreen from './src/screens/UniversitySelectionScreen';
import SignInScreen from './src/screens/SignInScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AppErrorBoundary from './src/components/AppErrorBoundary';
import type { ChatTarget } from './src/data/messages';
import { Course, Quarter, Timetable, TimetableSettings, DEFAULT_TIMETABLE_SETTINGS, quarterKey } from './src/data/courses';
import {
  buildDisplayName,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_USER_SETTINGS,
  fallbackProfileFromEmail,
  profileDetailsFromProfile,
  profileFromSources,
} from './src/data/userPreferences';
import { parseSportsCalendar } from './src/data/sportsEvents';
import { supabase } from './src/lib/supabase';
import type { University } from './src/screens/UniversitySelectionScreen';
import type { EditableProfile, NotificationPreferences, PushPermissionStatus, TimetableVisibility, UserSettingsState } from './src/data/userPreferences';

type DirectMessageNotificationRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
};

type FriendRequestNotificationRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
};

type CommentNotificationRow = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_comment_id?: string | null;
};

type LikeNotificationRow = {
  target_type: 'post' | 'comment';
  target_id: string;
  user_id: string;
  post_id?: string;
  comment_id?: string;
};

type SocialNotificationSnapshot = {
  friendRequests: FriendRequestNotificationRow[];
  messages: DirectMessageNotificationRow[];
  comments: CommentNotificationRow[];
  likes: LikeNotificationRow[];
  postTitlesById: Record<string, string>;
  myCommentIds: Set<string>;
};

type AuthScreen = 'welcome' | 'university' | 'signin' | 'signup';

type AppContentProps = { themePreference: ThemePreference; onThemeChange: (v: ThemePreference) => void };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getAcademicQuarterForDate(date: Date): Quarter {
  const month = date.getMonth();
  if (month <= 2) return { year: String(date.getFullYear()), quarter: 'Winter' };
  if (month <= 5) return { year: String(date.getFullYear()), quarter: 'Spring' };
  return { year: String(date.getFullYear()), quarter: 'Fall' };
}

function parseCourseDays(daysString: string) {
  const result: string[] = [];
  let i = 0;
  while (i < daysString.length) {
    const two = daysString.slice(i, i + 2);
    if (two === 'Th' || two === 'Sa' || two === 'Su') {
      result.push(two);
      i += 2;
      continue;
    }
    const one = daysString[i];
    if ('MTWF'.includes(one)) result.push(one);
    i += 1;
  }
  return result;
}

function parseTimeStart(timeRange: string) {
  const [hourStr, minuteStr] = timeRange.split(' - ')[0].split(':');
  return { hour: Number(hourStr), minute: Number(minuteStr) };
}

function weekdayIndex(day: string) {
  const map: Record<string, number> = { Su: 0, M: 1, T: 2, W: 3, Th: 4, F: 5, Sa: 6 };
  return map[day] ?? -1;
}

function truncateNotificationText(value: string, maxLength = 64) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function buildUpcomingClassReminderDates(courses: Course[], reminderMinutes: number, daysAhead = 14) {
  const now = new Date();
  const end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const dates: Array<{ course: Course; notifyAt: Date }> = [];

  for (const course of courses) {
    if (course.time === 'TBA' || course.days === 'TBA') continue;
    const location = course.location?.toLowerCase() ?? '';
    if (location.includes('online') || location.includes('remote')) continue;

    const { hour, minute } = parseTimeStart(course.time);
    const courseDays = parseCourseDays(course.days);

    for (let cursor = new Date(now); cursor <= end; cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)) {
      if (!courseDays.some((day) => weekdayIndex(day) === cursor.getDay())) continue;

      const classStart = new Date(cursor);
      classStart.setHours(hour, minute, 0, 0);
      const notifyAt = new Date(classStart.getTime() - reminderMinutes * 60 * 1000);

      if (notifyAt <= now || classStart <= now) continue;
      dates.push({ course, notifyAt });
    }
  }

  return dates;
}

function buildDailyScheduleSummaryDates(courses: Course[], daysAhead = 14, summaryHour = 8) {
  const now = new Date();
  const end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const dates: Array<{ notifyAt: Date; courses: Course[] }> = [];

  for (let cursor = new Date(now); cursor <= end; cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)) {
    const dayCourses = courses.filter((course) => {
      if (course.time === 'TBA' || course.days === 'TBA') return false;
      return parseCourseDays(course.days).some((day) => weekdayIndex(day) === cursor.getDay());
    });

    if (dayCourses.length === 0) continue;

    const notifyAt = new Date(cursor);
    notifyAt.setHours(summaryHour, 0, 0, 0);
    if (notifyAt <= now) continue;

    dates.push({ notifyAt, courses: dayCourses });
  }

  return dates;
}

const AUTH_SCREEN_W = Dimensions.get('window').width;

function AuthNavigator({
  stack,
  onPop,
  renderScreen,
}: {
  stack: AuthScreen[];
  onPop: () => void;
  renderScreen: (s: AuthScreen) => React.ReactNode;
}) {
  const W = AUTH_SCREEN_W;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const prevLen = useRef(stack.length);

  useEffect(() => {
    const prev = prevLen.current;
    prevLen.current = stack.length;
    if (stack.length > prev) {
      slideAnim.setValue(W);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 16 }).start();
    }
  }, [stack.length]);

  const goBack = () => {
    Animated.timing(slideAnim, { toValue: W, duration: 260, useNativeDriver: true }).start(() => {
      slideAnim.setValue(0);
      onPop();
    });
  };

  const swipePan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) => gs.dx > 6 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
    onPanResponderMove: (_, gs) => { if (gs.dx > 0) slideAnim.setValue(gs.dx); },
    onPanResponderRelease: (_, gs) => {
      if (gs.dx > W * 0.35 || gs.vx > 0.6) {
        goBack();
      } else {
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 16 }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 16 }).start();
    },
  })).current;

  const current = stack[stack.length - 1];
  const previous = stack.length > 1 ? stack[stack.length - 2] : null;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Previous screen sits underneath */}
      {previous && (
        <View style={StyleSheet.absoluteFill}>
          {renderScreen(previous)}
        </View>
      )}
      {/* Current screen slides in from right, pan attached here */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ translateX: slideAnim }] }]}
        {...(stack.length > 1 ? swipePan.panHandlers : {})}
      >
        {renderScreen(current)}
      </Animated.View>
    </View>
  );
}

function AppContent({ themePreference, onThemeChange }: AppContentProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<EditableProfile>(fallbackProfileFromEmail('student@uci.edu'));
  const [userSettings, setUserSettings] = useState<UserSettingsState>(DEFAULT_USER_SETTINGS);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [useCelsius, setUseCelsius] = useState(true);
  const [authStack, setAuthStack] = useState<AuthScreen[]>(['welcome']);
  const authScreen = authStack[authStack.length - 1];
  const pushAuth = (s: AuthScreen) => setAuthStack((prev) => [...prev, s]);
  const popAuth = () => setAuthStack((prev) => prev.length > 1 ? prev.slice(0, -1) : prev);
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);
  const [currentTab, setCurrentTab] = useState<'home' | 'timetable' | 'grades' | 'board' | 'friends'>('home');
  const [homeTabTapCount, setHomeTabTapCount] = useState(0);
  const [timetableTabTapCount, setTimetableTabTapCount] = useState(0);
  const [gradesTabTapCount, setGradesTabTapCount] = useState(0);
  const [boardTabTapCount, setBoardTabTapCount] = useState(0);
  const [friendsTabTapCount, setFriendsTabTapCount] = useState(0);
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [renderCoursePicker, setRenderCoursePicker] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<Quarter>({ year: '2026', quarter: 'Spring' });
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [selectedTimetableId, setSelectedTimetableId] = useState<string | null>(null);
  const [focusedCourseId, setFocusedCourseId] = useState<string | null>(null);
  const [timetableSettings, setTimetableSettings] = useState<TimetableSettings>(DEFAULT_TIMETABLE_SETTINGS);
  const [showMessages, setShowMessages] = useState(false);
  const [messagesOpenWith, setMessagesOpenWith] = useState<ChatTarget | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const pickerTranslateY = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const seenFriendRequestIdsRef = useRef<Set<string>>(new Set());
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const seenCommentIdsRef = useRef<Set<string>>(new Set());
  const seenLikeKeysRef = useRef<Set<string>>(new Set());

  const activeKey = quarterKey(selectedQuarter);
  const quarterTimetables = timetables.filter((t) => t.quarterKey === activeKey);
  const activeTimetable = quarterTimetables.find((t) => t.id === selectedTimetableId) ?? quarterTimetables[0] ?? null;
  const activeCourses = activeTimetable?.courses ?? [];

  const academicQuarter = getAcademicQuarterForDate(new Date());
  const academicQuarterKey = quarterKey(academicQuarter);
  const homeQuarterKey = timetables.some((t) => t.quarterKey === academicQuarterKey) ? academicQuarterKey : activeKey;
  const homeQuarterCourses = timetables
    .filter((t) => t.quarterKey === homeQuarterKey)
    .flatMap((t) => t.courses);

  const USER_ID = userId ?? '';
  const displayUserName = buildDisplayName({ ...userProfile, email: userEmail || userProfile.email });
  const currentSchool = selectedUniversity?.name ?? 'UC Irvine';

  useEffect(() => {
    if (!userId || !userEmail) return;
    async function ensureProfile() {
      const fallbackName = userEmail.split('@')[0]
        .split(/[._-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ') || 'Student';

      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        email: userEmail,
        name: fallbackName,
        school: currentSchool,
        updated_at: new Date().toISOString(),
      });

      if (error) console.error('Failed to ensure profile:', error);
    }
    ensureProfile();
  }, [currentSchool, userEmail, userId]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      void Notifications.setNotificationChannelAsync('reminders', {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    let active = true;

    async function loadUserPreferences() {
      const fallback = fallbackProfileFromEmail(userEmail || 'student@uci.edu');

      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Failed to load profile:', profileError);
      }

      const { data: settingsRow, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (settingsError && settingsError.code !== 'PGRST205') {
        console.error('Failed to load user settings:', settingsError);
      }

      if (!active) return;

      setUserProfile(
        profileFromSources(
          (profileRow as Record<string, any> | null | undefined) ?? null,
          userEmail || fallback.email,
          (settingsRow as Record<string, any> | null | undefined)?.profile_details as Record<string, any> | null | undefined
        )
      );

      setUserSettings({
        timetableVisibility: ((settingsRow as Record<string, any> | null | undefined)?.timetable_visibility as TimetableVisibility | undefined) ?? DEFAULT_USER_SETTINGS.timetableVisibility,
        boardProfileVisible: ((settingsRow as Record<string, any> | null | undefined)?.profile_details as Record<string, any> | undefined)?.boardProfileVisible === true,
        notifications: {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          ...(((settingsRow as Record<string, any> | null | undefined)?.notification_settings as NotificationPreferences | undefined) ?? {}),
        },
        pushPermissionStatus: ((settingsRow as Record<string, any> | null | undefined)?.push_permission_status as PushPermissionStatus | undefined) ?? DEFAULT_USER_SETTINGS.pushPermissionStatus,
      });
      setExpoPushToken(((settingsRow as Record<string, any> | null | undefined)?.expo_push_token as string | undefined) ?? null);
    }

    loadUserPreferences();

    return () => {
      active = false;
    };
  }, [userEmail, userId]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const buildLikeKey = (like: LikeNotificationRow) => `${like.target_type}:${like.target_id}:${like.user_id}`;
    const notificationEnabled =
      userSettings.notifications.pushNotifications && userSettings.pushPermissionStatus === 'granted';

    async function presentInAppNotification(title: string, body: string, data: Record<string, string>) {
      if (!notificationEnabled) return;
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data,
            sound: true,
            ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
          },
          trigger: null,
        });
      } catch (error) {
        console.error('Failed to present in-app notification:', error);
      }
    }

    async function loadSocialNotificationSnapshot(): Promise<SocialNotificationSnapshot> {
      const [
        { data: friendRequestData, error: friendRequestError },
        { data: messageData, error: messageError },
        { data: myPosts, error: postsError },
        { data: myComments, error: myCommentsError },
      ] = await Promise.all([
        supabase
          .from('friend_requests')
          .select('id, sender_id, receiver_id, status, created_at')
          .eq('receiver_id', userId)
          .eq('status', 'pending')
          .order('created_at', { ascending: true }),
        supabase
          .from('direct_messages')
          .select('id, sender_id, receiver_id, content, created_at')
          .eq('receiver_id', userId)
          .order('created_at', { ascending: true }),
        supabase
          .from('posts')
          .select('id, title')
          .eq('user_id', userId)
          .eq('school', currentSchool),
        supabase
          .from('post_comments')
          .select('id, post_id')
          .eq('user_id', userId),
      ]);

      if (friendRequestError) console.error('Failed to load friend request notifications:', friendRequestError);
      if (messageError) console.error('Failed to load direct message notifications:', messageError);
      if (postsError) console.error('Failed to load post ids for notifications:', postsError);
      if (myCommentsError) console.error('Failed to load my comment ids for notifications:', myCommentsError);

      const postRows = (myPosts ?? []) as Array<{ id: string; title: string }>;
      const postIds = postRows.map((post) => post.id);
      const postTitlesById = Object.fromEntries(postRows.map((post) => [post.id, post.title]));
      const myCommentRows = (myComments ?? []) as Array<{ id: string; post_id: string }>;
      const myCommentIds = new Set(myCommentRows.map((comment) => comment.id));
      const myCommentIdList = Array.from(myCommentIds);

      if (postIds.length === 0 && myCommentIdList.length === 0) {
        return {
          friendRequests: (friendRequestData ?? []) as FriendRequestNotificationRow[],
          messages: (messageData ?? []) as DirectMessageNotificationRow[],
          comments: [],
          likes: [],
          postTitlesById,
          myCommentIds,
        };
      }

      const commentQueries: any[] = [];
      if (postIds.length > 0) {
        commentQueries.push(
          supabase
            .from('post_comments')
            .select('id, post_id, user_id, content, created_at, parent_comment_id')
            .in('post_id', postIds)
            .neq('user_id', userId)
            .order('created_at', { ascending: true })
        );
      }
      if (myCommentIdList.length > 0) {
        commentQueries.push(
          supabase
            .from('post_comments')
            .select('id, post_id, user_id, content, created_at, parent_comment_id')
            .in('parent_comment_id', myCommentIdList)
            .neq('user_id', userId)
            .order('created_at', { ascending: true })
        );
      }

      const commentResults = await Promise.all(commentQueries);
      const mergedComments = new Map<string, CommentNotificationRow>();
      commentResults.forEach(({ data, error }) => {
        if (error) {
          console.error('Failed to load comment notifications:', error);
          return;
        }
        ((data ?? []) as CommentNotificationRow[]).forEach((row) => mergedComments.set(row.id, row));
      });

      const likeQueries: any[] = [];
      if (postIds.length > 0) {
        likeQueries.push(
          supabase
            .from('post_votes')
            .select('post_id, user_id')
            .in('post_id', postIds)
            .neq('user_id', userId)
        );
      }
      if (myCommentIdList.length > 0) {
        likeQueries.push(
          supabase
            .from('post_comment_votes')
            .select('comment_id, user_id')
            .in('comment_id', myCommentIdList)
            .neq('user_id', userId)
        );
      }

      const likeResults = await Promise.all(likeQueries);
      const mergedLikes = new Map<string, LikeNotificationRow>();
      likeResults.forEach(({ data, error }, index) => {
        if (error) {
          console.error('Failed to load like notifications:', error);
          return;
        }

        if (index === 0 && postIds.length > 0) {
          ((data ?? []) as Array<{ post_id: string; user_id: string }>).forEach((row) => {
            const key = `post:${row.post_id}:${row.user_id}`;
            mergedLikes.set(key, {
              target_type: 'post',
              target_id: row.post_id,
              post_id: row.post_id,
              user_id: row.user_id,
            });
          });
          return;
        }

        ((data ?? []) as Array<{ comment_id: string; user_id: string }>).forEach((row) => {
          const key = `comment:${row.comment_id}:${row.user_id}`;
          mergedLikes.set(key, {
            target_type: 'comment',
            target_id: row.comment_id,
            comment_id: row.comment_id,
            user_id: row.user_id,
          });
        });
      });

      return {
        friendRequests: (friendRequestData ?? []) as FriendRequestNotificationRow[],
        messages: (messageData ?? []) as DirectMessageNotificationRow[],
        comments: Array.from(mergedComments.values()).sort((a, b) => (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )),
        likes: Array.from(mergedLikes.values()),
        postTitlesById,
        myCommentIds,
      };
    }

    async function bootstrapSocialNotificationState() {
      const snapshot = await loadSocialNotificationSnapshot();
      if (cancelled) return;

      seenFriendRequestIdsRef.current = new Set(snapshot.friendRequests.map((request) => request.id));
      seenMessageIdsRef.current = new Set(snapshot.messages.map((message) => message.id));
      seenCommentIdsRef.current = new Set(snapshot.comments.map((comment) => comment.id));
      seenLikeKeysRef.current = new Set(snapshot.likes.map(buildLikeKey));
    }

    async function pollSocialNotifications() {
      const snapshot = await loadSocialNotificationSnapshot();
      if (cancelled) return;

      const previousFriendRequestIds = seenFriendRequestIdsRef.current;
      const previousMessageIds = seenMessageIdsRef.current;
      const previousCommentIds = seenCommentIdsRef.current;
      const previousLikeKeys = seenLikeKeysRef.current;

      if (userSettings.notifications.friendRequests) {
        for (const request of snapshot.friendRequests) {
          if (!previousFriendRequestIds.has(request.id)) {
            await presentInAppNotification(
              'New friend request',
              'Someone wants to connect with you on ClassMate.',
              { type: 'friend-request', requestId: request.id }
            );
          }
        }
      }

      if (userSettings.notifications.messages) {
        for (const message of snapshot.messages) {
          if (!previousMessageIds.has(message.id)) {
            await presentInAppNotification(
              'New message',
              truncateNotificationText(message.content || 'Open Messages to read it.'),
              { type: 'direct-message', messageId: message.id, senderId: message.sender_id }
            );
          }
        }
      }

      if (userSettings.notifications.comments) {
        for (const comment of snapshot.comments) {
          if (!previousCommentIds.has(comment.id)) {
            const postTitle = snapshot.postTitlesById[comment.post_id];
            await presentInAppNotification(
              comment.parent_comment_id && snapshot.myCommentIds.has(comment.parent_comment_id)
                ? 'New reply to your comment'
                : 'New comment on your post',
              comment.parent_comment_id && snapshot.myCommentIds.has(comment.parent_comment_id)
                ? 'Someone replied to one of your board comments.'
                : postTitle
                  ? `Someone commented on "${truncateNotificationText(postTitle, 40)}".`
                  : 'Someone commented on your board post.',
              { type: 'post-comment', commentId: comment.id, postId: comment.post_id }
            );
          }
        }
      }

      if (userSettings.notifications.likes) {
        for (const like of snapshot.likes) {
          const likeKey = buildLikeKey(like);
          if (!previousLikeKeys.has(likeKey)) {
            const postTitle = like.post_id ? snapshot.postTitlesById[like.post_id] : null;
            await presentInAppNotification(
              like.target_type === 'comment' ? 'New like on your comment' : 'New like on your post',
              like.target_type === 'comment'
                ? 'Someone liked one of your board comments.'
                : postTitle
                  ? `Someone liked "${truncateNotificationText(postTitle, 40)}".`
                  : 'Someone liked your board post.',
              {
                type: like.target_type === 'comment' ? 'comment-like' : 'post-like',
                targetId: like.target_id,
                actorId: like.user_id,
              }
            );
          }
        }
      }

      seenFriendRequestIdsRef.current = new Set(snapshot.friendRequests.map((request) => request.id));
      seenMessageIdsRef.current = new Set(snapshot.messages.map((message) => message.id));
      seenCommentIdsRef.current = new Set(snapshot.comments.map((comment) => comment.id));
      seenLikeKeysRef.current = new Set(snapshot.likes.map(buildLikeKey));
    }

    void bootstrapSocialNotificationState().then(() => {
      if (cancelled || !notificationEnabled) return;
      intervalId = setInterval(() => {
        void pollSocialNotifications();
      }, 15000);
    });

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentSchool, userId, userSettings.notifications, userSettings.pushPermissionStatus]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function rescheduleReminderNotifications() {
      await Notifications.cancelAllScheduledNotificationsAsync();

      const notifications = userSettings.notifications;
      if (!notifications.pushNotifications || userSettings.pushPermissionStatus !== 'granted') return;

      const currentQuarter = getAcademicQuarterForDate(new Date());
      const quarterMatchesCurrent =
        currentQuarter.year === selectedQuarter.year && currentQuarter.quarter === selectedQuarter.quarter;

      if (notifications.dailyScheduleSummary && quarterMatchesCurrent) {
        const dailySummaries = buildDailyScheduleSummaryDates(activeCourses);
        for (const summary of dailySummaries) {
          if (cancelled) return;
          const firstCourse = summary.courses
            .slice()
            .sort((a, b) => a.time.localeCompare(b.time))[0];
          const classCount = summary.courses.length;
          const summaryTitle = classCount === 1 ? 'You have 1 class today' : `You have ${classCount} classes today`;
          const summaryBody = firstCourse
            ? `First up: ${firstCourse.code} at ${firstCourse.time.split(' - ')[0]}${firstCourse.location ? ` in ${firstCourse.location}` : ''}.`
            : 'Check ClassMate to see your full schedule for today.';

          await Notifications.scheduleNotificationAsync({
            content: {
              title: summaryTitle,
              body: summaryBody,
              data: { type: 'daily-schedule-summary', count: String(classCount) },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: summary.notifyAt,
            },
          });
        }
      }

      if (notifications.classReminders && quarterMatchesCurrent) {
        const classReminders = buildUpcomingClassReminderDates(activeCourses, notifications.classReminderMinutes);
        for (const reminder of classReminders) {
          if (cancelled) return;
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `${reminder.course.code} starts soon`,
              body: `${reminder.course.title} begins in ${notifications.classReminderMinutes} minutes${reminder.course.location ? ` at ${reminder.course.location}` : ''}.`,
              data: { type: 'class-reminder', courseId: reminder.course.id },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: reminder.notifyAt,
            },
          });
        }
      }

      if (notifications.sportsGameReminders && currentSchool === 'UC Irvine') {
        try {
          const response = await fetch('https://ucirvinesports.com/calendar.ics');
          const text = await response.text();
          const events = parseSportsCalendar(text, { maxDaysAhead: 14, includePastDays: 0 });

          for (const event of events) {
            if (cancelled) return;
            const notifyAt = new Date(event.date.getTime() - notifications.sportsGameReminderMinutes * 60 * 1000);
            if (notifyAt <= new Date()) continue;

            await Notifications.scheduleNotificationAsync({
              content: {
                title: `${event.sport} game reminder`,
                body: `${event.title} starts in ${notifications.sportsGameReminderMinutes} minutes${event.location ? ` at ${event.location}` : ''}.`,
                data: { type: 'sports-reminder', eventId: event.id },
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: notifyAt,
              },
            });
          }
        } catch (error) {
          console.error('Failed to schedule sports reminders:', error);
        }
      }
    }

    void rescheduleReminderNotifications();

    return () => {
      cancelled = true;
    };
  }, [activeCourses, currentSchool, selectedQuarter.quarter, selectedQuarter.year, userId, userSettings]);

  // Load all timetables from Supabase on mount (or when user logs in)
  useEffect(() => {
    if (!userId) return;
    async function load() {
      const { data, error } = await supabase
        .from('timetables')
        .select('*')
        .eq('user_id', USER_ID);

      if (error) { console.error('Failed to load timetables:', error); return; }

      const loaded: Timetable[] = (data ?? [])
        .map((row: any, i: number) => ({
          id: row.id,
          name: row.name,
          quarterKey: row.quarter_key,
          courses: row.courses as Course[],
          order: row.order ?? i,
        }))
        .sort((a: Timetable, b: Timetable) => a.order - b.order);

      setTimetables(loaded);

      if (loaded.length === 0) {
        // New user — bootstrap with an empty 'My Schedule' for the current quarter
        await createTimetable(activeKey, 'My Schedule');
      } else {
        // Auto-select first timetable for the default quarter
        const forCurrentQuarter = loaded.filter((t) => t.quarterKey === activeKey);
        if (forCurrentQuarter.length > 0) {
          setSelectedTimetableId(forCurrentQuarter[0].id);
        }
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function saveTimetable(t: Timetable) {
    const { error } = await supabase.from('timetables').upsert({
      id: t.id,
      user_id: USER_ID,
      quarter_key: t.quarterKey,
      name: t.name,
      courses: t.courses,
      order: t.order,
      updated_at: new Date().toISOString(),
    });
    if (error) console.error('Failed to save timetable:', error);
  }

  async function createTimetable(qKey: string, name: string): Promise<Timetable | null> {
    const nextOrder = timetables.filter((t) => t.quarterKey === qKey).length;
    const { data, error } = await supabase
      .from('timetables')
      .insert({ user_id: USER_ID, quarter_key: qKey, name, courses: [], order: nextOrder })
      .select()
      .single();

    if (error || !data) { console.error('Failed to create timetable:', error); return null; }

    const created: Timetable = {
      id: data.id,
      name: data.name,
      quarterKey: data.quarter_key,
      courses: [],
      order: data.order ?? nextOrder,
    };

    setTimetables((prev) => [...prev, created]);
    setSelectedTimetableId(created.id);
    return created;
  }

  const handleToggleCourse = async (course: Course) => {
    let target: Timetable | null = activeTimetable;

    // Auto-create a timetable if none exists for this quarter
    if (!target) {
      const created = await createTimetable(activeKey, 'My Schedule');
      if (!created) return;
      target = created;
    }

    const isAdded = target.courses.some((c) => c.id === course.id);
    const newCourses = isAdded
      ? target.courses.filter((c) => c.id !== course.id)
      : [...target.courses, course];

    const updated = { ...target, courses: newCourses };
    setTimetables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    await saveTimetable(updated);
  };

  const handleChangeQuarter = (q: Quarter) => {
    setSelectedQuarter(q);
    const key = quarterKey(q);
    const forQuarter = timetables.filter((t) => t.quarterKey === key);
    setSelectedTimetableId(forQuarter.length > 0 ? forQuarter[0].id : null);
  };

  const handleSelectTimetable = (id: string) => {
    setSelectedTimetableId(id);
  };

  const handleCreateTimetable = async () => {
    if (quarterTimetables.length === 0) { await createTimetable(activeKey, 'My Schedule'); return; }
    const usedNames = new Set(quarterTimetables.map((t) => t.name));
    let code = 66; // 'B'
    while (usedNames.has(`Plan ${String.fromCharCode(code)}`)) code++;
    await createTimetable(activeKey, `Plan ${String.fromCharCode(code)}`);
  };

  const handleAddQuarter = async (q: Quarter) => {
    const qk = quarterKey(q);
    setSelectedQuarter(q);
    const existing = timetables.filter((t) => t.quarterKey === qk);
    const mySchedule = existing.find((t) => t.name === 'My Schedule');
    if (mySchedule) {
      setSelectedTimetableId(mySchedule.id);
    } else {
      await createTimetable(qk, 'My Schedule');
    }
  };

  const CURRENT_QUARTER: Quarter = { year: '2026', quarter: 'Spring' };

  const handleDeleteTimetable = async () => {
    if (!activeTimetable) return;
    const { error } = await supabase.from('timetables').delete().eq('id', activeTimetable.id);
    if (error) { console.error('Failed to delete timetable:', error); return; }

    const remaining = quarterTimetables.filter((t) => t.id !== activeTimetable.id);
    let updatedTimetables = timetables.filter((t) => t.id !== activeTimetable.id);

    // If 'My Schedule' no longer exists in this quarter, promote the first remaining one
    if (remaining.length > 0 && !remaining.some((t) => t.name === 'My Schedule')) {
      const toRename = remaining[0];
      await supabase.from('timetables').update({ name: 'My Schedule' }).eq('id', toRename.id);
      updatedTimetables = updatedTimetables.map((t) =>
        t.id === toRename.id ? { ...t, name: 'My Schedule' } : t
      );
    }

    setTimetables(updatedTimetables);

    if (remaining.length > 0) {
      setSelectedTimetableId(remaining[0].id);
    } else {
      // Quarter is now empty — switch to current quarter
      const currentQk = quarterKey(CURRENT_QUARTER);
      setSelectedQuarter(CURRENT_QUARTER);
      const currentQTimetables = updatedTimetables.filter((t) => t.quarterKey === currentQk);
      setSelectedTimetableId(currentQTimetables.length > 0 ? currentQTimetables[0].id : null);
    }
  };

  const handleReorderTimetables = async (orderedIds: string[]) => {
    const updated = timetables
      .map((t) => {
        const newOrder = orderedIds.indexOf(t.id);
        return newOrder === -1 ? t : { ...t, order: newOrder };
      })
      .sort((a, b) => a.order - b.order);
    setTimetables(updated);
    await Promise.all(
      orderedIds.map((id, newOrder) => {
        const t = timetables.find((x) => x.id === id);
        if (!t) return Promise.resolve();
        return supabase.from('timetables').update({ order: newOrder }).eq('id', id);
      })
    );
  };

  const handleOpenMessages = (target?: ChatTarget | null) => {
    setMessagesOpenWith(target ?? null);
    setShowMessages(true);
  };

  const handleFocusCourse = (courseId: string | null) => {
    setFocusedCourseId(null);
    setTimeout(() => setFocusedCourseId(courseId), 0);
  };

  useEffect(() => {
    const screenHeight = Dimensions.get('window').height;

    if (showCoursePicker) {
      setRenderCoursePicker(true);
      pickerTranslateY.setValue(screenHeight);
      Animated.timing(pickerTranslateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(pickerTranslateY, {
      toValue: screenHeight,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setRenderCoursePicker(false);
    });
  }, [pickerTranslateY, showCoursePicker]);

  const handleLogout = () => {
    void Notifications.cancelAllScheduledNotificationsAsync();
    setUserId(null);
    setUserEmail('');
    setExpoPushToken(null);
    setUserProfile(fallbackProfileFromEmail('student@uci.edu'));
    setUserSettings(DEFAULT_USER_SETTINGS);
    setTimetables([]);
    setSelectedTimetableId(null);
    setAuthStack(['welcome']);
  };

  const saveUserSettingsRow = async (
    nextSettings: UserSettingsState,
    nextProfile: EditableProfile = userProfile,
    nextExpoPushToken: string | null = expoPushToken
  ) => {
    if (!userId) throw new Error('missing-user-id');

    const payload = {
      user_id: userId,
      timetable_visibility: nextSettings.timetableVisibility,
      notification_settings: nextSettings.notifications,
      push_permission_status: nextSettings.pushPermissionStatus,
      expo_push_token: nextExpoPushToken,
      profile_details: profileDetailsFromProfile(nextProfile, nextSettings.boardProfileVisible),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('user_settings').upsert(payload);
    if (error) {
      console.error('Failed to save user settings:', error);
      Alert.alert(
        'Could not save settings',
        error.code === 'PGRST205'
          ? 'The user_settings table is missing in Supabase. Run the required SQL first.'
          : error.message
      );
      throw error;
    }
  };

  const resolveExpoProjectId = () => {
    return (
      Constants.easConfig?.projectId ||
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ||
      undefined
    );
  };

  const registerExpoPushToken = async (): Promise<string | null> => {
    try {
      const projectId = resolveExpoProjectId();
      if (!projectId) {
        console.warn('Expo push registration skipped: no EAS projectId configured.');
        return null;
      }

      const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenResponse.data;
      setExpoPushToken(token);
      return token;
    } catch (error) {
      console.warn('Failed to register Expo push token:', error);
      return null;
    }
  };

  const handleSaveProfile = async (nextProfile: EditableProfile): Promise<boolean> => {
    if (!userId) return false;

    setSavingProfile(true);
    const safeEmail = userEmail || nextProfile.email;
    const next = { ...nextProfile, email: safeEmail };
    const nextName = buildDisplayName(next);

    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      email: safeEmail,
      name: nextName,
      major: next.major,
      year: next.year,
      school: currentSchool,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setSavingProfile(false);
      Alert.alert('Could not save profile', error.message);
      return false;
    }

    const nextSettings = { ...userSettings };
    try {
      await saveUserSettingsRow(nextSettings, next, expoPushToken);
      setUserProfile(next);
      return true;
    } catch {
      return false;
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveVisibility = async ({
    timetableVisibility,
    boardProfileVisible,
  }: {
    timetableVisibility: TimetableVisibility;
    boardProfileVisible: boolean;
  }): Promise<boolean> => {
    setSavingVisibility(true);
    const nextSettings = { ...userSettings, timetableVisibility, boardProfileVisible };
    try {
      await saveUserSettingsRow(nextSettings);
      setUserSettings(nextSettings);
      return true;
    } catch {
      return false;
    } finally {
      setSavingVisibility(false);
    }
  };

  const handleRequestPushPermissions = async (): Promise<PushPermissionStatus> => {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('reminders', {
          name: 'Reminders',
          importance: Notifications.AndroidImportance.HIGH,
        });
      }
      const existing = await Notifications.getPermissionsAsync();
      let status = existing.status;

      if (status !== 'granted') {
        const requested = await Notifications.requestPermissionsAsync();
        status = requested.status;
      }

      if (status === 'granted') return 'granted';
      if (status === 'denied') return 'denied';
      return 'undetermined';
    } catch (error) {
      console.error('Failed to request notification permissions:', error);
      return 'unavailable';
    }
  };

  const handleSaveNotifications = async (
    notifications: NotificationPreferences,
    pushPermissionStatus: PushPermissionStatus
  ): Promise<boolean> => {
    setSavingNotifications(true);
    const nextSettings = {
      ...userSettings,
      notifications,
      pushPermissionStatus,
    };
    try {
      let nextToken = expoPushToken;
      if (notifications.pushNotifications && pushPermissionStatus === 'granted') {
        nextToken = await registerExpoPushToken();
      }
      if (!notifications.pushNotifications) {
        nextToken = null;
        setExpoPushToken(null);
      }
      await saveUserSettingsRow(nextSettings, userProfile, nextToken);
      setUserSettings(nextSettings);
      return true;
    } catch {
      return false;
    } finally {
      setSavingNotifications(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    if (!userSettings.notifications.pushNotifications) return;
    if (userSettings.pushPermissionStatus !== 'granted') return;
    if (expoPushToken) return;

    let cancelled = false;

    async function syncPushToken() {
      const token = await registerExpoPushToken();
      if (cancelled || !token) return;
      try {
        await saveUserSettingsRow(userSettings, userProfile, token);
      } catch {
        return;
      }
    }

    void syncPushToken();

    return () => {
      cancelled = true;
    };
  }, [
    expoPushToken,
    userId,
    userProfile,
    userSettings,
  ]);

  const handleOpenFriendsTab = () => {
    setCurrentTab('friends');
  };

  // ── auth screens ─────────────────────────────────────────────────────────────

  if (!userId) {
    const renderAuthScreen = (name: AuthScreen) => {
      if (name === 'welcome') {
        return <WelcomeScreen onGetStarted={() => pushAuth('university')} />;
      }
      if (name === 'university') {
        return (
          <UniversitySelectionScreen
            onBack={popAuth}
            onContinue={(uni) => { setSelectedUniversity(uni); pushAuth('signin'); }}
          />
        );
      }
      if (name === 'signup') {
        return (
          <SignUpScreen
            university={selectedUniversity ?? undefined}
            onBack={popAuth}
            onSignedUp={(id, email) => { setUserId(id); setUserEmail(email); }}
            onGoToSignIn={() => { popAuth(); pushAuth('signin'); }}
          />
        );
      }
      return (
        <SignInScreen
          university={selectedUniversity ?? { id: '1', name: 'UC Irvine', domain: '@uci.edu', location: 'Irvine, CA', logo: 'UCI' }}
          onBack={popAuth}
          onSignedIn={(id, email) => { setUserId(id); setUserEmail(email); }}
          onGoToSignUp={() => pushAuth('signup')}
        />
      );
    };

    return <AuthNavigator stack={authStack} onPop={popAuth} renderScreen={renderAuthScreen} />;
  }

  // ── main app ──────────────────────────────────────────────────────────────────

  let content = null;

  if (currentTab === 'home') {
    content = (
      <HomeScreen
        activeCourses={homeQuarterCourses}
        selectedQuarter={homeQuarterKey === academicQuarterKey ? academicQuarter : selectedQuarter}
        onGoToTimetable={() => setCurrentTab('timetable')}
        onGoToGrades={() => setCurrentTab('grades')}
        onOpenSettings={() => setShowSettings(true)}
        bottomInset={insets.bottom}
        scrollToTopTrigger={homeTabTapCount}
      />
    );
  } else if (currentTab === 'timetable') {
    content = (
      <View style={{ flex: 1, paddingTop: 62, backgroundColor: colors.bg }}>
        <TimetableScreen
          activeCourses={activeCourses}
          selectedQuarter={selectedQuarter}
          focusedCourseId={focusedCourseId}
          onFocusCourse={handleFocusCourse}
          onChangeQuarter={handleChangeQuarter}
          onOpenCoursePicker={() => setShowCoursePicker(true)}
          onRemoveCourse={handleToggleCourse}
          school={selectedUniversity?.name ?? 'UC Irvine'}
          userId={USER_ID}
          timetables={timetables}
          quarterTimetables={quarterTimetables}
          activeTimetableId={activeTimetable?.id ?? null}
          onSelectTimetable={handleSelectTimetable}
          onCreateTimetable={handleCreateTimetable}
          onDeleteTimetable={handleDeleteTimetable}
          onReorderTimetables={handleReorderTimetables}
          onAddQuarter={handleAddQuarter}
          settings={timetableSettings}
          onSettingsApply={setTimetableSettings}
          bottomInset={insets.bottom}
          scrollToTopTrigger={timetableTabTapCount}
        />
      </View>
    );
  } else if (currentTab === 'grades') {
    content = <GradesScreen timetables={timetables} userId={USER_ID} bottomInset={insets.bottom} scrollToTopTrigger={gradesTabTapCount} />;
  } else if (currentTab === 'board') {
    content = (
      <BoardScreen
        onOpenMessages={handleOpenMessages}
        school={selectedUniversity?.name ?? 'UC Irvine'}
        userId={USER_ID}
        boardAuthorName={userProfile.nickname.trim() || displayUserName}
        boardProfileVisible={userSettings.boardProfileVisible}
        bottomInset={insets.bottom}
        scrollToTopTrigger={boardTabTapCount}
      />
    );
  } else if (currentTab === 'friends') {
    content = (
      <View style={{ flex: 1, paddingTop: 62, backgroundColor: colors.bg }}>
        <FriendsScreen
          userId={USER_ID}
          userEmail={userEmail}
          school={selectedUniversity?.name ?? 'UC Irvine'}
          bottomInset={insets.bottom}
          scrollToTopTrigger={friendsTabTapCount}
        />
      </View>
    );
  }

  const TabItem = ({
    label,
    icon,
    active,
    onPress,
  }: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    active: boolean;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 7,
        paddingHorizontal: 4,
        borderRadius: 19,
        backgroundColor: active
          ? (isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.78)')
          : 'transparent',
        borderWidth: active ? 1 : 0,
        borderColor: active
          ? (isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.95)')
          : 'transparent',
        shadowColor: active ? '#ffffff' : '#0f172a',
        shadowOffset: { width: 0, height: active ? 2 : 0 },
        shadowOpacity: active ? (isDark ? 0.08 : 0.35) : 0,
        shadowRadius: active ? 8 : 0,
        elevation: active ? 3 : 0,
      }}
      onPress={onPress}
    >
      {active ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 1,
            left: 1,
            right: 1,
            height: '52%',
            borderRadius: 18,
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.52)',
          }}
        />
      ) : null}
      <Ionicons name={icon} size={20} color={active ? colors.brand : colors.textTertiary} />
      <Text
        style={{
          marginTop: 2,
          fontSize: 10,
          color: active ? colors.brand : colors.textTertiary,
          fontWeight: active ? '600' : '400',
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgSecondary }}>
      {content}

      <View
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: insets.bottom - 6,
          padding: 1,
          borderRadius: 28,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.86)',
          backgroundColor: isDark ? 'rgba(30,30,34,0.72)' : 'rgba(244,247,255,0.78)',
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: isDark ? 0.28 : 0.16,
          shadowRadius: 24,
          elevation: 14,
          overflow: 'hidden',
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '54%',
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.45)',
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 24,
            width: 108,
            height: 48,
            borderRadius: 24,
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.36)',
            transform: [{ rotate: '-14deg' }],
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -6,
            right: 42,
            width: 132,
            height: 54,
            borderRadius: 27,
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.28)',
            transform: [{ rotate: '12deg' }],
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 27,
            backgroundColor: isDark ? 'rgba(20,20,24,0.26)' : 'rgba(255,255,255,0.16)',
          }}
        >
          <TabItem label="Home" icon="home-outline" active={currentTab === 'home'} onPress={() => { if (currentTab === 'home') setHomeTabTapCount(c => c + 1); else setCurrentTab('home'); }} />
          <TabItem label="Timetable" icon="calendar-outline" active={currentTab === 'timetable'} onPress={() => { if (currentTab === 'timetable') setTimetableTabTapCount(c => c + 1); else setCurrentTab('timetable'); }} />
          <TabItem label="Grades" icon="school-outline" active={currentTab === 'grades'} onPress={() => { if (currentTab === 'grades') setGradesTabTapCount(c => c + 1); else setCurrentTab('grades'); }} />
          <TabItem label="Board" icon="clipboard-outline" active={currentTab === 'board'} onPress={() => { if (currentTab === 'board') setBoardTabTapCount(c => c + 1); else setCurrentTab('board'); }} />
          <TabItem label="ClassMates" icon="person-add-outline" active={currentTab === 'friends'} onPress={() => { if (currentTab === 'friends') setFriendsTabTapCount(c => c + 1); else handleOpenFriendsTab(); }} />
        </View>
      </View>

      {showMessages && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, elevation: 30 }}>
          <MessagesScreen
            onClose={() => { setShowMessages(false); setMessagesOpenWith(null); }}
            openChatWith={messagesOpenWith}
            userId={USER_ID}
          />
        </View>
      )}

      {showSettings && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40, elevation: 40 }}>
          <SettingsScreen
            visible={showSettings}
            onClose={() => setShowSettings(false)}
            onLogout={handleLogout}
            userName={displayUserName}
            userEmail={userEmail}
            userProfile={userProfile}
            userSettings={userSettings}
            useCelsius={useCelsius}
            onUseCelsiusChange={setUseCelsius}
            themePreference={themePreference}
            onThemeChange={onThemeChange}
            onSaveProfile={handleSaveProfile}
            onSaveVisibility={handleSaveVisibility}
            onSaveNotifications={handleSaveNotifications}
            onRequestPushPermissions={handleRequestPushPermissions}
            savingProfile={savingProfile}
            savingVisibility={savingVisibility}
            savingNotifications={savingNotifications}
          />
        </View>
      )}

      {renderCoursePicker && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 20,
            elevation: 20,
            transform: [{ translateY: pickerTranslateY }],
          }}
        >
          <CoursePickerScreen
            activeCourses={activeCourses}
            onToggleCourse={handleToggleCourse}
            onFocusCourse={handleFocusCourse}
            onClose={() => setShowCoursePicker(false)}
            selectedQuarter={selectedQuarter}
            timetableSettings={timetableSettings}
            userId={USER_ID}
            school={selectedUniversity?.name ?? 'UC Irvine'}
          />
        </Animated.View>
      )}
    </View>
  );
}

export default function App() {
  const [themePreference, setThemePreference] = useState<ThemePreference>('auto');
  return (
    <SafeAreaProvider>
      <ThemeProvider preference={themePreference}>
        <AppErrorBoundary>
          <AppContent themePreference={themePreference} onThemeChange={setThemePreference} />
        </AppErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

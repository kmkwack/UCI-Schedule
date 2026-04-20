import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
import { Course, Quarter, Timetable, TimetableSettings, DEFAULT_TIMETABLE_SETTINGS, quarterKey } from './src/data/courses';
import { supabase } from './src/lib/supabase';
import type { University } from './src/screens/UniversitySelectionScreen';

type AuthScreen = 'welcome' | 'university' | 'signin' | 'signup';

export default function App() {
  const [userId, setUserId] = useState<string | null>(null);
  const [authScreen, setAuthScreen] = useState<AuthScreen>('welcome');
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);
  const [currentTab, setCurrentTab] = useState<'home' | 'timetable' | 'grades' | 'board' | 'friends'>('home');
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [renderCoursePicker, setRenderCoursePicker] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<Quarter>({ year: '2026', quarter: 'Spring' });
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [selectedTimetableId, setSelectedTimetableId] = useState<string | null>(null);
  const [focusedCourseId, setFocusedCourseId] = useState<string | null>(null);
  const [timetableSettings, setTimetableSettings] = useState<TimetableSettings>(DEFAULT_TIMETABLE_SETTINGS);
  const [showMessages, setShowMessages] = useState(false);
  const [messagesOpenWith, setMessagesOpenWith] = useState<string | null>(null);
  const pickerTranslateY = useRef(new Animated.Value(Dimensions.get('window').height)).current;

  const activeKey = quarterKey(selectedQuarter);
  const quarterTimetables = timetables.filter((t) => t.quarterKey === activeKey);
  const activeTimetable = quarterTimetables.find((t) => t.id === selectedTimetableId) ?? quarterTimetables[0] ?? null;
  const activeCourses = activeTimetable?.courses ?? [];

  const USER_ID = userId ?? 'guest';

  // Load all timetables from Supabase on mount (or when user logs in)
  useEffect(() => {
    if (!userId) return;
    async function load() {
      const { data, error } = await supabase
        .from('timetables')
        .select('*')
        .eq('user_id', USER_ID);

      if (error) { console.error('Failed to load timetables:', error); return; }

      const loaded: Timetable[] = (data ?? []).map((row: any) => ({
        id: row.id,
        name: row.name,
        quarterKey: row.quarter_key,
        courses: row.courses as Course[],
      }));

      setTimetables(loaded);

      // Auto-select first timetable for the default quarter
      const forCurrentQuarter = loaded.filter((t) => t.quarterKey === activeKey);
      if (forCurrentQuarter.length > 0) {
        setSelectedTimetableId(forCurrentQuarter[0].id);
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
      updated_at: new Date().toISOString(),
    });
    if (error) console.error('Failed to save timetable:', error);
  }

  async function createTimetable(qKey: string, name: string): Promise<Timetable | null> {
    const { data, error } = await supabase
      .from('timetables')
      .insert({ user_id: USER_ID, quarter_key: qKey, name, courses: [] })
      .select()
      .single();

    if (error || !data) { console.error('Failed to create timetable:', error); return null; }

    const created: Timetable = {
      id: data.id,
      name: data.name,
      quarterKey: data.quarter_key,
      courses: [],
    };

    setTimetables((prev) => [...prev, created]);
    setSelectedTimetableId(created.id);
    return created;
  }

  const handleToggleCourse = async (course: Course) => {
    let target = activeTimetable;

    // Auto-create a timetable if none exists for this quarter
    if (!target) {
      target = await createTimetable(activeKey, 'My Schedule');
      if (!target) return;
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
    const existing = quarterTimetables.length;
    const name = existing === 0 ? 'My Schedule' : `Plan ${String.fromCharCode(65 + existing)}`; // Plan A, Plan B, ...
    await createTimetable(activeKey, name);
  };

  const handleAddQuarter = async (q: Quarter) => {
    const qk = quarterKey(q);
    setSelectedQuarter(q);
    const existing = timetables.filter((t) => t.quarterKey === qk);
    if (existing.length > 0) {
      setSelectedTimetableId(existing[0].id);
    } else {
      await createTimetable(qk, 'My Schedule');
    }
  };

  const CURRENT_QUARTER: Quarter = { year: '2026', quarter: 'Spring' };

  const handleDeleteTimetable = async () => {
    if (!activeTimetable) return;
    const { error } = await supabase.from('timetables').delete().eq('id', activeTimetable.id);
    if (error) { console.error('Failed to delete timetable:', error); return; }
    setTimetables((prev) => prev.filter((t) => t.id !== activeTimetable.id));
    const remaining = quarterTimetables.filter((t) => t.id !== activeTimetable.id);
    if (remaining.length > 0) {
      setSelectedTimetableId(remaining[0].id);
    } else {
      // Quarter is now empty — switch to current quarter
      const currentQk = quarterKey(CURRENT_QUARTER);
      setSelectedQuarter(CURRENT_QUARTER);
      const currentQTimetables = timetables.filter(
        (t) => t.quarterKey === currentQk && t.id !== activeTimetable.id
      );
      setSelectedTimetableId(currentQTimetables.length > 0 ? currentQTimetables[0].id : null);
    }
  };

  const handleOpenMessages = (name: string) => {
    setMessagesOpenWith(name || null);
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

  // ── auth screens ─────────────────────────────────────────────────────────────

  if (!userId) {
    if (authScreen === 'welcome') {
      return (
        <WelcomeScreen
          onGetStarted={() => setAuthScreen('university')}
        />
      );
    }
    if (authScreen === 'university') {
      return (
        <UniversitySelectionScreen
          onBack={() => setAuthScreen('welcome')}
          onContinue={(uni) => { setSelectedUniversity(uni); setAuthScreen('signin'); }}
        />
      );
    }
    if (authScreen === 'signup') {
      return (
        <SignUpScreen
          university={selectedUniversity ?? undefined}
          onBack={() => setAuthScreen('university')}
          onSignedUp={(id) => setUserId(id)}
          onGoToSignIn={() => setAuthScreen('signin')}
        />
      );
    }
    return (
      <SignInScreen
        university={selectedUniversity ?? { id: '1', name: 'UC Irvine', domain: '@uci.edu', location: 'Irvine, CA', logo: 'UCI' }}
        onBack={() => setAuthScreen('university')}
        onSignedIn={(id) => setUserId(id)}
        onGoToSignUp={() => setAuthScreen('signup')}
        onGuest={(id) => setUserId(id)}
      />
    );
  }

  // ── main app ──────────────────────────────────────────────────────────────────

  let content = null;

  if (currentTab === 'home') {
    content = (
      <HomeScreen
        activeCourses={activeCourses}
        onGoToTimetable={() => setCurrentTab('timetable')}
        onGoToGrades={() => setCurrentTab('grades')}
      />
    );
  } else if (currentTab === 'timetable') {
    content = (
      <View style={{ flex: 1, paddingTop: 60, backgroundColor: timetableSettings.theme === 'dark' ? '#0f172a' : '#fff' }}>
        <TimetableScreen
          activeCourses={activeCourses}
          selectedQuarter={selectedQuarter}
          focusedCourseId={focusedCourseId}
          onFocusCourse={handleFocusCourse}
          onChangeQuarter={handleChangeQuarter}
          onOpenCoursePicker={() => setShowCoursePicker(true)}
          timetables={timetables}
          quarterTimetables={quarterTimetables}
          activeTimetableId={activeTimetable?.id ?? null}
          onSelectTimetable={handleSelectTimetable}
          onCreateTimetable={handleCreateTimetable}
          onDeleteTimetable={handleDeleteTimetable}
          onAddQuarter={handleAddQuarter}
          settings={timetableSettings}
          onSettingsApply={setTimetableSettings}
        />
      </View>
    );
  } else if (currentTab === 'grades') {
    content = <GradesScreen timetables={timetables} userId={USER_ID} />;
  } else if (currentTab === 'board') {
    content = <BoardScreen onOpenMessages={handleOpenMessages} />;
  } else if (currentTab === 'friends') {
    content = (
      <View style={{ flex: 1, paddingTop: 60, backgroundColor: '#f7f8fa' }}>
        <FriendsScreen onOpenMessages={handleOpenMessages} />
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
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      onPress={onPress}
    >
      <Ionicons name={icon} size={22} color={active ? '#4169E1' : '#9ca3af'} />
      <Text
        style={{
          marginTop: 4,
          fontSize: 12,
          color: active ? '#4169E1' : '#9ca3af',
          fontWeight: active ? '600' : '400',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaProvider>
    <View style={{ flex: 1, backgroundColor: '#f7f8fa' }}>
      {content}

      <View
        style={{
          flexDirection: 'row',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          paddingTop: 10,
          paddingBottom: 14,
          backgroundColor: 'white',
        }}
      >
        <TabItem label="Home" icon="home-outline" active={currentTab === 'home'} onPress={() => setCurrentTab('home')} />
        <TabItem label="Timetable" icon="calendar-outline" active={currentTab === 'timetable'} onPress={() => setCurrentTab('timetable')} />
        <TabItem label="Grades" icon="school-outline" active={currentTab === 'grades'} onPress={() => setCurrentTab('grades')} />
        <TabItem label="Board" icon="clipboard-outline" active={currentTab === 'board'} onPress={() => setCurrentTab('board')} />
        <TabItem label="ClassMates" icon="person-add-outline" active={currentTab === 'friends'} onPress={() => setCurrentTab('friends')} />
      </View>

      {showMessages && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, elevation: 30 }}>
          <MessagesScreen
            onClose={() => { setShowMessages(false); setMessagesOpenWith(null); }}
            openChatWith={messagesOpenWith}
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
          />
        </Animated.View>
      )}
    </View>
    </SafeAreaProvider>
  );
}

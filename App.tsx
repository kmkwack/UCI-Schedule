import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from './src/screens/HomeScreen';
import TimetableScreen from './src/screens/TimetableScreen';
import GradesScreen from './src/screens/GradesScreen';
import CoursePickerScreen from './src/screens/CoursePickerScreen';
import FriendsScreen from './src/screens/FriendsScreen';
import BoardScreen from './src/screens/BoardScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import SignInScreen from './src/screens/SignInScreen';
import { Course, Quarter, Timetable, quarterKey } from './src/data/courses';
import { supabase } from './src/lib/supabase';

type AuthScreen = 'welcome' | 'signin';

export default function App() {
  const [userId, setUserId] = useState<string | null>(null);
  const [authScreen, setAuthScreen] = useState<AuthScreen>('welcome');
  const [currentTab, setCurrentTab] = useState<'home' | 'timetable' | 'grades' | 'board' | 'friends'>('home');
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [renderCoursePicker, setRenderCoursePicker] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<Quarter>({ year: '2026', quarter: 'Spring' });
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [selectedTimetableId, setSelectedTimetableId] = useState<string | null>(null);
  const [focusedCourseId, setFocusedCourseId] = useState<string | null>(null);
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
          onSignIn={() => setAuthScreen('signin')}
          onCreateAccount={() => setAuthScreen('signin')}
          onGuest={(id) => setUserId(id)}
        />
      );
    }
    return (
      <SignInScreen
        onBack={() => setAuthScreen('welcome')}
        onSignedIn={(id) => setUserId(id)}
        onGoToSignUp={() => {}}
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
      <View style={{ flex: 1, paddingTop: 60, backgroundColor: '#f7f8fa' }}>
        <TimetableScreen
          activeCourses={activeCourses}
          selectedQuarter={selectedQuarter}
          focusedCourseId={focusedCourseId}
          onFocusCourse={handleFocusCourse}
          onChangeQuarter={handleChangeQuarter}
          onOpenCoursePicker={() => setShowCoursePicker(true)}
          quarterTimetables={quarterTimetables}
          activeTimetableId={activeTimetable?.id ?? null}
          onSelectTimetable={handleSelectTimetable}
          onCreateTimetable={handleCreateTimetable}
        />
      </View>
    );
  } else if (currentTab === 'grades') {
    content = <GradesScreen activeCourses={activeCourses} />;
  } else if (currentTab === 'board') {
    content = <BoardScreen />;
  } else if (currentTab === 'friends') {
    content = (
      <View style={{ flex: 1, paddingTop: 60, backgroundColor: '#f7f8fa' }}>
        <FriendsScreen />
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
      <Ionicons name={icon} size={22} color={active ? '#2563eb' : '#9ca3af'} />
      <Text
        style={{
          marginTop: 4,
          fontSize: 12,
          color: active ? '#2563eb' : '#9ca3af',
          fontWeight: active ? '600' : '400',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
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
        <TabItem label="Friends" icon="person-add-outline" active={currentTab === 'friends'} onPress={() => setCurrentTab('friends')} />
      </View>

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
          />
        </Animated.View>
      )}
    </View>
  );
}

import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from './src/screens/HomeScreen';
import TimetableScreen from './src/screens/TimetableScreen';
import GradesScreen from './src/screens/GradesScreen';
import CoursePickerScreen from './src/screens/CoursePickerScreen';
import FriendsScreen from './src/screens/FriendsScreen';
import { Course, Quarter, quarterKey } from './src/data/courses';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'home' | 'timetable' | 'grades' | 'friends'>('home');
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<Quarter>({ year: '2026', quarter: 'Spring' });
  const [timetables, setTimetables] = useState<Record<string, Course[]>>({});

  const activeKey = quarterKey(selectedQuarter);
  const activeCourses = timetables[activeKey] ?? [];

  const handleToggleCourse = (course: Course) => {
    setTimetables((prev) => {
      const existing = prev[activeKey] ?? [];
      const isAdded = existing.some((c) => c.id === course.id);
      return {
        ...prev,
        [activeKey]: isAdded
          ? existing.filter((c) => c.id !== course.id)
          : [...existing, course],
      };
    });
  };

  let content = null;

  if (showCoursePicker) {
    content = (
      <CoursePickerScreen
        activeCourses={activeCourses}
        onToggleCourse={handleToggleCourse}
        onClose={() => setShowCoursePicker(false)}
        selectedQuarter={selectedQuarter}
      />
    );
  } else if (currentTab === 'home') {
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
          onChangeQuarter={setSelectedQuarter}
          onOpenCoursePicker={() => setShowCoursePicker(true)}
        />
      </View>
    );
  } else if (currentTab === 'grades') {
    content = <GradesScreen activeCourses={activeCourses} />;
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

      {!showCoursePicker && (
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
          <TabItem
            label="Home"
            icon="home-outline"
            active={currentTab === 'home'}
            onPress={() => setCurrentTab('home')}
          />
          <TabItem
            label="Timetable"
            icon="calendar-outline"
            active={currentTab === 'timetable'}
            onPress={() => setCurrentTab('timetable')}
          />
          <TabItem
            label="Grades"
            icon="bar-chart-outline"
            active={currentTab === 'grades'}
            onPress={() => setCurrentTab('grades')}
          />
          <TabItem
            label="Friends"
            icon="people-outline"
            active={currentTab === 'friends'}
            onPress={() => setCurrentTab('friends')}
          />
        </View>
      )}
    </View>
  );
}

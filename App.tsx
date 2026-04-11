import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from './src/screens/HomeScreen';
import TimetableScreen from './src/screens/TimetableScreen';
import GradesScreen from './src/screens/GradesScreen';
import CoursePickerScreen from './src/screens/CoursePickerScreen';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'home' | 'timetable' | 'grades'>('home');
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [addedCourses, setAddedCourses] = useState<number[]>([]);

  const handleToggleCourse = (id: number) => {
    setAddedCourses((prev) =>
      prev.includes(id) ? prev.filter((courseId) => courseId !== id) : [...prev, id]
    );
  };

  let content = null;

  if (showCoursePicker) {
    content = (
      <CoursePickerScreen
        addedCourses={addedCourses}
        onToggleCourse={handleToggleCourse}
        onClose={() => setShowCoursePicker(false)}
      />
    );
  } else if (currentTab === 'home') {
    content = (
      <HomeScreen
        addedCourses={addedCourses}
        onGoToTimetable={() => setCurrentTab('timetable')}
        onGoToGrades={() => setCurrentTab('grades')}
      />
    );
  } else if (currentTab === 'timetable') {
    content = (
      <View style={{ flex: 1, paddingTop: 60, backgroundColor: '#f7f8fa' }}>
        <TimetableScreen
          addedCourses={addedCourses}
          onOpenCoursePicker={() => setShowCoursePicker(true)}
        />
      </View>
    );
  } else if (currentTab === 'grades') {
    content = <GradesScreen addedCourses={addedCourses} />;
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
      <Ionicons
        name={icon}
        size={22}
        color={active ? '#2563eb' : '#9ca3af'}
      />
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
        </View>
      )}
    </View>
  );
}
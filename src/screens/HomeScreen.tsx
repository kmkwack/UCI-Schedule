import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { courses } from '../data/courses';

type Props = {
  addedCourses: number[];
  onGoToTimetable: () => void;
  onGoToGrades: () => void;
};

function getTodayDayCode() {
  const day = new Date().getDay();

  // JS: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  if (day === 1) return 'M';
  if (day === 2) return 'T';
  if (day === 3) return 'W';
  if (day === 4) return 'Th';
  if (day === 5) return 'F';
  return null;
}

function getTodayLabel() {
  const day = new Date().getDay();
  const labels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return labels[day];
}

function extractStartHour(timeRange: string) {
  const start = timeRange.split(' - ')[0];
  const [hour, minute] = start.split(':').map(Number);
  return hour + minute / 60;
}

export default function HomeScreen({
  addedCourses,
  onGoToTimetable,
  onGoToGrades,
}: Props) {
  const todayCode = getTodayDayCode();

  const selectedCourses = courses.filter((course) =>
    addedCourses.includes(course.id)
  );

  const todayCourses = todayCode
    ? selectedCourses
        .filter((course) => course.days.includes(todayCode))
        .sort((a, b) => extractStartHour(a.time) - extractStartHour(b.time))
    : [];

  const nextClass = todayCourses.length > 0 ? todayCourses[0] : null;

  const currentGpa = '3.72';
  const creditsEarned = 64;
  const weatherSummary = 'Sunny, 67°F';

  let briefing = `Today is ${getTodayLabel()}. `;
  if (todayCourses.length === 0) {
    briefing += `You have no classes today. It could be a good day to review notes, catch up on assignments, or plan the rest of your week.`;
  } else if (todayCourses.length === 1) {
    briefing += `You have 1 class today. Your next class is ${nextClass?.code} at ${nextClass?.time}. The weather looks ${weatherSummary.toLowerCase()}, so getting around campus should be easy.`;
  } else {
    briefing += `You have ${todayCourses.length} classes today. Your first class is ${nextClass?.code} at ${nextClass?.time}. The weather is ${weatherSummary.toLowerCase()}, and your day looks busy but manageable.`;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f7f8fa' }}>
      <View style={{ paddingTop: 60, paddingHorizontal: 18, paddingBottom: 30 }}>
        <Text style={{ fontSize: 28, fontWeight: 'bold' }}>Home</Text>
        <Text style={{ marginTop: 6, color: '#666', fontSize: 14 }}>
          {getTodayLabel()} Briefing
        </Text>

        <View
          style={{
            marginTop: 18,
            backgroundColor: 'white',
            borderRadius: 16,
            padding: 16,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
            Today’s Summary
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 22, color: '#333' }}>
            {briefing}
          </Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            marginTop: 16,
            justifyContent: 'space-between',
          }}
        >
          <View
            style={{
              width: '48%',
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 16,
            }}
          >
            <Text style={{ color: '#666', fontSize: 13 }}>Today’s Classes</Text>
            <Text style={{ fontSize: 28, fontWeight: 'bold', marginTop: 6 }}>
              {todayCourses.length}
            </Text>
          </View>

          <View
            style={{
              width: '48%',
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 16,
            }}
          >
            <Text style={{ color: '#666', fontSize: 13 }}>Weather</Text>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 6 }}>
              {weatherSummary}
            </Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            marginTop: 12,
            justifyContent: 'space-between',
          }}
        >
          <View
            style={{
              width: '48%',
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 16,
            }}
          >
            <Text style={{ color: '#666', fontSize: 13 }}>Current GPA</Text>
            <Text style={{ fontSize: 28, fontWeight: 'bold', marginTop: 6 }}>
              {currentGpa}
            </Text>
          </View>

          <View
            style={{
              width: '48%',
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 16,
            }}
          >
            <Text style={{ color: '#666', fontSize: 13 }}>Credits Earned</Text>
            <Text style={{ fontSize: 28, fontWeight: 'bold', marginTop: 6 }}>
              {creditsEarned}
            </Text>
          </View>
        </View>

        <View
          style={{
            marginTop: 16,
            backgroundColor: 'white',
            borderRadius: 16,
            padding: 16,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
            Next Class
          </Text>

          {nextClass ? (
            <View
              style={{
                backgroundColor: '#eef4ff',
                borderRadius: 12,
                padding: 14,
              }}
            >
              <Text style={{ fontWeight: '700', fontSize: 15 }}>{nextClass.code}</Text>
              <Text style={{ marginTop: 4 }}>{nextClass.title}</Text>
              <Text style={{ marginTop: 4, color: '#555' }}>
                {nextClass.days} {nextClass.time}
              </Text>
              <Text style={{ marginTop: 4, color: '#555' }}>{nextClass.professor}</Text>
            </View>
          ) : (
            <Text style={{ color: 'gray' }}>No classes scheduled for today.</Text>
          )}
        </View>

        <View
          style={{
            marginTop: 16,
            backgroundColor: 'white',
            borderRadius: 16,
            padding: 16,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
            Quick Actions
          </Text>

          <TouchableOpacity
            onPress={onGoToTimetable}
            style={{
              backgroundColor: '#007AFF',
              paddingVertical: 12,
              borderRadius: 10,
              marginBottom: 10,
            }}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
              View Timetable
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onGoToGrades}
            style={{
              backgroundColor: '#34C759',
              paddingVertical: 12,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
              View Grades
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
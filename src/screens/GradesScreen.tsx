import { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { courses } from '../data/courses';

type Props = {
  addedCourses: number[];
};

const gradeOptions = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D', 'F'];

const gradePoints: { [key: string]: number } = {
  A: 4.0,
  'A-': 3.7,
  'B+': 3.3,
  B: 3.0,
  'B-': 2.7,
  'C+': 2.3,
  C: 2.0,
  D: 1.0,
  F: 0.0,
};

const gpaHistory = [
  { term: 'Fall 2024', gpa: 3.48 },
  { term: 'Winter 2025', gpa: 3.61 },
  { term: 'Spring 2025', gpa: 3.67 },
  { term: 'Fall 2025', gpa: 3.72 },
];

function GpaLineChart() {
  const screenWidth = Dimensions.get('window').width;
  const chartOuterWidth = screenWidth - 64;
  const yAxisWidth = 36;
  const chartWidth = chartOuterWidth - yAxisWidth - 8;
  const chartHeight = 180;

  const minGpa = 3.0;
  const maxGpa = 4.0;
  const yLabels = [4.0, 3.75, 3.5, 3.25, 3.0];

  const pointRadius = 6;
  const horizontalPadding = pointRadius + 2;
  const usableWidth = chartWidth - horizontalPadding * 2;
  const stepX =
    gpaHistory.length > 1 ? usableWidth / (gpaHistory.length - 1) : usableWidth;

  const points = gpaHistory.map((item, index) => {
    const x = horizontalPadding + index * stepX;
    const normalized = (item.gpa - minGpa) / (maxGpa - minGpa);
    const y = chartHeight - normalized * chartHeight;

    return {
      ...item,
      x,
      y,
    };
  });

  const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <View style={{ width: '100%' }}>
      <View style={{ flexDirection: 'row' }}>
        <View
          style={{
            width: yAxisWidth,
            height: chartHeight,
            justifyContent: 'space-between',
          }}
        >
          {yLabels.map((label) => (
            <Text
              key={label}
              style={{ fontSize: 11, color: '#666', marginTop: -6 }}
            >
              {label.toFixed(2)}
            </Text>
          ))}
        </View>

        <View style={{ width: chartWidth, height: chartHeight }}>
          <Svg width={chartWidth} height={chartHeight}>
            {yLabels.map((label) => {
              const normalized = (label - minGpa) / (maxGpa - minGpa);
              const y = chartHeight - normalized * chartHeight;

              return (
                <Line
                  key={label}
                  x1="0"
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke="#e9e9e9"
                  strokeWidth="1"
                />
              );
            })}

            <Polyline
              points={polylinePoints}
              fill="none"
              stroke="#007AFF"
              strokeWidth="4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {points.map((point) => (
              <Circle
                key={point.term}
                cx={point.x}
                cy={point.y}
                r="6"
                fill="#007AFF"
                stroke="white"
                strokeWidth="2"
              />
            ))}
          </Svg>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          marginTop: 10,
          marginLeft: yAxisWidth,
          width: chartWidth,
          paddingHorizontal: horizontalPadding - 10,
          justifyContent: 'space-between',
        }}
      >
        {gpaHistory.map((point) => (
          <View key={point.term} style={{ width: 64, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: '#666', textAlign: 'center' }}>
              {point.term}
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '600', marginTop: 2 }}>
              {point.gpa.toFixed(2)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function GradesScreen({ addedCourses }: Props) {
  const [grades, setGrades] = useState<{ [key: number]: string }>({});

  const selectedCourses = courses.filter((course) =>
    addedCourses.includes(course.id)
  );

  const handleSelectGrade = (courseId: number, grade: string) => {
    setGrades((prev) => ({
      ...prev,
      [courseId]: grade,
    }));
  };

  const currentGpa = useMemo(() => {
    const gradedCourses = selectedCourses.filter((course) => grades[course.id]);
    if (gradedCourses.length === 0) return '3.72';

    const totalPoints = gradedCourses.reduce((sum, course) => {
      return sum + gradePoints[grades[course.id]];
    }, 0);

    return (totalPoints / gradedCourses.length).toFixed(2);
  }, [grades, selectedCourses]);

  const creditsEarned = 64;
  const completedCourses = 18;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f7f8fa' }}>
      <View style={{ paddingTop: 60, paddingHorizontal: 16, paddingBottom: 30 }}>
        <Text style={{ fontSize: 28, fontWeight: 'bold' }}>Grades</Text>
        <Text style={{ marginTop: 6, color: '#666', fontSize: 14 }}>
          Academic snapshot
        </Text>

        <View
          style={{
            flexDirection: 'row',
            marginTop: 18,
            justifyContent: 'space-between',
          }}
        >
          <View
            style={{
              width: '31%',
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 14,
            }}
          >
            <Text style={{ color: '#666', fontSize: 12 }}>GPA</Text>
            <Text style={{ fontSize: 24, fontWeight: 'bold', marginTop: 6 }}>
              {currentGpa}
            </Text>
          </View>

          <View
            style={{
              width: '31%',
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 14,
            }}
          >
            <Text style={{ color: '#666', fontSize: 12 }}>Credits</Text>
            <Text style={{ fontSize: 24, fontWeight: 'bold', marginTop: 6 }}>
              {creditsEarned}
            </Text>
          </View>

          <View
            style={{
              width: '31%',
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 14,
            }}
          >
            <Text style={{ color: '#666', fontSize: 12 }}>Completed</Text>
            <Text style={{ fontSize: 24, fontWeight: 'bold', marginTop: 6 }}>
              {completedCourses}
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
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 14 }}>
            GPA Trend
          </Text>

          <GpaLineChart />
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
            Current Courses
          </Text>

          {selectedCourses.length === 0 ? (
            <Text style={{ color: 'gray' }}>No courses added yet.</Text>
          ) : (
            <FlatList
              scrollEnabled={false}
              data={selectedCourses}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => {
                const selectedGrade = grades[item.id];

                return (
                  <View
                    style={{
                      backgroundColor: '#f2f2f2',
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 12,
                    }}
                  >
                    <Text style={{ fontWeight: 'bold', fontSize: 15 }}>{item.code}</Text>
                    <Text style={{ marginTop: 2 }}>{item.title}</Text>

                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        marginTop: 10,
                      }}
                    >
                      {gradeOptions.map((grade) => {
                        const isSelected = selectedGrade === grade;

                        return (
                          <TouchableOpacity
                            key={grade}
                            onPress={() => handleSelectGrade(item.id, grade)}
                            style={{
                              backgroundColor: isSelected ? '#007AFF' : 'white',
                              borderWidth: 1,
                              borderColor: isSelected ? '#007AFF' : '#ddd',
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 16,
                              marginRight: 8,
                              marginBottom: 8,
                            }}
                          >
                            <Text
                              style={{
                                color: isSelected ? 'white' : '#333',
                                fontSize: 12,
                              }}
                            >
                              {grade}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      </View>
    </ScrollView>
  );
}
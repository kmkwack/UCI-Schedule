import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

type Props = {
  onFinish: () => Promise<void> | void;
  finishing?: boolean;
};

type Slide = {
  title: string;
  body: string;
  eyebrow: string;
  accent: string;
};

const SLIDES: Slide[] = [
  {
    eyebrow: 'HOME',
    title: 'Start from the same dashboard you will actually use',
    body: 'Home keeps Quarter Progress, Today’s Classes, and Campus Events together so the first screen already tells you what matters.',
    accent: '#3D6CFF',
  },
  {
    eyebrow: 'TIMETABLE',
    title: 'Build your week in My Schedule',
    body: 'Add real classes first, then drop in custom blocks for the rest of your life.',
    accent: '#4169E1',
  },
  {
    eyebrow: 'CLASSMATES',
    title: 'Search friends and compare shared free time',
    body: 'Find classmates by university email, add them to ClassMates, and open their read-only timetable view when you need to line up plans.',
    accent: '#5B7CFA',
  },
  {
    eyebrow: 'BOARDS',
    title: 'Use community features the way the app is built',
    body: 'Browse boards, jump into posts, write course reviews, and request new boards when your campus conversations need more space.',
    accent: '#FF6B6B',
  },
];

function HomePreview() {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#16285b' }}>Home</Text>
          <Text style={{ fontSize: 12, color: '#7a859c', marginTop: 2 }}>Tuesday, April 22</Text>
        </View>
        <View style={{ backgroundColor: '#eef3ff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#4169E1' }}>Today&apos;s Classes</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, backgroundColor: '#eef3ff', borderRadius: 18, padding: 14 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#4169E1', marginBottom: 8 }}>Quarter Progress</Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#16285b' }}>61.284%</Text>
          <Text style={{ fontSize: 13, color: '#60708e' }}>Week 4 moving fast</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: '#fff4ea', borderRadius: 18, padding: 14 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#f97316', marginBottom: 8 }}>Campus Events</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#9a3412' }}>Baseball vs UCSB</Text>
          <Text style={{ fontSize: 13, color: '#c26f40' }}>6:00 PM at Anteater Ballpark</Text>
        </View>
      </View>

      <View style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: '#edf1ff' }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: '#16285b', marginBottom: 8 }}>Today&apos;s Classes</Text>
        {[
          ['ICS 33', 'Donald Bren Hall', '10:00 AM - 10:50 AM'],
          ['ECON 20B', 'Social Science Plaza', '1:00 PM - 2:20 PM'],
          ['Study Block', 'Custom block', '4:00 PM - 5:00 PM'],
        ].map(([name, location, time], index) => (
          <View
            key={name}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: 10,
              borderBottomWidth: index < 2 ? 1 : 0,
              borderBottomColor: '#edf1ff',
            }}
          >
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#16285b' }}>{name}</Text>
              <Text style={{ fontSize: 12, color: '#7a859c', marginTop: 2 }}>{location}</Text>
            </View>
            <Text style={{ fontSize: 12, color: '#60708e' }}>{time}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TimetablePreview() {
  const blocks = [
    { label: 'ICS 33', day: 0, color: '#4169E1', top: 34, height: 36 },
    { label: 'ECON 20B', day: 2, color: '#7C98F9', top: 70, height: 42 },
    { label: 'Club', day: 1, color: '#F59E0B', top: 128, height: 28 },
    { label: 'Gym', day: 4, color: '#10B981', top: 168, height: 28 },
  ];

  return (
    <View style={{ backgroundColor: '#ffffff', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: '#edf1ff' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#16285b' }}>Timetable</Text>
          <Text style={{ fontSize: 12, color: '#7a859c', marginTop: 2 }}>2026 Spring</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ backgroundColor: '#eef3ff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
            <Text style={{ color: '#4169E1', fontSize: 11, fontWeight: '800' }}>My Schedule</Text>
          </View>
          <View style={{ backgroundColor: '#4169E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
            <Text style={{ color: 'white', fontSize: 11, fontWeight: '800' }}>Add Course</Text>
          </View>
        </View>
      </View>

      <View style={{ height: 212, borderRadius: 18, backgroundColor: '#f5f5f7', overflow: 'hidden', paddingLeft: 34 }}>
        {[0, 1, 2, 3].map((row) => (
          <View key={row} style={{ position: 'absolute', left: 34, right: 0, top: row * 44, height: 1, backgroundColor: '#e4e7ef' }} />
        ))}

        {['9 AM', '11 AM', '1 PM', '3 PM'].map((time, index) => (
          <Text
            key={time}
            style={{
              position: 'absolute',
              left: 0,
              top: index * 44 + 16,
              width: 28,
              fontSize: 9,
              color: '#8892a7',
              textAlign: 'right',
            }}
          >
            {time}
          </Text>
        ))}

        {['M', 'T', 'W', 'Th', 'F'].map((day, index) => (
          <View
            key={day}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 34 + index * 42,
              width: 42,
              borderLeftWidth: index === 0 ? 0 : 1,
              borderLeftColor: '#e4e7ef',
            }}
          >
            <Text style={{ textAlign: 'center', fontSize: 11, fontWeight: '800', color: '#6b7280', paddingTop: 8 }}>
              {day}
            </Text>
          </View>
        ))}

        {blocks.map((block) => (
          <View
            key={`${block.label}-${block.day}`}
            style={{
              position: 'absolute',
              left: 40 + block.day * 42,
              width: 34,
              top: block.top,
              height: block.height,
              borderRadius: 10,
              backgroundColor: block.color,
              justifyContent: 'center',
              paddingHorizontal: 4,
            }}
          >
            <Text style={{ color: 'white', fontSize: 8, fontWeight: '800' }} numberOfLines={2}>
              {block.label}
            </Text>
          </View>
        ))}

        <View
          style={{
            position: 'absolute',
            left: 44,
            right: 14,
            bottom: 12,
            backgroundColor: '#eef3ff',
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Ionicons name="add-circle" size={14} color="#4169E1" />
          <Text style={{ color: '#4169E1', fontSize: 11, fontWeight: '700' }}>Custom block</Text>
        </View>
      </View>
    </View>
  );
}

function FriendsPreview() {
  return (
    <View style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#edf1ff', gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#16285b' }}>ClassMates</Text>
          <Text style={{ fontSize: 12, color: '#7a859c', marginTop: 2 }}>Search by university email</Text>
        </View>
        <View style={{ backgroundColor: '#eef3ff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
          <Text style={{ color: '#4169E1', fontSize: 11, fontWeight: '800' }}>Friend Requests</Text>
        </View>
      </View>

      <View style={{ backgroundColor: '#f8faff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Ionicons name="search-outline" size={16} color="#7a859c" />
        <Text style={{ color: '#94a3b8', fontSize: 13 }}>Search classmates...</Text>
      </View>

      <View style={{ backgroundColor: '#f8faff', borderRadius: 18, padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#dbe7ff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Text style={{ color: '#4169E1', fontSize: 15, fontWeight: '800' }}>JL</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#16285b' }}>Jordan Lee</Text>
            <Text style={{ fontSize: 12, color: '#7a859c', marginTop: 2 }}>friends visibility</Text>
          </View>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#4169E1' }}>View timetable</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: '#edf1ff' }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#16285b', marginBottom: 8 }}>My Schedule</Text>
            <View style={{ height: 54, borderRadius: 10, backgroundColor: '#eef3ff', justifyContent: 'center', paddingHorizontal: 10 }}>
              <View style={{ width: '100%', height: 12, borderRadius: 8, backgroundColor: '#4169E1', marginBottom: 6 }} />
              <View style={{ width: '65%', height: 10, borderRadius: 8, backgroundColor: '#9db3ff' }} />
            </View>
          </View>
          <View style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: '#edf1ff' }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#16285b', marginBottom: 8 }}>Jordan&apos;s Plan</Text>
            <View style={{ height: 54, borderRadius: 10, backgroundColor: '#f3f0ff', justifyContent: 'center', paddingHorizontal: 10 }}>
              <View style={{ width: '84%', height: 12, borderRadius: 8, backgroundColor: '#8B5CF6', marginBottom: 6 }} />
              <View style={{ width: '48%', height: 10, borderRadius: 8, backgroundColor: '#c4b5fd' }} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function CommunityPreview() {
  return (
    <View style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#ffe5e7', gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#16285b' }}>Boards</Text>
          <Text style={{ fontSize: 12, color: '#7a859c', marginTop: 2 }}>Choose a board to explore</Text>
        </View>
        <View style={{ backgroundColor: '#fff1f2', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
          <Text style={{ color: '#FF6B6B', fontSize: 11, fontWeight: '800' }}>Request New Board</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {['General Board', 'Sports Board', 'Study Groups Board'].map((label, index) => (
          <View
            key={label}
            style={{
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 7,
              backgroundColor: index === 0 ? '#eef3ff' : '#f8fafc',
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '800', color: index === 0 ? '#4169E1' : '#64748b' }}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={{ backgroundColor: '#fff8f8', borderRadius: 18, padding: 14 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#16285b', marginBottom: 4 }}>
          Best professor for ICS 6B?
        </Text>
        <Text style={{ fontSize: 12, color: '#7a859c', marginBottom: 10 }}>General Board · 3 replies</Text>
        <Text style={{ fontSize: 13, lineHeight: 20, color: '#52607b', marginBottom: 12 }}>
          Thinking about switching sections. Anyone taken this professor recently?
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ backgroundColor: '#fff1f2', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="star" size={14} color="#FF6B6B" />
            <Text style={{ color: '#d9475d', fontSize: 12, fontWeight: '700' }}>Write a Review</Text>
          </View>
          <View style={{ backgroundColor: '#eef3ff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="chatbubble-ellipses" size={14} color="#4169E1" />
            <Text style={{ color: '#4169E1', fontSize: 12, fontWeight: '700' }}>Open board</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function PreviewForSlide({ index }: { index: number }) {
  if (index === 0) return <HomePreview />;
  if (index === 1) return <TimetablePreview />;
  if (index === 2) return <FriendsPreview />;
  return <CommunityPreview />;
}

export default function FeatureOnboardingScreen({ onFinish, finishing = false }: Props) {
  const { colors, isDark } = useTheme();
  const [index, setIndex] = useState(0);
  const contentAnim = useRef(new Animated.Value(1)).current;
  const slide = SLIDES[index];

  useEffect(() => {
    contentAnim.setValue(0);
    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [contentAnim, index]);

  const goNext = () => {
    if (index === SLIDES.length - 1) {
      void onFinish();
      return;
    }
    setIndex((current) => current + 1);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#08111d' : '#f7f8ff' }}>
      <View style={{ position: 'absolute', top: -40, right: -30, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(61,108,255,0.16)' }} />
      <View style={{ position: 'absolute', top: 170, left: -60, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,107,107,0.10)' }} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <View>
            <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: slide.accent }}>
              {slide.eyebrow}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 4 }}>
              {index + 1} of {SLIDES.length}
            </Text>
          </View>
          <TouchableOpacity disabled={finishing} onPress={() => void onFinish()}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textSecondary, opacity: finishing ? 0.5 : 1 }}>
              Skip
            </Text>
          </TouchableOpacity>
        </View>

        <Animated.View style={{ opacity: contentAnim, transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
          <View
            style={{
              backgroundColor: isDark ? '#0f1726' : '#ffffff',
              borderRadius: 30,
              padding: 18,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(61,108,255,0.08)',
              shadowColor: '#0f172a',
              shadowOffset: { width: 0, height: 18 },
              shadowOpacity: 0.08,
              shadowRadius: 24,
              elevation: 8,
              marginBottom: 24,
            }}
          >
            <View style={{ marginBottom: 18 }}>
              <Text style={{ fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.text }}>
                {slide.title}
              </Text>
              <Text style={{ fontSize: 15, lineHeight: 23, color: colors.textSecondary, marginTop: 10 }}>
                {slide.body}
              </Text>
            </View>
            <PreviewForSlide index={index} />
          </View>
        </Animated.View>

        <View style={{ marginTop: 'auto' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
            {SLIDES.map((item, dotIndex) => {
              const active = dotIndex === index;
              return (
                <TouchableOpacity
                  key={item.title}
                  onPress={() => setIndex(dotIndex)}
                  style={{
                    width: active ? 28 : 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: active ? slide.accent : 'rgba(148, 163, 184, 0.35)',
                  }}
                />
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            {index > 0 ? (
              <TouchableOpacity
                disabled={finishing}
                onPress={() => setIndex((current) => Math.max(0, current - 1))}
                style={{
                  flex: 0.42,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: isDark ? '#101826' : '#ffffff',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 16,
                  opacity: finishing ? 0.5 : 1,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Back</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              disabled={finishing}
              onPress={goNext}
              style={{
                flex: index > 0 ? 0.58 : 1,
                borderRadius: 18,
                backgroundColor: slide.accent,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 16,
                flexDirection: 'row',
                gap: 8,
                shadowColor: slide.accent,
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.24,
                shadowRadius: 18,
                elevation: 8,
                opacity: finishing ? 0.7 : 1,
              }}
            >
              {finishing ? <ActivityIndicator size="small" color="white" /> : null}
              <Text style={{ fontSize: 15, fontWeight: '800', color: 'white' }}>
                {index === SLIDES.length - 1 ? 'Start Exploring' : 'Next'}
              </Text>
              {!finishing ? <Ionicons name="arrow-forward" size={17} color="white" /> : null}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

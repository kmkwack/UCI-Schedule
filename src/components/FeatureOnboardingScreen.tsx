import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Text, TouchableOpacity, View } from 'react-native';
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
    title: 'Start with today’s live class card',
    body: 'Home opens on the Apple-style class card you swipe through, with current, completed, and upcoming classes plus quick quarter and weather context below.',
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
    title: 'See which friends share your classes',
    body: 'ClassMates now starts with search, requests, and a shared-classes block that shows which courses overlap this quarter before the friend list.',
    accent: '#5B7CFA',
  },
  {
    eyebrow: 'BOARDS',
    title: 'Find the right board faster',
    body: 'Browse Hot Board, department boards, and community boards, then open posts with inline images, native file previews, likes, replies, and reports.',
    accent: '#FF6B6B',
  },
];

function HomePreview() {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#16285b' }}>Today</Text>
          <Text style={{ fontSize: 12, color: '#7a859c', marginTop: 2 }}>April 27 Monday · Week 5</Text>
        </View>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#eef3ff', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="person-outline" size={16} color="#4169E1" />
        </View>
      </View>

      <View style={{ backgroundColor: '#ffffff', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#e7ecfb' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#5eead4' }} />
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#7a859c' }}>Current class</Text>
            </View>
            <Text style={{ fontSize: 26, lineHeight: 30, fontWeight: '900', color: '#16285b' }}>Ends in</Text>
            <Text style={{ fontSize: 26, lineHeight: 30, fontWeight: '900', color: '#16285b' }}>22 min</Text>
            <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: '800', color: '#16285b', marginTop: 12 }}>ECON 129</Text>
            <Text style={{ fontSize: 13, color: '#7a859c', marginTop: 5 }}>1:00-1:50 PM · SSTR 103</Text>
          </View>
          <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 7, borderColor: '#e7ecfb', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#16285b' }}>1/3</Text>
            <Text style={{ fontSize: 11, color: '#7a859c' }}>done</Text>
          </View>
        </View>
        <View style={{ marginTop: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 }}>
            <Text style={{ fontSize: 11, color: '#7a859c' }}>1:00 PM</Text>
            <Text style={{ fontSize: 11, color: '#7a859c' }}>1:50 PM</Text>
          </View>
          <View style={{ height: 7, borderRadius: 999, backgroundColor: '#e7ecfb', overflow: 'hidden' }}>
            <View style={{ width: '58%', height: 7, borderRadius: 999, backgroundColor: '#5eead4' }} />
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        <View style={{ width: 16, height: 6, borderRadius: 3, backgroundColor: '#5eead4' }} />
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#dbe4f6' }} />
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#dbe4f6' }} />
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, backgroundColor: '#eef3ff', borderRadius: 18, padding: 14 }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#4169E1', marginBottom: 8 }}>Spring 2026</Text>
          <Text style={{ fontSize: 22, fontWeight: '900', color: '#16285b' }}>38%</Text>
          <Text style={{ fontSize: 12, color: '#60708e' }}>47 days left</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: '#fff4ea', borderRadius: 18, padding: 14 }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#f97316', marginBottom: 8 }}>Weather</Text>
          <Text style={{ fontSize: 22, fontWeight: '900', color: '#9a3412' }}>19°</Text>
          <Text style={{ fontSize: 12, color: '#c26f40' }}>Clear Sky</Text>
        </View>
      </View>
    </View>
  );
}

function TimetablePreview() {
  const blocks = [
    { dept: 'ECON', num: '129', day: 0, color: '#dbeafe', text: '#1d4ed8', top: 22, height: 46 },
    { dept: 'COMPSCI', num: '161', day: 2, color: '#dcfce7', text: '#15803d', top: 72, height: 56 },
    { dept: 'MATH', num: '2B', day: 4, color: '#ffedd5', text: '#c2410c', top: 34, height: 42 },
  ];

  return (
    <View style={{ backgroundColor: '#ffffff', borderRadius: 22, padding: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: '900', color: '#16285b' }}>Timetable</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ backgroundColor: '#eef3ff', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ color: '#4169E1', fontSize: 11, fontWeight: '900' }}>Spring 2026</Text>
          </View>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#f4f6fb', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="settings-outline" size={15} color="#7a859c" />
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <View style={{ backgroundColor: '#4169E1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
          <Text style={{ color: 'white', fontSize: 11, fontWeight: '900' }}>My Schedule</Text>
        </View>
        <View style={{ backgroundColor: '#eef3ff', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 }}>
          <Text style={{ color: '#4169E1', fontSize: 11, fontWeight: '800' }}>Plan B</Text>
        </View>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#eef3ff', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={15} color="#4169E1" />
        </View>
      </View>

      <View style={{ height: 190, borderRadius: 18, backgroundColor: '#f5f5f7', overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: 34, top: 0, right: 0, height: 26, flexDirection: 'row' }}>
          {['M', 'T', 'W', 'Th', 'F'].map((day, index) => (
            <View
              key={day}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ffffff',
                borderLeftWidth: index === 0 ? 0 : 1,
                borderLeftColor: '#e1e5ee',
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '900', color: '#64748b' }}>{day}</Text>
            </View>
          ))}
        </View>

        <View style={{ position: 'absolute', left: 34, right: 0, top: 26, bottom: 0, flexDirection: 'row' }}>
          {['M', 'T', 'W', 'Th', 'F'].map((day, index) => (
            <View
              key={`${day}-column`}
              style={{
                flex: 1,
                position: 'relative',
                backgroundColor: '#ffffff',
                borderLeftWidth: index === 0 ? 0 : 1,
                borderLeftColor: '#e1e5ee',
              }}
            >
              {blocks
                .filter((block) => block.day === index)
                .map((block) => (
                  <View
                    key={`${block.dept}-${block.num}`}
                    style={{
                      position: 'absolute',
                      left: 5,
                      right: 5,
                      top: block.top,
                      height: block.height,
                      borderRadius: 8,
                      backgroundColor: block.color,
                      justifyContent: 'center',
                      alignItems: 'center',
                      paddingHorizontal: 2,
                      borderWidth: 1,
                      borderColor: 'rgba(15, 23, 42, 0.05)',
                    }}
                  >
                    <Text style={{ color: block.text, fontSize: 7, fontWeight: '900' }} numberOfLines={1}>
                      {block.dept}
                    </Text>
                    <Text style={{ color: block.text, fontSize: 8, fontWeight: '900' }} numberOfLines={1}>
                      {block.num}
                    </Text>
                  </View>
                ))}
            </View>
          ))}
        </View>

        {[0, 1, 2, 3].map((row) => (
          <View key={row} style={{ position: 'absolute', left: 34, right: 0, top: 26 + row * 40, height: 1, backgroundColor: '#edf0f6' }} />
        ))}

        {['9 AM', '11 AM', '1 PM', '3 PM'].map((time, index) => (
          <Text
            key={time}
            style={{
              position: 'absolute',
              left: 0,
              top: 29 + index * 40,
              width: 28,
              fontSize: 8,
              color: '#8892a7',
              textAlign: 'right',
            }}
          >
            {time}
          </Text>
        ))}

      </View>
    </View>
  );
}

function FriendsPreview() {
  return (
    <View style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ fontSize: 16, fontWeight: '900', color: '#16285b' }}>ClassMates</Text>
          <Text style={{ fontSize: 11, color: '#7a859c', marginTop: 1 }}>Search, requests, shared classes</Text>
        </View>
      </View>

      <View style={{ backgroundColor: '#f8faff', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="search-outline" size={14} color="#7a859c" />
        <Text style={{ color: '#94a3b8', fontSize: 12 }}>Search classmates...</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1, backgroundColor: '#4169E1', borderRadius: 999, paddingVertical: 6, alignItems: 'center' }}>
          <Text style={{ color: 'white', fontSize: 11, fontWeight: '900' }}>ClassMates (3)</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: '#eef3ff', borderRadius: 999, paddingVertical: 6, alignItems: 'center' }}>
          <Text style={{ color: '#4169E1', fontSize: 11, fontWeight: '900' }}>Requests</Text>
        </View>
      </View>

      <View style={{ backgroundColor: '#f8faff', borderRadius: 16, padding: 10, borderWidth: 1, borderColor: '#edf1ff' }}>
        <Text style={{ fontSize: 9, fontWeight: '900', letterSpacing: 0.9, color: '#9aa7c2', marginBottom: 5 }}>
          SHARED CLASSES THIS QUARTER
        </Text>
        {[
          ['ECON 129', ['M', 'S'], 2],
          ['COMPSCI 161', ['M', 'D'], 2],
        ].map(([course, initials, count], index) => (
          <View
            key={course as string}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 5,
              borderBottomWidth: index < 1 ? 1 : 0,
              borderBottomColor: '#edf1ff',
            }}
          >
            <View style={{ minWidth: 78, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#edf8e8' }}>
              <Text style={{ fontSize: 10, fontWeight: '900', color: '#4b7f28' }}>{course as string}</Text>
            </View>
            <View style={{ flex: 1, flexDirection: 'row', marginLeft: 10 }}>
              {(initials as string[]).map((letter, avatarIndex) => (
                <View
                  key={`${course}-${letter}`}
                  style={{
                    width: 23,
                    height: 23,
                    borderRadius: 12,
                    backgroundColor: avatarIndex === 0 ? '#ff6b14' : '#20b9aa',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: avatarIndex === 0 ? 0 : -5,
                    borderWidth: 2,
                    borderColor: '#f8faff',
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 10, fontWeight: '900' }}>{letter}</Text>
                </View>
              ))}
            </View>
            <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: '900' }}>{count as number}</Text>
          </View>
        ))}
      </View>

      <View style={{ backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#edf1ff', overflow: 'hidden' }}>
        {[
          ['M', 'Mina Kim', '2 shared · ECON 129 · COMPSCI 161'],
        ].map(([initial, name, meta]) => (
          <View
            key={name}
            style={{ flexDirection: 'row', alignItems: 'center', padding: 8 }}
          >
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#ff6b14', alignItems: 'center', justifyContent: 'center', marginRight: 9 }}>
              <Text style={{ color: 'white', fontSize: 13, fontWeight: '900' }}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '900', color: '#16285b' }}>{name}</Text>
              <Text numberOfLines={1} style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{meta}</Text>
            </View>
            <View style={{ backgroundColor: '#eef3ff', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: '#4169E1', fontSize: 10, fontWeight: '900' }}>View</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function CommunityPreview() {
  return (
    <View style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 16, fontWeight: '900', color: '#16285b' }}>Board</Text>
          <Text style={{ fontSize: 11, color: '#7a859c', marginTop: 1 }}>Hot, departments, community</Text>
        </View>
        <View style={{ backgroundColor: '#4169E1', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Ionicons name="add" size={12} color="white" />
          <Text style={{ color: 'white', fontSize: 10, fontWeight: '900' }}>Post</Text>
        </View>
      </View>

      <View style={{ backgroundColor: '#f8faff', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="search-outline" size={14} color="#7a859c" />
        <Text style={{ color: '#94a3b8', fontSize: 12 }}>Search all board posts...</Text>
      </View>

      {[
        ['flame-outline', '#F97316', '#fff7ed', 'TRENDING NOW', 'Hot Board', 'Posts over 10 likes'],
        ['school-outline', '#4169E1', '#eef3ff', 'SCHOOL BOARDS', 'Department Boards', 'Browse 140+ departments'],
      ].map(([icon, color, bg, eyebrow, title, subtitle]) => (
        <View
          key={title}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 15,
            padding: 9,
            backgroundColor: '#ffffff',
            borderWidth: 1,
            borderColor: '#edf1ff',
          }}
        >
          <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: bg as string, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
            <Ionicons name={icon as any} size={17} color={color as string} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 8, fontWeight: '900', letterSpacing: 0.6, color: '#94a3b8', marginBottom: 2 }}>{eyebrow as string}</Text>
            <Text style={{ fontSize: 12, fontWeight: '900', color: '#16285b' }}>{title as string}</Text>
            <Text style={{ fontSize: 10, color: '#7a859c', marginTop: 1 }}>{subtitle as string}</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={color as string} />
        </View>
      ))}

      <View style={{ backgroundColor: '#fff8f8', borderRadius: 16, padding: 10, borderWidth: 1, borderColor: '#ffe1e1' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 }}>
          <Text style={{ fontSize: 10, fontWeight: '900', color: '#FF6B6B' }}>General</Text>
          <Text style={{ fontSize: 10, color: '#c9a0a0' }}>·</Text>
          <Text style={{ fontSize: 10, color: '#c9a0a0' }}>Anteater 12</Text>
        </View>
        <Text style={{ fontSize: 12, fontWeight: '900', color: '#16285b', marginBottom: 6 }}>
          Anyone selling a used iPad?
        </Text>
        <View style={{ height: 42, borderRadius: 12, backgroundColor: '#ffd6d6', marginBottom: 7, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', left: 9, top: 8, width: 56, height: 26, borderRadius: 8, backgroundColor: '#ff8a8a' }} />
          <View style={{ position: 'absolute', right: 12, top: 10, width: 76, height: 8, borderRadius: 4, backgroundColor: '#fff1f2' }} />
          <View style={{ position: 'absolute', right: 12, top: 24, width: 52, height: 8, borderRadius: 4, backgroundColor: '#fff1f2' }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ backgroundColor: '#fff1f2', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="thumbs-up" size={12} color="#FF6B6B" />
            <Text style={{ color: '#d9475d', fontSize: 11, fontWeight: '900' }}>12</Text>
          </View>
          <View style={{ backgroundColor: '#eef3ff', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="chatbubble-ellipses" size={12} color="#4169E1" />
            <Text style={{ color: '#4169E1', fontSize: 11, fontWeight: '900' }}>4</Text>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#08111d' : '#f7f8ff' }} edges={['top', 'left', 'right', 'bottom']}>
      <View style={{ position: 'absolute', top: -40, right: -30, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(61,108,255,0.16)' }} />
      <View style={{ position: 'absolute', top: 170, left: -60, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,107,107,0.10)' }} />
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 28 }}>
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
              shadowColor: '#0f172a',
              shadowOffset: { width: 0, height: 18 },
              shadowOpacity: 0.06,
              shadowRadius: 22,
              elevation: 6,
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
      </View>
    </SafeAreaView>
  );
}

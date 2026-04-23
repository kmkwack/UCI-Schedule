import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ClassMateMonogram from './ClassMateMonogram';
import { useTheme } from '../context/ThemeContext';

type Props = {
  onComplete: () => void;
};

export default function ClassMateIntroScreen({ onComplete }: Props) {
  const { colors, isDark } = useTheme();
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.72)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkTranslateY = useRef(new Animated.Value(16)).current;
  const cardsOpacity = useRef(new Animated.Value(0)).current;
  const cardsTranslateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const reveal = Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 460,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 75,
          friction: 9,
        }),
      ]),
      Animated.parallel([
        Animated.timing(wordmarkOpacity, {
          toValue: 1,
          duration: 340,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(wordmarkTranslateY, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(cardsOpacity, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cardsTranslateY, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);

    reveal.start();

    const timer = setTimeout(() => {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 460,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onComplete();
      });
    }, 3200);

    return () => {
      clearTimeout(timer);
      reveal.stop();
    };
  }, [cardsOpacity, cardsTranslateY, logoOpacity, logoScale, onComplete, overlayOpacity, wordmarkOpacity, wordmarkTranslateY]);

  const chips = [
    { icon: 'today-outline' as const, label: 'Home at a glance' },
    { icon: 'grid-outline' as const, label: 'Custom schedules' },
    { icon: 'people-outline' as const, label: 'Campus connections' },
  ];

  return (
    <Animated.View style={{ flex: 1, opacity: overlayOpacity }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#08111d' : '#f3f7ff' }}>
        <View style={{ position: 'absolute', top: -50, right: -40, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(61,108,255,0.22)' }} />
        <View style={{ position: 'absolute', top: 150, left: -80, width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(255,98,118,0.15)' }} />
        <View style={{ position: 'absolute', bottom: 130, right: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(80,191,255,0.16)' }} />

        <View style={{ flex: 1, paddingHorizontal: 28, justifyContent: 'center', alignItems: 'center' }}>
          <Animated.View
            style={{
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
              width: 154,
              height: 144,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 24,
              shadowColor: '#3D6CFF',
              shadowOffset: { width: 0, height: 18 },
              shadowOpacity: 0.32,
              shadowRadius: 24,
              elevation: 12,
            }}
          >
            <ClassMateMonogram size={136} isDark={isDark} />
          </Animated.View>

          <Animated.View
            style={{
              opacity: wordmarkOpacity,
              transform: [{ translateY: wordmarkTranslateY }],
              alignItems: 'center',
              marginBottom: 28,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', letterSpacing: 0.8, color: isDark ? '#d7e4ff' : '#5e73a8', marginBottom: 8 }}>
              ENTERING CLASSMATE
            </Text>
            <Text style={{ fontSize: 48, fontWeight: '800', letterSpacing: -2.2 }}>
              <Text style={{ color: isDark ? '#eef3ff' : '#16285b' }}>Class</Text>
              <Text style={{ color: '#3D6CFF' }}>Mate</Text>
            </Text>
            <Text style={{ marginTop: 12, color: colors.textSecondary, fontSize: 15, lineHeight: 23, textAlign: 'center', maxWidth: 320 }}>
              Your campus life is coming together in one place.
            </Text>
          </Animated.View>

          <Animated.View
            style={{
              opacity: cardsOpacity,
              transform: [{ translateY: cardsTranslateY }],
              width: '100%',
              gap: 12,
            }}
          >
            {chips.map((chip, index) => (
              <View
                key={chip.label}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  alignSelf: index === 1 ? 'center' : index === 2 ? 'flex-end' : 'flex-start',
                  backgroundColor: isDark ? 'rgba(15, 23, 42, 0.62)' : 'rgba(255,255,255,0.86)',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(61,108,255,0.08)',
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  gap: 8,
                  shadowColor: '#0f172a',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.08,
                  shadowRadius: 16,
                  elevation: 5,
                }}
              >
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(61,108,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={chip.icon} size={16} color="#3D6CFF" />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{chip.label}</Text>
              </View>
            ))}
          </Animated.View>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

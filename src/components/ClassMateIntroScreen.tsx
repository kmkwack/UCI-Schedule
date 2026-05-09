import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ClassMateMonogram from './ClassMateMonogram';
import { useTheme } from '../context/ThemeContext';

type Props = {
  onComplete: () => void;
  schoolName?: string;
};

export default function ClassMateIntroScreen({ onComplete, schoolName }: Props) {
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

  const campusName = schoolName?.trim() || 'your campus';
  const chips = [
    { icon: 'today-outline' as const, label: 'Campus at a glance' },
    { icon: 'grid-outline' as const, label: 'Your class rhythm' },
    { icon: 'people-outline' as const, label: 'Meet classmates' },
  ];

  return (
    <Animated.View style={{ flex: 1, opacity: overlayOpacity }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1, paddingHorizontal: 28, justifyContent: 'center', alignItems: 'center' }}>
          <Animated.View
            style={{
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
              width: 148,
              height: 148,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 24,
            }}
          >
            <ClassMateMonogram size={148} isDark={isDark} />
          </Animated.View>

          <Animated.View
            style={{
              opacity: wordmarkOpacity,
              transform: [{ translateY: wordmarkTranslateY }],
              alignItems: 'center',
              marginBottom: 28,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '800', letterSpacing: 0.8, color: isDark ? '#d7e4ff' : '#5e73a8', marginBottom: 8 }}>
              CONNECTING TO CAMPUS
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.74}
              style={{ fontSize: 44, fontWeight: '800', letterSpacing: 0, color: isDark ? '#eef3ff' : '#16285b', textAlign: 'center', maxWidth: 340 }}
            >
              Your Campus
            </Text>
            <Text style={{ marginTop: 12, color: colors.textSecondary, fontSize: 15, lineHeight: 23, textAlign: 'center', maxWidth: 320 }}>
              Step into {campusName}, meet classmates, and keep your day moving in one place.
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
                  backgroundColor: isDark ? 'rgba(15, 23, 42, 0.62)' : 'rgba(255,255,255,0.84)',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(188,199,221,0.28)',
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  gap: 8,
                }}
              >
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isDark ? 'rgba(49,168,255,0.18)' : 'rgba(9,107,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={chip.icon} size={16} color={colors.brand} />
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

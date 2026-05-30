import { useEffect, useRef } from 'react';
import { Animated, View, Text } from 'react-native';

// ─── Shared cell layout ───────────────────────────────────────────────────────
// [col, row, color] — mirrors the boot-screen ScheduleLoader in App.tsx
const CELLS: [number, number, string][] = [
  [0, 0, '#60a5fa'], [0, 1, '#60a5fa'], [0, 2, '#60a5fa'],
  [1, 2, '#86efac'], [1, 3, '#86efac'],
  [2, 0, '#fca5a5'], [2, 1, '#fca5a5'], [2, 4, '#fca5a5'], [2, 5, '#fca5a5'],
  [3, 1, '#c4b5fd'], [3, 2, '#c4b5fd'], [3, 3, '#c4b5fd'],
  [4, 0, '#fcd34d'], [4, 3, '#fcd34d'], [4, 4, '#fcd34d'],
];

// ─── Full-screen loader (boot / tab-level) ────────────────────────────────────
const FULL_W = 42;
const FULL_H = 24;
const FULL_GAP = 5;
const FULL_DAYS = ['M', 'T', 'W', 'Th', 'F'];

export function FullScreenLoader({ isDark, label = 'Loading your schedule...' }: { isDark: boolean; label?: string }) {
  const anims = useRef(CELLS.map(() => new Animated.Value(0))).current;
  const textAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const stagger = Animated.stagger(
      50,
      anims.map((a) =>
        Animated.spring(a, { toValue: 1, useNativeDriver: true, tension: 220, friction: 11 })
      )
    );
    stagger.start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(textAnim, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(textAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    const sequence = Animated.sequence([
      Animated.timing(textAnim, { toValue: 1, duration: 350, delay: 300, useNativeDriver: true }),
      pulse,
    ]);
    sequence.start();

    return () => { stagger.stop(); sequence.stop(); pulse.stop(); };
  }, []);

  const gridW = 5 * (FULL_W + FULL_GAP) - FULL_GAP;
  const gridH = 6 * (FULL_H + FULL_GAP) - FULL_GAP;

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#09111d' : '#f4f7ff', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', gap: FULL_GAP, marginBottom: 8 }}>
        {FULL_DAYS.map((d) => (
          <Text
            key={d}
            style={{ width: FULL_W, fontSize: 11, fontWeight: '800', textAlign: 'center', color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)' }}
          >
            {d}
          </Text>
        ))}
      </View>
      <View style={{ width: gridW, height: gridH }}>
        {CELLS.map(([col, row, color], idx) => (
          <Animated.View
            key={idx}
            style={{
              position: 'absolute',
              left: col * (FULL_W + FULL_GAP),
              top: row * (FULL_H + FULL_GAP),
              width: FULL_W,
              height: FULL_H,
              borderRadius: 8,
              backgroundColor: color,
              opacity: anims[idx],
              transform: [{ scale: anims[idx].interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
            }}
          />
        ))}
      </View>
      <Animated.Text
        style={{
          marginTop: 28,
          fontSize: 14,
          fontWeight: '600',
          color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.38)',
          opacity: textAnim,
        }}
      >
        {label}
      </Animated.Text>
    </View>
  );
}

// ─── Mini loader (inline content areas) ──────────────────────────────────────
const MINI_W = 18;
const MINI_H = 10;
const MINI_GAP = 3;

export function MiniLoader({ label, labelColor = 'rgba(0,0,0,0.38)' }: { label?: string; labelColor?: string }) {
  const anims = useRef(CELLS.map(() => new Animated.Value(0))).current;
  const textAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pop in once
    const stagger = Animated.stagger(
      35,
      anims.map((a) =>
        Animated.spring(a, { toValue: 1, useNativeDriver: true, tension: 260, friction: 12 })
      )
    );
    stagger.start();

    // Then pulse gently
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(textAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
        Animated.timing(textAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    const sequence = Animated.sequence([
      Animated.timing(textAnim, { toValue: 1, duration: 250, delay: 200, useNativeDriver: true }),
      pulse,
    ]);
    sequence.start();

    return () => { stagger.stop(); sequence.stop(); pulse.stop(); };
  }, []);

  const gridW = 5 * (MINI_W + MINI_GAP) - MINI_GAP;
  const gridH = 6 * (MINI_H + MINI_GAP) - MINI_GAP;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <View style={{ width: gridW, height: gridH }}>
        {CELLS.map(([col, row, color], idx) => (
          <Animated.View
            key={idx}
            style={{
              position: 'absolute',
              left: col * (MINI_W + MINI_GAP),
              top: row * (MINI_H + MINI_GAP),
              width: MINI_W,
              height: MINI_H,
              borderRadius: 4,
              backgroundColor: color,
              opacity: anims[idx],
              transform: [{ scale: anims[idx].interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
            }}
          />
        ))}
      </View>
      {label ? (
        <Animated.Text
          style={{ fontSize: 13, fontWeight: '600', color: labelColor, opacity: textAnim }}
        >
          {label}
        </Animated.Text>
      ) : null}
    </View>
  );
}

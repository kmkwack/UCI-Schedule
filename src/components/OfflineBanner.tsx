import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useIsOffline } from '../lib/network';

/**
 * A strip under the status bar that names the problem when the network is
 * gone. Without it an offline launch is indistinguishable from a broken app —
 * empty lists and spinners with no explanation.
 *
 * Deliberately not a blocking overlay: cached data, the timetable, and grades
 * are all still worth reading offline, so the app stays usable underneath.
 */
export default function OfflineBanner() {
  const offline = useIsOffline();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: offline ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [offline, slide]);

  // Kept mounted while hidden so the reconnect can animate out rather than
  // vanishing mid-slide.
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + 6,
          backgroundColor: colors.destructive,
          opacity: slide,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) }],
        },
      ]}
    >
      <View style={styles.row}>
        <Text
          style={styles.text}
          accessibilityRole="alert"
          accessibilityLabel="No internet connection. Showing saved data."
        >
          No internet connection — showing saved data
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  row: { alignItems: 'center' },
  text: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});

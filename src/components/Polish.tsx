import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { MOTION } from '../utils/motion';

export function SkeletonBlock({
  width = '100%',
  height,
  radius = 12,
  style,
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: object;
}) {
  const { colors, isDark } = useTheme();
  const opacity = useRef(new Animated.Value(0.42)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.78,
          duration: 720,
          easing: MOTION.easing.soft,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.42,
          duration: 720,
          easing: MOTION.easing.soft,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : colors.bgTertiary,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  compact = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: compact ? 14 : 24, paddingVertical: compact ? 18 : 30 }}>
      <View style={{
        width: compact ? 42 : 52,
        height: compact ? 42 : 52,
        borderRadius: compact ? 18 : 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.brandBg,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
      }}>
        <Ionicons name={icon} size={compact ? 21 : 25} color={colors.brand} />
      </View>
      <Text style={{ marginTop: 12, fontSize: compact ? 14 : 16, lineHeight: compact ? 18 : 21, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
        {title}
      </Text>
      {body ? (
        <Text style={{ marginTop: 6, fontSize: 14, lineHeight: 20, color: colors.textTertiary, textAlign: 'center' }}>
          {body}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: 14 }}>{action}</View> : null}
    </View>
  );
}

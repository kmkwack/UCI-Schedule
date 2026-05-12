import { View, Text, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, type Colors } from '../context/ThemeContext';

type ChipTone = 'brand' | 'neutral' | 'success' | 'warning' | 'danger';

type Props = {
  icon?: ComponentProps<typeof Ionicons>['name'];
  label: string;
  tone?: ChipTone;
  compact?: boolean;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

function toneColors(tone: ChipTone, colors: Colors, isDark: boolean) {
  switch (tone) {
    case 'brand':
      return {
        backgroundColor: colors.brandBg,
        borderColor: `${colors.brand}33`,
        color: colors.brand,
      };
    case 'success':
      return {
        backgroundColor: isDark ? 'rgba(34,197,94,0.16)' : '#ecfdf5',
        borderColor: 'rgba(34,197,94,0.26)',
        color: isDark ? '#86efac' : '#16a34a',
      };
    case 'warning':
      return {
        backgroundColor: isDark ? 'rgba(245,158,11,0.16)' : '#fff7ed',
        borderColor: 'rgba(245,158,11,0.28)',
        color: isDark ? '#fbbf24' : '#d97706',
      };
    case 'danger':
      return {
        backgroundColor: colors.destructiveBg,
        borderColor: `${colors.destructive}33`,
        color: colors.destructive,
      };
    case 'neutral':
    default:
      return {
        backgroundColor: colors.bgTertiary,
        borderColor: colors.borderSubtle,
        color: colors.textSecondary,
      };
  }
}

export default function InfoChip({
  icon,
  label,
  tone = 'neutral',
  compact = false,
  color,
  backgroundColor,
  borderColor,
  iconSize,
  style,
  textStyle,
}: Props) {
  const { colors, isDark } = useTheme();
  const palette = toneColors(tone, colors, isDark);
  const chipColor = color ?? palette.color;

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: compact ? 3 : 4,
          maxWidth: '100%',
          borderRadius: 999,
          borderWidth: 1,
          borderColor: borderColor ?? palette.borderColor,
          backgroundColor: backgroundColor ?? palette.backgroundColor,
          paddingHorizontal: compact ? 7 : 8,
          paddingVertical: compact ? 3 : 4,
        },
        style,
      ]}
    >
      {icon ? (
        <Ionicons name={icon} size={iconSize ?? (compact ? 11 : 12)} color={chipColor} />
      ) : null}
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[
          {
            flexShrink: 1,
            minWidth: 0,
            color: chipColor,
            fontSize: compact ? 10 : 11,
            lineHeight: compact ? 13 : 14,
            fontWeight: '800',
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

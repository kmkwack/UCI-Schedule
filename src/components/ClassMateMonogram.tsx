import { Text, View } from 'react-native';

type Props = {
  size?: number;
  isDark: boolean;
};

export default function ClassMateMonogram({ size = 104, isDark }: Props) {
  const radius = Math.round(size * 0.29);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: '#4169E1',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#4169E1',
        shadowOffset: { width: 0, height: Math.max(12, size * 0.16) },
        shadowOpacity: 0.28,
        shadowRadius: Math.max(18, size * 0.24),
        elevation: 12,
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: Math.max(8, size * 0.08),
          left: Math.max(8, size * 0.08),
          right: Math.max(8, size * 0.08),
          height: Math.max(28, size * 0.32),
          borderRadius: Math.max(20, size * 0.21),
          backgroundColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.24)',
        }}
      />
      <Text
        style={{
          color: 'white',
          fontSize: Math.round(size * 0.4),
          fontWeight: '800',
          letterSpacing: -Math.max(2, size * 0.028),
          marginTop: -2,
        }}
      >
        CM
      </Text>
    </View>
  );
}

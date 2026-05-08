import { Image, Text, View, type ImageSourcePropType } from 'react-native';
import { getSchoolConfig, type University } from '../data/schools';

const UNIVERSITY_LOGOS: Partial<Record<string, ImageSourcePropType>> = {
  uci: require('../../assets/uci-logo-white.png'),
  umd: require('../../assets/umd-logo.png'),
  cornell: require('../../assets/cornell-logo-white.png'),
  purdue: require('../../assets/purdue-logo-white.png'),
  uiuc: require('../../assets/uiuc-logo-white.png'),
  ucr: require('../../assets/ucr-logo-white-bg.png'),
  northeastern: require('../../assets/northeastern-logo-white-bg.png'),
  temple: require('../../assets/temple-logo-white-bg.png'),
  gsu: require('../../assets/gsu-logo-white-bg.png'),
};

type Props = {
  university: University;
  width?: number;
  height?: number;
  marginRight?: number;
};

export default function UniversityLogo({
  university,
  width = 128,
  height = 44,
  marginRight = 0,
}: Props) {
  const schoolConfig = getSchoolConfig(university.name);
  const accent = schoolConfig.accent;
  const source = UNIVERSITY_LOGOS[university.id];
  const size = Math.min(width, height);
  const logoDisplay =
    university.id === 'gsu'
      ? { width: Math.min(92, width), height: 74 }
      : null;

  if (source) {
    return (
      <View
        style={{
          width,
          height: logoDisplay ? Math.max(height, logoDisplay.height) : height,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight,
        }}
      >
        <Image
          source={source}
          style={logoDisplay ?? { width: '100%', height: '100%' }}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(14, size * 0.28),
        backgroundColor: accent,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight,
      }}
    >
      <Text style={{ color: 'white', fontWeight: '900', fontSize: Math.min(20, size * 0.34) }}>
        {university.logo}
      </Text>
    </View>
  );
}

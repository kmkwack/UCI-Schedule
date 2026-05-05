import { Image } from 'react-native';

type Props = {
  size?: number;
  isDark: boolean;
};

export default function ClassMateMonogram({ size = 104, isDark }: Props) {
  void isDark;

  return (
    <Image
      source={require('../../assets/classmate-logo-approved.png')}
      style={{
        width: size,
        height: size,
      }}
      resizeMode="contain"
    />
  );
}

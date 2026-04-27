import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

export type ThemePreference = 'light' | 'dark' | 'auto';

export type Colors = {
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  card: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderSubtle: string;
  brand: string;
  brandBg: string;
  destructive: string;
  destructiveBg: string;
  inputBg: string;
  placeholder: string;
  sectionHeaderBg: string;
};

const LIGHT: Colors = {
  bg: '#f5f7fc',
  bgSecondary: '#edf2fb',
  bgTertiary: '#e5ebf7',
  card: '#ffffff',
  text: '#16203a',
  textSecondary: '#4d5975',
  textTertiary: '#72809d',
  border: '#dbe3f0',
  borderSubtle: '#e9eef7',
  brand: '#4169E1',
  brandBg: '#eef3ff',
  destructive: '#ef4444',
  destructiveBg: '#fff1f2',
  inputBg: '#f6f8fd',
  placeholder: '#93a2bf',
  sectionHeaderBg: '#f1f5fc',
};

const DARK: Colors = {
  bg: '#08111f',
  bgSecondary: '#0d1728',
  bgTertiary: '#132036',
  card: '#101b2d',
  text: '#f5f7ff',
  textSecondary: '#bac4da',
  textTertiary: '#8694b2',
  border: '#23324a',
  borderSubtle: '#17243a',
  brand: '#4169E1',
  brandBg: '#162746',
  destructive: '#ff453a',
  destructiveBg: '#2d1515',
  inputBg: '#132036',
  placeholder: '#7383a3',
  sectionHeaderBg: '#0d1728',
};

type ThemeContextType = { colors: Colors; isDark: boolean };

export const ThemeContext = createContext<ThemeContextType>({
  colors: LIGHT,
  isDark: false,
});

export function ThemeProvider({
  preference,
  children,
}: {
  preference: ThemePreference;
  children: React.ReactNode;
}) {
  const system = useColorScheme();
  const isDark = preference === 'auto' ? system === 'dark' : preference === 'dark';
  const colors = isDark ? DARK : LIGHT;
  return (
    <ThemeContext.Provider value={{ colors, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

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
  bg: '#ffffff',
  bgSecondary: '#f7f8fa',
  bgTertiary: '#f3f4f6',
  card: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
  textTertiary: '#9ca3af',
  border: '#e5e7eb',
  borderSubtle: '#f3f4f6',
  brand: '#4169E1',
  brandBg: '#e8edf9',
  destructive: '#ef4444',
  destructiveBg: '#fff1f2',
  inputBg: '#f3f4f6',
  placeholder: '#9ca3af',
  sectionHeaderBg: '#f7f8fa',
};

const DARK: Colors = {
  bg: '#000000',
  bgSecondary: '#1c1c1e',
  bgTertiary: '#2c2c2e',
  card: '#1c1c1e',
  text: '#ffffff',
  textSecondary: '#8e8e93',
  textTertiary: '#636366',
  border: '#38383a',
  borderSubtle: '#2c2c2e',
  brand: '#4169E1',
  brandBg: '#1a2340',
  destructive: '#ff453a',
  destructiveBg: '#2d1515',
  inputBg: '#2c2c2e',
  placeholder: '#636366',
  sectionHeaderBg: '#000000',
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

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
  bg: '#f9fafb',
  bgSecondary: '#f3f4f6',
  bgTertiary: '#f3f4f6',
  card: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
  textTertiary: '#9ca3af',
  border: '#e5e7eb',
  borderSubtle: '#f3f4f6',
  brand: '#4169E1',
  brandBg: '#eff3ff',
  destructive: '#ef4444',
  destructiveBg: '#fff1f2',
  inputBg: '#f9fafb',
  placeholder: '#9ca3af',
  sectionHeaderBg: '#f3f4f6',
};

const DARK: Colors = {
  bg: '#0f172a',
  bgSecondary: '#111827',
  bgTertiary: '#1f2937',
  card: '#111827',
  text: '#f9fafb',
  textSecondary: '#d1d5db',
  textTertiary: '#9ca3af',
  border: '#374151',
  borderSubtle: '#1f2937',
  brand: '#7aa2ff',
  brandBg: '#1e2f5f',
  destructive: '#ff453a',
  destructiveBg: '#2d1515',
  inputBg: '#1f2937',
  placeholder: '#9ca3af',
  sectionHeaderBg: '#1f2937',
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

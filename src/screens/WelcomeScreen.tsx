import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import LegalConsentText from '../components/LegalConsentText';
import LegalDocumentModal, { type LegalDocumentType } from '../components/LegalDocumentModal';
import { useTheme } from '../context/ThemeContext';

type Props = {
  onGetStarted: () => void;
};

export default function WelcomeScreen({ onGetStarted }: Props) {
  const [activeDocument, setActiveDocument] = useState<LegalDocumentType | null>(null);
  const { colors, isDark } = useTheme();

  const featureCards = [
    { icon: 'calendar-outline' as const, title: 'Plan smarter', copy: 'Build quarter schedules that actually fit your week.' },
    { icon: 'stats-chart-outline' as const, title: 'Track progress', copy: 'See grades, reminders, and quarter momentum in one place.' },
    { icon: 'people-outline' as const, title: 'Stay connected', copy: 'Message friends, compare plans, and keep campus life synced.' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#07111f' : '#f7f8ff' }}>
      <View style={{ ...{ position: 'absolute', top: -40, right: -30, width: 220, height: 220, borderRadius: 110 }, backgroundColor: isDark ? 'rgba(65,105,225,0.22)' : 'rgba(65,105,225,0.18)' }} />
      <View style={{ ...{ position: 'absolute', top: 120, left: -70, width: 180, height: 180, borderRadius: 90 }, backgroundColor: isDark ? 'rgba(255,122,145,0.14)' : 'rgba(255,122,145,0.16)' }} />
      <View style={{ ...{ position: 'absolute', bottom: 180, right: -50, width: 160, height: 160, borderRadius: 80 }, backgroundColor: isDark ? 'rgba(88,208,255,0.14)' : 'rgba(88,208,255,0.16)' }} />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 10, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', marginTop: 18, marginBottom: 26 }}>
          <View style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.75)',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(65,105,225,0.12)',
          }}>
            <Text style={{ color: isDark ? '#dbe7ff' : '#4169E1', fontSize: 12, fontWeight: '700', letterSpacing: 0.4 }}>
              CAMPUS LIFE, REIMAGINED
            </Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: isDark ? '#101826' : '#ffffff',
            borderRadius: 32,
            paddingHorizontal: 22,
            paddingTop: 24,
            paddingBottom: 22,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(65,105,225,0.12)',
            shadowColor: '#0f172a',
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: isDark ? 0.22 : 0.10,
            shadowRadius: 30,
            elevation: 10,
            marginBottom: 24,
            overflow: 'hidden',
          }}
        >
          <View style={{ position: 'absolute', top: -38, right: -32, width: 138, height: 138, borderRadius: 69, backgroundColor: 'rgba(65,105,225,0.14)' }} />
          <View style={{ position: 'absolute', bottom: -42, left: -20, width: 118, height: 118, borderRadius: 59, backgroundColor: 'rgba(255,122,145,0.10)' }} />

          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View style={{ width: 220, height: 180, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <View
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 18,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 16,
                  backgroundColor: isDark ? '#172235' : '#ffffff',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#edf1ff',
                  shadowColor: '#0f172a',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.10,
                  shadowRadius: 16,
                  elevation: 6,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(65,105,225,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="today-outline" size={15} color="#4169E1" />
                  </View>
                  <View>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>Today at a glance</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 11 }}>3 classes, 1 reminder</Text>
                  </View>
                </View>
              </View>

              <View
                style={{
                  width: 118,
                  height: 118,
                  borderRadius: 36,
                  backgroundColor: '#4169E1',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#4169E1',
                  shadowOffset: { width: 0, height: 16 },
                  shadowOpacity: 0.34,
                  shadowRadius: 26,
                  elevation: 12,
                }}
              >
                <Text style={{ fontSize: 40, fontWeight: '900', color: 'white', letterSpacing: 1 }}>CM</Text>
              </View>

              <View
                style={{
                  position: 'absolute',
                  right: 6,
                  bottom: 22,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 16,
                  backgroundColor: isDark ? '#172235' : '#ffffff',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#edf1ff',
                  shadowColor: '#0f172a',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.10,
                  shadowRadius: 16,
                  elevation: 6,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,122,145,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="sparkles-outline" size={15} color="#ff5a79" />
                  </View>
                  <View>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>Quarter in motion</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 11 }}>Stay ahead, not behind</Text>
                  </View>
                </View>
              </View>
            </View>

            <Text style={{ fontSize: 36, fontWeight: '900', color: colors.text, textAlign: 'center', marginBottom: 10 }}>
              Welcome to{'\n'}ClassMate
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 24, color: colors.textSecondary, textAlign: 'center', maxWidth: 310 }}>
              Build your quarter, track your momentum, and keep your entire campus life beautifully in sync.
            </Text>
          </View>

          <View style={{ gap: 12 }}>
            {featureCards.map((feature) => (
              <View
                key={feature.title}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 14,
                  borderRadius: 20,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8faff',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#edf1ff',
                }}
              >
                <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(65,105,225,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Ionicons name={feature.icon} size={20} color="#4169E1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 }}>{feature.title}</Text>
                  <Text style={{ fontSize: 13, lineHeight: 18, color: colors.textTertiary }}>{feature.copy}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={{ marginTop: 'auto' }}>
          <TouchableOpacity
            onPress={onGetStarted}
            activeOpacity={0.9}
            style={{
              backgroundColor: '#4169E1',
              borderRadius: 20,
              paddingVertical: 18,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              shadowColor: '#4169E1',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.30,
              shadowRadius: 18,
              elevation: 8,
            }}
          >
            <Text style={{ color: 'white', fontSize: 17, fontWeight: '700' }}>Get Started</Text>
            <Ionicons name="arrow-forward" size={18} color="white" />
          </TouchableOpacity>

          <Text style={{ color: colors.textTertiary, fontSize: 12, textAlign: 'center', marginTop: 12, marginBottom: 16 }}>
            Sign in with your university email to personalize your experience.
          </Text>

          <LegalConsentText
            onOpenDocument={setActiveDocument}
            fontSize={10.5}
            lineHeight={14}
            color={colors.textTertiary}
            linkColor="#4169E1"
          />
        </View>
      </ScrollView>
      <LegalDocumentModal
        visible={!!activeDocument}
        document={activeDocument ?? 'terms'}
        onClose={() => setActiveDocument(null)}
      />
    </SafeAreaView>
  );
}

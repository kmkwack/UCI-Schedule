import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ClassMateMonogram from '../components/ClassMateMonogram';
import LegalConsentText from '../components/LegalConsentText';
import LegalDocumentModal, { type LegalDocumentType } from '../components/LegalDocumentModal';
import { useTheme } from '../context/ThemeContext';

type Props = {
  onGetStarted: () => void;
};

const FEATURE_ROWS = [
  {
    icon: 'calendar-clear-outline' as const,
    title: 'Build better weeks',
    copy: 'Plan classes and custom blocks without the clutter.',
  },
  {
    icon: 'people-outline' as const,
    title: 'Stay synced with friends',
    copy: 'Compare timetables and keep campus plans easier to coordinate.',
  },
  {
    icon: 'chatbubbles-outline' as const,
    title: 'One place for campus life',
    copy: 'Track updates, conversations, and community activity together.',
  },
];

export default function WelcomeScreen({ onGetStarted }: Props) {
  const [activeDocument, setActiveDocument] = useState<LegalDocumentType | null>(null);
  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#09111d' : '#f4f7ff' }}>
      <View
        style={{
          position: 'absolute',
          top: -50,
          right: -40,
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: 'rgba(65,105,225,0.16)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: -40,
          left: -90,
          width: 170,
          height: 170,
          borderRadius: 85,
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.28)',
        }}
      />

      <View
        style={{
          flex: 1,
          paddingHorizontal: 24,
          paddingTop: 18,
          paddingBottom: 44,
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <View
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.82)',
            }}
          >
            <Text style={{ color: '#4169E1', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
              ORGANIZE CAMPUS LIFE
            </Text>
          </View>
        </View>

        <View
          style={{
            alignItems: 'center',
            paddingHorizontal: 6,
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: 6,
              right: 8,
              width: 132,
              height: 132,
              borderRadius: 66,
              backgroundColor: isDark ? 'rgba(65,105,225,0.12)' : 'rgba(65,105,225,0.10)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 164,
              left: -22,
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,122,145,0.10)',
            }}
          />

          <View style={{ alignItems: 'center', marginBottom: 18 }}>
            <ClassMateMonogram isDark={isDark} />

            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: colors.textTertiary,
                textAlign: 'center',
                marginTop: 18,
                marginBottom: 6,
                letterSpacing: 0.3,
              }}
            >
              Welcome to
            </Text>
            <Text
              style={{
                fontSize: 48,
                lineHeight: 52,
                fontWeight: '800',
                letterSpacing: -2.2,
                textAlign: 'center',
                marginBottom: 12,
              }}
            >
              <Text style={{ color: isDark ? '#edf2ff' : '#16285b' }}>Class</Text>
              <Text style={{ color: '#4169E1' }}>Mate</Text>
            </Text>
            <Text
              style={{
                fontSize: 16,
                lineHeight: 24,
                color: colors.textSecondary,
                textAlign: 'center',
                maxWidth: 310,
              }}
            >
              Keep your schedule, classmates, and campus conversations together in one calm place.
            </Text>
          </View>

          <View
            style={{
              width: '100%',
              gap: 12,
            }}
          >
            {FEATURE_ROWS.map((feature) => (
              <View
                key={feature.title}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 6,
                  paddingVertical: 4,
                }}
              >
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 15,
                    backgroundColor: isDark ? 'rgba(65,105,225,0.16)' : 'rgba(255,255,255,0.62)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 14,
                  }}
                >
                  <Ionicons name={feature.icon} size={20} color="#4169E1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 }}>
                    {feature.title}
                  </Text>
                  <Text style={{ fontSize: 13, lineHeight: 18, color: colors.textTertiary }}>
                    {feature.copy}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={{ marginTop: 26, paddingTop: 6 }}>
          <TouchableOpacity
            onPress={onGetStarted}
            activeOpacity={0.92}
            style={{
              backgroundColor: '#4169E1',
              borderRadius: 20,
              paddingVertical: 18,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              shadowColor: '#4169E1',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.28,
              shadowRadius: 18,
              elevation: 8,
            }}
          >
            <Text style={{ color: 'white', fontSize: 17, fontWeight: '700' }}>Get Started</Text>
            <Ionicons name="arrow-forward" size={18} color="white" />
          </TouchableOpacity>

          <View
            style={{
              paddingTop: 12,
              paddingBottom: 14,
              paddingHorizontal: 8,
            }}
          >
            <LegalConsentText
              onOpenDocument={setActiveDocument}
              fontSize={10.5}
              lineHeight={14}
              color={colors.textTertiary}
              linkColor="#4169E1"
            />
          </View>
        </View>
      </View>

      <LegalDocumentModal
        visible={!!activeDocument}
        document={activeDocument ?? 'terms'}
        onClose={() => setActiveDocument(null)}
      />
    </SafeAreaView>
  );
}

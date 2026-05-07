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

export default function WelcomeScreen({ onGetStarted }: Props) {
  const [activeDocument, setActiveDocument] = useState<LegalDocumentType | null>(null);
  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: 24,
          paddingTop: 14,
          paddingBottom: 26,
          transform: [{ translateY: 16 }],
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(65,105,225,0.08)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(65,105,225,0.16)',
              }}
            >
              <Text style={{ color: colors.brand, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>
                CLASSMATE
              </Text>
            </View>
          </View>

          <View
            style={{
              alignItems: 'center',
              paddingHorizontal: 6,
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <ClassMateMonogram size={132} isDark={isDark} />

              <Text
                style={{
                  fontSize: 46,
                  lineHeight: 50,
                  fontWeight: '800',
                  letterSpacing: 0,
                  textAlign: 'center',
                  marginTop: 18,
                }}
              >
                <Text style={{ color: isDark ? '#edf2ff' : '#16285b' }}>Class</Text>
                <Text style={{ color: colors.brand }}>Mate</Text>
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  lineHeight: 24,
                  color: colors.textSecondary,
                  textAlign: 'center',
                  maxWidth: 306,
                  marginTop: 10,
                }}
              >
                Make your campus life easier.
              </Text>
            </View>

          </View>
        </View>

        <View style={{ marginTop: 18, paddingTop: 6 }}>
          <TouchableOpacity
            onPress={onGetStarted}
            activeOpacity={0.92}
            style={{
              backgroundColor: colors.brand,
              borderRadius: 22,
              paddingVertical: 18,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Text style={{ color: 'white', fontSize: 17, fontWeight: '700' }}>Get Started</Text>
            <Ionicons name="arrow-forward" size={18} color="white" />
          </TouchableOpacity>

          <View
            style={{
              paddingTop: 12,
              paddingBottom: 12,
              paddingHorizontal: 8,
            }}
          >
            <LegalConsentText
              onOpenDocument={setActiveDocument}
              fontSize={9.5}
              lineHeight={13}
              color={colors.textTertiary}
              linkColor={colors.brand}
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

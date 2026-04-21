import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import LegalConsentText from '../components/LegalConsentText';
import LegalDocumentModal, { type LegalDocumentType } from '../components/LegalDocumentModal';

type Props = {
  onGetStarted: () => void;
};

export default function WelcomeScreen({ onGetStarted }: Props) {
  const [activeDocument, setActiveDocument] = useState<LegalDocumentType | null>(null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' }}>

        {/* Logo + title */}
        <View style={{ alignItems: 'center', marginBottom: 56 }}>
          <View style={{
            width: 96, height: 96, borderRadius: 28,
            backgroundColor: '#4169E1', alignItems: 'center', justifyContent: 'center',
            shadowColor: '#4169E1', shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.30, shadowRadius: 16, elevation: 10,
            marginBottom: 32,
          }}>
            <Text style={{ fontSize: 36, fontWeight: 'bold', color: 'white' }}>CM</Text>
          </View>

          <Text style={{ fontSize: 30, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 10 }}>
            Welcome to ClassMate
          </Text>
          <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center' }}>
            Your campus life, beautifully organized
          </Text>
        </View>

        {/* Get Started button */}
        <View style={{ width: '100%' }}>
          <TouchableOpacity
            onPress={onGetStarted}
            style={{
              backgroundColor: '#4169E1', borderRadius: 16,
              paddingVertical: 18, alignItems: 'center',
              flexDirection: 'row', justifyContent: 'center', gap: 8,
              shadowColor: '#4169E1', shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25, shadowRadius: 10, elevation: 6,
            }}
          >
            <Text style={{ color: 'white', fontSize: 17, fontWeight: '600' }}>Get Started</Text>
            <Ionicons name="arrow-forward" size={18} color="white" />
          </TouchableOpacity>

          <View style={{ marginTop: 22 }}>
            <LegalConsentText
              onOpenDocument={setActiveDocument}
              fontSize={10.5}
              lineHeight={14}
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

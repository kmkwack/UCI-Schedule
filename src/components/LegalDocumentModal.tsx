import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type LegalDocumentType = 'terms' | 'privacy' | 'licenses';

type Section = {
  heading: string;
  body: string;
};

type LegalDocument = {
  title: string;
  updatedLabel: string;
  sections: Section[];
};

const DOCUMENTS: Record<LegalDocumentType, LegalDocument> = {
  terms: {
    title: 'Terms of Service',
    updatedLabel: 'Last updated April 21, 2026',
    sections: [
      {
        heading: 'Using ClassMate',
        body:
          'ClassMate is provided to help students explore courses, plan schedules, and manage campus-related information. You agree to use the app lawfully and not misuse community, messaging, or review features.',
      },
      {
        heading: 'Account Responsibility',
        body:
          'You are responsible for activity under your university account. Keep your login secure and make sure any information you share, including reviews and posts, is accurate and respectful.',
      },
      {
        heading: 'Academic Information',
        body:
          'Schedule details, grades, and planning tools inside ClassMate are for convenience only. Official enrollment, grades, and academic standing must always be confirmed through your university systems.',
      },
      {
        heading: 'Acceptable Conduct',
        body:
          'Do not post abusive, fraudulent, infringing, or harmful content. We may remove content or limit access to protect students and the community experience.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    updatedLabel: 'Last updated April 21, 2026',
    sections: [
      {
        heading: 'Information We Store',
        body:
          'ClassMate may store your university email, selected school, timetable data, reviews, friend requests, and preferences needed to provide the app experience.',
      },
      {
        heading: 'How Data Is Used',
        body:
          'Your data is used to power features like timetable sync, social connections, reviews, and personalization. We do not use your timetable or profile data for advertising inside the app.',
      },
      {
        heading: 'Who Can See Your Data',
        body:
          'Visibility depends on your settings and the feature you use. For example, timetable sharing and social features only expose data needed to connect with classmates according to the privacy options you choose.',
      },
      {
        heading: 'Your Choices',
        body:
          'You can request help with account access, privacy questions, or deletion requests through support. Before launch, the support contact configured in settings should be replaced with the real destination used by your team.',
      },
    ],
  },
  licenses: {
    title: 'Open Source Licenses',
    updatedLabel: 'Included software notices',
    sections: [
      {
        heading: 'Third-Party Libraries',
        body:
          'ClassMate is built with open source software including Expo, React Native, Supabase client libraries, react-native-maps, react-native-svg, and other community packages listed in the project dependencies.',
      },
      {
        heading: 'License Notice',
        body:
          'Each dependency remains subject to its own license terms. Before release, you should export or link the full dependency notices used by your shipped app build if you want a complete production-ready licenses page.',
      },
    ],
  },
};

type Props = {
  visible: boolean;
  document: LegalDocumentType;
  onClose: () => void;
  accentColor?: string;
};

export default function LegalDocumentModal({
  visible,
  document,
  onClose,
  accentColor = '#4169E1',
}: Props) {
  const content = DOCUMENTS[document];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: 'white' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#eef0f4',
          }}
        >
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#111827' }}>{content.title}</Text>
            <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{content.updatedLabel}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {content.sections.map((section) => (
            <View
              key={section.heading}
              style={{
                backgroundColor: '#f8fafc',
                borderRadius: 16,
                padding: 18,
                marginBottom: 14,
                borderWidth: 1,
                borderColor: '#e5e7eb',
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 }}>
                {section.heading}
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 22, color: '#4b5563' }}>{section.body}</Text>
            </View>
          ))}

          <View
            style={{
              backgroundColor: `${accentColor}12`,
              borderRadius: 14,
              padding: 16,
              borderWidth: 1,
              borderColor: `${accentColor}22`,
            }}
          >
            <Text style={{ fontSize: 13, lineHeight: 20, color: '#374151' }}>
              These in-app documents are a starter version for development and testing. Before release, replace them
              with your finalized legal text and support contact details.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

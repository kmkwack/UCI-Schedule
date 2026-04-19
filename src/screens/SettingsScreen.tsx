import { View, Text, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const SECTIONS = [
  {
    title: 'ACCOUNT',
    items: [
      { label: 'Edit Profile',        icon: 'person-outline'      as const },
      { label: 'Email Preferences',   icon: 'mail-outline'        as const },
      { label: 'Change Password',     icon: 'lock-closed-outline' as const },
      { label: 'Privacy & Security',  icon: 'shield-outline'      as const },
    ],
  },
  {
    title: 'PREFERENCES',
    items: [
      { label: 'Notifications',    icon: 'notifications-outline' as const },
      { label: 'Appearance',       icon: 'color-palette-outline' as const },
      { label: 'Language & Region', icon: 'globe-outline'        as const },
    ],
  },
  {
    title: 'SUPPORT',
    items: [
      { label: 'Help Center',      icon: 'help-circle-outline'   as const },
      { label: 'About ClassMate',  icon: 'information-circle-outline' as const },
    ],
  },
];

export default function SettingsScreen({ visible, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#f7f8fa' }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
          backgroundColor: 'white',
          borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
        }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827' }}>Settings</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Profile card */}
          <View style={{
            backgroundColor: 'white', marginHorizontal: 0,
            paddingHorizontal: 20, paddingVertical: 20,
            flexDirection: 'row', alignItems: 'center', gap: 16,
            borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
            marginBottom: 24,
          }}>
            <View style={{
              width: 72, height: 72, borderRadius: 36,
              backgroundColor: '#4169E1', alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: 'white' }}>JD</Text>
            </View>
            <View>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>John Doe</Text>
              <Text style={{ fontSize: 14, color: '#6b7280', marginTop: 2 }}>john.doe@university.edu</Text>
              <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>Computer Science · Junior</Text>
            </View>
          </View>

          {/* Settings sections */}
          {SECTIONS.map((section) => (
            <View key={section.title} style={{ marginBottom: 24 }}>
              <Text style={{
                fontSize: 12, fontWeight: '600', color: '#9ca3af',
                letterSpacing: 0.8, paddingHorizontal: 20, marginBottom: 8,
              }}>
                {section.title}
              </Text>

              <View style={{ backgroundColor: 'white', marginHorizontal: 0 }}>
                {section.items.map((item, idx) => (
                  <View key={item.label}>
                    <TouchableOpacity style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingHorizontal: 20, paddingVertical: 16,
                      gap: 14,
                    }}>
                      <Ionicons name={item.icon} size={22} color="#374151" />
                      <Text style={{ flex: 1, fontSize: 16, color: '#111827' }}>{item.label}</Text>
                      <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
                    </TouchableOpacity>
                    {idx < section.items.length - 1 && (
                      <View style={{ height: 1, backgroundColor: '#f3f4f6', marginLeft: 56 }} />
                    )}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

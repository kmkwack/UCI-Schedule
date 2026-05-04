import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import ClassMateMonogram from './ClassMateMonogram';

type Props = {
  visible: boolean;
  title?: string;
  message?: string;
  onDismiss: () => void;
};

export default function ErrorScreen({
  visible,
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onDismiss,
}: Props) {
  const { colors, isDark } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <View style={{
          backgroundColor: colors.card, borderRadius: 28, alignItems: 'center',
          paddingTop: 32, paddingBottom: 28, paddingHorizontal: 28, width: '100%', maxWidth: 360,
          shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 12,
        }}>
          <View style={{ marginBottom: 18 }}>
            <ClassMateMonogram size={94} isDark={isDark} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 10 }}>
            {title}
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 28 }}>
            {message}
          </Text>
          <TouchableOpacity
            onPress={onDismiss}
            style={{
              backgroundColor: '#4169E1', borderRadius: 14, paddingVertical: 14,
              paddingHorizontal: 40, width: '100%', alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: 'white' }}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

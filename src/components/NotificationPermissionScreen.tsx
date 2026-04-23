import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

type Props = {
  onEnable: () => Promise<void> | void;
  onSkip: () => Promise<void> | void;
  saving?: boolean;
};

const BENEFITS = [
  {
    icon: 'notifications-outline' as const,
    title: 'Class reminders that actually help',
    copy: 'Get a heads-up before class, not after you already forgot.',
  },
  {
    icon: 'chatbubble-ellipses-outline' as const,
    title: 'Messages and friend requests',
    copy: 'Know when classmates reach out instead of checking manually.',
  },
  {
    icon: 'calendar-clear-outline' as const,
    title: "Today's classes at 8 AM",
    copy: 'Start the day with a quick summary of what is coming up.',
  },
];

export default function NotificationPermissionScreen({ onEnable, onSkip, saving = false }: Props) {
  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#09111d' : '#f4f7ff' }}>
      <View
        style={{
          position: 'absolute',
          top: -40,
          right: -50,
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: 'rgba(65,105,225,0.14)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 60,
          left: -60,
          width: 160,
          height: 160,
          borderRadius: 80,
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.26)',
        }}
      />

      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 }}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <View
            style={{
              alignSelf: 'center',
              width: 86,
              height: 86,
              borderRadius: 28,
              backgroundColor: '#4169E1',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 28,
              shadowColor: '#4169E1',
              shadowOffset: { width: 0, height: 14 },
              shadowOpacity: 0.26,
              shadowRadius: 18,
              elevation: 9,
            }}
          >
            <Ionicons name="notifications" size={34} color="white" />
          </View>

          <Text style={{ fontSize: 15, fontWeight: '700', color: '#4169E1', textAlign: 'center', marginBottom: 10 }}>
            STAY IN THE LOOP
          </Text>
          <Text style={{ fontSize: 34, lineHeight: 40, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 12 }}>
            Turn on notifications for the good stuff
          </Text>
          <Text style={{ fontSize: 16, lineHeight: 24, color: colors.textSecondary, textAlign: 'center', marginBottom: 28 }}>
            ClassMate can remind you about classes, messages, comments, and friend requests right when they matter.
          </Text>

          <View style={{ gap: 14 }}>
            {BENEFITS.map((benefit) => (
              <View
                key={benefit.title}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.72)',
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: isDark ? 'rgba(65,105,225,0.18)' : '#eef3ff',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 14,
                  }}
                >
                  <Ionicons name={benefit.icon} size={20} color="#4169E1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 3 }}>
                    {benefit.title}
                  </Text>
                  <Text style={{ fontSize: 13, lineHeight: 18, color: colors.textTertiary }}>
                    {benefit.copy}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View>
          <TouchableOpacity
            disabled={saving}
            onPress={() => void onEnable()}
            activeOpacity={0.92}
            style={{
              backgroundColor: '#4169E1',
              borderRadius: 18,
              paddingVertical: 18,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="notifications-outline" size={18} color="white" />}
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>
              {saving ? 'Setting things up...' : 'Enable Notifications'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            disabled={saving}
            onPress={() => void onSkip()}
            style={{ alignItems: 'center', paddingVertical: 16, opacity: saving ? 0.5 : 1 }}
          >
            <Text style={{ color: colors.textTertiary, fontSize: 14, fontWeight: '600' }}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

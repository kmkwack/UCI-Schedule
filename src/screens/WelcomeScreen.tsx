import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  onSignIn: () => void;
  onCreateAccount: () => void;
  onGuest: (id: string) => void;
};

export default function WelcomeScreen({ onSignIn, onCreateAccount, onGuest }: Props) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'space-between', paddingTop: 80, paddingBottom: 40 }}>

        {/* Logo + title */}
        <View style={{ alignItems: 'center' }}>
          {/* App icon */}
          <View style={{ marginBottom: 32, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{
              width: 96, height: 96, borderRadius: 24,
              backgroundColor: '#4f6ef7', alignItems: 'center', justifyContent: 'center',
              shadowColor: '#4f6ef7', shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.35, shadowRadius: 16, elevation: 10,
            }}>
              <Ionicons name="calendar-outline" size={48} color="white" />
            </View>
            {/* Book badge */}
            <View style={{
              position: 'absolute', bottom: -4, right: -4,
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: '#a855f7', alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: 'white',
            }}>
              <Ionicons name="book-outline" size={18} color="white" />
            </View>
          </View>

          <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 12 }}>
            Welcome to UniTrack
          </Text>
          <Text style={{ fontSize: 16, color: '#9ca3af', textAlign: 'center' }}>
            Your campus life, beautifully organized
          </Text>
        </View>

        {/* Buttons */}
        <View style={{ gap: 12 }}>
          {/* Sign In */}
          <TouchableOpacity
            onPress={onSignIn}
            style={{
              backgroundColor: '#4f6ef7', borderRadius: 16,
              paddingVertical: 18, alignItems: 'center',
              flexDirection: 'row', justifyContent: 'center', gap: 8,
            }}
          >
            <Text style={{ color: 'white', fontSize: 17, fontWeight: '600' }}>Sign In</Text>
            <Ionicons name="arrow-forward" size={18} color="white" />
          </TouchableOpacity>

          {/* Create Account */}
          <TouchableOpacity
            onPress={onCreateAccount}
            style={{
              backgroundColor: 'white', borderRadius: 16,
              paddingVertical: 18, alignItems: 'center',
              borderWidth: 1.5, borderColor: '#e5e7eb',
            }}
          >
            <Text style={{ color: '#111827', fontSize: 17, fontWeight: '600' }}>Create Account</Text>
          </TouchableOpacity>

          {/* Guest buttons */}
          <View style={{ marginTop: 8 }}>
            <Text style={{ textAlign: 'center', fontSize: 12, color: '#d1d5db', marginBottom: 10 }}>
              — Continue as guest —
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['guest', 'guest2', 'guest3', 'guest4'].map((g) => (
                <TouchableOpacity
                  key={g}
                  onPress={() => onGuest(g)}
                  style={{
                    flex: 1, paddingVertical: 9, borderRadius: 10,
                    backgroundColor: '#f3f4f6', alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: '600' }}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Terms */}
          <Text style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 8, lineHeight: 18 }}>
            By continuing, you agree to our{' '}
            <Text style={{ color: '#4f6ef7' }}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={{ color: '#4f6ef7' }}>Privacy Policy</Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

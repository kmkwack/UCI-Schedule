import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  onBack: () => void;
  onSignedIn: (userId: string) => void;
  onGoToSignUp: () => void;
};

export default function SignInScreen({ onBack, onSignedIn, onGoToSignUp }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setError('');
    setLoading(true);
    // TODO: replace with real Supabase auth
    setTimeout(() => {
      setLoading(false);
      onSignedIn(email);
    }, 800);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

          {/* Back button */}
          <TouchableOpacity onPress={onBack} style={{ marginBottom: 24 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={28} color="#111827" />
          </TouchableOpacity>

          {/* Title */}
          <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#111827', marginBottom: 8 }}>Sign In</Text>
          <Text style={{ fontSize: 15, color: '#9ca3af', marginBottom: 36 }}>Welcome back! Please enter your details.</Text>

          {/* Email */}
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 8 }}>Email</Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#f9fafb', borderRadius: 14,
            borderWidth: 1.5, borderColor: '#e5e7eb',
            paddingHorizontal: 14, paddingVertical: 14, marginBottom: 20, gap: 10,
          }}>
            <Ionicons name="mail-outline" size={20} color="#9ca3af" />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="student@university.edu"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={{ flex: 1, fontSize: 15, color: '#111827' }}
            />
          </View>

          {/* Password */}
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 8 }}>Password</Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#f9fafb', borderRadius: 14,
            borderWidth: 1.5, borderColor: '#e5e7eb',
            paddingHorizontal: 14, paddingVertical: 14, marginBottom: 16, gap: 10,
          }}>
            <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showPassword}
              style={{ flex: 1, fontSize: 15, color: '#111827' }}
            />
            <TouchableOpacity onPress={() => setShowPassword(p => !p)}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* Remember me + Forgot password */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
            <TouchableOpacity
              onPress={() => setRememberMe(p => !p)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <View style={{
                width: 20, height: 20, borderRadius: 5,
                borderWidth: 1.5, borderColor: rememberMe ? '#4f6ef7' : '#d1d5db',
                backgroundColor: rememberMe ? '#4f6ef7' : 'white',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {rememberMe && <Ionicons name="checkmark" size={13} color="white" />}
              </View>
              <Text style={{ fontSize: 14, color: '#374151' }}>Remember me</Text>
            </TouchableOpacity>
            <TouchableOpacity>
              <Text style={{ fontSize: 14, color: '#4f6ef7', fontWeight: '600' }}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {/* Error */}
          {error !== '' && (
            <Text style={{ color: '#ef4444', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</Text>
          )}

          {/* Sign In button */}
          <TouchableOpacity
            onPress={handleSignIn}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#93a5fb' : '#4f6ef7',
              borderRadius: 16, paddingVertical: 18,
              alignItems: 'center', marginBottom: 20,
            }}
          >
            <Text style={{ color: 'white', fontSize: 17, fontWeight: '600' }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          {/* OR divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
            <Text style={{ fontSize: 13, color: '#9ca3af' }}>OR</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
          </View>

          {/* Continue with Google */}
          <TouchableOpacity style={{
            backgroundColor: 'white', borderRadius: 16,
            paddingVertical: 16, alignItems: 'center',
            borderWidth: 1.5, borderColor: '#e5e7eb',
            flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 28,
          }}>
            {/* Google G */}
            <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#4285F4' }}>G</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Sign up link */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
            <Text style={{ fontSize: 14, color: '#6b7280' }}>Don't have an account?</Text>
            <TouchableOpacity onPress={onGoToSignUp}>
              <Text style={{ fontSize: 14, color: '#4f6ef7', fontWeight: '600' }}>Sign up</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

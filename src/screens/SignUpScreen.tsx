import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  onBack: () => void;
  onSignedUp: (userId: string) => void;
  onGoToSignIn: () => void;
};

export default function SignUpScreen({ onBack, onSignedUp, onGoToSignIn }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignUp = async () => {
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match!");
      return;
    }
    setError('');
    setLoading(true);
    // TODO: replace with real Supabase auth
    setTimeout(() => {
      setLoading(false);
      onSignedUp(email);
    }, 800);
  };

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts: {
      placeholder: string;
      icon: keyof typeof Ionicons.glyphMap;
      secure?: boolean;
      showToggle?: boolean;
      onToggle?: () => void;
      keyboard?: 'default' | 'email-address';
    }
  ) => (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 8 }}>{label}</Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#f9fafb', borderRadius: 14,
        borderWidth: 1.5, borderColor: '#e5e7eb',
        paddingHorizontal: 14, paddingVertical: 14, gap: 10,
      }}>
        <Ionicons name={opts.icon} size={20} color="#9ca3af" />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={opts.placeholder}
          placeholderTextColor="#9ca3af"
          secureTextEntry={opts.secure}
          keyboardType={opts.keyboard ?? 'default'}
          autoCapitalize={opts.keyboard === 'email-address' ? 'none' : 'words'}
          autoCorrect={false}
          style={{ flex: 1, fontSize: 15, color: '#111827' }}
        />
        {opts.showToggle && (
          <TouchableOpacity onPress={opts.onToggle}>
            <Ionicons name={opts.secure ? 'eye-outline' : 'eye-off-outline'} size={20} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back button */}
          <TouchableOpacity onPress={onBack} style={{ marginBottom: 24 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={28} color="#111827" />
          </TouchableOpacity>

          {/* Title */}
          <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#111827', marginBottom: 8 }}>Create Account</Text>
          <Text style={{ fontSize: 15, color: '#9ca3af', marginBottom: 36 }}>
            Join ClassMate and organize your campus life
          </Text>

          {field('Full Name', name, setName, { placeholder: 'John Doe', icon: 'person-outline' })}
          {field('Email', email, setEmail, { placeholder: 'student@university.edu', icon: 'mail-outline', keyboard: 'email-address' })}
          {field('Password', password, setPassword, {
            placeholder: 'Create a password',
            icon: 'lock-closed-outline',
            secure: !showPassword,
            showToggle: true,
            onToggle: () => setShowPassword(p => !p),
          })}
          {field('Confirm Password', confirmPassword, setConfirmPassword, {
            placeholder: 'Confirm your password',
            icon: 'lock-closed-outline',
            secure: !showConfirmPassword,
            showToggle: true,
            onToggle: () => setShowConfirmPassword(p => !p),
          })}

          {error !== '' && (
            <Text style={{ color: '#ef4444', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</Text>
          )}

          {/* Create Account button */}
          <TouchableOpacity
            onPress={handleSignUp}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#879fd8' : '#4169E1',
              borderRadius: 16, paddingVertical: 18,
              alignItems: 'center', marginBottom: 20,
            }}
          >
            <Text style={{ color: 'white', fontSize: 17, fontWeight: '600' }}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          {/* OR divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
            <Text style={{ fontSize: 13, color: '#9ca3af' }}>OR</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
          </View>

          {/* Sign up with Google */}
          <TouchableOpacity style={{
            backgroundColor: 'white', borderRadius: 16,
            paddingVertical: 16, alignItems: 'center',
            borderWidth: 1.5, borderColor: '#e5e7eb',
            flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 28,
          }}>
            <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#4285F4' }}>G</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>Sign up with Google</Text>
          </TouchableOpacity>

          {/* Sign in link */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
            <Text style={{ fontSize: 14, color: '#6b7280' }}>Already have an account?</Text>
            <TouchableOpacity onPress={onGoToSignIn}>
              <Text style={{ fontSize: 14, color: '#4169E1', fontWeight: '600' }}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

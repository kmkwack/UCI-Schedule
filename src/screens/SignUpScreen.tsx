import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DEFAULT_UNIVERSITY, type University } from '../data/schools';
import LegalConsentText from '../components/LegalConsentText';
import LegalDocumentModal, { type LegalDocumentType } from '../components/LegalDocumentModal';
import UniversityLogo from '../components/UniversityLogo';
import { supabase } from '../lib/supabase';

/**
 * Sign-up = school email + password, confirmed by a one-time emailed code.
 *
 * The code is what proves the person actually owns a university mailbox, so it
 * only needs to happen once, at sign-up. Afterwards they sign in with the
 * password and never wait on email again (see SignInScreen). No third-party
 * login service is involved, so App Store Guideline 4.8 doesn't apply.
 */

const MIN_PASSWORD_LENGTH = 8;
// Supabase's "Email OTP Length" is configurable (6–10, default 6), so accept
// the whole range rather than hard-coding one length and breaking if it changes.
const CODE_MIN_LENGTH = 6;
const CODE_MAX_LENGTH = 10;
// Length actually issued by this project — keep in sync with Supabase's
// Authentication → Email OTP Length setting so the placeholder matches.
const CODE_LENGTH_HINT = 8;
const CODE_PLACEHOLDER = '0'.repeat(CODE_LENGTH_HINT);
// Supabase enforces a 60s minimum between sends to the same address.
const RESEND_COOLDOWN_SECONDS = 60;

type Props = {
  university?: University;
  onBack: () => void;
  onSignedUp: (userId: string, email: string, university: University) => void;
  onGoToSignIn: () => void;
};

function emailDomain(email: string) {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf('@');
  return atIndex >= 0 ? normalized.slice(atIndex) : '';
}

export default function SignUpScreen({ university, onBack, onSignedUp, onGoToSignIn }: Props) {
  const uni = university ?? DEFAULT_UNIVERSITY;
  const scrollRef = useRef<ScrollView>(null);
  const [phase, setPhase] = useState<'form' | 'verify'>('form');
  const [activeDocument, setActiveDocument] = useState<LegalDocumentType | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [code, setCode] = useState('');
  const [resendIn, setResendIn] = useState(0);

  const expectedEmailDomain = uni.domain.trim().toLowerCase();
  const bareDomain = expectedEmailDomain.replace(/^@/, '');

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  // Accept departmental subdomains too (e.g. @ics.uci.edu for @uci.edu).
  const matchesSchoolDomain = (value: string) => {
    const domain = emailDomain(value);
    return domain === expectedEmailDomain || domain.endsWith(`.${bareDomain}`);
  };

  const handleCreateAccount = async () => {
    if (loading) return;

    const trimmedEmail = email.trim().toLowerCase();
    if (!matchesSchoolDomain(trimmedEmail)) {
      Alert.alert(
        'School email required',
        `ClassMate is only for ${uni.name} students. Please sign up with your ${uni.domain} email address.`
      );
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      Alert.alert('Password too short', `Please use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please re-enter your password.');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    try {
      await supabase.auth.signOut();

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            classmate_signup_started: true,
            classmate_school: uni.name,
          },
        },
      });

      if (error) {
        if (error.message.toLowerCase().includes('already registered')) {
          Alert.alert('Account already exists', 'This email is already registered. Sign in instead.', [
            { text: 'Sign in', onPress: onGoToSignIn },
            { text: 'Cancel', style: 'cancel' },
          ]);
          return;
        }
        Alert.alert('Sign-up failed', error.message);
        return;
      }

      // Supabase hides "already registered" for confirmed accounts by returning
      // a user with no identities rather than an error.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        Alert.alert('Account already exists', 'This email is already registered. Sign in instead.', [
          { text: 'Sign in', onPress: onGoToSignIn },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return;
      }

      // Email confirmation is on, so there's no session yet — collect the code.
      setEmail(trimmedEmail);
      setCode('');
      setResendIn(RESEND_COOLDOWN_SECONDS);
      setPhase('verify');
    } catch (error: any) {
      Alert.alert('Sign-up failed', error?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (loading) return;
    const trimmedCode = code.trim();
    if (trimmedCode.length < CODE_MIN_LENGTH) {
      Alert.alert('Enter the code', 'Please enter the verification code we emailed you.');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: trimmedCode,
        type: 'signup',
      });

      if (error || !data.user) {
        Alert.alert(
          'Incorrect code',
          error?.message ?? 'That code is not valid. Check the email again or request a new code.'
        );
        return;
      }

      onSignedUp(data.user.id, data.user.email ?? email, uni);
    } catch (error: any) {
      Alert.alert('Verification failed', error?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (loading || resendIn > 0) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) {
        Alert.alert('Could not resend', error.message);
        return;
      }
      setResendIn(RESEND_COOLDOWN_SECONDS);
      Alert.alert('Code sent', `We sent a new code to ${email}.`);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: '#dbe2ea',
    borderRadius: 12,
    backgroundColor: 'white',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#111827',
  } as const;

  // iOS draws native placeholders of secure/password-adjacent fields with the
  // dot-font's wide kerning (and RN can't restyle placeholders on iOS), so
  // password fields render this overlay Text instead of a native placeholder.
  const placeholderOverlayStyle = {
    position: 'absolute' as const,
    left: 15,
    fontSize: 15,
    color: '#9ca3af',
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
          <TouchableOpacity
            onPress={() => (phase === 'verify' ? setPhase('form') : onBack())}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ padding: 4 }}
          >
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 48 }}
        >
          {/* University card */}
          <View style={{
            padding: 20, borderRadius: 20, marginBottom: 28,
            backgroundColor: 'rgba(65,105,225,0.06)',
            borderWidth: 1, borderColor: 'rgba(65,105,225,0.18)',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <UniversityLogo university={uni} width={168} height={48} marginRight={14} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={2} style={{ fontSize: 17, fontWeight: '700', color: '#111827' }}>{uni.name}</Text>
                <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{uni.location}</Text>
              </View>
            </View>
          </View>

          {phase === 'form' ? (
            <View>
              <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
                Join ClassMate
              </Text>
              <Text style={{ fontSize: 15, lineHeight: 22, color: '#6b7280', textAlign: 'center', marginBottom: 24 }}>
                Create your account with your {uni.domain} email. We'll send a verification code to confirm it.
              </Text>

              <View style={{ gap: 12, marginBottom: 20 }}>
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>School email</Text>
                  <View style={{ position: 'relative', justifyContent: 'center' }}>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      style={inputStyle}
                    />
                    {email.length === 0 && (
                      <Text pointerEvents="none" style={placeholderOverlayStyle}>{uni.domain}</Text>
                    )}
                  </View>
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>Password</Text>
                  <View style={{ position: 'relative', justifyContent: 'center' }}>
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry={!showPassword}
                      textContentType="oneTimeCode"
                      style={[inputStyle, { paddingRight: 46 }]}
                    />
                    {password.length === 0 && (
                      <Text pointerEvents="none" style={placeholderOverlayStyle}>{`At least ${MIN_PASSWORD_LENGTH} characters`}</Text>
                    )}
                    <TouchableOpacity
                      onPress={() => setShowPassword((v) => !v)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ position: 'absolute', right: 14 }}
                    >
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color="#9ca3af" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>Confirm password</Text>
                  <View style={{ position: 'relative', justifyContent: 'center' }}>
                    <TextInput
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry={!showConfirmPassword}
                      textContentType="oneTimeCode"
                      style={[inputStyle, { paddingRight: 46 }]}
                    />
                    {confirmPassword.length === 0 && (
                      <Text pointerEvents="none" style={placeholderOverlayStyle}>Re-enter your password</Text>
                    )}
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword((v) => !v)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ position: 'absolute', right: 14 }}
                    >
                      <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color="#9ca3af" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleCreateAccount}
                disabled={loading}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  backgroundColor: '#4169E1', borderRadius: 16, paddingVertical: 16,
                  marginBottom: 24, opacity: loading ? 0.6 : 1,
                }}
              >
                {loading && <ActivityIndicator size="small" color="white" />}
                <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>Create account</Text>
              </TouchableOpacity>

              <View style={{ alignItems: 'center', marginBottom: 28 }}>
                <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 10 }}>Already have an account?</Text>
                <TouchableOpacity
                  onPress={onGoToSignIn}
                  activeOpacity={0.84}
                  style={{
                    borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12,
                    backgroundColor: '#eff3ff', borderWidth: 1, borderColor: 'rgba(65,105,225,0.16)',
                  }}
                >
                  <Text style={{ fontSize: 15, color: '#4169E1', fontWeight: '700' }}>Sign in instead →</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View>
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View style={{
                  width: 64, height: 64, borderRadius: 32, backgroundColor: '#eff3ff',
                  alignItems: 'center', justifyContent: 'center', marginBottom: 16,
                }}>
                  <Ionicons name="mail-open-outline" size={30} color="#4169E1" />
                </View>
                <Text style={{ fontSize: 26, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
                  Verify your school email
                </Text>
                <Text style={{ fontSize: 15, lineHeight: 22, color: '#6b7280', textAlign: 'center' }}>
                  We sent a verification code to{'\n'}
                  <Text style={{ fontWeight: '700', color: '#111827' }}>{email}</Text>
                </Text>
              </View>

              <TextInput
                value={code}
                onChangeText={(value) => setCode(value.replace(/[^0-9]/g, '').slice(0, CODE_MAX_LENGTH))}
                placeholder={CODE_PLACEHOLDER}
                placeholderTextColor="#d1d5db"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={CODE_MAX_LENGTH}
                autoFocus
                style={[inputStyle, {
                  fontSize: 30, fontWeight: '700', textAlign: 'center',
                  letterSpacing: 10, paddingVertical: 16, marginBottom: 20,
                }]}
              />

              <TouchableOpacity
                onPress={handleVerifyCode}
                disabled={loading || code.length < CODE_MIN_LENGTH}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  backgroundColor: '#4169E1', borderRadius: 16, paddingVertical: 16,
                  marginBottom: 16, opacity: loading || code.length < CODE_MIN_LENGTH ? 0.5 : 1,
                }}
              >
                {loading && <ActivityIndicator size="small" color="white" />}
                <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>Verify and continue</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleResendCode}
                disabled={loading || resendIn > 0}
                style={{ paddingVertical: 12, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 14, color: resendIn > 0 ? '#9ca3af' : '#4169E1', fontWeight: '600' }}>
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setPhase('form')} style={{ paddingVertical: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: '#6b7280' }}>Use a different email</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Terms */}
          <View style={{ borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 20, paddingHorizontal: 8 }}>
            <LegalConsentText
              onOpenDocument={setActiveDocument}
              color="#9ca3af"
              linkColor="#4169E1"
              fontSize={11}
              lineHeight={16}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <LegalDocumentModal
        visible={!!activeDocument}
        document={activeDocument ?? 'terms'}
        onClose={() => setActiveDocument(null)}
      />
    </SafeAreaView>
  );
}

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
import { supabase } from '../lib/supabase';
import type { University } from './UniversitySelectionScreen';
import LegalConsentText from '../components/LegalConsentText';
import LegalDocumentModal, { type LegalDocumentType } from '../components/LegalDocumentModal';
import UniversityLogo from '../components/UniversityLogo';

/**
 * Email-verification sign-in.
 *
 * The app is scoped to verified university students, so the login mechanism IS
 * the verification: enter a school email, receive a 6-digit code, enter it.
 * There are no passwords — nothing to forget, reset, or migrate — and because
 * no third-party login service is involved, App Store Guideline 4.8 (which
 * requires an equivalent option like Sign in with Apple alongside Google et al.)
 * doesn't apply.
 *
 * Sign-in and sign-up are the same flow: `shouldCreateUser: true` creates the
 * account on first use, and we tell new users apart afterwards by checking for
 * an existing profile row.
 */

// Apple's reviewers can't receive mail at this address, so Supabase is
// configured with a fixed test OTP for it (Auth → Sign In / Providers → Email).
const REVIEW_ACCOUNT_EMAIL = 'review@classmate.app';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

type Props = {
  university: University;
  onBack: () => void;
  onSignedIn: (userId: string, email: string, university: University) => void;
  onSignedUp: (userId: string, email: string, university: University) => void;
};

function emailDomain(email: string) {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf('@');
  return atIndex >= 0 ? normalized.slice(atIndex) : '';
}

function isReviewAccount(email: string) {
  return email.trim().toLowerCase() === REVIEW_ACCOUNT_EMAIL;
}

export default function SignInScreen({ university, onBack, onSignedIn, onSignedUp }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [phase, setPhase] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [activeDocument, setActiveDocument] = useState<LegalDocumentType | null>(null);
  const [androidKeyboardInset, setAndroidKeyboardInset] = useState(0);

  const expectedEmailDomain = university.domain.trim().toLowerCase();
  const bareDomain = expectedEmailDomain.replace(/^@/, '');

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setAndroidKeyboardInset(Platform.OS === 'android' ? Math.max(event.endCoordinates?.height ?? 0, 0) : 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setAndroidKeyboardInset(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Resend cooldown ticker.
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  // Accept departmental subdomains too (e.g. @ics.uci.edu for @uci.edu).
  const isAllowedEmail = (value: string) => {
    if (isReviewAccount(value)) return true;
    const domain = emailDomain(value);
    return domain === expectedEmailDomain || domain.endsWith(`.${bareDomain}`);
  };

  const sendCode = async (targetEmail: string, { isResend = false } = {}) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: targetEmail,
        options: { shouldCreateUser: true },
      });
      if (error) {
        Alert.alert('Could not send code', error.message);
        return false;
      }
      setResendIn(RESEND_COOLDOWN_SECONDS);
      if (isResend) Alert.alert('Code sent', `We sent a new code to ${targetEmail}.`);
      return true;
    } catch (error: any) {
      Alert.alert('Could not send code', error?.message ?? 'Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async () => {
    if (loading) return;
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      Alert.alert('Enter your email', `Please enter your ${university.domain} email address.`);
      return;
    }
    if (!isAllowedEmail(trimmedEmail)) {
      Alert.alert(
        'School email required',
        `ClassMate is only for ${university.name} students. Please use your ${university.domain} email address.`
      );
      return;
    }

    Keyboard.dismiss();
    // Clear any stale session so a failed verify can't leave the user half-signed-in.
    await supabase.auth.signOut();
    const sent = await sendCode(trimmedEmail);
    if (sent) {
      setEmail(trimmedEmail);
      setCode('');
      setPhase('code');
    }
  };

  /** Seeds the profile/settings rows App Review needs, since that account skips onboarding. */
  const seedReviewAccount = async (userId: string, accountEmail: string) => {
    const [{ error: profileError }, { error: settingsError }] = await Promise.all([
      supabase.from('profiles').upsert({
        id: userId,
        email: accountEmail,
        name: 'App Review',
        major: null,
        year: null,
        school: university.name,
        updated_at: new Date().toISOString(),
      }),
      supabase.from('user_settings').upsert({
        user_id: userId,
        timetable_visibility: 'friends',
        notification_settings: { pushNotifications: false },
        push_permission_status: 'undetermined',
        profile_details: {
          firstName: 'App',
          lastName: 'Review',
          nickname: 'Reviewer',
          profileSetupComplete: true,
          onboardingComplete: true,
          boardProfileVisible: false,
        },
        updated_at: new Date().toISOString(),
      }),
    ]);
    return profileError ?? settingsError ?? null;
  };

  const handleVerifyCode = async () => {
    if (loading) return;
    const trimmedCode = code.trim();
    if (trimmedCode.length !== CODE_LENGTH) {
      Alert.alert('Enter the code', `Please enter the ${CODE_LENGTH}-digit code we emailed you.`);
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: trimmedCode,
        type: 'email',
      });

      if (error || !data.user) {
        Alert.alert(
          'Incorrect code',
          error?.message ?? 'That code is not valid. Check the email again or request a new code.'
        );
        return;
      }

      const userId = data.user.id;
      const signedInEmail = data.user.email ?? email;

      if (isReviewAccount(signedInEmail)) {
        const seedError = await seedReviewAccount(userId, signedInEmail);
        if (seedError) {
          await supabase.auth.signOut();
          Alert.alert('Review setup failed', seedError.message);
          return;
        }
      }

      // Distinguish a brand-new student from a returning one so App.tsx can
      // route them into onboarding rather than straight to the home tabs.
      const [{ data: existingProfile }, { data: existingSettings }] = await Promise.all([
        supabase.from('profiles').select('id').eq('id', userId).eq('school', university.name).maybeSingle(),
        supabase.from('user_settings').select('user_id').eq('user_id', userId).maybeSingle(),
      ]);
      const isNewUser = !existingProfile && !existingSettings;

      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          classmate_signup_started: true,
          classmate_school: university.name,
        },
      });
      if (metadataError) {
        await supabase.auth.signOut();
        Alert.alert('Sign-in failed', metadataError.message);
        return;
      }

      if (isNewUser) onSignedUp(userId, signedInEmail, university);
      else onSignedIn(userId, signedInEmail, university);
    } catch (error: any) {
      Alert.alert('Sign-in failed', error?.message ?? 'Please try again.');
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
          <TouchableOpacity
            onPress={() => (phase === 'code' ? setPhase('email') : onBack())}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ padding: 4 }}
          >
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: 28,
            paddingBottom: Platform.OS === 'ios' ? 96 : androidKeyboardInset > 0 ? androidKeyboardInset + 72 : 72,
          }}
        >
          {/* University card */}
          <View style={{
            padding: 20, borderRadius: 20, marginBottom: 28,
            backgroundColor: 'rgba(65,105,225,0.06)',
            borderWidth: 1, borderColor: 'rgba(65,105,225,0.18)',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <UniversityLogo university={university} width={168} height={48} marginRight={14} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={2} style={{ fontSize: 17, fontWeight: '700', color: '#111827' }}>{university.name}</Text>
                <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{university.location}</Text>
              </View>
            </View>
          </View>

          {phase === 'email' ? (
            <View>
              <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
                Continue with your{'\n'}school email
              </Text>
              <Text style={{ fontSize: 15, lineHeight: 22, color: '#6b7280', textAlign: 'center', marginBottom: 24 }}>
                We'll email you a {CODE_LENGTH}-digit code to verify you're a {university.name} student.
              </Text>

              <View style={{ gap: 6, marginBottom: 20 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>School email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={university.domain}
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="go"
                  onSubmitEditing={handleSendCode}
                  onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120)}
                  style={inputStyle}
                />
              </View>

              <TouchableOpacity
                onPress={handleSendCode}
                disabled={loading}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  backgroundColor: '#4169E1', borderRadius: 16, paddingVertical: 16,
                  marginBottom: 20, opacity: loading ? 0.6 : 1,
                }}
              >
                {loading && <ActivityIndicator size="small" color="white" />}
                <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>Send code</Text>
              </TouchableOpacity>

              <View style={{
                flexDirection: 'row', alignItems: 'flex-start', gap: 10,
                borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb',
                backgroundColor: '#f9fafb', padding: 14,
              }}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#6b7280" style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color: '#4b5563' }}>
                  New here? Entering your {university.domain} email creates your account — no separate sign-up needed.
                </Text>
              </View>
            </View>
          ) : (
            <View>
              <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
                Enter your code
              </Text>
              <Text style={{ fontSize: 15, lineHeight: 22, color: '#6b7280', textAlign: 'center', marginBottom: 24 }}>
                We sent a {CODE_LENGTH}-digit code to{'\n'}
                <Text style={{ fontWeight: '700', color: '#111827' }}>{email}</Text>
              </Text>

              <TextInput
                value={code}
                onChangeText={(value) => setCode(value.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH))}
                placeholder="000000"
                placeholderTextColor="#d1d5db"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={CODE_LENGTH}
                autoFocus
                style={[inputStyle, {
                  fontSize: 30, fontWeight: '700', textAlign: 'center',
                  letterSpacing: 10, paddingVertical: 16, marginBottom: 20,
                }]}
              />

              <TouchableOpacity
                onPress={handleVerifyCode}
                disabled={loading || code.length !== CODE_LENGTH}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  backgroundColor: '#4169E1', borderRadius: 16, paddingVertical: 16,
                  marginBottom: 16, opacity: loading || code.length !== CODE_LENGTH ? 0.5 : 1,
                }}
              >
                {loading && <ActivityIndicator size="small" color="white" />}
                <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>Verify and continue</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { void sendCode(email, { isResend: true }); }}
                disabled={loading || resendIn > 0}
                style={{ paddingVertical: 12, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 14, color: resendIn > 0 ? '#9ca3af' : '#4169E1', fontWeight: '600' }}>
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setPhase('email')} style={{ paddingVertical: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: '#6b7280' }}>Use a different email</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ marginTop: 'auto', paddingTop: 28 }}>
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

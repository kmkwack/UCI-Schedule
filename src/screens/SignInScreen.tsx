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
 * Password sign-in. School ownership was already proven by the emailed code at
 * sign-up (see SignUpScreen), so returning students never wait on email again.
 *
 * "Forgot password?" also uses a one-time code rather than a reset link: the
 * code is verified in-app, which avoids depending on deep links / redirect
 * allow-lists, and then the user picks a new password on the spot.
 */

// App Review can't receive mail at this address, so it signs in with the
// password we supply in the review notes and skips the school-domain rule.
const REVIEW_ACCOUNT_EMAIL = 'review@theseans.app';

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

type Phase = 'password' | 'reset-email' | 'reset-code' | 'reset-password';

type Props = {
  university: University;
  onBack: () => void;
  onSignedIn: (userId: string, email: string, university: University) => void;
  /**
   * Verifying a reset code creates a real session, which the app would
   * otherwise treat as a completed sign-in and navigate away on — before the
   * user has picked a new password. Raised for the duration of that flow.
   */
  onSuspendAutoSignIn: (suspended: boolean) => void;
  onGoToSignUp: () => void;
};

function isReviewAccount(email: string) {
  return email.trim().toLowerCase() === REVIEW_ACCOUNT_EMAIL;
}

export default function SignInScreen({ university, onBack, onSignedIn, onSuspendAutoSignIn, onGoToSignUp }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [phase, setPhase] = useState<Phase>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeDocument, setActiveDocument] = useState<LegalDocumentType | null>(null);
  const [androidKeyboardInset, setAndroidKeyboardInset] = useState(0);

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

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

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

  const finishSignIn = async (userId: string, signedInEmail: string) => {
    // Everything below is convenience work that happens *after* the password has
    // already been accepted. None of it may abort the sign-in: the two failure
    // paths that used to signOut() here have now caused two separate Guideline
    // 2.1(a) rejections — first an RLS policy error, then "JWT issued at future"
    // (clock skew on the review device, which is not something the app controls).
    // A user who authenticated successfully gets into the app; if the seeding or
    // the metadata write fails, the app's normal bootstrap handles the missing
    // rows on its own.
    if (isReviewAccount(signedInEmail)) {
      const seedError = await seedReviewAccount(userId, signedInEmail);
      if (seedError) console.warn('Review account seeding failed (continuing):', seedError.message);
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        classmate_signup_started: true,
        classmate_school: university.name,
      },
    });
    if (metadataError) console.warn('Sign-in metadata write failed (continuing):', metadataError.message);

    onSignedIn(userId, signedInEmail, university);
  };

  const handleSignIn = async () => {
    if (loading) return;
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      Alert.alert('Missing information', 'Enter your email and password.');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    try {
      // Best-effort cleanup of any stale session. signInWithPassword replaces the
      // session anyway, so a failure here must not prevent the sign-in attempt —
      // letting it throw would surface as "could not sign in" without the
      // password ever having been tried.
      await supabase.auth.signOut().catch(() => {});

      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error || !data.user) {
        const message = error?.message ?? 'Could not sign in.';
        if (message.toLowerCase().includes('email not confirmed')) {
          Alert.alert(
            'Email not verified',
            'Finish creating your account first — we emailed you a verification code.',
            [
              { text: 'Create account', onPress: onGoToSignUp },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
          return;
        }
        // Supabase returns the same "invalid login credentials" for a wrong
        // password AND for an account that has none — which is every account
        // made before this update. Point those users at the one-time setup.
        if (message.toLowerCase().includes('invalid login credentials')) {
          Alert.alert(
            'Could not sign in',
            "If you've used ClassMate before, your account doesn't have a password yet — sign-in has changed.\n\n" +
              'Tap "Forgot password?" to set one. You only need to do this once.\n\n' +
              'Otherwise, double-check your email and password.',
            [
              { text: 'Set a password', onPress: () => setPhase('reset-email') },
              { text: 'Try again', style: 'cancel' },
            ]
          );
          return;
        }
        Alert.alert('Sign-in failed', message);
        return;
      }

      await finishSignIn(data.user.id, data.user.email ?? trimmedEmail);
    } catch (error: any) {
      Alert.alert('Sign-in failed', error?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /** Sends a one-time code for the password-reset flow. */
  const sendResetCode = async (targetEmail: string, { isResend = false } = {}) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: targetEmail,
        // Never create an account from the reset flow — that would let a typo
        // silently register a new, unverified user.
        options: { shouldCreateUser: false },
      });
      if (error) {
        Alert.alert('Could not send code', error.message);
        return false;
      }
      setResendIn(RESEND_COOLDOWN_SECONDS);
      if (isResend) Alert.alert('Code sent', `We sent a new code to ${targetEmail}.`);
      return true;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Opens the reset flow on its own email step rather than requiring the user
   * to have already filled the sign-in field — whatever they typed carries over.
   */
  const handleForgotPassword = () => {
    Keyboard.dismiss();
    setPhase('reset-email');
  };

  const handleSendResetCode = async () => {
    if (loading) return;
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      Alert.alert('Enter your email', `Enter the ${university.domain} email you signed up with.`);
      return;
    }
    Keyboard.dismiss();
    const sent = await sendResetCode(trimmedEmail);
    if (sent) {
      setEmail(trimmedEmail);
      setCode('');
      setPhase('reset-code');
    }
  };

  const handleVerifyResetCode = async () => {
    if (loading) return;
    const trimmedCode = code.trim();
    if (trimmedCode.length < CODE_MIN_LENGTH) {
      Alert.alert('Enter the code', 'Please enter the verification code we emailed you.');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    // Raise before verifying: the session appears the moment verifyOtp resolves.
    onSuspendAutoSignIn(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: trimmedCode,
        type: 'email',
      });
      if (error || !data.user) {
        onSuspendAutoSignIn(false);
        Alert.alert(
          'Incorrect code',
          error?.message ?? 'That code is not valid. Check the email again or request a new code.'
        );
        return;
      }
      // Verified — the user now has a session, so they can set a new password.
      // The session must not be treated as a finished sign-in until they do.
      setNewPassword('');
      setConfirmNewPassword('');
      setPhase('reset-password');
    } catch (error: any) {
      onSuspendAutoSignIn(false);
      Alert.alert('Verification failed', error?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNewPassword = async () => {
    if (loading) return;
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      Alert.alert('Password too short', `Please use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert('Passwords do not match', 'Please re-enter your password.');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error || !data.user) {
        Alert.alert('Could not set password', error?.message ?? 'Please try again.');
        return;
      }
      // Password is saved — the session is now a legitimate sign-in.
      onSuspendAutoSignIn(false);
      await finishSignIn(data.user.id, data.user.email ?? email);
    } catch (error: any) {
      Alert.alert('Could not set password', error?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const goBackFromPhase = () => {
    if (phase === 'password') return onBack();
    if (phase === 'reset-email') return setPhase('password');
    if (phase === 'reset-code') {
      onSuspendAutoSignIn(false);
      return setPhase('reset-email');
    }
    // Leaving mid-reset would strand a session whose password wasn't changed.
    void supabase.auth.signOut();
    onSuspendAutoSignIn(false);
    setPhase('password');
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

  const codeInputStyle = [inputStyle, {
    fontSize: 30, fontWeight: '700' as const, textAlign: 'center' as const,
    letterSpacing: 10, paddingVertical: 16, marginBottom: 20,
  }];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
          <TouchableOpacity onPress={goBackFromPhase} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          // Scrolling stays enabled on every phase. It used to be switched off
          // for 'password' on the assumption that phase always fits one screen,
          // but it doesn't on short canvases — notably the iPhone-compatibility
          // window an iPad runs this app in, where the footer became unreachable
          // (App Review, Guideline 4). A ScrollView with content that fits
          // doesn't scroll anyway, so leaving it on costs nothing.
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: phase === 'password' ? 16 : 28,
            paddingBottom: phase === 'password' ? 16
              : Platform.OS === 'ios' ? 96 : androidKeyboardInset > 0 ? androidKeyboardInset + 72 : 72,
          }}
        >
          {/* University card */}
          <View style={{
            padding: 20, borderRadius: 20, marginBottom: phase === 'password' ? 18 : 28,
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

          {phase === 'password' && (
            <View>
              <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
                Sign In to ClassMate
              </Text>
              <Text style={{ fontSize: 15, color: '#6b7280', textAlign: 'center', marginBottom: 16 }}>
                Welcome back! Continue your campus journey
              </Text>

              <View style={{ gap: 12, marginBottom: 8 }}>
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>Email</Text>
                  <View style={{ position: 'relative', justifyContent: 'center' }}>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120)}
                      style={inputStyle}
                    />
                    {email.length === 0 && (
                      <Text pointerEvents="none" style={placeholderOverlayStyle}>{university.domain}</Text>
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
                      textContentType="password"
                      returnKeyType="go"
                      onSubmitEditing={handleSignIn}
                      onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120)}
                      style={[inputStyle, { paddingRight: 46 }]}
                    />
                    {password.length === 0 && (
                      <Text pointerEvents="none" style={placeholderOverlayStyle}>Your password</Text>
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
              </View>

              <TouchableOpacity onPress={handleForgotPassword} disabled={loading} style={{ alignSelf: 'flex-end', paddingVertical: 10 }}>
                <Text style={{ fontSize: 13, color: '#4169E1', fontWeight: '600' }}>Forgot password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSignIn}
                disabled={loading}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  backgroundColor: '#4169E1', borderRadius: 16, paddingVertical: 16,
                  marginTop: 6, marginBottom: 14, opacity: loading ? 0.6 : 1,
                }}
              >
                {loading && <ActivityIndicator size="small" color="white" />}
                <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>Sign in</Text>
              </TouchableOpacity>

              <View style={{
                flexDirection: 'row', alignItems: 'flex-start', gap: 8,
                backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#f3f4f6',
                borderRadius: 12, padding: 12, marginBottom: 14,
              }}>
                <Ionicons name="information-circle-outline" size={17} color="#6b7280" style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: '#6b7280' }}>
                  Used to sign in with Google? Your account now uses a password — tap{' '}
                  <Text style={{ color: '#4169E1', fontWeight: '600' }} onPress={handleForgotPassword}>Forgot password?</Text>
                  {' '}to set one with your school email.
                </Text>
              </View>

              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 6 }}>Don't have an account yet?</Text>
                <TouchableOpacity onPress={onGoToSignUp}>
                  <Text style={{ fontSize: 15, color: '#4169E1', fontWeight: '600' }}>Create a new account →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {phase === 'reset-email' && (
            <View>
              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <View style={{
                  width: 64, height: 64, borderRadius: 32, backgroundColor: '#eff3ff',
                  alignItems: 'center', justifyContent: 'center', marginBottom: 16,
                }}>
                  <Ionicons name="lock-open-outline" size={30} color="#4169E1" />
                </View>
                <Text style={{ fontSize: 26, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
                  Reset your password
                </Text>
                <Text style={{ fontSize: 15, lineHeight: 22, color: '#6b7280', textAlign: 'center' }}>
                  Enter your school email and we'll send you a verification code.
                </Text>
              </View>

              <View style={{ gap: 6, marginBottom: 20 }}>
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
                    returnKeyType="go"
                    onSubmitEditing={handleSendResetCode}
                    autoFocus
                    style={inputStyle}
                  />
                  {email.length === 0 && (
                    <Text pointerEvents="none" style={placeholderOverlayStyle}>{university.domain}</Text>
                  )}
                </View>
              </View>

              <TouchableOpacity
                onPress={handleSendResetCode}
                disabled={loading}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  backgroundColor: '#4169E1', borderRadius: 16, paddingVertical: 16,
                  marginBottom: 16, opacity: loading ? 0.6 : 1,
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
                <Ionicons name="information-circle-outline" size={18} color="#6b7280" style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color: '#4b5563' }}>
                  Used to sign in with Google? Your account now uses a password — enter your school email above to set one.
                </Text>
              </View>
            </View>
          )}

          {phase === 'reset-code' && (
            <View>
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View style={{
                  width: 64, height: 64, borderRadius: 32, backgroundColor: '#eff3ff',
                  alignItems: 'center', justifyContent: 'center', marginBottom: 16,
                }}>
                  <Ionicons name="mail-open-outline" size={30} color="#4169E1" />
                </View>
                <Text style={{ fontSize: 26, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
                  Enter your code
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
                style={codeInputStyle}
              />

              <TouchableOpacity
                onPress={handleVerifyResetCode}
                disabled={loading || code.length < CODE_MIN_LENGTH}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  backgroundColor: '#4169E1', borderRadius: 16, paddingVertical: 16,
                  marginBottom: 16, opacity: loading || code.length < CODE_MIN_LENGTH ? 0.5 : 1,
                }}
              >
                {loading && <ActivityIndicator size="small" color="white" />}
                <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>Verify code</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { void sendResetCode(email, { isResend: true }); }}
                disabled={loading || resendIn > 0}
                style={{ paddingVertical: 12, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 14, color: resendIn > 0 ? '#9ca3af' : '#4169E1', fontWeight: '600' }}>
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'reset-password' && (
            <View>
              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <View style={{
                  width: 64, height: 64, borderRadius: 32, backgroundColor: '#eff3ff',
                  alignItems: 'center', justifyContent: 'center', marginBottom: 16,
                }}>
                  <Ionicons name="key-outline" size={30} color="#4169E1" />
                </View>
                <Text style={{ fontSize: 26, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
                  Set a new password
                </Text>
                <Text style={{ fontSize: 15, lineHeight: 22, color: '#6b7280', textAlign: 'center' }}>
                  Email verified. Choose a new password for{'\n'}
                  <Text style={{ fontWeight: '700', color: '#111827' }}>{email}</Text>
                </Text>
              </View>

              <View style={{ gap: 12, marginBottom: 24 }}>
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>New password</Text>
                  <View style={{ position: 'relative', justifyContent: 'center' }}>
                    <TextInput
                      value={newPassword}
                      onChangeText={setNewPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry={!showPassword}
                      textContentType="oneTimeCode"
                      autoFocus
                      style={[inputStyle, { paddingRight: 46 }]}
                    />
                    {newPassword.length === 0 && (
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
                      value={confirmNewPassword}
                      onChangeText={setConfirmNewPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry={!showConfirmPassword}
                      textContentType="oneTimeCode"
                      style={[inputStyle, { paddingRight: 46 }]}
                    />
                    {confirmNewPassword.length === 0 && (
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
                onPress={handleSaveNewPassword}
                disabled={loading}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  backgroundColor: '#4169E1', borderRadius: 16, paddingVertical: 16,
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading && <ActivityIndicator size="small" color="white" />}
                <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>Save and continue</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ marginTop: 'auto', paddingTop: 16 }}>
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

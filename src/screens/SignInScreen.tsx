import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import type { University } from './UniversitySelectionScreen';
import LegalConsentText from '../components/LegalConsentText';
import LegalDocumentModal, { type LegalDocumentType } from '../components/LegalDocumentModal';

WebBrowser.maybeCompleteAuthSession();

const FALLBACK_AUTH_SCHEME = 'com.parksihyun.classmate';

function getOAuthRedirectUrl() {
  const configuredScheme = Constants.expoConfig?.scheme;
  const scheme =
    (Array.isArray(configuredScheme) ? configuredScheme[0] : configuredScheme) ||
    (Constants.expoConfig?.extra as { expoClient?: { scheme?: string } } | undefined)?.expoClient?.scheme ||
    FALLBACK_AUTH_SCHEME;

  return Linking.createURL('auth/callback', { scheme });
}

type Props = {
  university: University;
  onBack: () => void;
  onSignedIn: (userId: string, email: string, university: University) => void;
  onGoToSignUp: () => void;
};

function GoogleIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </Svg>
  );
}

export default function SignInScreen({ university, onBack, onSignedIn, onGoToSignUp }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [loading, setLoading] = useState(false);
  const [reviewEmail, setReviewEmail] = useState('');
  const [reviewPassword, setReviewPassword] = useState('');
  const [activeDocument, setActiveDocument] = useState<LegalDocumentType | null>(null);
  const hd = university.domain.replace('@', ''); // e.g. "uci.edu"

  const finalizeSignIn = async (
    userId: string,
    email: string,
    options: { requireSchoolDomain: boolean }
  ) => {
    if (options.requireSchoolDomain && !email.endsWith(hd)) {
      await supabase.auth.signOut();
      Alert.alert('Wrong account', `Please sign in with your ${university.domain} email.`);
      return false;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      await supabase.auth.signOut();
      Alert.alert('Sign-in failed', userError?.message ?? 'Could not verify your session.');
      return false;
    }

    const hasSignupMarker = userData.user.user_metadata?.classmate_signup_started === true;
    const [{ data: existingProfile, error: profileError }, { data: existingSettings, error: settingsError }] =
      await Promise.all([
        supabase.from('profiles').select('id').eq('id', userId).maybeSingle(),
        supabase.from('user_settings').select('user_id').eq('user_id', userId).maybeSingle(),
      ]);

    if (
      (profileError && profileError.code !== 'PGRST116' && profileError.code !== 'PGRST205') ||
      (settingsError && settingsError.code !== 'PGRST116' && settingsError.code !== 'PGRST205')
    ) {
      await supabase.auth.signOut();
      Alert.alert('Sign-in failed', 'Could not verify your ClassMate account. Please try again.');
      return;
    }

    if (!existingProfile) {
      await supabase.auth.signOut();
      Alert.alert(
        'No ClassMate account found',
        'It looks like this email has not signed up for ClassMate yet. Please create a new account first.',
        [
          {
            text: 'Create account',
            onPress: onGoToSignUp,
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
      return false;
    }

    if (!hasSignupMarker && !existingSettings) {
      await supabase.auth.signOut();
      Alert.alert(
        'ClassMate setup incomplete',
        'This account does not have a saved ClassMate setup yet. Please create a new account first.',
        [
          {
            text: 'Create account',
            onPress: onGoToSignUp,
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
      return false;
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        classmate_signup_started: true,
        classmate_school: university.name,
      },
    });

    if (metadataError) {
      await supabase.auth.signOut();
      Alert.alert('Sign-in failed', metadataError.message);
      return false;
    }

    onSignedIn(userId, email, university);
    return true;
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    // Always sign out first so there's no auto-login from a persisted session
    await supabase.auth.signOut();

    const redirectTo = getOAuthRedirectUrl();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, queryParams: { hd, prompt: 'select_account' }, skipBrowserRedirect: true },
    });
    if (error || !data.url) {
      setLoading(false);
      Alert.alert('Sign-in failed', error?.message ?? 'Could not start sign-in');
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    setLoading(false);
    if (result.type !== 'success') return;

    const url = result.url;
    const params = new URLSearchParams(url.split('#')[1] ?? url.split('?')[1] ?? '');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (!accessToken) {
      Alert.alert('Sign-in failed', 'No token returned.');
      return;
    }

    const { data: sd, error: se } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken ?? '',
    });
    if (se || !sd.user) {
      Alert.alert('Sign-in failed', se?.message ?? 'Unknown error');
      return;
    }

    await finalizeSignIn(sd.user.id, sd.user.email ?? '', { requireSchoolDomain: true });
  };

  const handleReviewSignIn = async () => {
    if (!reviewEmail.trim() || !reviewPassword) {
      Alert.alert('Missing information', 'Enter the review account email and password first.');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    await supabase.auth.signOut();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: reviewEmail.trim(),
      password: reviewPassword,
    });

    setLoading(false);

    if (error || !data.user) {
      Alert.alert('Sign-in failed', error?.message ?? 'Could not sign in with email and password.');
      return;
    }

    await finalizeSignIn(data.user.id, data.user.email ?? reviewEmail.trim(), { requireSchoolDomain: false });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
        </View>

      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: Platform.OS === 'ios' ? 96 : 72 }}
      >
        {/* University card */}
        <View style={{
          padding: 20, borderRadius: 20, marginBottom: 28,
          backgroundColor: 'rgba(65,105,225,0.06)',
          borderWidth: 1, borderColor: 'rgba(65,105,225,0.18)',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <View style={{
              width: 60, height: 60, borderRadius: 16,
              backgroundColor: '#4169E1', alignItems: 'center', justifyContent: 'center',
              marginRight: 14,
            }}>
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>{university.logo}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827' }}>{university.name}</Text>
              <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{university.location}</Text>
            </View>
          </View>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: 'white', borderRadius: 10,
            paddingHorizontal: 12, paddingVertical: 10,
          }}>
            <Ionicons name="mail-outline" size={16} color="#6b7280" />
            <Text style={{ fontSize: 14, color: '#6b7280' }}>{university.domain}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
          Sign In to ClassMate
        </Text>
        <Text style={{ fontSize: 15, color: '#6b7280', textAlign: 'center', marginBottom: 20 }}>
          Welcome back! Continue your campus journey
        </Text>

        {/* Info pill */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: '#eff3ff', borderRadius: 10,
            paddingHorizontal: 14, paddingVertical: 9,
          }}>
            <Ionicons name="information-circle-outline" size={16} color="#4169E1" />
            <Text style={{ fontSize: 13, color: '#4169E1', fontWeight: '500' }}>
              Use your university Google account
            </Text>
          </View>
        </View>

        {/* Continue with Google */}
        <TouchableOpacity
          onPress={handleGoogleSignIn}
          disabled={loading}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
            backgroundColor: 'white', borderRadius: 16,
            paddingVertical: 16, marginBottom: 24,
            borderWidth: 1.5, borderColor: '#e5e7eb',
            shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? <ActivityIndicator size="small" color="#4169E1" /> : <GoogleIcon />}
          <Text style={{ fontSize: 16, fontWeight: '500', color: '#111827' }}>Continue with Google</Text>
        </TouchableOpacity>

        {/* OR divider */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
          <Text style={{ fontSize: 13, color: '#9ca3af' }}>or</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
        </View>

        <View
          style={{
            marginBottom: 24,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: '#e5e7eb',
            backgroundColor: '#f8fafc',
            padding: 16,
            gap: 12,
          }}
        >
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>Review access</Text>
            <Text style={{ fontSize: 13, lineHeight: 19, color: '#6b7280' }}>
              If your university sign-in uses Duo or another blocked step, use the review account credentials below.
            </Text>
          </View>
          <TextInput
            value={reviewEmail}
            onChangeText={setReviewEmail}
            placeholder="Review account email"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120)}
            style={{
              borderWidth: 1,
              borderColor: '#dbe2ea',
              borderRadius: 12,
              backgroundColor: 'white',
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 15,
              color: '#111827',
            }}
          />
          <TextInput
            value={reviewPassword}
            onChangeText={setReviewPassword}
            placeholder="Review account password"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            secureTextEntry
            onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120)}
            style={{
              borderWidth: 1,
              borderColor: '#dbe2ea',
              borderRadius: 12,
              backgroundColor: 'white',
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 15,
              color: '#111827',
            }}
          />
          <TouchableOpacity
            onPress={handleReviewSignIn}
            disabled={loading}
            style={{
              borderRadius: 14,
              backgroundColor: '#111827',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 14,
              opacity: loading ? 0.6 : 1,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: 'white' }}>Sign in with email</Text>
          </TouchableOpacity>
        </View>

        {/* Create account link */}
        <View style={{ alignItems: 'center', marginBottom: 28 }}>
          <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 6 }}>Don't have an account yet?</Text>
          <TouchableOpacity onPress={onGoToSignUp}>
            <Text style={{ fontSize: 15, color: '#4169E1', fontWeight: '600' }}>Create a new account →</Text>
          </TouchableOpacity>
        </View>

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

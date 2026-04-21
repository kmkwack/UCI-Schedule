import { View, Text, TouchableOpacity, ScrollView, Modal, Switch, TextInput, Alert, Linking, ActivityIndicator, FlatList, KeyboardAvoidingView, Platform } from 'react-native';

const UCI_MAJORS = [
  'Aerospace Engineering',
  'African American Studies',
  'Anthropology',
  'Applied Physics',
  'Applied and Computational Mathematics',
  'Art History',
  'Art',
  'Asian American Studies',
  'Biochemistry and Molecular Biology',
  'Biological Sciences',
  'Biology/Education',
  'Biomedical Engineering',
  'Biomedical Engineering: Premedical',
  'Business Administration',
  'Business Economics',
  'Business Information Management',
  'Chemical Engineering',
  'Chemistry',
  'Chicano/Latino Studies',
  'Chinese Studies',
  'Civil Engineering',
  'Classics',
  'Cognitive Sciences',
  'Comparative Literature',
  'Computer Engineering',
  'Computer Science and Engineering',
  'Computer Science',
  'Criminology, Law and Society',
  'Dance',
  'Data Science',
  'Developmental and Cell Biology',
  'Drama',
  'East Asian Cultures',
  'Ecology and Evolutionary Biology',
  'Economics',
  'Education Sciences',
  'Electrical Engineering',
  'English',
  'Environmental Engineering',
  'Environmental Science and Policy',
  'Environmental and Earth System Science',
  'European Studies',
  'Film and Media Studies',
  'French',
  'Game Design and Interactive Media',
  'Gender and Sexuality Studies',
  'Genetics',
  'German Studies',
  'Global Cultures',
  'History',
  'Human Biology',
  'Informatics',
  'Information and Computer Science',
  'International Studies',
  'Japanese Language and Literature',
  'Korean Literature and Culture',
  'Language Science',
  'Literary Journalism',
  'Materials Science and Engineering',
  'Mathematics',
  'Mechanical Engineering',
  'Microbiology and Immunology',
  'Music Theatre',
  'Music',
  'Neurobiology',
  'Nursing Science',
  'Pharmaceutical Sciences',
  'Philosophy',
  'Physics',
  'Physiology and Exercise Science',
  'Political Science',
  'Psychology',
  'Public Health Policy',
  'Public Health Science',
  'Quantitative Economics',
  'Religious Studies',
  'Social Ecology',
  'Social Policy and Public Service',
  'Sociology',
  'Software Engineering',
  'Spanish',
  'Undergraduate/Undeclared',
  'Urban Studies',
];
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTheme, ThemePreference } from '../context/ThemeContext';
import LegalDocumentModal, { type LegalDocumentType } from '../components/LegalDocumentModal';
import type {
  EditableProfile,
  NotificationPreferences,
  PushPermissionStatus,
  TimetableVisibility,
  UserSettingsState,
} from '../data/userPreferences';

type Props = {
  visible: boolean;
  onClose: () => void;
  onLogout?: () => void;
  userName?: string;
  userEmail?: string;
  userProfile: EditableProfile;
  userSettings: UserSettingsState;
  useCelsius?: boolean;
  onUseCelsiusChange?: (v: boolean) => void;
  themePreference?: ThemePreference;
  onThemeChange?: (v: ThemePreference) => void;
  onSaveProfile: (profile: EditableProfile) => Promise<boolean>;
  onSaveVisibility: (visibility: TimetableVisibility) => Promise<boolean>;
  onSaveNotifications: (notifications: NotificationPreferences, pushPermissionStatus: PushPermissionStatus) => Promise<boolean>;
  onRequestPushPermissions: () => Promise<PushPermissionStatus>;
  savingProfile?: boolean;
  savingVisibility?: boolean;
  savingNotifications?: boolean;
};

type Screen = 'main' | 'profile' | 'privacy' | 'notifications' | 'appearance' | 'language' | 'help' | 'about';

const SUPPORT_EMAIL = 'support@classmate.app';

async function openSupportEmail() {
  const subject = encodeURIComponent('ClassMate Support Request');
  const body = encodeURIComponent('Hi ClassMate team,\n\nI need help with:\n');
  const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

// ─── Sub-screen: Back header ────────────────────────────────────────────────
function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
      borderBottomWidth: 1, borderBottomColor: colors.borderSubtle, backgroundColor: colors.card,
    }}>
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </TouchableOpacity>
      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{title}</Text>
    </View>
  );
}

// ─── Row helper ─────────────────────────────────────────────────────────────
function SettingRow({
  label, subLabel, last = false,
}: { label: string; subLabel?: string; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View>
      <View style={{ paddingHorizontal: 20, paddingVertical: 14 }}>
        <Text style={{ fontSize: 15, color: colors.text }}>{label}</Text>
        {subLabel ? <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{subLabel}</Text> : null}
      </View>
      {!last && <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginLeft: 20 }} />}
    </View>
  );
}

// ─── Sub-screen: Edit Profile ────────────────────────────────────────────────
function DropdownPicker({ label, required, value, options, onSelect, searchable }: {
  label: string; required?: boolean; value: string; options: string[]; onSelect: (v: string) => void; searchable?: boolean;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = searchable && search
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options;
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
        {label}{required && <Text style={{ color: colors.destructive }}> *</Text>}
      </Text>
      <TouchableOpacity
        onPress={() => { setOpen(true); setSearch(''); }}
        style={{
          backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
          paddingHorizontal: 14, paddingVertical: 13,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <Text style={{ fontSize: 14, color: value ? colors.text : colors.placeholder }}>{value || 'Select…'}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32, maxHeight: '75%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{label}</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {searchable && (
              <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder={`Search ${label.toLowerCase()}…`}
                  placeholderTextColor={colors.placeholder}
                  autoFocus
                  style={{
                    backgroundColor: colors.inputBg, borderRadius: 10,
                    paddingHorizontal: 12, paddingVertical: 9,
                    fontSize: 14, color: colors.text,
                  }}
                />
              </View>
            )}
            <FlatList
              data={filtered}
              keyExtractor={item => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: opt }) => (
                <TouchableOpacity
                  onPress={() => { onSelect(opt); setOpen(false); setSearch(''); }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: 20, paddingVertical: 14,
                    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
                  }}
                >
                  <Text style={{ fontSize: 15, color: colors.text, flex: 1 }}>{opt}</Text>
                  {value === opt && <Ionicons name="checkmark" size={18} color={colors.brand} />}
                </TouchableOpacity>
              )}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function EditProfileScreen({
  onBack,
  userEmail,
  initialProfile,
  onSave,
  saving,
}: {
  onBack: () => void;
  userEmail?: string;
  initialProfile: EditableProfile;
  onSave: (profile: EditableProfile) => Promise<boolean>;
  saving?: boolean;
}) {
  const { colors } = useTheme();
  const [form, setForm] = useState<EditableProfile>(initialProfile);

  useEffect(() => {
    setForm(initialProfile);
  }, [initialProfile]);

  const field = (label: string, key: keyof typeof form, disabled = false, placeholder?: string, inputProps?: object) => (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
        {label.replace(' *', '')}{label.endsWith(' *') && <Text style={{ color: colors.destructive }}> *</Text>}
      </Text>
      <View style={{
        backgroundColor: disabled ? colors.bgTertiary : colors.inputBg,
        borderWidth: 1, borderColor: colors.border, borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 12,
      }}>
        <TextInput
          value={form[key]}
          onChangeText={v => setForm(f => ({ ...f, [key]: v }))}
          editable={!disabled}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          style={{ fontSize: 14, color: disabled ? colors.textTertiary : colors.text }}
          {...(inputProps ?? {})}
        />
      </View>
      {disabled && <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 4 }}>Email cannot be changed</Text>}
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.card }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <SubHeader title="Edit Profile" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {field('First Name *', 'firstName')}
        {field('Middle Name', 'middleName', false, 'Optional')}
        {field('Last Name *', 'lastName')}
        {field('Nickname *', 'nickname', false, undefined, { autoCapitalize: 'none' })}
        {field('University Email *', 'email', true)}
        <DropdownPicker
          label="Year" required value={form.year}
          options={['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate']}
          onSelect={v => setForm(f => ({ ...f, year: v }))}
        />
        <DropdownPicker
          label="Major" required value={form.major}
          options={UCI_MAJORS}
          onSelect={v => setForm(f => ({ ...f, major: v }))}
          searchable
        />

        <View style={{ paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.borderSubtle, marginBottom: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textTertiary, marginBottom: 16 }}>Optional Information</Text>
          <DropdownPicker
            label="Gender" value={form.gender}
            options={['Prefer not to say', 'Male', 'Female', 'Other']}
            onSelect={v => setForm(f => ({ ...f, gender: v }))}
          />
          {field('Date of Birth', 'dateOfBirth', false, 'mm/dd/yyyy', { keyboardType: 'number-pad' })}
        </View>
      </ScrollView>
      <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: colors.borderSubtle }}>
        <TouchableOpacity
          disabled={saving}
          onPress={async () => {
            const requiredMissing = !form.firstName.trim() || !form.lastName.trim() || !form.nickname.trim();
            if (requiredMissing) {
              Alert.alert('Missing information', 'Please complete your first name, last name, and nickname before saving.');
              return;
            }
            const saved = await onSave({ ...form, email: userEmail ?? form.email });
            if (saved) onBack();
          }}
          style={{
            backgroundColor: colors.brand,
            borderRadius: 14,
            paddingVertical: 15,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="save-outline" size={18} color="white" />}
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Sub-screen: Privacy & Security ──────────────────────────────────────────
function PrivacySecurityScreen({
  onBack,
  initialVisibility,
  onSave,
  saving,
}: {
  onBack: () => void;
  initialVisibility: TimetableVisibility;
  onSave: (visibility: TimetableVisibility) => Promise<boolean>;
  saving?: boolean;
}) {
  const { colors } = useTheme();
  const [visibility, setVisibility] = useState<TimetableVisibility>(initialVisibility);

  useEffect(() => {
    setVisibility(initialVisibility);
  }, [initialVisibility]);

  const options: { value: 'friends' | 'private'; label: string; desc: string }[] = [
    { value: 'friends', label: 'Friends', desc: 'Only your classmates can see' },
    { value: 'private', label: 'Private', desc: 'Only you can see your timetable' },
  ];

  const handleSelect = (opt: typeof options[0]) => {
    setVisibility(opt.value);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.card }}>
      <SubHeader title="Privacy & Security" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 12 }}>Timetable Visibility</Text>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => handleSelect(opt)}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: colors.bgTertiary, borderRadius: 14, padding: 16, marginBottom: 8,
            }}
          >
            <View>
              <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>{opt.label}</Text>
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{opt.desc}</Text>
            </View>
            <View style={{
              width: 20, height: 20, borderRadius: 10,
              borderWidth: 2, borderColor: visibility === opt.value ? colors.brand : colors.border,
              backgroundColor: visibility === opt.value ? colors.brand : 'transparent',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {visibility === opt.value && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: 'white' }} />}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: colors.borderSubtle }}>
        <TouchableOpacity
          disabled={saving}
          onPress={async () => {
            const saved = await onSave(visibility);
            if (saved) onBack();
          }}
          style={{
            backgroundColor: colors.brand,
            borderRadius: 14,
            paddingVertical: 15,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="shield-checkmark-outline" size={18} color="white" />}
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>
            {saving ? 'Saving...' : 'Save Privacy Settings'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Sub-screen: Notifications ────────────────────────────────────────────────
function NotificationsScreen({
  onBack,
  initialSettings,
  initialPermissionStatus,
  onSave,
  onRequestPushPermissions,
  saving,
}: {
  onBack: () => void;
  initialSettings: NotificationPreferences;
  initialPermissionStatus: PushPermissionStatus;
  onSave: (notifications: NotificationPreferences, pushPermissionStatus: PushPermissionStatus) => Promise<boolean>;
  onRequestPushPermissions: () => Promise<PushPermissionStatus>;
  saving?: boolean;
}) {
  const { colors } = useTheme();
  const [s, setS] = useState<NotificationPreferences>(initialSettings);
  const [permissionStatus, setPermissionStatus] = useState<PushPermissionStatus>(initialPermissionStatus);
  const toggleableKeys: Array<
    'pushNotifications' | 'emailNotifications' | 'classReminders' | 'sportsGameReminders' | 'friendRequests' | 'comments' | 'messages'
  > = ['pushNotifications', 'emailNotifications', 'classReminders', 'sportsGameReminders', 'friendRequests', 'comments', 'messages'];

  useEffect(() => {
    setS(initialSettings);
  }, [initialSettings]);

  useEffect(() => {
    setPermissionStatus(initialPermissionStatus);
  }, [initialPermissionStatus]);

  const toggle = (k: (typeof toggleableKeys)[number]) => setS(prev => ({ ...prev, [k]: !prev[k] }));

  const permissionCopy: Record<PushPermissionStatus, string> = {
    granted: 'Push permission is enabled on this device.',
    denied: 'Push permission is turned off for ClassMate. You can re-enable it in system settings.',
    undetermined: 'Push permission has not been requested yet.',
    unavailable: 'Push permission is unavailable on this device or simulator.',
  };
  const reminderMinuteOptions = [5, 10, 15, 30, 60];

  const row = (key: (typeof toggleableKeys)[number], label: string, subLabel?: string, last = false) => (
    <View key={key}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, color: colors.text }}>{label}</Text>
          {subLabel ? <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{subLabel}</Text> : null}
        </View>
        <Switch
          value={s[key]}
          onValueChange={() => toggle(key)}
          trackColor={{ false: colors.border, true: colors.brand }}
          thumbColor="white"
        />
      </View>
      {!last && <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginLeft: 20 }} />}
    </View>
  );

  const section = (title: string, children: React.ReactNode) => (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textTertiary, letterSpacing: 0.8, marginBottom: 8, paddingHorizontal: 20 }}>
        {title}
      </Text>
      <View style={{ backgroundColor: colors.card }}>{children}</View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgSecondary }}>
      <SubHeader title="Notifications" onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View
          style={{
            marginHorizontal: 20,
            marginBottom: 24,
            padding: 16,
            borderRadius: 14,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 6 }}>
            Device Push Permission
          </Text>
          <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
            {permissionCopy[permissionStatus]}
          </Text>
          {permissionStatus === 'denied' && (
            <TouchableOpacity
              onPress={() => {
                void Linking.openSettings();
              }}
              style={{ marginTop: 10 }}
            >
              <Text style={{ color: colors.brand, fontSize: 13, fontWeight: '700' }}>Open System Settings</Text>
            </TouchableOpacity>
          )}
        </View>
        {section('GENERAL', <>
          {row('pushNotifications', 'Push Notifications', 'Receive notifications on your device')}
          {row('emailNotifications', 'Email Notifications', 'Receive updates via email', true)}
        </>)}
        {section('ACADEMIC', <>
          {row('classReminders', 'Class Reminders')}
          {row('sportsGameReminders', 'Sports Game Reminders', undefined, true)}
        </>)}
        {section('REMINDER TIMING', <>
          <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
            <Text style={{ fontSize: 15, color: colors.text, marginBottom: 10 }}>Class reminder lead time</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {reminderMinuteOptions.map((minutes) => {
                const active = s.classReminderMinutes === minutes;
                return (
                  <TouchableOpacity
                    key={`class-${minutes}`}
                    onPress={() => setS((prev) => ({ ...prev, classReminderMinutes: minutes }))}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: active ? colors.brand : colors.border,
                      backgroundColor: active ? colors.brandBg : colors.card,
                    }}
                  >
                    <Text style={{ color: active ? colors.brand : colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                      {minutes} min
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginLeft: 20, marginTop: 14 }} />
          <View style={{ paddingHorizontal: 20, paddingVertical: 14 }}>
            <Text style={{ fontSize: 15, color: colors.text, marginBottom: 10 }}>Game reminder lead time</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {reminderMinuteOptions.map((minutes) => {
                const active = s.sportsGameReminderMinutes === minutes;
                return (
                  <TouchableOpacity
                    key={`sports-${minutes}`}
                    onPress={() => setS((prev) => ({ ...prev, sportsGameReminderMinutes: minutes }))}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: active ? colors.brand : colors.border,
                      backgroundColor: active ? colors.brandBg : colors.card,
                    }}
                  >
                    <Text style={{ color: active ? colors.brand : colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                      {minutes} min
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </>)}
        {section('SOCIAL', <>
          {row('friendRequests', 'Friend Requests')}
          {row('comments', 'Comments')}
          {row('messages', 'Messages', undefined, true)}
        </>)}
      </ScrollView>
      <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: colors.borderSubtle, backgroundColor: colors.card }}>
        <TouchableOpacity
          disabled={saving}
          onPress={async () => {
            let nextPermissionStatus = permissionStatus;
            let nextNotifications = { ...s };

            if (nextNotifications.pushNotifications) {
              nextPermissionStatus = await onRequestPushPermissions();
              setPermissionStatus(nextPermissionStatus);

              if (nextPermissionStatus !== 'granted') {
                nextNotifications = { ...nextNotifications, pushNotifications: false };
                setS(nextNotifications);
                Alert.alert(
                  'Push permission required',
                  nextPermissionStatus === 'unavailable'
                    ? 'Push notifications are not available on this device or simulator.'
                    : 'Push notifications stay off until ClassMate is allowed to send notifications.'
                );
              }
            }

            const saved = await onSave(nextNotifications, nextPermissionStatus);
            if (saved) onBack();
          }}
          style={{
            backgroundColor: colors.brand,
            borderRadius: 14,
            paddingVertical: 15,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="notifications-outline" size={18} color="white" />}
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>
            {saving ? 'Saving...' : 'Save Notification Settings'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Sub-screen: Appearance ───────────────────────────────────────────────────
function AppearanceScreen({ onBack, useCelsius, onUseCelsiusChange, themePreference, onThemeChange }: {
  onBack: () => void;
  useCelsius?: boolean;
  onUseCelsiusChange?: (v: boolean) => void;
  themePreference?: ThemePreference;
  onThemeChange?: (v: ThemePreference) => void;
}) {
  const { colors } = useTheme();

  const radioGroup = (
    title: string,
    options: { value: string; label: string; desc: string }[],
    selected: string,
    onSelect: (v: string) => void,
  ) => (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textTertiary, letterSpacing: 0.8, marginBottom: 8, paddingHorizontal: 20 }}>
        {title}
      </Text>
      <View style={{ backgroundColor: colors.card }}>
        {options.map((opt, i) => (
          <View key={opt.value}>
            <TouchableOpacity
              onPress={() => onSelect(opt.value)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 }}
            >
              <View>
                <Text style={{ fontSize: 15, color: colors.text }}>{opt.label}</Text>
                <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{opt.desc}</Text>
              </View>
              <View style={{
                width: 20, height: 20, borderRadius: 10,
                borderWidth: 2, borderColor: selected === opt.value ? colors.brand : colors.border,
                backgroundColor: selected === opt.value ? colors.brand : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {selected === opt.value && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: 'white' }} />}
              </View>
            </TouchableOpacity>
            {i < options.length - 1 && <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginLeft: 20 }} />}
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgSecondary }}>
      <SubHeader title="Appearance" onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {radioGroup('THEME', [
          { value: 'light', label: 'Light', desc: 'Always use light theme' },
          { value: 'dark', label: 'Dark', desc: 'Always use dark theme' },
          { value: 'auto', label: 'Auto', desc: 'Match system settings' },
        ], themePreference ?? 'auto', v => onThemeChange?.(v as ThemePreference))}
        {radioGroup('TEMPERATURE UNIT', [
          { value: 'fahrenheit', label: 'Fahrenheit (°F)', desc: 'Example: 72°F' },
          { value: 'celsius', label: 'Celsius (°C)', desc: 'Example: 22°C' },
        ], useCelsius ? 'celsius' : 'fahrenheit', v => onUseCelsiusChange?.(v === 'celsius'))}
      </ScrollView>
    </View>
  );
}

// ─── Sub-screen: Language & Region ───────────────────────────────────────────
function LanguageRegionScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [language, setLanguage] = useState('English');
  const [timezone, setTimezone] = useState('America/Los_Angeles');
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');

  const languages = ['English'];
  const timezones = [
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  ];
  const dateFormats = [
    { value: 'MM/DD/YYYY', example: '04/21/2026' },
    { value: 'DD/MM/YYYY', example: '21/04/2026' },
    { value: 'YYYY-MM-DD', example: '2026-04-21' },
  ];

  const timezoneLabel = timezones.find(tz => tz.value === timezone)?.label ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.card }}>
      <SubHeader title="Language & Region" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Language</Text>
          <DropdownPicker
            label="" value={language}
            options={languages}
            onSelect={setLanguage}
          />
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Time Zone</Text>
          <DropdownPicker
            label="" value={timezoneLabel}
            options={timezones.map(tz => tz.label)}
            onSelect={v => {
              const found = timezones.find(tz => tz.label === v);
              if (found) setTimezone(found.value);
            }}
          />
        </View>

        <View>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Date Format</Text>
          {dateFormats.map(df => (
            <TouchableOpacity
              key={df.value}
              onPress={() => setDateFormat(df.value)}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: colors.inputBg, borderRadius: 12, padding: 16, marginBottom: 8,
              }}
            >
              <View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{df.value}</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>Example: {df.example}</Text>
              </View>
              <View style={{
                width: 22, height: 22, borderRadius: 11,
                backgroundColor: dateFormat === df.value ? colors.brand : colors.textTertiary,
                borderWidth: dateFormat === df.value ? 0 : 0,
                alignItems: 'center', justifyContent: 'center',
              }}>
                {dateFormat === df.value && (
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: 'white' }} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Sub-screen: Help Center ──────────────────────────────────────────────────
function HelpCenterScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showSupportFallback, setShowSupportFallback] = useState(false);

  const categories = [
    { title: 'Getting Started', icon: '📚', faqs: [
      { q: 'How do I create an account?', a: 'Select your university from the list, then sign in with your university Google account. Make sure to use your official university email (e.g., @uci.edu).' },
      { q: 'How do I set up my profile?', a: 'Go to Settings > Edit Profile to add your personal information, including your name, nickname, year, and department. You can also add optional information like gender and date of birth.' },
      { q: 'What features does ClassMate offer?', a: 'ClassMate helps you manage your timetable, track grades, connect with classmates, participate in community discussions, and stay organized throughout your campus life.' },
    ]},
    { title: 'Managing Your Timetable', icon: '📅', faqs: [
      { q: 'How do I add a course to my timetable?', a: "Tap the 'Add' button on the Timetable screen. Use filters to search for courses by department, day, time, or instructor. Select a course to preview it on your timetable, then tap 'Add Course(s)' to confirm." },
      { q: 'Can I have multiple timetable plans?', a: 'Yes! You can create up to 3 different timetable plans (Plan A, B, and C) to compare different course schedules before finalizing your registration.' },
      { q: 'How do I remove a course from my timetable?', a: 'Tap on the course in your timetable, then select the remove or delete option from the course details.' },
    ]},
    { title: 'Tracking Grades', icon: '📊', faqs: [
      { q: '⚠️ Important: Are these my official grades?', a: "NO. The grades in ClassMate are for simulation and tracking purposes only. This is NOT your official transcript. Always check your university's official student portal for your real grades. ClassMate is a grade calculator and organizer, not an official grade system." },
      { q: 'How do I add grades for my courses?', a: 'Go to the Grades tab and select a course. Enter your assignment grades, exam scores, and their weights. ClassMate will automatically calculate your overall grade.' },
      { q: 'Can I track my GPA?', a: 'Yes! ClassMate automatically calculates your semester GPA and cumulative GPA based on the grades you enter for each course.' },
      { q: 'How do I set grade goals?', a: 'In the Grades section, you can set target grades for each course. ClassMate will show you what scores you need on remaining assignments to reach your goal.' },
    ]},
    { title: 'Community Guidelines', icon: '👥', faqs: [
      { q: 'What can I post in the Community?', a: 'Share study tips, campus events, course recommendations, and academic discussions. Keep posts respectful, relevant, and helpful to other students.' },
      { q: 'How do I report inappropriate content?', a: "Tap the three dots on any post or comment and select 'Report'. Our team will review reported content within 24 hours." },
      { q: 'Can I edit or delete my posts?', a: "Yes! Tap the three dots on your post to edit or delete it. Note that edits will show an 'edited' label for transparency." },
    ]},
    { title: 'Account & Privacy', icon: '🔒', faqs: [
      { q: 'Who can see my timetable?', a: 'By default, only your classmates (friends) can see your timetable. You can change this in Settings > Privacy & Security > Timetable Visibility.' },
      { q: 'How do I change my password?', a: "Since ClassMate uses Google authentication, you'll need to update your password through your Google account settings." },
      { q: 'Can I delete my account?', a: 'Yes. Go to Settings and contact support to request account deletion. All your data will be permanently removed within 30 days.' },
    ]},
    { title: 'Troubleshooting', icon: '🔧', faqs: [
      { q: "The app won't load my courses", a: 'Make sure you have a stable internet connection. Try refreshing the page or logging out and back in. If the problem persists, contact support.' },
      { q: "I can't find my university", a: "ClassMate is currently only available for UC Irvine. We're working on adding more universities soon! Check the About section for updates." },
      { q: "Notifications aren't working", a: 'Check Settings > Notifications to ensure the types of notifications you want are enabled. Also verify that your device allows push notifications from ClassMate.' },
    ]},
  ];

  if (selectedCategory) {
    const cat = categories.find(c => c.title === selectedCategory)!;
    return (
      <View style={{ flex: 1, backgroundColor: colors.card }}>
        <SubHeader title={cat.title} onBack={() => setSelectedCategory(null)} />
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {cat.faqs.map((faq, i) => (
            <View key={i} style={{ backgroundColor: colors.inputBg, borderRadius: 16, padding: 20, marginBottom: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 }}>{faq.q}</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 22 }}>{faq.a}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.card }}>
      <SubHeader title="Help Center" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 }}>
          Frequently Asked Questions
        </Text>
        {categories.map((cat, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => setSelectedCategory(cat.title)}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: colors.inputBg, borderRadius: 14, padding: 16, marginBottom: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Text style={{ fontSize: 28 }}>{cat.icon}</Text>
              <Text style={{ fontSize: 15, color: colors.text, fontWeight: '500' }}>{cat.title}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        ))}

        <View style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 }}>
            Need More Help?
          </Text>
          <TouchableOpacity
            onPress={async () => {
              const opened = await openSupportEmail();
              if (!opened) {
                setShowSupportFallback(true);
              }
            }}
            style={{ backgroundColor: colors.brand, borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>Contact Support</Text>
          </TouchableOpacity>
          {showSupportFallback && (
            <View
              style={{
                marginTop: 12,
                backgroundColor: colors.inputBg,
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 }}>
                Mail app unavailable
              </Text>
              <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginBottom: 8 }}>
                If Mail does not open on this device or simulator, contact support directly at:
              </Text>
              <Text selectable style={{ fontSize: 14, color: colors.brand, fontWeight: '700' }}>
                {SUPPORT_EMAIL}
              </Text>
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Sub-screen: About ────────────────────────────────────────────────────────
function AboutScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [activeDocument, setActiveDocument] = useState<LegalDocumentType | null>(null);
  const links: { label: string; document: LegalDocumentType }[] = [
    { label: 'Terms of Service', document: 'terms' },
    { label: 'Privacy Policy', document: 'privacy' },
    { label: 'Open Source Licenses', document: 'licenses' },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: colors.card }}>
      <SubHeader title="About ClassMate" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
          <View style={{ width: 96, height: 96, borderRadius: 28, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: colors.brand, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }}>
            <Text style={{ fontSize: 36, fontWeight: '800', color: 'white' }}>CM</Text>
          </View>
          <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text }}>ClassMate</Text>
          <Text style={{ fontSize: 14, color: colors.textTertiary, marginTop: 4 }}>Version 1.0.0</Text>
          <Text style={{ fontSize: 12, color: colors.border, marginTop: 4 }}>Your Campus Life, Organized</Text>
        </View>

        <View style={{ backgroundColor: colors.bgTertiary, borderRadius: 14, padding: 16, marginBottom: 20, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>Built with ❤️ for students, by students</Text>
        </View>

        {links.map((link, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => setActiveDocument(link.document)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bgTertiary, borderRadius: 14, padding: 16, marginBottom: 8 }}
          >
            <Text style={{ fontSize: 15, color: colors.text }}>{link.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.border} />
          </TouchableOpacity>
        ))}

        <Text style={{ textAlign: 'center', color: colors.border, fontSize: 12, marginTop: 20 }}>© 2026 ClassMate. All rights reserved.</Text>
      </ScrollView>
      <LegalDocumentModal
        visible={!!activeDocument}
        document={activeDocument ?? 'terms'}
        onClose={() => setActiveDocument(null)}
        accentColor={colors.brand}
      />
    </View>
  );
}

// ─── Main Settings screen ─────────────────────────────────────────────────────
export default function SettingsScreen({
  visible,
  onClose,
  onLogout,
  userName = 'John Doe',
  userEmail = 'john.doe@university.edu',
  userProfile,
  userSettings,
  useCelsius,
  onUseCelsiusChange,
  themePreference,
  onThemeChange,
  onSaveProfile,
  onSaveVisibility,
  onSaveNotifications,
  onRequestPushPermissions,
  savingProfile,
  savingVisibility,
  savingNotifications,
}: Props) {
  const { colors } = useTheme();
  const [screen, setScreen] = useState<Screen>('main');

  const initials = userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const handleClose = () => {
    setScreen('main');
    onClose();
  };

  const renderSubScreen = () => {
    switch (screen) {
      case 'profile':
        return (
          <EditProfileScreen
            onBack={() => setScreen('main')}
            userEmail={userEmail}
            initialProfile={userProfile}
            onSave={onSaveProfile}
            saving={savingProfile}
          />
        );
      case 'privacy':
        return (
          <PrivacySecurityScreen
            onBack={() => setScreen('main')}
            initialVisibility={userSettings.timetableVisibility}
            onSave={onSaveVisibility}
            saving={savingVisibility}
          />
        );
      case 'notifications':
        return (
          <NotificationsScreen
            onBack={() => setScreen('main')}
            initialSettings={userSettings.notifications}
            initialPermissionStatus={userSettings.pushPermissionStatus}
            onSave={onSaveNotifications}
            onRequestPushPermissions={onRequestPushPermissions}
            saving={savingNotifications}
          />
        );
      case 'appearance': return <AppearanceScreen onBack={() => setScreen('main')} useCelsius={useCelsius} onUseCelsiusChange={onUseCelsiusChange} themePreference={themePreference} onThemeChange={onThemeChange} />;
      case 'language': return <LanguageRegionScreen onBack={() => setScreen('main')} />;
      case 'help': return <HelpCenterScreen onBack={() => setScreen('main')} />;
      case 'about': return <AboutScreen onBack={() => setScreen('main')} />;
      default: return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      {screen !== 'main' ? (
        renderSubScreen()
      ) : (
        <View style={{ flex: 1, backgroundColor: colors.bgSecondary }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
            backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
          }}>
            <Text style={{ fontSize: 24, fontWeight: '700', color: colors.text }}>Settings</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Profile card */}
            <View style={{
              backgroundColor: colors.card, paddingHorizontal: 20, paddingVertical: 20,
              flexDirection: 'row', alignItems: 'center', gap: 16,
              borderBottomWidth: 1, borderBottomColor: colors.borderSubtle, marginBottom: 24,
            }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 24, fontWeight: '700', color: 'white' }}>{initials}</Text>
              </View>
              <View>
                <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{userName}</Text>
                <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>{userEmail}</Text>
                <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>
                  {userProfile.major} · {userProfile.year}
                </Text>
              </View>
            </View>

            {/* ACCOUNT */}
            <SectionGroup
              title="ACCOUNT"
              items={[
                { label: 'Edit Profile', icon: 'person-outline', onPress: () => setScreen('profile') },
                { label: 'Privacy & Security', icon: 'shield-outline', onPress: () => setScreen('privacy') },
              ]}
            />

            {/* PREFERENCES */}
            <SectionGroup
              title="PREFERENCES"
              items={[
                { label: 'Notifications', icon: 'notifications-outline', onPress: () => setScreen('notifications') },
                { label: 'Appearance', icon: 'color-palette-outline', onPress: () => setScreen('appearance') },
                { label: 'Language & Region', icon: 'globe-outline', onPress: () => setScreen('language') },
              ]}
            />

            {/* SUPPORT */}
            <SectionGroup
              title="SUPPORT"
              items={[
                { label: 'Help Center', icon: 'help-circle-outline', onPress: () => setScreen('help') },
                { label: 'About ClassMate', icon: 'information-circle-outline', onPress: () => setScreen('about') },
              ]}
            />

            {/* Log Out */}
            <View style={{ marginHorizontal: 0, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.borderSubtle }}>
              <TouchableOpacity
                onPress={onLogout}
                style={{ backgroundColor: colors.destructiveBg, borderRadius: 14, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
              >
                <Ionicons name="log-out-outline" size={20} color={colors.destructive} />
                <Text style={{ color: colors.destructive, fontWeight: '700', fontSize: 15 }}>Log Out</Text>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <Text style={{ textAlign: 'center', color: colors.textTertiary, fontSize: 13, marginTop: 16 }}>ClassMate v1.0.0</Text>
          </ScrollView>
        </View>
      )}
    </Modal>
  );
}

// ─── Section group component ─────────────────────────────────────────────────
type SectionItem = { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void };

function SectionGroup({ title, items }: { title: string; items: SectionItem[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textTertiary, letterSpacing: 0.8, paddingHorizontal: 20, marginBottom: 8 }}>
        {title}
      </Text>
      <View style={{ backgroundColor: colors.card }}>
        {items.map((item, idx) => (
          <View key={item.label}>
            <TouchableOpacity
              onPress={item.onPress}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 14 }}
            >
              <Ionicons name={item.icon} size={22} color={colors.textSecondary} />
              <Text style={{ flex: 1, fontSize: 16, color: colors.text }}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.border} />
            </TouchableOpacity>
            {idx < items.length - 1 && <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginLeft: 56 }} />}
          </View>
        ))}
      </View>
    </View>
  );
}

import { View, Text, TouchableOpacity, ScrollView, Modal, Switch, TextInput, Alert, Linking, ActivityIndicator, FlatList, Platform, Animated, PanResponder, Image, StyleSheet, Keyboard, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { useTheme, ThemePreference } from '../context/ThemeContext';
import LegalDocumentModal, { type LegalDocumentType } from '../components/LegalDocumentModal';
import ProfileEditorScreen from '../components/ProfileEditorScreen';
import { supabase } from '../lib/supabase';
import type {
  DateFormatPreference,
  EditableProfile,
  LanguagePreference,
  NotificationPreferences,
  PushPermissionStatus,
  TimetableVisibility,
  UserSettingsState,
} from '../data/userPreferences';
import { abbreviateMajor } from '../data/userPreferences';
import { getSchoolConfig, SUPPORTED_UNIVERSITIES } from '../data/schools';

type Props = {
  visible: boolean;
  onClose: () => void;
  onLogout?: () => void;
  onDeleteAccount?: () => void;
  deletingAccount?: boolean;
  userName?: string;
  userEmail?: string;
  school: string;
  userProfile: EditableProfile;
  userSettings: UserSettingsState;
  themePreference?: ThemePreference;
  onThemeChange?: (v: ThemePreference) => void;
  onSaveProfile: (profile: EditableProfile) => Promise<boolean>;
  onSaveVisibility: (privacy: { timetableVisibility: TimetableVisibility; boardProfileVisible: boolean }) => Promise<boolean>;
  onSaveNotifications: (notifications: NotificationPreferences, pushPermissionStatus: PushPermissionStatus) => Promise<boolean>;
  onSaveRegion: (region: { language: LanguagePreference; timeZone: string; dateFormat: DateFormatPreference }) => Promise<boolean>;
  onRequestPushPermissions: () => Promise<PushPermissionStatus>;
  savingProfile?: boolean;
  savingVisibility?: boolean;
  savingNotifications?: boolean;
  savingRegion?: boolean;
};

type Screen = 'main' | 'profile' | 'privacy' | 'notifications' | 'appearance' | 'language' | 'help' | 'about' | 'moderation' | 'board_requests';

const SUPPORT_EMAILS = ['heyy.seans@gmail.com', 'hii.seans@gmail.com'];
const SUPPORT_EMAIL_LABEL = SUPPORT_EMAILS.join(', ');
const MODERATOR_EMAILS = ['sihyup2@uci.edu', 'kwackk@uci.edu'];

function formatNotificationHour(hour: number) {
  const normalized = Number.isFinite(hour) ? Math.max(0, Math.min(23, Math.floor(hour))) : 8;
  const suffix = normalized >= 12 ? 'PM' : 'AM';
  const hour12 = normalized % 12 || 12;
  return `${hour12}:00 ${suffix}`;
}

const LEGACY_ASSIGNMENT_REMINDER_OPTION_MINUTES = [2880, 1440, 720];

const ASSIGNMENT_REMINDER_OPTIONS = [
  { minutes: 2880, label: '2 days before' },
  { minutes: 1440, label: '1 day before' },
  { minutes: 720, label: '12 hours before' },
  { minutes: 60, label: '1 hour before' },
];

function normalizeAssignmentReminderOffsets(offsets?: number[]) {
  const allowed = new Set(ASSIGNMENT_REMINDER_OPTIONS.map((option) => option.minutes));
  const selected = (Array.isArray(offsets) ? offsets : [])
    .filter((minutes) => allowed.has(minutes))
    .filter((minutes, index, values) => values.indexOf(minutes) === index);
  const isLegacyDefault = selected.length === LEGACY_ASSIGNMENT_REMINDER_OPTION_MINUTES.length
    && LEGACY_ASSIGNMENT_REMINDER_OPTION_MINUTES.every((minutes) => selected.includes(minutes));
  if (isLegacyDefault) return ASSIGNMENT_REMINDER_OPTIONS.map((option) => option.minutes);
  return selected.length > 0 ? selected : ASSIGNMENT_REMINDER_OPTIONS.map((option) => option.minutes);
}

type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';

type ModerationReport = {
  id: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  targetType: 'post' | 'comment';
  targetId: string;
  targetLabel: string;
  targetPreview: string;
  reason: string;
  details: string;
  status: ReportStatus;
  createdAt: string;
};

function formatModerationDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

async function openSupportEmail() {
  const subject = encodeURIComponent('ClassMate Support Request');
  const body = encodeURIComponent('Hi ClassMate team,\n\nI need help with:\n');
  const url = `mailto:${SUPPORT_EMAILS.join(',')}?subject=${subject}&body=${body}`;

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
  const insets = useSafeAreaInsets();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 20, paddingTop: Math.max(20, insets.top + 8), paddingBottom: 16,
      borderBottomWidth: 1, borderBottomColor: colors.borderSubtle, backgroundColor: colors.card,
    }}>
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </TouchableOpacity>
      <Text numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, minWidth: 0, fontSize: 22, fontWeight: '700', color: colors.text }}>{title}</Text>
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

function DropdownPicker({ label, required, value, options, onSelect, searchable }: {
  label: string; required?: boolean; value: string; options: string[]; onSelect: (v: string) => void; searchable?: boolean;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(500)).current;

  const filtered = searchable && search
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const openPicker = () => {
    setOpen(true);
    setSearch('');
    sheetAnim.setValue(500);
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 18 }),
    ]).start();
  };

  const closePicker = () => {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(sheetAnim, { toValue: 500, duration: 220, useNativeDriver: true }),
    ]).start(() => setOpen(false));
  };

  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
        {label}{required && <Text style={{ color: colors.destructive }}> *</Text>}
      </Text>
      <TouchableOpacity
        onPress={openPicker}
        style={{
          backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
          paddingHorizontal: 14, paddingVertical: 13,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <Text style={{ fontSize: 14, color: value ? colors.text : colors.placeholder }}>{value || 'Select…'}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="none" onRequestClose={closePicker}>
        {/* Backdrop fades in/out independently of the sheet */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropAnim }]}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={closePicker} />
        </Animated.View>

        {/* Sheet slides up/down */}
        <Animated.View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: colors.card,
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          paddingBottom: 32, maxHeight: '75%',
          transform: [{ translateY: sheetAnim }],
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{label}</Text>
            <TouchableOpacity onPress={closePicker}>
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
                onPress={() => { onSelect(opt); closePicker(); }}
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
        </Animated.View>
      </Modal>
    </View>
  );
}

// ─── Sub-screen: Privacy & Security ──────────────────────────────────────────
function PrivacySecurityScreen({
  onBack,
  initialVisibility,
  initialBoardProfileVisible,
  school,
  onSave,
  saving,
}: {
  onBack: () => void;
  initialVisibility: TimetableVisibility;
  initialBoardProfileVisible: boolean;
  school: string;
  onSave: (privacy: { timetableVisibility: TimetableVisibility; boardProfileVisible: boolean }) => Promise<boolean>;
  saving?: boolean;
}) {
  const { colors } = useTheme();
  const aliasName = getSchoolConfig(school).welcomeName || 'Classmate';
  const [visibility, setVisibility] = useState<TimetableVisibility>(initialVisibility);
  const [boardProfileVisible, setBoardProfileVisible] = useState(initialBoardProfileVisible);

  useEffect(() => {
    setVisibility(initialVisibility);
  }, [initialVisibility]);

  useEffect(() => {
    setBoardProfileVisible(initialBoardProfileVisible);
  }, [initialBoardProfileVisible]);

  const options: { value: 'friends' | 'private'; label: string; desc: string }[] = [
    { value: 'friends', label: 'Friends', desc: 'Only accepted friends can see your saved timetable' },
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

        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 20, marginBottom: 12 }}>Board Identity</Text>
        <View
          style={{
            backgroundColor: colors.bgTertiary,
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>Real-name board preference</Text>
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
              Normal board posts stay verified-anonymous as {aliasName} plus verified major/year. This only applies if a non-anonymous board mode is added later.
            </Text>
          </View>
          <Switch
            value={boardProfileVisible}
            onValueChange={setBoardProfileVisible}
            trackColor={{ false: colors.border, true: colors.brand }}
            thumbColor="white"
          />
        </View>
      </ScrollView>
      <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: colors.borderSubtle }}>
        <TouchableOpacity
          disabled={saving}
          onPress={async () => {
            Keyboard.dismiss();
            const saved = await onSave({
              timetableVisibility: visibility,
              boardProfileVisible,
            });
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
    'pushNotifications' | 'dailyScheduleSummary' | 'classReminders' | 'assignmentReminders' | 'sportsGameReminders' | 'friendRequests' | 'comments' | 'likes'
  > = ['pushNotifications', 'dailyScheduleSummary', 'classReminders', 'assignmentReminders', 'sportsGameReminders', 'friendRequests', 'comments', 'likes'];

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
  const appNotificationStatus = s.pushNotifications ? 'On' : 'Off';
  const reminderMinuteOptions = [5, 10, 15, 30, 60];
  const dailySummaryHourOptions = [6, 7, 8, 9, 10, 11];
  const selectedAssignmentReminderOffsets = normalizeAssignmentReminderOffsets(s.assignmentReminderOffsets);
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
          <View style={{ marginTop: 10, gap: 4 }}>
            <Text style={{ fontSize: 12, color: colors.textTertiary }}>
              Permission: <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                {permissionStatus === 'granted'
                  ? 'Allowed'
                  : permissionStatus === 'denied'
                    ? 'Blocked'
                    : permissionStatus === 'unavailable'
                      ? 'Unavailable'
                      : 'Not requested'}
              </Text>
            </Text>
            <Text style={{ fontSize: 12, color: colors.textTertiary }}>
              App notifications: <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{appNotificationStatus}</Text>
            </Text>
          </View>
          <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textTertiary, marginTop: 8 }}>
            When enabled, ClassMate can deliver social alerts on your device and schedule reminder notifications ahead of time.
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
          {row('pushNotifications', 'Push Notifications', 'Receive notifications on your device', true)}
        </>)}
        {section('ACADEMIC', <>
          {row('dailyScheduleSummary', "Today's Classes", `Send a morning summary at ${formatNotificationHour(s.dailyScheduleSummaryHour)}`)}
          {row('classReminders', 'Class Reminders')}
          {row('assignmentReminders', 'Assignment Reminders', 'Notify before LMS calendar deadlines')}
          {row('sportsGameReminders', 'Sports Game Reminders', undefined, true)}
        </>)}
        {section('TODAY SUMMARY TIME', <>
          <View style={{ paddingHorizontal: 20, paddingVertical: 14, opacity: s.dailyScheduleSummary ? 1 : 0.45 }}>
            <Text style={{ fontSize: 15, color: colors.text, marginBottom: 4 }}>Morning summary time</Text>
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 10 }}>
              Choose when ClassMate sends your daily class list.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {dailySummaryHourOptions.map((hour) => {
                const active = s.dailyScheduleSummaryHour === hour;
                return (
                  <TouchableOpacity
                    key={`daily-summary-${hour}`}
                    disabled={!s.dailyScheduleSummary}
                    onPress={() => setS((prev) => ({ ...prev, dailyScheduleSummaryHour: hour }))}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: active ? colors.brand : colors.border,
                      backgroundColor: active ? colors.brandBg : colors.card,
                    }}
                  >
                    <Text style={{ color: active ? colors.brand : colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                      {formatNotificationHour(hour)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
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
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: active ? colors.brand : colors.border,
                      backgroundColor: active ? colors.brandBg : colors.card,
                    }}
                  >
                    <Text style={{ color: active ? colors.brand : colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                      {minutes} min
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginLeft: 20, marginTop: 14 }} />
          <View style={{ paddingHorizontal: 20, paddingVertical: 14, opacity: s.assignmentReminders ? 1 : 0.45 }}>
            <Text style={{ fontSize: 15, color: colors.text, marginBottom: 4 }}>Assignment reminder timing</Text>
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 10 }}>
              Choose one or more alerts before each deadline.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {ASSIGNMENT_REMINDER_OPTIONS.map((option) => {
                const active = selectedAssignmentReminderOffsets.includes(option.minutes);
                return (
                  <TouchableOpacity
                    key={`assignment-${option.minutes}`}
                    disabled={!s.assignmentReminders}
                    onPress={() => {
                      setS((prev) => {
                        const current = normalizeAssignmentReminderOffsets(prev.assignmentReminderOffsets);
                        const nextOffsets = active && current.length > 1
                          ? current.filter((minutes) => minutes !== option.minutes)
                          : active
                            ? current
                            : [...current, option.minutes];
                        return { ...prev, assignmentReminderOffsets: nextOffsets };
                      });
                    }}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: active ? colors.brand : colors.border,
                      backgroundColor: active ? colors.brandBg : colors.card,
                    }}
                  >
                    <Text style={{ color: active ? colors.brand : colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginLeft: 20 }} />
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
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: active ? colors.brand : colors.border,
                      backgroundColor: active ? colors.brandBg : colors.card,
                    }}
                  >
                    <Text style={{ color: active ? colors.brand : colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
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
          {row('likes', 'Likes', undefined, true)}
        </>)}
      </ScrollView>
      <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: colors.borderSubtle, backgroundColor: colors.card }}>
        <TouchableOpacity
          disabled={saving}
          onPress={async () => {
            let nextPermissionStatus = permissionStatus;
            let nextNotifications = {
              ...s,
              assignmentReminderOffsets: normalizeAssignmentReminderOffsets(s.assignmentReminderOffsets),
            };

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

            Keyboard.dismiss();
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
function AppearanceScreen({ onBack, themePreference, onThemeChange }: {
  onBack: () => void;
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
      </ScrollView>
    </View>
  );
}

// ─── Sub-screen: Language & Region ───────────────────────────────────────────
function LanguageRegionScreen({
  onBack,
  school,
  initialLanguage,
  initialTimeZone,
  initialDateFormat,
  onSave,
  saving,
}: {
  onBack: () => void;
  school: string;
  initialLanguage: LanguagePreference;
  initialTimeZone: string;
  initialDateFormat: DateFormatPreference;
  onSave: (region: { language: LanguagePreference; timeZone: string; dateFormat: DateFormatPreference }) => Promise<boolean>;
  saving?: boolean;
}) {
  const { colors } = useTheme();
  const [language, setLanguage] = useState<LanguagePreference>(initialLanguage);
  const [timezone, setTimezone] = useState(initialTimeZone);
  const [dateFormat, setDateFormat] = useState<DateFormatPreference>(initialDateFormat);

  useEffect(() => {
    setLanguage(initialLanguage);
  }, [initialLanguage]);

  useEffect(() => {
    setTimezone(initialTimeZone);
  }, [initialTimeZone]);

  useEffect(() => {
    setDateFormat(initialDateFormat);
  }, [initialDateFormat]);

  const languages: Array<{ value: LanguagePreference; label: string }> = [
    { value: 'en', label: 'English' },
  ];
  const schoolConfig = getSchoolConfig(school);
  const schoolTimeZone = schoolConfig.timeZone && schoolConfig.timeZone !== 'auto'
    ? schoolConfig.timeZone
    : Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'America/Los_Angeles';
  const timezones = Array.from(
    new Map([
      [schoolTimeZone, { value: schoolTimeZone, label: `${schoolConfig.shortName} time (${schoolTimeZone})` }],
      ['America/Los_Angeles', { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' }],
      ['America/Denver', { value: 'America/Denver', label: 'Mountain Time (MT)' }],
      ['America/Chicago', { value: 'America/Chicago', label: 'Central Time (CT)' }],
      ['America/New_York', { value: 'America/New_York', label: 'Eastern Time (ET)' }],
      ['America/Indiana/Indianapolis', { value: 'America/Indiana/Indianapolis', label: 'Indiana Time (ET)' }],
      ...SUPPORTED_UNIVERSITIES.map((university) => {
        const config = getSchoolConfig(university.name);
        return [config.timeZone, { value: config.timeZone, label: `${config.shortName} time (${config.timeZone})` }] as const;
      }).filter(([value]) => value && value !== 'auto'),
    ]).values()
  );
  const dateFormats: Array<{ value: DateFormatPreference; example: string }> = [
    { value: 'MM/DD/YYYY', example: '04/21/2026' },
    { value: 'DD/MM/YYYY', example: '21/04/2026' },
    { value: 'YYYY-MM-DD', example: '2026-04-21' },
  ];

  const languageLabel = languages.find(lang => lang.value === language)?.label ?? languages[0].label;
  const timezoneLabel = timezones.find(tz => tz.value === timezone)?.label ?? timezone;

  return (
    <View style={{ flex: 1, backgroundColor: colors.card }}>
      <SubHeader title="Language & Region" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Language</Text>
          <DropdownPicker
            label="App Language"
            value={languageLabel}
            options={languages.map(lang => lang.label)}
            onSelect={v => {
              const found = languages.find(lang => lang.label === v);
              if (found) setLanguage(found.value);
            }}
          />
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Time Zone</Text>
          <DropdownPicker
            label="Time Zone"
            value={timezoneLabel}
            options={timezones.map(tz => tz.label)}
            searchable
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
      <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: colors.borderSubtle }}>
        <TouchableOpacity
          disabled={saving}
          onPress={async () => {
            const ok = await onSave({ language, timeZone: timezone, dateFormat });
            if (ok) onBack();
          }}
          style={{
            backgroundColor: saving ? colors.bgTertiary : colors.brand,
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: saving ? colors.textTertiary : 'white', fontSize: 15, fontWeight: '700' }}>
            {saving ? 'Saving...' : 'Save Language & Region'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Sub-screen: Help Center ──────────────────────────────────────────────────
function HelpCenterScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showSupportFallback, setShowSupportFallback] = useState(false);
  const supportedUniversityCount = SUPPORTED_UNIVERSITIES.length;

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
      { q: 'Can I track my GPA?', a: 'Yes! ClassMate automatically calculates your term GPA and cumulative GPA based on the grades you enter for each course.' },
      { q: 'How do I set grade goals?', a: 'In the Grades section, you can set target grades for each course. ClassMate will show you what scores you need on remaining assignments to reach your goal.' },
    ]},
    { title: 'Community Guidelines', icon: '👥', faqs: [
      { q: 'What can I post in the Community?', a: 'Share study tips, campus events, course recommendations, and academic discussions. Keep posts respectful, relevant, and helpful to other students.' },
      { q: 'How do I report inappropriate content?', a: "Tap the three dots on any post or comment and select 'Report'. Our team will review reported content within 24 hours." },
      { q: 'Can I edit or delete my posts?', a: "Yes! Tap the three dots on your post to edit or delete it. Note that edits will show an 'edited' label for transparency." },
    ]},
    { title: 'Account & Privacy', icon: '🔒', faqs: [
      { q: 'Who can see my timetable?', a: 'Only accepted friends can see your saved timetable, and only when timetable visibility is set to Friends. Shared classes are calculated from courses each friend saved in ClassMate, not from official school rosters. You can turn sharing off in Settings > Privacy & Security > Timetable Visibility.' },
      { q: 'Does ClassMate pull Canvas rosters or official grades?', a: 'No. ClassMate does not pull Canvas rosters, official enrollment records, official grades, student IDs, or registrar records. LMS calendar import is for assignment deadlines only, and grades are manually entered by you for personal tracking.' },
      { q: 'How do I change my password?', a: "Since ClassMate uses Google authentication, you'll need to update your password through your Google account settings." },
      { q: 'Can I delete my account?', a: 'Yes. Use Delete Account in Settings to initiate account deletion. This removes your profile, friends, timetables, manually entered grades, messages, board content, reviews, and uploaded files that ClassMate is not required to keep.' },
    ]},
    { title: 'Troubleshooting', icon: '🔧', faqs: [
      { q: "The app won't load my courses", a: 'Make sure you have a stable internet connection. Try refreshing the page or logging out and back in. If the problem persists, contact support.' },
      { q: "I can't find my university", a: `ClassMate currently lists ${supportedUniversityCount} supported universities. Search by school name, city/state, or email domain. If your school is not listed yet, contact support.` },
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
                {SUPPORT_EMAIL_LABEL}
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
          <Image
            source={require('../../assets/classmate-logo-approved.png')}
            style={{ width: 118, height: 118, marginBottom: 16 }}
            resizeMode="contain"
          />
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

function ModerationScreen({ school, onBack }: { school: string; onBack: () => void }) {
  const { colors } = useTheme();
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | ReportStatus>('pending');

  useEffect(() => {
    void fetchReports();
  }, []);

  async function fetchReports() {
    setLoading(true);
    const { data: reportRows, error } = await supabase
      .from('reports')
      .select('*')
      .eq('school', school)
      .order('created_at', { ascending: false });

    if (error) {
      setLoading(false);
      Alert.alert('Could not load reports', error.code === 'PGRST205' ? 'The reports table is missing in Supabase.' : error.message);
      return;
    }

    const rows = (reportRows ?? []) as Array<{
      id: string;
      reporter_id: string;
      target_type: 'post' | 'comment';
      target_id: string;
      reason: string;
      details: string | null;
      status: ReportStatus;
      created_at: string;
    }>;

    const reporterIds = Array.from(new Set(rows.map((r) => r.reporter_id).filter(Boolean)));
    const postIds = Array.from(new Set(rows.filter((r) => r.target_type === 'post').map((r) => r.target_id)));
    const commentIds = Array.from(new Set(rows.filter((r) => r.target_type === 'comment').map((r) => r.target_id)));

    const [{ data: profiles }, { data: posts }, { data: comments }] = await Promise.all([
      reporterIds.length
        ? supabase.from('profiles').select('id, name, email').eq('school', school).in('id', reporterIds)
        : Promise.resolve({ data: [] as any[] }),
      postIds.length
        ? supabase.from('posts').select('id, title, body').eq('school', school).in('id', postIds)
        : Promise.resolve({ data: [] as any[] }),
      commentIds.length
        ? supabase.from('post_comments').select('id, content').eq('school', school).in('id', commentIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const profileById = Object.fromEntries(
      ((profiles ?? []) as Array<{ id: string; name: string | null; email: string | null }>).map((r) => [r.id, r])
    );
    const postsById = Object.fromEntries(
      ((posts ?? []) as Array<{ id: string; title: string | null; body: string | null }>).map((r) => [r.id, r])
    );
    const commentsById = Object.fromEntries(
      ((comments ?? []) as Array<{ id: string; content: string | null }>).map((r) => [r.id, r])
    );

    const mapped: ModerationReport[] = rows.map((row) => {
      const reporter = profileById[row.reporter_id];
      const targetPost = row.target_type === 'post' ? postsById[row.target_id] : null;
      const targetComment = row.target_type === 'comment' ? commentsById[row.target_id] : null;
      return {
        id: row.id,
        reporterId: row.reporter_id,
        reporterName: reporter?.name?.trim() || reporter?.email?.split('@')[0] || 'Unknown reporter',
        reporterEmail: reporter?.email || 'unknown@uci.edu',
        targetType: row.target_type,
        targetId: row.target_id,
        targetLabel: row.target_type === 'post' ? 'Post' : 'Comment',
        targetPreview: row.target_type === 'post'
          ? (targetPost?.title?.trim() || targetPost?.body?.trim() || 'Original post unavailable')
          : (targetComment?.content?.trim() || 'Original comment unavailable'),
        reason: row.reason,
        details: row.details ?? '',
        status: row.status,
        createdAt: row.created_at,
      };
    });

    setReports(mapped);
    setLoading(false);
  }

  async function updateReportStatus(reportId: string, status: ReportStatus) {
    setUpdatingId(reportId);
    const { error } = await supabase.from('reports').update({ status }).eq('id', reportId).eq('school', school);
    setUpdatingId(null);
    if (error) {
      Alert.alert('Could not update report', error.message);
      return;
    }
    setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status } : r)));
  }

  const filteredReports = reports.filter((report) => (filter === 'all' ? true : report.status === filter));

  const statusTone: Record<ReportStatus, { bg: string; fg: string }> = {
    pending: { bg: '#fff7ed', fg: '#ea580c' },
    reviewing: { bg: '#eff6ff', fg: '#2563eb' },
    resolved: { bg: '#ecfdf5', fg: '#059669' },
    dismissed: { bg: '#f3f4f6', fg: '#6b7280' },
  };

  const filterOptions: Array<'all' | ReportStatus> = ['all', 'pending', 'reviewing', 'resolved', 'dismissed'];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgSecondary }}>
      <SubHeader title="Reports Inbox" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 18,
            padding: 16,
            marginBottom: 18,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Moderation Queue</Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 20 }}>
            Review reported posts and comments, then move each report through pending, reviewing, resolved, or dismissed.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {filterOptions.map((option) => {
              const active = filter === option;
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => setFilter(option)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: active ? colors.brandBg : colors.card,
                    borderWidth: 1,
                    borderColor: active ? colors.brand : colors.borderSubtle,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: active ? colors.brand : colors.textSecondary }}>
                    {option === 'all' ? 'All' : option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {loading ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 36 }}>
            <ActivityIndicator color={colors.brand} />
            <Text style={{ fontSize: 14, color: colors.textTertiary }}>Loading reports...</Text>
          </View>
        ) : filteredReports.length === 0 ? (
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 18,
              padding: 18,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>No reports here</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
              There are no reports matching the current filter.
            </Text>
          </View>
        ) : (
          filteredReports.map((report) => (
            <View
              key={report.id}
              style={{
                backgroundColor: colors.card,
                borderRadius: 18,
                padding: 16,
                marginBottom: 14,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.05,
                shadowRadius: 18,
                elevation: 3,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                    {report.targetLabel} · {report.reason}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 4 }}>
                    {formatModerationDate(report.createdAt)} · Reported by {report.reporterName}
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: statusTone[report.status].bg,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '800', color: statusTone[report.status].fg }}>
                    {report.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  marginTop: 14,
                  backgroundColor: colors.bgTertiary,
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textTertiary, marginBottom: 6 }}>
                  REPORTED CONTENT
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                  {report.targetPreview}
                </Text>
                {report.details ? (
                  <>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textTertiary, marginTop: 12, marginBottom: 6 }}>
                      REPORTER NOTE
                    </Text>
                    <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>{report.details}</Text>
                  </>
                ) : null}
                <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 12 }}>
                  Reporter: {report.reporterEmail}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                {(['pending', 'reviewing', 'resolved', 'dismissed'] as ReportStatus[]).map((status) => {
                  const active = report.status === status;
                  return (
                    <TouchableOpacity
                      key={`${report.id}-${status}`}
                      disabled={active || updatingId === report.id}
                      onPress={() => void updateReportStatus(report.id, status)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 9,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: active ? colors.brand : colors.borderSubtle,
                        backgroundColor: active ? colors.brandBg : colors.card,
                        opacity: updatingId === report.id ? 0.65 : 1,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: active ? colors.brand : colors.textSecondary }}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const BOARD_ICON_OPTIONS: Array<{
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  color: string;
  iconBg: string;
}> = [
  { icon: 'chatbubbles-outline', label: 'Chat', color: '#4169E1', iconBg: '#eef1fb' },
  { icon: 'barbell-outline', label: 'Sports', color: '#10B981', iconBg: '#ecfdf5' },
  { icon: 'book-outline', label: 'Study', color: '#F59E0B', iconBg: '#fef9ec' },
  { icon: 'bag-outline', label: 'Shop', color: '#8B5CF6', iconBg: '#f5f3ff' },
  { icon: 'megaphone-outline', label: 'Announce', color: '#EC4899', iconBg: '#fdf2f8' },
  { icon: 'people-outline', label: 'Social', color: '#06B6D4', iconBg: '#ecfeff' },
  { icon: 'game-controller-outline', label: 'Gaming', color: '#F97316', iconBg: '#fff7ed' },
  { icon: 'musical-notes-outline', label: 'Music', color: '#A855F7', iconBg: '#faf5ff' },
  { icon: 'restaurant-outline', label: 'Food', color: '#EF4444', iconBg: '#fef2f2' },
  { icon: 'laptop-outline', label: 'Tech', color: '#3B82F6', iconBg: '#eff6ff' },
  { icon: 'brush-outline', label: 'Art', color: '#D97706', iconBg: '#fef9ec' },
  { icon: 'film-outline', label: 'Movies', color: '#6366F1', iconBg: '#eef2ff' },
  { icon: 'car-outline', label: 'Cars', color: '#64748B', iconBg: '#f8fafc' },
  { icon: 'home-outline', label: 'Housing', color: '#10B981', iconBg: '#ecfdf5' },
  { icon: 'briefcase-outline', label: 'Careers', color: '#0EA5E9', iconBg: '#f0f9ff' },
  { icon: 'leaf-outline', label: 'Nature', color: '#22C55E', iconBg: '#f0fdf4' },
  { icon: 'heart-outline', label: 'Health', color: '#EF4444', iconBg: '#fef2f2' },
  { icon: 'airplane-outline', label: 'Travel', color: '#06B6D4', iconBg: '#ecfeff' },
  { icon: 'globe-outline', label: 'Global', color: '#3B82F6', iconBg: '#eff6ff' },
  { icon: 'flag-outline', label: 'Events', color: '#F97316', iconBg: '#fff7ed' },
  { icon: 'flask-outline', label: 'Science', color: '#8B5CF6', iconBg: '#f5f3ff' },
  { icon: 'camera-outline', label: 'Photos', color: '#EC4899', iconBg: '#fdf2f8' },
  { icon: 'mic-outline', label: 'Podcast', color: '#6366F1', iconBg: '#eef2ff' },
  { icon: 'star-outline', label: 'Featured', color: '#F59E0B', iconBg: '#fef9ec' },
];

function CreateBoardView({
  school,
  requestId,
  initialName,
  initialDescription,
  onBack,
  onSuccess,
}: {
  school: string;
  requestId: string;
  initialName: string;
  initialDescription: string;
  onBack: () => void;
  onSuccess: (requestId: string) => void;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [selectedIconIndex, setSelectedIconIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const selectedIcon = BOARD_ICON_OPTIONS[selectedIconIndex];

  async function handleApply() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Please enter a board name.');
      return;
    }
    setSubmitting(true);

    const { error: insertError } = await supabase.from('boards').insert({
      name: trimmedName,
      description: description.trim() || null,
      category: trimmedName,
      icon: selectedIcon.icon,
      color: selectedIcon.color,
      icon_bg: selectedIcon.iconBg,
      school,
    });

    if (insertError) {
      setSubmitting(false);
      Alert.alert('Could not create board', insertError.message);
      return;
    }

    await supabase.from('board_requests').update({ status: 'resolved' }).eq('id', requestId).eq('school', school);
    setSubmitting(false);
    Alert.alert('Board created!', `"${trimmedName}" is now live for all users.`, [
      { text: 'OK', onPress: () => onSuccess(requestId) },
    ]);
  }

  const COLS = 4;
  const rows: typeof BOARD_ICON_OPTIONS[] = [];
  for (let i = 0; i < BOARD_ICON_OPTIONS.length; i += COLS) {
    rows.push(BOARD_ICON_OPTIONS.slice(i, i + COLS));
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgSecondary }}>
      <SubHeader title="Create Board" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Preview */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
          borderRadius: 18, padding: 16, marginBottom: 24,
          borderWidth: 1.5, borderColor: colors.borderSubtle,
        }}>
          <View style={{
            width: 48, height: 48, borderRadius: 14,
            backgroundColor: selectedIcon.iconBg,
            alignItems: 'center', justifyContent: 'center', marginRight: 14,
          }}>
            <Ionicons name={selectedIcon.icon} size={22} color={selectedIcon.color} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
              {name.trim() || 'Board Name'}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1} ellipsizeMode="tail">
              {description.trim() || 'Board description'}
            </Text>
          </View>
        </View>

        {/* Name */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
          Board Name <Text style={{ color: '#ef4444' }}>*</Text>
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Photography Club"
          placeholderTextColor={colors.placeholder}
          style={{
            backgroundColor: colors.inputBg, borderRadius: 12,
            paddingHorizontal: 14, paddingVertical: 13, fontSize: 14,
            color: colors.text, marginBottom: 18,
            borderWidth: 1, borderColor: colors.border,
          }}
        />

        {/* Description */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
          Description
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="What is this board about?"
          placeholderTextColor={colors.placeholder}
          multiline
          style={{
            backgroundColor: colors.inputBg, borderRadius: 12,
            paddingHorizontal: 14, paddingVertical: 13, fontSize: 14,
            color: colors.text, marginBottom: 24, minHeight: 80,
            textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border,
          }}
        />

        {/* Icon picker */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
          Choose Icon
        </Text>
        {rows.map((row, rowIdx) => (
          <View key={rowIdx} style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            {row.map((opt, colIdx) => {
              const idx = rowIdx * COLS + colIdx;
              const active = idx === selectedIconIndex;
              return (
                <TouchableOpacity
                  key={opt.label}
                  onPress={() => setSelectedIconIndex(idx)}
                  style={{
                    flex: 1, alignItems: 'center', paddingVertical: 12,
                    borderRadius: 14, borderWidth: active ? 2 : 1,
                    borderColor: active ? opt.color : colors.borderSubtle,
                    backgroundColor: active ? opt.iconBg : colors.card,
                  }}
                >
                  <View style={{
                    width: 36, height: 36, borderRadius: 10,
                    backgroundColor: opt.iconBg,
                    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
                  }}>
                    <Ionicons name={opt.icon} size={18} color={opt.color} />
                  </View>
                  <Text style={{ fontSize: 10, color: active ? opt.color : colors.textTertiary, fontWeight: active ? '700' : '400' }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Apply button */}
        <TouchableOpacity
          disabled={submitting}
          onPress={() => void handleApply()}
          style={{
            marginTop: 20, backgroundColor: '#10B981', borderRadius: 14,
            paddingVertical: 16, alignItems: 'center',
            flexDirection: 'row', justifyContent: 'center', gap: 8,
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting
            ? <ActivityIndicator size="small" color="white" />
            : <Ionicons name="checkmark-circle-outline" size={18} color="white" />}
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
            {submitting ? 'Creating…' : 'Create Board'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function ManageBoardsView({ school, onBack }: { school: string; onBack: () => void }) {
  const { colors } = useTheme();
  const [boards, setBoards] = useState<Array<{
    id: string;
    name: string;
    description: string | null;
    icon: string;
    color: string;
    iconBg: string;
    category: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { void fetchBoards(); }, []);

  async function fetchBoards() {
    setLoading(true);
    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .eq('school', school)
      .order('created_at', { ascending: true });
    setLoading(false);
    if (error) { Alert.alert('Could not load boards', error.message); return; }
    setBoards((data ?? []) as typeof boards);
  }

  function confirmDelete(board: typeof boards[0]) {
    Alert.alert(
      `Delete "${board.name}"?`,
      'This will permanently remove the board. Existing posts will not be deleted but will no longer appear under any board.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void handleDelete(board.id),
        },
      ]
    );
  }

  async function handleDelete(boardId: string) {
    setDeletingId(boardId);
    const { data: deleted, error } = await supabase
      .from('boards')
      .delete()
      .eq('id', boardId)
      .eq('school', school)
      .select();
    setDeletingId(null);
    if (error) {
      Alert.alert('Could not delete board', error.message);
      return;
    }
    if (!deleted || deleted.length === 0) {
      Alert.alert(
        'Delete blocked',
        'Supabase removed 0 rows. Run this in the Supabase SQL editor:\n\nCREATE POLICY "Authenticated users can delete boards" ON boards FOR DELETE USING (auth.role() = \'authenticated\');'
      );
      return;
    }
    setBoards((prev) => prev.filter((b) => b.id !== boardId));
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgSecondary }}>
      <SubHeader title="Manage Boards" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 36 }}>
            <ActivityIndicator color={colors.brand} />
            <Text style={{ fontSize: 14, color: colors.textTertiary }}>Loading boards...</Text>
          </View>
        ) : boards.length === 0 ? (
          <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.borderSubtle, alignItems: 'center' }}>
            <Ionicons name="albums-outline" size={32} color={colors.textTertiary} style={{ marginBottom: 8 }} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>No boards yet</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>Create boards from approved requests.</Text>
          </View>
        ) : (
          boards.map((board) => (
            <View
              key={board.id}
              style={{
                backgroundColor: colors.card, borderRadius: 18, padding: 16, marginBottom: 12,
                borderWidth: 1, borderColor: colors.borderSubtle,
                flexDirection: 'row', alignItems: 'center', gap: 14,
              }}
            >
              <View style={{
                width: 44, height: 44, borderRadius: 12,
                backgroundColor: board.iconBg ?? '#eef1fb',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Ionicons name={board.icon as React.ComponentProps<typeof Ionicons>['name']} size={20} color={board.color} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{board.name}</Text>
                {board.description ? (
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1} ellipsizeMode="tail">{board.description}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                disabled={deletingId === board.id}
                onPress={() => confirmDelete(board)}
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
                  alignItems: 'center', justifyContent: 'center',
                  opacity: deletingId === board.id ? 0.5 : 1,
                }}
              >
                {deletingId === board.id
                  ? <ActivityIndicator size="small" color="#ef4444" />
                  : <Ionicons name="trash-outline" size={16} color="#ef4444" />}
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function BoardRequestsScreen({ school, onBack }: { school: string; onBack: () => void }) {
  const { colors } = useTheme();
  const [requests, setRequests] = useState<Array<{
    id: string;
    requesterName: string;
    requesterEmail: string;
    name: string;
    description: string;
    status: ReportStatus;
    createdAt: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | ReportStatus>('pending');
  const [createBoardFor, setCreateBoardFor] = useState<{
    id: string;
    name: string;
    description: string;
  } | null>(null);
  const [showManageBoards, setShowManageBoards] = useState(false);
  const { width: screenWidth } = useWindowDimensions();
  const screenWidthRef = useRef(screenWidth);
  useEffect(() => { screenWidthRef.current = screenWidth; }, [screenWidth]);
  const boardsSlideAnim = useRef(new Animated.Value(screenWidth)).current;
  const swipeBoardsPan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) => gs.dx > 6 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
    onPanResponderMove: (_, gs) => { if (gs.dx > 0) boardsSlideAnim.setValue(gs.dx); },
    onPanResponderRelease: (_, gs) => {
      if (gs.dx > screenWidthRef.current * 0.35 || gs.vx > 0.6) {
        closeManageBoards();
      } else {
        Animated.spring(boardsSlideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 16 }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(boardsSlideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 16 }).start();
    },
  })).current;

  function openManageBoards() {
    boardsSlideAnim.setValue(screenWidthRef.current);
    setShowManageBoards(true);
    Animated.spring(boardsSlideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 16 }).start();
  }

  function closeManageBoards() {
    Animated.timing(boardsSlideAnim, { toValue: screenWidthRef.current, duration: 260, useNativeDriver: true }).start(() => {
      setShowManageBoards(false);
      boardsSlideAnim.setValue(screenWidthRef.current);
    });
  }

  useEffect(() => { void fetchRequests(); }, []);

  async function fetchRequests() {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from('board_requests')
      .select('*')
      .eq('school', school)
      .order('created_at', { ascending: false });

    if (error) {
      setLoading(false);
      Alert.alert('Could not load board requests', error.message);
      return;
    }

    const typedRows = (rows ?? []) as Array<{
      id: string;
      requester_id: string;
      name: string;
      description: string | null;
      status: ReportStatus;
      created_at: string;
    }>;

    const requesterIds = Array.from(new Set(typedRows.map((r) => r.requester_id).filter(Boolean)));
    const { data: profiles } = requesterIds.length
      ? await supabase.from('profiles').select('id, name, email').eq('school', school).in('id', requesterIds)
      : { data: [] as any[] };

    const profileById = Object.fromEntries(
      ((profiles ?? []) as Array<{ id: string; name: string | null; email: string | null }>).map((r) => [r.id, r])
    );

    setRequests(typedRows.map((row) => {
      const p = profileById[row.requester_id];
      return {
        id: row.id,
        requesterName: p?.name?.trim() || p?.email?.split('@')[0] || 'Unknown user',
        requesterEmail: p?.email || 'unknown@uci.edu',
        name: row.name,
        description: row.description ?? '',
        status: row.status,
        createdAt: row.created_at,
      };
    }));
    setLoading(false);
  }

  async function updateStatus(id: string, status: ReportStatus) {
    setUpdatingId(id);
    const { error } = await supabase.from('board_requests').update({ status }).eq('id', id).eq('school', school);
    setUpdatingId(null);
    if (error) { Alert.alert('Could not update status', error.message); return; }
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  const statusTone: Record<ReportStatus, { bg: string; fg: string }> = {
    pending: { bg: '#fff7ed', fg: '#ea580c' },
    reviewing: { bg: '#eff6ff', fg: '#2563eb' },
    resolved: { bg: '#ecfdf5', fg: '#059669' },
    dismissed: { bg: '#f3f4f6', fg: '#6b7280' },
  };

  const filterOptions: Array<'all' | ReportStatus> = ['all', 'pending', 'reviewing', 'resolved', 'dismissed'];
  const filtered = requests.filter((r) => filter === 'all' || r.status === filter);

  if (createBoardFor) {
    return (
      <CreateBoardView
        school={school}
        requestId={createBoardFor.id}
        initialName={createBoardFor.name}
        initialDescription={createBoardFor.description}
        onBack={() => setCreateBoardFor(null)}
        onSuccess={(reqId) => {
          setCreateBoardFor(null);
          setRequests((prev) => prev.map((r) => (r.id === reqId ? { ...r, status: 'resolved' } : r)));
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: colors.bgSecondary }}>
      <SubHeader title="Board Requests" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          onPress={openManageBoards}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 16,
            borderWidth: 1, borderColor: colors.borderSubtle,
          }}
        >
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.brandBg, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="albums-outline" size={18} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Manage Active Boards</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>View and delete existing boards</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </TouchableOpacity>

        <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 16, marginBottom: 18, borderWidth: 1, borderColor: colors.borderSubtle }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>New Board Requests</Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 20 }}>
            Review board suggestions from users and move them through the approval workflow.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {filterOptions.map((option) => {
              const active = filter === option;
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => setFilter(option)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
                    backgroundColor: active ? colors.brandBg : colors.card,
                    borderWidth: 1, borderColor: active ? colors.brand : colors.borderSubtle,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: active ? colors.brand : colors.textSecondary }}>
                    {option === 'all' ? 'All' : option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {loading ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 36 }}>
            <ActivityIndicator color={colors.brand} />
            <Text style={{ fontSize: 14, color: colors.textTertiary }}>Loading board requests...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.borderSubtle, alignItems: 'center' }}>
            <Ionicons name="clipboard-outline" size={32} color={colors.textTertiary} style={{ marginBottom: 8 }} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>No requests here</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>No board requests match the current filter.</Text>
          </View>
        ) : (
          filtered.map((req) => (
            <View
              key={req.id}
              style={{
                backgroundColor: colors.card, borderRadius: 18, padding: 16, marginBottom: 14,
                borderWidth: 1, borderColor: colors.borderSubtle,
                shadowColor: '#0f172a', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 18, elevation: 3,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{req.name}</Text>
                  <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 4 }}>
                    {formatModerationDate(req.createdAt)} · {req.requesterName}
                  </Text>
                </View>
                <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: statusTone[req.status].bg }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: statusTone[req.status].fg }}>
                    {req.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              {req.description ? (
                <View style={{ marginTop: 14, backgroundColor: colors.bgTertiary, borderRadius: 14, padding: 14 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textTertiary, marginBottom: 6 }}>DESCRIPTION</Text>
                  <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>{req.description}</Text>
                  <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 12 }}>Requested by: {req.requesterEmail}</Text>
                </View>
              ) : (
                <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 10 }}>Requested by: {req.requesterEmail}</Text>
              )}

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                {(['pending', 'reviewing', 'resolved', 'dismissed'] as ReportStatus[]).map((status) => {
                  const active = req.status === status;
                  return (
                    <TouchableOpacity
                      key={`${req.id}-${status}`}
                      disabled={active || updatingId === req.id}
                      onPress={() => void updateStatus(req.id, status)}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1,
                        borderColor: active ? colors.brand : colors.borderSubtle,
                        backgroundColor: active ? colors.brandBg : colors.card,
                        opacity: updatingId === req.id ? 0.65 : 1,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: active ? colors.brand : colors.textSecondary }}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.borderSubtle, paddingTop: 12 }}>
                <TouchableOpacity
                  onPress={() => setCreateBoardFor({ id: req.id, name: req.name, description: req.description })}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                    paddingVertical: 12, borderRadius: 12,
                    backgroundColor: '#ecfdf5', borderWidth: 1.5, borderColor: '#10B981',
                  }}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#10B981" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#10B981' }}>Create Board from this Request</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
      </View>

      {showManageBoards && (
        <Animated.View
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, transform: [{ translateX: boardsSlideAnim }] }}
          {...swipeBoardsPan.panHandlers}
        >
          <ManageBoardsView school={school} onBack={closeManageBoards} />
        </Animated.View>
      )}
    </View>
  );
}

// ─── Main Settings screen ─────────────────────────────────────────────────────
export default function SettingsScreen({
  visible,
  onClose,
  onLogout,
  onDeleteAccount,
  deletingAccount = false,
  userName = 'John Doe',
  userEmail = 'john.doe@university.edu',
  school,
  userProfile,
  userSettings,
  themePreference,
  onThemeChange,
  onSaveProfile,
  onSaveVisibility,
  onSaveNotifications,
  onSaveRegion,
  onRequestPushPermissions,
  savingProfile,
  savingVisibility,
  savingNotifications,
  savingRegion,
}: Props) {
  const { colors } = useTheme();
  const [screen, setScreen] = useState<Screen>('main');
  const { width: screenWidth } = useWindowDimensions();
  const screenWidthRef = useRef(screenWidth);
  useEffect(() => { screenWidthRef.current = screenWidth; }, [screenWidth]);
  const slideAnim = useRef(new Animated.Value(screenWidth)).current;
  const isModerator = MODERATOR_EMAILS.includes(userEmail.toLowerCase());

  const navigateTo = (next: Screen) => {
    slideAnim.setValue(screenWidthRef.current);
    setScreen(next);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 16,
    }).start();
  };

  const goBack = () => {
    Animated.timing(slideAnim, {
      toValue: screenWidthRef.current,
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      setScreen('main');
      slideAnim.setValue(screenWidthRef.current);
    });
  };

  const swipePan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) => gs.dx > 6 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
    onPanResponderMove: (_, gs) => {
      if (gs.dx > 0) slideAnim.setValue(gs.dx);
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dx > screenWidthRef.current * 0.35 || gs.vx > 0.6) {
        goBack();
      } else {
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 16 }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 16 }).start();
    },
  })).current;

  const initials = userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const handleClose = () => {
    setScreen('main');
    onClose();
  };

  const renderSubScreen = () => {
    switch (screen) {
      case 'profile':
        return (
          <ProfileEditorScreen
            onBack={goBack}
            userEmail={userEmail}
            initialProfile={userProfile}
            onSave={onSaveProfile}
            saving={savingProfile}
            onSaveSuccess={goBack}
            headerPaddingTop={20}
          />
        );
      case 'privacy':
        return (
          <PrivacySecurityScreen
            onBack={goBack}
            initialVisibility={userSettings.timetableVisibility}
            initialBoardProfileVisible={userSettings.boardProfileVisible}
            school={school}
            onSave={onSaveVisibility}
            saving={savingVisibility}
          />
        );
      case 'notifications':
        return (
          <NotificationsScreen
            onBack={goBack}
            initialSettings={userSettings.notifications}
            initialPermissionStatus={userSettings.pushPermissionStatus}
            onSave={onSaveNotifications}
            onRequestPushPermissions={onRequestPushPermissions}
            saving={savingNotifications}
          />
        );
      case 'appearance': return <AppearanceScreen onBack={goBack} themePreference={themePreference} onThemeChange={onThemeChange} />;
      case 'language':
        return (
	          <LanguageRegionScreen
	            onBack={goBack}
	            school={school}
	            initialLanguage={userSettings.language}
            initialTimeZone={userSettings.timeZone}
            initialDateFormat={userSettings.dateFormat}
            onSave={onSaveRegion}
            saving={savingRegion}
          />
        );
      case 'help': return <HelpCenterScreen onBack={goBack} />;
      case 'about': return <AboutScreen onBack={goBack} />;
      case 'moderation': return <ModerationScreen school={school} onBack={goBack} />;
      case 'board_requests': return <BoardRequestsScreen school={school} onBack={goBack} />;
      default: return null;
    }
  };

  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <View style={{ flex: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' }}>
      {/* Main settings — always rendered as background */}
      <View style={{ flex: 1, backgroundColor: colors.bgSecondary }}>
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
          <View style={{
            backgroundColor: colors.card, paddingHorizontal: 20, paddingVertical: 20,
            flexDirection: 'row', alignItems: 'center', gap: 16,
            borderBottomWidth: 1, borderBottomColor: colors.borderSubtle, marginBottom: 24,
          }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: 'white' }}>{initials}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{userName}</Text>
              <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>{userEmail}</Text>
              <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>
                {abbreviateMajor(userProfile.major) || 'UNDECL'} · {userProfile.year}
              </Text>
            </View>
          </View>

          <SectionGroup
            title="ACCOUNT"
            items={[
              { label: 'Edit Profile', icon: 'person-outline', onPress: () => navigateTo('profile') },
              { label: 'Privacy & Security', icon: 'shield-outline', onPress: () => navigateTo('privacy') },
            ]}
          />
          <SectionGroup
            title="PREFERENCES"
            items={[
              { label: 'Notifications', icon: 'notifications-outline', onPress: () => navigateTo('notifications') },
              { label: 'Appearance', icon: 'color-palette-outline', onPress: () => navigateTo('appearance') },
              { label: 'Language & Region', icon: 'globe-outline', onPress: () => navigateTo('language') },
            ]}
          />
          <SectionGroup
            title="SUPPORT"
            items={[
              { label: 'Help Center', icon: 'help-circle-outline', onPress: () => navigateTo('help') },
              { label: 'About ClassMate', icon: 'information-circle-outline', onPress: () => navigateTo('about') },
            ]}
          />
          {isModerator && (
            <SectionGroup
              title="ADMIN"
              items={[
                { label: 'Reports Inbox', icon: 'shield-checkmark-outline', onPress: () => navigateTo('moderation') },
                { label: 'Board Requests', icon: 'albums-outline', onPress: () => navigateTo('board_requests') },
              ]}
            />
          )}

          <View style={{ marginHorizontal: 0, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.borderSubtle }}>
            <TouchableOpacity
              onPress={onLogout}
              style={{ backgroundColor: colors.destructiveBg, borderRadius: 14, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.destructive} />
              <Text style={{ color: colors.destructive, fontWeight: '700', fontSize: 15 }}>Log Out</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onDeleteAccount}
              disabled={deletingAccount}
              style={{
                marginTop: 12,
                borderRadius: 14,
                paddingVertical: 15,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.destructive,
                opacity: deletingAccount ? 0.55 : 1,
              }}
            >
              {deletingAccount ? (
                <ActivityIndicator size="small" color={colors.destructive} />
              ) : (
                <Ionicons name="trash-outline" size={20} color={colors.destructive} />
              )}
              <Text style={{ color: colors.destructive, fontWeight: '800', fontSize: 15 }}>
                {deletingAccount ? 'Deleting Account...' : 'Delete Account'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={{ textAlign: 'center', color: colors.textTertiary, fontSize: 13, marginTop: 16 }}>ClassMate v1.0.0</Text>
        </ScrollView>
      </View>

      {/* Sub-screen overlay — absolutely positioned, slides in over settings */}
      {screen !== 'main' && (
        <Animated.View
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, transform: [{ translateX: slideAnim }] }}
          {...swipePan.panHandlers}
        >
          {renderSubScreen()}
        </Animated.View>
      )}
    </View>
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

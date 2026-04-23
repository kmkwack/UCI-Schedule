import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import type { EditableProfile } from '../data/userPreferences';

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

function ProfileDropdownPicker({
  label,
  required,
  value,
  options,
  onSelect,
  searchable,
}: {
  label: string;
  required?: boolean;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  searchable?: boolean;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const filtered = searchable && search
    ? options.filter((option) => option.toLowerCase().includes(search.toLowerCase()))
    : options;

  const openPicker = () => {
    setOpen(true);
    setSearch('');
    sheetAnim.setValue(500);
    backdropAnim.setValue(0);
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
        {label}
        {required ? <Text style={{ color: colors.destructive }}> *</Text> : null}
      </Text>
      <TouchableOpacity
        onPress={openPicker}
        style={{
          backgroundColor: colors.inputBg,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 13,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ fontSize: 14, color: value ? colors.text : colors.placeholder }}>
          {value || 'Select...'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="none" onRequestClose={closePicker}>
        {/* Visual backdrop — purely visual, never intercepts touches */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)', opacity: backdropAnim }]}
          pointerEvents="none"
        />
        {/* Full-screen layout container */}
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          {/* Dismiss area above the sheet */}
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closePicker} />
          <Animated.View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: keyboardHeight > 0 ? 8 : 32,
              maxHeight: keyboardHeight > 0
                ? SCREEN_HEIGHT - keyboardHeight - 60
                : SCREEN_HEIGHT * 0.75,
              marginBottom: keyboardHeight,
              transform: [{ translateY: sheetAnim }],
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: colors.borderSubtle,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{label}</Text>
              <TouchableOpacity onPress={closePicker}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {searchable ? (
              <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder={`Search ${label.toLowerCase()}...`}
                  placeholderTextColor={colors.placeholder}
                  style={{
                    backgroundColor: colors.inputBg,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    fontSize: 14,
                    color: colors.text,
                  }}
                />
              </View>
            ) : null}
            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    onSelect(item);
                    closePicker();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.borderSubtle,
                  }}
                >
                  <Text style={{ fontSize: 15, color: colors.text, flex: 1 }}>{item}</Text>
                  {value === item ? <Ionicons name="checkmark" size={18} color={colors.brand} /> : null}
                </TouchableOpacity>
              )}
            />
          </Animated.View>
        </View>
      </Modal>

    </View>
  );
}

function validateDOB(dob: string): string | null {
  if (!dob || dob.length < 10) return null;

  const [mm, dd, yyyy] = dob.split('/').map(Number);
  if (mm < 1 || mm > 12) return 'Invalid month (01-12)';
  if (dd < 1 || dd > 31) return 'Invalid day';
  if (yyyy < 1900 || yyyy > new Date().getFullYear()) {
    return `Invalid year (1900-${new Date().getFullYear()})`;
  }

  const daysInMonth = new Date(yyyy, mm, 0).getDate();
  if (dd > daysInMonth) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[mm - 1]} ${yyyy} only has ${daysInMonth} days`;
  }

  return null;
}

type Props = {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  showBackButton?: boolean;
  userEmail?: string;
  initialProfile: EditableProfile;
  onSave: (profile: EditableProfile) => Promise<boolean>;
  saving?: boolean;
  saveLabel?: string;
  onSaveSuccess?: () => void;
  headerPaddingTop?: number;
};

export default function ProfileEditorScreen({
  title = 'Edit Profile',
  subtitle,
  onBack,
  showBackButton = true,
  userEmail,
  initialProfile,
  onSave,
  saving,
  saveLabel = 'Save Changes',
  onSaveSuccess,
  headerPaddingTop,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<EditableProfile>(initialProfile);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const dobRef = useRef<View>(null);
  const dobFocused = useRef(false);

  const scrollDOBIntoView = (animated = true) => {
    if (!dobRef.current || !scrollRef.current) return;
    dobRef.current.measureLayout(
      scrollRef.current as any,
      (_x, y) => {
        const targetY = Math.max(0, y - 140);
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ y: targetY, animated });
        });
      },
      () => {}
    );
  };

  useEffect(() => {
    setForm(initialProfile);
  }, [initialProfile]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      const h = e.endCoordinates.height;
      setKbHeight(h);
      setKeyboardVisible(true);
      if (dobFocused.current) {
        scrollDOBIntoView();
      }
    });
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => { setKeyboardVisible(false); setKbHeight(0); }
    );

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const dobError = validateDOB(form.dateOfBirth ?? '');

  const field = (
    label: string,
    key: keyof EditableProfile,
    disabled = false,
    placeholder?: string,
    inputProps?: Record<string, unknown>,
    error?: string | null
  ) => (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
        {label.replace(' *', '')}
        {label.endsWith(' *') ? <Text style={{ color: colors.destructive }}> *</Text> : null}
      </Text>
      <View
        style={{
          backgroundColor: disabled ? colors.bgTertiary : colors.inputBg,
          borderWidth: 1,
          borderColor: error ? colors.destructive : colors.border,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        <TextInput
          value={form[key]}
          onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))}
          editable={!disabled}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          style={{ fontSize: 14, color: disabled ? colors.textTertiary : colors.text }}
          {...inputProps}
        />
      </View>
      {disabled ? (
        <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 4 }}>Email cannot be changed</Text>
      ) : null}
      {error ? <Text style={{ fontSize: 11, color: colors.destructive, marginTop: 4 }}>{error}</Text> : null}
    </View>
  );

  const handleSubmit = async () => {
    const requiredMissing = !form.firstName.trim() || !form.lastName.trim() || !form.nickname.trim();
    if (requiredMissing) {
      Alert.alert('Missing information', 'Please complete your first name, last name, and nickname before saving.');
      return;
    }

    if (dobError) {
      Alert.alert('Invalid date of birth', dobError);
      return;
    }

    const saved = await onSave({ ...form, email: userEmail ?? form.email });
    if (saved) {
      onSaveSuccess?.();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.card }}>
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: headerPaddingTop ?? insets.top + 12,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSubtle,
          backgroundColor: colors.card,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 28 }}>
          {showBackButton && onBack ? (
            <TouchableOpacity
              onPress={onBack}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ marginRight: 10 }}
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
          ) : null}
          <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, flexShrink: 1 }}>{title}</Text>
        </View>
        {subtitle ? (
          <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: 10 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            padding: 20,
            paddingBottom: keyboardVisible
              ? kbHeight + footerHeight + insets.bottom + 40
              : Math.max(footerHeight + insets.bottom + 20, 96),
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          {field('First Name *', 'firstName')}
          {field('Middle Name', 'middleName', false, 'Optional')}
          {field('Last Name *', 'lastName')}
          {field('Nickname *', 'nickname', false, undefined, { autoCapitalize: 'none' })}
          {field('University Email *', 'email', true)}
          <ProfileDropdownPicker
            label="Year"
            required
            value={form.year}
            options={['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate']}
            onSelect={(value) => setForm((current) => ({ ...current, year: value }))}
          />
          <ProfileDropdownPicker
            label="Major"
            required
            value={form.major}
            options={UCI_MAJORS}
            onSelect={(value) => setForm((current) => ({ ...current, major: value }))}
            searchable
          />

          <View
            style={{
              paddingTop: 16,
              borderTopWidth: 1,
              borderTopColor: colors.borderSubtle,
              marginBottom: 4,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textTertiary, marginBottom: 16 }}>
              Optional Information
            </Text>
            <ProfileDropdownPicker
              label="Gender"
              value={form.gender}
              options={['Prefer not to say', 'Male', 'Female', 'Other']}
              onSelect={(value) => setForm((current) => ({ ...current, gender: value }))}
            />
            <View ref={dobRef}>
              {field(
                'Date of Birth',
                'dateOfBirth',
                false,
                'mm/dd/yyyy',
                {
                  keyboardType: 'number-pad',
                  onFocus: () => {
                    dobFocused.current = true;
                    scrollDOBIntoView();
                  },
                  onBlur: () => {
                    dobFocused.current = false;
                  },
                  onChangeText: (text: string) => {
                    const digits = text.replace(/\D/g, '').slice(0, 8);
                    let formatted = digits;
                    if (digits.length > 2) formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                    if (digits.length > 4) formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                    setForm((current) => ({ ...current, dateOfBirth: formatted }));
                  },
                },
                dobError
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
        style={{ padding: 20, borderTopWidth: 1, borderTopColor: colors.borderSubtle }}
      >
        <TouchableOpacity
          disabled={saving}
          onPress={() => void handleSubmit()}
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
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="save-outline" size={18} color="white" />
          )}
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>{saving ? 'Saving...' : saveLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

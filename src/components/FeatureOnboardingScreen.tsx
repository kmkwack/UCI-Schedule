import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { DEFAULT_UNIVERSITY, getSchoolConfig } from '../data/schools';
import { fallbackProfileFromEmail, type EditableProfile } from '../data/userPreferences';

type Props = {
  onFinish: () => Promise<void> | void;
  onCompleteNotifications?: (enabled: boolean) => Promise<void> | void;
  onBackToUniversity?: () => Promise<void> | void;
  finishing?: boolean;
  initialProfile?: EditableProfile;
  userEmail?: string;
  schoolName?: string;
  onSaveProfile?: (profile: EditableProfile) => Promise<boolean>;
};

type Slide = {
  eyebrow: string;
  title: string;
  body: string;
  accent: string;
  kind: 'arrival' | 'names' | 'profile' | 'personal' | 'tour' | 'notifications';
};

const PALETTE = {
  bg: '#f4f7ff',
  bgDark: '#09111d',
  ink: '#16285b',
  inkSoft: '#5e73a8',
  inkMuted: '#8b97b4',
  brand: '#4169E1',
  border: '#e4eaff',
  borderDark: 'rgba(255,255,255,0.08)',
};

const YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Grad'];
const GENDER_OPTIONS = ['Prefer not to say', 'Female', 'Male', 'Non-binary', 'Other'];
const NOTIFICATION_BENEFITS = [
  {
    icon: 'notifications-outline' as const,
    title: 'Class reminders that actually help',
    copy: 'Get a heads-up before class, not after you already forgot.',
  },
  {
    icon: 'chatbubble-ellipses-outline' as const,
    title: 'Messages and friend requests',
    copy: 'Know when classmates reach out instead of checking manually.',
  },
  {
    icon: 'calendar-clear-outline' as const,
    title: "Today's classes at 8 AM",
    copy: 'Start the day with a quick summary of what is coming up.',
  },
];
const COMMON_MAJORS = [
  'Undeclared',
  'Biological Sciences',
  'Business Administration',
  'Business Economics',
  'Computer Science',
  'Computer Science and Engineering',
  'Data Science',
  'Economics',
  'Education Sciences',
  'Engineering',
  'Informatics',
  'International Studies',
  'Mathematics',
  'Mechanical Engineering',
  'Philosophy',
  'Political Science',
  'Psychology',
  'Public Health Policy',
  'Public Health Science',
  'Quantitative Economics',
  'Software Engineering',
];

const SLIDES: Slide[] = [
  {
    eyebrow: '01 · Arrival',
    title: 'Welcome.',
    body: "Let's set up the campus app built around your schedule, classmates, and college life.",
    accent: '#4169E1',
    kind: 'arrival',
  },
  {
    eyebrow: '02 · Roll Call',
    title: 'What should we call you?',
    body: 'Your full name keeps your account clear. Your nickname is what classmates see day to day.',
    accent: '#4169E1',
    kind: 'names',
  },
  {
    eyebrow: '03 · About You',
    title: 'Where do you fit in?',
    body: 'Your year and major help ClassMate surface better classmates, boards, and course context.',
    accent: '#4169E1',
    kind: 'profile',
  },
  {
    eyebrow: '04 · Optional',
    title: 'A little more about you?',
    body: 'These details are optional. Add them now, or leave them blank and update your profile later.',
    accent: '#4169E1',
    kind: 'personal',
  },
  {
    eyebrow: '05 · App Tour',
    title: 'Meet ClassMate.',
    body: 'Scroll through the core pieces of the app: today, your timetable, classmates, and boards.',
    accent: '#4169E1',
    kind: 'tour',
  },
  {
    eyebrow: '06 · Notifications',
    title: 'Turn on notifications for the good stuff',
    body: 'ClassMate can remind you about classes, messages, comments, and friend requests right when they matter.',
    accent: '#4169E1',
    kind: 'notifications',
  },
];

type SchoolOnboardingBrand = {
  badge: string;
  backgroundSource?: number;
  welcomeName: string;
  mascotName: string;
  communityName: string;
  accent: string;
};

function getOnboardingSchoolBrand(schoolName?: string): SchoolOnboardingBrand {
  const defaultSchoolName = DEFAULT_UNIVERSITY.name;
  const normalized = (schoolName ?? defaultSchoolName).trim().toLowerCase();
  const config = getSchoolConfig(schoolName ?? defaultSchoolName);

  if (config.name === schoolName || config.name === (schoolName ?? defaultSchoolName)) {
    return {
      badge: config.shortName.toUpperCase(),
      welcomeName: config.welcomeName,
      mascotName: config.mascotName,
      communityName: config.communityName,
      accent: config.accent,
    };
  }

  if (normalized.includes('berkeley')) return { badge: 'UC BERKELEY', welcomeName: 'Golden Bear', mascotName: 'Golden Bears', communityName: 'Golden Bears', accent: '#003262' };
  if (normalized.includes('los angeles') || normalized.includes('ucla')) return { badge: 'UCLA', welcomeName: 'Bruin', mascotName: 'Bruins', communityName: 'Bruins', accent: '#2774AE' };
  if (normalized.includes('san diego')) return { badge: 'UC SAN DIEGO', welcomeName: 'Triton', mascotName: 'Tritons', communityName: 'Tritons', accent: '#006A96' };
  if (normalized.includes('davis')) return { badge: 'UC DAVIS', welcomeName: 'Aggie', mascotName: 'Aggies', communityName: 'Aggies', accent: '#022851' };
  if (normalized.includes('santa barbara')) return { badge: 'UC SANTA BARBARA', welcomeName: 'Gaucho', mascotName: 'Gauchos', communityName: 'Gauchos', accent: '#003660' };
  if (normalized.includes('santa cruz')) return { badge: 'UC SANTA CRUZ', welcomeName: 'Banana Slug', mascotName: 'Banana Slugs', communityName: 'Banana Slugs', accent: '#003C6C' };
  if (normalized.includes('riverside')) return { badge: 'UC RIVERSIDE', welcomeName: 'Highlander', mascotName: 'Highlanders', communityName: 'Highlanders', accent: '#2D6CC0' };
  if (normalized.includes('merced')) return { badge: 'UC MERCED', welcomeName: 'Bobcat', mascotName: 'Bobcats', communityName: 'Bobcats', accent: '#005487' };
  if (normalized.includes('maryland') || normalized.includes('college park')) {
    return {
      badge: 'MARYLAND',
      welcomeName: 'Terp',
      mascotName: 'Terrapin',
      communityName: 'Terrapins',
      accent: '#E21833',
    };
  }
  if (normalized.includes('cornell')) {
    return {
      badge: 'CORNELL',
      welcomeName: 'Cornellian',
      mascotName: 'Big Red',
      communityName: 'Cornellians',
      accent: '#B31B1B',
    };
  }
  if (normalized.includes('purdue')) {
    return {
      badge: 'PURDUE',
      welcomeName: 'Boilermaker',
      mascotName: 'Purdue Pete',
      communityName: 'Boilermakers',
      accent: '#8E6F3E',
    };
  }
  if (normalized.includes('illinois') || normalized.includes('urbana')) {
    return {
      badge: 'ILLINOIS',
      welcomeName: 'Illini',
      mascotName: 'Fighting Illini',
      communityName: 'Illini',
      accent: '#FF5F05',
    };
  }

  return {
    badge: schoolName ? schoolName.toUpperCase() : 'COLLEGE',
    welcomeName: 'student',
    mascotName: 'campus community',
    communityName: 'students',
    accent: PALETTE.brand,
  };
}

function ProgressBar({ index, accent, isDark }: { index: number; accent: string; isDark: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, marginTop: 12 }}>
      {SLIDES.map((slide, i) => (
        <View
          key={slide.eyebrow}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            backgroundColor: i <= index ? accent : isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)',
          }}
        />
      ))}
    </View>
  );
}

function PrimaryButton({
  children,
  onPress,
  accent,
  disabled,
  loading,
  compact,
}: {
  children: string;
  onPress: () => void;
  accent: string;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
}) {
  return (
    <TouchableOpacity
      disabled={disabled || loading}
      onPress={onPress}
      activeOpacity={0.9}
      style={{
        minHeight: compact ? 48 : 56,
        borderRadius: 16,
        backgroundColor: disabled ? '#d9dee8' : accent,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        shadowColor: accent,
        shadowOffset: { width: 0, height: compact ? 8 : 14 },
        shadowOpacity: disabled ? 0 : compact ? 0.18 : 0.26,
        shadowRadius: compact ? 16 : 24,
        elevation: disabled ? 0 : compact ? 5 : 8,
        opacity: loading ? 0.75 : 1,
      }}
    >
      {loading ? <ActivityIndicator size="small" color="white" /> : null}
      <Text style={{ color: 'white', fontSize: compact ? 15 : 16, fontWeight: '800', letterSpacing: -0.2 }}>
        {children}
      </Text>
      {!loading ? <Ionicons name="arrow-forward" size={compact ? 16 : 17} color="white" /> : null}
    </TouchableOpacity>
  );
}

function OnboardingField({
  label,
  value,
  onChangeText,
  placeholder,
  optional,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  optional?: boolean;
}) {
  return (
    <View style={{ marginBottom: 13 }}>
      <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: PALETTE.inkMuted, textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
        {optional ? <Text style={{ color: '#b7bfcd', fontWeight: '600' }}> optional</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#b7bfcd"
        autoCorrect={false}
        style={{
          minHeight: 52,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: PALETTE.border,
          backgroundColor: '#ffffff',
          paddingHorizontal: 16,
          fontSize: 16,
          fontWeight: '600',
          color: PALETTE.ink,
        }}
      />
    </View>
  );
}

function PhotoBackdrop({ backgroundSource, isDark }: { backgroundSource?: number; isDark: boolean }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
      {backgroundSource ? (
        <Image
          source={backgroundSource}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' }}
          resizeMode="cover"
          blurRadius={3}
        />
      ) : null}
      <View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: backgroundSource
            ? isDark ? 'rgba(9,17,29,0.64)' : 'rgba(244,247,255,0.72)'
            : isDark ? PALETTE.bgDark : PALETTE.bg,
        }}
      />
    </View>
  );
}

function NamesForm({
  profile,
  updateProfile,
}: {
  profile: EditableProfile;
  updateProfile: (patch: Partial<EditableProfile>) => void;
}) {
  return (
    <View style={{ marginTop: 22 }}>
      <OnboardingField label="First name" value={profile.firstName} onChangeText={(firstName) => updateProfile({ firstName })} placeholder="Alex" />
      <OnboardingField label="Middle name" value={profile.middleName} onChangeText={(middleName) => updateProfile({ middleName })} optional />
      <OnboardingField label="Last name" value={profile.lastName} onChangeText={(lastName) => updateProfile({ lastName })} placeholder="Park" />
      <OnboardingField label="Nickname" value={profile.nickname} onChangeText={(nickname) => updateProfile({ nickname })} placeholder="What friends call you" />
    </View>
  );
}

function ProfileFitForm({
  profile,
  updateProfile,
}: {
  profile: EditableProfile;
  updateProfile: (patch: Partial<EditableProfile>) => void;
}) {
  const [majorQuery, setMajorQuery] = useState(profile.major || '');
  const suggestions = COMMON_MAJORS
    .filter((major) => major.toLowerCase().includes(majorQuery.trim().toLowerCase()))
    .slice(0, 8);

  useEffect(() => {
    setMajorQuery(profile.major || '');
  }, [profile.major]);

  return (
    <View style={{ marginTop: 22 }}>
      <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: PALETTE.inkMuted, textTransform: 'uppercase', marginBottom: 8 }}>
        Year
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        {YEARS.map((year) => {
          const active = profile.year === year;
          return (
            <TouchableOpacity
              key={year}
              onPress={() => updateProfile({ year })}
              activeOpacity={0.85}
              style={{
                paddingHorizontal: 15,
                paddingVertical: 10,
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: active ? PALETTE.brand : PALETTE.border,
                backgroundColor: active ? PALETTE.brand : '#ffffff',
              }}
            >
              <Text style={{ color: active ? 'white' : PALETTE.ink, fontSize: 13, fontWeight: '800' }}>{year}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <OnboardingField
        label="Major"
        value={majorQuery}
        onChangeText={(major) => {
          setMajorQuery(major);
          updateProfile({ major });
        }}
        placeholder="Search or type your major"
      />
      {majorQuery.trim().length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -3 }}>
          {suggestions.map((major) => {
            const active = profile.major === major;
            return (
              <TouchableOpacity
                key={major}
                onPress={() => {
                  setMajorQuery(major);
                  updateProfile({ major });
                }}
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 11,
                  paddingVertical: 7,
                  backgroundColor: active ? PALETTE.brand : '#eef3ff',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: active ? 'white' : PALETTE.brand }}>
                  {major}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function formatBirthDate(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

function PersonalDetailsForm({
  profile,
  updateProfile,
}: {
  profile: EditableProfile;
  updateProfile: (patch: Partial<EditableProfile>) => void;
}) {
  return (
    <View style={{ marginTop: 22 }}>
      <View style={{ marginBottom: 13 }}>
        <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: PALETTE.inkMuted, textTransform: 'uppercase', marginBottom: 6 }}>
          Date of birth <Text style={{ color: '#b7bfcd', fontWeight: '600' }}>optional</Text>
        </Text>
        <TextInput
          value={profile.dateOfBirth}
          onChangeText={(dateOfBirth) => updateProfile({ dateOfBirth: formatBirthDate(dateOfBirth) })}
          placeholder="MM/DD/YYYY"
          placeholderTextColor="#b7bfcd"
          keyboardType="number-pad"
          style={{
            minHeight: 52,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: PALETTE.border,
            backgroundColor: '#ffffff',
            paddingHorizontal: 16,
            fontSize: 16,
            fontWeight: '600',
            color: PALETTE.ink,
          }}
        />
      </View>

      <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: PALETTE.inkMuted, textTransform: 'uppercase', marginBottom: 8 }}>
        Gender <Text style={{ color: '#b7bfcd', fontWeight: '600' }}>optional</Text>
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {GENDER_OPTIONS.map((gender) => {
          const active = profile.gender === gender;
          return (
            <TouchableOpacity
              key={gender}
              onPress={() => updateProfile({ gender })}
              activeOpacity={0.85}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: active ? PALETTE.brand : PALETTE.border,
                backgroundColor: active ? PALETTE.brand : '#ffffff',
              }}
            >
              <Text style={{ color: active ? 'white' : PALETTE.ink, fontSize: 13, fontWeight: '800' }}>{gender}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ marginTop: 20, borderRadius: 18, backgroundColor: '#eef3ff', padding: 15 }}>
        <Text style={{ fontSize: 13, lineHeight: 19, color: PALETTE.inkSoft, fontWeight: '600' }}>
          You can edit this later in Settings. Leaving this empty will not limit any core ClassMate features.
        </Text>
      </View>
    </View>
  );
}

function TodayPreview() {
  const rows = [
    { time: '9:05 AM', code: 'ECON 1110', title: 'Intro Microeconomics', color: '#7dd3fc', dimmed: true },
    { time: '10:10 AM', code: 'ECON 4560', title: 'Development Economics', color: '#a78bfa', dimmed: false },
    { time: '1:25 PM', code: 'ECON 3465', title: 'Labor Market Research', color: '#cbd5e1', dimmed: false },
    { time: '7:30 PM', code: 'ECON 6100', title: 'Microeconomic Theory II', color: '#9bd96f', dimmed: false },
  ];

  return (
    <View style={{ gap: 12, marginTop: 24 }}>
      <View style={{ backgroundColor: '#ffffff', borderRadius: 24, padding: 17, borderWidth: 1, borderColor: '#e7ecfb' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <View>
            <Text style={{ fontSize: 29, lineHeight: 33, fontWeight: '900', color: '#16203a' }}>Today</Text>
            <Text style={{ fontSize: 29, lineHeight: 33, fontWeight: '900', color: '#16203a' }}>4 classes</Text>
            <Text style={{ fontSize: 13, color: '#7a859c', marginTop: 7 }}>9:05 AM to 8:45 PM</Text>
          </View>
          <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 7, borderColor: '#e7ecfb', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#16203a' }}>1/4</Text>
            <Text style={{ fontSize: 11, color: '#7a859c' }}>done</Text>
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: '#edf1ff', marginTop: 15, marginBottom: 12 }} />
        <Text style={{ fontSize: 11, fontWeight: '900', color: '#9aa5bd', marginBottom: 10 }}>Today's timeline</Text>
        <View style={{ gap: 11 }}>
          {rows.map((row) => (
            <View key={row.code} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, opacity: row.dimmed ? 0.42 : 1 }}>
              <Text style={{ width: 58, fontSize: 12, fontWeight: '900', color: row.dimmed ? '#aeb7ca' : '#16203a' }}>{row.time}</Text>
              <View style={{ width: 4, alignSelf: 'stretch', minHeight: 34, borderRadius: 999, backgroundColor: row.dimmed ? '#d8deea' : row.color }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '900', color: row.dimmed ? '#aeb7ca' : '#16203a' }}>{row.code}</Text>
                <Text numberOfLines={1} style={{ fontSize: 12, color: '#7a859c', marginTop: 1 }}>{row.title}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function SchedulePreview() {
  const rows = [
    ['9:30 AM', 'ECON 100A · Microeconomics', 'SSL 100', '#3b82f6'],
    ['11:00 AM', 'ICS 33 · Programming Concepts', 'DBH 1100', '#a855f7'],
    ['1:00 PM', 'PHIL 5 · Critical Reasoning', 'HH 1010', '#22c55e'],
    ['3:30 PM', 'KOR 1B · Korean II', 'HIB 110', '#f97316'],
  ];

  return (
    <View style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 15, borderWidth: 1, borderColor: '#edf1ff', gap: 10, marginTop: 24 }}>
      <Text style={{ paddingLeft: 60, fontSize: 11, fontWeight: '900', color: PALETTE.inkMuted, letterSpacing: 0.8 }}>
        TUE · APR 14
      </Text>
      {rows.map(([time, code, room, color]) => (
        <View key={code} style={{ flexDirection: 'row', alignItems: 'stretch', gap: 12 }}>
          <Text style={{ width: 62, paddingTop: 8, textAlign: 'right', fontSize: 10, fontWeight: '800', color: PALETTE.inkMuted }}>{time}</Text>
          <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: `${color}14`, borderLeftWidth: 3, borderLeftColor: color }}>
            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: PALETTE.ink, marginBottom: 2 }}>{code}</Text>
            <Text style={{ fontSize: 11, color: PALETTE.inkMuted }}>{room}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function ClassMatesPreview() {
  const mates = [
    { name: 'Sienna', initials: 'S', color: '#f97316', shared: 'ECON 100A', x: -86, y: -76 },
    { name: 'Marcus', initials: 'M', color: '#3b82f6', shared: 'ICS 33', x: 88, y: -60 },
    { name: 'Aria', initials: 'A', color: '#a855f7', shared: 'PHIL 5', x: -96, y: 70 },
    { name: 'Daniel', initials: 'D', color: '#22c55e', shared: 'KOR 1B', x: 94, y: 78 },
  ];

  return (
    <View style={{ height: 292, alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
      <View style={{ position: 'absolute', width: 230, height: 230, borderRadius: 115, borderWidth: 1, borderColor: '#e7ecfb' }} />
      <View style={{ position: 'absolute', width: 148, height: 148, borderRadius: 74, borderWidth: 1, borderColor: '#eef3ff' }} />
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: PALETTE.brand, alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
        <Text style={{ color: 'white', fontSize: 18, fontWeight: '900' }}>You</Text>
      </View>
      {mates.map((mate) => (
        <View key={mate.name} style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: mate.x - 34, marginTop: mate.y - 34, alignItems: 'center', gap: 4 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: mate.color, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '900' }}>{mate.initials}</Text>
          </View>
          <Text style={{ fontSize: 11, fontWeight: '900', color: PALETTE.ink }}>{mate.name}</Text>
          <View style={{ borderRadius: 999, backgroundColor: `${mate.color}18`, paddingHorizontal: 7, paddingVertical: 2 }}>
            <Text style={{ fontSize: 9, fontWeight: '800', color: mate.color }}>{mate.shared}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function BoardsPreview() {
  const boards = [
    { code: 'ECON 100A', topic: 'Anyone have notes from Tue?', replies: 14, color: '#3b82f6' },
    { code: 'ICS 33', topic: 'Project 2 study group · Thu 7pm DBH', replies: 8, color: '#a855f7' },
    { code: 'PHIL 5', topic: 'Final paper Q&A', replies: 23, color: '#22c55e' },
  ];

  return (
    <View style={{ gap: 10, marginTop: 24 }}>
      {boards.map((board) => (
        <View key={board.code} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, padding: 13, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#edf1ff' }}>
          <View style={{ width: 4, height: 38, borderRadius: 2, backgroundColor: board.color }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontWeight: '900', color: board.color, letterSpacing: 0.6, marginBottom: 3 }}>{board.code}</Text>
            <Text numberOfLines={2} style={{ fontSize: 13, lineHeight: 18, fontWeight: '800', color: PALETTE.ink }}>{board.topic}</Text>
          </View>
          <View style={{ borderRadius: 999, backgroundColor: '#f4f4f1', paddingHorizontal: 9, paddingVertical: 5 }}>
            <Text style={{ fontSize: 11, fontWeight: '900', color: PALETTE.inkMuted }}>{board.replies}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const TOUR_SECTION_HEIGHT = 420;
const TOUR_SECTION_OVERLAP = 56;

type TourKey = 'today' | 'schedule' | 'classmates' | 'boards';

const TOUR_ITEMS: { key: TourKey; label: string; title: string; body: string; accent: string }[] = [
  {
    key: 'today',
    label: '01 · Today',
    title: 'Your day, in order.',
    body: 'See every class on today’s timeline, with finished classes dimmed and assignments waiting right below.',
    accent: '#4169E1',
  },
  {
    key: 'schedule',
    label: '02 · Schedule',
    title: 'Build the week you actually live.',
    body: 'Add real course sections, compare plans, customize blocks, and keep every term organized.',
    accent: '#4169E1',
  },
  {
    key: 'classmates',
    label: '03 · ClassMates',
    title: 'The people in the room.',
    body: "See which friends share your classes and open their timetable when they choose to share it.",
    accent: '#4169E1',
  },
  {
    key: 'boards',
    label: '04 · Boards',
    title: 'Every class has a place to talk.',
    body: 'Use hot posts, department boards, marketplace posts, replies, images, and anonymous board conversations.',
    accent: '#4169E1',
  },
];

function TourPreview({ item }: { item: TourKey }) {
  if (item === 'today') return <TodayPreview />;
  if (item === 'schedule') return <SchedulePreview />;
  if (item === 'classmates') return <ClassMatesPreview />;
  return <BoardsPreview />;
}

function AppTourSequence({ scrollY }: { scrollY: Animated.Value }) {
  return (
    <View style={{ marginTop: 18 }}>
      {TOUR_ITEMS.map((item, itemIndex) => {
        const inputRange = [
          (itemIndex - 1) * TOUR_SECTION_HEIGHT,
          itemIndex * TOUR_SECTION_HEIGHT,
          (itemIndex + 1) * TOUR_SECTION_HEIGHT,
        ];
        const opacity = scrollY.interpolate({
          inputRange,
          outputRange: [0.18, 1, 0.12],
          extrapolate: 'clamp',
        });
        const translateY = scrollY.interpolate({
          inputRange,
          outputRange: [16, 0, -34],
          extrapolate: 'clamp',
        });
        const scale = scrollY.interpolate({
          inputRange,
          outputRange: [0.96, 1, 0.96],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            key={item.key}
            style={{
              minHeight: TOUR_SECTION_HEIGHT,
              justifyContent: 'flex-start',
              paddingTop: 0,
              paddingBottom: 22,
              marginBottom: itemIndex === TOUR_ITEMS.length - 1 ? 0 : -TOUR_SECTION_OVERLAP,
              opacity,
              transform: [{ translateY }, { scale }],
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '900', letterSpacing: 1.3, color: item.accent, textTransform: 'uppercase', marginBottom: 7 }}>
              {item.label}
            </Text>
            <Text style={{ fontSize: 30, lineHeight: 34, fontWeight: '900', color: PALETTE.ink, letterSpacing: -0.9 }}>
              {item.title}
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: PALETTE.inkSoft, marginTop: 9, fontWeight: '600' }}>
              {item.body}
            </Text>
            <TourPreview item={item.key} />
          </Animated.View>
        );
      })}
    </View>
  );
}

function NotificationsStepContent({ isDark }: { isDark: boolean }) {
  return (
    <View style={{ marginTop: 18 }}>
      <View style={{ gap: 10 }}>
        {NOTIFICATION_BENEFITS.map((benefit) => (
          <View
            key={benefit.title}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.72)',
              borderRadius: 18,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(65,105,225,0.08)',
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 13,
                backgroundColor: isDark ? 'rgba(65,105,225,0.18)' : '#eef3ff',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Ionicons name={benefit.icon} size={19} color={PALETTE.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: isDark ? '#f6f8ff' : PALETTE.ink, marginBottom: 2 }}>
                {benefit.title}
              </Text>
              <Text style={{ fontSize: 12, lineHeight: 17, color: isDark ? 'rgba(255,255,255,0.52)' : PALETTE.inkMuted }}>
                {benefit.copy}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View
        style={{
          marginTop: 10,
          borderRadius: 18,
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: isDark ? 'rgba(65,105,225,0.14)' : 'rgba(65,105,225,0.08)',
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(65,105,225,0.12)',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : '#ffffff',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <Ionicons name="checkmark-circle" size={20} color={PALETTE.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#f6f8ff' : PALETTE.ink }}>
              ClassMate
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 17, color: isDark ? 'rgba(255,255,255,0.58)' : PALETTE.inkMuted }}>
              4 classes today · 2 tasks this week
            </Text>
          </View>
          <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? 'rgba(255,255,255,0.42)' : '#9aa6bf' }}>
            8:00 AM
          </Text>
        </View>
      </View>
    </View>
  );
}

function PreviewForSlide({
  slide,
  profile,
  updateProfile,
  tourScrollY,
  isDark,
}: {
  slide: Slide;
  profile: EditableProfile;
  updateProfile: (patch: Partial<EditableProfile>) => void;
  tourScrollY: Animated.Value;
  isDark: boolean;
}) {
  if (slide.kind === 'arrival') return null;
  if (slide.kind === 'names') return <NamesForm profile={profile} updateProfile={updateProfile} />;
  if (slide.kind === 'profile') return <ProfileFitForm profile={profile} updateProfile={updateProfile} />;
  if (slide.kind === 'personal') return <PersonalDetailsForm profile={profile} updateProfile={updateProfile} />;
  if (slide.kind === 'tour') return <AppTourSequence scrollY={tourScrollY} />;
  if (slide.kind === 'notifications') return <NotificationsStepContent isDark={isDark} />;
  return null;
}

export default function FeatureOnboardingScreen({
  onFinish,
  onCompleteNotifications,
  onBackToUniversity,
  finishing = false,
  initialProfile,
  userEmail,
  schoolName,
  onSaveProfile,
}: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [profile, setProfile] = useState<EditableProfile>(() => initialProfile ?? fallbackProfileFromEmail(userEmail || `student${DEFAULT_UNIVERSITY.domain}`));
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const anim = useRef(new Animated.Value(1)).current;
  const tourScrollY = useRef(new Animated.Value(0)).current;
  const slide = SLIDES[index];
  const schoolBrand = useMemo(() => getOnboardingSchoolBrand(schoolName), [schoolName]);
  const slideAccent = slide.kind === 'arrival' ? schoolBrand.accent : slide.accent;
  const slideTitle = slide.kind === 'arrival' ? `Welcome, ${schoolBrand.welcomeName}.` : slide.title;
  const slideBody = slide.kind === 'arrival'
    ? `Let's set up ClassMate for ${schoolBrand.communityName}: your schedule, classmates, boards, and campus life in one place.`
    : slide.body;
  const isPhotoSlide = slide.kind === 'arrival';
  const backgroundColor = isDark ? PALETTE.bgDark : PALETTE.bg;
  const canContinueNames = !!profile.firstName.trim() && !!profile.lastName.trim() && !!profile.nickname.trim();
  const canContinueProfile = !!profile.year.trim() && !!profile.major.trim();
  const isBlocked = (slide.kind === 'names' && !canContinueNames) || (slide.kind === 'profile' && !canContinueProfile);
  const canSkip = profileSaved && index >= 4;

  useEffect(() => {
    if (initialProfile) setProfile(initialProfile);
  }, [initialProfile]);

  useEffect(() => {
    anim.setValue(0);
    tourScrollY.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, index, tourScrollY]);

  const animatedStyle = useMemo(() => ({
    opacity: anim,
    transform: [{
      translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [32, 0] }),
    }],
  }), [anim]);

  const heroTitleStyle = useMemo(() => ({
    opacity: anim,
    transform: [{
      translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [34, 0] }),
    }],
  }), [anim]);

  const heroBodyStyle = useMemo(() => ({
    opacity: anim.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0, 1] }),
    transform: [{
      translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [46, 0] }),
    }],
  }), [anim]);

  const updateProfile = (patch: Partial<EditableProfile>) => {
    setProfile((current) => ({ ...current, ...patch, email: userEmail || current.email }));
    setProfileSaved(false);
  };

  const saveOnboardingProfile = async () => {
    if (!onSaveProfile || profileSaved) return true;
    setSavingProfile(true);
    const ok = await onSaveProfile({ ...profile, email: userEmail || profile.email });
    setSavingProfile(false);
    if (ok) setProfileSaved(true);
    return ok;
  };

  const completeNotifications = async (enabled: boolean) => {
    if (savingProfile || finishing) return;
    if (onCompleteNotifications) {
      await onCompleteNotifications(enabled);
      return;
    }
    void onFinish();
  };

  const goNext = async () => {
    if (isBlocked || savingProfile || finishing) return;
    if (slide.kind === 'personal') {
      const saved = await saveOnboardingProfile();
      if (!saved) return;
    }
    if (slide.kind === 'notifications') {
      await completeNotifications(true);
      return;
    }
    if (index === SLIDES.length - 1) {
      void onFinish();
      return;
    }
    setIndex((current) => Math.min(SLIDES.length - 1, current + 1));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={['top', 'left', 'right', 'bottom']}>
      {slide.kind === 'arrival' ? <PhotoBackdrop backgroundSource={schoolBrand.backgroundSource} isDark={isDark} /> : null}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {slide.kind === 'arrival' && onBackToUniversity ? (
                <TouchableOpacity
                  disabled={finishing || savingProfile}
                  onPress={() => { void onBackToUniversity(); }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.56)',
                    opacity: finishing || savingProfile ? 0.5 : 1,
                  }}
                >
                  <Ionicons name="chevron-back" size={18} color={slideAccent} />
                </TouchableOpacity>
              ) : null}
              <Text style={{ fontSize: 11, fontWeight: '900', letterSpacing: 1.4, color: slideAccent, textTransform: 'uppercase' }}>
                {slide.eyebrow}
              </Text>
            </View>
            {canSkip ? (
              <TouchableOpacity
                disabled={finishing || savingProfile}
                onPress={() => {
                  if (slide.kind === 'tour') {
                    setIndex(SLIDES.length - 1);
                    return;
                  }
                  if (slide.kind === 'notifications') {
                    void completeNotifications(false);
                    return;
                  }
                  void onFinish();
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.55)' : PALETTE.inkMuted, opacity: finishing ? 0.5 : 1 }}>
                  Skip
                </Text>
              </TouchableOpacity>
            ) : <View style={{ width: 34 }} />}
          </View>
          <ProgressBar index={index} accent={slideAccent} isDark={isDark} />
        </View>

        <Animated.ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: tourScrollY } } }],
            { useNativeDriver: true }
          )}
          contentContainerStyle={{
            flexGrow: isPhotoSlide ? 1 : undefined,
            justifyContent: isPhotoSlide ? 'center' : undefined,
            paddingHorizontal: 24,
            paddingTop: isPhotoSlide ? 0 : 18,
            paddingBottom: isPhotoSlide ? 0 : slide.kind === 'tour' ? 96 : slide.kind === 'notifications' ? 18 : 24,
          }}
        >
          <Animated.View style={animatedStyle}>
            {isPhotoSlide ? (
              <>
                <Animated.Text
                  style={{
                    fontSize: 44,
                    lineHeight: 48,
                    fontWeight: '900',
                    color: colors.text,
                    letterSpacing: -1.4,
                    ...heroTitleStyle,
                  }}
                >
                  {slideTitle}
                </Animated.Text>
                <Animated.Text style={{ fontSize: 16, lineHeight: 24, color: colors.textSecondary, marginTop: 14, fontWeight: '600', ...heroBodyStyle }}>
                  {slideBody}
                </Animated.Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 29, lineHeight: 34, fontWeight: '900', color: colors.text, letterSpacing: -0.8 }}>
                  {slideTitle}
                </Text>
                <Text style={{ fontSize: 15, lineHeight: 23, color: colors.textSecondary, marginTop: 12 }}>
                  {slideBody}
                </Text>
                <PreviewForSlide slide={slide} profile={profile} updateProfile={updateProfile} tourScrollY={tourScrollY} isDark={isDark} />
              </>
            )}
          </Animated.View>
        </Animated.ScrollView>

        <View
          style={{
            paddingHorizontal: 24,
            paddingTop: slide.kind === 'notifications' ? 6 : 12,
            paddingBottom: slide.kind === 'notifications' ? Math.max(insets.bottom, 10) : Math.max(insets.bottom, 16),
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 7, marginBottom: slide.kind === 'notifications' ? 8 : 18 }}>
            {SLIDES.map((item, dotIndex) => {
              const active = dotIndex === index;
              const disabled = dotIndex > index && (
                (dotIndex >= 2 && !canContinueNames) ||
                (dotIndex >= 3 && !canContinueProfile) ||
                (dotIndex >= 4 && !profileSaved)
              );
              return (
                <TouchableOpacity
                  key={item.eyebrow}
                  disabled={finishing || savingProfile || disabled}
                  onPress={() => setIndex(dotIndex)}
                  style={{
                    width: active ? 24 : 7,
                    height: 7,
                    borderRadius: 999,
                    backgroundColor: active ? slideAccent : isDark ? 'rgba(255,255,255,0.16)' : 'rgba(134,148,178,0.32)',
                    opacity: disabled ? 0.35 : 1,
                  }}
                />
              );
            })}
          </View>

          {slide.kind === 'notifications' ? (
            <>
              <View style={{ gap: 10 }}>
                <PrimaryButton
                  onPress={() => { void goNext(); }}
                  accent={slideAccent}
                  loading={finishing || savingProfile}
                  disabled={isBlocked}
                  compact
                >
                  Enable Notifications
                </PrimaryButton>
                <TouchableOpacity
                  disabled={finishing || savingProfile}
                  onPress={() => { void completeNotifications(false); }}
                  style={{
                    minHeight: 48,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: isDark ? PALETTE.borderDark : PALETTE.border,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: finishing || savingProfile ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>Not now</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                disabled={finishing || savingProfile}
                onPress={() => setIndex((current) => Math.max(0, current - 1))}
                style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 2, opacity: finishing || savingProfile ? 0.5 : 1 }}
              >
                <Text style={{ color: colors.textTertiary, fontSize: 13, fontWeight: '700' }}>Back</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {index > 0 ? (
                <TouchableOpacity
                  disabled={finishing || savingProfile}
                  onPress={() => setIndex((current) => Math.max(0, current - 1))}
                  style={{
                    flex: 0.38,
                    minHeight: 56,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: isDark ? PALETTE.borderDark : PALETTE.border,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: finishing || savingProfile ? 0.5 : 1,
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>Back</Text>
                </TouchableOpacity>
              ) : null}

              <View style={{ flex: index > 0 ? 0.62 : 1 }}>
                <PrimaryButton
                  onPress={() => { void goNext(); }}
                  accent={slideAccent}
                  loading={finishing || savingProfile}
                  disabled={isBlocked}
                >
                  {savingProfile
                    ? 'Saving...'
                    : slide.kind === 'names' && !canContinueNames
                      ? 'Fill required fields'
                      : slide.kind === 'profile' && !canContinueProfile
                        ? 'Choose year and major'
                        : index === 0
                          ? 'Walk in'
                          : 'Continue'}
                </PrimaryButton>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

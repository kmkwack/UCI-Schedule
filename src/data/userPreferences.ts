export type EditableProfile = {
  firstName: string;
  middleName: string;
  lastName: string;
  nickname: string;
  email: string;
  year: string;
  major: string;
  gender: string;
  dateOfBirth: string;
};

export type TimetableVisibility = 'friends' | 'private' | 'public';

export type NotificationPreferences = {
  pushNotifications: boolean;
  emailNotifications: boolean;
  classReminders: boolean;
  classReminderMinutes: number;
  sportsGameReminders: boolean;
  sportsGameReminderMinutes: number;
  friendRequests: boolean;
  comments: boolean;
  messages: boolean;
};

export type PushPermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export type UserSettingsState = {
  timetableVisibility: TimetableVisibility;
  boardProfileVisible: boolean;
  notifications: NotificationPreferences;
  pushPermissionStatus: PushPermissionStatus;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushNotifications: false,
  emailNotifications: true,
  classReminders: true,
  classReminderMinutes: 10,
  sportsGameReminders: true,
  sportsGameReminderMinutes: 30,
  friendRequests: true,
  comments: true,
  messages: true,
};

export const DEFAULT_USER_SETTINGS: UserSettingsState = {
  timetableVisibility: 'friends',
  boardProfileVisible: false,
  notifications: DEFAULT_NOTIFICATION_PREFERENCES,
  pushPermissionStatus: 'undetermined',
};

function prettifyNamePart(part: string) {
  if (!part) return '';
  return part.charAt(0).toUpperCase() + part.slice(1);
}

export function splitName(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', middleName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], middleName: '', lastName: '' };
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

export function fallbackProfileFromEmail(email: string): EditableProfile {
  const localPart = (email.split('@')[0] ?? 'student').trim();
  const nameParts = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map(prettifyNamePart);
  const firstName = nameParts[0] ?? 'Student';
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

  return {
    firstName,
    middleName: '',
    lastName,
    nickname: firstName,
    email,
    year: 'Junior',
    major: 'Undeclared',
    gender: 'Prefer not to say',
    dateOfBirth: '',
  };
}

export function composeFullName(profile: Pick<EditableProfile, 'firstName' | 'middleName' | 'lastName'>) {
  return [profile.firstName, profile.middleName, profile.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

export function buildDisplayName(profile: EditableProfile) {
  const fullName = composeFullName(profile);
  return fullName || profile.nickname.trim() || emailName(profile.email);
}

export function emailName(email: string) {
  return (email.split('@')[0] ?? 'student').trim() || 'student';
}

export function profileDetailsFromProfile(profile: EditableProfile, boardProfileVisible = false) {
  return {
    firstName: profile.firstName,
    middleName: profile.middleName,
    lastName: profile.lastName,
    nickname: profile.nickname,
    gender: profile.gender,
    dateOfBirth: profile.dateOfBirth,
    boardProfileVisible,
  };
}

export function profileFromSources(
  row: Record<string, any> | null | undefined,
  email: string,
  details?: Record<string, any> | null
): EditableProfile {
  const fallback = fallbackProfileFromEmail(email);
  const split = splitName(typeof row?.name === 'string' ? row.name : '');

  return {
    firstName: typeof details?.firstName === 'string' ? details.firstName : split.firstName || fallback.firstName,
    middleName: typeof details?.middleName === 'string' ? details.middleName : split.middleName,
    lastName: typeof details?.lastName === 'string' ? details.lastName : split.lastName || fallback.lastName,
    nickname: typeof details?.nickname === 'string' ? details.nickname : fallback.nickname,
    email,
    year: typeof row?.year === 'string' && row.year.trim() ? row.year : fallback.year,
    major: typeof row?.major === 'string' && row.major.trim() ? row.major : fallback.major,
    gender: typeof details?.gender === 'string' && details.gender.trim() ? details.gender : fallback.gender,
    dateOfBirth: typeof details?.dateOfBirth === 'string' ? details.dateOfBirth : '',
  };
}

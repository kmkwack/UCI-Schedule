export type UciDiningLocationKey = 'the-anteatery' | 'brandywine';

export type UciDiningMealWindow = {
  label: string;
  startMinutes: number;
  endMinutes: number;
  timeLabel: string;
};

export type UciDiningSummary = {
  id: string;
  key: UciDiningLocationKey;
  name: string;
  detailsUrl: string;
  isOpen: boolean | null;
  statusLabel: string;
  statusDetail: string;
  todayMeals: UciDiningMealWindow[];
  scheduleName?: string;
};

type UciDiningSchedule = {
  name?: string;
  type?: string;
  start_date?: string;
  end_date?: string;
  // API returns "meal_periods" with "meal_period" as the name field
  meal_periods?: Array<{
    meal_period?: string;
    opening_hours?: string;
  }>;
  // Legacy field name (kept for safety)
  meal_period?: Array<{
    label?: string;
    opening_hours?: string;
  }>;
};

type UciDiningLocationRow = {
  commerceAttributes?: {
    uid?: string;
    url_key?: string;
    timezone?: string;
  };
  aemAttributes?: {
    name?: string;
    hoursOfOperation?: {
      schedule?: UciDiningSchedule[];
    };
  };
};

type DiningDateParts = {
  dateKey: number;
  dayCode: string;
  minutes: number;
};

const UCI_DINING_GRAPHQL_URL = 'https://api.elevate-dxp.com/api/mesh/c087f756-cc72-4649-a36f-3a41b700c519/graphql';
export const UCI_DINING_LOCATIONS_URL = 'https://uci.mydininghub.com/en/locations';
export const UCI_DINING_LOCATION_URL = 'https://uci.mydininghub.com/en/location';
const UCI_DINING_TIME_ZONE = 'America/Los_Angeles';
const TARGET_DINING_LOCATION_KEYS: UciDiningLocationKey[] = ['the-anteatery', 'brandywine'];
const DINING_DAY_ORDER = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const WEEKDAY_TO_DINING_DAY: Record<string, string> = {
  Mon: 'Mo',
  Tue: 'Tu',
  Wed: 'We',
  Thu: 'Th',
  Fri: 'Fr',
  Sat: 'Sa',
  Sun: 'Su',
};

const UCI_DINING_LOCATIONS_QUERY = `
  query getLocations($campus_url_key: String!) {
    getLocations(campusUrlKey: $campus_url_key) {
      commerceAttributes {
        uid
        url_key
        timezone
      }
      aemAttributes {
        name
        hoursOfOperation {
          schedule
        }
      }
    }
  }
`;

const UCI_DINING_HEADERS = {
  'content-type': 'application/json',
  'X-Api-Key': 'ElevateAPIProd',
  'magento-store-code': 'ch_uci',
  'magento-website-code': 'ch_uci',
  'magento-store-view-code': 'ch_uci_en',
  Store: 'ch_uci_en',
  'magento-customer-group': 'b6589fc6ab0dc82cf12099d1c2d40ab994e8410c',
  'AEM-Elevate-ClientPath': 'ch/uci/en',
};

function buildDiningGraphqlUrl() {
  const params = new URLSearchParams({
    operationName: 'getLocations',
    variables: JSON.stringify({ campus_url_key: 'campus' }),
    query: UCI_DINING_LOCATIONS_QUERY,
  });
  return `${UCI_DINING_GRAPHQL_URL}?${params.toString()}`;
}

function isoDateKey(value: string | undefined): number | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return Number(`${match[1]}${match[2]}${match[3]}`);
}

function getDiningDateParts(now: Date, timeZone = UCI_DINING_TIME_ZONE): DiningDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value])
  );
  const hour = Number(parts.hour === '24' ? '0' : parts.hour ?? '0');
  const minute = Number(parts.minute ?? '0');
  const weekday = WEEKDAY_TO_DINING_DAY[parts.weekday ?? ''] ?? DINING_DAY_ORDER[now.getDay() === 0 ? 6 : now.getDay() - 1];

  return {
    dateKey: Number(`${parts.year}${parts.month}${parts.day}`),
    dayCode: weekday,
    minutes: hour * 60 + minute,
  };
}

function scheduleIncludesDate(schedule: UciDiningSchedule, dateKey: number) {
  const startKey = isoDateKey(schedule.start_date);
  const endKey = isoDateKey(schedule.end_date);
  return (startKey === null || dateKey >= startKey) && (endKey === null || dateKey <= endKey);
}

function scheduleSpan(schedule: UciDiningSchedule) {
  const startKey = isoDateKey(schedule.start_date) ?? 0;
  const endKey = isoDateKey(schedule.end_date) ?? 99999999;
  return endKey - startKey;
}

function getActiveSchedule(schedules: UciDiningSchedule[], dateKey: number): UciDiningSchedule | null {
  const activeSchedules = schedules.filter((schedule) => scheduleIncludesDate(schedule, dateKey));
  const activeSpecial = activeSchedules
    .filter((schedule) => schedule.type?.toLowerCase() === 'special')
    .sort((left, right) => scheduleSpan(left) - scheduleSpan(right))[0];
  if (activeSpecial) return activeSpecial;

  const activeStandard = activeSchedules.find((schedule) => schedule.type?.toLowerCase() === 'standard');
  if (activeStandard) return activeStandard;

  return schedules.find((schedule) => schedule.type?.toLowerCase() === 'standard') ?? activeSchedules[0] ?? null;
}

function normalizeDiningDay(value: string) {
  const cleaned = value.trim();
  const aliases: Record<string, string> = {
    M: 'Mo',
    Mo: 'Mo',
    Mon: 'Mo',
    T: 'Tu',
    Tu: 'Tu',
    Tue: 'Tu',
    W: 'We',
    We: 'We',
    Wed: 'We',
    Th: 'Th',
    Thu: 'Th',
    F: 'Fr',
    Fr: 'Fr',
    Fri: 'Fr',
    Sa: 'Sa',
    Sat: 'Sa',
    Su: 'Su',
    Sun: 'Su',
  };
  return aliases[cleaned] ?? cleaned;
}

function dayExpressionCovers(dayExpression: string, targetDay: string) {
  const normalizedExpression = dayExpression.trim();
  if (/^(daily|everyday|all)$/i.test(normalizedExpression)) return true;

  return normalizedExpression.split(',').some((part) => {
    const token = part.trim();
    const rangeMatch = token.match(/^([A-Za-z]+)-([A-Za-z]+)$/);
    if (!rangeMatch) return normalizeDiningDay(token) === targetDay;

    const startIndex = DINING_DAY_ORDER.indexOf(normalizeDiningDay(rangeMatch[1]));
    const endIndex = DINING_DAY_ORDER.indexOf(normalizeDiningDay(rangeMatch[2]));
    const targetIndex = DINING_DAY_ORDER.indexOf(targetDay);
    if (startIndex < 0 || endIndex < 0 || targetIndex < 0) return false;
    if (startIndex <= endIndex) return targetIndex >= startIndex && targetIndex <= endIndex;
    return targetIndex >= startIndex || targetIndex <= endIndex;
  });
}

function toMinutes(hour: string, minute: string) {
  return Number(hour) * 60 + Number(minute);
}

function formatDiningTime(minutes: number) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
}

function formatDiningRange(startMinutes: number, endMinutes: number) {
  return `${formatDiningTime(startMinutes)}-${formatDiningTime(endMinutes)}`;
}

function parseOpeningHoursForDay(openingHours: string | undefined, dayCode: string) {
  if (!openingHours) return [];

  return openingHours
    .split(';')
    .map((segment) => segment.trim())
    .flatMap((segment) => {
      const firstSpaceIndex = segment.search(/\s/);
      if (firstSpaceIndex < 0) return [];
      const dayExpression = segment.slice(0, firstSpaceIndex).trim();
      const timeExpression = segment.slice(firstSpaceIndex).trim();
      if (!dayExpressionCovers(dayExpression, dayCode) || /\boff\b/i.test(timeExpression)) return [];

      const windows: Array<{ startMinutes: number; endMinutes: number }> = [];
      const timePattern = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g;
      for (const match of timeExpression.matchAll(timePattern)) {
        windows.push({
          startMinutes: toMinutes(match[1], match[2]),
          endMinutes: toMinutes(match[3], match[4]),
        });
      }
      return windows;
    });
}

function summarizeDiningLocation(location: UciDiningLocationRow, now: Date): UciDiningSummary | null {
  const key = location.commerceAttributes?.url_key as UciDiningLocationKey | undefined;
  if (!key || !TARGET_DINING_LOCATION_KEYS.includes(key)) return null;

  const timezone = location.commerceAttributes?.timezone ?? UCI_DINING_TIME_ZONE;
  const dateParts = getDiningDateParts(now, timezone);
  const schedule = getActiveSchedule(location.aemAttributes?.hoursOfOperation?.schedule ?? [], dateParts.dateKey);
  // API returns "meal_periods" with "meal_period" as name; fall back to legacy "meal_period" with "label"
  const rawMealPeriods: Array<{ label: string; opening_hours?: string }> = [
    ...(schedule?.meal_periods ?? []).map((mp) => ({ label: mp.meal_period?.trim() ?? '', opening_hours: mp.opening_hours })),
    ...(schedule?.meal_period ?? []).map((mp) => ({ label: mp.label?.trim() ?? '', opening_hours: mp.opening_hours })),
  ];

  const todayMeals = rawMealPeriods
    .flatMap((mealPeriod) => {
      if (!mealPeriod.label) return [];
      return parseOpeningHoursForDay(mealPeriod.opening_hours, dateParts.dayCode).map((window) => ({
        label: mealPeriod.label,
        startMinutes: window.startMinutes,
        endMinutes: window.endMinutes,
        timeLabel: formatDiningRange(window.startMinutes, window.endMinutes),
      }));
    })
    .sort((left, right) => left.startMinutes - right.startMinutes);

  const currentMeal = todayMeals.find((meal) => dateParts.minutes >= meal.startMinutes && dateParts.minutes < meal.endMinutes);
  const nextMeal = todayMeals.find((meal) => dateParts.minutes < meal.startMinutes);
  const statusLabel = currentMeal ? 'Open now' : nextMeal ? 'Opens later' : todayMeals.length > 0 ? 'Closed for today' : 'Hours unavailable';
  const statusDetail = currentMeal
    ? `${currentMeal.label} until ${formatDiningTime(currentMeal.endMinutes)}`
    : nextMeal
      ? `${nextMeal.label} ${nextMeal.timeLabel}`
      : todayMeals.length > 0
        ? `Last meal ended at ${formatDiningTime(todayMeals[todayMeals.length - 1].endMinutes)}`
        : 'Tap for official dining details';

  return {
    id: location.commerceAttributes?.uid ?? key,
    key,
    name: location.aemAttributes?.name?.trim() || (key === 'the-anteatery' ? 'The Anteatery' : 'Brandywine'),
    detailsUrl: `${UCI_DINING_LOCATION_URL}/${key}`,
    isOpen: currentMeal ? true : todayMeals.length > 0 ? false : null,
    statusLabel,
    statusDetail,
    todayMeals,
    scheduleName: schedule?.name,
  };
}

export async function fetchUciDiningSummaries(now = new Date()): Promise<UciDiningSummary[]> {
  const response = await fetch(buildDiningGraphqlUrl(), {
    method: 'GET',
    headers: UCI_DINING_HEADERS,
  });
  if (!response.ok) {
    throw new Error(`UCI Dining returned ${response.status}`);
  }

  const json = await response.json();
  const rows = (json?.data?.getLocations ?? []) as UciDiningLocationRow[];
  const summaries = rows
    .map((location) => summarizeDiningLocation(location, now))
    .filter((summary): summary is UciDiningSummary => Boolean(summary));

  return TARGET_DINING_LOCATION_KEYS
    .map((key) => summaries.find((summary) => summary.key === key))
    .filter((summary): summary is UciDiningSummary => Boolean(summary));
}

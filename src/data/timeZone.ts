export type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function deviceTimeZoneFallback() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles';
  } catch {
    return 'America/Los_Angeles';
  }
}

export function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(value: unknown, fallback: string = deviceTimeZoneFallback()) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (candidate && candidate !== 'auto' && isValidTimeZone(candidate)) return candidate;
  if (fallback && fallback !== 'auto' && isValidTimeZone(fallback)) return fallback;
  return deviceTimeZoneFallback();
}

function getPartsFormatter(timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: normalizeTimeZone(timeZone),
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function getZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const parts = getPartsFormatter(timeZone).formatToParts(date);
  const valueFor = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: valueFor('year'),
    month: valueFor('month'),
    day: valueFor('day'),
    hour: valueFor('hour'),
    minute: valueFor('minute'),
    second: valueFor('second'),
  };
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getZonedDateParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

export function zonedDateFromParts(parts: ZonedDateParts, timeZone: string) {
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const firstPass = new Date(utcGuess - timeZoneOffsetMs(new Date(utcGuess), timeZone));
  return new Date(utcGuess - timeZoneOffsetMs(firstPass, timeZone));
}

export function addZonedDays(date: Date, days: number, timeZone: string) {
  const parts = getZonedDateParts(date, timeZone);
  return zonedDateFromParts({ ...parts, day: parts.day + days }, timeZone);
}

export function zonedWeekdayIndex(date: Date, timeZone: string) {
  const parts = getZonedDateParts(date, timeZone);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

export function zonedDateKey(date: Date, timeZone: string) {
  const parts = getZonedDateParts(date, timeZone);
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
}

export function formatDateInTimeZone(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
) {
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: normalizeTimeZone(timeZone) }).format(date);
}

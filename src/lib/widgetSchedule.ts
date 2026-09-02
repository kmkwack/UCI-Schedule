/**
 * Builds the payload the iOS widget reads out of the shared App Group.
 *
 * The widget has no network access, so it can only show what the app has
 * already handed it. We store the term's *recurring weekly pattern* rather
 * than a list of dated occurrences: the widget then derives "today" and "next
 * class" itself and stays correct for the whole term, even if the user doesn't
 * reopen the app for weeks. A dated list would go stale immediately.
 *
 * The Swift side that consumes this is ios/ClassMateWidget/ScheduleData.swift.
 * The two structures must be changed together.
 */

import { Course, parseTimeToMinutes, parseCourseDays, DAY_TOKEN_TO_WEEKDAY } from '../data/courses';
import { getTermEndDate, getTermStartDate } from '../data/academicCalendar';
import { pastelForCourse, blockColorKey } from '../data/courses';

export const WIDGET_SCHEDULE_VERSION = 1;

export type WidgetClass = {
  id: string;
  code: string;
  title: string;
  /** 0 = Sunday, matching Swift's Calendar.component(.weekday) - 1 */
  weekday: number;
  startMinutes: number;
  endMinutes: number;
  location: string | null;
  /** The app's pastel triple, so the widget renders identical colours rather
   *  than re-deriving a tint from a solid hex (which came out neon). */
  bgHex: string;
  textHex: string;
  borderHex: string;
};

export type WidgetSchedulePayload = {
  version: number;
  updatedAt: string;
  school: string;
  termLabel: string;
  /** Instruction start. Without it the widget can't tell "term hasn't begun"
   *  from "term is running", and would present next term's grid as today. */
  termStartDate: string | null;
  termEndDate: string | null;
  classes: WidgetClass[];
};

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Expands courses into one entry per weekday they meet.
 *
 * Courses with no parseable day or time ("TBA", async classes) are dropped:
 * a widget row without a time is worse than no row, since the whole point is
 * knowing when to be somewhere.
 */
export function buildWidgetSchedule(params: {
  courses: Course[];
  school: string;
  termLabel: string;
  quarterKey: string;
}): WidgetSchedulePayload {
  const { courses, school, termLabel, quarterKey } = params;
  const classes: WidgetClass[] = [];

  for (const course of courses) {
    const days = parseCourseDays(course.days);
    if (days.length === 0) continue;

    const [startRaw, endRaw] = String(course.time ?? '').split('-').map((part) => part.trim());
    const startMinutes = parseTimeToMinutes(startRaw);
    const endMinutes = parseTimeToMinutes(endRaw, { allow24HourEnd: true });
    if (startMinutes == null || endMinutes == null) continue;

    const palette = pastelForCourse(blockColorKey(course));

    for (const token of days) {
      const weekday = DAY_TOKEN_TO_WEEKDAY[token];
      if (weekday == null) continue;

      classes.push({
        id: `${course.id}-${token}`,
        code: course.code,
        title: course.title,
        weekday,
        startMinutes,
        endMinutes,
        location: course.location?.trim() || null,
        bgHex: palette.bg,
        textHex: palette.text,
        borderHex: palette.border,
      });
    }
  }

  const termStart = getTermStartDate(school, quarterKey);
  const termEnd = getTermEndDate(school, quarterKey);

  return {
    version: WIDGET_SCHEDULE_VERSION,
    updatedAt: new Date().toISOString(),
    school,
    termLabel,
    termStartDate: termStart ? toIsoDate(termStart) : null,
    termEndDate: termEnd ? toIsoDate(termEnd) : null,
    classes,
  };
}

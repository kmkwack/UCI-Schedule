import type { Course } from './courses';

export type SharedClassMatch = 'same_section' | 'same_course';

function clean(value: string | null | undefined) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function cleanId(course: Pick<Course, 'id'>) {
  return clean(course.id);
}

export function normalizeCourseCode(course: Pick<Course, 'code'>): string {
  return clean(course.code).toUpperCase().replace(/\s+/g, '');
}

export function isCustomCourse(course: Pick<Course, 'id' | 'department' | 'customColor'>) {
  const id = cleanId(course).toLowerCase();
  const department = clean(course.department).toUpperCase();
  return department === 'CUSTOM' || id.startsWith('custom-') || Boolean(course.customColor);
}

export function buildSectionMatchKey(course: Pick<Course, 'id' | 'code' | 'days' | 'time'>): string {
  const id = cleanId(course);
  if (id) return id;
  return `${normalizeCourseCode(course)}|${clean(course.days).toUpperCase()}|${clean(course.time).toUpperCase()}`;
}

export function isSameSection(a: Pick<Course, 'id'>, b: Pick<Course, 'id'>): boolean {
  const aId = cleanId(a);
  const bId = cleanId(b);
  return Boolean(aId && bId && aId === bId);
}

export function isSameCourse(a: Course, b: Course): boolean {
  if (isCustomCourse(a) || isCustomCourse(b)) return false;
  const aCode = normalizeCourseCode(a);
  const bCode = normalizeCourseCode(b);
  return Boolean(aCode && bCode && aCode === bCode);
}

export function getSharedClassMatch(a: Course, b: Course): SharedClassMatch | null {
  if (isSameSection(a, b)) return 'same_section';
  if (isSameCourse(a, b)) return 'same_course';
  return null;
}

/**
 * Pushes the schedule to the iOS home-screen widget.
 *
 * Every function here is best-effort and never throws. Updating a widget is
 * decoration: if it fails, the user still has the app, and an error surfacing
 * from here would interrupt something they actually asked for. Failures are
 * logged and swallowed.
 *
 * The native module only exists in an iOS build that includes the widget
 * extension, so all of this no-ops on Android, in Expo Go, and in any build
 * made before the widget shipped.
 */

import { NativeModules, Platform } from 'react-native';
import { Course } from '../data/courses';
import { buildWidgetSchedule } from './widgetSchedule';

const bridge: {
  setSchedule?: (json: string) => Promise<boolean>;
  clearSchedule?: () => Promise<boolean>;
} | undefined = NativeModules.WidgetBridge;

/** Whether the running binary can talk to a widget at all. */
export function isWidgetSupported(): boolean {
  return Platform.OS === 'ios' && typeof bridge?.setSchedule === 'function';
}

export async function syncWidgetSchedule(params: {
  courses: Course[];
  school: string;
  termLabel: string;
  quarterKey: string;
}): Promise<void> {
  if (!isWidgetSupported()) return;

  try {
    const payload = buildWidgetSchedule(params);
    await bridge!.setSchedule!(JSON.stringify(payload));
  } catch (error) {
    console.warn('Widget schedule sync failed (ignored):', error);
  }
}

/**
 * Wipes the widget. Called on sign-out so the next person to pick up the
 * device doesn't see the previous account's classes on the home screen.
 */
export async function clearWidgetSchedule(): Promise<void> {
  if (Platform.OS !== 'ios' || typeof bridge?.clearSchedule !== 'function') return;

  try {
    await bridge.clearSchedule();
  } catch (error) {
    console.warn('Widget schedule clear failed (ignored):', error);
  }
}

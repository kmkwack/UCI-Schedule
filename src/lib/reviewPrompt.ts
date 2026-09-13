import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

/**
 * Asking for a rating is a one-shot resource: iOS shows the system sheet at
 * most three times a year per user, and a prompt spent on someone who is
 * annoyed costs a one-star review. So it only fires after the app has
 * demonstrably worked for them — a saved or shared schedule, and not the
 * first one.
 *
 * Everything here fails quietly. A rating prompt is never worth an error in
 * front of the user.
 */

const MILESTONES_KEY = 'review.goodMoments';
const ASKED_KEY = 'review.lastAskedAt';

/** Wins before we ask at all. */
const MILESTONES_REQUIRED = 3;

/** iOS silently ignores extra prompts; re-asking sooner just wastes them. */
const MIN_DAYS_BETWEEN_ASKS = 120;

async function readInt(key: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Call at a moment the user just got what they wanted. Counts the win and,
 * once there have been enough of them, asks iOS to show the rating sheet.
 *
 * Whether the sheet actually appears is Apple's call, not ours — treat this
 * as fire-and-forget.
 */
export async function recordGoodMoment(): Promise<void> {
  try {
    const count = (await readInt(MILESTONES_KEY)) + 1;
    await AsyncStorage.setItem(MILESTONES_KEY, String(count));
    if (count < MILESTONES_REQUIRED) return;

    const lastAsked = await readInt(ASKED_KEY);
    const daysSince = (Date.now() - lastAsked) / 86_400_000;
    if (lastAsked && daysSince < MIN_DAYS_BETWEEN_ASKS) return;

    if (!(await StoreReview.hasAction())) return;

    await AsyncStorage.setItem(ASKED_KEY, String(Date.now()));
    // Let the success alert or share sheet finish dismissing first; two
    // system dialogs racing each other means neither gets read.
    setTimeout(() => {
      StoreReview.requestReview().catch(() => {});
    }, 1200);
  } catch {
    // Never surface a failure here.
  }
}

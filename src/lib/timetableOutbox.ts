import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Timetable } from '../data/courses';

/**
 * Edits made with no connection, held until there is one.
 *
 * Without this, an offline edit alerted "could not sync" on every change and
 * was then silently replaced by the server copy on the next load — the user was
 * told, but the work was still lost. Campus wifi drops often enough that this
 * is ordinary use, not an edge case.
 *
 * Each entry is a whole timetable row, keyed by its id, so re-queuing an edit
 * replaces the earlier one rather than stacking deltas: the last state of a
 * timetable is the only one worth sending. For a single user editing their own
 * schedule, last-write-wins is the correct resolution — the loser is an older
 * version of the same person's edit.
 */

const PREFIX = 'timetable_outbox_v1:';

const outboxKey = (userId: string, school: string) => `${PREFIX}${userId}:${school}`;

type Outbox = Record<string, Timetable>;

async function read(userId: string, school: string): Promise<Outbox> {
  try {
    const raw = await AsyncStorage.getItem(outboxKey(userId, school));
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Outbox;
  } catch (error) {
    console.warn('Discarding unreadable timetable outbox:', error);
  }
  return {};
}

async function write(userId: string, school: string, outbox: Outbox) {
  try {
    if (Object.keys(outbox).length === 0) {
      await AsyncStorage.removeItem(outboxKey(userId, school));
    } else {
      await AsyncStorage.setItem(outboxKey(userId, school), JSON.stringify(outbox));
    }
  } catch (error) {
    console.warn('Failed to persist timetable outbox:', error);
  }
}

export async function enqueueTimetableSave(userId: string, school: string, timetable: Timetable) {
  if (!userId) return;
  const outbox = await read(userId, school);
  outbox[timetable.id] = timetable;
  await write(userId, school, outbox);
}

/**
 * Sends everything queued. `send` returns an error when the row did not land;
 * entries that fail stay queued for the next attempt, so a still-dead network
 * costs nothing. Returns how many rows were accepted.
 */
export async function flushTimetableOutbox(
  userId: string,
  school: string,
  send: (timetable: Timetable) => Promise<{ error: unknown } | void>
): Promise<number> {
  if (!userId) return 0;
  const outbox = await read(userId, school);
  const ids = Object.keys(outbox);
  if (ids.length === 0) return 0;

  let sent = 0;
  for (const id of ids) {
    try {
      const result = await send(outbox[id]);
      if (result && result.error) continue;
      delete outbox[id];
      sent += 1;
    } catch (error) {
      console.warn('Timetable outbox entry failed to send:', error);
    }
  }
  await write(userId, school, outbox);
  return sent;
}

export async function hasQueuedTimetableSaves(userId: string, school: string): Promise<boolean> {
  if (!userId) return false;
  return Object.keys(await read(userId, school)).length > 0;
}

/** Sign-out: drop every user's queue, since the id may already be gone. */
export async function clearTimetableOutboxes() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((key) => key.startsWith(PREFIX));
    if (mine.length > 0) await AsyncStorage.multiRemove(mine);
  } catch (error) {
    console.warn('Failed to clear timetable outboxes:', error);
  }
}

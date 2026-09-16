import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Campus wifi drops constantly, and almost every screen in this app reads from
 * Supabase. Without this the failure looks like the app being broken: spinners
 * that never resolve, lists that stay empty, no explanation and nothing to tap.
 */

/**
 * True only when the device has a connection that actually reaches the
 * internet. `isConnected` alone is not enough — a captive portal (which is what
 * campus wifi looks like before you accept the terms) reports a live connection
 * that carries no traffic.
 *
 * `isInternetReachable` is null until the first probe resolves; treat that as
 * online so a cold launch never flashes an offline banner at someone who is
 * perfectly connected.
 */
export function useIsOffline(): boolean {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const reachable = state.isInternetReachable;
      setOffline(state.isConnected === false || reachable === false);
    });
    return unsubscribe;
  }, []);

  return offline;
}

/** One-shot check, for deciding whether a request is even worth attempting. */
export async function isOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected !== false && state.isInternetReachable !== false;
  } catch {
    // If we cannot tell, assume online: a false offline verdict would block
    // requests that would have worked.
    return true;
  }
}

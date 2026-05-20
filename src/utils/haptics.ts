import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

async function runHaptic(effect: () => Promise<void>) {
  if (Platform.OS === 'web') return;
  try {
    await effect();
  } catch {
    // Haptics can be unavailable on simulators or low-power devices.
  }
}

export function triggerSelectionHaptic() {
  void runHaptic(() => Haptics.selectionAsync());
}

export function triggerLightHaptic() {
  void runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function triggerSuccessHaptic() {
  void runHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function triggerWarningHaptic() {
  void runHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

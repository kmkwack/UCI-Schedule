import { useEffect, useMemo, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

type KeyboardInsetOptions = {
  enabled?: boolean;
  bottomInset?: number;
  subtractBottomInset?: boolean;
};

export function useKeyboardInset({
  enabled = true,
  bottomInset = 0,
  subtractBottomInset = false,
}: KeyboardInsetOptions = {}) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setKeyboardHeight(0);
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(Math.max(event.endCoordinates?.height ?? 0, 0));
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [enabled]);

  return useMemo(() => {
    const visible = enabled && keyboardHeight > 0;
    const lift = visible
      ? Math.max(keyboardHeight - (subtractBottomInset ? bottomInset : 0), 0)
      : 0;

    return {
      visible,
      height: visible ? keyboardHeight : 0,
      lift,
      footerPaddingBottom(closedPadding: number, openPadding = 12) {
        return (visible ? openPadding : closedPadding) + lift;
      },
      scrollPaddingBottom(basePadding: number, openExtra = 24) {
        return basePadding + (visible ? lift + openExtra : 0);
      },
      androidBottomSheetMarginBottom(extraGap = 0) {
        return Platform.OS === 'android' && visible ? lift + extraGap : 0;
      },
      bottomSheetMaxHeight(maxHeight: number, windowHeight: number, topGap = 24, minHeight = 260) {
        if (!visible) return maxHeight;
        const availableHeight = Math.max(minHeight, windowHeight - lift - topGap);
        return Math.min(maxHeight, availableHeight);
      },
    };
  }, [bottomInset, enabled, keyboardHeight, subtractBottomInset]);
}

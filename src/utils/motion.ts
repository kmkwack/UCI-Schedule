import { Easing } from 'react-native';

export const SCREEN_ANIMATION = 240;
export const HERO_ANIMATION = 260;
export const CONTENT_ANIMATION = 220;
export const FAST_ANIMATION = 180;
export const BACKDROP_DURATION = 260;
export const BACKDROP_EXIT_DURATION = 220;
export const SHEET_IN_DURATION = 260;
export const SHEET_OUT_DURATION = 220;
export const SHEET_INITIAL_TRANSLATE_Y = 600;
export const SHEET_DRAG_DISMISS_DISTANCE = 80;
export const SHEET_DRAG_DISMISS_VELOCITY = 0.8;
export const SHEET_CORNER_RADIUS = 24;
export const HORIZONTAL_SWIPE_ACTIVATION_DX = 9;
export const HORIZONTAL_SWIPE_DOMINANCE_RATIO = 1.25;

export const SHEET_SPRING = { tension: 100, friction: 16 } as const;
export const SHEET_RESET_SPRING = { tension: 100, friction: 16 } as const;
export const CARD_SPRING = { tension: 160, friction: 18 } as const;
export const PRESS_SPRING = { tension: 300, friction: 10 } as const;
export const DESTRUCTIVE_SPRING = { tension: 220, friction: 20 } as const;

export const MOTION = {
  duration: {
    screen: SCREEN_ANIMATION,
    hero: HERO_ANIMATION,
    content: CONTENT_ANIMATION,
    contentFast: FAST_ANIMATION,
    sheetIn: SHEET_IN_DURATION,
    sheetOut: SHEET_OUT_DURATION,
    destructive: 150,
  },
  easing: {
    standard: Easing.out(Easing.cubic),
    exit: Easing.in(Easing.cubic),
    soft: Easing.out(Easing.quad),
  },
  spring: {
    screen: SHEET_SPRING,
    sheet: SHEET_SPRING,
    sheetReset: SHEET_RESET_SPRING,
    snap: CARD_SPRING,
    press: PRESS_SPRING,
    destructive: DESTRUCTIVE_SPRING,
  },
  content: {
    enterY: 10,
    stagger: 45,
  },
} as const;

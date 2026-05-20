import { Easing } from 'react-native';

export const MOTION = {
  duration: {
    screen: 240,
    hero: 260,
    content: 220,
    contentFast: 180,
    sheetIn: 260,
    sheetOut: 220,
    destructive: 150,
  },
  easing: {
    standard: Easing.out(Easing.cubic),
    exit: Easing.in(Easing.cubic),
    soft: Easing.out(Easing.quad),
  },
  spring: {
    screen: { tension: 100, friction: 16 },
    sheet: { tension: 100, friction: 16 },
    snap: { tension: 160, friction: 18 },
    press: { tension: 300, friction: 10 },
    destructive: { tension: 220, friction: 20 },
  },
  content: {
    enterY: 10,
    stagger: 45,
  },
} as const;

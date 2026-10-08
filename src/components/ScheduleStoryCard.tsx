import React, { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

// 9:16 Instagram Story card (390 × 693 pt, captured @3x with react-native-view-shot).
// Spec: "Solid Tiles" direction — one frame, hairline hour rules, solid course
// fills, course number as the hero. All sizes below are fixed pt values.

export type StoryBlock = {
  day: string; // must match an entry in `days`, e.g. 'Mon'
  start: string | number; // 'HH:mm' (24h) or minutes since midnight
  end: string | number;
  code: string; // 'COMPSCI 161'
  room: string;
  color: string; // hex fill
  label?: string; // custom blocks ("Tennis Club"): shown as typed instead of dept/number
  textColor?: string; // when given (the app's own block colors), used as-is
  borderColor?: string;
};

export type ScheduleStoryCardProps = {
  school: string;
  term: string;
  unitsLabel: string;
  days: string[];
  startHour: number;
  endHour: number;
  blocks: StoryBlock[];
  dark?: boolean;
};

// Solid, white-text-safe fills (all ≥ 4.5:1 with #FFFFFF).
export const STORY_PALETTE = ['#2F5BEA', '#C2410C', '#0B7A55', '#7C3AED', '#C81E6A', '#0E7490', '#B45309', '#475569'];

const CARD_W = 390;
const CARD_H = 693;
const GUTTER = 24;
const COL_GAP = 4;
const BODY_H = 549; // drawable hour area: fills the canvas now that there is no footer
const BODY_INSET = 12; // keeps the last class off the bottom edge
const MIN_TEXT = 8;
// One gap between every line in a block (dept, number, room, time).
const META_GAP = 1;
const CONTENT_W = 350; // 390 minus 20pt side padding
// Rough advance width per character, as a fraction of font size, for each role.
// Used instead of adjustsFontSizeToFit, which with a fixed lineHeight can collapse text to ~3pt.
const CHAR_W = { dept: 0.68, num: 0.64, room: 0.62, time: 0.66 };

const THEMES = {
  light: { bg: '#FAFAF7', ink: '#111318', muted: '#6B6F76', line: 'rgba(17,19,24,0.07)', pillBg: '#111318', pillInk: '#FFFFFF' },
  dark: { bg: '#0E0F12', ink: '#F4F4F2', muted: '#8B8F98', line: 'rgba(255,255,255,0.08)', pillBg: '#F4F4F2', pillInk: '#0E0F12' },
};

// One scale per image, never per block, so every block matches.
const SCALES = {
  regular: { padT: 6, padX: 6, radius: 8, dept: 9, deptLh: 11, num: 16, numLh: 17, meta: 9, metaLh: 11 },
  compact: { padT: 4, padX: 4, radius: 6, dept: 8, deptLh: 10, num: 13, numLh: 14, meta: 8, metaLh: 10 },
};

export function toMinutes(value: string | number): number {
  if (typeof value === 'number') return value;
  const [h, m] = value.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// First class's hour → one past the last end (+10 min so a class ending on
// the hour doesn't sit on the last line), at least 6 hours.
export function getStoryHourRange(blocks: Pick<StoryBlock, 'start' | 'end'>[]): { startHour: number; endHour: number } {
  if (blocks.length === 0) return { startHour: 9, endHour: 17 };
  let startHour = Math.floor(Math.min(...blocks.map((b) => toMinutes(b.start))) / 60);
  // A class ending on the hour ends the grid there; BODY_INSET keeps it off the edge.
  let endHour = Math.min(24, Math.ceil(Math.max(...blocks.map((b) => toMinutes(b.end))) / 60));
  while (endHour - startHour < 6) {
    if (endHour < 22) endHour += 1;
    else if (startHour > 0) startHour -= 1;
    else break;
  }
  return { startHour, endHour };
}

function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 12 || 12;
  return `${h}:${String(minutes % 60).padStart(2, '0')}`;
}

function luminance(hex: string): number {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.slice(0, 6);
  const channel = (i: number) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

// White or ink, whichever contrasts more with the fill — lets light app colors work too.
function textOn(fill: string): string {
  const l = luminance(fill);
  if (Number.isNaN(l)) return '#FFFFFF';
  return 1.05 / (l + 0.05) >= (l + 0.05) / (luminance('#111318') + 0.05) ? '#FFFFFF' : '#111318';
}

function splitCode(code: string): { dept: string; num: string } {
  const i = code.trim().lastIndexOf(' ');
  return i > 0 ? { dept: code.slice(0, i), num: code.slice(i + 1) } : { dept: '', num: code };
}

const ScheduleStoryCard = forwardRef<View, ScheduleStoryCardProps>(function ScheduleStoryCard(
  { school, term, unitsLabel, days, startHour, endHour, blocks, dark = false },
  ref,
) {
  const t = dark ? THEMES.dark : THEMES.light;
  const span = Math.max(1, endHour - startHour);
  const ppm = BODY_H / (span * 60);
  const scale = ppm * 50 >= 40 ? SCALES.regular : SCALES.compact;
  const rangeStart = startHour * 60;
  const rangeEnd = endHour * 60;

  const laid = blocks
    .filter((b) => days.includes(b.day))
    .map((b) => {
      const s = Math.max(rangeStart, Math.min(rangeEnd, toMinutes(b.start)));
      const e = Math.max(s, Math.min(rangeEnd, toMinutes(b.end)));
      return { ...b, s, e, top: (s - rangeStart) * ppm + 1, height: Math.max(0, (e - s) * ppm - 2) };
    });

  // One layout for the whole image, chosen by the shortest block, so every
  // block shows the same lines in the same places. Preference order:
  // stacked code (ECON / 131A) + room + time → … → one-line code only.
  // A line that won't fit in the shortest block is dropped everywhere rather
  // than shown on some blocks and not others.
  const minHeight = laid.length ? Math.min(...laid.map((b) => b.height)) : Infinity;
  const anyRoom = laid.some((b) => !!b.room);
  const padT = scale.padT;
  const inlineLh = scale.metaLh + 3;
  const stackedH = padT + scale.deptLh + META_GAP + scale.numLh;
  const inlineH = padT + inlineLh;
  const metaH = META_GAP + scale.metaLh;
  const layouts = [
    { stacked: true, room: anyRoom, time: true },
    { stacked: true, room: anyRoom, time: false },
    { stacked: false, room: anyRoom, time: true },
    { stacked: false, room: anyRoom, time: false },
    { stacked: false, room: false, time: false },
  ];
  const need = (l: (typeof layouts)[number]) =>
    (l.stacked ? stackedH : inlineH) + (l.room ? metaH : 0) + (l.time ? metaH : 0) + 2;
  const layout = layouts.find((l) => need(l) <= minHeight) ?? layouts[layouts.length - 1];

  // One size per text role for the whole image: the largest that fits the longest
  // string in a column, never below MIN_TEXT. Every block shares it.
  const innerW = (CONTENT_W - GUTTER - COL_GAP * (days.length - 1)) / Math.max(days.length, 1) - scale.padX * 2;
  const fitRole = (values: string[], base: number, perChar: number) => {
    const longest = Math.max(1, ...values.map((v) => v.length));
    return Math.max(MIN_TEXT, Math.min(base, Math.floor((innerW / (longest * perChar)) * 2) / 2));
  };
  const courseBlocks = laid.filter((b) => !b.label);
  const codes = courseBlocks.map((b) => splitCode(b.code));
  const deptSize = fitRole(codes.map((c) => c.dept), scale.dept, CHAR_W.dept);
  const numSize = fitRole(codes.map((c) => c.num), scale.num, CHAR_W.num);
  const inlineSize = fitRole(courseBlocks.map((b) => b.code), scale.metaLh, CHAR_W.dept);
  const roomSize = fitRole(laid.map((b) => b.room), scale.meta, CHAR_W.room);
  const timeSize = fitRole(laid.map((b) => `${formatClock(b.s)}–${formatClock(b.e)}`), scale.meta, CHAR_W.time);
  // Custom labels ("Tennis Club") occupy exactly the code's height: two lines
  // in the stacked layout, one in the inline layout.
  const labelLines = layout.stacked ? 2 : 1;
  const labelLh = layout.stacked ? (scale.deptLh + META_GAP + scale.numLh) / 2 : inlineLh;

  const hours = Array.from({ length: span + 1 }, (_, i) => startHour + i);

  return (
    <View ref={ref} collapsable={false} style={[styles.card, { backgroundColor: t.bg }]}>
      <View style={styles.header}>
        <View>
          <Text allowFontScaling={false} style={[styles.school, { color: t.muted }]}>{school}</Text>
          <Text allowFontScaling={false} style={[styles.term, { color: t.ink }]} numberOfLines={1}>{term}</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: t.pillBg }]}>
          <Text allowFontScaling={false} style={[styles.pillText, { color: t.pillInk }]}>{unitsLabel}</Text>
        </View>
      </View>

      <View style={styles.dayRow}>
        {days.map((day, i) => (
          <Text
            key={day}
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.dayLabel, { color: t.muted, paddingLeft: scale.padX, marginLeft: i === 0 ? 0 : COL_GAP }]}
          >
            {day.toUpperCase()}
          </Text>
        ))}
      </View>

      <View style={styles.body}>
        {hours.map((h, i) => {
          const y = i * 60 * ppm;
          return (
            <React.Fragment key={h}>
              <View style={[styles.hourLine, { top: y, backgroundColor: t.line }]} />
              <Text allowFontScaling={false} style={[styles.hourLabel, { top: y - 6, color: t.muted }]}>
                {h % 12 || 12}
              </Text>
            </React.Fragment>
          );
        })}

        <View style={styles.columns}>
          {days.map((day, i) => (
            <View key={day} style={[styles.column, { marginLeft: i === 0 ? 0 : COL_GAP }]}>
              {laid
                .filter((b) => b.day === day)
                .map((b, j) => {
                  const { dept, num } = splitCode(b.code);
                  const ink = b.textColor ?? textOn(b.color);
                  const showRoom = layout.room && !!b.room;
                  const showTime = layout.time;
                  return (
                    <View
                      key={`${b.code}-${b.s}-${j}`}
                      style={[
                        styles.block,
                        {
                          top: b.top,
                          height: b.height,
                          backgroundColor: b.color,
                          borderRadius: scale.radius,
                          borderWidth: b.borderColor ? 1 : 0,
                          borderColor: b.borderColor,
                          paddingTop: padT,
                          paddingHorizontal: scale.padX,
                        },
                      ]}
                    >
                      {b.label ? (
                        <Text
                          allowFontScaling={false}
                          numberOfLines={Math.max(labelLines, Math.min(2, Math.floor((b.height - padT - 2) / labelLh)))}
                          style={[styles.label, { color: ink, fontSize: layout.stacked ? Math.min(scale.dept + 2, labelLh - 2) : inlineSize, lineHeight: labelLh }]}
                        >
                          {b.label}
                        </Text>
                      ) : !layout.stacked ? (
                        <Text
                          allowFontScaling={false}
                          numberOfLines={1}
                          style={[styles.num, { color: ink, fontSize: inlineSize, lineHeight: inlineLh, marginTop: 0, marginLeft: 0 }]}
                        >
                          {b.code}
                        </Text>
                      ) : (
                        <>
                          <Text
                            allowFontScaling={false}
                            numberOfLines={1}
                            style={[styles.dept, { color: ink, fontSize: deptSize, lineHeight: scale.deptLh }]}
                          >
                            {dept}
                          </Text>
                          <Text
                            allowFontScaling={false}
                            numberOfLines={1}
                            style={[styles.num, { color: ink, fontSize: numSize, lineHeight: scale.numLh }]}
                          >
                            {num}
                          </Text>
                        </>
                      )}
                      {showRoom && (
                        <Text
                          allowFontScaling={false}
                          numberOfLines={1}
                          style={[styles.room, { color: ink, fontSize: roomSize, lineHeight: scale.metaLh }]}
                        >
                          {b.room}
                        </Text>
                      )}
                      {showTime && (
                        <Text
                          allowFontScaling={false}
                          numberOfLines={1}
                          style={[styles.time, { color: ink, fontSize: timeSize, lineHeight: scale.metaLh }]}
                        >
                          {`${formatClock(b.s)}–${formatClock(b.e)}`}
                        </Text>
                      )}
                    </View>
                  );
                })}
            </View>
          ))}
        </View>
      </View>

    </View>
  );
});

export default ScheduleStoryCard;

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 22,
    overflow: 'hidden',
  },
  header: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  school: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.4 },
  term: { fontSize: 28, lineHeight: 32, fontWeight: '800', letterSpacing: -0.5 },
  pill: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 2,
    justifyContent: 'center',
  },
  pillText: { fontSize: 13, fontWeight: '700' },
  dayRow: { flexDirection: 'row', height: 18, marginLeft: GUTTER, marginBottom: 6 },
  dayLabel: { flex: 1, fontSize: 10, lineHeight: 18, fontWeight: '700', letterSpacing: 0.8 },
  body: { height: BODY_H + BODY_INSET },
  hourLine: { position: 'absolute', left: GUTTER, right: 0, height: 1 },
  hourLabel: {
    position: 'absolute',
    left: 0,
    width: 18,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  columns: { position: 'absolute', left: GUTTER, right: 0, top: 0, height: BODY_H, flexDirection: 'row' },
  column: { flex: 1 },
  block: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  dept: { fontWeight: '700', letterSpacing: 0.3, opacity: 0.88 },
  // Large digits carry a left side bearing ("1" especially), so at 16pt the
  // number looked indented under the 9pt dept label; pull it back to one edge.
  num: { marginTop: META_GAP, fontWeight: '800', letterSpacing: -0.2, marginLeft: -1 },
  label: { fontWeight: '800', letterSpacing: -0.1 },
  room: { marginTop: META_GAP, fontWeight: '600', opacity: 0.9 },
  time: { marginTop: META_GAP, fontWeight: '500', opacity: 0.78, letterSpacing: -0.2 },
});

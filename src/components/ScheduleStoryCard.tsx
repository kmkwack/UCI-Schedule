import React, { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

// 9:16 Instagram Story card (390 × 693 pt, captured @3x with react-native-view-shot).
//
// Lanes layout (gray ground, white day columns) with the user's own timetable
// theme: every block is painted with exactly the bg / text / border the
// Timetable screen uses for it, and type follows the in-app block (code 800,
// room and time 600 at reduced opacity), so the saved image matches the app.
//
// Consistency rules:
// - One type scale per image (regular, or compact when a 50-min block is too short).
// - One font size per text role per image, fitted to the longest string.
// - Every block uses the same top-aligned stack: dept, number, room, time, with
//   line heights chosen so the visible gap between any two lines is the same.
//   Lines are added top-down while the block has height for them, so blocks of
//   the same length always show the same lines; time is the first to go.

export type StoryBlock = {
  day: string; // must match an entry in `days`, e.g. 'Mon'
  start: string | number; // 'HH:mm' (24h) or minutes since midnight
  end: string | number;
  code: string; // 'COMPSCI 161'
  room: string;
  color: string; // block fill — the in-app block's bg for the user's theme
  textColor: string; // the in-app block's text color
  borderColor?: string; // the in-app block's border (1pt), if the theme has one
  label?: string; // custom blocks ("Tennis Club"): shown as typed instead of dept/number
};

export type ScheduleStoryCardProps = {
  school: string;
  term: string;
  unitsLabel: string; // "16 units" — the number is set bold, the rest muted
  days: string[];
  startHour: number;
  endHour: number;
  blocks: StoryBlock[];
  palette: StoryPalette;
};

// Card chrome, supplied by the Timetable screen from the active theme
// (getTimetableGridColors + ThemeContext), never hardcoded here.
export type StoryPalette = {
  canvas: string; // ground behind the day lanes
  lane: string; // day column fill
  line: string; // hour rules
  hourLabel: string;
  dayLabel: string;
  ink: string; // term, units number
  muted: string; // units word
  brand: string; // school name
};

const CARD_W = 390;
const CARD_H = 693;
const PAD_X = 20;
const GUTTER = 22; // hour labels
const LANE_GAP = 4;
const LANE_HEAD = 28; // day label inside the lane
const BODY_H = 545; // drawable hour area inside a lane
const LANE_H = LANE_HEAD + BODY_H + 8; // 8pt bottom inset keeps the last class off the lane edge
const BLOCK_INSET = 2; // block ↔ lane side
const MIN_TEXT = 8;

// Rough advance width per character, as a fraction of font size.
// Used instead of adjustsFontSizeToFit, which with a fixed lineHeight can collapse text to ~3pt.
const CHAR_W = { dept: 0.7, num: 0.64, room: 0.64, time: 0.62 };

// Line heights = cap height + 5 (≈2.5pt above and below the caps), so every
// adjacent pair of lines shows the same ~5pt gap and no margins are needed.
// (All block text is caps + digits, so cap height is what the eye measures.)
const SCALES = {
  regular: { padT: 4, padL: 5, padR: 3, radius: 8, dept: 9, deptLh: 11, num: 16, numLh: 16, meta: 9, metaLh: 11 },
  compact: { padT: 3, padL: 4, padR: 2, radius: 6, dept: 8, deptLh: 10, num: 13, numLh: 14, meta: 8, metaLh: 10 },
};

export function toMinutes(value: string | number): number {
  if (typeof value === 'number') return value;
  const [h, m] = value.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// First class's hour → the hour the last class ends in, at least 6 hours.
export function getStoryHourRange(blocks: Pick<StoryBlock, 'start' | 'end'>[]): { startHour: number; endHour: number } {
  if (blocks.length === 0) return { startHour: 9, endHour: 17 };
  let startHour = Math.floor(Math.min(...blocks.map((b) => toMinutes(b.start))) / 60);
  let endHour = Math.min(24, Math.ceil(Math.max(...blocks.map((b) => toMinutes(b.end))) / 60));
  while (endHour - startHour < 6) {
    if (endHour < 22) endHour += 1;
    else if (startHour > 0) startHour -= 1;
    else break;
  }
  return { startHour, endHour };
}

// "12:00" → "12", "9:30" → "9:30".
function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 12 || 12;
  const m = minutes % 60;
  return m === 0 ? `${h}` : `${h}:${String(m).padStart(2, '0')}`;
}

function splitCode(code: string): { dept: string; num: string } {
  const trimmed = code.trim();
  const i = trimmed.lastIndexOf(' ');
  return i > 0 ? { dept: trimmed.slice(0, i), num: trimmed.slice(i + 1) } : { dept: '', num: trimmed };
}

const ScheduleStoryCard = forwardRef<View, ScheduleStoryCardProps>(function ScheduleStoryCard(
  { school, term, unitsLabel, days, startHour, endHour, blocks, palette },
  ref,
) {
  const t = palette;
  const span = Math.max(1, endHour - startHour);
  const ppm = BODY_H / (span * 60);
  const rangeStart = startHour * 60;
  const rangeEnd = endHour * 60;

  const laid = blocks
    .filter((b) => days.includes(b.day))
    .map((b) => {
      const s = Math.max(rangeStart, Math.min(rangeEnd, toMinutes(b.start)));
      const e = Math.max(s, Math.min(rangeEnd, toMinutes(b.end)));
      return {
        ...b,
        s,
        e,
        top: LANE_HEAD + (s - rangeStart) * ppm + 1,
        height: Math.max(0, (e - s) * ppm - 2),
        time: `${formatClock(s)}–${formatClock(e)}`,
      };
    });

  // Scale: regular unless the shortest block can't hold the two-line code.
  const minHeight = laid.length ? Math.min(...laid.map((b) => b.height)) : Infinity;
  const scale = SCALES.regular.padT + SCALES.regular.deptLh + SCALES.regular.numLh + 2 <= minHeight
    ? SCALES.regular
    : SCALES.compact;
  const codeH = scale.padT + scale.deptLh + scale.numLh;
  const metaLinesFor = (height: number, available: number) => {
    let n = 0;
    while (n < available && height >= codeH + (n + 1) * scale.metaLh + 2) n += 1;
    return n;
  };

  // One size per text role for the whole image.
  const laneW = (CARD_W - PAD_X * 2 - GUTTER - LANE_GAP * (days.length - 1)) / Math.max(days.length, 1);
  const innerW = laneW - BLOCK_INSET * 2 - scale.padL - scale.padR - 2; // 2 = 1pt border each side
  const fitRole = (values: string[], base: number, perChar: number) => {
    const longest = Math.max(1, ...values.map((v) => v.length));
    return Math.max(MIN_TEXT, Math.min(base, Math.floor((innerW / (longest * perChar)) * 2) / 2));
  };
  const codes = laid.filter((b) => !b.label).map((b) => splitCode(b.code));
  const deptSize = fitRole(codes.map((c) => c.dept), scale.dept, CHAR_W.dept);
  const numSize = fitRole(codes.map((c) => c.num), scale.num, CHAR_W.num);
  const metaSize = Math.min(
    fitRole(laid.map((b) => b.room), scale.meta, CHAR_W.room),
    fitRole(laid.map((b) => b.time), scale.meta, CHAR_W.time),
  );
  // A custom label takes exactly the two-line code's height.
  const labelLh = (scale.deptLh + scale.numLh) / 2;
  const labelSize = Math.min(scale.dept + 3, labelLh);

  const hours = Array.from({ length: span + 1 }, (_, i) => startHour + i);
  const hourY = (i: number) => LANE_HEAD + i * 60 * ppm;

  const unitsMatch = unitsLabel.match(/^(\S+)\s+(.+)$/);

  return (
    <View ref={ref} collapsable={false} style={[styles.card, { backgroundColor: t.canvas }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.school, { color: t.brand }]}>{school}</Text>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.term, { color: t.ink }]}>{term}</Text>
        </View>
        <View style={[styles.units, { backgroundColor: t.lane }]}>
          <Text allowFontScaling={false} style={[styles.unitsNum, { color: t.ink }]}>
            {unitsMatch ? unitsMatch[1] : unitsLabel}
            {unitsMatch ? <Text style={[styles.unitsWord, { color: t.muted }]}>{` ${unitsMatch[2]}`}</Text> : null}
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        {hours.map((h, i) => (
          <Text key={h} allowFontScaling={false} style={[styles.hourLabel, { top: hourY(i) - 6, color: t.hourLabel }]}>
            {h % 12 || 12}
          </Text>
        ))}

        <View style={styles.lanes}>
          {days.map((day, i) => (
            <View key={day} style={[styles.lane, { backgroundColor: t.lane, marginLeft: i === 0 ? 0 : LANE_GAP }]}>
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.dayLabel, { color: t.dayLabel }]}>
                {day}
              </Text>
              {hours.map((h, j) => (
                <View key={h} style={[styles.hourLine, { top: hourY(j), backgroundColor: t.line }]} />
              ))}
              {laid
                .filter((b) => b.day === day)
                .map((b, j) => {
                  const ink = b.textColor;
                  const meta = [b.room, b.time].filter((v) => !!v);
                  const shown = meta.slice(0, metaLinesFor(b.height, meta.length));
                  const { dept, num } = splitCode(b.code);
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
                          paddingTop: scale.padT,
                          paddingLeft: scale.padL,
                          paddingRight: scale.padR,
                        },
                      ]}
                    >
                      {b.label ? (
                        <Text
                          allowFontScaling={false}
                          numberOfLines={2}
                          style={[styles.label, { color: ink, fontSize: labelSize, lineHeight: labelLh }]}
                        >
                          {b.label}
                        </Text>
                      ) : (
                        <View style={{ height: scale.deptLh + scale.numLh }}>
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
                        </View>
                      )}
                      {shown.map((line, k) => (
                        <Text
                          key={line}
                          allowFontScaling={false}
                          numberOfLines={1}
                          style={[
                            k === 0 && b.room ? styles.room : styles.time,
                            { color: ink, fontSize: metaSize, lineHeight: scale.metaLh },
                          ]}
                        >
                          {line}
                        </Text>
                      ))}
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
    paddingTop: 26,
    paddingHorizontal: PAD_X,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  header: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerText: { flexShrink: 1, minWidth: 0, marginRight: 12 },
  school: { fontSize: 11, lineHeight: 14, fontWeight: '800', letterSpacing: 1.2 },
  term: { fontSize: 30, lineHeight: 34, fontWeight: '800', letterSpacing: -0.6 },
  units: {
    height: 30,
    paddingHorizontal: 13,
    borderRadius: 15,
    marginBottom: 2,
    justifyContent: 'center',
    flexShrink: 0,
  },
  unitsNum: { fontSize: 14, fontWeight: '800' },
  unitsWord: { fontSize: 13, fontWeight: '600' },
  grid: { height: LANE_H },
  hourLabel: {
    position: 'absolute',
    left: 0,
    width: GUTTER - 6,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  lanes: { position: 'absolute', left: GUTTER, right: 0, top: 0, bottom: 0, flexDirection: 'row' },
  lane: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  dayLabel: {
    height: LANE_HEAD,
    lineHeight: LANE_HEAD,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
  },
  hourLine: { position: 'absolute', left: 0, right: 0, height: 1 },
  block: { position: 'absolute', left: BLOCK_INSET, right: BLOCK_INSET, overflow: 'hidden' },
  // Matches the in-app block: code 800, room 600 @ .75, time 600 @ .6.
  dept: { fontWeight: '800' },
  num: { fontWeight: '800' },
  label: { fontWeight: '800' },
  room: { fontWeight: '600', opacity: 0.75 },
  time: { fontWeight: '600', opacity: 0.6 },
});

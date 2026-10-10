import type { ImageSourcePropType } from 'react-native';

// Artwork for the UC Irvine "Anteater" timetable theme.
//
// EMPTY ON PURPOSE. Peter the Anteater and every UCI mark are trademarks of the
// Regents of the University of California. Nothing may be added here until UCI
// Trademarks & Licensing (trademarks@uci.edu) approves the specific marks and
// uses. Every slot renders nothing while empty, and the layout doesn't change.
//
// When approved, drop transparent PNGs into assets/anteater/ and point the
// slots at them. The placements below were agreed in design (canvas
// claude.ai/artifact/FioLcBi5dAaCeWyT1DkQi8 and a local feel mockup); the
// art-sheet numbers are the marks they were designed around.
export type AnteaterArt = {
  // Share card header, right of "UC IRVINE / Fall 2026". Art-sheet #60. ~56×40pt box.
  header: ImageSourcePropType | null;
  // Share card: one small mark on the floor of each day lane whose bottom is
  // free for ≥ 40pt, a different one per lane, never over a class block.
  // Art-sheet #60, #55, #65, #63, #58, #68, used in this order.
  laneMarks: ImageSourcePropType[];
  // In-app timetable: one large, faint mark behind the class blocks, anchored
  // left so the snout runs out over the hour labels. Art-sheet #65 (faces left).
  gridBackground: ImageSourcePropType | null;
};

export const ANTEATER_ART: AnteaterArt = {
  header: null,
  laneMarks: [],
  gridBackground: null,
};

// Width / height of the Peter marks above (all ~1.84:1), used to size boxes.
export const ANTEATER_MARK_ASPECT = 323 / 176;

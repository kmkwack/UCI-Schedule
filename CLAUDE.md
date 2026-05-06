# UCI Schedule App — Agent Briefing

> **IMPORTANT FOR ANY AGENT:** Every time you make a code change, append an entry to the [Changelog](#changelog) at the bottom of this file. Include what file was changed, what was changed, and why.

---

## What This Project Is

A **React Native / Expo mobile app** for UCI students to browse real courses, build per-quarter timetables, view a weekly schedule grid, track grades, and connect with classmates.

---

## How to Run

```bash
cd /Users/kmkwack/UCI-Schedule
npm install
npx expo start   # w = browser, i = iOS simulator, scan QR = Expo Go
```
Node.js via nvm: `nvm install 24 && nvm use 24`

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | React Native + Expo SDK 55 |
| Language | TypeScript |
| Navigation | Manual tab state in `App.tsx` (no React Navigation) |
| Charts | `react-native-svg` |
| Icons | `@expo/vector-icons` (Ionicons) |

---

## API: Anteater API

**Base URL:** `https://anteaterapi.com`  
No auth required. Maintained by ICSSC.

**Primary endpoint:**
```
GET /v2/rest/websoc?department=ECON&year=2026&quarter=Spring
```
Returns schools → departments → courses → sections in one call. Key section fields: `sectionCode`, `sectionType`, `sectionNum`, `units`, `instructors[]`, `isCancelled`, `meetings[].{days, bldg[], startTime/endTime: {hour, minute}}`.

**Departments:** `GET /v2/rest/websoc/departments?since=2014`

Docs: https://docs.icssc.club/docs/developer/anteaterapi  
Cancelled sections (`isCancelled: true`) are filtered out. `enrollmentHistory` endpoint no longer used.

---

## Project Structure

```
UCI-Schedule/
├── App.tsx                         # Root: tab navigation, global state, auth
├── scripts/seed-sections.js        # Fetches UCI sections → upserts to Supabase
├── src/
│   ├── context/ThemeContext.tsx    # ThemeProvider, useTheme(), LIGHT/DARK palettes
│   ├── lib/supabase.ts             # Supabase client
│   ├── data/courses.ts             # Types, constants, helpers (NO static data)
│   ├── components/
│   │   ├── ReviewsModal.tsx        # Self-contained reviews modal (grade dist + write review)
│   │   └── PreviewTimetable.tsx    # Mini timetable preview in course picker
│   └── screens/
│       ├── HomeScreen.tsx          # Today's classes, weather, sports events, quote
│       ├── TimetableScreen.tsx     # Weekly grid, quarter picker, timetable plans
│       ├── CoursePickerScreen.tsx  # Browse/search/add courses (Supabase sections table)
│       ├── GradesScreen.tsx        # GPA tracker per course
│       ├── BoardScreen.tsx         # Community boards (Supabase posts)
│       ├── FriendsScreen.tsx       # ClassMates — friends + timetable view
│       ├── MessagesScreen.tsx      # Direct messages (empty until Supabase wired)
│       └── SettingsScreen.tsx      # Profile, preferences, admin tools
```

---

## Data Model

### `Course` (represents a section, not just a course title)
```typescript
type Course = {
  id: string;         // sectionCode (e.g. "36120")
  code: string;       // "ECON 100A"
  title: string;
  professor: string;
  days: string;       // "MWF", "TuTh", "TBA"
  time: string;       // "10:00 - 10:50" (24hr) or "TBA"
  department: string;
  location?: string;
  units?: number;
  sectionLabel?: string; // "Lec A", "Dis 1", etc.
};
```

### `Quarter` = `{ year: string; quarter: string }` e.g. `{ year: '2026', quarter: 'Spring' }`

### `Timetable` (Supabase-backed, multiple per quarter)
```typescript
type Timetable = { id: string; name: string; quarterKey: string; courses: Course[]; order: number; };
```

### Global State (`App.tsx`)
- `selectedQuarter: Quarter` — currently viewed quarter
- `timetables: Timetable[]` — all plans for all quarters  
- `CURRENT_QUARTER_KEY = '2026-Spring'` — drives HomeScreen "Your Day"

---

## Key Logic

- **Time normalization** → `"HH:MM - HH:MM"` (24hr). Handles am/pm mixed formats.
- **Course number sort** — numeric part first, then letter suffix (`100A` < `100B`).
- **`colorForDepartment(dept)`** — deterministic hash → 10-color palette.
- **`getDaysArray("MWF")`** → `["M", "W", "F"]`. Handles M/T/W/Th/F/Sa/Su.
- **Conflict detection** — on add, checks overlapping days+times, prompts to replace.
- **`pastelForCourse(courseCode, sectionType)`** — deterministic pastel per section type.
- **`quarterKey(q)`** → `"2026-Spring"`.

---

## Supabase Tables

- **`timetables`** — `id, user_id, name, quarter_key, courses (json), order`
- **`sections`** — `id, code, title, professor, days, time, department, location, units, section_label, ge_categories[], final_exam, restrictions, prerequisite_link, section_comment, instructors (json), meetings (json), dept_name`
- **`reviews`** — `id, user_id, course_code, school, section_type, quarter, rating, difficulty, workload, content, created_at`
- **`posts` / `post_votes` / `post_comments`** — community board
- **`boards`** — dynamic board list per school (falls back to `FALLBACK_BOARDS` if empty)
- **`board_requests`** — user-submitted board requests
- **`friend_requests`** — `sender_id, receiver_id, status` (pending/accepted/rejected)

### Multi-School
Reviews scoped by `school` column. Value comes from `selectedUniversity?.name` (defaults to `'UC Irvine'`). All reads filter `.eq('school', school)`; all inserts include `school`.

---

## Review System

- **`ReviewsModal`** props: `visible, onClose, courseCode, department, courseNumber, title, professors, school, userId, semesterLabel, sectionType, inline?`
- Reviews are **separate per section type** (Lec vs Lab vs Dis): `section_type` column in `reviews` table.
- Cache key in CoursePickerScreen: `"ECON 100A::Lec"` (courseCode + `::` + sectionType).
- Cache early-return guard: `if (cache[key]?.count) return` — never skip if count is 0 (avoids poisoning cache with empty error responses).
- `inline` prop: renders content without Modal wrapper (for embedding inside another Modal on iOS).

---

## Quarters Available

```typescript
const QUARTERS = [
  { year: '2024', quarter: 'Fall' },
  { year: '2025', quarter: 'Winter' }, { year: '2025', quarter: 'Spring' }, { year: '2025', quarter: 'Fall' },
  { year: '2026', quarter: 'Winter' }, { year: '2026', quarter: 'Spring' }, { year: '2026', quarter: 'Fall' },
];
```

---

## Sports Events (`src/data/sportsEvents.ts`)

- Fetched from `https://ucirvinesports.com/composite-calendar` (the `.ics` feed is dead — returns 404).
- Parser: `parseSportsCalendar()` auto-detects iCal vs HTML; active path is HTML.
- **Hermes JS gotcha**: `new Date("Apr 28, 2026 6:00 PM")` returns NaN in React Native's Hermes engine. Must use `new Date(year, monthIdx, day, hour, minute)` with manually parsed components.
- Duplicate-id guard: use `parsed.sport` (includes "Men's"/"Women's" prefix) in the `id` field, not `sportShort`.

---

## What Is NOT Implemented Yet

- "Wizard" and "Add manually" buttons in course picker
- Real Supabase DMs in MessagesScreen

---

## Changelog

> **Summarized through Session 60.** Earlier history condensed for brevity.

### Sessions 1–43: Core foundation through auth redesign
- Live Anteater API replaces static data; Supabase backend; multiple named timetables per quarter; pill drag-to-reorder; timetable save/share (react-native-view-shot); timetable themes; pastel blocks; grade distribution bar chart; reviews system with Supabase (school-scoped); auth flow (Welcome → University → Sign In); dynamic HOUR_HEIGHT; dark mode (ThemeContext); AsyncStorage caching throughout; BoardScreen + FriendsScreen + live posts; GPA tracker.

### Sessions 44–55: Polish + features
- Grid style overhaul (gray background, white columns). Save/Share schedule screenshot. Collapsible quarters in Grades. `ReviewsModal` extracted as shared component. Live weather (Open-Meteo). Live sports events (UCI Athletics). Dark mode ThemeContext applied to all screens. Edit mode + delete friend in ClassMates. Sent friend requests visible + cancel. New Post redesigned as pageSheet Modal. Reviews: quarter field, edit/delete own reviews, grade dist color-fill only. GE category filter + global cross-dept search in CoursePicker. Dept modal keyboard fix. Friend timetable grid matches TimetableScreen. Settings slide-in sub-screens + swipe-back. Home scroll-past-dock padding. AY dividers in quarter dropdown. Live daily quote (ZenQuotes, cached by date).

### Session 56 (Settings safe area + Home scroll)
- `SettingsScreen.tsx` — `insets.top + 12` for sub-screen headers. `HomeScreen.tsx` + `App.tsx` — `bottomInset` prop, `paddingBottom = bottomInset + 70`.

### Session 57 (TimetableScreen + ReviewsModal polish)
- `TimetableScreen.tsx` — Dark timetable theme only darkens the grid (not screen bg). Settings modal closes on outside tap. Add Quarter modal: year-group drill-down with spring animation + swipe-back PanResponder + seeded-quarters cache. `ReviewsModal.tsx` — native `pageSheet` presentation. Added `RESTRICTION_LABELS` decoder, `section_comment` display, `final_exam`/`restrictions`/`prerequisite_link` from Supabase `sections`.

### Session 58 (Auth + Settings animation fixes)
- `App.tsx` — Fixed auth screens disappearing on Google sign-in (SIGNED_OUT guard via `userIdRef`). Fixed Invalid Refresh Token on startup (`onAuthStateChange` subscription replaces `getSession()`). AuthNavigator duplicate-key fix + pushAuth guard + slide animations fixed (`useLayoutEffect`, `useNativeDriver: false`).
- `SettingsScreen.tsx` — `DropdownPicker` separate backdrop fade + sheet slide animations.
- `FriendsScreen.tsx` — TBA block moved below grid.
- `BoardScreen.tsx` — Request New Board modal; admin Board Requests screen in Settings.

### Session 59 (Settings as pageSheet)
- `App.tsx` — Settings wrapped in `<Modal presentationStyle="pageSheet">` instead of absolute View.
- `SettingsScreen.tsx` — Header `paddingTop` changed to fixed `20` (inside pageSheet, `insets.top` = 0).

### Session 60 (FriendsScreen swipe-back + Dynamic boards)
- `FriendsScreen.tsx` — Swipe-right to go back from friend timetable (`friendSlideAnim` PanResponder).
- `BoardScreen.tsx` — `boards` state from Supabase (falls back to `FALLBACK_BOARDS` if table empty). `fetchBoards()` on mount + refresh.
- `SettingsScreen.tsx` — `CreateBoardView` (INSERT to `boards` table, pre-fills from request). `ManageBoardsView` (list + delete boards). Admin `ADMIN` section in Settings.

### Session 62 (RMP — last name only + school-scoped URL)
- **`src/components/ReviewsModal.tsx`** — RMP URL now uses only the last name (substring before comma, since UCI API returns "LAST, FIRST" format) with school ID in path: `/search/professors/1074?q=LASTNAME`. Matches AntAlmanac's approach; narrows results to one professor instead of many.
- **`src/screens/TimetableScreen.tsx`** — Same fix in `rmpUrl()`: extracts last name, URL format changed from `?q=fullname&sid=1074` to `/1074?q=LASTNAME`.

### Session 61 (Sports events Hermes fix + duplicate key fix)
- `src/data/sportsEvents.ts` — Fixed `parseCompositeCalendarDate` to use manual `new Date(year, month, day, h, m)` instead of `new Date(string)` (Hermes doesn't support non-ISO date strings). Fixed duplicate event `id` by using `parsed.sport` (retains gender prefix) instead of `sportShort`.
- `src/screens/HomeScreen.tsx` — Changed `maxDaysAhead: 2` → `maxDaysAhead: 7`.

### Session 66 (Time column same width as day columns)
- `src/screens/TimetableScreen.tsx` — `usableGridWidth` no longer subtracts `TIME_LABEL_WIDTH`; `dayColumnWidth = usableGridWidth / (visibleDays.length + 1)` (+1 for the time column). All three `TIME_LABEL_WIDTH` references in JSX replaced with `dayColumnWidth`. Hour label absolute Views changed from `left: -GRID_LEFT_PAD, right: 0` to `left: 0, right: 0` so they no longer overflow into the left padding area — making the visual time column equal width to each day column.

### Session 71 (Share closes timetable settings modal first)
- `src/screens/TimetableScreen.tsx` — `shareSchedule` now calls `closeSettings` and waits 350ms (same as `saveSchedule`) before capturing the image, so the settings modal slides down before the share sheet appears.

### Session 70 (Settings sub-screen swipe-back fix)
- `src/screens/SettingsScreen.tsx` — Moved `borderTopLeftRadius/borderTopRightRadius/overflow:hidden` from App.tsx outer container to SettingsScreen's root View. Reverted swipePan to `onMoveShouldSetPanResponder` (same as Add Quarter's working pattern).
- `App.tsx` — Removed `overflow:'hidden'` from the settings sheet container (it was clipping the touch region and breaking the PanResponder).

### Session 69 (Settings sub-screen swipe-back)
- `src/screens/SettingsScreen.tsx` — Switched `swipePan` from `onMoveShouldSetPanResponder` (bubble phase, blocked by inner ScrollViews) to `onMoveShouldSetPanResponderCapture` (capture phase, fires before children) so horizontal swipes reliably slide the sub-screen back over the main settings page. Threshold raised to `dx > 10` to reduce accidental capture.

### Session 68 (Settings sheet tap-outside-to-dismiss)
- `App.tsx` — Replaced `presentationStyle="pageSheet" animationType="slide"` settings Modal with a `transparent animationType="none"` custom sheet. Added `settingsBackdropAnim` + `settingsSheetAnim` animated values, `openSettingsSheet` / `closeSettingsSheet` helpers. Backdrop `TouchableOpacity` covers the full screen behind the sheet so tapping above dismisses it.

### Session 73 (Prefetch seeded quarters on mount)
- `src/screens/TimetableScreen.tsx` — Extracted the Supabase quarter-availability fetch into a module-level `prefetchSeededQuarters()` function. Added `useEffect` on mount to call it, so `seededQuartersCache` is populated silently in the background when the screen first loads. The Add Quarter modal now opens instantly on first use instead of showing a loading spinner.

### Session 67 (GE Categories border fix)
- `src/screens/CoursePickerScreen.tsx` — Changed GE Categories row `borderBottomColor` from `#e5e7eb` to `#f3f4f6` to match regular department rows (removes the visually bold separator).

### Session 66 (All Departments row in dept picker)
- `src/screens/CoursePickerScreen.tsx` — Added "All Departments" as the first row in the department list (above GE Categories). Tapping it clears both `selectedDept` and `selectedGE`. Shows a checkmark and blue highlight when no filter is active.

### Session 65 (Edit Custom Block from TimetableScreen)
- `src/screens/TimetableScreen.tsx` — Added `onEditCustomCourse?: (course: Course) => void` prop. Course detail sheet shows "Edit Custom Block" button (above Remove) when `selectedCourse.department === 'CUSTOM'`. Tapping it calls `onEditCustomCourse` and closes the sheet.
- `src/screens/CoursePickerScreen.tsx` — Added `editingCustomCourse?`, `onReplaceCourse?`, `onEditingHandled?` props. Added `courseToCustomDraft` helper (reverses `buildCustomCourse`). `useEffect` on `editingCustomCourse` pre-populates the draft and auto-opens the customize modal. `handleCreateCustomCourse` in edit mode calls `onReplaceCourse(oldId, newCourse)` (keeps same `id`, in-place swap) instead of adding a new course. `closeCustomizeModal` clears `editingCourseIdRef` and calls `onEditingHandled`.
- `App.tsx` — Added `editingCustomCourse` state. Added `handleReplaceCourse` (atomic in-place swap + Supabase save). `onEditCustomCourse` on TimetableScreen sets state + opens CoursePicker. CoursePickerScreen receives the three new edit props.

### Session 64 (Customize modal discard confirmation)
- `src/screens/CoursePickerScreen.tsx` — Tapping X or outside the Customize Block modal now shows a "Discard block? Changes will not be saved." Alert with "Keep editing" / "Discard" options, but only if any text field has input; if all fields are empty it closes immediately. Direct submission via "Add Custom Block" still closes without prompt. Added `confirmCloseCustomizeModal` helper.

### Session 63 (Customize modal animated backdrop)
- `src/screens/CoursePickerScreen.tsx` — Customize Block modal backdrop now fades in separately from the sheet. Changed `animationType="slide"` → `animationType="none"`; added `customizeBackdropAnim` + `customizeSheetAnim`; `openCustomizeModal` animates both in parallel (spring sheet + 280ms backdrop fade); new `closeCustomizeModal` animates out before hiding. Matches TimetableScreen's Add Quarter pattern.

### Session 64 (Clear X buttons on search inputs)
- `src/screens/CoursePickerScreen.tsx` — Main search and dept-picker search wrapped in row View; conditional `close-circle` X button appears when text exists. Customize Block text fields (Name, Short Label, Location, Instructor) get `clearButtonMode="while-editing"` (native iOS clear button).
- `src/screens/BoardScreen.tsx` — Added conditional X clear button to the board post `search` TextInput.
- `src/screens/FriendsScreen.tsx` — Added conditional X clear button to the classmates `searchQuery` TextInput.

### Session 75 (Add Friend modal — search + scroll + keyboard fixes)
- `src/screens/FriendsScreen.tsx` — Search now queries both `email` and `name` via Supabase `.or()`. Email search strips the domain (uses only the part before `@`). Results list is a `ScrollView` capped at `maxHeight: 294` (3 rows) with vertical scroll indicator. Major/year text capped at 2 lines with ellipsis. Send Request moved to a button-only tap (row is a plain `View`). Modal stays open after sending a request. Backdrop and card restructured as siblings (backdrop is `StyleSheet.absoluteFillObject` `TouchableOpacity`; card is a plain `View` inside a `pointerEvents="box-none"` container) — eliminates all scroll-blocking from wrapper touchables. `TouchableWithoutFeedback` wraps only the static top section for keyboard dismiss; `ScrollView` dismisses keyboard on unhandled taps via `keyboardShouldPersistTaps="handled"`. Send Request button calls `Keyboard.dismiss()` before sending.

### Session 74 (New Post modal — buttons inside scroll)
- `src/screens/BoardScreen.tsx` — Moved Cancel/Post buttons from a fixed footer View into the ScrollView so they are reachable when the keyboard is open.

### Session 75 (Persist C/F temperature preference)
- `src/screens/HomeScreen.tsx` — Added `tempUnitLoaded` state + two effects: one loads `temp_unit` from AsyncStorage on mount and sets `useCelsius`; the other saves `'C'`/`'F'` to AsyncStorage whenever `useCelsius` changes (guarded by `tempUnitLoaded` to avoid overwriting stored value before load completes).

### Session 78 (Quarter ring outside class ring + sports widget full-width)
- `src/screens/HomeScreen.tsx` — Added `DualProgressRing` component: renders two concentric SVG rings in one view (outer = quarter progress in brand color, inner = class progress in accent). Replaced both `ProgressRing` usages in the hero card (active-class and no-class states) with `DualProgressRing`. Removed the standalone quarter progress card from the two-column summary row. Sports widget now fills the full row width (`minHeight: SUMMARY_CARD_HEIGHT`, no explicit width), icon size bumped to 42×42 and max visible icons to 8.

### Session 77 (Sports widget redesign — Today icons + More sheet)
- `src/screens/HomeScreen.tsx` — Sports widget redesigned: top half shows "Today:" label with tappable circular sport icons (one per today's event, up to 5 with overflow count), each icon opens the event detail sheet via `openSportsEvent`. Bottom shows a "More" button with a count of events in the next 2 days. Added `todaySportsEvents` and `moreSportsEvents` computed values. Added `showSportsMoreList` state + new bottom sheet modal ("Next 2 Days") that lists tomorrow and day-after events with their sport icons, home/away pill, and going count.

### Session 76 (Friend timetable header — long name truncation + first/last only in all name displays)
- `src/screens/FriendsScreen.tsx` — Left section of friend timetable header given `flex: 1` + `minWidth: 0` so it never crowds the quarter pill. Name and email texts get `numberOfLines={1} ellipsizeMode="tail"`. Avatar marked `flexShrink: 0` so it never collapses. Added `firstLastName()` helper; applied to every name display site: Add Friend search results, friends list rows, incoming request rows, sent request rows, and friend timetable header.

### Session 80 (Classmates — simplify no-shared-classes state)
- `src/screens/FriendsScreen.tsx` — Replaced the per-course "No overlap" row list (shown when the user has classes but no shared ones) with a single "No shared classes this term" text line.

### Session 79 (Home screen — remove Today header, abbreviate days, drop Quarter label)
- `src/screens/HomeScreen.tsx` — Removed "Today" `<Text>` from the top header row; changed header row to `justifyContent: 'flex-end'` so the avatar button stays right-aligned. Changed `DAY_LABELS` from full day names to 3-letter abbreviations (`['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']`). Removed `includeSystem=true` from `termLabel` call in `getDateLabel` so the date subtitle no longer appends "Quarter".

### Session 61 (RMP moved to ReviewsModal + Reviews button layout)
- `src/components/ReviewsModal.tsx` — Added `sectionType: string` prop. Added RMP row in course info section (shows prof name as tappable link to RateMyProfessors). `fetchReviews` and `handleSubmit` filter/set `section_type`. Supabase `reviews` table requires `ALTER TABLE reviews ADD COLUMN section_type TEXT;`.
- `src/screens/CoursePickerScreen.tsx` — Removed RMP button from section rows. Reviews button moved directly beneath Add button. Star rating ("★ X.X · N ratings") moved beneath Reviews button in right column. `fetchReviewSummary(courseCode, sectionType)` cache keyed as `"ECON 100A::Lec"`. Early-return guard: `if (cache[key]?.count)` (not truthy check). `handleExpandCourse` fetches summaries for all unique section types in the course.
- `src/screens/TimetableScreen.tsx` — Passes `sectionType` to ReviewsModal.


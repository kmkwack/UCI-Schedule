# UCI Schedule App — Agent Briefing

> **IMPORTANT FOR ANY AGENT:** Every time you make a code change, append an entry to the [Changelog](#changelog) at the bottom of this file. Include what file was changed, what was changed, and why.

---

## What This Project Is

A **React Native / Expo mobile app** for UCI (University of California, Irvine) students to:
- Browse real courses offered each quarter using live UCI data
- Build a personal timetable per quarter (e.g. Spring 2026, Fall 2026)
- View a weekly schedule grid with their added courses
- Track grades per course

The app is built for iOS/Android but can also run in a web browser via Expo.

---

## How to Run

```bash
cd /Users/kmkwack/UCI-Schedule
npm install          # if node_modules is missing or outdated
npx expo start       # starts the dev server
```

- Press `w` to open in browser
- Press `i` for iOS Simulator (requires Xcode)
- Scan the QR code with **Expo Go** app on your phone (note: Expo SDK 55 may require the latest Expo Go version)

**Node.js** is required. Install via nvm:
```bash
nvm install 24
nvm use 24
```

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | React Native + Expo SDK 55 |
| Language | TypeScript |
| Navigation | Manual tab state in `App.tsx` (no React Navigation library) |
| Charts | `react-native-svg` |
| Icons | `@expo/vector-icons` (Ionicons) |

---

## API: Anteater API

**Base URL:** `https://anteaterapi.com`

This is the official UCI student-built API maintained by ICSSC (ICS Student Council). No authentication required. It replaced PeterPortal API (shut down January 2025).

### Endpoints Used

#### 1. WebSoc — courses + sections for a department/quarter (primary endpoint)
```
GET https://anteaterapi.com/v2/rest/websoc?department=ECON&year=2026&quarter=Spring
```
Returns all courses and their sections in one call. This is the same endpoint AntAlmanac uses.

Response shape:
```json
{
  "ok": true,
  "data": {
    "schools": [{
      "departments": [{
        "deptCode": "ECON",
        "courses": [{
          "courseNumber": "100A",
          "courseTitle": "INTERMED MICROECON",
          "sections": [{
            "sectionCode": "36120",
            "sectionType": "Lec",
            "sectionNum": "A",
            "units": "4",
            "instructors": ["SMITH, JOHN"],
            "isCancelled": false,
            "meetings": [{
              "timeIsTBA": false,
              "days": "MWF",
              "bldg": ["SSPA 2112"],
              "startTime": { "hour": 10, "minute": 0 },
              "endTime": { "hour": 10, "minute": 50 }
            }]
          }]
        }]
      }]
    }]
  }
}
```

Note: `startTime`/`endTime` use 24-hour `{ hour, minute }` objects.

#### 2. Departments (not currently used, kept for reference)
```
GET https://anteaterapi.com/v2/rest/websoc/departments?since=2014
```

### API Docs
- Developer docs: https://docs.icssc.club/docs/developer/anteaterapi
- Interactive reference: https://anteaterapi.com/reference
- AntAlmanac source (shows real usage): https://github.com/icssc/AntAlmanac

### Important Notes
- The websoc endpoint returns everything in **one call** — no batching needed
- Cancelled sections (`isCancelled: true`) are filtered out before display
- Courses with no non-cancelled sections are not shown
- `enrollmentHistory` endpoint is no longer used (was replaced by websoc)

---

## Project Structure

```
UCI-Schedule/
├── App.tsx                        # Root component, tab navigation, global state
├── src/
│   ├── data/
│   │   └── courses.ts             # Types, constants, helper functions (NO static data)
│   ├── screens/
│   │   ├── HomeScreen.tsx         # Today's classes, quick actions
│   │   ├── TimetableScreen.tsx    # Weekly grid + quarter picker
│   │   ├── CoursePickerScreen.tsx # Browse/search/add courses (API-connected)
│   │   └── GradesScreen.tsx       # GPA tracker per course
│   └── components/
│       └── PreviewTimetable.tsx   # Mini timetable preview in course picker
```

---

## Data Model

### `Course` type (`src/data/courses.ts`)
```typescript
type Course = {
  id: string;         // sectionCode from API (e.g. "36120")
  code: string;       // "ECON 100A"
  title: string;      // "Intermediate Microeconomics"
  professor: string;  // from instructors[0]
  days: string;       // "MWF", "TuTh", "Sa", etc.
  time: string;       // normalized 24hr: "10:00 - 10:50"
  department: string; // "ECON"
  addedCount: number; // always 0 (not from API)
  rating: number;     // always 0 (not from API)
  location?: string;  // from meetings[0].bldg[0]
  units?: number;
};
```

A `Course` in this app represents a **section** (a specific scheduled offering), not just a course title.

### `Quarter` type
```typescript
type Quarter = { year: string; quarter: string };
// e.g. { year: '2026', quarter: 'Spring' }
```

### Global State (`App.tsx`)
```typescript
selectedQuarter: Quarter                    // currently viewed quarter
timetables: Record<string, Course[]>        // courses per quarter, keyed by "2026-Spring"
```

Active courses = `timetables[quarterKey(selectedQuarter)] ?? []`

---

## Key Logic

### Time Normalization (`CoursePickerScreen.tsx`)
API returns time in various formats. All are normalized to `"HH:MM - HH:MM"` (24hr):
- `"8:00-8:50am"` → `"08:00 - 08:50"`
- `"2:00-3:20pm"` → `"14:00 - 15:20"`
- `"11:00am-12:20pm"` → `"11:00 - 12:20"`

### Course Number Sorting
Courses are sorted by numeric part first, then letter suffix:
- `parseInt("10C") = 10`, `parseInt("100B") = 100` → 10 comes first
- Same number → sort suffix: `100A` before `100B`

### Department Colors (`src/data/courses.ts`)
`colorForDepartment(dept)` — hashes the department string to consistently pick from a 10-color palette. Ensures the same department always gets the same color.

### Days Parsing
`getDaysArray("MWF")` → `["M", "W", "F"]`
Handles: `M`, `T`, `W`, `Th`, `F`, `Sa`, `Su`

### Conflict Detection (`CoursePickerScreen.tsx`)
When adding a section, checks if it overlaps with any already-added section on the same day. Prompts user to confirm replacement if there's a conflict.

---

## Department List

All 140+ UCI departments are hardcoded in `src/data/courses.ts` as `UCI_DEPARTMENTS`. The list was sourced from the UCI WebSoc department dropdown at `https://www.reg.uci.edu/perl/WebSoc`.

Notable departments that were added after initial setup (were missing from original list):
`EECS`, `COGS`, `DATA`, `CBE`, `ENGRCEE`, `ENGRMAE`, `ENGRMSE`, `ASIANAM`, `BIO SCI`, and many others.

---

## Course Picker Flow

1. User opens Course Picker (taps "+ Add Class" in Timetable)
2. Selects a department from a **bottom-sheet dropdown modal** (searchable)
3. App fetches course catalog from Anteater API
4. App **immediately pre-fetches sections for every course in parallel** for the selected quarter
5. Only courses with at least one section are shown
6. Courses are sorted by course number (numeric sort, not alphabetic)
7. User taps a course → expands to show available sections
8. User taps a section → previews it in the mini timetable at the top
9. User taps "Add" → section is added to the active quarter's timetable

---

## Quarters Available

```typescript
const QUARTERS = [
  { year: '2024', quarter: 'Fall' },
  { year: '2025', quarter: 'Winter' },
  { year: '2025', quarter: 'Spring' },
  { year: '2025', quarter: 'Fall' },
  { year: '2026', quarter: 'Winter' },
  { year: '2026', quarter: 'Spring' },
  { year: '2026', quarter: 'Fall' },
];
```

The quarter picker is a horizontal scroll at the top of the Timetable screen.

---

## What Is NOT Implemented Yet

- Persistent storage (courses reset on app reload — no AsyncStorage)
- User authentication
- Push notifications / reminders
- Real GPA data (GPA is hardcoded at 3.72, credits at 64)
- Professor ratings (always 0, no RateMyProfessor integration)
- `addedCount` (always 0, no backend tracking)
- The "Wizard" and "Add manually" buttons in course picker (not wired up)
- `CoursesScreen.tsx` exists in `src/screens/` but is unused

## Multi-School Notes

- Reviews are **scoped by school**: every read filters `.eq('school', school)` and every insert includes the `school` field. This prevents students from seeing reviews from other universities.
- Currently only **UC Irvine** exists. The `school` value comes from `selectedUniversity?.name` (set during the login flow) and defaults to `'UC Irvine'`.
- When adding a new school: ensure `selectedUniversity` is correctly set on login — no other code changes needed for review scoping.
- The `reviews` Supabase table has a `school TEXT NOT NULL DEFAULT 'UC Irvine'` column with an index on `(school, course_code)`.

---

## Changelog

> **Summarized after Session 43.** Full per-session history removed for brevity. Key milestones below.

### Sessions 1–3: Core foundation
- Live Anteater API (`/v2/rest/websoc`) replaces static data. Department bottom-sheet modal, section sorting, conflict detection, time normalization, `catalogMap` deduplication.

### Sessions 4–8: UX polish
- Quarter dropdown, section labels (`"Lec A"`), search by professor/course code, `formatLocation()` for online courses, honors-course sort fix (`stripH()`).

### Sessions 9–13: Timetable interactions
- `focusedCourseId` scroll-to-course, tappable blocks, animated course-picker overlay (`Animated` + `translateY`), preview timetable alignment.

### Sessions 14–19: Bottom-sheet experiment (reverted)
- Tried half-height bottom-sheet picker (S14–16), reverted to full-screen overlay (S18). Grid/alignment fixes kept.

### Sessions 20–23: Visual tweaks
- Remove trailing grid line, hide time text from blocks, taller hour rows, two-line course code (dept / number).

### Session 24: Supabase backend
- `src/lib/supabase.ts` created. `timetables: Timetable[]` replaces `Record<string, Course[]>`. Multiple named timetables per quarter with Supabase upsert/insert.

### Sessions 25–30: New screens + branding
- `BoardScreen`, `MessagesScreen`, `FriendsScreen` redesigned as "ClassMates". Auth screens (`WelcomeScreen`, `SignInScreen`, `SignUpScreen`). Brand color unified to `#4169E1`. App renamed "ClassMate".

### Sessions 31–34: Timetable redesign + reviews
- Pastel block style, `pastelForDepartment()`, timetable themes (Default/Minimal/Colorful/Dark), display settings checkboxes, delete timetable. Course reviews modal with mock data + write-review flow.

### Session 35: Supabase seeder
- `scripts/seed-sections.js` — fetches all UCI sections from Anteater API, upserts to Supabase `sections` table.

### Sessions 36–38: Colors + scrolling + TBA
- Fixed vertical scroll (`HOUR_HEIGHT = 72`), TBA course section, per-course `pastelForCourse()`, section-type color separation (`"ECON 100A-Lec"` vs `"ECON 100A-Dis"`).

### Sessions 39–40: Grades + quarter management
- Grades screen: real GPA from timetable data, past quarters, A+/P/NP grades, unit overrides, 0-unit section filter. Add Quarter flow queries Supabase for seeded quarters. `PASTEL_PALETTES` expanded to 24.

### Session 40 (also): CoursePickerScreen → Supabase
- Replaced live websoc fetch with Supabase `sections` table query. Removed all websoc-specific types/helpers.

### Sessions 41–43: Auth redesign + live data
- New auth flow: Welcome → University Selection → Sign In (Figma design3). `UniversitySelectionScreen` created. Live enrollment status pills (Open/Waitlist/Full) fetched from websoc API on expand. Grade distribution bar chart in reviews modal (from `grades/aggregate` API).

### Session 48g (Dismiss dept picker on outside tap)
- **`src/screens/CoursePickerScreen.tsx`** — Wrapped the department picker modal backdrop in a `TouchableOpacity` so tapping the dark overlay closes the sheet. Inner content wrapped in a second `TouchableOpacity` with `stopPropagation` to prevent the tap from bubbling. Added `onRequestClose` for Android back-button support.

### Session 48f (Scope reviews by school)
- **`src/screens/CoursePickerScreen.tsx`** — Added `school: string` prop. All review reads filter `.eq('school', school)` and all inserts include `school`. Prevents fetching reviews from other universities.
- **`src/screens/TimetableScreen.tsx`** — Same `school` prop + filter on read.
- **`App.tsx`** — Passes `school={selectedUniversity?.name ?? 'UC Irvine'}` to both screens.
- **Supabase SQL required** — `ALTER TABLE reviews ADD COLUMN school TEXT NOT NULL DEFAULT 'UC Irvine';`

### Session 48e (Real reviews from Supabase)
- **`src/screens/CoursePickerScreen.tsx`** — Removed `MOCK_REVIEWS`. Added `reviews`/`reviewsListLoading`/`submittingReview` state. Added `fetchReviews()` (Supabase query by `course_code`) and `handleSubmitReview()` (inserts row then re-fetches). Reviews list shows live average rating and count. Added `userId` prop (passed from App.tsx) stored on each submitted review.
- **`src/screens/TimetableScreen.tsx`** — Removed `MOCK_REVIEWS`. Added `courseReviews`/`courseReviewsLoading` state. Fetches from Supabase `reviews` table when the reviews panel opens. Shows live average + loading state.
- **`App.tsx`** — Passed `userId={USER_ID}` to `CoursePickerScreen`.
- **Supabase SQL required** — Create the `reviews` table (see below).

### Session 48d (Animate reviews panel slide-up)
- **`src/screens/TimetableScreen.tsx`** — Reviews panel now slides up from the bottom with a cubic-ease animation instead of appearing instantly. Restructured the modal so the detail sheet is a normal View and the reviews panel is an absolutely-positioned `Animated.View` that slides in (`translateY` 0) on "Reviews" tap and slides back out before unmounting. Added `Easing` import, `reviewsSlideAnim` Animated.Value, `showReviewsPanel` mount guard, and corresponding `useEffect`.

### Session 49c (Weather card °C/°F toggle)
- **`src/screens/HomeScreen.tsx`** — Added a small settings icon (top-right of weather card) that reveals a °C / °F pill picker inline. Active unit is highlighted in blue. Selecting a unit converts the displayed temperature (22°C ↔ 72°F) and dismisses the picker.

### Session 49b (Sports events: show today + 2 days, all games)
- **`src/screens/HomeScreen.tsx`** — Changed event filter from "next 3 upcoming" to all games on today, tomorrow, and the day after tomorrow (including already-played games today). Removed the `.slice(0, 3)` cap so all games across the 3-day window are shown.

### Session 49 (Live sports events in Campus Events card)
- **`src/screens/HomeScreen.tsx`** — Replaced hardcoded `CAMPUS_EVENTS` array with live data fetched from `https://ucirvinesports.com/calendar.ics` (UCI Athletics iCal feed, updates every 2h). Added iCal parser: unfolds continuation lines, splits VEVENT blocks, parses DTSTART (UTC), SUMMARY (strips result prefix, extracts sport/opponent/home-vs-away), and LOCATION (extracts venue name). Added `SPORT_STYLES` map (10 sports → icon/color/bg) with gender-prefix normalization. Shows next 3 upcoming events sorted by date. Falls back to "Loading…" while fetching.

### Session 48c (Fix reviews view in timetable detail sheet)
- **`src/screens/TimetableScreen.tsx`** — Fixed reviews content not showing: applied `flex: 1` to the white sheet container only when `showCourseReviews` is true (so the detail view stays auto-height but the reviews `ScrollView` has space to render). Fixed professor selector source to use `selectedCourse.professor` directly and show when any non-STAFF professor exists.

### Session 48b (Course detail sheet on timetable tap)
- **`src/screens/TimetableScreen.tsx`** — Tapping a course block (or TBA pill) now opens a bottom-sheet modal instead of scrolling. The sheet shows course info (professor, time, location, units) and two action buttons: "Reviews" (only for Lec sections; opens grade distribution + mock reviews sub-sheet) and "Remove Course" (calls `onRemoveCourse` to remove the section from the timetable). Added `GradeDistribution` type, `MOCK_REVIEWS` constant, grade fetch `useEffect`, and `onRemoveCourse` prop.
- **`App.tsx`** — Passed `onRemoveCourse={handleToggleCourse}` to `TimetableScreen`.

### Session 48 (Fit-to-screen timetable rows)
- **`src/screens/TimetableScreen.tsx`** — Replaced fixed `HOUR_HEIGHT = 72` with a dynamic value: `Math.max(50, scrollAreaHeight / (totalHours + 1))`. The grid now fills the available screen height exactly when no classes extend beyond the default 8am–4pm window; scrolling activates automatically if courses push the range wider.

### Session 47g (Seed script: dynamic depts + 2026 Spring only)
- **`scripts/seed-sections.js`** — Replaced hardcoded department list with a live fetch from `GET /v2/rest/websoc/departments`. Now targets only 2026 Spring instead of all quarters. Added `runConcurrent` helper (8 parallel workers) to speed up seeding significantly.

### Session 47f (Fix duplicate plan name on create)
- **`App.tsx`** — `handleCreateTimetable` now scans existing names and picks the first unused letter (Plan A, B, C…) instead of using `quarterTimetables.length` as the index, which caused duplicates after any plan was deleted.

### Session 47e (Promote next plan to 'My Schedule' on delete)
- **`App.tsx`** — `handleDeleteTimetable` now checks if 'My Schedule' still exists in the quarter after deletion. If not, renames the first remaining timetable to 'My Schedule' (Supabase update + local state).

### Session 47d (Scrollable timetable pills row)
- **`src/screens/TimetableScreen.tsx`** — Replaced the plain `View` wrapping timetable pills with a horizontal `ScrollView` so 4+ pills can be scrolled without overlapping the `+ Add` button. `scrollEnabled` is set to `false` while dragging so the PanResponder still captures reorder gestures.

### Session 47c (New user bootstrap + empty-quarter UI)
- **`App.tsx`** — After loading timetables, if the array is empty (new user), auto-creates a `'My Schedule'` timetable for the current quarter instead of leaving the app in an empty state.
- **`src/screens/TimetableScreen.tsx`** — Quarter dropdown button shows `'--'` when `timetables` is empty. "Add Course" row in the add menu is disabled (opacity 0.35) when no timetables exist.

### Session 47b (Quarter dropdown always shows selected quarter)
- **`src/screens/TimetableScreen.tsx`** — Quarter dropdown now seeds its list with `quarterKey(selectedQuarter)` before the timetable keys, so the current quarter always appears even when no timetables exist yet.

### Session 47 (Ensure 'My Schedule' on new quarter)
- **`App.tsx`** — `handleAddQuarter` now selects an existing `'My Schedule'` timetable if one exists for the quarter, otherwise creates a new one. Ensures every newly added quarter always defaults to a 'My Schedule' timetable.

### Session 46 (Persist timetable order)
- **`src/data/courses.ts`** — Added `order: number` field to `Timetable` type.
- **`App.tsx`** — Load: maps `row.order ?? index` and sorts by it so Supabase rows come back in the saved order. Create: sets `order = quarterTimetables.length` (next slot). Save: includes `order` in upsert payload. Added `handleReorderTimetables(orderedIds)`: updates local state + fires individual `UPDATE order` calls to Supabase for each affected row. Passed `onReorderTimetables` prop to `TimetableScreen`.
- **`src/screens/TimetableScreen.tsx`** — Added `onReorderTimetables` prop. Calls it from the pan responder release when the order actually changes.
- **SQL migration required** — Run in Supabase SQL editor: `ALTER TABLE timetables ADD COLUMN IF NOT EXISTS "order" integer DEFAULT 0;`

### Session 45b (Live pill reorder)
- **`src/screens/TimetableScreen.tsx`** — Reworked drag-to-reorder so other pills move in real-time. Key changes: (1) `computePillFlexX` computes a pill's x position from stored widths + gap constant instead of relying on stale `onLayout` values; (2) `dragOriginalFlexX` captures the dragged pill's flex x at long-press start; (3) `onPanResponderMove` now calls `getNewIndexFromDx`, updates `localOrder` immediately when the pill crosses a neighbour's midpoint (wrapped in `LayoutAnimation.configureNext` for smooth animation), and compensates `translateX` by subtracting the flex position shift so the pill stays under the finger; (4) `onPanResponderRelease` just animates scale/translate back to 1/0 then calls `onReorderTimetables`; (5) added `onReorderTimetablesRef` so the PanResponder (created once) always calls the latest prop; (6) added `LayoutAnimation` + Android `UIManager.setLayoutAnimationEnabledExperimental` for smooth neighbour animation.

### Session 45 (Pill drag-to-reorder)
- **`src/screens/TimetableScreen.tsx`** — Added long-press drag-to-reorder for timetable name pills. Long press (400ms) scales the pill up to 1.1× with a spring animation; dragging horizontally moves it with `translateX`; releasing snaps it back to scale 1 and commits the new order. Uses a single `PanResponder` on the pill row container (activates only after long press sets `dragIdRef`). `localOrder` state drives render order; synced from `quarterTimetables` prop when not dragging. `getNewIndex` counts how many other pills' midpoints are to the left of the dragged pill's current midpoint to determine insertion index. `ScrollView` replaced with a plain `View` so the `PanResponder` can capture touches without conflict.

### Session 44b (Grid style overhaul)
- **`src/screens/TimetableScreen.tsx`** — Restyled the timetable grid to match reference design: (1) scroll content background changed from white to `#f5f5f7` (light gray) so grid lines read as gray gaps; (2) day column views now have explicit white (`#ffffff`) backgrounds creating the "white cells on gray grid" look; (3) column separators changed from right-borders to left-borders for cleaner alignment with the day header row; (4) day header borders aligned to match column separators; (5) time labels repositioned from the top of each hour boundary to vertically centered in the middle of each hour block (`top: index * hourHeight + hourHeight/2 - 7`); (6) time labels right-aligned within the time column and the trailing `+1` label hidden (only `totalHours` labels shown, each centered in its slot).

### Session 44 (Save/Share Schedule)
- **`src/screens/TimetableScreen.tsx`** — Added "Save Schedule" and "Share Schedule" buttons to the Timetable Settings sheet. Uses `react-native-view-shot` (`captureRef`) to snapshot the timetable view, `expo-media-library` to save to the photo library (with permission request), and `expo-sharing` to open the system share sheet. Buttons appear side-by-side between "Apply Settings" and "Delete Timetable". Added `timetableRef` on the root View with `collapsable={false}` so the native view is always available to capture.

### Session 48 (Save/Share: wait for settings modal to close)
- **`src/screens/TimetableScreen.tsx`** — Added 350ms delay in `saveSchedule` and `shareSchedule` after `setShowSettings(false)` so the settings modal fully closes before `captureRef` fires. Ensures the screenshot captures the clean timetable grid without the settings sheet overlaid.

### Session 49 (Collapsible current quarter in Grades)
- **`src/screens/GradesScreen.tsx`** — Replaced the always-expanded current quarter course list with the existing `PastQuarterSection` component (`defaultExpanded={true}`). The current quarter now folds/unfolds like past quarters.

### Session 49 (Shared ReviewsModal component)
- **`src/components/ReviewsModal.tsx`** — Created. Self-contained Modal with all reviews logic: grade distribution fetch (Anteater API), Supabase reviews fetch/submit, instructor selector, write review form. Props: `visible`, `onClose`, `courseCode`, `department`, `courseNumber`, `title`, `professors`, `school`, `userId`, `semesterLabel`.
- **`src/screens/CoursePickerScreen.tsx`** — Removed all reviews state/effects/handlers and the full reviews Modal JSX. Replaced with `<ReviewsModal>`. Removed unused `KeyboardAvoidingView`, `Platform` imports.
- **`src/screens/TimetableScreen.tsx`** — Removed all duplicated reviews state/effects/handlers and Animated reviews panel. Replaced with `<ReviewsModal>`. Removed unused `TextInput`, `KeyboardAvoidingView` imports. Reviews now open as a separate Modal when Reviews button is tapped in the course detail sheet.

### Session 49 (Write a Review in TimetableScreen reviews panel)
- **`src/screens/TimetableScreen.tsx`** — Added `userId` prop. Added `TextInput` to RN imports. Added write review state (`showWriteReview`, `newReviewRating/Difficulty/Workload/Content`, `submittingReview`). Added `fetchCourseReviews()` and `handleSubmitReview()`. Reviews panel now has a "Write a Review" footer button and an overlaid write review form (mirrors CoursePickerScreen). Resets `showWriteReview` on panel close.
- **`App.tsx`** — Passes `userId={USER_ID}` to `TimetableScreen`.

### Session 51 (Live weather from Open-Meteo)
- **`src/screens/HomeScreen.tsx`** — Replaced hardcoded `22°`/`72°` and `"Partly Cloudy"` with live data from Open-Meteo API (no key required). Fetches `temperature_2m` and `weathercode` for UCI coordinates on mount. Added `WMO_DESCRIPTIONS` map (WMO codes → label + icon). Temperature converts °C/°F via existing `useCelsius` prop. Shows `'--°'`/`'Loading…'` while fetching. Weather icon updates dynamically.

### Session 50 (BoardScreen — live Supabase posts)
- **`src/screens/BoardScreen.tsx`** — Replaced `MOCK_POSTS` with live Supabase data. Added `school` and `userId` props. `fetchPosts()` queries `posts`, `post_votes`, and `post_comments` in parallel to compute like counts, per-user liked state, and comment counts. `toggleLike()` does optimistic update then inserts/deletes from `post_votes` (composite PK prevents double-voting). `openPost()` lazy-loads comments on tap. `handleCreatePost()` inserts with school scoping. New Post bottom sheet with category picker, title, and body. Empty state shown when no posts exist.
- **`App.tsx`** — Passed `school` and `userId` props to `BoardScreen`.
- **Supabase SQL required** — `ALTER TABLE posts ADD COLUMN author_name text NOT NULL DEFAULT 'Anonymous'; ALTER TABLE post_comments ADD COLUMN author_name text NOT NULL DEFAULT 'Anonymous';`

### Session 49 (RMP button + Reviews for all section types)
- **`src/screens/TimetableScreen.tsx`** — Added `expo-linking` import. Added a small "RMP" pill button inline next to the professor name in the course detail sheet; taps open `https://www.ratemyprofessors.com/search/professors?q=<name>` in the browser. Button is hidden for STAFF/empty professors. Removed `isLec` guard so the Reviews button now shows for all section types (Lec, Lab, Dis, Sem, etc.).
- **`src/screens/CoursePickerScreen.tsx`** — Added `expo-linking` import. Removed `course.sectionLabel?.startsWith('Lec')` guard so the Reviews button appears on every section type. Added a small "RMP" pill button in the section row's right column for non-STAFF professors.

### Session 50 (Settings screen redesign — full sub-screens)
- **`src/screens/SettingsScreen.tsx`** — Full redesign to match Figma design4. Main screen: profile card, ACCOUNT/PREFERENCES/SUPPORT sections, Log Out button (red), ClassMate v1.0.0 footer. Added sub-screens: EditProfile (inline picker rows for year/dept), PrivacySecurityScreen (radio group + Alert for public), NotificationsScreen (Switch toggles), AppearanceScreen (theme + temp unit radio), LanguageRegionScreen (language/timezone/date format), HelpCenterScreen (FAQ categories with drill-down), AboutScreen (logo + links). Internal `screen` state handles navigation without extra Modals.
- **`App.tsx`** — Added `handleLogout()` (resets userId/timetables/authScreen to welcome). Passed `onLogout={handleLogout}` to HomeScreen.
- **`src/screens/HomeScreen.tsx`** — Added `onLogout` prop, forwarded to `<SettingsScreen>`.

### Session 49 (Fix reviews from timetable time block — inline rendering)
- **`src/components/ReviewsModal.tsx`** — Added `inline?: boolean` prop. When true, renders the content View directly without a Modal/KeyboardAvoidingView wrapper. This allows ReviewsModal to be embedded inside another Modal without triggering iOS's nested-Modal blocking.
- **`src/screens/TimetableScreen.tsx`** — Replaced `reviewsCourse` state with `showCourseReviews` boolean. Reviews button sets `showCourseReviews(true)` without closing the detail Modal. `<ReviewsModal inline>` is now rendered inside the detail Modal sheet; when visible it expands the sheet to 90% height and fills it with reviews content. This fixes iOS blocking a second Modal while one is already open.

### Session 50 (Dark mode — ThemeContext + useColorScheme)
- **`src/context/ThemeContext.tsx`** — Created. Defines `ThemePreference` ('light'|'dark'|'auto'), `Colors` type (16 fields), `LIGHT` and `DARK` palettes (Apple HIG-based), `ThemeContext`, `ThemeProvider` (respects auto via `useColorScheme()`), and `useTheme()` hook.
- **`App.tsx`** — Renamed inner component to `AppContent` (accepts `themePreference`/`onThemeChange` props, calls `useTheme()`). New default export `App()` owns `themePreference` state, wraps `AppContent` in `ThemeProvider`. Tab bar, root view, and tab wrapper backgrounds use theme colors.
- **`src/screens/SettingsScreen.tsx`** — All sub-components call `useTheme()`. `AppearanceScreen` wired to `themePreference`/`onThemeChange` props so the theme radio group actually applies globally.
- **`src/screens/HomeScreen.tsx`** — `useTheme()` applied throughout; `themePreference`/`onThemeChange` forwarded to SettingsScreen.
- **`src/screens/TimetableScreen.tsx`** — `useTheme()` applied to all chrome/modal UI; timetable grid's own `settings.theme` logic intentionally unchanged.
- **`src/screens/GradesScreen.tsx`** — `useTheme()` applied throughout all sub-components (GpaChart, GradeBadge, GradePickerModal, PastQuarterSection, main screen).
- **`src/screens/BoardScreen.tsx`** — `useTheme()` applied to both the post detail view and the posts list / new post sheet.
- **`src/screens/FriendsScreen.tsx`** — `useTheme()` applied to friend timetable view, add-friend modal, and the friends/requests list. Course block colors unchanged.
- **`src/screens/MessagesScreen.tsx`** — `useTheme()` applied to chat view and chat list; own-message bubbles use `colors.brand`.
- **`src/components/ReviewsModal.tsx`** — `useTheme()` applied to sheet background, grade distribution panel, review cards, and write-review form.
- **`src/components/PreviewTimetable.tsx`** — `useTheme()` applied to container border/bg, day header row, time labels, and grid lines. Course block colors unchanged.

### Session 51 (New Post modal redesign)
- **`src/screens/BoardScreen.tsx`** — Replaced bottom-sheet New Post panel with a full `Modal` (pageSheet). Added Board dropdown (shows all BOARDS with icon + checkmark), red asterisks on Board/Title/Content, tall Content field (minHeight 160), Attachments section (Add Images + Add Files buttons, UI only), Post Options section (Prevent Edit/Delete Switch), and Cancel/Post footer buttons side by side. Extracted `NewPostModal` as a separate function component. Replaced `newPostCategory` state with `newPostBoardId`; category is derived from board at submit time. Added `openNewPost(boardId?)` helper that pre-selects the current board when called from a board detail screen.

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

- The "Wizard" and "Add manually" buttons in course picker (not wired up)

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

### Session 52 (Messages hardcoded data removed)
- **`src/screens/MessagesScreen.tsx`** — Removed `MOCK_CHATS` and `MOCK_MESSAGES` constants. Initial state for `chats` and `messages` now starts empty (`[]` and `{}`). Chat list shows "No messages found" until real Supabase data is wired in.

### Session 52 (ClassMates — Edit mode + delete friend)
- **`src/screens/FriendsScreen.tsx`** — Added `editMode` boolean state. Added "Edit"/"Done" pill button at the far right of the tab row. In edit mode, the timetable button and paper plane icon are hidden; a red trash icon appears instead. Tapping trash shows a confirmation alert then calls `handleDeleteFriend`. `handleDeleteFriend` updates both directions of the `friend_requests` row to `status = 'rejected'` (two parallel `.update()` calls) instead of deleting, to avoid RLS delete issues. `sendFriendRequest` now uses `.upsert()` with `onConflict: 'sender_id,receiver_id'` so re-adding a previously removed friend updates the existing `rejected` row back to `pending` instead of hitting the unique constraint. Re-add check now filters `.in('status', ['pending', 'accepted'])` so rejected rows don't block re-requesting.
- **Supabase SQL required** — `CREATE POLICY "Users can update their own friend requests" ON friend_requests FOR UPDATE USING (sender_id = auth.uid() OR receiver_id = auth.uid());`

### Session 53 (AsyncStorage caching — grades, weather, sports, board, classmates)
- **`src/screens/GradesScreen.tsx`** — Added `AsyncStorage` cache (`grades_${userId}`). Loads cache first on mount for instant display, then fetches Supabase in background. `handleSetGrade` updates cache on every save.
- **`src/screens/HomeScreen.tsx`** — Added `AsyncStorage` cache for weather (`weather_cache`) and sports events (`sports_cache`). Both load cache instantly then refresh in background. Sports cache revives `date` fields with `new Date(e.date)` to restore Date objects lost during JSON serialization.
- **`src/screens/BoardScreen.tsx`** — Added `AsyncStorage` cache (`board_posts_${school}_${userId}`). Cache key includes school and userId so liked state is correct per user. Shows cached posts instantly; spinner only shown on first ever load.
- **`src/screens/FriendsScreen.tsx`** — Added `AsyncStorage` cache (`classmates_${userId}`) storing friends, pendingRequests, sentRequests, and sentRequestIds together. Loads cache instantly, fetches Supabase in background.

### Session 53 (Friend requests — sent requests visible + cancel)
- **`src/screens/FriendsScreen.tsx`** — Added `sentRequests: PendingFriend[]` state (full profile data for outgoing pending requests, previously only IDs were stored). Populated in `loadClassmates` and updated when a request is sent. Requests tab now has two sections: RECEIVED (accept/reject) and SENT (cancel button). `handleCancelRequest` deletes the row from Supabase and removes from local state. Badge count on Requests pill reflects both received + sent. `handleDeleteFriend` now also clears from `sentRequestIds`.

### Session 53 (Friend requests — proper deletion)
- **`src/screens/FriendsScreen.tsx`** — `handleRespondToRequest` for rejected status now DELETEs the row instead of updating to rejected. `handleDeleteFriend` now DELETEs both directions instead of updating to rejected. `sendFriendRequest` reverted to plain INSERT. Re-add check now fetches all rows and filters in JS (avoids PostgREST `.or()` + `.in()` composition issues).
- **Supabase SQL required** — `CREATE POLICY "Users can delete their own friend requests" ON friend_requests FOR DELETE USING (sender_id = auth.uid() OR receiver_id = auth.uid());`

### Session 53 (Board — New Post pill size)
- **`src/screens/BoardScreen.tsx`** — Main board screen "New Post" pill resized to match the one inside a specific board: `paddingHorizontal: 14`, `paddingVertical: 8`, `gap: 5`, `fontSize: 13`.

### Session 51 (New Post modal redesign)
- **`src/screens/BoardScreen.tsx`** — Replaced bottom-sheet New Post panel with a full `Modal` (pageSheet). Added Board dropdown (shows all BOARDS with icon + checkmark), red asterisks on Board/Title/Content, tall Content field (minHeight 160), Attachments section (Add Images + Add Files buttons, UI only), Post Options section (Prevent Edit/Delete Switch), and Cancel/Post footer buttons side by side. Extracted `NewPostModal` as a separate function component. Replaced `newPostCategory` state with `newPostBoardId`; category is derived from board at submit time. Added `openNewPost(boardId?)` helper that pre-selects the current board when called from a board detail screen.

### Session 54 (ClassMates top bar color fix)
- **`App.tsx`** — Changed the FriendsScreen wrapper `backgroundColor` from `colors.bgSecondary` to `colors.bg` so the dynamic island / status bar area matches the rest of the screen.

### Session 54 (Hide Edit pill on Requests tab)
- **`src/screens/FriendsScreen.tsx`** — Edit/Done pill is now hidden when `activeTab === 'requests'`.

### Session 54 (Reviews — quarter field)
- **`src/components/ReviewsModal.tsx`** — Added `quarterTaken` state. Quarter picker rendered as a horizontal scroll of pill buttons using `[...QUARTERS].reverse()`. Quarter value included in Supabase INSERT payload (`quarter: quarterTaken`). Review cards display the quarter label (e.g. "Spring 2026") alongside rating/difficulty/workload.
- **Supabase SQL required** — `ALTER TABLE reviews ADD COLUMN quarter TEXT;`

### Session 54 (Reviews — edit/delete own reviews)
- **`src/components/ReviewsModal.tsx`** — Added `editingReviewId` state. `CourseReview` type includes `userId` field (mapped from `r.user_id`). Edit icon (pencil) and delete icon (trash) shown only on cards where `review.userId === userId`. Tapping edit pre-fills all form fields and sets `editingReviewId`; submit does UPDATE instead of INSERT. Tapping delete shows confirmation Alert then DELETEs the row and re-fetches. Shows Alert with error message on any Supabase failure.
- **Supabase SQL required** — UPDATE policy: `CREATE POLICY "Users can update own reviews" ON reviews FOR UPDATE USING (user_id = auth.uid()::text);` DELETE policy: `CREATE POLICY "Users can delete own reviews" ON reviews FOR DELETE USING (user_id = auth.uid()::text);`

### Session 54 (Reviews — remove Anonymous author label)
- **`src/components/ReviewsModal.tsx`** — Removed the author name line from review cards entirely. Cards now show only rating/difficulty/workload badges and the review content text.

### Session 54 (Grade distribution bars — color fill only)
- **`src/components/ReviewsModal.tsx`** — Removed gray background track from grade distribution bars; each bar now shows only the colored portion. P/NP entries are filtered out only when both are at exactly 0%; all letter grades (A+, A, A-, B+…) are shown even at 0%.

### Session 54 (Home screen — current quarter courses only)
- **`App.tsx`** — Added `CURRENT_QUARTER_KEY = '2026-Spring'`. Derived `currentQuarterCourses` as courses from all timetables matching that quarter key. Passes `currentQuarterCourses` to HomeScreen as `activeCourses`.
- **`src/screens/HomeScreen.tsx`** — "Your Day" and "Coming Up" sections now use `activeCourses` (which is always `2026-Spring` courses) regardless of which timetable quarter the user has selected on the Timetable screen.

### Session 54 (Live daily quote — ZenQuotes API)
- **`src/screens/HomeScreen.tsx`** — Replaced hardcoded `QUOTES` array with live fetch from `https://zenquotes.io/api/today`. Response is `[{ q: string, a: string }]`. Quote cached in AsyncStorage under key `quote_cache` with the date as a sub-key; only re-fetches when the calendar day changes. Shows blank text while loading.

### Session 54 (Campus Events — thicker day-change dividers)
- **`src/screens/HomeScreen.tsx`** — Added `isDayChange` boolean per event: true when the event's date is different from the previous event's date. Day-change dividers render with `height: 2.5` and `colors.border`; same-day dividers use `height: 1` and `colors.borderSubtle`.

### Session 54 (COMPARISON.md created)
- **`COMPARISON.md`** — New file comparing ClassMate vs AntAlmanac feature-by-feature across 8 categories (Schedule Building, Calendar View, Course Information, Grades, Notifications, Import/Export, Map, Social). Includes "What ClassMate Has Uniquely" summary and prioritized additions list (🔴 .ics export, notifications, advanced filters, share link; 🟡 finals view, enrollment history, WebReg import, custom events; 🟢 undo/redo, planner, real DMs, PWA).

### Session 54 (Friend timetable crash — TBA course guard)
- **`src/screens/FriendsScreen.tsx`** — Added `isValidTime(t)` helper: returns `false` for undefined, `'TBA'`, or strings without `' - '`. `activeCourses` for friend timetable filtered with `isValidTime(c.time) && c.days !== 'TBA'` before any grid calculations. `parseHour` guarded: returns `0` immediately for undefined or non-time strings. Prevents crash when `split(' - ')` was called on `undefined`.

### Session 54 (Friend quarter dropdown — empty quarters hidden)
- **`src/screens/FriendsScreen.tsx`** — Friend's quarter dropdown now only shows quarters where `friend.timetables[quarterKey(q)]?.length > 0`, eliminating empty quarter options that appeared when a friend had placeholder timetable keys with no courses.

### Session 55 (CoursePickerScreen — GE category filter)
- **`src/screens/CoursePickerScreen.tsx`** — Added `selectedGE` state and `GE_CATEGORIES` constant (10 UCI GE categories, codes match Anteater API `geCategories[]` format: `GE-1A`, `GE-1B`, `GE-2`…`GE-8`). Dept fetch `useEffect` now handles both `selectedDept` (`.eq('department')`) and `selectedGE` (`.contains('ge_categories', [code])`). `isGlobalSearch` and global search effect both guard on `!selectedGE`. Department picker modal retitled "Department or GE"; FlatList gets a `ListHeaderComponent` with a "GE CATEGORIES" section (all 10 rows, searchable via `filteredGECategories`) above a "DEPARTMENTS" divider. Dropdown button shows full GE label when a category is active. Selecting a GE clears dept and vice versa; X clears both. Requires `ge_categories text[] DEFAULT '{}'` column + re-seeded data.

### Session 55 (CoursePickerScreen — cross-department global search)
- **`src/screens/CoursePickerScreen.tsx`** — Added global search mode: when `searchText.length >= 2` and no department is selected, queries Supabase `.or('code.ilike,title.ilike,professor.ilike')` across all departments (debounced 400ms, limit 300 rows). Results grouped and sorted (by department, then course number) in a separate `globalCatalog`/`globalSectionsMap` state. `isGlobalSearch` flag drives which state the FlatList and ReviewsModal use. `buildCatalogFromRows()` helper extracted to deduplicate per-dept and global data-building logic. Empty state now shows "Search by course name, code, or professor" hint with icon. Searching within a selected department still uses client-side filtering (existing behavior).

### Session 54 (Privacy settings — remove Public option)
- **`src/screens/SettingsScreen.tsx`** — Removed the "Public" visibility option from the Privacy & Security screen. Options array now only contains `friends` and `private`. Removed the confirmation Alert that was tied to the public option; `handleSelect` now sets visibility directly.

### Session 55 (Timetable grid — horizontal lines extend through time column)
- **`src/screens/TimetableScreen.tsx`** — Grid hour lines now extend all the way to the left edge of the screen. Changed `left: 0` to `left: -(TIME_LABEL_WIDTH + GRID_LEFT_PAD)` on the absolute-positioned hour lines in the day columns container. Removed the duplicate lines that were drawn separately inside the time label column.

### Session 54 (TimetableScreen — academic year group dividers in quarter dropdown)
- **`src/screens/TimetableScreen.tsx`** — Quarter dropdown rows now have academic-year group dividers. Added `academicYear(qk)` function: `quarter === 'Fall' ? year : year - 1`. Built sorted array of quarter keys first, then mapped with index; `isNewGroup = index > 0 && academicYear(qk) !== academicYear(sorted[index - 1])`. Group boundary rows get `borderTopWidth: 2, borderTopColor: colors.border`; non-boundary rows get `borderTopWidth: 1, borderTopColor: colors.borderSubtle`. Groups: Fall 2024/Winter+Spring 2025 = AY 2024; Fall 2025/Winter+Spring 2026 = AY 2025; Fall 2026 = AY 2026.

### Session 55 (CoursePickerScreen — GE sublist drill-down in department modal)
- **`src/screens/CoursePickerScreen.tsx`** — Replaced the flat GE rows in the dept picker with a single "GE Categories ›" row. Tapping it sets `showGESublist(true)`, replacing the dept list with a GE-only FlatList and a back chevron in the header. Back button clears `deptSearch` and returns to dept list. Closing via X clears both `selectedDept` and `selectedGE`.

### Session 55 (seed-sections.js — GE categories + extra columns)
- **`scripts/seed-sections.js`** — Added 8 new fields to each row: `dept_name`, `instructors`, `meetings`, `ge_categories`, `final_exam`, `restrictions`, `prerequisite_link`, `section_comment`. Added `GE_CODES` constant and `seedGECategories(year, quarter)` function: makes 10 API calls per quarter (`?ge=GE-1A` etc.), builds sectionId→Set map, bulk-upserts `ge_categories[]` into Supabase. `seedGECategories` called after each `seedQuarter`.

### Session 55 (SettingsScreen — Edit Profile improvements)
- **`src/screens/SettingsScreen.tsx`** — Added `UCI_MAJORS` array (83 majors). `DropdownPicker` updated: `searchable` prop, search TextInput (autoFocus), `FlatList` instead of ScrollView, `maxHeight: '75%'`. "Department" label changed to "Major"; options set to `UCI_MAJORS`. `field` helper extended: accepts `inputProps` (spread onto TextInput) and `error` (border turns red, error text shown below). Nickname: `autoCapitalize: 'none'`. DOB: `keyboardType: 'number-pad'`, auto-format slashes (`MM/DD/YYYY`), `validateDOB` validates month/day/year ranges, save blocked with Alert if invalid. `EditProfileScreen` restructured: outer View + SubHeader, `KeyboardAvoidingView` wraps only the ScrollView (so Save button stays above keyboard). `scrollRef` + `keyboardDidShow` listener scrolls to DOB field when keyboard appears; `keyboardWillHide` listener clears `keyboardVisible` to avoid bounce.

### Session 55 (CoursePickerScreen — dept modal keyboard fix)
- **`src/screens/CoursePickerScreen.tsx`** — Replaced `KeyboardAvoidingView` approach with `Keyboard.addListener('keyboardWillShow/Hide')` to track keyboard height. Sheet `marginBottom: keyboardHeight - 34` lifts it above keyboard; `maxHeight` shrinks to fit remaining space when keyboard is open. Fixed missing closing tag from prior session.

### Session 55 (FriendsScreen — timetable grid matches TimetableScreen)
- **`src/screens/FriendsScreen.tsx`** — Rewrote friend timetable grid to exactly match TimetableScreen layout: removed outer card wrapper, changed `TIME_LABEL_WIDTH` 52→44, added `GRID_LEFT_PAD=16`, added `paddingLeft: GRID_LEFT_PAD` to header and grid rows, added `borderBottomWidth:1` to day header, changed time labels to centered-in-slot (`height: hourPx, justifyContent: 'center'`), hour lines now extend from `left: -(TIME_LABEL_WIDTH + GRID_LEFT_PAD)`, grid uses `flex: 1` + `onLayout` for dynamic height instead of fixed height. TBA pills moved outside grid frame.

### Session 56 (Settings — safe area top inset for sub-screens)
- **`src/screens/SettingsScreen.tsx`** — Added `useSafeAreaInsets` import. Both the main settings header and `SubHeader` now use `insets.top + 12` for `paddingTop` instead of a fixed 20px, so content clears the status bar / dynamic island when Settings is rendered as a full-screen absolute overlay.

### Session 56 (Home — scroll past dock)
- **`src/screens/HomeScreen.tsx`** — Added `bottomInset` prop. `contentContainerStyle.paddingBottom` set to `bottomInset + 70` so the last card scrolls above the dock.
- **`App.tsx`** — Passes `bottomInset={insets.bottom}` to `HomeScreen`.

### Session 57 (TimetableScreen — Dark theme only darkens the grid, not the screen)
- **`src/screens/TimetableScreen.tsx`** — Outer wrapper `backgroundColor` changed from `theme === 'dark' ? '#0f172a' : '#fff'` to `colors.bg` so the screen background always follows the app theme. TBA section background changed from dark-conditional to `'transparent'`. The dark color now applies only to `gridFrameBg`/`gridHeaderBg` inside the grid card itself.

### Session 57 (ReviewsModal — native pageSheet)
- **`src/components/ReviewsModal.tsx`** — Converted from `transparent` + manual dark backdrop to `presentationStyle="pageSheet"`. Removed outer backdrop `View` and `rgba(0,0,0,0.5)` background. Removed top border radius (iOS sheet handles rounded corners natively). iOS now handles background dimming, scaling, and swipe-to-dismiss automatically.

### Session 57 (TimetableScreen — close settings modal on outside tap)
- **`src/screens/TimetableScreen.tsx`** — Wrapped the settings modal backdrop in a `TouchableOpacity` that calls `setShowSettings(false)`. Inner sheet wrapped in a second `TouchableOpacity` with a no-op `onPress` to stop propagation.

### Session 57 (Select Quarter modal — animated height transition)
- **`src/screens/TimetableScreen.tsx`** — Added `contentHeightAnim` (`Animated.Value`, `useNativeDriver: false`) and `yearListHeightRef`. Heights pre-calculated as `Math.min(360, count * 53)` (53px/row = paddingVertical:16×2 + lineHeight). `openAddQuarterModal` sets initial height and stores in `yearListHeightRef`. `drillIntoYear` springs both `addYearSlideAnim` and `contentHeightAnim` in parallel. `drillBackToYears` springs both back simultaneously. Quarter list wrapped in `Animated.View` (not `Animated.ScrollView`) so `panHandlers` don't conflict with the inner `ScrollView` touch handling. Container is `Animated.View style={{ height: contentHeightAnim, overflow: 'hidden' }}`.

### Session 57 (Select Quarter modal — swipe-back from quarter list)
- **`src/screens/TimetableScreen.tsx`** — Added `addQuarterSwipePan` PanResponder (same pattern as SettingsScreen): activates on rightward horizontal-dominant drag, moves `addYearSlideAnim` with the finger, calls `drillBackToYears()` if dx > 35% screen width or vx > 0.6, otherwise springs back to 0. Pan handlers spread onto the `Animated.ScrollView` in the quarter drill-down.

### Session 57 (Select Quarter modal — year groups + drill-down)
- **`src/screens/TimetableScreen.tsx`** — Redesigned Add Quarter modal to show a year list first. Tapping a year slides in a quarter list from the right (`addYearSlideAnim` Animated.Value, spring in / timing out). Header shows a back chevron + "Years" when drilled in. `drillIntoYear(year)` and `drillBackToYears()` manage the slide animation and `selectedAddYear` state. Year rows show the count of available quarters. Quarter rows show the quarter name + a blue add icon. `closeAddQuarterModal` resets both `selectedAddYear` and the slide anim.

### Session 57 (Select Quarter modal — cache seeded quarters)
- **`src/screens/TimetableScreen.tsx`** — Added `seededQuartersCache` ref. On first open, fetches which quarters have data in Supabase and caches the result. On subsequent opens, skips the network calls entirely and computes the available list instantly from the cache.

### Session 57 (Select Quarter modal — native slide-up animation)
- **`src/screens/TimetableScreen.tsx`** — Replaced custom `addQuarterSlideAnim` + `useEffect` + `Animated.View` approach with `animationType="slide"` on the Modal. Removed `addQuarterSlideAnim` ref, the `useEffect` for it, and changed `Animated.View` back to plain `View`. `closeAddQuarterModal` now just calls `setShowAddQuarterModal(false)`. Native iOS slide-up handles the animation reliably.

### Session 57 (ReviewsModal — restrictions decoded + section comment)
- **`src/components/ReviewsModal.tsx`** — Added `RESTRICTION_LABELS` map and `decodeRestrictions()` helper that splits raw letter codes (e.g. `"EG"`) into human-readable labels (e.g. "Engineering, Graduate students only"). Added `sectionComment` to `CourseInfo` type; `fetchCourseInfo` now also selects `section_comment`. Info section order: Restrictions → Final Exam → Prerequisites → Note (section_comment, shown only when non-empty).

### Session 57 (ReviewsModal — finals, restrictions, prerequisites)
- **`src/components/ReviewsModal.tsx`** — Added `CourseInfo` type and `courseInfo` state. Added `fetchCourseInfo()`: queries Supabase `sections` table for `final_exam`, `restrictions`, `prerequisite_link` by `code = courseCode`. Called on modal open. Renders a new section in the ScrollView between the header and grade distribution: final exam (calendar icon), restrictions (lock icon), prerequisites (link icon, tappable — opens URL in browser via `Linking.openURL`). Section hidden entirely when all three fields are null/empty.

### Session 58 (Fix: Invalid Refresh Token on startup)
- **`App.tsx`** — Added startup `useEffect` that calls `supabase.auth.getSession()`; if it returns an error (stale/invalid refresh token in AsyncStorage), calls `supabase.auth.signOut()` to clear it. Added `supabase.auth.signOut()` call to `handleLogout` so the persisted session is wiped on explicit logout, preventing the error on next cold start.

### Session 56 (Settings — slide-in sub-screens + swipe-back)
- **`src/screens/SettingsScreen.tsx`** — Added `Animated`, `PanResponder`, `Dimensions` to RN imports. Added `slideAnim` Animated.Value (starts at screen width). `navigateTo(screen)` resets slide to off-screen right then spring-animates to 0. `goBack()` timing-animates slide to off-screen right then resets screen to 'main'. `swipePan` PanResponder: activates on horizontal-dominant rightward drag, moves `slideAnim` with finger, on release triggers `goBack()` if dx > 35% screen width or velocity > 0.6, otherwise springs back. Sub-screen wrapped in `Animated.View` with `transform: [{ translateX: slideAnim }]` and `{...swipePan.panHandlers}`. All `setScreen(...)` calls in section items replaced with `navigateTo(...)`. All `onBack={() => setScreen('main')}` in sub-screen props replaced with `onBack={goBack}`.

### Session 58 (FriendsScreen — TBA block moved below grid)
- **`src/screens/FriendsScreen.tsx`** — Moved the TBA courses pill row from above the timetable grid to below it, so it renders between the grid card and the view-only banner.

### Session 58 (AuthNavigator — duplicate key fix + pushAuth guard)
- **`App.tsx`** — Changed `key={screen}` to `key={`${index}-${screen}`}` in `AuthNavigator`'s stack map so duplicate screen names (e.g. double-tapping "Get Started" pushing `'university'` twice) don't cause a React duplicate-key error. Added guard to `pushAuth`: returns existing stack unchanged if the requested screen is already on top, preventing double-pushes.

### Session 58 (AuthNavigator — back-button slide-out)
- **`App.tsx`** — `renderScreen` signature extended to `(s: AuthScreen, goBack: () => void) => React.ReactNode`. `AuthNavigator` passes its own animated `goBack` as the second arg when calling `renderScreen`, and all auth screen `onBack` props now receive this animated version instead of raw `popAuth`. Fixes the back button on University Selection (and Sign In / Sign Up) not triggering the slide-out animation.

### Session 58 (Board — Request New Board modal + admin inbox)
- **`src/screens/BoardScreen.tsx`** — Added `showRequestBoard`, `requestBoardName`, `requestBoardDesc`, `submittingBoardRequest` state. Wired "Request New Board" button `onPress`. Added `submitBoardRequest()`: validates name, inserts into Supabase `board_requests` table (`requester_id`, `school`, `name`, `description`). Added `RequestBoardModal` component (bottom-sheet modal with Board Name + Brief Description fields and Cancel/Request buttons).
- **`src/screens/SettingsScreen.tsx`** — Added `'board_requests'` to `Screen` type. Added `BoardRequestsScreen` component: fetches from `board_requests` table, shows name/description/requester/status, status action buttons. Added moderator-only `ADMIN` section to main Settings with "Reports Inbox" and "Board Requests" items (replaces old inline Reports Inbox entry in SUPPORT). `ModerationScreen` reverted to only query `reports` table. `ModerationReport` type cleaned up (removed `source` field).
- **Supabase SQL required** — Create `board_requests` table (see session notes for SQL).

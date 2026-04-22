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

### Session 49 (RMP button + Reviews for all section types)
- **`src/screens/TimetableScreen.tsx`** — Added `expo-linking` import. Added a small "RMP" pill button inline next to the professor name in the course detail sheet; taps open `https://www.ratemyprofessors.com/search/professors?q=<name>` in the browser. Button is hidden for STAFF/empty professors. Removed `isLec` guard so the Reviews button now shows for all section types (Lec, Lab, Dis, Sem, etc.).
- **`src/screens/CoursePickerScreen.tsx`** — Added `expo-linking` import. Removed `course.sectionLabel?.startsWith('Lec')` guard so the Reviews button appears on every section type. Added a small "RMP" pill button in the section row's right column for non-STAFF professors.

### Session 50 (Read-only friend timetable + email search)
- **`src/screens/FriendsScreen.tsx`** — Removed the friend timetable `+ Add` action and the course-picker editing path so friend schedules are clearly read-only. Added a read-only notice banner in the friend timetable header.
- **`src/screens/FriendsScreen.tsx`** — Replaced the add-friend modal fields (`name`, `major`, `year`) with an email search flow. Users are now found by university email, shown as search results, and can be added directly from the result list. Friend list and request rows now also show email addresses.
- **`App.tsx`** — Passed the signed-in user's `userEmail` into `FriendsScreen` so the email search can exclude the current user from results.

### Session 50b (Clarify friend search modal)
- **`src/screens/FriendsScreen.tsx`** — Split the friend-add modal into clearly labeled explanation, email input, and search-results sections so the helper copy no longer looks like another text field. Added a mail-icon input row and clearer empty/no-result messages to make the user-search flow easier to understand.

### Session 51 (Supabase-backed classmates)
- **`App.tsx`** — Added a `profiles` upsert on sign-in so each authenticated user gets a basic profile row (`id`, `email`, `name`, `school`) before using ClassMates. Passed `userId` and `school` into `FriendsScreen`.
- **`src/screens/FriendsScreen.tsx`** — Replaced mock classmates data with Supabase-backed loading. The screen now loads accepted friends from `friend_requests`, fetches matching `profiles`, pulls their `timetables`, and loads incoming pending requests from Supabase.
- **`src/screens/FriendsScreen.tsx`** — Email search now queries `profiles` by school and email, excludes the current user / existing friends / pending requests, and sends real `friend_requests` rows with a `Send Request` action. Request accept/reject actions now update Supabase instead of only local state.
- **Supabase SQL required** — Create `profiles` and `friend_requests` tables before this feature can work end-to-end. Example minimum schema:
  `create table if not exists profiles (id uuid primary key references auth.users(id) on delete cascade, email text not null unique, name text, major text, year text, school text not null default 'UC Irvine', updated_at timestamptz not null default now());`
  `create table if not exists friend_requests (id uuid primary key default gen_random_uuid(), sender_id uuid not null references profiles(id) on delete cascade, receiver_id uuid not null references profiles(id) on delete cascade, status text not null default 'pending' check (status in ('pending','accepted','rejected')), created_at timestamptz not null default now(), unique (sender_id, receiver_id));`

### Session 52 (Maps button in course detail)
- **`src/screens/TimetableScreen.tsx`** — Added a `Maps` action to the course detail bottom sheet between `Reviews` and `Remove Course`. When a course has a real location, the button opens a map search for that location plus the current school (for UCI, it biases the query toward UC Irvine). The button is hidden for `Online`, `Remote`, or `TBA` locations.

### Session 53 (In-app mini map preview)
- **`src/data/uciLocations.ts`** — Added a small UCI building-code to coordinate map plus a helper that resolves common room strings like `DBH 6011` or `SSL 140` into building coordinates.
- **`src/screens/TimetableScreen.tsx`** — Added `react-native-maps` and an in-app mini map card to the course detail bottom sheet. When a UCI location can be resolved, the sheet now shows a static map preview plus the building name before the action buttons. Web keeps a graceful fallback card while native shows the actual map.

### Session 53b (Apple Maps handoff from mini map)
- **`src/screens/TimetableScreen.tsx`** — Made the mini map card tappable so it opens Apple Maps directly from the course detail sheet. When the in-app map preview is available, the separate `Maps` button is now hidden to avoid duplicate actions; the button remains only as a fallback for unmapped but valid locations.

### Session 53c (Use building names for map search)
- **`src/screens/TimetableScreen.tsx`** — Adjusted Apple Maps handoff so mapped UCI locations search by the resolved building name instead of the raw room string. This avoids sending queries like `DBH 6011` when the app already knows the building is Donald Bren Hall.

### Session 53d (Safe Maps fallback)
- **`src/screens/TimetableScreen.tsx`** — Reworked the map-opening logic to try Apple Maps with the native `maps://` scheme first, then fall back to a web map search if Apple Maps is unavailable. Added error handling so failed map launches no longer surface as uncaught promise errors in the app.

### Session 53e (Fix SSTR mapping and map query order)
- **`src/data/uciLocations.ts`** — Added `SSTR` as an alias for Social Science Tower so `SSTR` locations resolve to the same building coordinates as `SST`.
- **`src/screens/TimetableScreen.tsx`** — Changed map query formatting to put the school name first (`UC Irvine <building>`) for both Apple Maps and web fallback searches, improving building lookup accuracy on campus.

### Session 53f (Avoid dev redbox on map-open failure)
- **`src/screens/TimetableScreen.tsx`** — Changed the map fallback flow to check `canOpenURL` before opening the web map URL and removed the hard `console.error` on failure. Map-open failures now show only a user-facing alert instead of throwing a persistent development redbox.

### Session 53g (Open mapped buildings by coordinates)
- **`src/screens/TimetableScreen.tsx`** — Updated the map launcher so UCI buildings with known coordinates open Apple Maps by latitude/longitude instead of text search. Unmapped locations still fall back to text search, but mapped buildings now land on the correct place more reliably.

### Session 53h (Avoid false map failure alerts)
- **`src/screens/TimetableScreen.tsx`** — Removed the `canOpenURL` gate from the Apple Maps/web map flow and now tries `openURL` directly. This avoids false “Could not open Maps” alerts on devices/simulators where the URL opens successfully but `canOpenURL` reports unreliably.

### Session 54 (Legal docs, support mail, and guest ClassMates guard)
- **`src/components/LegalDocumentModal.tsx`** — Added a reusable in-app legal document modal for Terms of Service, Privacy Policy, and Open Source Licenses so the app now has actual tappable legal content instead of dead text rows.
- **`src/components/LegalConsentText.tsx`** — Added a shared inline consent component with tappable legal links for auth screens.
- **`src/screens/WelcomeScreen.tsx`**, **`src/screens/SignInScreen.tsx`**, **`src/screens/SignUpScreen.tsx`** — Replaced plain “Terms of Service / Privacy Policy” copy with tappable legal links that open the new modal documents directly in-app.
- **`src/screens/SettingsScreen.tsx`** — Wired `Help Center` → `Contact Support` to open the device mail app via `mailto:` and made `About` rows open the new in-app legal/license modal.
- **`App.tsx`** — Added a sign-in-required alert when guest users tap the `ClassMates` tab so the app explains why social features are unavailable before entering that flow.
- **`src/screens/FriendsScreen.tsx`** — Normalized guest detection so all dev guest accounts (`guest`, `guest2`, etc.) are treated consistently when loading/searching/sending ClassMates data.

### Session 54b (Tighten welcome-screen legal line)
- **`src/components/LegalConsentText.tsx`** — Added optional `fontSize` and `lineHeight` props so auth screens can fine-tune the legal consent line without duplicating the component.
- **`src/screens/WelcomeScreen.tsx`** — Reduced the consent line size and spacing on the first screen so the “By continuing…” copy sits more cleanly on a single line where space allows.

### Session 55 (Persist settings profile/privacy/notifications)
- **`src/data/userPreferences.ts`** — Added shared profile/settings types, defaults, and helpers for editable profile data, timetable visibility, notification preferences, push permission state, and display-name generation.
- **`App.tsx`** — Added signed-in user preference loading from Supabase (`profiles` + `user_settings`), plus save handlers for profile edits, timetable visibility, and notification preferences. Added real push-permission requests through `expo-notifications`, guest-safe fallbacks, and state wiring for the Settings screen.
- **`src/screens/HomeScreen.tsx`** — Passed live profile/settings state and save callbacks down into Settings so the Home avatar sheet reflects the signed-in user’s stored data.
- **`src/screens/SettingsScreen.tsx`** — Reworked `Edit Profile`, `Privacy & Security`, and `Notifications` into real save flows. Profile edits now persist, timetable visibility now saves, and notification settings now request device push permission before enabling push notifications. Added permission-status messaging and a shortcut to system settings when push access is denied.
- **`package.json` / `package-lock.json`** — Added `expo-notifications` for native push-permission integration.
- **Supabase SQL required** — Create a `user_settings` table before this feature can work end-to-end. Example minimum schema:
  `create table if not exists user_settings (user_id uuid primary key references profiles(id) on delete cascade, timetable_visibility text not null default 'friends' check (timetable_visibility in ('friends','private','public')), notification_settings jsonb not null default '{}'::jsonb, profile_details jsonb not null default '{}'::jsonb, push_permission_status text not null default 'undetermined', updated_at timestamptz not null default now());`
  `alter table user_settings enable row level security;`
  `create policy "user_settings_select_own" on user_settings for select to authenticated using (auth.uid() = user_id);`
  `create policy "user_settings_upsert_own" on user_settings for insert to authenticated with check (auth.uid() = user_id);`
  `create policy "user_settings_update_own" on user_settings for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);`

### Session 55b (Support contact fallback)
- **`src/screens/SettingsScreen.tsx`** — Changed `Contact Support` so mail-open failure no longer ends in a dead-end alert. When Mail is unavailable, the Help Center now shows an inline fallback card with a selectable support email address the user can copy manually.

### Session 56 (Unify timetable header and grid surface)
- **`src/screens/TimetableScreen.tsx`** — Reworked the timetable layout so the title row, quarter controls, plan pills, optional TBA pills, and the grid all live inside one rounded surface instead of feeling like separate white sections stacked on top of each other. The page background now softly frames the timetable card, making the top controls and schedule read as one cleaner, continuous block.

### Session 57 (Enforce timetable visibility and schedule real reminder notifications)
- **`App.tsx`** — Added signed-in reminder scheduling through `expo-notifications`. The app now reschedules upcoming class reminders and UCI sports reminders on-device using the user’s saved notification preferences, reminder lead times, and push-permission status. Added Android channel setup, guest-safe fallbacks, and logout cleanup so scheduled reminders do not linger across sessions.
- **`src/data/userPreferences.ts`** — Extended notification preferences with `classReminderMinutes` and `sportsGameReminderMinutes`, plus defaults used across Settings and notification scheduling.
- **`src/data/sportsEvents.ts`** — Added a shared UCI athletics calendar parser/formatter so the same sports-event data can drive both the Home screen list and scheduled sports reminders without duplicating ICS parsing logic.
- **`src/screens/HomeScreen.tsx`** — Switched the Campus Events card to the shared sports calendar helpers, keeping live UCI event rendering aligned with the reminder scheduler.
- **`src/screens/SettingsScreen.tsx`** — Expanded Notifications settings so users can choose how many minutes before a class or sports game they want to be reminded. Kept push-permission handling tied to the save flow so reminders only turn on when the device actually grants permission.
- **`src/screens/FriendsScreen.tsx`** — Wired saved `timetable_visibility` into the ClassMates experience. Friends whose visibility is `private` now show as locked, their timetable button no longer opens the schedule, and the UI explains that the timetable is private instead of silently failing.

### Session 57b (Revert unified timetable surface)
- **`src/screens/TimetableScreen.tsx`** — Reverted the “single rounded surface” timetable layout and restored the previous separated header / TBA strip / grid structure because the combined card treatment felt worse in actual use and made the screen look heavier than intended.

### Session 58 (Timetable screen redesign to match cleaner reference)
- **`src/screens/TimetableScreen.tsx`** — Restyled the timetable screen to more closely match the provided reference while keeping all existing functionality intact. The page now uses a soft app background with a lighter, cleaner timetable shell, rounded quarter/actions row, chunkier plan pills, a framed inner grid, and softer course cards with more breathing room. TBA/online pills were also restyled to sit naturally inside the card system instead of feeling tacked on.

### Session 58b (Limit redesign to the timetable grid only)
- **`src/screens/TimetableScreen.tsx`** — Reverted the broader timetable-screen redesign after feedback and kept only the requested part: the schedule grid itself now sits inside a rounded card with a subtle border/shadow, while the header, quarter controls, plan pills, TBA strip, and course block styling return to their previous look.

### Session 59 (Match friend timetable layout and show TBA courses)
- **`src/screens/FriendsScreen.tsx`** — Updated the friend timetable detail view so it follows the same overall schedule format as the main timetable screen instead of using a noticeably different grid style. The friend schedule now uses the same day-header treatment, course card content structure, and a rounded grid card frame. Also fixed friend TBA/online sections not appearing by separating quarter courses into scheduled blocks and TBA chips, so unscheduled courses are visible above the friend grid just like they are in the main timetable.

### Session 59b (Fix friend timetable clipping and scrolling)
- **`src/screens/FriendsScreen.tsx`** — Fixed the friend timetable grid clipping the Friday column and not scrolling. The friend schedule table now uses a minimum day-column width plus nested horizontal/vertical scrolling so wide schedules stay readable and tall schedules can be browsed instead of being cut off.

### Session 60 (Implement real direct messages)
- **`src/data/messages.ts`** — Added shared direct-message types plus timestamp formatting helpers so the messaging UI and message routing use a single shape for chat targets and Supabase rows.
- **`src/screens/MessagesScreen.tsx`** — Replaced the mock inbox/thread UI with a real Supabase-backed direct-messages screen. Conversations now load from `direct_messages`, partner names resolve from `profiles`, unread counts are derived from `read_at`, opening a thread marks inbound messages as read, and sending a message inserts a real row instead of mutating local mock state. Guest users now see a sign-in-required empty state.
- **`App.tsx`** — Changed message routing from name-only strings to `{ id, name }` chat targets so the app can open a real DM thread for a specific user. Added a sign-in-required guard before the messages screen opens for guest users.
- **`src/screens/BoardScreen.tsx`** — Updated the post-detail message action to open the real DM screen with the post author’s user id and display name.
- **`src/screens/FriendsScreen.tsx`** — Updated friend-message actions to open the real DM screen with the selected friend’s user id/name while keeping the top-right messages button as a normal inbox entry point.
- **Supabase SQL required** — Create a `direct_messages` table before this feature can work end-to-end. Example minimum schema:
  `create table if not exists direct_messages (id uuid primary key default gen_random_uuid(), sender_id uuid not null references profiles(id) on delete cascade, receiver_id uuid not null references profiles(id) on delete cascade, content text not null, created_at timestamptz not null default now(), read_at timestamptz null);`
  `create index if not exists direct_messages_sender_idx on direct_messages (sender_id, created_at desc);`
  `create index if not exists direct_messages_receiver_idx on direct_messages (receiver_id, created_at desc);`
  `alter table direct_messages enable row level security;`
  `create policy "direct_messages_select_own" on direct_messages for select to authenticated using (auth.uid() = sender_id or auth.uid() = receiver_id);`
  `create policy "direct_messages_insert_own" on direct_messages for insert to authenticated with check (auth.uid() = sender_id);`
  `create policy "direct_messages_update_receiver" on direct_messages for update to authenticated using (auth.uid() = receiver_id) with check (auth.uid() = receiver_id);`

### Session 60b (Fit friend timetable inside the card)
- **`src/screens/FriendsScreen.tsx`** — Removed the nested horizontal/vertical scroll behavior from the friend timetable detail view and made the grid scale to fit the card width and height instead. Weekend columns and later time ranges now shrink the friend grid cells and labels so the whole schedule stays visible inside the card at once, matching the intended “see the full timetable in one glance” behavior.

### Session 60c (Fit main timetable inside the card)
- **`src/screens/TimetableScreen.tsx`** — Updated the main timetable grid to use the same fit-within-card behavior as the friend timetable instead of growing into a scrollable canvas when weekends or later hours appear. The grid now scales its row height and block typography to the available card space so Saturday/Sunday columns and post-5pm time ranges stay visible inside the rounded timetable card without changing the rest of the screen layout.

### Session 60d (Migrate chat to conversation-based storage)
- **`src/data/messages.ts`** — Replaced the old direct-message row shape with shared conversation, participant, and message row types so the chat layer now models a real conversation-based backend instead of a flat sender/receiver message table.
- **`src/screens/MessagesScreen.tsx`** — Migrated the messaging UI from `direct_messages` to `conversations` + `conversation_participants` + `messages`. The inbox now loads per-conversation previews from conversation metadata, unread state is derived from each participant’s `last_read_at`, opening a DM finds or creates a 1:1 conversation, and sending a message inserts into `messages` while updating the parent conversation’s last-message metadata.
- **Supabase SQL required** — This migration supersedes the earlier `direct_messages` schema. New minimum schema:
  `create table if not exists conversations (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), last_message_text text null, last_message_at timestamptz null, last_message_sender_id uuid null references profiles(id) on delete set null);`
  `create table if not exists conversation_participants (conversation_id uuid not null references conversations(id) on delete cascade, user_id uuid not null references profiles(id) on delete cascade, last_read_at timestamptz null, created_at timestamptz not null default now(), primary key (conversation_id, user_id));`
  `create table if not exists messages (id uuid primary key default gen_random_uuid(), conversation_id uuid not null references conversations(id) on delete cascade, sender_id uuid not null references profiles(id) on delete cascade, content text not null, created_at timestamptz not null default now());`
  `create index if not exists conversation_participants_user_idx on conversation_participants (user_id, conversation_id);`
  `create index if not exists conversations_updated_at_idx on conversations (updated_at desc);`
  `create index if not exists messages_conversation_created_idx on messages (conversation_id, created_at asc);`
  `alter table conversations enable row level security;`
  `alter table conversation_participants enable row level security;`
  `alter table messages enable row level security;`
  `create policy "conversations_select_own" on conversations for select to authenticated using (exists (select 1 from conversation_participants cp where cp.conversation_id = id and cp.user_id = auth.uid()));`
  `create policy "conversations_insert_authenticated" on conversations for insert to authenticated with check (true);`
  `create policy "conversations_update_own" on conversations for update to authenticated using (exists (select 1 from conversation_participants cp where cp.conversation_id = id and cp.user_id = auth.uid())) with check (exists (select 1 from conversation_participants cp where cp.conversation_id = id and cp.user_id = auth.uid()));`
  `create policy "conversation_participants_select_own" on conversation_participants for select to authenticated using (user_id = auth.uid() or exists (select 1 from conversation_participants cp where cp.conversation_id = conversation_id and cp.user_id = auth.uid()));`
  `create policy "conversation_participants_insert_authenticated" on conversation_participants for insert to authenticated with check (true);`
  `create policy "conversation_participants_update_own" on conversation_participants for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());`
  `create policy "messages_select_own_conversations" on messages for select to authenticated using (exists (select 1 from conversation_participants cp where cp.conversation_id = conversation_id and cp.user_id = auth.uid()));`
  `create policy "messages_insert_own_conversations" on messages for insert to authenticated with check (sender_id = auth.uid() and exists (select 1 from conversation_participants cp where cp.conversation_id = conversation_id and cp.user_id = auth.uid()));`

### Session 60e (Center timetable hour labels within each row)
- **`src/screens/TimetableScreen.tsx`** — Adjusted the main timetable’s time-label rendering so labels are created once per hour row instead of once per boundary line. This keeps the hour text visually centered inside each left-hand time cell while leaving the horizontal grid lines unchanged.

### Session 60f (Fix friend timetable width and left edge alignment)
- **`src/screens/FriendsScreen.tsx`** — Removed the extra left padding inside the friend timetable grid frame so the computed day columns now use the full available card width. This fixes the Friday column clipping and makes the left-hand time column connect cleanly to the card edge instead of floating inward from the rounded corner.

### Session 60g (Avoid conversation insert RLS failure on chat open)
- **`src/screens/MessagesScreen.tsx`** — Stopped using `insert(...).select().single()` when creating a new conversation because the conversation could not be selected yet under RLS before participant rows existed. The screen now generates the conversation id client-side, inserts the conversation without a returning select, and then inserts participants, avoiding the immediate “row violates row-level security policy for table conversations” failure when starting a new DM.

### Session 60h (Add UUID fallback for React Native chat creation)
- **`src/screens/MessagesScreen.tsx`** — Replaced the direct dependency on `globalThis.crypto.randomUUID()` with a small local UUID fallback helper so conversation creation also works on React Native environments where `crypto.randomUUID` is unavailable. This fixes the “This device could not generate a conversation id” alert when opening a new chat.

### Session 60i (Load conversation list through security-definer RPCs)
- **`src/data/messages.ts`** — Added a typed `ConversationListRow` shape for server-returned inbox rows that already include partner identity, last-message metadata, and unread counts.
- **`src/screens/MessagesScreen.tsx`** — Stopped trying to assemble the inbox by directly reading other users’ `conversation_participants` rows under RLS. The messages screen now expects two Supabase RPC helpers: `get_user_conversations()` for inbox rows and `find_direct_conversation(other_user_id)` for existing 1:1 lookup. This fixes the state where conversation/message rows existed in the database but the inbox still rendered empty because partner participant rows were not selectable from the client.

### Session 60j (Collapse duplicate conversations into one DM row)
- **`src/screens/MessagesScreen.tsx`** — Changed inbox assembly so multiple conversation rows with the same partner collapse into a single visible DM entry, keeping only the most recent conversation for that partner. This makes the Messages screen behave like a normal direct-message list even if earlier failed chat attempts left duplicate conversation rows in Supabase.

### Session 60k (Open the latest existing DM from friend actions)
- **`src/screens/MessagesScreen.tsx`** — Updated the “find or create direct conversation” flow so friend/post message shortcuts now reuse the newest existing conversation returned by `get_user_conversations()` for that partner before creating anything new. This prevents the paper-plane button in the friends list from opening another blank conversation when a DM history with that friend already exists.

### Session 61 (Anonymous board identity + remove friend message UI)
- **`src/data/userPreferences.ts`** — Added `boardProfileVisible` to user settings defaults and persisted it inside `profile_details`, so board identity can stay anonymous by default without requiring a new Supabase column.
- **`App.tsx`** — Loaded/saved `boardProfileVisible` from `user_settings.profile_details`, passed the current board display state into `BoardScreen`, and stopped passing message-opening props into `FriendsScreen`.
- **`src/screens/SettingsScreen.tsx`** — Expanded `Privacy & Security` so it now saves both timetable visibility and a new “Show my profile on board posts” toggle. When off, board activity stays anonymous.
- **`src/screens/HomeScreen.tsx`** — Updated settings prop typing so the broader privacy payload flows cleanly into the settings modal.
- **`src/screens/BoardScreen.tsx`** — Board posts and comments now resolve display names from each author’s privacy setting. Users are anonymous by default, and only users who explicitly opt in show their profile name. New posts/comments save with the correct visible/anonymous label, while existing content is rendered dynamically from current settings.
- **`src/screens/FriendsScreen.tsx`** — Removed the inbox shortcut and per-friend paper-plane button so the ClassMates screen no longer exposes friend DM entry points. Messaging is now intended to come from the board flow instead.

### Session 61b (Move inbox entry from ClassMates to Board)
- **`src/screens/BoardScreen.tsx`** — Added a messages/inbox shortcut button to the main Board header so users can open their DM list from the anonymous board area, which now owns the messaging flow.

### Session 61c (Ignore guest ids in board author resolution)
- **`src/screens/BoardScreen.tsx`** — Guarded board author-name resolution so only real UUID user ids are queried from `profiles` and `user_settings`. Guest/dev ids like `guest` now fall back directly to `Anonymous`, preventing the UUID syntax redbox on the board screen.

### Session 62 (Switch messaging back to direct_messages)
- **`src/screens/MessagesScreen.tsx`** — Replaced the conversation/participant-based inbox and thread logic with a simpler `direct_messages` flow. The messages screen now groups rows by partner id, reads a thread by sender/receiver pair, marks unread incoming rows as read, and writes outgoing messages directly into `direct_messages`.
- **`src/data/messages.ts`** — Removed the old conversation-specific row types and replaced them with a single `DirectMessageRow` shape so the data layer matches the lighter DM architecture.

### Session 62b (Guard DM queries against guest ids)
- **`src/screens/MessagesScreen.tsx`** — Added UUID guards around inbox loading, thread loading, read-state updates, and send/open actions so guest ids like `guest` never get passed into `direct_messages` UUID filters. This prevents the “invalid input syntax for type uuid: guest” redbox in the DM screen.

### Session 63 (Remove guest account flow entirely)
- **`src/screens/SignInScreen.tsx`** — Removed the dev guest-login shortcut from the sign-in screen so the app now enters only through real university sign-in.
- **`App.tsx`** — Removed guest fallback user handling, guest-only alerts, and the guest sign-in callback. The main app now assumes authenticated users only once past the auth flow.
- **`src/screens/MessagesScreen.tsx`** — Simplified message gating so it no longer checks for guest ids and instead only guards against missing/invalid user ids.
- **`src/screens/FriendsScreen.tsx`** — Removed guest-specific friend-search/request branches now that anonymous guest accounts are no longer part of the product.

### Session 64 (Floating island tab bar)
- **`App.tsx`** — Reworked the bottom navigation into a floating island-style capsule with translucent “liquid glass” styling, rounded active pills, and bottom safe-area spacing. The bar now sits above the screen instead of being attached to the bottom edge, while the main content gets extra bottom padding so nothing hides behind it.

### Session 64b (Tighten vertical spacing for phone layouts)
- **`App.tsx`** — Reduced the shared top spacing on tab-wrapped screens and slightly lowered the extra bottom padding reserved for the floating tab bar so more content fits on smaller phone screens.
- **`src/screens/HomeScreen.tsx`** — Compressed the top header area, date spacing, hero card padding, and weather card scale so the home screen feels less stretched vertically on mobile.
- **`src/screens/BoardScreen.tsx`** — Reduced top header padding and lower list bottom spacing so the board fits more naturally on phone-height viewports.
- **`src/screens/FriendsScreen.tsx`** — Slightly reduced the main title scale to better match the tighter mobile layout density.
- **`src/screens/GradesScreen.tsx`** — Reduced the top padding, title size, and first-card spacing to make the grades screen less tall overall.

### Session 64c (Slimmer, more transparent floating tab bar)
- **`App.tsx`** — Reduced the floating tab bar’s vertical padding and corner radius, softened the active pill, and lowered the background/border opacity so the bottom island reads thinner and more glassy instead of chunky.

### Session 64d (Fit ClassMates label inside slimmer tab bar)
- **`App.tsx`** — Reduced tab item padding and label size again, enabled single-line auto-fit text on tab labels, and lowered the floating bar height another step so `ClassMates` fits on one line without the island becoming bulky.

### Session 64e (Lower content start on phone screens)
- **`src/screens/HomeScreen.tsx`** — Increased the Home scroll view’s top content inset so the visible cards and header sit lower on the phone display instead of feeling pinned near the status bar.
- **`src/screens/GradesScreen.tsx`** — Increased the Grades screen top inset so the title and summary content begin lower on the device.
- **`src/screens/BoardScreen.tsx`** — Increased the top padding on the board list, post-detail, and inbox/detail headers so board content also starts lower and feels more centered vertically on phones.

### Session 64f (Unify top-screen title typography)
- **`src/screens/BoardScreen.tsx`** — Updated the main `Board` title to match the same 28pt bold header style used by the other primary tabs.
- **`src/screens/FriendsScreen.tsx`** — Updated the `ClassMates` title to the shared 28pt bold tab-header style.
- **`src/screens/MessagesScreen.tsx`** — Updated the inbox header title in both list and empty-state layouts so `Messages` uses the same title weight/scale as the other top-level screens.

### Session 64g (Increase floating tab bar translucency)
- **`App.tsx`** — Lowered the floating tab bar background, border, shadow, and active-pill opacity so the island feels more transparently layered over the Home screen instead of looking opaque.

### Session 64h (Replace quote with class-route progress card)
- **`src/screens/HomeScreen.tsx`** — Removed the daily quote fetch/cache block and replaced the middle of the `Your Day` card with a route-map style view of today’s classes. Each course now appears as a stop on a connected line, with status chips (`Done`, `Now`, `Up Next`), a top-level day progress bar, and per-class progress bars that fill based on the current time.

### Session 64i (Add quarter progress bar to Home)
- **`src/screens/HomeScreen.tsx`** — Added a quarter-progress section below the daily class route. It now measures Spring 2026 progress from quarter start through finals end, shows the current percent complete, and displays the remaining days until finals end with a filled progress bar.

### Session 64j (Make floating tab bar nearly transparent)
- **`App.tsx`** — Reduced the floating tab bar and active-pill opacity again so the bottom island becomes much more see-through, letting the content behind it remain faintly visible while preserving active-tab readability.

### Session 64k (Add Apple-like depth to Home cards)
- **`src/screens/HomeScreen.tsx`** — Restyled the Home screen cards with stronger rounded surfaces, brighter edge borders, softer long shadows, and slightly raised inner sub-cards so the dashboard reads with more Apple-style depth instead of flat boxes.

### Session 64l (Convert daily route to horizontal transit line)
- **`src/screens/HomeScreen.tsx`** — Reworked the daily class route from a vertical stack into a horizontal transit-line layout. Stops now sit on a left-to-right line with small course labels underneath each dot, while a compact detail card below highlights the current or next class.

### Session 64m (Let content extend behind floating tab bar)
- **`App.tsx`** — Removed the root-level bottom padding that had been reserving space for the floating tab bar. Screen content now continues beneath the island so the tab bar feels visually suspended over the app instead of sitting above a cut-off lower edge.

### Session 64n (Simplify route map to whole-day fill only)
- **`src/screens/HomeScreen.tsx`** — Removed the per-class progress/detail treatment from the horizontal class route. The line now behaves more like a true transit map: the stops remain labeled underneath, while the route itself fills across the day as time passes.

### Session 64o (Use one continuous subway-style route fill)
- **`src/screens/HomeScreen.tsx`** — Rebuilt `Today's Route` so the stops sit on top of one continuous gray baseline with a single blue progress fill layered underneath. As the day advances, the filled portion now grows across the shared route like a subway line passing each station, instead of coloring each segment independently.

### Session 64q (Pulse the current stop on the route map)
- **`src/screens/HomeScreen.tsx`** — Added a soft looping pulse animation behind the currently active class stop so the route map shows the user’s live position more clearly without changing the overall subway-style layout.

### Session 64r (Increase tab bar opacity again)
- **`App.tsx`** — Raised the floating tab bar background, border, shadow, and active-pill opacity so the island reads more solid over content while still preserving the floating glass treatment.

### Session 64s (Embed route stops directly into the Today bar)
- **`src/screens/HomeScreen.tsx`** — Reworked `Today's Route` so the percent/progress bar itself is now the subway line. The stations sit directly on top of that single bar, with course labels beneath it, and the old separate second route strip below the bar was removed.

### Session 64t (Raise tab bar opacity for readability)
- **`App.tsx`** — Increased the floating tab bar and active-pill opacity again so the controls read clearly over the Home screen and the navigation buttons no longer disappear into the content behind them.

### Session 64p (Restore a bit more tab bar presence)
- **`App.tsx`** — Raised the floating tab bar opacity slightly after the previous pass made it too transparent. The island still reads as glassy, but its body, border, shadow, and active pill now stand out enough to feel intentional.

### Session 64u (Increase global text contrast)
- **`src/context/ThemeContext.tsx`** — Strengthened the shared `textSecondary`, `textTertiary`, and `placeholder` colors in both light and dark themes so the app no longer looks washed out by overly gray typography. This makes primary supporting labels read more clearly across all screens without changing layout.

### Session 64v (Add depth and stronger selection states to cards)
- **`src/screens/BoardScreen.tsx`** — Restyled board selection cards with stronger rounding, long soft shadows, tinted borders, and a colored chevron capsule so each board tile feels raised instead of flat.
- **`src/screens/TimetableScreen.tsx`** — Added more depth to timetable pills and strengthened the selected pill state with richer shadow/elevation so the active timetable reads as intentionally chosen rather than merely color-filled.

### Session 64w (Remove extra selected-state emphasis from timetable pills)
- **`src/screens/TimetableScreen.tsx`** — Dialed timetable pills back to a shared subtle depth treatment so they still feel tactile, but no longer add an extra shadow/elevation boost specifically for the active selection state.

### Session 64x (Widen the horizontal route map)
- **`src/screens/HomeScreen.tsx`** — Increased the stop width and gap spacing in `Today's Route` so the horizontal subway line stretches farther across the card and feels more open instead of cramped.

### Session 64y (Keep route length fixed as stops increase)
- **`src/screens/HomeScreen.tsx`** — Changed `Today's Route` from an expanding layout to a fixed-width route where stops are distributed evenly across the same line. Adding more classes now inserts more stations into the existing route instead of making the whole track longer.

### Session 64z (Float route stops above the line)
- **`src/screens/HomeScreen.tsx`** — Lowered and thinned the route bar while giving each station dot its own elevated white surface and pulse halo. The stops now read as floating markers above the line instead of appearing fused directly into it.

### Session 64aa (Constrain route width to the card)
- **`src/screens/HomeScreen.tsx`** — Replaced the hardcoded route width with a width derived from the current device size so adding more classes no longer pushes `Today's Route` outside the card. Stations are now redistributed across the fixed in-card width instead of extending off-screen.

### Session 64ab (Desaturate board-list cards)
- **`src/screens/BoardScreen.tsx`** — Removed the rainbow treatment from board-list icons and chevrons in the main board selection screen. The list now uses neutral gray icon surfaces and muted accents so the page feels calmer, with color reserved for higher-priority actions instead of every board tile.

### Session 64ac (Add friendly global error fallback)
- **`src/components/AppErrorBoundary.tsx`** — Added a global error boundary with a user-facing fallback screen that says the feature is still in progress instead of dumping raw runtime details into the main app experience.
- **`App.tsx`** — Wrapped the app content in the new global error boundary so unexpected render-time failures show the friendly recovery screen first.

### Session 64ad (Simplify the top of the daily route card)
- **`src/screens/HomeScreen.tsx`** — Removed the divider between the headline count and the route section, dropped the explicit `Today’s Route` label, and changed the top summary to focus on how many classes are left today while keeping the route itself as the main visual.

### Session 64ae (Fix Home route JSX syntax regression)
- **`src/screens/HomeScreen.tsx`** — Repaired a broken conditional JSX wrapper inside the `Today's Route` section that caused the app to fail parsing with an unexpected token error. The route block now renders correctly again instead of crashing the screen at load time.

### Session 64af (Align route line with station centers)
- **`src/screens/HomeScreen.tsx`** — Nudged the `Today's Route` line upward so it passes through the visual center of each station dot, and widened the in-card route width slightly so the horizontal map has a bit more breathing room.

### Session 64ag (Show quarter progress with finer precision)
- **`src/screens/HomeScreen.tsx`** — Changed `Quarter Progress` from a rounded integer percent to a two-decimal display so the number visibly increments as time passes instead of feeling static for long stretches.

### Session 64ah (Tighten route-to-quarter spacing)
- **`src/screens/HomeScreen.tsx`** — Reduced the vertical spacing between the daily route section and `Quarter Progress` so the two progress blocks feel more closely grouped within the same card.

### Session 64ai (Update quarter progress every second)
- **`src/screens/HomeScreen.tsx`** — Added a 1-second timer to refresh the Home screen clock-dependent metrics and increased `Quarter Progress` precision to four decimal places so the percentage visibly ticks upward in real time.

### Session 64aj (Tighten route label spacing)
- **`src/screens/HomeScreen.tsx`** — Reduced the label-row height and the gap under the route markers so the daily route no longer leaves an oversized empty band beneath the station labels.

### Session 64ak (Add depth to the Grades screen)
- **`src/screens/GradesScreen.tsx`** — Restyled the stats cards, GPA trend card, and quarter sections with brighter surface edges, deeper soft shadows, and slightly raised inner course rows so the grades screen matches the more dimensional card treatment used elsewhere in the app.

### Session 64al (Increase quarter-progress precision again)
- **`src/screens/HomeScreen.tsx`** — Raised `Quarter Progress` precision from four to six decimal places so the percent visibly changes on a near-second cadence across a full academic quarter.

### Session 64am (Center the route map within the card)
- **`src/screens/HomeScreen.tsx`** — Rebalanced `Today's Route` so the route width is derived from the card’s usable space instead of overshooting it, and centered the whole route block horizontally. This prevents the map from drifting to the right while still keeping it visually long.

### Session 64an (Pull the route block closer to the divider)
- **`src/screens/HomeScreen.tsx`** — Reduced the station-label row height and tightened the margin below the route map so the next section starts much closer underneath it, removing the excess blank space.

### Session 64ao (Restore soft royal-blue board icons)
- **`src/screens/BoardScreen.tsx`** — Brought the board-list icons and chevron capsules back to a light royal-blue treatment using the shared brand tint so the list stays restrained but remains easier to scan than the fully gray version.

### Session 64ap (Add more depth to quarter cards in Grades)
- **`src/screens/GradesScreen.tsx`** — Enhanced the expandable quarter cards beneath the GPA chart with a slightly richer header treatment and a raised chevron capsule so the quarter-selection sections feel more dimensional and consistent with the other elevated cards in the app.

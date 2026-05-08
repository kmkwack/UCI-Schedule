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

### Session 64ca (8 AM daily schedule + 1-hour reminder defaults)
- **`src/data/userPreferences.ts`** — Added `dailyScheduleSummary` notification preference and changed default class/game reminder lead times to 60 minutes.
- **`src/screens/SettingsScreen.tsx`** — Added a new `Today's Classes` notification toggle, updated class/game reminder copy to reflect the 1-hour reminder behavior, removed the old variable lead-time picker, and force-saved reminder timing to 60 minutes.
- **`App.tsx`** — Added 8:00 AM daily schedule summary scheduling for days with classes and fixed class/game reminder scheduling to a strict 1 hour before start time.

### Session 64cb (Restore adjustable reminder lead times)
- **`src/screens/SettingsScreen.tsx`** — Restored the lead-time picker UI for class and sports reminders while keeping the new `Today's Classes` 8:00 AM summary toggle.
- **`App.tsx`** — Switched class and sports reminder scheduling back to use each user’s saved reminder-minute settings instead of a fixed 60-minute offset.

### Session 64cc (Add second reports moderator account)
- **`src/screens/SettingsScreen.tsx`** — Expanded the in-app moderator allowlist so `kwackk@uci.edu` sees the same `Reports Inbox` as `sihyup2@uci.edu`, matching the updated reports policy in Supabase.

### Session 64cd (Tighten notification lead-time chips)
- **`src/screens/SettingsScreen.tsx`** — Reduced the reminder timing chip padding and text size so the `5 / 10 / 15 / 30 / 60 min` options fit cleanly on one line without the `60 min` chip dropping below.

### Session 64ce (Remove email notifications toggle)
- **`src/screens/SettingsScreen.tsx`** — Removed the visible `Email Notifications` toggle from the notifications screen and updated the helper copy so the UI now only advertises the notification features the app actually intends to support.

### Session 64cf (Gracefully skip push token registration without EAS project id)
- **`App.tsx`** — Changed Expo push token registration to bail out cleanly when no `projectId` is configured instead of calling `getExpoPushTokenAsync()` without one and throwing a redbox. Registration failures now log as warnings so the app stays usable until EAS push is configured.

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

### Session 64aq (Soften quarter-progress number styling)
- **`src/screens/HomeScreen.tsx`** — Reduced the visual weight of the `Quarter Progress` percentage by lowering its size and font weight, while increasing precision to eight decimal places so the value still updates more noticeably in real time.

### Session 64ar (Swap Coming Up and Quarter Progress order)
- **`src/screens/HomeScreen.tsx`** — Reordered the lower sections of the `Your Day` card so `Coming Up` appears before `Quarter Progress`, matching the requested information flow without changing the card styles themselves.

### Session 64as (Group campus events by date label)
- **`src/screens/HomeScreen.tsx`** — Reworked the `Campus Events` card so sports events are grouped under explicit date headers like `Tuesday, April 22` instead of using heavier separator lines to imply day changes.

### Session 64at (Make quarter progress tick faster)
- **`src/screens/HomeScreen.tsx`** — Increased the Home screen time refresh cadence from 1 second to 100ms and raised the `Quarter Progress` display to nine decimal places so the percentage now visibly races upward in much smaller increments.

### Session 64au (Push quarter progress toward real-time animation)
- **`src/screens/HomeScreen.tsx`** — Increased the Home screen progress refresh cadence again to roughly one frame (`16ms`) and extended `Quarter Progress` to ten decimal places so the number scrolls much more continuously instead of stepping in obvious jumps.

### Session 64av (Reduce quarter-progress precision back to 8 decimals)
- **`src/screens/HomeScreen.tsx`** — Kept the fast refresh cadence for a lively feel, but reduced `Quarter Progress` back to eight decimal places so the number stays readable instead of feeling visually noisy.

### Session 64aw (Use tabular figures for quarter progress)
- **`src/screens/HomeScreen.tsx`** — Applied tabular-number rendering to the `Quarter Progress` percentage so changing digits keep a consistent width and the value no longer appears to wobble as it updates.

### Session 64ax (Fix quarter-progress number rendering bug)
- **`src/screens/HomeScreen.tsx`** — Moved the `fontVariant` setting onto the `Text` component correctly after it was accidentally rendered as visible text, which caused the percentage itself to disappear from the UI.

### Session 64ay (Stabilize quarter-progress number layout)
- **`src/screens/HomeScreen.tsx`** — Put the quarter-progress percentage inside a fixed-width, right-aligned text block while keeping tabular figures enabled, so the value no longer shifts horizontally as digits change.

### Session 64az (Increase tab bar visibility again)
- **`App.tsx`** — Raised the floating tab bar and active-pill opacity one more step so the navigation stays readable over busy screens while keeping the translucent glass treatment.

### Session 64ba (Push the floating tab bar toward liquid-glass styling)
- **`App.tsx`** — Rebuilt the floating tab bar with layered highlight sheets, translucent inner reflections, brighter glass borders, and a glossier active pill so it feels much closer to a liquid-glass island even without native SwiftUI materials.

### Session 64bb (Add customizable class blocks from Add Course)
- **`src/screens/CoursePickerScreen.tsx`** — Added a `Customize` button in the top-right header of the Add Course screen. It opens a bottom-sheet form where users can create their own timetable block with name, short label, days, start/end time, location, instructor, and units. Custom entries are converted into the existing `Course` shape, reuse the normal conflict/add flow, and get inserted into the timetable just like standard course sections.

### Session 64bc (Make custom block fields feel like generic schedule items)
- **`src/screens/CoursePickerScreen.tsx`** — Renamed the primary custom-block field from `Course Name` to `Name`, made the helper copy and placeholders more generic so the feature works for non-class events, and treated `location` as truly optional instead of filling it with a fake default value. The required fields are now just the name and valid time range.

### Session 64bd (Put custom day picker on one row)
- **`src/screens/CoursePickerScreen.tsx`** — Compressed the custom-block weekday selector into a single horizontal row by shortening the labels (`M`, `T`, `W`, `Th`, `F`, `Sa`, `Su`) and using compact pill sizing so all seven days fit cleanly on one line.

### Session 64be (Let custom blocks choose their own color)
- **`src/screens/CoursePickerScreen.tsx`** — Added a color picker to the custom-block form so users can choose the block tint while creating a custom schedule item.
- **`src/data/courses.ts`** — Added optional `customColor` support to `Course` and taught `getBlockColors()` to prioritize a custom color across timetable themes, so the chosen tint shows up consistently in the main timetable and preview timetable.

### Session 64bf (Restore timetable screen scrolling)
- **`src/screens/TimetableScreen.tsx`** — Removed the accidental condition that only enabled the main timetable screen `ScrollView` when `TBA` courses existed. The outer timetable page now scrolls normally again regardless of whether there are unscheduled courses.

### Session 64bg (Remove fake bounce on timetable page)
- **`src/screens/TimetableScreen.tsx`** — Disabled vertical bounce on the outer timetable `ScrollView` so the page no longer appears to scroll and then spring back upward when there is no extra content below the grid.

### Session 64bh (Restore real timetable scrolling while keeping bounce restrained)
- **`src/screens/TimetableScreen.tsx`** — Re-enabled normal vertical scrolling on the outer timetable page, but kept `alwaysBounceVertical={false}` so the page can scroll when there is real overflow without feeling like it rubber-bands on empty space.

### Session 64bi (Remove timetable width jump on first open)
- **`src/screens/TimetableScreen.tsx`** — Fixed the brief “wide then narrow” animation when opening Timetable from Home by aligning the initial fallback grid width with the measured on-layout width. The timetable columns now render at the correct width on the first frame instead of shrinking after layout measurement.

### Session 64bj (Create real scroll room beneath the timetable)
- **`src/screens/TimetableScreen.tsx`** — Added bottom padding to the outer timetable `ScrollView` so the page has real vertical overflow instead of only a bounce effect. Also removed duplicate bottom padding from the TBA section so the scroll length stays controlled while the main timetable can actually move downward.

### Session 64bk (Reserve visible space for content below the timetable grid)
- **`src/screens/TimetableScreen.tsx`** — When unscheduled `TBA` / online blocks exist below the main grid, the grid now gives up some vertical space instead of always filling the viewport. This prevents the lower section from being trapped off-screen behind a fake bounce and makes the page behave like a real vertical layout.

### Session 64bl (Remove viewport-based height cap from timetable page)
- **`src/screens/TimetableScreen.tsx`** — Removed the extra `containerHeight` / `headerAreaHeight` / `scrollAreaHeight` calculations that were forcing the timetable grid to behave like a viewport-sized panel inside a scroll screen. The grid now uses its natural content height (`72px * totalHours`) so the page can scroll like a normal vertical layout.

### Session 64bm (Make custom blocks look like normal schedule items)
- **`src/screens/CoursePickerScreen.tsx`** — Stopped custom blocks from injecting placeholder `Custom` metadata. They now leave `sectionLabel` empty and keep `professor` blank unless the user actually enters one, which removes the extra `Custom` text and prevents the RMP button from appearing for custom schedule blocks.

### Session 64bn (Allow midnight custom blocks and wire up social notifications)
- **`src/screens/CoursePickerScreen.tsx`** — Updated custom-block time validation so `24:00` is accepted as an end time while normal start times still use standard `00:00–23:59` validation. This fixes long evening blocks like `12:00 → 24:00` without introducing a separate late-night cap.
- **`src/data/userPreferences.ts`** — Added a `likes` notification preference with a default enabled value so post-like alerts can be configured alongside comments and messages.
- **`src/screens/SettingsScreen.tsx`** — Added a `Likes` toggle to the Social notifications section so users can enable or disable like alerts from the UI.
- **`App.tsx`** — Added real in-app notification polling for friend requests, board comments, board likes, and direct messages using the existing Supabase tables plus `expo-notifications`. The app now snapshots existing activity first, then only surfaces new events while it is open, preserving board anonymity with generic notification copy instead of exposing hidden profile names.

### Session 64bo (Route support mail to both Sean inboxes)
- **`src/screens/SettingsScreen.tsx`** — Updated the Help Center support action so `Contact Support` opens a mail draft addressed to both `heyy.seans@gmail.com` and `hii.seans@gmail.com`. The fallback support text now also shows both addresses together.

### Session 64bp (Add threaded comments, comment likes, and reporting tools to Board)
- **`src/screens/BoardScreen.tsx`** — Expanded board post interactions to support nested replies, per-comment likes, and report actions for both posts and comments. Comments now load as a tree using `parent_comment_id`, the detail view supports replying inline to any comment, each comment has its own like count and reply action, and both posts/comments can open a report modal with preset reasons plus optional details before submitting to a shared `reports` table.

### Session 64bq (Rename anonymous users to Anteater aliases)
- **`src/data/anonymousAliases.ts`** — Added a shared helper that turns a hidden user id into a stable `Anteater N` alias.
- **`src/screens/BoardScreen.tsx`** — Replaced `Anonymous` display names with `Anteater N` aliases for hidden-profile posts and comments, including newly created anonymous content.
- **`src/screens/MessagesScreen.tsx`** — Replaced anonymous DM partner labels with the same `Anteater N` alias pattern so inbox entries stay consistent with board anonymity.
- **`src/screens/SettingsScreen.tsx`** — Updated the privacy copy to explain that hidden board identities now show up as an Anteater alias instead of the literal word `Anonymous`.

### Session 64br (Use per-post commenter aliases)
- **`src/screens/BoardScreen.tsx`** — Changed post-detail identity labels to be scoped per post: the post creator now appears as `Author` inside that post, and commenters/repliers are assigned `Anteater 1`, `Anteater 2`, `Anteater 3`, etc. in the order they first appear on that specific post. The numbering resets independently for each different post.

### Session 64bs (Remove author labels from board list rows)
- **`src/screens/BoardScreen.tsx`** — Simplified the board post list so the feed rows no longer show the author label. The list now shows only category and time, while identity labels remain available inside the post detail view.

### Session 64bt (Add breathing room above the keyboard in post replies)
- **`src/screens/BoardScreen.tsx`** — Increased the bottom padding on the post-detail comment composer so when the keyboard slides up, the reply bar no longer feels glued directly to the keyboard edge. This leaves a small visual gap after the keyboard avoidance animation settles.

### Session 64bu (Turn audit gaps into real flows or remove misleading UI)
- **`src/screens/SignUpScreen.tsx`** — Replaced the fake `onSignedUp('google-user')` shortcut with the real Google OAuth flow used by sign-in. Sign-up now returns a real Supabase auth user id + email, validates the selected school domain, and no longer creates a broken non-UUID session.
- **`App.tsx`** — Fixed the auth handoff so the sign-up screen stores both `userId` and `userEmail`. Reworked the Home screen source quarter so it prefers the real current academic quarter when present instead of hardcoding `2026-Spring`, and expanded social notification polling to include replies to the user’s comments plus likes on the user’s comments. Like notification keys are now stable across both post-like and comment-like events.
- **`src/screens/HomeScreen.tsx`** — Removed the hardcoded Spring 2026-only quarter progress logic. The Home screen now accepts the active quarter from `App.tsx`, uses quarter-specific date ranges for the supported school terms, includes Saturday/Sunday in the route-day logic, and shows the correct selected-quarter label in the date header.
- **`src/screens/SettingsScreen.tsx`** — Removed the misleading `Email Notifications` row from the visible notifications UI and added copy that clearly explains the current behavior: device alerts work on-device while ClassMate is open, while remote push/email delivery are not yet enabled.
- **`src/screens/BoardScreen.tsx`** — Removed the nonfunctional `Add Images`, `Add Files`, and `Prevent Edit/Delete` controls from the new-post modal so the composer only shows inputs that are actually supported today.

### Session 64bv (Bring post attachments and post locking to life)
- **`src/screens/BoardScreen.tsx`** — Re-implemented the new-post composer so `Add Images`, `Add Files`, and `Prevent Edit/Delete` are real features instead of placeholder UI. Posts can now collect draft attachments, upload them to Supabase Storage on save, persist attachment metadata in the `posts` row, and show attachments inside the post detail view. Post authors now also get working `Edit Post` and `Delete Post` actions in the detail screen, while locked posts visibly show a `Locked` badge and block future edits/deletes.
- **`package.json` / `package-lock.json`** — Added the Expo pickers used by the board composer (`expo-image-picker`, `expo-document-picker`) so the attachment buttons can pick real images/files from the device before upload.

### Session 64bw (Add a support-only reports inbox)
- **`src/screens/SettingsScreen.tsx`** — Added a `Reports Inbox` screen for moderator accounts (`heyy.seans@gmail.com`, `hii.seans@gmail.com`) inside Settings. The screen loads reported posts/comments, shows reporter identity, reported content preview, current moderation status, and lets staff move each report between `pending`, `reviewing`, `resolved`, and `dismissed` directly in-app.

### Session 64bx (Lay down the real remote notification pipeline)
- **`App.tsx`** — Added Expo push-token registration and persistence so signed-in users with push enabled now save `expo_push_token` into `user_settings`. Notification saves now clear the token when push is disabled and automatically sync a token when push permissions are granted.
- **`src/screens/SettingsScreen.tsx`** — Re-enabled the visible `Email Notifications` toggle and updated the notifications copy so the settings screen reflects the new backend notification pipeline instead of saying remote delivery is unavailable.
- **`supabase/functions/social-notifier/index.ts`** — Added a Supabase Edge Function that turns inserts from `friend_requests`, `direct_messages`, `post_comments`, `post_votes`, and `post_comment_votes` into real Expo push notifications and Resend email notifications, respecting each user’s notification preferences.
- **`supabase/functions/social-notifier/README.md`** — Added deployment/setup instructions for the edge function, required secrets, and the database webhooks it expects.
- **`supabase/sql/remote_notifications.sql`** — Added the SQL migration that creates `user_settings.expo_push_token` and support-side access needed for the remote notification pipeline.

### Session 64by (Separate moderator access from support inboxes)
- **`src/screens/SettingsScreen.tsx`** — Split moderation access from support contact addresses. `Contact Support` still emails `heyy.seans@gmail.com` and `hii.seans@gmail.com`, but the in-app `Reports Inbox` now only appears for the moderator account `sihyup2@uci.edu`.

### Session 64bz (Clean up remote notification setup docs)
- **`supabase/sql/remote_notifications.sql`** — Removed the mistaken `user_settings` support-access policies so the file now does only what it is supposed to do: add the remote-notification columns (`expo_push_token`, `last_remote_notification_at`).
- **`supabase/functions/social-notifier/README.md`** — Corrected the setup instructions to stop telling developers to set `SUPABASE_SERVICE_ROLE_KEY` manually. The README now explains that the service-role key is automatically available inside Supabase Edge Functions and clarifies that the SQL step is just the two `user_settings` columns.

### Session 64cg (Prepare Expo config for real push setup)
- **`app.json`** — Added Expo `owner` and the `extra.eas.projectId` slot so the app config is ready for a real EAS push project id instead of relying on implicit inference.
- **`eas.json`** — Added a baseline EAS configuration file so the project is ready for development, preview, and production EAS workflows needed for real push-notification builds.

### Session 64ch (Fix Expo owner for EAS project setup)
- **`app.json`** — Corrected the Expo `owner` from `parksihyun` to the actual Expo account `parksihyvn` so `eas project:init` can create or link the project under the right account.

### Session 64ci (Clarify push permission vs app toggle)
- **`src/screens/SettingsScreen.tsx`** — Split the notification status card into two explicit lines: `Permission` for the system-level iOS state and `App notifications` for the in-app toggle state, so `granted + off` no longer looks contradictory.

### Session 64cj (Trim quarter-progress precision)
- **`src/screens/HomeScreen.tsx`** — Reduced the `Quarter Progress` percentage display from eight decimal places to six so the number stays more readable while keeping the underlying progress calculation and bar behavior unchanged.

### Session 64ck (Make the welcome screen more cinematic)
- **`src/screens/WelcomeScreen.tsx`** — Reworked the first login screen from a minimal centered card into a more expressive landing-style hero with layered background shapes, floating status cards, a stronger brand mark, and feature highlights. Kept the legal flow and CTA behavior intact while making the entry experience feel much more polished and memorable.

### Session 64cl (Tone down welcome hero badges)
- **`src/screens/WelcomeScreen.tsx`** — Reduced the size of the floating `Today at a glance` and `Quarter in motion` badges and pulled them slightly away from the center mark so they only lightly overlap the logo instead of covering as much of it.

### Session 64cm (Swap in the new ClassMate logo mark)
- **`assets/classmate-logo-full.png` / `assets/classmate-logo-mark.png`** — Added the newly generated ClassMate speech-bubble timetable logo and a cropped mark-only version for in-app branding use.
- **`src/screens/WelcomeScreen.tsx`** — Reverted the temporary badge-size tweak and replaced the old `CM` block with the new ClassMate logo mark while keeping the cinematic hero layout intact.
- **`src/screens/SettingsScreen.tsx`** — Updated the About screen branding from the old `CM` text tile to the new ClassMate logo mark for consistency with the welcome experience.

### Session 64cn (Expand Terms of Service draft around real app features)
- **`src/components/LegalDocumentModal.tsx`** — Replaced the short placeholder Terms of Service text with a fuller draft tailored to ClassMate’s actual functionality: university sign-in, timetable planning, grade tracking, reviews, posts, messaging, attachments, moderation, notifications, third-party services, and academic-information disclaimers. Updated the terms date to April 22, 2026 and kept the in-app footer note that the legal text still needs final release review.

### Session 64co (Draft a fuller Privacy Policy without publishing it)
- **`src/components/LegalDocumentModal.tsx`** — Expanded the in-app Privacy Policy draft to match ClassMate’s real features and data flows, covering collection, use, sharing, visibility, notifications, community content, retention, security, children, and change notices. Updated the privacy date to April 22, 2026 while keeping the footer note that the documents are still development-stage legal drafts pending final review and publication.

### Session 64cp (Apply approved logo and promote legal docs to in-app production copy)
- **`assets/classmate-logo-approved.png`** — Added the selected approved ClassMate logo from the provided file and propagated it into the app-facing icon assets (`icon.png`, `splash-icon.png`, `android-icon-foreground.png`, and `favicon.png`).
- **`src/screens/WelcomeScreen.tsx` / `src/screens/SettingsScreen.tsx`** — Switched the in-app brand mark references from the previous generated draft to the approved ClassMate logo.
- **`src/components/LegalDocumentModal.tsx`** — Removed remaining development-only wording from the Terms and Privacy documents so the in-app legal text now reads like app-facing copy rather than an internal placeholder draft.

### Session 64cq (Style the welcome wordmark to match the selected look)
- **`src/screens/WelcomeScreen.tsx`** — Replaced the plain `Welcome to ClassMate` heading with a more logo-like text treatment: a smaller `Welcome to` line plus a large two-tone `ClassMate` wordmark styled directly in code to resemble the approved reference without using the image itself.

### Session 64cr (Use a transparent cutout of the approved logo in-app)
- **`assets/classmate-logo-approved-transparent.png`** — Added a background-removed PNG cutout of the approved ClassMate logo so in-app branding can sit cleanly on non-white surfaces without showing the original white square.
- **`src/screens/WelcomeScreen.tsx` / `src/screens/SettingsScreen.tsx`** — Switched the in-app logo references from the flat white-background file to the transparent cutout version so the welcome hero and About screen display only the logo itself.

### Session 64cs (Lighten the welcome wordmark weight slightly)
- **`src/screens/WelcomeScreen.tsx`** — Reduced the `ClassMate` wordmark weight from `900` to `800` so the custom text logo keeps its bold feel but reads a little cleaner and less heavy.

### Session 64ct (Hint at upcoming school expansion in university selection)
- **`src/screens/UniversitySelectionScreen.tsx`** — Updated the subtitle under `Select Your University` to suggest that ClassMate will support more schools over time, while keeping the current selection flow unchanged.

### Session 64cu (Fix sign-up to sign-in auth handoff)
- **`App.tsx`** — Replaced the `Sign in instead` auth transition from a `pop` + `push` sequence with a top-of-stack `replace` so tapping it from the sign-up screen reliably opens the sign-in screen instead of occasionally bouncing back to the welcome flow.

### Session 64cv (Require initial profile setup after first sign-up)
- **`App.tsx`** — Added a first-time post-sign-up profile step so new users land on a full profile setup screen instead of going straight to the home tab. The app now tracks whether profile setup is still needed, routes fresh sign-ups into that flow, and marks the setup complete once the profile is saved.
- **`src/components/ProfileEditorScreen.tsx`** — Extracted the `Edit Profile` form into a reusable full-screen profile editor with the same fields as Settings, including year/major dropdowns, validation, and save CTA text that can be customized for onboarding.
- **`src/screens/SettingsScreen.tsx`** — Switched the Settings `Edit Profile` screen to use the new shared profile editor so the edit flow and the new sign-up onboarding flow stay in sync.
- **`src/data/userPreferences.ts`** — Extended saved `profile_details` with a `profileSetupComplete` flag helper so ClassMate can remember whether the initial profile step has already been finished.

### Session 64cw (Add first-time brand intro and feature onboarding)
- **`App.tsx`** — Inserted a new first-time user sequence after profile setup: a short brand-entry animation followed by a four-step feature tour, and persisted the onboarding completion state in `user_settings.profile_details` so it only runs for brand-new sign-ups.
- **`src/components/ClassMateIntroScreen.tsx`** — Added a cinematic transition screen that briefly brings the user “into” ClassMate with an animated logo, wordmark, and floating product chips before handing off to the tutorial.
- **`src/components/FeatureOnboardingScreen.tsx`** — Added a polished onboarding flow covering the main dashboard, custom timetable blocks, friend timetable sharing, and the community/messages experience with custom preview cards and step-by-step navigation.
- **`src/data/userPreferences.ts`** — Added an `onboardingComplete` flag helper so the app can distinguish between a finished profile setup and a finished first-run tutorial.

### Session 64cx (Simplify the first welcome screen around the CM monogram)
- **`src/screens/WelcomeScreen.tsx`** — Reworked the opening welcome screen into a cleaner, calmer layout with a code-built blue `CM` monogram, a simpler hero message, restrained background accents, and more minimal feature rows instead of the busier previous composition.

### Session 64cy (Remove the boxed-in feel from the welcome screen)
- **`src/screens/WelcomeScreen.tsx`** — Removed the large enclosing hero card so the welcome content now flows directly on the page background. The title, features, and CTA feel more open from top to bottom, while the smaller feature rows remain as separate floating surfaces instead of one big boxed panel.

### Session 64cz (Tighten auth-footer legal copy into one line)
- **`src/screens/SignInScreen.tsx` / `src/screens/SignUpScreen.tsx`** — Reduced the footer legal-consent text size and adjusted horizontal padding so the `By continuing... Terms of Service and Privacy Policy` line fits more cleanly on one line in the auth screens instead of wrapping awkwardly.

### Session 64dd (Soften the welcome flow and remove feature chips)
- **`src/screens/WelcomeScreen.tsx`** — Removed the `Timetable / Friends / Community` chips under the CM mark and lightened the feature cards / spacing below the hero so the lower half of the page feels more continuous and less visually segmented.

### Session 64da (Keep the review composer visible above the keyboard)
- **`src/components/ReviewsModal.tsx`** — Improved the write-review flow so the review text box no longer gets hidden behind the keyboard. Added a dedicated scroll ref plus keyboard/input-focus auto-scroll behavior, and nudged the modal’s keyboard offset/padding so the active review field stays visible while typing.

### Session 64db (Keep request-board inputs visible above the keyboard)
- **`src/screens/BoardScreen.tsx`** — Updated the `Request New Board` modal to behave like the review composer: it now uses a scroll ref plus keyboard/input-focus auto-scroll so the description field stays visible when the keyboard slides up instead of being covered.

### Session 64dc (Auto-jump into the review text box when writing reviews)
- **`src/components/ReviewsModal.tsx`** — Strengthened the write-review keyboard behavior so opening the composer now automatically scrolls to the review textarea and focuses it, instead of waiting for the user to manually scroll before typing.

### Session 64de (Align post-signup branding and rebuild onboarding previews)
- **`src/components/ClassMateMonogram.tsx`** — Extracted the blue `CM` monogram into a shared component so the same logo treatment can be reused across auth and first-run flows.
- **`src/screens/WelcomeScreen.tsx`** — Swapped the inline welcome logo implementation to the new shared monogram component without changing the existing welcome layout.
- **`src/components/ClassMateIntroScreen.tsx`** — Replaced the old uploaded logo image with the same shared `CM` monogram used on the first welcome screen so the post-signup intro now matches it exactly.
- **`src/components/FeatureOnboardingScreen.tsx`** — Rebuilt the four onboarding previews to look much closer to the real app, using actual UI ideas and labels like `Quarter Progress`, `Campus Events`, `My Schedule`, `Add Course`, `ClassMates`, `Friend Requests`, `Request New Board`, and `Write a Review`.

### Session 64df (Remove the boxed lower-half feel from the welcome screen)
- **`src/screens/WelcomeScreen.tsx`** — Softened the lower background accent, removed the card-like feature row containers, and added more bottom breathing room so the welcome screen reads as one continuous page instead of a top section sitting above a separate boxed panel. Also adjusted the bottom copy spacing so the sign-in helper text is less likely to get visually clipped.

### Session 64dg (Stop sign-in from silently creating brand-new accounts)
- **`src/screens/SignInScreen.tsx`** — Added a guard so the sign-in flow now checks for an existing ClassMate signup marker or saved user settings before allowing entry. If Google OAuth returns a freshly created account with no ClassMate history, the app now signs back out and sends the user to `Create a new account` instead of dropping them into the home flow.
- **`src/screens/SignUpScreen.tsx`** — After a real sign-up succeeds, now writes a lightweight `classmate_signup_started` marker into the authenticated user metadata so future sign-ins can distinguish a deliberate ClassMate signup from a mistaken first-time sign-in attempt.

### Session 64dh (Show brand intro after onboarding and simplify timetable tutorial card)
- **`App.tsx`** — Moved the animated ClassMate intro to the end of the first-run sequence so new users now go `profile setup → feature tutorial → brand intro → app` instead of seeing the intro before the tutorial.
- **`src/components/FeatureOnboardingScreen.tsx`** — Simplified the timetable tutorial step with a shorter title/body and a cleaner preview card that uses fewer blocks, lighter labels, and less visual clutter.

### Session 64di (Slow down the post-onboarding ClassMate intro)
- **`src/components/ClassMateIntroScreen.tsx`** — Increased the reveal timings and extended the auto-dismiss delay so the brand intro lingers long enough to actually read before it fades into the app.

### Session 64dj (Remove visible boundary lines from welcome and onboarding)
- **`src/components/FeatureOnboardingScreen.tsx`** — Removed the thin border treatment from the main onboarding card and its preview cards so the tutorial feels less boxed-in and no longer shows those subtle edge lines.
- **`src/screens/WelcomeScreen.tsx`** — Removed the remaining subtle border outlines from the welcome pill and icon tiles so the first screen no longer shows extra boundary lines either.

### Session 64dk (Require real ClassMate signup state before allowing sign-in)
- **`src/screens/SignInScreen.tsx`** — Tightened the Google sign-in gate again so `Sign In` now rejects any account that lacks both a saved `user_settings` row and the explicit ClassMate signup metadata marker, instead of relying on a looser “fresh account” timing heuristic.
- **`App.tsx`** — Added a second safety net so if an authenticated user somehow reaches the app without a `user_settings` row, ClassMate treats them as needing initial profile setup instead of dropping them straight onto the home screen.

### Session 64dl (Make missing profile rows block sign-in)
- **`src/screens/SignInScreen.tsx`** — Updated the sign-in verification to require a real `profiles` row before a user can enter the app. Accounts without a saved ClassMate profile now get signed back out and redirected toward account creation instead of slipping through login.
- **`App.tsx`** — Removed the automatic post-login `profiles` upsert so the app no longer silently manufactures profile rows for users who never finished ClassMate signup. The preference loader now only falls back to profile setup when both `profiles` and `user_settings` are absent, preserving the first-time sign-up flow without weakening login checks.

### Session 64di (Slow down the post-onboarding ClassMate intro)
- **`src/components/ClassMateIntroScreen.tsx`** — Increased the reveal timings and extended the auto-dismiss delay so the brand intro lingers long enough to actually read before it fades into the app.

### Session 64dm (Restore visible university branding in school selection)
- **`src/screens/UniversitySelectionScreen.tsx`** — Made the school logo tile more visible again by giving it a soft blue background, slightly enlarging the UCI monogram image, and switching fallback school text to brand blue so the university branding no longer disappears into the white card.

### Session 64dn (Set the production app name for TestFlight)
- **`app.json`** — Changed the Expo app name from `uci-app` to `ClassMate` so the iOS build shows the correct product name in TestFlight and on installed devices.

### Session 64do (Prepare Expo config for TestFlight permissions and submission)
- **`app.json`** — Added Expo config plugins for `expo-image-picker`, `expo-media-library`, and `expo-notifications` with explicit iOS permission copy so photo attachments, saving schedules, and notifications are configured cleanly before a TestFlight build. Also set `ios.config.usesNonExemptEncryption` to `false` to simplify App Store Connect export-compliance handling.

### Session 64dp (Save timetable as a single-screen image)
- **`src/screens/TimetableScreen.tsx`** — Changed the save-capture target from the full scroll content to the visible timetable viewport wrapper so `Save Schedule` now exports a one-screen image instead of a long scrolling image.

### Session 64dq (Compress saved timetable into a full overview snapshot)
- **`src/screens/TimetableScreen.tsx`** — Reworked schedule saving again so it now captures a hidden export-only timetable layout with compressed hour spacing, a summary header, and compact TBA/Online chips. Saving no longer just crops the current viewport; long schedules are scaled down to fit into a single overview image.

### Session 64dr (Implement timetable sharing from the same export image)
- **`src/screens/TimetableScreen.tsx`** — Wired the `Share` button to generate the same compressed export image used for saving and open the native system share sheet through `expo-sharing`. Added device-availability and failure handling so sharing now works on supported platforms instead of showing a placeholder error.

### Session 64ds (Remove unrelated design/reference folders from the app workspace)
- **`AntAlmanac-main` / `Figma_design5`** — Deleted the unrelated reference/design folders from the repository root because they were not imported anywhere in the app and were only adding noise during project checks before TestFlight prep.

### Session 64dt (Clean TypeScript/build blockers before TestFlight)
- **`package.json` / `package-lock.json`** — Added the missing `@expo/vector-icons` dependency through `expo install` so the app’s icon imports resolve consistently in local checks and EAS builds.
- **`src/screens/BoardScreen.tsx`** — Fixed the author-name map typing so hidden-profile fallbacks always stay strings instead of leaking `undefined` into the comment tree builder.
- **`src/screens/CoursePickerScreen.tsx`** — Replaced direct `.finally()` calls on Supabase query builders with async IIFEs using `try/finally`, which removes the `PromiseLike` TypeScript errors while preserving the loading-state behavior.
- **`tsconfig.json`** — Excluded `supabase/functions` from the app TypeScript project so Deno-only edge-function files do not pollute the mobile-app readiness check.

### Session 64du (Adopt EAS remote app-version management)
- **`eas.json`** — Updated the EAS CLI config to use `appVersionSource: "remote"` when the first production build was started. This lets EAS manage iOS build-number auto-incrementing cleanly for repeated TestFlight uploads.

### Session 64dv (Switch to an available iOS bundle identifier)
- **`app.json`** — Changed the Expo URL scheme and iOS bundle identifier from `com.classmate.app` to `com.parksihyun.classmate` after Apple rejected the original identifier as unavailable for the current individual developer team during TestFlight build setup.

### Session 64dw (Clean Expo readiness issues before submission)
- **`package.json` / `package-lock.json`** — Installed `expo-font` and aligned Expo SDK patch versions (`expo`, `expo-auth-session`, `expo-media-library`, `react-native`) with Expo Doctor’s recommended SDK 55 releases so the app is less likely to hit native dependency issues outside Expo Go.
- **`.gitignore` / `.expo/`** — Added a new ignore file with `.expo/`, `node_modules/`, and common local log files, then removed the tracked local `.expo` cache/log folder so machine-specific Expo state no longer pollutes project checks.
- **`.easignore`** — Added a matching EAS ignore file to keep local Expo state and `node_modules` out of future cloud build uploads, which should make rebuilds lighter and cleaner.

### Session 64dx (Use app-scheme OAuth redirects instead of localhost)
- **`src/screens/SignInScreen.tsx` / `src/screens/SignUpScreen.tsx`** — Replaced the raw `Linking.createURL('auth/callback')` redirect with a scheme-aware helper that prefers the configured Expo app scheme and falls back to `com.parksihyun.classmate`. This avoids Google auth bouncing to `localhost` in simulator/dev-client flows where no local web server is available.

### Session 64dy (Restore persisted login sessions on app launch)
- **`App.tsx`** — Added an initial `supabase.auth.getSession()` restore pass plus `INITIAL_SESSION` / `SIGNED_IN` / `TOKEN_REFRESHED` handling so saved Supabase sessions are hydrated when the app relaunches instead of sending users back to the welcome/login flow on every cold start.

### Session 64dz (Keep tapped course visible when switching expanded rows)
- **`src/screens/CoursePickerScreen.tsx`** — Added row-position tracking plus scroll-offset compensation to the course list so switching from one expanded course to another no longer yanks the newly tapped course off-screen when the previously expanded row collapses above it.

### Session 64ea (Lower the entire welcome-screen stack)
- **`src/screens/WelcomeScreen.tsx`** — Shifted the whole welcome layout slightly downward, including the CTA button and legal copy, so the first screen feels less top-heavy without changing the content itself.

### Session 64eb (Reduce the welcome-screen legal copy size)
- **`src/screens/WelcomeScreen.tsx`** — Lowered the `By continuing...` legal consent text size and line height on the welcome screen so the bottom copy feels lighter and less visually dominant.

### Session 64ec (Force newly tapped course to stay visible after another collapses)
- **`src/screens/CoursePickerScreen.tsx`** — Reworked the expanded-row scroll fix so when a different course is opened while another one is already expanded, the list now snaps the newly tapped course back near the top of the viewport after layout settles instead of only trying to compensate by height delta.

### Session 64ed (Preserve the tapped course’s on-screen position)
- **`src/screens/CoursePickerScreen.tsx`** — Adjusted the expanded-row scroll fix again so it keeps the newly tapped course at roughly the same viewport position it had before the other row collapsed, instead of snapping that course to the very top of the list.

### Session 64ee (Allow multiple courses to stay expanded in search)
- **`src/screens/CoursePickerScreen.tsx`** — Replaced the single-expanded-course behavior with independent per-course expand/collapse state so opening a new course no longer auto-collapses the one above it, which removes the scroll-jump problem entirely.

### Session 64ef (Make DOB reachable on smaller signup screens)
- **`src/components/ProfileEditorScreen.tsx`** — Reworked the profile editor’s keyboard handling so the Date of Birth field scrolls into view more reliably on shorter devices, with adaptive bottom padding based on keyboard height and footer height instead of a brittle hardcoded offset.

### Session 64eg (Ask for notifications during first-run onboarding)
- **`App.tsx`** — Inserted a first-run notification permission step between feature onboarding and the brand intro so new users can enable push notifications immediately instead of having to discover the setting later.
- **`src/components/NotificationPermissionScreen.tsx`** — Added a dedicated onboarding screen that explains the benefit of reminders and social alerts, requests notification permission when the user taps enable, and falls back cleanly if permission is denied or unavailable.

### Session 64eh (Add review-only email sign-in fallback)
- **`src/screens/SignInScreen.tsx`** — Added a narrow email/password fallback section for App Review and other Duo-blocked cases, while keeping university Google sign-in as the primary path. The new flow reuses the existing ClassMate account checks so review accounts still need a real profile and saved setup before entering the app.

### Session 64ei (Keep board users anonymous while showing major/year)
- **`src/screens/BoardScreen.tsx`** — Switched board post and comment display to always use anonymous Anteater IDs, while adding each user’s major and year as small secondary metadata next to the anonymous label. Also removed the old comment-name replacement that turned the original poster’s display name into `Author`; post owners now keep their anonymous ID and get a small `Author` badge only on their own comments so non-authors are no longer mislabeled.

### Session 64ej (Add pull-to-refresh to community screens)
- **`src/screens/BoardScreen.tsx`** — Added pull-to-refresh support to the main board list, board post list, and individual post detail view so dragging down refreshes the latest community posts and comments without leaving the screen.

### Session 64ek (Dismiss keyboards after completion actions)
- **`src/components/ProfileEditorScreen.tsx`**, **`src/components/ReviewsModal.tsx`**, **`src/screens/BoardScreen.tsx`**, **`src/screens/CoursePickerScreen.tsx`**, **`src/screens/MessagesScreen.tsx`**, **`src/screens/SettingsScreen.tsx`**, **`src/screens/SignInScreen.tsx`**, **`src/screens/UniversitySelectionScreen.tsx`** — Added `Keyboard.dismiss()` to key completion points such as save/submit/send buttons and selection confirmations so the keyboard drops away automatically once an action is finished or a picker selection has been made.

### Session 64el (Restore Campus Events after UCI Athletics feed change)
- **`src/data/sportsEvents.ts`** — Added a fallback parser for the new official UCI Athletics composite calendar HTML, including entity stripping, upcoming-event heading parsing, and support for `versus/at` event summaries and optional `TBA` time labels. The old ICS parser remains in place for compatibility.
- **`src/screens/HomeScreen.tsx`** — Switched Campus Events from the broken `calendar.ics` URL to the live `https://ucirvinesports.com/calendar` page, added explicit sports loading state, and now shows a real empty-state message instead of getting stuck on “Loading upcoming games…” when no events are available.

### Session 64em (Bump app version for a fresh external TestFlight review lane)
- **`app.json`** — Updated the app version from `1.0.0` to `1.0.1` so a new external TestFlight review can be submitted while version `1.0.0` still has a build waiting for review.

### Session 64en (Detach unauthorized EAS project link and reassign Expo owner)
- **`app.json`** — Changed the Expo owner from `hiiseans` to `parksihyun` and removed the stale `extra.eas.projectId` entry so EAS can initialize a new accessible project under the current account instead of repeatedly targeting an unauthorized legacy AppEntity.

### Session 64eo (Fix Expo start failure from broken ws dependency resolution)
- **`package.json`** — Added a direct `ws@7.5.10` dependency so React Native / Metro resolve the websocket package version they expect instead of picking an incompatible root `ws@8.x`.
- **`package-lock.json`** — Refreshed the npm lockfile after reinstalling dependencies, which restored the correct mixed `ws@7.5.10` and nested `ws@8.x` tree and fixed the `Cannot find module './lib/subprotocol'` startup crash when running `npx expo start`.

### Session 64ep (Add all-board post search from the board landing screen)
- **`src/screens/BoardScreen.tsx`** — Added a new global search bar to the board selection screen that searches across all posts by title, body, anonymous author label, and category before a user enters a specific board. Matching results now appear inline on the landing screen, and tapping one opens the correct board and post detail directly.

### Session 64eq (Add section-code search and ClassMate demand signals to course picker)
- **`src/screens/CoursePickerScreen.tsx`** — Expanded course search so students can also find courses by 5-digit section code, both in department/global search and in the local expanded-section filter.
- **`src/screens/CoursePickerScreen.tsx`** — Added ClassMate-specific metadata to each section card: the average review rating from this app’s `reviews` table and the number of unique users who have saved that exact section in their timetable for the selected quarter, giving students an in-app demand signal rather than relying on official enrollment alone.

### Session 64er (Expand UCI map coverage and add final-exam fallback guidance)
- **`src/data/uciLocations.ts`** — Expanded the UCI building map with more common classroom/location codes and added alias handling so more abbreviated room strings resolve to a map preview instead of falling back to plain text only.
- **`src/components/ReviewsModal.tsx`** — Added a final-exam fallback message so courses without `final_exam` data still show a helpful “check WebSOC/Canvas/instructor” note instead of leaving the finals section blank.

### Session 64es (Stop incorrectly merging distinct Social Sciences buildings)
- **`src/data/uciLocations.ts`** — Removed the incorrect alias mappings that treated `SSTR` as `SST` and `SSLH` as `SSL`, so those UCI location codes are no longer collapsed into the wrong building during map resolution.

### Session 64et (Scope final-exam details to the selected quarter)
- **`src/components/ReviewsModal.tsx`** — Stopped fetching course info by `code` alone and now scope `sections` lookups to the current `quarter_key`, preferring rows that actually contain `final_exam` data. This prevents a Spring course from showing final-exam details from a different quarter such as Fall.
- **`src/screens/CoursePickerScreen.tsx`**, **`src/screens/TimetableScreen.tsx`** — Passed the currently selected `quarterKey` into `ReviewsModal` so course details and final-exam data always match the quarter the user is viewing.

### Session 64eu (Use section-specific final-exam lookups first)
- **`src/components/ReviewsModal.tsx`** — Added `sectionId` support so course details now look up `sections.id = <sectionCode>::<quarterKey>` first, falling back to course-code matching only if the exact section row is unavailable. This makes final-exam details much less likely to come from a different section of the same course.
- **`src/screens/CoursePickerScreen.tsx`**, **`src/screens/TimetableScreen.tsx`** — Updated Reviews modal launches to pass the actual selected section’s `id`, so the modal can fetch the most specific final-exam data available.

### Session 64ev (Fix one-month-early final exam dates)
- **`src/components/ReviewsModal.tsx`** — Fixed final-exam month formatting so 0-based month values from the stored course data are no longer shifted one month early when rendered in the UI.

### Session 64ew (Polish core UI surfaces for a more premium ClassMate brand feel)
- **`src/context/ThemeContext.tsx`** — Refined the light/dark color palettes toward softer blue-tinted neutrals, deeper navy text, and more cohesive branded surfaces so the app feels more deliberate and upscale without changing the existing blue brand direction.
- **`src/screens/WelcomeScreen.tsx`** — Tightened the hero composition, softened ambient background shapes, polished the monogram presentation, and refined the CTA/button surface so the first impression feels more premium while preserving the current tone.
- **`src/screens/HomeScreen.tsx`** — Reworked the home header and card styling with stronger micro-label hierarchy, softer borders, subtler shadows, and cleaner branded surfaces to make the dashboard feel more luxurious and less boxy.
- **`src/screens/TimetableScreen.tsx`** — Refined the timetable header, quarter picker, plan pills, and grid shell so the main planner screen better matches the upgraded brand language without changing core behavior.
- **`src/screens/BoardScreen.tsx`** — Polished the board landing screen with a more elevated header, search field, board cards, and action surfaces so the community area feels consistent with the rest of the app’s premium styling.

### Session 64ex (Restore Metro-compatible ws dependency for local Expo dev)
- **`package.json`** — Reset the root `ws` dependency from `^8` back to `7.5.10` so React Native / Metro resolve the websocket version they expect and local `expo start` no longer crashes on the missing `./lib/subprotocol` module.

### Session 64ey (Remove timetable header seam for a cleaner continuous surface)
- **`src/screens/TimetableScreen.tsx`** — Removed the artificial divider line below the timetable header and matched the header/background surface colors so the top of the timetable screen reads as one continuous premium surface instead of splitting into a visible white/blue boundary.

### Session 64ez (Remove decorative micro-labels from Home and Timetable headers)
- **`src/screens/HomeScreen.tsx`**, **`src/screens/TimetableScreen.tsx`** — Removed the added “Today at a glance” and “Build your quarter” header pills so those screens feel cleaner, quieter, and less visually busy while keeping the upgraded spacing and surface polish.

### Session 64fa (Unify main tab header title weight across the app)
- **`src/screens/GradesScreen.tsx`**, **`src/screens/FriendsScreen.tsx`**, **`src/screens/MessagesScreen.tsx`** — Upgraded the remaining legacy tab headers from the older `28 / bold` styling to the same heavier `30 / 800` title treatment used on Home, Timetable, and Board, so core screen titles now feel consistent and intentionally branded.

### Session 64fb (Turn Home into a smarter student dashboard)
- **`App.tsx`** — Changed Home to use a single primary timetable (`My Schedule` first, then fallback) instead of flattening every plan in the quarter together. Also passed Home the signed-in user context, ClassMates/message callbacks, and class-reminder settings so Home cards can show friend overlap and alert status accurately.
- **`src/screens/HomeScreen.tsx`** — Added five new home cards built from existing app data only: `Next Class Intelligence` (countdown, walk estimate, leave-by time, shared-classmate signal), `Gap Planner` (gap length, suggested break/study blocks, quiet spot suggestion), `Academic Health` (current quarter grade snapshot), `Campus Map` (route to next class, frequent buildings, reminder status), and `ClassMates` (shared-classmate summary with quick message/open actions). Also restored an inline weather unit toggle and reduced the live clock refresh cadence so the dashboard updates efficiently without a 16ms timer.

### Session 64fc (Repair broken local Expo `ws` install)
- **`node_modules/ws/lib/subprotocol.js`**, **`node_modules/ws/wrapper.mjs`** — Restored two missing files from Expo’s nested `ws` copy after the root `ws` install was left incomplete and `expo start` failed with `Cannot find module './lib/subprotocol'`. This was an environment repair to get Metro booting again, not an app feature change.

### Session 64fd (Reframe Home into a Today-first control center)
- **`src/screens/HomeScreen.tsx`** — Rebuilt the home experience around a single `Today` hero instead of a stacked dashboard. The new layout now centers the next important class action first, with a progress ring, cleaner timeline, Today Insight block, compact quarter/weather cards, and tighter supporting sections for Academic Health, Campus Map, Classmates, and Campus Pulse. The copy also shifts away from negative completion language toward calmer, action-oriented status summaries.
- **`App.tsx`** — Renamed the bottom tab label from `Home` to `Today` so the nav matches the new screen purpose and the app reads more like a daily student OS than a generic dashboard.

### Session 64fe (Simplify Today around the next class and quarter pulse)
- **`src/screens/HomeScreen.tsx`** — Removed the extra `Classmates` surface and folded friend overlap directly into the hero under the class title, so shared classes feel contextual instead of like a separate dashboard module. Also moved the `Map` action into a dedicated right-side hero column for better balance, kept only the most useful Today cards, and turned the quarter summary into a progress ring card that makes Spring-term progress feel more alive at a glance.
- **`App.tsx`** — Stopped passing the old Home-only timetable/grades/friends navigation callbacks that the simplified `Today` screen no longer uses, keeping the screen contract smaller and type-safe.

### Session 64ff (Put the hero progress ring above the map action)
- **`src/screens/HomeScreen.tsx`** — Swapped the vertical order of the hero’s right-side controls so the day-progress ring sits above the `Map` button. This gives the status signal the higher visual priority and keeps the map action feeling like a secondary follow-up action.

### Session 64fg (Align the hero map action with the class title row)
- **`src/screens/HomeScreen.tsx`** — Moved the hero `Map` button out of the right-side ring column and back onto the class-title row, spaced to the far right of the title for a more balanced horizontal alignment. The progress ring stays in the separate right column so the hero keeps a clear status/action hierarchy without stacking both controls together.

### Session 64fh (Anchor the hero map action under the ring, level with the title band)
- **`src/screens/HomeScreen.tsx`** — Repositioned the hero `Map` button into the right-side action column beneath the day-progress ring, while offsetting it downward so it visually lines up with the class-title band rather than hugging the ring. This keeps the map action in the right rail but preserves the title row’s breathing room.

### Session 64fi (Strip Today down to the essentials)
- **`src/screens/HomeScreen.tsx`** — Removed the separate `Campus Map` card so the Today screen stays focused on the next action rather than repeating navigation detail in a second surface. Also simplified the quarter card into a larger progress ring with the percentage and remaining days inside the ring, while dropping the extra week-status copy that was redundant with the header.

### Session 64fj (Restore multi-event campus list and quiet the quarter card)
- **`src/screens/HomeScreen.tsx`** — Renamed the confusing `Campus Pulse` section back to `Campus Events` and restored a simple list of events across today and tomorrow instead of surfacing only one highlighted pick. Also removed the extra `Through finals week` caption under the quarter ring so the card stays minimal with just the title and the ring itself.

### Session 64fk (Align the hero map action to the class-title band)
- **`src/screens/HomeScreen.tsx`** — Kept the `Map` action in the hero’s right rail under the day-progress ring, but changed it from normal flow to an absolutely positioned control so it lines up with the class-title band instead of dropping to the level of the time/location line.

### Session 64fl (Remove the unstable Today hero map action)
- **`src/screens/HomeScreen.tsx`** — Removed the `Map` button from the Today hero after the right-rail placement kept fighting the layout. The card now prioritizes the next-class information and progress ring without a misaligned secondary action.
- **`App.tsx`** — Dropped the no-longer-used `school` prop from the Today screen wiring after removing the hero map action.

### Session 64fm (Give the hero title its width back)
- **`src/screens/HomeScreen.tsx`** — Tightened the gap between the hero text column and the day-progress ring, removed the extra right padding from the text column, and narrowed the ring rail so ordinary class titles stop wrapping to a second line unnecessarily. The title now prefers a single line with tail truncation only when genuinely needed.

### Session 64fn (Keep the hero duration on one line)
- **`src/screens/HomeScreen.tsx`** — Made the main next-class headline fit on a single line with font scaling instead of wrapping, so hour/minute chunks such as `4h 40m` stay together and read naturally.

### Session 64fo (Split the hero countdown into a label line and a duration line)
- **`src/screens/HomeScreen.tsx`** — Reworked the hero countdown so copy like `Next class in` sits on one line and the full duration such as `15h 32m` sits together on the next line at the same size, instead of shrinking the text to force everything onto one line.
- **`src/screens/HomeScreen.tsx`** — Expanded the `Campus Events` list to show more upcoming games from the fetched athletics feed instead of cutting the section off at only today/tomorrow.

### Session 64fp (Deduplicate athletics events before rendering)
- **`src/data/sportsEvents.ts`** — Added a dedupe pass keyed by title, location, timestamp, and time label so duplicate rows coming from the UCI athletics feed no longer survive parsing and cause repeated cards.
- **`src/screens/HomeScreen.tsx`** — Switched the campus-event row keys to a stronger composite key and expanded the list to show up to 12 upcoming events, fixing the duplicate-key redbox while still surfacing more games on the Today screen.

### Session 64fq (Stop showing the event day twice)
- **`src/data/sportsEvents.ts`** — Simplified `formatSportsEventTime()` so it returns only the time portion. The Home screen already renders `Today` / `Tomorrow` / date labels separately, so this removes the duplicated day text like `Today · Today, 6:00 PM`.

### Session 64fr (Add a shared-classmates summary to Today Insight)
- **`src/screens/HomeScreen.tsx`** — Added a Today Insight line that summarizes how many friends overlap with how many of today’s classes, using only timetable-sharing friends and only courses happening today. This keeps the hero focused on the next class while still giving a quick sense of today’s social overlap.

### Session 64fs (Remove the duplicate “classes left” text from the hero)
- **`src/screens/HomeScreen.tsx`** — Replaced the hero’s `One class left today` / `N classes left today` helper copy with the simpler `Next up` state label. The day-progress ring already communicates the remaining-count idea, so this avoids repeating the same status in two places.

### Session 64ft (Let the hero open directly on the countdown)
- **`src/screens/HomeScreen.tsx`** — Removed the extra `Next up` helper label as well, so the hero now starts directly with the main countdown/value unless there is an active current-class state to call out.

### Session 64fu (Remove campus route experiment)
- **`src/screens/HomeScreen.tsx`** — Removed the Today Insight campus-route map experiment and its route helper code after it did not feel useful in practice. Kept the current-class hero timeline as a filled progress bar instead of a moving dot because that state reads more clearly during an active class.

### Session 64fv (Hero class carousel)
- **`src/screens/HomeScreen.tsx`** — Removed the Today Insight card and replaced the single hero card with a horizontally swipeable class carousel. The first card now shows the active class with `Ends in`, later cards show remaining classes with `Starts in`, and the current-class timeline stays as a filled progress bar for a cleaner Apple-widget-style first screen.

### Session 64fw (Full-width hero carousel cards)
- **`src/screens/HomeScreen.tsx`** — Adjusted the hero class carousel so each page uses the existing Today content width without extra side padding or a negative container margin. This prevents the next card from peeking in while one card is selected, making each card feel full-width and centered.

### Session 64fx (Clean hero carousel card edge)
- **`src/screens/HomeScreen.tsx`** — Set the hero carousel wrapper/scroll view to allow visible overflow and softened the carousel card shadow so the rounded card no longer reads as a clipped rectangular box around the edge.

### Session 64fy (Hide offscreen hero cards)
- **`src/screens/HomeScreen.tsx`** — Clipped the hero carousel viewport to exactly one card width, enabled interval momentum locking, and softened the card shadow further so offscreen cards no longer peek in while the pagination dots still indicate additional cards.

### Session 64fz (Include completed classes in hero carousel)
- **`src/screens/HomeScreen.tsx`** — Changed the hero carousel to include every class from today, not only current/upcoming classes. Completed cards use the same layout with a `Completed` status, `Ended` time, and a filled muted progress bar; the carousel now opens on the current class, next class, or final completed class depending on where the day is.

### Session 64ga (Contextual hero carousel window)
- **`src/screens/HomeScreen.tsx`** — Narrowed the hero carousel from all of today’s classes to the current context only: during class it keeps previous/current/next cards, and between classes it keeps previous/next cards. The selected card defaults to current when in class, otherwise next, then previous after the day is done.

### Session 64gb (Restore full-day hero carousel)
- **`src/screens/HomeScreen.tsx`** — Restored the hero carousel to include all of today’s classes so multiple completed classes and multiple remaining classes are still available. The carousel still opens centered on the current class when one is active, otherwise the next class, then the final completed class.

### Session 64gc (Group past and future hero cards)
- **`src/screens/HomeScreen.tsx`** — Changed the hero carousel card model so completed classes collapse into one summary card and future classes collapse into one remaining-classes summary card, while the current class stays as its own live countdown card.

### Session 64gd (List grouped hero classes)
- **`src/screens/HomeScreen.tsx`** — Updated the grouped completed/upcoming hero cards to show each included class as its own row with code, time, and location instead of only showing a count. Removed the carousel card shadow to prevent the clipped rectangular shadow artifact from reappearing around the rounded card.

### Session 64ge (Quiet grouped hero labels)
- **`src/screens/HomeScreen.tsx`** — Removed the small `Earlier today` / `Remaining today` status labels from grouped hero cards and unified the list-row dot color per card so the grouped class lists look calmer and more consistent.

### Session 64gf (Shared classes on ClassMates)
- **`App.tsx`** — Passed the active timetable courses and selected quarter into `FriendsScreen` so the friends tab can compare the signed-in user’s classes against friend timetables.
- **`src/screens/FriendsScreen.tsx`** — Added shared-class detection for the active quarter, a top `Shared Classes This Quarter` card grouped by course with matching friends, and per-friend shared-course summaries in the ClassMates list.
- **`src/screens/HomeScreen.tsx`** — Measured each hero carousel card and applied the active card height to the carousel container so shorter grouped cards no longer leave empty vertical space before the content below.

### Session 64gg (Stabilize hero card height)
- **`src/screens/HomeScreen.tsx`** — Replaced the horizontal `ScrollView` hero carousel with a single rendered active card plus swipe gestures. This removes clipped cards, delayed height changes, and empty space when grouped completed/upcoming cards have different list lengths.

### Session 64gh (Match shared classes by course code)
- **`src/screens/FriendsScreen.tsx`** — Relaxed ClassMates shared-class matching to treat the same course code as an overlap, even when friends have a different section/time. This makes the shared-classes card surface expected overlaps like `ECON 100A` instead of requiring identical section ids.

### Session 64gi (Promote shared class block and remove board eyebrow)
- **`src/screens/FriendsScreen.tsx`** — Moved the shared-classes block directly under the ClassMates header, added a header subtitle with friend/shared-class counts, and removed the duplicate shared block from inside the friends list so the feature appears as a first-class screen section.
- **`src/screens/BoardScreen.tsx`** — Removed the `CAMPUS COMMUNITY` eyebrow pill above the Board title for a cleaner header.

### Session 64gj (Department boards)
- **`src/screens/BoardScreen.tsx`** — Added a `Department Boards` entry to the main board list, powered by `UCI_DEPARTMENTS`, with a searchable department-board picker. Selecting a department opens a normal board post list scoped to that department category, and posts created from that screen save back into the matching department board.

### Session 64gk (Quarter grade summaries and persistent shared block)
- **`src/screens/GradesScreen.tsx`** — Added per-quarter summary stats to each expandable quarter card, including quarter GPA, total units, graded-course count, and GPA-counted units before the course list.
- **`src/screens/FriendsScreen.tsx`** — Kept the shared-classes block visible even when there are no overlaps, showing the user’s current-quarter classes with zero-overlap rows so the ClassMates screen keeps the same structure as the reference mockup.

### Session 64gl (Compact shared classes block)
- **`src/screens/FriendsScreen.tsx`** — Compressed the `Shared Classes This Quarter` block by reducing header and row padding, shrinking course chips and avatar bubbles, and capping the visible shared-class rows at four so the ClassMates screen keeps the concept without consuming as much vertical space.

### Session 64gm (ClassMates search separation)
- **`src/screens/FriendsScreen.tsx`** — Removed the friend/shared-class count subtitle under the ClassMates title and added divider lines around the classmate search field so the search area reads as a separate section.

### Session 64gn (Reorder ClassMates controls)
- **`src/screens/FriendsScreen.tsx`** — Moved the classmate search bar and ClassMates/Requests segmented controls above the shared-classes card while keeping the friend list below it. Restyled the search bar like the Board search field and removed the heavy divider lines so it feels lighter.

### Session 64go (Scrollable headers and shared-course dedupe)
- **`src/screens/FriendsScreen.tsx`** — Changed shared-class grouping to dedupe by course code instead of section id so the same course, such as `ECON 129`, appears only once in the shared-classes block.
- **`src/screens/BoardScreen.tsx`** — Moved the Board title/actions into the main scroll content so the header scrolls away like Today and Grades.
- **`src/screens/TimetableScreen.tsx`** — Moved the Timetable title, quarter picker, settings button, and plan tabs into the timetable scroll content so screen headers behave consistently across the app.

### Session 64gp (Remove tab bar streak artifacts)
- **`App.tsx`** — Removed decorative glass highlight layers from the bottom tab bar and active pill because they appeared as stray double-line marks on the Home tab bar in the built app.

### Session 64gq (Contain Board header actions)
- **`src/screens/BoardScreen.tsx`** — Constrained the Board header title/subtitle column, shortened the subtitle and post button label, and prevented the action button row from shrinking so the messages and post buttons no longer spill off-screen.

### Session 64gr (Unify board search fields)
- **`src/screens/BoardScreen.tsx`** — Restyled the Department Boards picker search field and individual board post search field to match the main Board search bar, using the same card background, border, shadow, spacing, and icon sizing.

### Session 64gs (Board attachment storage setup)
- **`supabase/sql/board_attachments_storage.sql`** — Added the missing Supabase Storage setup for board post attachments, including the `board-attachments` bucket, attachment-related `posts` columns, and storage policies that let signed-in users manage files under their own user-id folder. This fixes photo/file upload failures caused by the bucket not existing in Supabase.

### Session 64gt (Allow iPhone HEIC board photos)
- **`supabase/sql/board_attachments_storage.sql`** — Added `image/heic` and `image/heif` to the board attachment bucket MIME allowlist so photos selected directly from iPhone libraries can upload without being rejected by Supabase Storage.

### Session 64gu (Inline board post images)
- **`src/screens/BoardScreen.tsx`** — Changed board post detail rendering so image attachments display as large inline post images under the body, while non-image files remain in the separate attachments list. Added small attachment helpers to consistently detect image MIME types and resolve local/public image URIs.

### Session 64gv (Open board files through native sharing)
- **`src/screens/BoardScreen.tsx`** — Changed non-image board attachments to download into the app cache and open through the native sharing/preview sheet instead of sending users to the raw Supabase public URL. Inline image previews no longer open the Supabase URL when tapped.
- **`package.json` / `package-lock.json`** — Added `expo-file-system` as a direct dependency so board files can be downloaded locally before handing them to iOS preview/sharing.

### Session 64gw (Clean up board post metadata and composer fields)
- **`src/screens/BoardScreen.tsx`** — Moved the board/category context out of the post author metadata row and into the post-detail header as `Post / <board>`, leaving author metadata focused on the writer and timestamp. Restyled the new-post Board, Title, and Content fields with card backgrounds, borders, and subtle elevation so they read as inputs against the modal background.

### Session 64gx (Convert HEIC board photos to JPEG)
- **`src/screens/BoardScreen.tsx`** — Added HEIC/HEIF detection in the image picker flow and converts those iPhone photos to JPEG before storing them as board attachments, so uploaded post images can render reliably in the inline post preview.
- **`package.json` / `package-lock.json`** — Added `expo-image-manipulator` so selected HEIC/HEIF photos can be converted locally before upload.

### Session 64gy (Improve file preview and hero carousel controls)
- **`src/screens/BoardScreen.tsx`** — Added file extension and iOS UTI inference for board attachments, tries opening downloaded files by local URI first, and falls back to the native share/preview sheet with stronger type hints so PDFs and Office files do not just bounce users to the Supabase URL.
- **`src/screens/HomeScreen.tsx`** — Added slide/fade animation to the Today hero card transitions and made the pagination dots tappable so users can switch hero cards by swiping or tapping the dots.

### Session 64gz (Scope General Board posts)
- **`src/screens/BoardScreen.tsx`** — Changed the General Board from a null catch-all board to the explicit `General` category and updated board filtering/count/edit lookups to use normalized board categories. General now shows only General posts instead of every board post.

### Session 64ha (Make sign-up the primary auth path)
- **`App.tsx`** — Changed the post-university-selection auth route to open the sign-up screen first instead of sign-in, so new users land on account creation by default.
- **`src/screens/SignUpScreen.tsx`** — Strengthened the sign-up hierarchy with clearer copy, a `Create account with Google` primary action, and a more visible secondary `Sign in instead` button for existing users.

### Session 64hb (Add account deletion flow)
- **`src/screens/SettingsScreen.tsx`** — Added a destructive `Delete Account` button below `Log Out` with a disabled/loading state while deletion is running.
- **`App.tsx`** — Added a two-step destructive confirmation flow and wired account deletion to a Supabase RPC before clearing local auth/app state.
- **`supabase/sql/delete_account.sql`** — Added the `delete_current_user()` security-definer function that removes the signed-in user's profile, settings, friends, timetables, grades, messages, posts, comments, votes, reviews, reports by the user, board requests, board attachment storage objects, and Auth user row.

### Session 64hc (Add Hot Board)
- **`src/screens/BoardScreen.tsx`** — Added a dynamic `Hot Board` entry to the board landing screen that surfaces posts from the last 24 hours with likes or comments, ranked by likes and comment count. Hot Board is read-only as a board destination, hides the new-post action, and keeps posts in their original category while making trending activity easier to discover.

### Session 64hd (Fix account deletion ID type mismatch)
- **`supabase/sql/delete_account.sql`** — Changed user-id comparisons in `delete_current_user()` to compare via text casts so the deletion function works across tables whose user id columns are stored as either `uuid` or `text`. This fixes the `operator does not exist: text = uuid` error during account deletion.

### Session 64he (Use likes threshold for Hot Board)
- **`src/screens/BoardScreen.tsx`** — Changed Hot Board eligibility from recent 24-hour engagement to posts with more than 10 likes, sorted by likes first, then comments, then recency. Updated Hot Board copy and empty state to match the likes-threshold rule.

### Session 64hf (Use Storage API for account attachment deletion)
- **`App.tsx`** — Moved board attachment cleanup out of the account deletion SQL flow and into the app, using Supabase Storage `list`/`remove` on the signed-in user's `board-attachments/<userId>` folder before calling the account deletion RPC.
- **`supabase/sql/delete_account.sql`** — Removed the direct `storage.objects` delete from `delete_current_user()` because Supabase Storage blocks direct table deletion and requires the Storage API instead.

### Session 64hg (Validate restored auth sessions)
- **`App.tsx`** — Added `getUser()` validation before hydrating restored Supabase sessions so stale local sessions from deleted accounts are signed out and returned to the welcome screen instead of falling into profile setup. Centralized signed-out state cleanup and reused it for logout, auth-state sign-out, and invalid restored sessions.

### Session 64hh (Refresh feature onboarding previews)
- **`src/components/FeatureOnboardingScreen.tsx`** — Updated the four feature onboarding slides to match the current app: Home now previews the swipeable Today hero card with progress dots and quarter/weather cards, ClassMates previews the search/tabs/shared-classes block and friend list, and Boards previews global search, Hot Board, Department Boards, inline post images, likes, and replies.

### Session 64hi (Compact ClassMates and Timetable onboarding)
- **`src/components/FeatureOnboardingScreen.tsx`** — Compressed the ClassMates onboarding preview so the Next button stays visible on smaller screens, and rebuilt the Timetable preview to mirror the current app with quarter controls, schedule pills, and the grey timetable grid.

### Session 64hj (Fit Board onboarding and align timetable blocks)
- **`src/components/FeatureOnboardingScreen.tsx`** — Compressed the Board onboarding preview so bottom navigation stays visible, and changed the Timetable preview course blocks to render inside their day columns so example classes align with the grid.

### Session 64hk (Use signed URLs for board attachments)
- **`src/screens/BoardScreen.tsx`** — Changed board attachment display to resolve Supabase Storage paths into signed URLs before rendering or opening files, so uploaded images can preview even when the storage bucket is private or public reads are blocked.

### Session 64hl (Fix sign-in legal placement and board image previews)
- **`src/screens/SignInScreen.tsx`** — Moved the legal consent text into the scroll content at the bottom of the sign-in page instead of keeping it in a separate bordered footer.
- **`src/screens/BoardScreen.tsx`** — Added board-list image thumbnails and changed image attachment rendering to cache signed Storage URLs locally before passing them to React Native `Image`, making post image previews more reliable on device.

### Session 64hm (Expo-safe board image uploads)
- **`src/screens/BoardScreen.tsx`** — Changed board image picking to normalize every selected image into a JPEG cache file and changed attachment upload to read local files through Expo FileSystem base64 bytes instead of `fetch(file://...).blob()`, preventing corrupted image uploads in Expo. Renamed the main Board header action from `Post` to `New Post`.

### Session 64hn (Remove board-list report action)
- **`src/screens/BoardScreen.tsx`** — Removed the report flag button from board post list rows so reporting is only available inside the post detail view.

### Session 64ho (Harden board images and add comment editing)
- **`src/screens/BoardScreen.tsx`** — Switched board image rendering from React Native `Image` to `expo-image` with memory/disk caching, moved image uploads to the Expo FileSystem base64-arraybuffer path, fixed extension handling for JPEG-normalized picker images, added `Edited` markers for edited posts/comments, and added owner-only edit/delete actions for comments and replies.
- **`package.json` / `package-lock.json`** — Added `expo-image` and `base64-arraybuffer` so board images render and upload reliably in Expo.
- **`supabase/sql/board_edit_markers.sql`** — Added optional `edited_at` columns for posts and post comments so edit markers persist after refresh.

### Session 64hp (Hide self-report actions)
- **`src/screens/BoardScreen.tsx`** — Hid report actions on the signed-in user's own posts and comments while keeping reporting available for other users' content inside detail views.

### Session 64hq (Remove Board messaging entry points)
- **`src/screens/BoardScreen.tsx`** — Removed the Board header messages button and the post-detail direct-message button because messaging is not part of the current Board feature set.

### Session 64hr (Move seeder secrets to env)
- **`scripts/seed-sections.js` / `scripts/seed-summer.js` / `scripts/seed-enrollment-history.js`** — Removed hardcoded Supabase service-role and Anteater API keys from local seeding scripts and made the scripts require `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `ANTEATER_API_KEY` environment variables instead.

### Session 64hs (Pre-TestFlight QA fixes)
- **`src/screens/HomeScreen.tsx`** — Fixed the empty-day hero progress ring so days with no classes show `0 classes` instead of the misleading `0/1 done`.
- **`src/screens/CoursePickerScreen.tsx` / `src/screens/TimetableScreen.tsx`** — Made the Reviews/course-info sheet available for every real section type instead of only lecture/lab/seminar sections, so finals, prerequisites, restrictions, and notes are reachable from discussion-style sections too.

### Session 64ht (Hide unfinished messaging surface)
- **`App.tsx` / `src/screens/BoardScreen.tsx`** — Removed the Board-to-Messages wiring and messages overlay entry point now that messaging is not part of the current beta surface.
- **`src/screens/SettingsScreen.tsx` / `src/data/userPreferences.ts`** — Removed the visible Messages notification toggle and defaulted message notifications off to avoid exposing unfinished messaging behavior.

### Session 64hu (Align summer quarter logic)
- **`src/data/courses.ts`** — Changed the summer academic-quarter resolver to return the app's seeded `Summer10wk` quarter instead of an unseeded `Summer` key, and made the fallback choose a safe seeded quarter.
- **`App.tsx` / `src/screens/HomeScreen.tsx`** — Updated invalid-quarter fallback logic and added 2026 summer session date ranges so Home progress does not use the generic winter fallback for summer sessions.

### Session 64hv (Board image failure fallback)
- **`src/screens/BoardScreen.tsx`** — Added a reusable board attachment image wrapper that shows an explicit fallback instead of a blank image when decoding fails, and changed remote image caching to download to fresh cache files while discarding zero-byte downloads so stale broken caches do not keep failing.

### Session 64hw (Point EAS config to parksihyun project)
- **`app.json`** — Updated the Expo owner and EAS project id to the active `@parksihyun/classmate` project so production builds run against the account that has project permissions.

### Session 64hx (Persist iOS submit app id)
- **`eas.json`** — Added the production iOS `ascAppId` discovered during the successful EAS Submit flow so future production submits can run non-interactively without prompting for the App Store Connect app.

### Session 64hy (Improve board image viewing)
- **`src/screens/BoardScreen.tsx`** — Removed the Board landing helper subtitle, changed post-detail images to render with their full original aspect ratio instead of cropped 4:3 previews, and added a full-screen image viewer with a photo-library save action so users can inspect and save attached images.

### Session 64hz (Keep board comment input above tab bar)
- **`src/screens/BoardScreen.tsx`** — Added explicit bottom clearance to the post-detail comment composer so long image posts cannot leave the comment input hidden under the floating app tab bar.

### Session 64ia (Fix comment deletion and hide edit labels)
- **`src/screens/BoardScreen.tsx`** — Reworked owner comment deletion to call a Supabase RPC first, then fall back to reparenting replies and deleting the comment client-side; removed visible `Edited` labels from posts/comments to keep the board UI cleaner.
- **`supabase/sql/delete_own_comment.sql`** — Added a security-definer helper that lets the signed-in owner delete their own comment while preserving replies by reparenting child comments before deleting the parent.

### Session 64ib (Speed board landing and stabilize course expansion)
- **`src/screens/BoardScreen.tsx`** — Removed per-board post counts from board cards and department-board rows, stopped blocking the Board landing page behind the posts loading spinner, and moved board attachment signed-URL hydration off the critical loading path so the Board surface appears faster.
- **`src/screens/CoursePickerScreen.tsx`** — Changed course expansion so multiple courses can stay open and removed the automatic scroll-to-top behavior, preventing the list from jumping upward when a lower course is expanded.

### Session 64ic (Keep review login visible above keyboard)
- **`src/screens/SignInScreen.tsx`** — Wrapped the sign-in content in a keyboard-aware container, added extra bottom scroll padding, and auto-scrolls to the review email/password fields on focus so the keyboard does not cover review-account login inputs.

### Session 64id (Conversation-based chat foundation)
- **`supabase/sql/conversation_messages.sql`** — Added conversation, participant, and message tables plus RLS policies and a `get_or_create_conversation` RPC so ClassMate can support both real-name friend chats and anonymous board chats without mixing identities.
- **`src/data/messages.ts` / `src/screens/MessagesScreen.tsx`** — Replaced the legacy direct-message model with a conversation-based message list and thread UI that labels friend chats separately from anonymous board chats.
- **`App.tsx` / `src/screens/BoardScreen.tsx` / `src/screens/FriendsScreen.tsx`** — Reconnected the Messages modal, added Board anonymous-chat entry points on posts/comments, added ClassMates real-name chat entry points, and updated in-app message notification polling to read `conversation_messages`.
- **`src/data/userPreferences.ts` / `supabase/functions/social-notifier/index.ts` / `supabase/functions/social-notifier/README.md` / `supabase/sql/delete_account.sql`** — Enabled message notifications by default, updated remote notification handling for `conversation_messages`, documented the new webhook table, and made account deletion clean up conversation chat data.

### Session 64ie (Respect message modal safe areas)
- **`src/screens/MessagesScreen.tsx`** — Replaced implicit modal safe-area handling with explicit top and bottom inset padding so the Messages headers do not run under the status bar/dynamic island and the composer stays above the home indicator.

### Session 64if (Compact board comment actions)
- **`src/screens/BoardScreen.tsx`** — Collapsed comment and reply secondary actions into an ellipsis menu so visible comment rows keep only like and reply controls while edit/delete/message/report remain available from the overflow action sheet.

### Session 64ig (Fix false message sign-in guard)
- **`src/screens/MessagesScreen.tsx`** — Corrected the UUID validation used by the Messages screen so signed-in Supabase users are no longer rejected as unauthenticated, and split invalid chat-target handling into a separate error instead of showing a misleading sign-in alert.

### Session 64ih (Harden message rollout)
- **`App.tsx`** — Unmounts the Messages screen when its modal closes so stale selected-thread state does not persist, and renamed in-app message notification payloads to `conversation-message`.
- **`src/screens/MessagesScreen.tsx` / `supabase/sql/conversation_messages.sql`** — Removed client-side conversation timestamp updates and added a database trigger that touches `conversations.updated_at` after each inserted message, keeping clients from needing direct conversation update access.
- **`src/screens/BoardScreen.tsx`** — Relaxed UUID validation for board author profile lookup so valid Supabase UUIDs are not accidentally treated as anonymous legacy ids.

### Session 64ii (Custom comment action menu)
- **`src/screens/BoardScreen.tsx`** — Replaced the native comment action alert with an in-app expanding action panel so comments and replies keep a cleaner visible action row while still offering anonymous message/report for other users and edit/delete for the author.

### Session 64ij (Reduce network noise and cache boards)
- **`App.tsx`** — Gated social notification polling behind enabled push permissions, throttled repeated network-failure logs, and slowed the foreground polling interval so transient offline states do not flood the console.
- **`src/screens/BoardScreen.tsx`** — Added cached board catalog loading, stopped treating cached board posts as a blocking loading state, kept network refreshes in the background, and suppressed expected image/network fallback warnings so reopening Boards feels instant without console spam.
- **`src/screens/FriendsScreen.tsx`** — Removed the full-screen keyboard-dismiss touch wrapper that could intercept ClassMates list scroll gestures.

### Session 64ik (Make timetable style block-only)
- **`src/data/courses.ts`** — Replaced the old timetable-level dark theme with block-only styles (`Pastel`, `Soft`, `Minimal`, `Outline`, `Colorful`) and added a normalizer so old `default`/`dark` values safely fall back to `Pastel`.
- **`src/screens/TimetableScreen.tsx`** — Renamed the settings section to `Block Style`, removed the Dark option, made the timetable grid/background follow the app-wide dark mode, and applied style options only to course blocks.

### Session 64il (Persist language and region settings)
- **`src/data/userPreferences.ts`** — Added persisted language, time zone, and date-format preferences with safe defaults and normalizers.
- **`App.tsx`** — Loads and saves language/region preferences through `user_settings.profile_details` so no new Supabase columns are required.
- **`src/screens/SettingsScreen.tsx`** — Wired the existing `Language & Region` screen to real settings, added language options, expanded time zone choices, and added a save action.

### Session 64im (Differentiate Soft blocks and polish GPA chart)
- **`src/data/courses.ts`** — Increased the Soft block style color fill and border strength so it is visually distinct from Pastel while remaining gentler than Colorful.
- **`src/screens/GradesScreen.tsx`** — Reworked the GPA trend chart to use measured width, line-aligned y-axis labels, a gradient area fill, larger data markers, and latest/best summary pills.

### Session 64in (Scroll ClassMates shared summary with list)
- **`src/screens/FriendsScreen.tsx`** — Moved the `Shared Classes This Quarter` block into the ClassMates list `ScrollView` so the shared-class summary scrolls together with the friend list instead of staying fixed above it.

### Session 64io (Current-quarter ClassMates and single-point GPA)
- **`src/screens/GradesScreen.tsx`** — Removed the synthetic short line for single-quarter GPA history so a one-quarter trend renders as just the data point.
- **`App.tsx` / `src/screens/FriendsScreen.tsx`** — Made ClassMates shared-course matching use the current academic quarter and current-quarter courses instead of whichever timetable quarter is currently selected elsewhere in the app.

### Session 64ip (Add day filters to course search)
- **`src/screens/CoursePickerScreen.tsx`** — Added horizontal day filter chips (`Any day`, weekdays, weekend) to the course picker. Course results now require at least one matching section on the selected days, and expanded course rows only show sections that match the active day filter.

### Session 64iq (Pad customize sheet above home indicator)
- **`src/screens/CoursePickerScreen.tsx`** — Added safe-area-aware bottom padding to the custom block sheet and scroll content so the primary action button no longer sits under the iPhone home indicator/bottom edge.

### Session 64ir (Clear selected course category chip)
- **`src/screens/CoursePickerScreen.tsx`** — Added a selected department/GE chip beside the day filters with an inline `x` action. This lets students quickly clear a category like `ECON` while keeping any active day filters in place.

### Session 64is (Center picker quarter and compact custom blocks)
- **`src/screens/CoursePickerScreen.tsx`** — Centered the course-picker quarter title against the full screen width instead of between uneven side controls. Compressed the custom-block sheet by reducing input height, tightening spacing, and grouping secondary fields into two-column rows so the whole form is easier to scan at once.

### Session 64it (Scale GPA trend quarter labels)
- **`src/screens/GradesScreen.tsx`** — Replaced full x-axis quarter names with compact labels like `Sp '26` and dynamically limits how many labels render based on chart width. This keeps the GPA trend readable when many quarters are present while preserving every data point.

### Session 64iu (Multi-select department course filters)
- **`src/screens/CoursePickerScreen.tsx`** — Replaced the single department filter with multi-select department filters. Department rows now toggle in place, selected departments load together from Supabase, each selected department appears as a removable chip beside the day filters, and GE selection remains a single exclusive category.

### Session 64iv (Board chat source cards and simplified locale)
- **`src/screens/BoardScreen.tsx`** — Reverted comment overflow actions to the native iOS action sheet / default platform alert so edit, delete, message, and report no longer rely on a custom inline menu.
- **`src/screens/MessagesScreen.tsx`** — Hydrates anonymous board conversations with their source post and shows a compact source-post preview with title, body, and image when available. Deleted source posts now render a deleted-post state, and message/search inputs have clearer bordered fields with keyboard-friendly list behavior.
- **`src/data/userPreferences.ts` / `src/screens/SettingsScreen.tsx`** — Reduced language and time-zone preferences back to English and Pacific Time only, and normalizes older saved values to those defaults.

### Session 64iw (Clarify board comment composer)
- **`src/screens/BoardScreen.tsx`** — Added a visible border around the board comment input field so the comment composer clearly reads as an editable text area.

### Session 64ix (Abbreviate displayed majors)
- **`src/data/userPreferences.ts`** — Added a shared `abbreviateMajor()` helper with UCI major mappings and an acronym fallback.
- **`src/screens/BoardScreen.tsx` / `src/screens/FriendsScreen.tsx` / `src/screens/SettingsScreen.tsx`** — Switched user-facing major labels beside people to short abbreviations like `ECON`, `CS`, and `CSE` so profile metadata stays compact.

### Session 64iy (Stop message refresh flicker)
- **`src/screens/MessagesScreen.tsx`** — Changed message polling to silent background refreshes and slowed the interval from 7 seconds to 15 seconds. Message lists now keep their current content visible while new data is fetched, so the thread no longer flashes back to a loading state.

### Session 64iz (Realtime message threads)
- **`src/screens/MessagesScreen.tsx`** — Replaced open-thread message polling with a Supabase Realtime subscription for `conversation_messages` inserts and updates. Sent messages are added from the returned insert row, and the conversation list keeps only a slow silent fallback refresh so the chat no longer constantly reloads.
- **`supabase/sql/conversation_messages.sql`** — Added `conversation_messages` to the `supabase_realtime` publication so deployed databases can emit live chat events for the new message subscription.

### Session 64ja (Unread message badges)
- **`App.tsx`** — Added global unread-message counting from `conversation_participants.last_read_at` and incoming `conversation_messages`, with Realtime refresh hooks and a quiet polling fallback so the app knows when chat activity needs a badge.
- **`src/screens/BoardScreen.tsx` / `src/screens/FriendsScreen.tsx`** — Added red unread badges to the Messages entry buttons so users can see when new chats arrived before opening the message list.
- **`supabase/sql/conversation_messages.sql`** — Added `conversation_participants` to the Realtime publication as well, allowing read-state changes to clear unread badges promptly.

### Session 64jb (Hide empty chat drafts)
- **`src/screens/MessagesScreen.tsx`** — Changed the conversation list preview builder to skip conversations with no messages. Opening a chat and backing out without sending no longer leaves an empty `Start the conversation` thread in the Messages list.

### Session 64jc (Lazy-create chat conversations)
- **`src/screens/MessagesScreen.tsx`** — Changed new chat entry points to open a local draft thread first and only call `get_or_create_conversation` when the first message is actually sent. This prevents opening and backing out of a chat from writing unused conversation rows.
- **`supabase/sql/cleanup_empty_conversations.sql`** — Added a cleanup SQL script that deletes old empty conversation rows from previous builds, with participant rows removed through cascade.

### Session 64jd (Sports event detail sheet)
- **`src/screens/HomeScreen.tsx`** — Renamed `Campus Events` to `Sports Events`, removed the inline gray venue/source text from event rows, and made sports event rows open a lightweight detail sheet with game summary, Going/Interested actions, event comments, and an in-app venue map for home games.
- **`supabase/sql/sports_event_social.sql`** — Added Supabase tables and RLS policies for sports-event RSVPs and comments so event detail interactions can persist per game.

### Session 64je (Sports event participation badges)
- **`src/screens/HomeScreen.tsx`** — Loads RSVP counts for visible sports events and shows a small people-count badge on each event row when students have marked Going or Interested. Detail-sheet RSVP changes now update the outer list count too.

### Session 64jf (Compact course section metadata)
- **`src/screens/CoursePickerScreen.tsx`** — Confirmed saved-section counts are app-wide unique users for the selected quarter, then compressed section enrollment, waitlist, and saved counts into small metadata chips so expanded course rows no longer spend separate lines on enrollment and ClassMate saved-count copy.

### Session 64jg (Sports event gender labels and venue trust)
- **`src/data/sportsEvents.ts`** — Preserved `Men's` / `Women's` sport prefixes in sports event titles and detail metadata instead of stripping them during calendar parsing.
- **`src/screens/HomeScreen.tsx`** — Stopped inferring volleyball home venues from sport type alone. Venue maps now render only when the source location names a specific known UCI venue, and generic calendar rows show `Venue TBA` rather than incorrectly mapping to Bren Events Center.

### Session 64jh (Enrich sports venues and show zero going counts)
- **`src/data/sportsEvents.ts`** — Added sport-specific UCI Athletics schedule-page enrichment so events parsed from the composite calendar can pick up venue/city details from each team's schedule page when the composite list omits them.
- **`src/screens/HomeScreen.tsx`** — Enriched sports events before caching, changed the outside event-row badge to always show the number of students marked `going` including `0 going`, and made detail labels show the actual event location instead of assuming every `vs` event is a home game.

### Session 64ji (Tighten sports venue parsing and going label)
- **`src/data/sportsEvents.ts`** — Restricted schedule venue enrichment to the actual yearly schedule section and rejected page chrome/filter text as a venue candidate, preventing `Track & Field` filter copy from being mistaken for a location.
- **`src/screens/HomeScreen.tsx`** — Added display-time cleanup for bad cached sports locations and moved the `0 going` count into the event metadata line as quieter secondary text instead of a large centered pill.

### Session 64jj (Make sports RSVP taps responsive)
- **`src/screens/HomeScreen.tsx`** — Made sports-event Going/Interested actions update optimistically on tap so the buttons visibly respond before Supabase persistence finishes, and kept the local response when the social table is missing in development.
- **`src/screens/HomeScreen.tsx`** — Repositioned the event-list going count into a compact fixed badge on the right edge, making `0 going` visible without sitting awkwardly in the middle of each row.

### Session 64jk (Harden sports venue enrichment and friend timetable header)
- **`src/data/sportsEvents.ts`** — Added a timeout-wrapped schedule fetch and only enriches generic sports locations, so venue lookup failures or slow UCI Athletics pages do not block or overwrite already-specific event locations.
- **`src/screens/FriendsScreen.tsx`** — Removed the chat shortcut from the friend timetable viewing header while keeping messaging available from the main friends list.

### Session 64jl (Show upcoming UC campus support)
- **`src/screens/UniversitySelectionScreen.tsx`** — Added all UC campuses to the university picker. UC Irvine remains the only selectable school, while the other UC campuses render as muted `Coming Soon` rows with explanatory copy and a tap alert so users understand expansion is planned but not active yet.

### Session 64jm (Claude-inspired onboarding refresh)
- **`src/components/FeatureOnboardingScreen.tsx`** — Rebuilt the feature onboarding flow with a six-step UCI arrival, Today, Schedule, ClassMates, Boards, and Welcome sequence inspired by the provided Claude mockup, while keeping the existing profile and notification permission flows separate.
- **`assets/uci-anthill-plaza.jpg` / `assets/uci-team-huddle.webp`** — Added the provided UCI campus and team-huddle photos so the refreshed onboarding uses real campus imagery instead of placeholder graphics.

### Session 64jn (Force review account onboarding)
- **`App.tsx`** — Added a review-account email allowlist and forces `review@classmate.app` through the feature onboarding flow on every login, regardless of the saved `onboardingComplete` flag, so App Review always sees the guided introduction.

### Session 64jo (Move profile setup into onboarding)
- **`src/components/FeatureOnboardingScreen.tsx`** — Added Roll Call and About You onboarding steps for first/middle/last/nickname plus year and major, removed the UC Irvine Day 1 photo badge, and switched the campus image to contain mode so the provided photo is not cropped.
- **`App.tsx`** — Removed the separate post-signup profile setup screen from the first-run flow. New and incomplete-profile users now go directly into the onboarding sequence, which saves profile details before continuing to the feature tour and notification prompt.

### Session 64jp (Add optional profile and scroll tour onboarding)
- **`src/components/FeatureOnboardingScreen.tsx`** — Added an optional personal-info onboarding step for date of birth and gender, then moved the app feature introduction into one Apple-style scroll tour where Today, Schedule, ClassMates, and Boards fade between sections. Profile saving now happens after the optional step so all onboarding profile fields persist together before the tour.

### Session 64jq (Polish onboarding copy and full-page tour)
- **`src/components/FeatureOnboardingScreen.tsx`** — Changed the arrival copy to `Welcome, Anteater.`, fixed the UCI masthead image to use its real 1440:500 aspect ratio, removed the boxed inner tour scroller, and made the feature tour animate through the main onboarding scroll area. Also removed team/huddle wording and dark image overlays from the final welcome step so the onboarding tone stays ClassMate-focused and consistently blue.

### Session 64jr (Photo-backdrop onboarding hero polish)
- **`src/components/FeatureOnboardingScreen.tsx`** — Converted the first and final onboarding screens from inline image cards to full-screen blurred photo backdrops with light shading, tightened the tour section spacing below the `Scroll` label, and kept the feature tour aligned to the main onboarding scroll instead of an inner box.
- **`App.tsx`** — Moved the notification permission prompt ahead of the brand intro in the onboarding render order so the opt-in screen cannot appear to be skipped when both onboarding follow-up states are active.

### Session 64js (Tighten onboarding typography and tour chrome)
- **`src/components/FeatureOnboardingScreen.tsx`** — Added a stronger rise-in animation for the photo-backed welcome screens, vertically centered those hero messages, reduced regular step title sizing so Roll Call/About You/Optional fit more cleanly, shortened the tour heading to `Meet ClassMate.`, and removed the extra `Scroll` label/progress hairline from the tour.

### Session 64jt (Fold notifications into onboarding)
- **`src/components/FeatureOnboardingScreen.tsx`** — Removed the final welcome slide and replaced it with an in-flow notification permission step styled after the existing notification prompt, using the app’s blue tone, benefit rows, and `Enable Notifications` / `Not now` actions inside the onboarding progress.
- **`App.tsx`** — Connected the new onboarding notification step to the existing push-permission persistence logic and marks feature onboarding complete after the notification choice so users do not bounce back into onboarding.

### Session 64ju (Even out onboarding photo shade)
- **`src/components/FeatureOnboardingScreen.tsx`** — Removed the extra bottom-only overlay from the photo-backed arrival screen so the background shade stays uniform instead of forming a different colored band behind the dots and button.

### Session 64jv (Limit review onboarding to explicit sign-in)
- **`App.tsx`** — Scoped the `review@classmate.app` forced onboarding behavior to explicit sign-in only. Restored sessions no longer force the review account back into onboarding on app relaunch, while signing in with the review account still opens the onboarding flow for testing.

### Session 64jw (Prevent onboarding completion flicker)
- **`App.tsx`** — Sets the ClassMate entry animation flag before clearing the onboarding flag after notification choice, preventing the app from briefly rendering Home before the entry screen. Also turns on review-account onboarding immediately in the explicit sign-in callback so Home does not flash before onboarding.
- **`src/components/FeatureOnboardingScreen.tsx`** — Shortened tour section height so the next tour item peeks into view, making it clearer that more content is available below.

### Session 64jx (Back to university from onboarding)
- **`src/components/FeatureOnboardingScreen.tsx`** — Added a back chevron to the first `Welcome, Anteater.` onboarding step so users can return to school selection before continuing.
- **`App.tsx`** — Added an onboarding back handler that signs out, clears onboarding/session state, and restores the auth stack directly to the university selection screen.

### Session 64jy (Add onboarding background geometry)
- **`src/components/FeatureOnboardingScreen.tsx`** — Added deterministic decorative geometry layers to each onboarding step, using soft blue/white rounded rectangles and outline shapes in varied positions so the backgrounds feel fuller without changing between renders.

### Session 64jz (Make onboarding arrival school-aware)
- **`src/components/FeatureOnboardingScreen.tsx`** — Changed the arrival body copy from `UCI life` to `college life` and added a school-brand helper so the first onboarding title/badge can use the selected university’s mascot and school label instead of hardcoding Anteater/UCI for every future school.
- **`App.tsx`** — Passes the selected university name into the onboarding screen so school-specific arrival branding can be resolved from the login school context.

### Session 64ka (Match sports going count to saved chips)
- **`src/screens/HomeScreen.tsx`** — Moved the sports-event `0 going` count from a separate right-side badge into a compact `people` metadata chip under the event time, matching the Course Picker `saved` chip style so event rows feel calmer and more consistent.

### Session 64kb (Simplify sports RSVP to Going)
- **`src/screens/HomeScreen.tsx`** — Removed the separate `Interested` sports-event action from the event detail sheet and collapsed RSVP behavior into a single `Going` toggle/count, while still ignoring legacy `interested` rows from existing stored data.

### Session 64kc (Make sports comments visibly submit)
- **`src/screens/HomeScreen.tsx`** — Made sports-event comments submit optimistically, clear the input immediately, replace the local row with the saved Supabase row, and show an alert with the real database error if posting fails.
- **`supabase/sql/sports_event_social.sql`** — Added explicit authenticated grants for sports RSVP/comment tables so the SQL migration gives logged-in users the table privileges needed for the existing RLS policies to work.

### Session 64kd (Remove arrival onboarding geometry)
- **`src/components/FeatureOnboardingScreen.tsx`** — Removed the decorative geometry from the first photo-backed onboarding screen so the `Welcome, Anteater.` arrival view stays cleaner while later onboarding steps keep their background shapes.

### Session 64ke (Make app tour scroll cue visible)
- **`src/components/FeatureOnboardingScreen.tsx`** — Pulled app-tour sections upward with a controlled overlap and increased off-center section opacity so the next tour item peeks above the bottom controls, making the vertical scroll affordance visible in the actual Expo simulator.

### Session 64kf (Remove welcome and onboarding decorations)
- **`src/screens/WelcomeScreen.tsx`** — Removed the floating decorative background circles from the pre-login welcome screen so the first app entry view is cleaner.
- **`src/components/FeatureOnboardingScreen.tsx`** — Removed all onboarding background shape layers from Roll Call, About You, Optional, App Tour, and Notifications while keeping the actual onboarding content unchanged.
- **`src/components/ClassMateIntroScreen.tsx`** — Removed the floating background circles from the post-onboarding ClassMate intro animation for consistency with the simplified visual direction.

### Session 64kg (Compact notification onboarding buttons)
- **`src/components/FeatureOnboardingScreen.tsx`** — Gave the notification permission step its own compact footer layout: Back and Enable Notifications stay as large side-by-side buttons, while `Not now` is centered beneath them as a smaller text action so the controls take less vertical space and cover less content.

### Session 64kh (Preserve post-notification intro)
- **`App.tsx`** — Stopped the user-preferences loading effect from clearing `showBrandIntro`. This prevents the ClassMate intro screen from being immediately dismissed after finishing onboarding notifications, especially when the review-account onboarding flag is reset.

### Session 64ki (Lower notification onboarding footer)
- **`src/components/FeatureOnboardingScreen.tsx`** — Reduced only the notification-step footer bottom padding so the Back / Enable Notifications / Not now controls sit closer to the bottom safe area instead of floating high and crowding the content.

### Session 64kj (Harden explicit sign-out routing)
- **`App.tsx`** — Added a short suppression guard for the next Supabase `SIGNED_OUT` event after explicit logout or onboarding back-to-university actions. This prevents the auth callback from clearing state a second time and overriding the intended return-to-university auth stack.

### Session 64kk (Guard sports event stale updates)
- **`src/screens/HomeScreen.tsx`** — Added a selected-event ref and close helper for the sports event sheet so delayed RSVP/comment fetches from a previous event cannot overwrite the currently open event after users switch or close the detail view.
- **`src/components/FeatureOnboardingScreen.tsx`** — Removed the leftover no-op onboarding backdrop component so the “no extra decorative shapes” direction is reflected directly in the render tree.

### Session 64kl (Open existing friend chat history)
- **`src/screens/MessagesScreen.tsx`** — Added an existing-conversation lookup before opening a direct chat target. Friend or board message buttons now resolve the prior conversation with actual messages and load its history immediately instead of showing `Start the conversation` until after a new send/re-entry cycle.

### Session 64km (Polish chat room composer)
- **`src/screens/MessagesScreen.tsx`** — Tightened the chat detail header, source-post preview, message bubble spacing, and composer styling. Added keyboard visibility tracking so the input bar drops extra safe-area padding while the keyboard is open, removed the send-time keyboard dismissal, and auto-scrolls the message list to the latest message for a more stable chat experience.

### Session 64kn (Keep keyboard open after chat send)
- **`src/screens/MessagesScreen.tsx`** — Added a TextInput ref and explicit focus retention around the send action so tapping the send button no longer blurs the composer or drops the keyboard after each message.

### Session 64ko (Keep latest chat visible above keyboard)
- **`src/screens/MessagesScreen.tsx`** — Added keyboard-show, input-focus, list-layout, and content-size scroll-to-end hooks plus a little extra bottom padding so the newest message stays visible above the composer when the keyboard opens.

### Session 64kp (Stabilize chat scroll after sending)
- **`src/screens/MessagesScreen.tsx`** — Replaced single-shot chat scroll correction with a short settle sequence after keyboard show, focus, layout, content-size changes, and message send completion so newly sent messages remain visible while the keyboard is already open.

### Session 64kq (Normalize keyboard composers)
- **`src/screens/BoardScreen.tsx`** — Matched the board post comment composer to the chat composer sizing, border, spacing, send button, keyboard padding, and focus behavior. The post detail scroll now settles to the composer while the keyboard is open instead of leaving the input row misaligned above the keyboard.
- **`src/screens/HomeScreen.tsx`** — Updated the sports event comment composer to the same 40px input/send-button rhythm and multiline padding so comment inputs feel consistent across modal surfaces.

### Session 64kr (Pin board comment composer)
- **`src/screens/BoardScreen.tsx`** — Moved the post-detail comment composer out of the scroll content into a fixed bottom bar matching the Messages composer. This keeps the input row and send button aligned with the keyboard instead of letting the composer float inside long post/comment content.

### Session 64ks (Keep latest text above composer)
- **`src/screens/MessagesScreen.tsx`** — Added keyboard-aware bottom padding to the chat message list so the latest message stays above the fixed composer when the keyboard is open.
- **`src/screens/BoardScreen.tsx`** — Added matching keyboard-aware scroll padding for board post comments now that the composer is pinned at the bottom of the post detail view.

### Session 64kt (Course chat entry from timetable)
- **`src/data/messages.ts`** — Added the `course` chat kind plus course metadata fields so messages can represent class-wide rooms in addition to friend and anonymous board chats.
- **`src/screens/TimetableScreen.tsx`** — Added a `Course Chat` action to the course detail sheet. Tapping a timetable block can now open the room for that course and quarter.
- **`App.tsx`** — Wired `TimetableScreen` into the existing messages modal so course chat targets open through the same Messages experience.
- **`src/screens/MessagesScreen.tsx`** — Added course-chat previews, headers, list rows, and course-room creation/join handling. Course chats join immediately on open so prior class messages can load before the user sends anything.
- **`supabase/sql/conversation_messages.sql`** — Extended conversation storage with course metadata and added `get_or_create_course_conversation`, which only lets students join a course room if that course is in their timetable for the matching quarter.

### Session 64ku (Fix course chat timetable user cast)
- **`supabase/sql/conversation_messages.sql`** — Cast `timetables.user_id` and `auth.uid()` to text inside `get_or_create_course_conversation` so installs where timetable user IDs are stored as text do not fail with `operator does not exist: text = uuid`.

### Session 64kv (Course chat member count)
- **`src/screens/MessagesScreen.tsx`** — Removed the large course preview card from course-chat detail rooms and moved the context into the header. Course chats now show participant counts in the room header and message list rows.

### Session 64kw (Message edit and delete actions)
- **`src/screens/MessagesScreen.tsx`** — Added shared long-press actions for all chat room types. Users can now long-press their own non-deleted messages to edit or soft-delete them, with a composer edit mode and optimistic message updates.

### Session 64kx (Mention course chat in app tour)
- **`src/components/FeatureOnboardingScreen.tsx`** — Added Course Chat to the onboarding app-tour copy and inserted a dedicated course-chat preview section. This makes class-wide rooms visible as one of ClassMate’s core features without overloading the first-run flow.

### Session 64ky (Course Discord links)
- **`src/screens/TimetableScreen.tsx`** — Added a Discord action to the course detail sheet. Students can now join an existing class Discord invite or submit a `discord.gg` / `discord.com/invite` link for that course and quarter.
- **`supabase/sql/course_discord_links.sql`** — Added the course Discord link table, uniqueness by school/quarter/course, and RLS policies so authenticated students can read links and submit/manage their own invite links.

### Session 64kz (Remove in-app course chat)
- **`src/data/messages.ts`** — Removed the `course` chat kind and course metadata fields so app chat targets are limited to friend DMs and anonymous board DMs.
- **`src/screens/TimetableScreen.tsx`** — Removed the in-app `Course Chat` action from course details while keeping the class Discord invite action as the course-specific communication path.
- **`src/screens/MessagesScreen.tsx`** — Removed course-room preview, opening, sending, header, and list-row logic so existing course-chat rows are ignored by the Messages inbox.
- **`src/components/FeatureOnboardingScreen.tsx`** — Removed Course Chat from the app-tour copy and preview sequence so onboarding matches the current feature set.
- **`App.tsx`** — Stopped passing the messages opener into `TimetableScreen`, disconnecting timetable blocks from in-app course chat.
- **`supabase/sql/conversation_messages.sql`** — Removed the course-room RPC/index setup from the canonical chat SQL and added a drop for the old `get_or_create_course_conversation` function.

### Session 64la (Show Discord link sheet after course detail)
- **`src/screens/TimetableScreen.tsx`** — Changed the `Add Discord link` action to close the course-detail modal before opening the Discord-link input sheet. This avoids iOS swallowing the second modal when it is presented on top of another modal.

### Session 64lb (Compact Discord link keyboard sheet)
- **`src/screens/TimetableScreen.tsx`** — Reworked the Discord-link input modal so the dimmed backdrop no longer participates in keyboard avoidance, reduced the input/button heights, and trims bottom padding while the keyboard is visible. This removes the awkward empty white space above the keyboard.

### Session 64lc (Validate Discord invite input)
- **`src/screens/TimetableScreen.tsx`** — Tightened Discord invite validation to only accept `discord.gg/...` and `discord.com/invite/...` style links, normalizing them to `https://discord.gg/...`. Invalid entries now keep the sheet open, turn the input border red, and show an inline warning instead of silently failing.
- **`supabase/sql/conversation_messages.sql`** — Made the post-course-chat `conversations_kind_check` constraint strict again now that course-chat rows are expected to be cleaned from Supabase.

### Session 64ld (Shorten Discord invalid-link warning)
- **`src/screens/TimetableScreen.tsx`** — Shortened the invalid Discord invite warning so it fits more cleanly in the compact keyboard sheet.

### Session 64le (Settle chat list after keyboard animation)
- **`src/screens/MessagesScreen.tsx`** — Delayed chat scroll-to-end corrections until after keyboard/layout interactions, listens to both iOS keyboard show phases, pins the message list to `flex: 1`, and adds keyboard-height bottom padding so FlatList has enough scroll range even when Expo keeps the list viewport behind the keyboard. This keeps the latest message visible above the composer when the keyboard opens.

### Session 64lf (Timetable share formats)
- **`src/screens/TimetableScreen.tsx`** — Replaced the one-tap schedule share action with a format picker for Instagram Story, Square Post, and Clean Timetable exports. The hidden capture canvas now adjusts aspect ratio, spacing, and ClassMate branding per format so shared schedules can double as organic app promotion.

### Session 64lg (Direct Instagram timetable sharing)
- **`package.json` / `package-lock.json`** — Added `react-native-share` so schedule snapshots can target Instagram directly instead of only opening the generic system share sheet.
- **`app.json`** — Added Instagram URL query schemes to the iOS plist so the app can check/open Instagram from native builds.
- **`src/screens/TimetableScreen.tsx`** — Changed the Story/Post share choices to call Instagram directly with the generated schedule image. The clean option remains a normal share-sheet fallback, and direct Instagram failures offer a share-sheet fallback for Expo Go or devices without Instagram installed.

### Session 64lh (Harden timetable export capture)
- **`src/screens/TimetableScreen.tsx`** — Added an export-layout wait, an 8-second timeout, and a direct native-view ref for schedule snapshot capture. The hidden export canvas now sits behind the timetable instead of far offscreen so Instagram/share exports cannot leave the picker stuck in a loading state if native capture stalls.

### Session 64li (Avoid Expo Go Instagram redbox)
- **`src/screens/TimetableScreen.tsx`** — Added a native-module availability check before loading `react-native-share`, so Expo Go shows the Instagram fallback alert instead of a redbox while TestFlight/native builds can still hand off directly to Instagram. Hid the offscreen export canvas from accessibility so it does not appear as duplicate timetable content.

### Session 64lj (Auto-scroll long post composer)
- **`src/screens/BoardScreen.tsx`** — Made the new/edit post content field grow with multiline text and keep the composer scrolled to the cursor while the keyboard is open. This prevents long post text from disappearing behind the keyboard or below the visible white writing area.

### Session 64lk (Pin sports comment composer)
- **`src/screens/HomeScreen.tsx`** — Moved the sports event comment input out of the event-detail scroll body into a fixed keyboard-aware footer, lifts that footer by the actual keyboard height, and added scroll-to-bottom settling while the keyboard opens. This keeps the sports comment field visible above the keyboard instead of hiding it behind the iOS keyboard.

### Session 64ll (Persist sports RSVP state in detail)
- **`src/screens/HomeScreen.tsx`** — Added a per-event current-user RSVP cache, seeds the sports event detail sheet from the cached list participation state, and keeps that cache in sync with optimistic RSVP changes and server reloads. This prevents a selected `Going` state from visually disappearing when reopening the same sports event.

### Session 64lm (Weather card sunlight carousel)
- **`src/screens/HomeScreen.tsx`** — Extended the campus weather fetch to include sunrise and sunset, cached those values with the existing weather data, and converted the weather card into a two-page swipeable carousel with tappable dots. The second page now shows today’s sunrise, sunset, and daylight duration in the same home card footprint.

### Session 64ln (Balance weather carousel page height)
- **`src/screens/HomeScreen.tsx`** — Removed the forced campus/walk chips from the Weather page and removed the daylight-duration sentence from the Sunlight page while keeping the carousel dots closer to the card content. This balances the two weather carousel pages without adding filler UI.

### Session 64lo (List classes in 8 AM summary notification)
- **`App.tsx`** — Changed the daily 8:00 AM schedule notification body from a single “First up” class to a compact ordered class list with start times and locations, capped with a `+N more` suffix for long days. This makes the morning push notification summarize the full day’s schedule instead of only the first class.

### Session 64lp (Configurable daily summary notification time)
- **`src/data/userPreferences.ts`** — Added `dailyScheduleSummaryHour` to notification preferences with an 8 AM default so the morning class-list notification has a persisted delivery hour.
- **`src/screens/SettingsScreen.tsx`** — Added a `Today Summary Time` notification settings section with 6 AM through 11 AM choices and updated the `Today's Classes` subtitle to show the selected time.
- **`App.tsx`** — Changed daily schedule notification scheduling to use the saved `dailyScheduleSummaryHour` instead of the hardcoded 8 AM default.

### Session 64lq (Remove temperature unit setting)
- **`src/screens/SettingsScreen.tsx`** — Removed the `Temperature Unit` radio group from Appearance and dropped the now-unused temperature props from the settings screen.
- **`App.tsx`** — Stopped keeping/passing a settings-level Celsius state because temperature unit is now controlled only inside the Home weather card.

### Session 64lr (Restore sports detail content height)
- **`src/screens/HomeScreen.tsx`** — Fixed the sports event detail sheet so it always opens at a stable viewport-derived height and resets its scroll position to the top. This prevents the comment composer from being the only visible element when opening a sports event.

### Session 64ls (Create the seans company website)
- **`the-seans-site/index.html`** — Added a standalone company website for `the seans` that presents ClassMate, the company direction, roadmap, and campus-expansion thesis.
- **`the-seans-site/styles.css`** — Added the full responsive visual system, campus-photo hero, product mockup, roadmap sections, and mobile layout for the new company website.
- **`the-seans-site/script.js`** — Added lightweight scroll reveal behavior and header polish for the static website.

### Session 64lt (Expand the seans company narrative)
- **`the-seans-site/index.html`** — Expanded the company website with more professional positioning, including `Who we are`, company motto, why the company started, founder section, operating principles, and a more detailed ClassMate thesis.
- **`the-seans-site/styles.css`** — Added responsive layouts and visual treatments for the new company narrative sections, including definition cards, motto panel, founder card, and why-we-started content.

### Session 64lu (Apple-style the seans website redesign)
- **`the-seans-site/index.html`** — Rebuilt the company site into a more premium Apple-style narrative with full-screen hero sections, a centered ClassMate product stage, image story section, founder section, principles, roadmap, and closing thesis.
- **`the-seans-site/styles.css`** — Replaced the previous card-heavy startup layout with a cleaner high-contrast system using large typography, full-bleed imagery, black/white product sections, responsive panels, and a larger phone mockup.
- **`the-seans-site/script.js`** — Added a subtle reduced-motion-aware hero parallax while preserving the scroll reveal and header polish.

### Session 64lv (Interactive scroll showcase for the seans site)
- **`the-seans-site/index.html`** — Added a sticky Apple-style scroll showcase that turns the company thesis into a four-step product narrative with synchronized copy and ClassMate phone previews.
- **`the-seans-site/styles.css`** — Added the scroll-driven showcase visuals, motion phone mockups, hero entrance polish, and standalone local asset references so the site renders correctly from its own folder.
- **`the-seans-site/script.js`** — Added scroll-progress logic that updates the active showcase step, phone layer, progress meter, and hero parallax while respecting reduced-motion settings.
- **`the-seans-site/assets/*`** — Added local copies of the campus, huddle, logo, mark, and favicon assets so the static website does not depend on parent-directory asset paths.

### Session 64lw (Founder and responsive website polish)
- **`the-seans-site/index.html`** — Updated the company founder story to credit both Kyumin Kwack and Sihyun Park, including two co-founder cards and plural navigation copy.
- **`the-seans-site/styles.css`** — Reduced image over-cropping, widened constrained text blocks, added balanced text wrapping, and made the founder cards responsive so text does not collapse into narrow vertical columns.
- **`the-seans-site/script.js`** — Matched the hero parallax scale to the gentler image crop and made reveal animations trigger earlier so section content does not leave awkward blank space while scrolling.

### Session 64lx (Photo-free product-rich website pass)
- **`the-seans-site/index.html`** — Removed photo-based sections and replaced them with product-native interface compositions, including a richer Product Idea showcase that mirrors ClassMate’s Today, ClassMates, Boards, timetable, and campus-expansion screens.
- **`the-seans-site/styles.css`** — Replaced the photo hero and huddle image treatment with abstract product-system visuals, added richer app mockup components, and tuned responsive layouts for the denser interface scenes.
- **`the-seans-site/script.js`** — Updated the hero parallax transform to suit the new non-photo product canvas.

### Session 64ly (Sports event comment deletion)
- **`supabase/sql/sports_event_social.sql`** — Added delete grants and an owner-only RLS delete policy for sports event comments so users can remove their own game-thread comments.
- **`src/screens/HomeScreen.tsx`** — Added an owner-only delete affordance to sports event comments, with optimistic removal and rollback on Supabase errors.

### Session 64lz (Long-press sports comment delete)
- **`src/screens/HomeScreen.tsx`** — Added long-press deletion to the user’s own sports event comments so deletion is discoverable even if the small trash icon is easy to miss.

### Session 64ma (Align sports comments with board comments)
- **`src/screens/HomeScreen.tsx`** — Restyled sports event comments to match the board comment pattern with avatar, author/time metadata, plain thread rows, and an ellipsis options menu instead of a separate card-style trash button.

### Session 64mb (Move comment options to top right)
- **`src/screens/BoardScreen.tsx`** — Moved the board comment ellipsis menu from the lower action row to the comment header’s top-right corner so like/reply actions stay visually clean.
- **`src/screens/HomeScreen.tsx`** — Moved the sports event comment ellipsis menu to the same top-right header position for consistency with board comments.

### Session 64mc (Fix Instagram schedule image payload)
- **`src/screens/TimetableScreen.tsx`** — Converted captured timetable exports to PNG data URLs before handing them to Instagram, and uses the Instagram Stories background image API for story shares. This prevents Instagram from falling back to the user’s camera roll instead of the generated schedule image.

### Session 64md (Narrow timetable time column)
- **`src/screens/TimetableScreen.tsx`** — Reduced the timetable time-label column to a narrower fixed width and recalculated day columns from the remaining space, including the hidden export timetable. This gives each weekday more horizontal room so course blocks feel less cramped.

### Session 64me (Compact empty Today card)
- **`src/screens/HomeScreen.tsx`** — Reduced the empty Today schedule card padding, headline size, and progress ring size, and removed the extra “Take a lighter campus day” line. This makes the no-class state feel less heavy and brings the quarter/weather cards higher on the first screen.

### Session 64mf (Make Colorful timetable vivid)
- **`src/data/courses.ts`** — Added a separate saturated rainbow palette for the Colorful timetable theme and switched colorful course blocks to use it instead of the softer course-color palette. This makes the theme change real hues across red, orange, yellow, green, blue, indigo, violet, and pink instead of only changing brightness.

### Session 64mg (Smooth message auto-scroll)
- **`src/screens/MessagesScreen.tsx`** — Replaced the repeated delayed `scrollToEnd` sequence with a single coalesced scroll, clears pending scroll timers, and avoids animated scrolling on every content-size change. This prevents newly sent messages from jumping upward in choppy steps while still keeping the latest message visible.

### Session 64mh (Keep messages above keyboard)
- **`src/screens/MessagesScreen.tsx`** — Changed chat keyboard handling to use a single keyboard-show event, wait until the keyboard animation finishes before the final scroll-to-end correction, and use iOS padding behavior for the chat `KeyboardAvoidingView`. This keeps the newest messages visible above the keyboard without reintroducing choppy repeated scrolling.

### Session 64mi (Add chat keyboard breathing room)
- **`src/screens/MessagesScreen.tsx`** — Increased the keyboard-visible composer bottom padding and message-list bottom padding. This gives the latest chat bubbles and input row more space above the keyboard instead of feeling pinned to it.

### Session 64mj (Lift chat composer off keyboard)
- **`src/screens/MessagesScreen.tsx`** — Added a keyboard-visible bottom margin to the chat composer container. This moves the whole message input bar off the keyboard instead of only increasing its internal padding.

### Session 64mk (Add Maryland to university roadmap)
- **`src/screens/UniversitySelectionScreen.tsx`** — Added University of Maryland, College Park as the next coming-soon school with the `@umd.edu` domain and updated the coming-soon alert to describe broader school expansion instead of only UC campuses.
- **`src/components/FeatureOnboardingScreen.tsx`** — Added a Maryland onboarding brand fallback (`MARYLAND`, `Terrapin`) so the school has sensible copy when enabled later.
- **`src/screens/SettingsScreen.tsx`** — Updated the help FAQ to mention University of Maryland, College Park as the next roadmap university.

### Session 64ml (UMD sections seed path)
- **`supabase/sql/sections_school.sql`** — Added a `school` column plus school/quarter indexes for the shared `sections` table so UCI and UMD section rows can coexist without mixing in course search.
- **`scripts/seed-umd-sections.js`** — Added a University of Maryland, College Park seeder that reads departments/courses/sections from `umd.io`, normalizes UMD semester data into the existing ClassMate `sections` shape, and upserts by section/term id.
- **`scripts/seed-sections.js`** and **`scripts/seed-summer.js`** — Added `school: 'UC Irvine'` to future UCI section seed rows.
- **`src/screens/CoursePickerScreen.tsx`** — Added school-scoped section queries, school-scoped department loading from seeded rows, hid UCI GE filters for non-UCI schools, and disabled Anteater live-enrollment fetches outside UC Irvine.
- **`src/screens/TimetableScreen.tsx`** — Made seeded-quarter availability checks school-scoped so Add Quarter only shows terms with rows for the current school.
- **`src/components/ReviewsModal.tsx`** — Scoped section info lookup by school and skipped UCI Anteater grade-distribution fetches for non-UCI schools.

### Session 64mm (Fix UMD full-department seed)
- **`scripts/seed-umd-sections.js`** — Updated department discovery to read `dept_id` from umd.io department objects. This fixes full-school seeding returning zero sections when no explicit department list is passed.

### Session 64mn (Add Cornell and Purdue roadmap schools)
- **`src/screens/UniversitySelectionScreen.tsx`** — Added Cornell University (`@cornell.edu`) and Purdue University (`@purdue.edu`) as coming-soon schools in the university picker.
- **`src/components/FeatureOnboardingScreen.tsx`** — Added Cornell and Purdue onboarding brand fallbacks (`CORNELL` / `Big Red`, `PURDUE` / `Boilermaker`).
- **`src/screens/SettingsScreen.tsx`** — Updated the help FAQ to mention Cornell and Purdue as schools being prepared after Maryland.

### Session 64mo (Open expansion schools in picker)
- **`src/screens/UniversitySelectionScreen.tsx`** — Changed Maryland, Cornell, and Purdue from coming-soon to available in the university picker because these schools are being connected immediately.
- **`src/screens/SettingsScreen.tsx`** — Updated the help FAQ to describe active university expansion across UC Irvine, Maryland, Cornell, and Purdue instead of roadmap-only language.

### Session 64mp (Cornell and Purdue seeders)
- **`scripts/seed-cornell-sections.js`** — Added a Cornell University seeder that reads subjects/classes from the official Cornell Class Roster API, normalizes roster sections into the shared `sections` shape, and respects Cornell's 1-request-per-second guidance.
- **`scripts/seed-purdue-sections.js`** — Added a Purdue University seeder that reads subjects/sections/meetings from Purdue.io OData for the West Lafayette campus and normalizes rows into the shared `sections` shape.
- **`scripts/seed-cornell-sections.js`** and **`scripts/seed-purdue-sections.js`** — Prefix generated section IDs by school and normalize Cornell `R` meeting days to `Th` so non-UCI CRNs cannot collide with existing rows and Thursday classes render correctly.

### Session 64mq (Multi-school catalog metadata)
- **`supabase/sql/multi_school_catalog_metadata.sql`** — Added source identity columns to `sections`, seed status tables for school terms/departments, a separate raw payload table, and a `school` column/index for `timetables`. This keeps app search rows lean while making large multi-school imports easier to audit and resync.
- **`scripts/seed-umd-sections.js`**, **`scripts/seed-cornell-sections.js`**, **`scripts/seed-purdue-sections.js`**, **`scripts/seed-sections.js`**, and **`scripts/seed-summer.js`** — Added source metadata to seeded section rows and term/department seed summaries for the new multi-school catalog tables.
- **`supabase/sql/multi_school_catalog_metadata.sql`**, **`scripts/seed-umd-sections.js`**, **`scripts/seed-sections.js`**, and **`scripts/seed-summer.js`** — Changed section units storage/parsing to support decimal credit values such as Purdue's `0.5`, `1.5`, and `2.5` unit courses.
- **`supabase/sql/multi_school_catalog_metadata.sql`** — Added a PostgREST schema-cache reload notification so Supabase API inserts can see the new catalog metadata columns immediately after the migration runs.

### Session 64mr (Scope timetables by school)
- **`App.tsx`** — Scoped timetable loading, creation, and saving by the selected school so schedules for UCI, Maryland, Cornell, and Purdue do not share the same user/quarter rows.
- **`src/screens/HomeScreen.tsx`** and **`src/screens/FriendsScreen.tsx`** — Filtered friend/classmate timetable reads and caches by school so social schedule previews only show schedules from the current university.
- **`src/screens/CoursePickerScreen.tsx`** — Switched department loading to prefer `school_departments`, with a `sections` fallback, and scoped saved-count reads by school.

### Session 64ms (Review account school persistence)
- **`App.tsx`** — Added supported university lookup for Maryland, Cornell, and Purdue so restored sessions can reopen the correct selected school instead of falling back to UC Irvine.
- **`src/screens/SignInScreen.tsx`** — Saves the currently selected school into auth metadata on email/password review sign-in, letting one review account test each newly seeded school without owning that school email domain.
- **`scripts/ensure-review-account.js`** — Added a service-role bootstrap script for creating/updating the shared review email/password account used to test any supported school through the in-app Review access flow.

### Session 64mt (School-specific welcome identity)
- **`src/components/FeatureOnboardingScreen.tsx`** — Reworked the arrival slide to use school-specific student/mascot language and colors: UC Irvine Anteaters, Maryland Terps/Terrapins, Cornell Cornellians/Big Red, and Purdue Boilermakers/Purdue Pete. Also removed UCI-specific wording from the app-tour schedule copy.

### Session 64mu (Robust department loading)
- **`src/screens/CoursePickerScreen.tsx`** — Changed department loading to merge `school_departments` with a paginated scan of the current term's `sections`. This prevents partially backfilled metadata from hiding most departments for newly seeded schools such as Purdue.
- **`src/screens/CoursePickerScreen.tsx`** — Added a non-UCI fallback that scans all seeded sections for a school when the selected term has no rows, preventing the department filter from rendering empty before the user switches to a seeded quarter.
- **`App.tsx`** — Added seeded-quarter resolution on school login/load so newly added schools open on a term that actually has course rows, instead of defaulting to the current academic quarter and showing empty course lists.

### Session 64mv (Partition social data by school)
- **`supabase/sql/social_school_partitioning.sql`** — Added a school-partition migration for friend requests, board requests, reports, board comments/likes, and sports event social tables, including school-scoped indexes and unique keys.
- **`supabase/sql/conversation_messages.sql`** — Updated friend-chat creation to require an accepted friend request in the same school as the conversation.
- **`App.tsx`** — Scoped unread message counts and social notification polling by the currently selected school so cross-school conversations, requests, comments, and likes cannot feed badges or notifications.
- **`src/screens/FriendsScreen.tsx`** — Scoped friend graph reads/writes by school and stores new requests with the selected school.
- **`src/screens/MessagesScreen.tsx`** — Scoped conversation lists, source-post previews, profile name resolution, and message loading by school before messages are fetched.
- **`src/screens/HomeScreen.tsx`** — Scoped classmate matching and sports event RSVP/comment data by school, and stopped non-UCI schools from showing UCI athletics events until their own sports feed is connected.
- **`src/screens/BoardScreen.tsx`** — Scoped board authors, comments, post likes, comment likes, post edits/deletes, reports, and board requests by school.
- **`src/screens/SettingsScreen.tsx`** — Passed the selected school into moderation and board-management tools so board/report/admin actions operate only within that school.
- **`src/components/ReviewsModal.tsx`** — Scoped review edits and deletes by school and author so review moderation cannot cross school boundaries.

### Session 64mw (Prevent review-login main-screen flash)
- **`App.tsx`** — Added a signed-in user bootstrap loading gate around profile/settings/onboarding hydration. Review-account logins now wait for onboarding state to resolve before rendering the main app, preventing the brief main-screen flash before the external-review onboarding flow appears.

### Session 64mx (School logos and campus context)
- **`assets/umd-logo.png`**, **`assets/cornell-logo.jpg`**, and **`assets/purdue-logo.png`** — Added provided university logo assets for the expanded school picker.
- **`src/screens/UniversitySelectionScreen.tsx`** — Replaced text-only abbreviations for UMD, Cornell, and Purdue with real logo images in the university selection cards while keeping UCI's existing monogram.
- **`src/screens/TimetableScreen.tsx`** — Added a small connected-school/campus line below the Timetable title so users can see which university context they are currently using.

### Session 64my (Backfill UCI legacy social data)
- **`App.tsx`** — Added UC Irvine-only fallback reads/writes for timetables when the deployed database has not yet received the new `school` column, preventing legacy UCI schedules from disappearing during the multi-school migration window.
- **`src/screens/FriendsScreen.tsx`** — Added UC Irvine-only fallback reads/writes for friend requests when the `school` column is not yet present, preserving existing UCI friend/request visibility until the social partition migration is applied.
- **`supabase/sql/multi_school_catalog_metadata.sql`** and **`supabase/sql/social_school_partitioning.sql`** — Added explicit UCI backfill updates for legacy rows whose school value is missing or blank.

### Session 64mz (Uniform university cards)
- **`src/screens/UniversitySelectionScreen.tsx`** — Fixed university cards to a consistent height, constrained long school names like University of Maryland, College Park to one line with ellipsis, and removed the extra coming-soon helper line so the picker stays visually even.

### Session 64na (Remove UC coming-soon schools)
- **`src/screens/UniversitySelectionScreen.tsx`** — Removed the UC coming-soon entries from the university picker and simplified the intro copy so only currently connected schools are shown.

### Session 64nb (Move campus context to Today)
- **`src/screens/TimetableScreen.tsx`** — Removed the connected-school/campus line from the timetable header to keep the schedule surface cleaner.
- **`src/screens/HomeScreen.tsx`** — Added a compact plain school/campus label above the Today title, using just the university name and campus without "Connected to" wording.

### Session 64nc (School academic systems)
- **`src/data/schools.ts`** — Added centralized school configuration for campus labels, academic system (`quarter` vs `semester`), term ordering, current-term resolution, and school-specific term labels.
- **`App.tsx`** — Switched current-term logic from hardcoded UCI quarters to school-aware academic terms while keeping the existing `quarter_key` storage format.
- **`src/screens/HomeScreen.tsx`** — Changed the Today progress card and date label to use `Quarter progress` for UCI and `Semester progress` for semester schools.
- **`src/screens/TimetableScreen.tsx`** — Made term sorting, Add Quarter/Semester copy, and add-term candidates school-aware so semester schools do not show Winter quarter options.
- **`src/screens/CoursePickerScreen.tsx`** and **`src/screens/FriendsScreen.tsx`** — Updated visible term labels to show `Fall 2026 Quarter` or `Fall 2026 Semester` depending on the selected school.

### Session 64nd (Quiet missing school-column migration errors)
- **`App.tsx`** — Suppressed redbox-triggering social notification logs when the deployed database is still missing newly added `school` columns, while keeping the school-scoped queries as the source of truth.
- **`src/screens/HomeScreen.tsx`** — Added migration-safe fallback reads for sports RSVP/comment tables when the `school` column has not been applied yet, and prevents missing-column responses from surfacing as console errors.

### Session 64ne (Remove UCI welcome photo)
- **`src/components/FeatureOnboardingScreen.tsx`** — Removed the UCI Anthill Plaza background image from the arrival/welcome onboarding slide so "Welcome, Anteater" uses the clean app background instead.

### Session 64nf (Show school name only)
- **`src/data/schools.ts`** — Changed the shared school label helper to return only the university name, removing campus suffixes from the Today header.

### Session 64ng (Move school label below Today)
- **`src/screens/HomeScreen.tsx`** — Moved the compact school name label from above the Today title to directly below it.

### Session 64nh (Reduce progress ring size)
- **`src/screens/HomeScreen.tsx`** — Reduced the term progress ring in the Today two-column card from 112px to 92px and tightened its top spacing so the progress card no longer feels oversized after adding the Quarter/Semester progress label.

### Session 64ni (Simplify progress term title)
- **`src/screens/HomeScreen.tsx`** — Removed the academic-system suffix from the progress card title so it shows just `Spring 2026` while keeping the separate Quarter/Semester progress label.

### Session 64nj (School-specific course boards)
- **`src/screens/BoardScreen.tsx`** — Replaced the hardcoded UCI department-board list with school-scoped departments loaded from `school_departments` and `sections`, so Cornell, Purdue, Maryland, and UCI show course boards from their own catalog data.
- **`src/screens/BoardScreen.tsx`** — Changed the department-board browser into a search-first Course Boards flow that does not render every department by default, preventing schools with 150+ subjects from becoming a huge browse list.

### Session 64nk (Restore department board wording)
- **`src/screens/BoardScreen.tsx`** — Restored the visible board label to `Department Boards` and removed the helper/status line below the entry card so the school board list stays cleaner.

### Session 64nl (Show all department boards)
- **`src/screens/BoardScreen.tsx`** — Restored the department-board modal to show the full school-specific department list by default, with the search box acting only as a filter.

### Session 64nm (Multi-school section backfill runner)
- **`scripts/backfill-school-sections.js`** — Added a runner that calls the UMD, Cornell, and Purdue seeders across multiple years and standard semester terms, so historical catalog imports can be launched consistently instead of typing every school/term command by hand.

### Session 64nn (Backfill schools from 2019)
- **`scripts/backfill-school-sections.js`** — Changed the default backfill start year for UMD, Cornell, and Purdue to 2019 so expanded schools follow the same historical coverage target as UCI.

### Session 64no (Add UIUC school support)
- **`scripts/seed-uiuc-sections.js`** — Added a University of Illinois Urbana-Champaign seeder that reads Course Explorer subject/course pages, parses embedded section data, normalizes meetings, and upserts UIUC rows into the shared `sections` table.
- **`src/screens/UniversitySelectionScreen.tsx`**, **`App.tsx`**, **`src/data/schools.ts`**, and **`src/components/FeatureOnboardingScreen.tsx`** — Added University of Illinois Urbana-Champaign as an available semester school with `@illinois.edu` review/login metadata and Illini onboarding language.
- **`scripts/backfill-school-sections.js`** and **`src/screens/SettingsScreen.tsx`** — Added UIUC to the multi-school backfill runner and visible supported-school copy.

### Session 64np (Validate backfill env)
- **`scripts/backfill-school-sections.js`** — Added an upfront Supabase environment-variable check so a missing `SUPABASE_URL` or `SUPABASE_SERVICE_KEY` fails once before launching every school/term child seeder.

### Session 64nq (Slow UIUC seeding to avoid 403s)
- **`scripts/seed-uiuc-sections.js`** — Reduced UIUC seeding concurrency, added browser-like request headers, and added long 403 retry backoff so Course Explorer is less likely to block historical backfills mid-run.

### Session 64nr (Centralize school workspace config)
- **`src/data/schools.ts`** — Expanded school config into the single source of truth for supported universities, domains, locations, branding, mascot language, academic systems, terms, and feature flags.
- **`src/screens/UniversitySelectionScreen.tsx`** and **`App.tsx`** — Switched university selection and restored-session school lookup to use the shared school config instead of separate hardcoded school arrays.
- **`src/components/FeatureOnboardingScreen.tsx`**, **`src/screens/HomeScreen.tsx`**, and **`App.tsx`** — Reused the shared school branding/features so onboarding copy and sports availability are driven by school config rather than scattered string checks.

### Session 64ns (School sports feeds and grade scales)
- **`src/data/schools.ts`** — Added school-specific sports feed configuration and GPA scale metadata, including Cornell's 4.3 scale, UIUC's official decimal 4.0 scale, Purdue/UMD 4.0 scales, and per-school non-GPA grade options.
- **`src/data/sportsEvents.ts`** — Added shared school-aware sports loading for UCI calendar data, Cornell responsive calendar JSON, and UIUC Sidearm calendar events, with unsupported sports feeds returning empty data safely.
- **`src/screens/HomeScreen.tsx`** and **`App.tsx`** — Switched sports cards and sports reminder scheduling to use the selected school's feature flag and sports feed instead of UCI-only calendar fetching.
- **`src/screens/GradesScreen.tsx`** — Passed the selected school into Grades and changed GPA calculation, grade picker options, and chart max scale to follow each school's grading policy.

### Session 64nt (Enable UMD and Purdue sports schedules)
- **`src/data/schools.ts`** — Added official UMD and Purdue team schedule page feeds and enabled sports for both schools after confirming they expose schedule data through official athletics pages even without a clean public calendar API.
- **`src/data/sportsEvents.ts`** — Added schedule-page parsers for UMD's `/schedule/text` pages and Purdue's WMT schedule pages, normalizing their official athletics schedule rows into the shared `SportsEvent` shape used by Today cards and sports reminders.

### Session 64nu (Harden multi-school fallbacks)
- **`src/lib/supabaseErrors.ts`** — Added a shared Supabase schema-migration error helper so missing `school` column errors are detected consistently across screens, including Postgres `42703` responses.
- **`App.tsx`**, **`src/screens/HomeScreen.tsx`**, and **`src/screens/FriendsScreen.tsx`** — Replaced duplicated missing-school-column checks with the shared helper and stopped friend-request loading from redboxing when the social partition migration has not reached Supabase yet.
- **`src/screens/FriendsScreen.tsx`**, **`src/screens/SignUpScreen.tsx`**, **`src/screens/UniversitySelectionScreen.tsx`**, and **`src/components/FeatureOnboardingScreen.tsx`** — Removed several UCI-specific defaults/placeholders in favor of shared school config/default-university values, keeping the auth/onboarding/friend UI easier to extend for future schools.

### Session 64nv (Fast-skip UIUC backfills)
- **`scripts/seed-uiuc-sections.js`** — Added configurable UIUC fetch retry controls (`UIUC_FETCH_RETRIES`, `UIUC_TRANSIENT_RETRY_DELAY_MS`) so known 403-heavy Course Explorer pages can fail fast instead of forcing 30-second waits during broad backfills.
- **`scripts/backfill-school-sections.js`** — Added `--skip-terms school:Term:Year` support so already completed terms like UIUC Spring 2019 can be skipped cleanly while continuing the historical import.

### Session 64nw (Default UIUC fast failure)
- **`scripts/seed-uiuc-sections.js`** — Changed the default UIUC fetch retry count to zero so broad UIUC imports no longer pause for 30 seconds on repeated Course Explorer 403 responses unless a retry is explicitly requested through environment variables.

### Session 64nx (Harden UMD section seeding)
- **`scripts/seed-umd-sections.js`** — Deduplicated UMD department lists before metadata upsert so repeated department codes no longer trigger `ON CONFLICT DO UPDATE command cannot affect row a second time`.
- **`scripts/seed-umd-sections.js`** — Reduced UMD section-detail request batches, added retry handling for transient fetch/500/429 failures, and added recursive batch splitting so one malformed or overloaded section request no longer fails an entire department.

### Session 64ny (Retry exact failed terms)
- **`scripts/backfill-school-sections.js`** — Added `--only-terms school:Term:Year` support so failed historical imports can be retried by exact term without re-running already successful years.

### Session 64nz (Harden Cornell section seeding)
- **`scripts/seed-cornell-sections.js`** — Deduplicated Cornell section rows by generated section id before Supabase upserts so subjects with repeated class numbers no longer trigger `ON CONFLICT DO UPDATE command cannot affect row a second time`.
- **`scripts/seed-cornell-sections.js`** — Added configurable Cornell fetch retry settings, deduplicated subject metadata rows, and treated roster-subject 404 responses as empty unavailable subjects instead of failed imports.

### Session 64oa (Fix Purdue Spring/Summer term codes)
- **`scripts/seed-purdue-sections.js`** — Corrected Purdue term-code generation so Fall uses the next academic-year code while Spring and Summer use the same calendar-year code, preventing Spring/Summer imports from being stored one year off.

### Session 64ob (Retry exact failed subjects)
- **`scripts/backfill-school-sections.js`** — Added `--only-subjects school:Term:Year:SUBJ+SUBJ` support so UMD/Cornell/Purdue failed departments can be retried together without re-running entire terms.

### Session 64oc (Protect term metadata on partial retries)
- **`scripts/seed-umd-sections.js`**, **`scripts/seed-cornell-sections.js`**, **`scripts/seed-purdue-sections.js`**, and **`scripts/seed-uiuc-sections.js`** — Changed subject/department-limited seed runs to skip `school_terms` count/status updates so retrying a few failed departments does not overwrite full-term metadata with partial counts.

### Session 64od (Clean school picker cards)
- **`src/screens/UniversitySelectionScreen.tsx`** — Removed the visible availability badge from school cards, switched selected card/button styling to each school's accent color, and improved the fallback monogram logo treatment so newly added schools without image assets still look intentional.

### Session 64oe (School accent course picker)
- **`src/screens/CoursePickerScreen.tsx`** — Replaced the remaining UCI-blue selection, filter, preview, review, and custom-block controls with the selected school's accent color so multi-school course browsing feels consistent after login.

### Session 64of (Shorten semester timetable labels)
- **`src/screens/TimetableScreen.tsx`** — Added a timetable-specific term label helper so semester schools show concise labels like `Fall 2026` in the timetable picker and add-term sheet while UCI can still show the quarter system label.

### Session 64og (Remove UCI-only UI paths)
- **`src/data/schools.ts`** and **`src/data/campusLocations.ts`** — Added shared campus coordinates plus multi-school classroom and athletics venue resolvers for UCI, UMD, Cornell, Purdue, and UIUC, replacing the old UCI-only location resolver.
- **`src/screens/TimetableScreen.tsx`** and **`src/screens/HomeScreen.tsx`** — Switched course maps, sports venue previews, weather coordinates, and map handoff labels to use the selected school's config/resolvers instead of UCI-specific checks.
- **`src/data/anonymousAliases.ts`**, **`src/screens/BoardScreen.tsx`**, **`src/screens/MessagesScreen.tsx`**, and **`src/screens/SettingsScreen.tsx`** — Replaced Anteater-only anonymous aliases/copy with school-aware aliases such as Terp, Cornellian, Boilermaker, and Illini.
- **`src/components/ErrorScreen.tsx`** and **`src/components/FeatureOnboardingScreen.tsx`** — Removed UCI mascot-specific fallback UI/copy from generic error/onboarding surfaces so non-UCI users do not see UCI branding.
- **`src/components/ReviewsModal.tsx`**, **`src/screens/CoursePickerScreen.tsx`**, and **`src/components/ProfileEditorScreen.tsx`** — Moved remaining UCI-specific integrations behind shared school config or neutral naming so UCI data sources no longer leak into generic app UI.

### Session 64oh (Stabilize home summary cards)
- **`src/screens/HomeScreen.tsx`** — Fixed the progress/weather two-column cards to a stable shared height and reserved a three-line weather insight area so weather copy wrapping no longer changes the row height or leaves the progress card with shifting whitespace.

### Session 64oi (Speed course picker and live saved count)
- **`src/screens/CoursePickerScreen.tsx`** — Made section `saved` counts reconcile with the current user's local add/remove state so the pill updates immediately instead of waiting for the next Supabase count refresh.
- **`src/screens/CoursePickerScreen.tsx`** — Stopped scanning the large `sections` table when `school_departments` already has metadata, and narrowed course search queries to only the columns the picker renders, reducing Cornell/Purdue/UMD department loading time.

### Session 64oj (Remove semester wording from term UI)
- **`src/data/schools.ts`** — Changed shared term labeling so semester schools render concise labels like `Spring 2026` even when callers request the academic-system suffix, while quarter schools can still show `Spring 2026 Quarter`.
- **`src/data/schools.ts`** and **`src/screens/SettingsScreen.tsx`** — Replaced semester-specific display wording with neutral `term` wording for actions/help copy such as add-term and GPA text.

### Session 64ok (Harden sports Going RSVP)
- **`src/screens/HomeScreen.tsx`** — Added sign-in guarding and legacy-schema fallbacks for sports event Going saves/deletes, so the button still works when Supabase has the old `event_id,user_id` RSVP key or lacks the newer `school` column.

### Session 64ol (Stabilize sports Going color)
- **`src/screens/HomeScreen.tsx`** — Changed sports Going button and list count pill styling to use the selected school's accent color instead of each sport's event color, so RSVP state no longer changes color from game to game.

### Session 64om (Restore Course Picker brand color)
- **`src/screens/CoursePickerScreen.tsx`** — Reverted Course Picker controls, filters, preview outlines, saved pills, review buttons, and custom-block selections to ClassMate's main blue instead of per-school accent colors, preserving school colors for university identity surfaces only.

### Session 64on (Show sports home-away badges)
- **`src/screens/HomeScreen.tsx`** — Added Home/Away badges to every sports event row and sports event detail sheet, using the shared `isHome` event field already supplied by each school's sports parser.

### Session 64oo (Update company website positioning)
- **`the-seans-site/index.html`** — Reworked the company website copy around ClassMate's current multi-school direction: real course-data scheduling, course reviews, verified anonymous campus discussion, and the five currently supported schools instead of a UC-system-first roadmap.
- **`the-seans-site/styles.css`** — Adjusted review metric pills in the website mockup so numeric course-review signals fit cleanly inside the product preview.

### Session 64op (Add GitHub Pages deploy workflow)
- **`.github/workflows/deploy-the-seans-site.yml`** — Added a GitHub Pages deployment workflow that publishes the standalone `the-seans-site` static website whenever the site folder or workflow changes land on `main`, making the homepage available on the public web through GitHub Pages.

### Session 64oq (Reposition the seans website as company-first)
- **`the-seans-site/index.html`** — Rewrote the website copy so `the seans` reads first as an education and campus community company, with ClassMate framed as the first product instead of the whole company identity. Replaced the prominent boxed school-support display with a small supported-schools line and updated the narrative around campus trust, verified anonymity, and student-native software.
- **`the-seans-site/styles.css`** — Added a subtle supported-schools line style and preserved the existing visual design while keeping the product heading text treatment stable after adding the small school list.

### Session 64or (Simplify hero background)
- **`the-seans-site/index.html`** — Removed the text-filled floating hero boxes behind the main `the seans` headline so the opening screen keeps the grid/orbit atmosphere without competing with the primary company message.

### Session 64os (Clarify verified-anonymous community copy)
- **`the-seans-site/index.html`** — Rewrote the scroll-showcase and phone mockup copy so ClassMate is framed as a school-verified, personally anonymous student community rather than a company that directly provides trustworthy information.
- **`the-seans-site/styles.css`** — Increased the scroll-showcase copy area and added spacing above the progress meter so the progress bar no longer overlaps long step text.

### Session 64ot (Make website phone mockup more app-like)
- **`the-seans-site/index.html`** — Reworked the scrolling phone preview, especially the final timetable state, to resemble the actual app structure with term context, schedule pills, a weekly timetable grid, course blocks, and bottom tabs instead of abstract keyword cards.
- **`the-seans-site/styles.css`** — Added app-like schedule pill, timetable time-label, and bottom-tab styles, and tightened the mini timetable dimensions so the final phone mockup contents stay aligned inside the device frame.

### Session 64ou (Full-screen hero grid)
- **`the-seans-site/styles.css`** — Removed the rounded hero grid frame and oval line decoration, replacing them with a full-screen grid background so the opening section feels cleaner and less shape-heavy.

### Session 64ov (Remove phone-side floating labels)
- **`the-seans-site/index.html`** and **`the-seans-site/styles.css`** — Removed the floating pill labels around the scrolling ClassMate phone preview so the app mockup stands on its own without side decorations competing with the screen content.

### Session 64ow (Move full product idea section)
- **`the-seans-site/index.html`** — Moved the entire four-step product-idea screen, including the `01/02/03/04` copy and ClassMate phone preview, underneath the `First product / ClassMate` heading and removed the older static phone preview.
- **`the-seans-site/index.html`** — Kept the ClassMate heading visible without the reveal animation so direct navigation to `#product` does not show a blank white intro area before the moved four-step screen.
- **`the-seans-site/styles.css`** — Restored the two-column scroll-showcase layout in its new position so the numbered story and app mockup remain one complete section under the ClassMate introduction.
- **`the-seans-site/script.js`** — Kept the moved four-step screen driven by the existing scroll-showcase interaction instead of a separate product-preview carousel.

### Session 64ox (Soften why-started website copy)
- **`the-seans-site/index.html`** — Replaced the sharper “no trusted student layer” framing with a softer disconnected-campus-life message, keeping the focus on fragmented student workflows and ClassMate's role in making campus feel more connected.

### Session 64oy (Reframe founder section)
- **`the-seans-site/index.html`** — Changed the founder section from name-forward copy to an international-student perspective about feeling the gap between connected Korean campus platforms and fragmented U.S. campus life.
- **`the-seans-site/styles.css`** — Reduced the visual weight of the founder name cards so the lived founder perspective leads the section while names remain present as secondary context.

### Session 64oz (Remove operating principles section)
- **`the-seans-site/index.html`** — Removed the `Operating principles` section entirely so the company website moves directly from founder perspective into the roadmap without repeating the product thesis.

### Session 64pa (Expand website roadmap)
- **`the-seans-site/index.html`** — Replaced the smaller `Now / Next / Later` roadmap with a four-step company roadmap from academic-week utility to verified campus communities, campus-by-campus expansion, and a broader student network for American universities.

### Session 64pb (Make website publishing-ready)
- **`the-seans-site/index.html`** — Added social preview metadata, changed the hero footer to foreground the international-student company origin instead of founder names, and rewrote the product-connection section so it clearly explains how schedule, reviews, boards, sports, classmates, and notifications fit into one verified campus context.

### Session 64pc (Clarify ClassMate feature band)
- **`the-seans-site/index.html`** — Rewrote the four product feature panels from abstract principles into concrete ClassMate benefits: real course data, one-tap schedules, same-campus reviews, and school-verified anonymous community.
- **`the-seans-site/styles.css`** — Tightened the ClassMate intro section spacing so the product heading leads naturally into the four-step app showcase.

### Session 64pd (Clean unused website styles)
- **`the-seans-site/styles.css`** — Removed leftover CSS for deleted hero boxes, the old static phone mockup, floating labels, school cards, and the removed operating-principles section so the published homepage stylesheet matches the current site structure.

### Session 64pe (Update website contact links)
- **`the-seans-site/index.html`** — Updated all homepage contact mailto links from the placeholder domain email to `heyy.seans@gmail.com` and `hii.seans@gmail.com`, and changed the footer text to show both addresses.
- **`the-seans-site/index.html`** and **`the-seans-site/styles.css`** — Removed the unexplained `TS` closing monogram so the final thesis screen no longer shows a confusing placeholder mark.

### Session 64pf (Title-case company brand)
- **`the-seans-site/index.html`** — Updated visible and metadata company-name references from `the seans` to `The Seans` so the homepage follows proper title-case brand capitalization.

### Session 64pg (Simplify homepage hero)
- **`the-seans-site/index.html`** — Removed the hero eyebrow `Education and campus community company` from the first screen so the opening page leads with the brand name and main thesis instead of a category label.

### Session 64ph (Guard file picker in Expo Go)
- **`src/screens/BoardScreen.tsx`** — Moved `expo-document-picker` from a top-level import to a lazy import inside the file-attachment handler and added a fallback alert, so Expo Go previews do not crash on launch when the native document picker module is unavailable.

### Session 64pi (Shrink EAS upload archive)
- **`.easignore`** — Added generated iOS dependency/build folders and Xcode user-state files to the EAS ignore list so production builds upload only source files instead of sending local Pods/build artifacts to the remote builder.

### Session 64pj (Refresh Expo lockfile for EAS)
- **`package-lock.json`** — Refreshed the npm lockfile with `npm install` so the locked Expo SDK 55 patch packages match `package.json`, fixing the remote `npm ci` failure during the EAS install-dependencies phase.

### Session 64pk (Add cleaned university logos)
- **`assets/cornell-logo-white.png`, `assets/purdue-logo-white.png`, `assets/uiuc-logo-white.png`** — Added cleaned white-background logo assets from the supplied school logo files so the university picker shows only the logo artwork without colored or checkerboard backgrounds.
- **`src/screens/UniversitySelectionScreen.tsx`** — Updated Cornell and Purdue to use the cleaned logo assets, added the UIUC logo asset, and tuned per-school logo sizing inside the university selection card.

### Session 64pl (Prevent review-account home flash)
- **`App.tsx`** — Detects the review account during Supabase session hydration and sets the one-time feature-onboarding gate before profile/settings loading can clear it, preventing the home screen from flashing briefly before the onboarding flow appears after review-account login.

### Session 64pm (Respect selected university during auth)
- **`App.tsx`** — Added a pending-auth university ref so Supabase `SIGNED_IN` hydration cannot overwrite the school the user just selected with stale `classmate_school` metadata from a previous login. Also resets the selected academic term to the chosen school's current term during sign-in/sign-up.
- **`src/screens/SignInScreen.tsx`** and **`src/screens/SignUpScreen.tsx`** — Pass the selected university back through the auth success callbacks so the app state is anchored to the explicit school choice instead of whatever school metadata was previously stored on the account.
- **`src/screens/HomeScreen.tsx`** — Clears sports-event state immediately on school changes and ignores stale sports fetch results so events or participation counts from a previous university cannot leak into the newly selected school.

### Session 64pn (Harden Purdue sports schedule fetching)
- **`src/data/sportsEvents.ts`** — Changed schedule-page sports fetching from one shared timeout over all team pages to per-page timeouts with a four-request concurrency limit and browser-like headers. Purdue's WMT schedule pages are heavier than the other schools, so this prevents one slow page batch from aborting every Purdue sports request and leaving the app with no events.

### Session 64po (Remove onboarding school badge card)
- **`src/components/FeatureOnboardingScreen.tsx`** — Removed the small school badge/mascot pill from the first post-login welcome onboarding screen so the welcome slide stays cleaner and does not show an extra school card under the intro copy.

### Session 64pp (Fix UMD sports text schedule parsing)
- **`src/data/sportsEvents.ts`** — Updated the UMD `schedule/text` parser to handle the actual fetched HTML structure where date, time, home/away marker, opponent, location, and result are split across separate lines. This fixes UMD sports pages returning zero events even when official upcoming Terps games exist.

### Session 64pq (Replace UCI selection logo)
- **`assets/uci-logo-white.svg` / `assets/uci-logo-white.png`** — Added a white-background UCI wordmark asset matching the new school-logo style.
- **`src/screens/UniversitySelectionScreen.tsx`** — Swapped the UCI school selection logo from the tiny monogram to the new full UCI wordmark and adjusted its card size so it fits the row cleanly.

### Session 64pr (Instant department picker lists)
- **`src/data/schoolDepartments.ts`** — Added local seeded department indexes for all currently supported schools so department filters can render immediately without waiting for Supabase.
- **`src/screens/CoursePickerScreen.tsx`** — Uses the local department index first, keeps a small in-memory cache for remote updates, and skips the expensive `sections` table scan for supported schools when `school_departments` is empty. This removes the multi-second delay before Cornell, Purdue, UMD, and UIUC department lists appear.

### Session 64ps (Merge live departments after instant render)
- **`src/screens/CoursePickerScreen.tsx`** — Changed the instant department list from a hard authority into a fast initial cache. The picker now renders local departments immediately, then merges in `school_departments` and the selected term's live `sections` departments in the background so newly seeded departments can appear without blocking the sheet opening.

### Session 64pt (Apply new square ClassMate logo globally)
- **`assets/icon.png`, `assets/splash-icon.png`, `assets/favicon.png`, `assets/android-icon-foreground.png`, `assets/android-icon-monochrome.png`, `assets/classmate-logo-approved.png`, `assets/classmate-logo-approved-transparent.png`, `assets/classmate-logo-full.png`, `assets/classmate-logo-mark.png`, and `assets/classmate-logo-icon.png`** — Replaced the existing ClassMate app icon and in-app brand-logo assets with the supplied square blue ClassMate logo so Expo, Android, web favicon, splash, and in-app branding all resolve to the same approved mark.

### Session 64pu (Glossy dimensional brand refresh)
- **`src/context/ThemeContext.tsx`** — Shifted the shared light/dark palettes toward luminous blues, brighter surfaces, and cooler borders so screens using the common theme inherit a glossier visual tone.
- **`src/components/ClassMateMonogram.tsx`** — Replaced the old text monogram tile with the new logo image inside a shadowed, highlighted app-icon shell so onboarding and welcome branding looks dimensional.
- **`App.tsx`** — Restyled the bottom tab bar and active tab pill with stronger blue glass, highlights, and deeper shadows to make the always-visible navigation match the new logo finish.
- **`src/screens/WelcomeScreen.tsx`, `src/components/ClassMateIntroScreen.tsx`, and `src/screens/SettingsScreen.tsx`** — Added glossy background bands, brighter logo frames, elevated feature chips, and highlighted primary/about-logo surfaces so the main brand touchpoints feel more polished and 3D.

### Session 64pv (Replace app logo with full-bleed fixed mark)
- **`assets/icon.png`, `assets/splash-icon.png`, `assets/favicon.png`, `assets/android-icon-foreground.png`, `assets/android-icon-monochrome.png`, `assets/classmate-logo-approved.png`, `assets/classmate-logo-approved-transparent.png`, `assets/classmate-logo-full.png`, `assets/classmate-logo-mark.png`, and `assets/classmate-logo-icon.png`** — Replaced the previous logo exports with the supplied full-bleed square fixed logo so the blue app icon fills the canvas without visible black outer padding.

### Session 64pw (Tone down glossy depth)
- **`src/context/ThemeContext.tsx`** — Softened the bright blue theme refresh into calmer app blues and lighter neutral surfaces so the whole UI feels less saturated.
- **`App.tsx`, `src/components/ClassMateMonogram.tsx`, `src/screens/WelcomeScreen.tsx`, `src/components/ClassMateIntroScreen.tsx`, and `src/screens/SettingsScreen.tsx`** — Reduced highlight opacity, shadow strength, and elevation on the tab bar, brand icon frame, welcome CTA, intro chips, and About logo so the app keeps subtle depth without the overly glossy 3D look.

### Session 64px (Retry failed UIUC seeding subjects only)
- **`scripts/retry-uiuc-failed-subjects.js`** — Added a UIUC-only retry runner containing the failed subject groups from the 2019–2026 backfill logs (`Spring 2021 ENGL`, `Fall 2022 NPRE`, and the failed `Fall 2026` subjects) so only missing/error departments are fetched again instead of reseeding every term.
- **`scripts/seed-uiuc-sections.js`** — Marks the process as failed when any subject errors remain, allowing the retry runner/backfill tooling to detect partial UIUC runs instead of treating them as success.
- **`package.json`** — Added `npm run retry:uiuc-failed` as a short command for rerunning only the known failed UIUC subject list.

### Session 64py (Transparent logo cutout assets)
- **`assets/icon.png`, `assets/splash-icon.png`, `assets/favicon.png`, `assets/android-icon-foreground.png`, `assets/android-icon-background.png`, `assets/android-icon-monochrome.png`, `assets/classmate-logo-approved.png`, `assets/classmate-logo-approved-transparent.png`, `assets/classmate-logo-full.png`, `assets/classmate-logo-mark.png`, `assets/classmate-logo-icon.png`, `the-seans-site/assets/classmate-logo-approved-transparent.png`, `the-seans-site/assets/classmate-logo-mark.png`, `the-seans-site/assets/favicon.png`, and `ClassMate_logo_option_1_square.png`** — Rebuilt the logo exports from the supplied fixed square source with the connected dark outer background removed to alpha, so the blue ClassMate icon itself remains full-size while black/white backing no longer appears around the rounded logo.

### Session 64pz (Use full-bleed opaque app logo)
- **`assets/icon.png`, `assets/splash-icon.png`, `assets/android-icon-foreground.png`, `assets/android-icon-background.png`, `assets/classmate-logo-approved.png`, `assets/classmate-logo-approved-transparent.png`, `assets/classmate-logo-full.png`, `assets/classmate-logo-mark.png`, `assets/classmate-logo-icon.png`, `assets/favicon.png`, `the-seans-site/assets/classmate-logo-approved-transparent.png`, `the-seans-site/assets/classmate-logo-mark.png`, and `the-seans-site/assets/favicon.png`** — Replaced the transparent cutout exports with full-bleed opaque logo exports so the app icon fills iOS/Android/web icon slots instead of showing white backing through transparent corners.
- **`ios/ClassMate/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png`** — Updated the native iOS AppIcon source directly to the same full-bleed opaque logo because the simulator-installed app uses the iOS asset catalog, not only `app.json`.

### Session 64qa (Robust UIUC sectionData parser)
- **`scripts/seed-uiuc-sections.js`** — Replaced the regex-only `sectionDataObj` extractor with a bracket/string-aware scanner so older UIUC Course Explorer pages whose section data contains embedded `];`-like text no longer truncate JSON mid-string. Verified `DRY_RUN=1 ... Spring 2021 ENGL` now parses successfully with 123 sections and 0 subject errors.

### Session 64qb (Remove logo frames and reuse school logos)
- **`src/components/ClassMateMonogram.tsx`, `src/screens/WelcomeScreen.tsx`, and `src/components/ClassMateIntroScreen.tsx`** — Removed the extra inset, overlay, and white framing around the ClassMate logo so the supplied app icon artwork fills its visible slot instead of sitting inside another rounded white tile.
- **`src/components/UniversityLogo.tsx`, `src/screens/UniversitySelectionScreen.tsx`, `src/screens/SignInScreen.tsx`, and `src/screens/SignUpScreen.tsx`** — Added one shared school-logo component and used it on selection, sign-in, and sign-up screens so school cards show the actual university logo assets instead of fallback text tiles like `CU`.
- **`App.tsx`** — Stopped forcing review-account onboarding during automatic saved-session hydration; review onboarding is now only forced immediately after an explicit review-account sign-in, preventing cold starts from jumping back into a stale Cornellian welcome flow.
- **`src/screens/BoardScreen.tsx`** — Replaced the top-level `expo-image` render dependency with React Native `Image` and lazy-loaded image picker/manipulator/media/share modules so Expo Go/simulator previews do not crash on launch when optional native attachment modules are unavailable.

### Session 64qc (Use raw school logos without tiles)
- **`src/components/UniversityLogo.tsx`** — Removed the rounded white tile, border, and per-school fixed mini sizes so university logos render as the raw image artwork with `contain` sizing instead of being clipped inside a small square.
- **`src/screens/UniversitySelectionScreen.tsx`, `src/screens/SignInScreen.tsx`, and `src/screens/SignUpScreen.tsx`** — Enlarged the school logo slot and let the adjacent school name wrap to two lines on sign screens so every supported school logo has enough horizontal space without cropping.
- **`assets/uci-logo-white.png`, `assets/umd-logo.png`, `assets/cornell-logo-white.png`, `assets/purdue-logo-white.png`, and `assets/uiuc-logo-white.png`** — Removed connected white image backgrounds and cropped transparent padding from the school-logo PNGs so the sign and school-selection screens display only the logo artwork.

### Session 64qd (Fix oversized launch splash logo)
- **`assets/splash-icon.png`** — Rebuilt the splash-only image with the ClassMate app icon centered at a smaller size on a transparent canvas so Expo/iOS launch splash no longer shows the full 1024px icon oversized or clipped on the first frame.

### Session 64qe (Render logos as images only)
- **`src/components/ClassMateMonogram.tsx`** — Removed the shadowed wrapper, clipping, and radius shell so all ClassMate logo placements render the logo image directly instead of putting it inside another app-icon box.
- **`src/screens/SettingsScreen.tsx`** — Removed the About screen's brand-logo card, border, highlight overlay, and background so the ClassMate logo appears as the raw image only.
- **`src/components/UniversityLogo.tsx`** — Removed the unused border-radius prop from the school logo component now that school logos no longer render inside any tile.

### Session 64qf (Replace every ClassMate logo with supplied source)
- **`assets/icon.png`, `assets/splash-icon.png`, `assets/android-icon-foreground.png`, `assets/android-icon-background.png`, `assets/android-icon-monochrome.png`, `assets/classmate-logo-approved.png`, `assets/classmate-logo-approved-transparent.png`, `assets/classmate-logo-full.png`, `assets/classmate-logo-mark.png`, `assets/classmate-logo-icon.png`, `assets/favicon.png`, `ClassMate_logo_option_1_square.png`, `the-seans-site/assets/classmate-logo-approved-transparent.png`, `the-seans-site/assets/classmate-logo-mark.png`, `the-seans-site/assets/favicon.png`, and `ios/ClassMate/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png`** — Rebuilt every ClassMate logo/icon asset from the supplied `/Users/parksihyun/Desktop/logo.png` source at 1024x1024 so app icon, splash, in-app logo, Android adaptive icon assets, web favicon, website logo exports, and native iOS AppIcon all use the exact same square artwork without mismatched variants.

### Session 64qg (Remove black background from supplied logo)
- **`assets/icon.png`, `assets/splash-icon.png`, `assets/android-icon-foreground.png`, `assets/android-icon-background.png`, `assets/android-icon-monochrome.png`, `assets/classmate-logo-approved.png`, `assets/classmate-logo-approved-transparent.png`, `assets/classmate-logo-full.png`, `assets/classmate-logo-mark.png`, `assets/classmate-logo-icon.png`, `assets/favicon.png`, `ClassMate_logo_option_1_square.png`, `the-seans-site/assets/classmate-logo-approved-transparent.png`, `the-seans-site/assets/classmate-logo-mark.png`, `the-seans-site/assets/favicon.png`, and `ios/ClassMate/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png`** — Reprocessed the supplied logo source by removing only the edge-connected black background to alpha before writing every ClassMate logo asset, so in-app logo renders no black square around the rounded blue mark.

### Session 64qh (Remove glossy UI and fix home warnings)
- **`src/context/ThemeContext.tsx`, `src/screens/WelcomeScreen.tsx`, `src/components/ClassMateIntroScreen.tsx`, and `App.tsx`** — Removed the glossy background bands, highlight strips, elevated shadows, glass tab pill overlays, and bright glossy palette added during the brand refresh so the app returns to a flatter visual treatment.
- **`src/screens/HomeScreen.tsx`** — Added a missing-column fallback for the home classmate query when `friend_requests.school` is not present, preventing the red warning/error toast from appearing on startup against older Supabase schemas.
- **`App.tsx`** — Added the configured EAS project id as the final push-token fallback so Expo push registration does not warn that no project id is configured when Expo Go omits config metadata.
- **`src/components/UniversityLogo.tsx`, `src/screens/UniversitySelectionScreen.tsx`, `src/screens/SignInScreen.tsx`, and `src/screens/SignUpScreen.tsx`** — Widened school logo rendering slots so UCI and other long horizontal wordmarks are shown with more room instead of appearing clipped or cramped.

### Session 64qi (Pad UCI wordmark)
- **`assets/uci-logo-white.png`** — Added transparent vertical safety padding around the UCI wordmark so the bottom of the logo text does not appear clipped after white-background removal.
- **`src/screens/UniversitySelectionScreen.tsx`** — Increased the university-selection logo row height to give horizontal school wordmarks enough vertical breathing room.

### Session 64qj (Fix Purdue sports schedule parsing)
- **`src/data/sportsEvents.ts`** — Updated the WMT schedule parser used by Purdue to detect the actual `Schedule Events` heading and the split `Fri` / `May 8` date layout rendered by Purdue Sports, so upcoming Boilermakers games are no longer parsed as an empty list.
- **`src/data/schools.ts`** — Corrected Purdue sports schedule paths for swimming/diving and track & field to match the official `purduesports.com` URLs, preventing those sports from silently returning no events.

### Session 64qk (Revert school logo cards)
- **`src/components/UniversityLogo.tsx`** — Reverted the school-logo renderer back to compact colored initial tiles instead of raw wide university image assets, so the auth cards stop showing oversized or awkwardly cropped school wordmarks while waiting for a new UCI logo source.
- **`src/screens/UniversitySelectionScreen.tsx`** — Restored the university picker cards to the original horizontal layout with the compact logo tile on the left and school details on the right.

### Session 64ql (Use supplied UCI logo only)
- **`assets/uci-logo-white.png`** — Replaced the prior UCI wordmark asset with the newly supplied seal-and-wordmark PNG.
- **`src/components/UniversityLogo.tsx`** — Added a UCI-only image path while keeping every other school on the compact initial tile fallback.
- **`src/screens/UniversitySelectionScreen.tsx`** — Gave only the UCI row a wider logo slot so the supplied horizontal UCI artwork fits without forcing the rest of the school list back into oversized image cards.

### Session 64qm (Restore small image school logos)
- **`src/components/UniversityLogo.tsx`** — Restored actual image-logo rendering for all supported school logo assets instead of colored initials, while keeping the text fallback only for schools without an asset.
- **`src/screens/UniversitySelectionScreen.tsx`** — Standardized the school-logo slot to a small contained image area so UCI, UMD, Cornell, Purdue, and UIUC logos sit on the white card without oversized cropping.

### Session 64qn (Remove UCI checkerboard background)
- **`assets/uci-logo-white.png`** — Removed the baked-in light checkerboard background pixels from the supplied UCI PNG by making them transparent, leaving only the UCI seal-and-wordmark artwork visible on white cards.

### Session 64qo (Use school_terms for term discovery)
- **`App.tsx`** — Changed initial seeded-term selection to read the small `school_terms` metadata table first instead of scanning the large `sections` table, falling back only when metadata lookup fails.
- **`src/screens/TimetableScreen.tsx`** — Changed Add Quarter availability and prefetch caching to load seeded terms from `school_terms` in one query instead of running per-term `sections` count checks.
- **`scripts/seed-sections.js` and `scripts/seed-summer.js`** — Added mandatory UCI `school_terms` and `school_departments` metadata upserts after each seed run so future UCI backfills publish the term/dept “table of contents” the app now reads.

### Session 64qp (Guarantee section-backed terms still show)
- **`App.tsx`** — Changed seeded-term resolution to use the union of `school_terms` metadata and actual `sections` checks, so a term present in course data is still selected even if metadata is missing or incomplete.
- **`src/screens/TimetableScreen.tsx`** — Updated Add Quarter and seeded-term prefetch to include every term found by `sections` count checks in addition to `school_terms`, and expanded candidate discovery back to 2019 so older seeded data can appear.

### Session 64qq (Refresh add-quarter terms on open)
- **`src/screens/TimetableScreen.tsx`** — Removed the early return from the cached Add Quarter path so opening the sheet always reloads seeded terms from the metadata-plus-sections source of truth, preventing stale empty caches from hiding terms that exist in the database.

### Session 64qr (Fast term metadata reconciliation)
- **`App.tsx` and `src/screens/TimetableScreen.tsx`** — Removed runtime `sections` count fallbacks from seeded-term discovery so startup and Add Quarter read only the lightweight `school_terms` metadata table.
- **`scripts/reconcile-school-terms.js`, `supabase/sql/reconcile_school_terms_from_sections.sql`, and `package.json`** — Added a reconciliation path that rebuilds `school_terms` from actual `sections` rows, plus an npm script, so every section-backed term can appear quickly without the mobile app scanning the large sections table.

### Session 64qs (Expose catalog metadata to the app)
- **`supabase/sql/public_catalog_metadata_read_policy.sql` and `supabase/sql/multi_school_catalog_metadata.sql`** — Added anon/authenticated SELECT grants and public read RLS policies for `school_terms` and `school_departments`, allowing the mobile app to read the lightweight catalog metadata that was already populated server-side.

### Session 64qt (Make App Store icon opaque)
- **`assets/icon.png` and `ios/ClassMate/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png`** — Flattened alpha pixels onto a blue background so the iOS App Store large icon has no transparency/alpha channel while keeping in-app ClassMate logo assets transparent.

### Session 64qu (Prevent blank auth bootstrap screen)
- **`App.tsx`** — Wrapped auth/session and user-preference bootstrap paths in error-safe handling so failed profile/settings loads cannot leave the app stuck on a blank loading screen after switching schools and signing in. Replaced blank auth/bootstrap placeholders with visible loading indicators.

### Session 64qv (Timeout auth bootstrap queries)
- **`App.tsx`** — Added a small timeout wrapper around session validation and profile/settings bootstrap queries so a stalled Supabase request falls back instead of leaving the app stuck during school-switch sign-in.

### Session 64qw (Repair school-scoped board comments)
- **`supabase/sql/board_comments_school_repair.sql`** — Added a Supabase repair migration that adds/backfills `school` on board comment, post-like, and comment-like tables, recreates school-aware unique indexes, grants comment permissions, adds own-comment update/delete policies, and updates `delete_own_comment` to stay within the comment's school. This fixes board comments after the app started filtering comments and likes by school.

### Session 64qx (Align Expo SDK patch)
- **`package.json` and `package-lock.json`** — Updated `expo` from `~55.0.18`/resolved `55.0.19` to `~55.0.20` so Expo's compatibility check stops warning that the installed SDK patch is behind the expected version.

### Session 64qy (Fix school-switch sign-in loading race)
- **`App.tsx`** — Added a user-bootstrap request counter and routed session hydration, sign-up, and sign-in through it so profile/settings bootstrap reruns even when the same review account signs into a different school with unchanged user id/email. This prevents the `Loading ClassMate...` screen from staying on forever after switching from Cornell review access back to UCI.

### Session 64qz (Replace native iOS launch logo)
- **`ios/ClassMate/Images.xcassets/SplashScreenLegacy.imageset/image*.png`** — Replaced the leftover native LaunchScreen splash images with the approved ClassMate logo asset so iOS no longer flashes the old pre-React splash logo during the first instant of app launch.

### Session 64ra (Clean gitignore conflict markers)
- **`.gitignore`** — Removed leftover merge-conflict markers while preserving the existing ignored paths. This keeps repo tooling clean before rebuilding the iOS app with the corrected native splash asset.

### Session 64rb (Rename iOS splash asset to avoid launch cache)
- **`ios/ClassMate/SplashScreen.storyboard` and `ios/ClassMate/Images.xcassets/SplashScreenClassMate.imageset/`** — Pointed the native launch storyboard at a newly named ClassMate splash image set, with the approved logo copied into all scales. Renaming the asset helps avoid iOS showing a cached `SplashScreenLegacy` launch snapshot after app updates.

### Session 64rc (Lighten startup and background loading)
- **`App.tsx`** — Deferred non-critical unread badge, social notification polling, and reminder scheduling work until after the first screen has time to render; reduced auth/profile/settings timeout windows; limited background message/comment notification queries; and narrowed timetable startup selects to only the columns the app uses. This keeps login and app start from competing with heavy background Supabase work.
- **`src/screens/CoursePickerScreen.tsx`** — Stopped scanning the large `sections` table for departments when local or `school_departments` metadata already exists, and delayed ClassMate saved-count aggregation until the user actually searches or chooses a category. This makes opening Add Class much lighter.
- **`src/screens/HomeScreen.tsx`** — Added a weather cache TTL, deferred sports refresh and classmate matching, and downgraded non-fatal home/social errors to warnings so background cards no longer overload startup or trigger development red screens.
- **`src/screens/TimetableScreen.tsx`** — Downgraded seeded-term metadata failures to warnings because Add Quarter can stay usable without surfacing a development error overlay.

### Session 64rd (Remove unused legacy splash asset)
- **`ios/ClassMate/Images.xcassets/SplashScreenLegacy.imageset/`** — Deleted the unused legacy launch-screen image set after the storyboard moved to `SplashScreenClassMate`, so the next native build no longer packages a stale splash asset that could be mistaken for the active app launch logo.

### Session 64re (Keep visible loading responsive)
- **`App.tsx` and `src/screens/HomeScreen.tsx`** — Shortened the visible-facing startup deferrals for unread badges, sports refresh, and home classmate matching so the app still gets lighter background behavior without making user-facing cards feel intentionally slower.

### Session 64rf (Remove review-account onboarding force)
- **`App.tsx`** — Removed the review-account-specific onboarding override so existing review accounts no longer get forced back into the feature onboarding screen after sign-in or school switching. Onboarding now appears only for genuinely new/incomplete profiles based on saved user settings.

### Session 64rg (Restore review-account onboarding)
- **`App.tsx`** — Restored the review-account-specific onboarding path for `review@classmate.app` so App Review sees the onboarding flow immediately after sign-in, while normal returning accounts still skip onboarding unless their saved setup is incomplete.

### Session 64rh (Block main app before review onboarding)
- **`App.tsx`** — Added a render-level review-account guard before the bootstrap loading and main-app branches, and set the review-onboarding flag before bootstrap starts. This prevents the home screen from rendering even briefly before the App Review onboarding flow appears.

### Session 64ri (Remove blocking board loading)
- **`src/screens/BoardScreen.tsx`** — Removed the large `sections` table scan from department-board discovery and switched the department list to local school metadata plus the lightweight `school_departments` table. This makes department boards appear immediately instead of waiting on a full course-data scan.
- **`src/screens/BoardScreen.tsx`** — Removed passive loading indicators from board posts and department-board picker, capped the initial post refresh to the latest 100 posts, and kept cached/empty UI interactive while refreshes happen in the background.
- **`App.tsx`** — Removed the full-screen `Loading ClassMate...` branch for normal signed-in users so profile/settings bootstrap no longer blocks the main app; review accounts are still intercepted by the onboarding guard before main app render.

### Session 64rj (Keep screens interactive during refresh)
- **`src/screens/TimetableScreen.tsx`** — Changed Add Quarter to open immediately with cached term data when available and removed the visible loading state from the term picker.
- **`src/screens/CoursePickerScreen.tsx`** — Removed the large spinner/text loading state from course search and department fetch results so the picker stays responsive while results update.
- **`src/screens/HomeScreen.tsx`** — Replaced passive weather/sports loading copy with neutral empty-state copy so the home screen does not show loading text while background refreshes run.
- **`src/screens/BoardScreen.tsx`, `src/screens/MessagesScreen.tsx`, `src/screens/FriendsScreen.tsx`, and `src/screens/SettingsScreen.tsx`** — Removed or bypassed passive loading branches in regular browsing flows so screens stay tappable with cached/empty content instead of blocking on spinners.

### Session 64rk (Remove visible system wording)
- **`src/screens/TimetableScreen.tsx`** — Removed visible `Quarter`/`Semester`-style wording from the term picker and add-term menu, using generic term labels instead so multi-school UI does not expose academic-system copy.
- **`src/screens/GradesScreen.tsx`** — Removed the GPA scale/source label from the grade trend card and changed visible quarter headings/empty copy to generic term wording so the grades screen no longer shows scale 기준 text or quarter-specific labels.

### Session 64rl (Fix sports event comment school fallback)
- **`src/screens/HomeScreen.tsx`** — Added missing fallback paths for sports event comment insert/delete when Supabase has not yet exposed the `school` column in schema cache. This matches the existing read fallback and prevents comment actions from failing with the schema-cache error.
- **`supabase/sql/sports_event_comments_school_repair.sql`** — Added a focused Supabase repair migration that creates/adds/backfills `school` on sports event RSVP/comment tables, fixes the RSVP primary key to include school, recreates school-aware indexes, grants permissions, and reloads PostgREST schema cache.

### Session 64rm (Hide idle board comment composer)
- **`src/screens/BoardScreen.tsx`** — Changed the post-detail comment composer so it no longer floats above the tab bar while idle. The fixed composer now appears only when adding, replying, editing, or typing; otherwise the comments section shows an inline `Add a comment...` action.

### Session 64rn (Remove hardcoded shared-class quarter label)
- **`src/screens/FriendsScreen.tsx`** — Replaced the hardcoded `SHARED CLASSES THIS QUARTER` heading with `SHARED CLASSES THIS TERM` so semester-based schools do not show quarter-specific copy.

### Session 64ro (Remove conflicting class atomically)
- **`src/screens/CoursePickerScreen.tsx`** — Changed conflict detection to collect all overlapping classes and call a dedicated conflict resolver instead of toggling the old and new sections separately.
- **`App.tsx`** — Added an atomic conflict-resolution update that removes the existing conflicting classes and inserts the new class in one saved timetable update, preventing removed conflicts from reappearing when the new class is later deleted.

### Session 64rp (Keep inline comment action above tab bar)
- **`src/screens/BoardScreen.tsx`** — Increased post-detail scroll bottom padding when the comment composer is idle so long image posts can scroll the inline `Add a comment...` action fully above the floating tab bar.

### Session 64rq (Redesign grade picker)
- **`src/screens/GradesScreen.tsx`** — Reworked the letter-grade picker from a loose wrapping button list into a cleaner bottom sheet with A/B/C/D/F rows, separate non-letter grade chips, and always-visible unit chips for faster grade entry.

### Session 64rr (Remove friend timetable system suffix)
- **`src/screens/FriendsScreen.tsx`** — Removed the `includeSystem` flag from friend timetable term labels so the friend schedule picker and empty-state copy show `Spring 2026` instead of appending quarter/semester wording.

### Session 64rs (Remove remaining term-system suffixes)
- **`src/screens/CoursePickerScreen.tsx`** — Removed the remaining `includeSystem` usage from the add-course header and no-results copy so the course picker shows `Spring 2026` instead of `Spring 2026 Quarter`.
- **`src/screens/FriendsScreen.tsx`** — Added a plain local term formatter for friend timetable dropdown and empty-state labels so those controls cannot append quarter/semester wording from school config.

### Session 64rt (Align Expo SDK package patches)
- **`package.json` / `package-lock.json`** — Updated Expo SDK 55 companion packages to the expected patch ranges reported by Expo so local runs stop warning about incompatible installed versions.

### Session 64ru (Force Android preview APK builds)
- **`eas.json`** — Set the Android `preview` profile to `buildType: "apk"` so Reddit/TestFlight-style Android beta requests produce directly installable APK artifacts instead of Play Store bundles.

### Session 64rv (Report unmapped classroom locations)
- **`scripts/report-unmapped-classrooms.js`** — Added a Supabase-backed report that scans all schools' section locations and lists classroom strings that do not resolve through the app's campus map resolver. This makes it easy to fill missing building aliases and reduce courses without map previews.
- **`package.json`** — Added `npm run report:unmapped-classrooms` so the unmapped-location audit can be run without remembering the script path.

### Session 64rw (Avoid report query timeout)
- **`scripts/report-unmapped-classrooms.js`** — Removed database-side sorting from the unmapped classroom report so Supabase can return paged section rows without timing out on the large shared `sections` table. Sorting is still handled locally before printing.

### Session 64rx (Scan unmapped locations by seeded term)
- **`scripts/report-unmapped-classrooms.js`** — Changed the report to read `school_terms` first and scan `sections` by `(school, quarter_key)` pages instead of full-table pages. This avoids statement timeouts on the large catalog while still reporting every school.

### Session 64ry (Ignore non-classroom map placeholders)
- **`src/data/campusLocations.ts`** — Expanded the unmappable-location guard to ignore common non-classroom placeholders like `ON LINE`, `TBA TBA`, `Location Pending`, generic main-campus labels, and off-campus markers. This prevents the app from treating those values as missing map previews.
- **`scripts/report-unmapped-classrooms.js`** — Mirrored the same placeholder guard in the unmapped classroom report so the audit focuses on real building aliases worth mapping.

### Session 64rz (Group unmapped rooms by building)
- **`scripts/report-unmapped-classrooms.js`** — Added `--group-buildings`, which collapses repeated room-level misses like `HICF 100P` and `HICF 100K` into a single building candidate. This turns the map-audit problem from thousands of rooms into a manageable school-by-school building list.

### Session 64sa (Map high-frequency UCI classroom buildings)
- **`src/data/campusLocations.ts`** — Added official UCI campus-map coordinates for high-frequency unmapped classroom building codes including HICF, PSCB, ET, SBSG, IAB, MPAA, EDUC, CAC, COHS, arts buildings, engineering trailers, law/health-sciences buildings, and the remaining verified low-frequency UCI building codes. This lets all rooms under those codes resolve to in-app map previews without asking for room-by-room coordinates.

### Session 64sb (Canvas assignment checklist on Home)
- **`src/screens/HomeScreen.tsx`** — Replaced the Home weather card with a compact sports summary card and moved the main lower card to Canvas assignments. Added Canvas calendar feed setup, local `.ics` parsing, cached assignment sync, checklist completion state, deadline labels, refresh/manage actions, and clear empty states for users who have not connected Canvas yet.

### Session 64sc (Generalize assignment calendar providers)
- **`src/screens/HomeScreen.tsx`** — Generalized the Canvas checklist into an LMS assignment calendar import. Added provider options for Canvas, Brightspace, Blackboard, Moodle, Sakai, Google Classroom, and Other; updated visible copy and errors away from Canvas-only wording; moved storage to `assignment_calendar_*` keys while migrating existing local Canvas feed/cache data.

### Session 64sd (Polish compact sports card)
- **`src/screens/HomeScreen.tsx`** — Reworked the small Home sports card from a cramped two-row list into a single next-game summary with a larger sport icon, Home/Away badge, readable title/date, going count, and `+N more`/details affordance. Tightened the no-event state so the card reads cleaner in the former weather slot.

### Session 64se (Show multiple compact sports events)
- **`src/screens/HomeScreen.tsx`** — Adjusted the compact Home sports card to show up to three upcoming events instead of only one featured event. Each row now uses a small sport icon, one-line event title, date/time, and compact H/A badge so the card shows more schedule context without overflowing the former weather slot.

### Session 64sf (Remove compact sports icons)
- **`src/screens/HomeScreen.tsx`** — Renamed the Home card to `Sports Events` and removed the header/row/empty-state sports icons from the compact card so up to three events have more room for readable titles and times.

### Session 64sg (Past assignments and sports list sheet)
- **`src/screens/HomeScreen.tsx`** — Changed the Home assignments card to show only upcoming incomplete deadlines; past deadlines are hidden from Home and available in a new `Past Assignments` bottom sheet where they can still be checked off or opened. Simplified the sports card into an `Upcoming Sports Events` summary CTA that opens a full sports events list sheet instead of rendering a cramped event list directly in the small card.

### Session 64sh (Trim sports card helper copy)
- **`src/screens/HomeScreen.tsx`** — Removed the explanatory `Tap to see...` helper text from the compact upcoming sports events card so the small card is cleaner and relies on its count/list affordance.

### Session 64si (Rename past assignment chip)
- **`src/screens/HomeScreen.tsx`** — Changed the assignment header chip from `Past N` to `Past Assignments N` so the action label is clearer.

### Session 64sj (Show all upcoming assignments)
- **`src/screens/HomeScreen.tsx`** — Removed the five-item cap from the Home assignments checklist so every upcoming incomplete assignment renders in the card.

### Session 64sk (Tighten sports summary spacing)
- **`src/screens/HomeScreen.tsx`** — Removed `space-between` from the compact upcoming sports events card and tightened the vertical stack so the count/action no longer float with an awkward middle gap.

### Session 64sl (Default past assignments to complete)
- **`src/screens/HomeScreen.tsx`** — Changed assignment completion semantics so past-deadline tasks default to completed/struck-through in `Past Assignments`. Unchecking a past assignment now stores an explicit incomplete override, moves it back onto the Home checklist, and shows it with red `Past due` styling; checking it again moves it back into past assignments and updates the count.

### Session 64sm (Move completed assignments into past sheet)
- **`src/screens/HomeScreen.tsx`** — Updated `Past Assignments` to include any completed task, not only tasks whose deadline has passed, so checking an upcoming assignment now removes it from Home and increases the count in the past-assignment sheet. Removed the count from `Past Assignments` buttons and moved the count into the sheet subtitle.

### Session 64sn (Scoreboard-style sports card)
- **`src/screens/HomeScreen.tsx`** — Reworked the compact sports card into a mini scoreboard-style `Sports Events` card with `NEXT UP`, a small sport icon, HOME/AWAY badge, sport name, time, and `+N events` list affordance instead of the plain event-count card.

### Session 64so (Simplify sports summary card)
- **`src/screens/HomeScreen.tsx`** — Removed the `NEXT UP`, sport icon, and HOME/AWAY badge from the compact sports events card, leaving the sport name, time, and `+N events` affordance for a cleaner summary.

### Session 64sp (Allow two-line sports titles)
- **`src/screens/HomeScreen.tsx`** — Changed the compact sports event title from one line to two lines and tightened surrounding spacing so longer sport names do not truncate as aggressively.

### Session 64sq (Enlarge upcoming classes summary)
- **`src/screens/HomeScreen.tsx`** — Increased the Home hero summary headline size for `Coming up` / class-count states so the upcoming classes count reads at the same visual priority as the current-class timer.

### Session 64sr (Fill hero summary with class timeline)
- **`src/screens/HomeScreen.tsx`** — Replaced the sparse summary-class list in the Home hero card with a denser today timeline that shows each upcoming/completed class start time, state label, course code, title, end time, and location. This fills the hero card with useful schedule context instead of leaving large empty areas under the headline.

### Session 64ss (Surface sports going and home-away)
- **`src/screens/HomeScreen.tsx`** — Restored the Home sports event row title to a larger event-list size, removed the small sport icon from the compact row, and surfaced HOME/AWAY plus going count directly on each visible sports event so users can distinguish event status without opening the list.

### Session 64st (Compact hero timeline height)
- **`src/screens/HomeScreen.tsx`** — Prevented AM/PM timeline times from wrapping by rendering the time and meridiem as separate inline pieces, limited hero summary timelines to three visible class rows with a `+N later today` overflow line, tightened row spacing, and removed the summary-card progress bar so the assignments section sits higher on Home.

### Session 64su (Show all hero timeline rows with less detail)
- **`src/screens/HomeScreen.tsx`** — Reopened the hero summary timeline so every class row shows again, removed the `Left today` / `Done today` header label, and dropped the right-side end-time/location detail because the start time already appears in the left column. This keeps the full class list visible while reducing row height and visual noise.

### Session 64sv (Remove hardcoded sports placeholders)
- **`src/screens/HomeScreen.tsx`** — Removed the hardcoded demo sports events and the separate next-two-days sports list state/modal. The Home sports card now uses only the real fetched `sportsEvents` data through `visibleCampusEvents`, showing the first two upcoming events plus a link into the existing full sports events list.

### Session 64sw (Use course color bars in hero timeline)
- **`src/screens/HomeScreen.tsx`** — Replaced the hero timeline's separate colored dot and gray vertical connector with a single colored vertical bar attached to each course row. This makes the color read as the course block marker instead of a disconnected timeline decoration.

### Session 64sx (Add hero timeline divider)
- **`src/screens/HomeScreen.tsx`** — Added an inset one-pixel divider between the hero summary headline/count area and the `Today's timeline` section so the card reads as cleaner grouped sections without the line touching the card edges.

### Session 64sy (Center hero timeline times)
- **`src/screens/HomeScreen.tsx`** — Removed the small `next`/`later`/`done` label beneath hero timeline times, vertically centered the time column against each course row, and slightly increased the timeline time typography so the rows feel cleaner and easier to scan.

### Session 64sz (Tighten hero timeline time gap)
- **`src/screens/HomeScreen.tsx`** — Reduced the hero timeline time column width and row gap so the start time sits closer to the colored course bar.

### Session 64saa (Add hero timeline location pills)
- **`src/screens/HomeScreen.tsx`** — Added a compact location/classroom pill next to each hero timeline course title, using a shortened campus label when the raw location is a city/state campus string. This uses the newly available row space without reintroducing end-time or professor clutter.

### Session 64sab (Show faint assignment check icons)
- **`src/screens/HomeScreen.tsx`** — Added a faint gray checkmark icon inside incomplete assignment checklist buttons on both the Home checklist and Past Assignments sheet so the circular control reads more clearly as a check action.

### Session 64sac (Hide generic campus timeline locations)
- **`src/screens/HomeScreen.tsx`** — Changed hero timeline location pills to hide generic campus/location values such as `Main Campus`, city/state campus strings, `Online`, `Remote`, and `Location TBA`, so only real classroom or building locations appear beside course titles.

### Session 64sad (Stop Cornell campus fallback locations)
- **`scripts/seed-cornell-sections.js`** — Changed Cornell section location seeding to store only meeting-level facility values (`facilityDescr` / `facilityDescrshort`) in `location`. Removed the fallback to `locationDescr` / `campusDescr` because those values represent broad campus labels like `Main Campus`, not classroom buildings.

### Session 64sae (Hide city-state hero locations)
- **`src/screens/HomeScreen.tsx`** — Broadened hero location filtering to hide city/state values such as `Ithaca, NY`, including current-class hero detail text, because those are regional/campus labels rather than classroom buildings.

### Session 64saf (Unify sports more-events CTA)
- **`src/screens/HomeScreen.tsx`** — Changed the Home sports card CTA to always use the `N more event(s)` format instead of switching to `View list` when there are no additional events, so schools like Cornell and UC Irvine use the same sports card language.

### Session 64sag (Assignment due-date push reminders)
- **`src/data/userPreferences.ts`** — Added assignment reminder notification preferences with default lead times of 2 days, 1 day, and 12 hours before each deadline.
- **`src/screens/SettingsScreen.tsx`** — Added an `Assignment Reminders` toggle plus selectable deadline reminder timing chips in Settings > Notifications so users can configure assignment push timing.
- **`App.tsx`** — Extended the reminder scheduler to read cached LMS assignment tasks/completion state from AsyncStorage and schedule local push notifications ahead of future due dates.
- **`src/screens/HomeScreen.tsx`** — Added an assignment-calendar change callback so fetching, loading, disconnecting, or checking assignments triggers notification rescheduling.

### Session 64sah (Canvas feed setup instructions)
- **`src/screens/HomeScreen.tsx`** — Added a Canvas-only instruction card to the assignment calendar setup sheet explaining how to open Canvas, use the top-left menu, go to Settings, tap `Subscribe to Calendar Feed`, and paste the copied link. This helps users find the feed before syncing assignments.

### Session 64sai (Avoid keyboard covering calendar link input)
- **`src/screens/HomeScreen.tsx`** — Wrapped the assignment calendar setup sheet in a `KeyboardAvoidingView` and made the sheet content scrollable. This keeps the LMS feed link input visible and reachable when the phone keyboard opens.

### Session 64saj (Clarify LMS import is for assignments)
- **`src/screens/HomeScreen.tsx`** — Renamed the LMS calendar connection entry points to `Import Assignments`, clarified that the feed imports deadlines only and not class meetings, and updated the Canvas instructions to explicitly start from the Canvas mobile app.

### Session 64sak (Tighten privacy and FERPA-facing legal copy)
- **`src/components/LegalDocumentModal.tsx`** — Updated Terms and Privacy Policy dates and content to match the current app model: user-saved timetables, accepted-friend ClassMates sharing, no official rosters or LMS private records, aggregate/public enrollment counts, LMS feeds for assignment deadlines only, and manually entered grade tracking.
- **`src/screens/SettingsScreen.tsx`** — Clarified timetable visibility wording and Help Center privacy FAQs so shared classes are described as accepted-friend, user-saved timetable comparisons rather than official roster access.

### Session 64sal (Move sports behind Home hero)
- **`src/screens/HomeScreen.tsx`** — Moved the Home sports events summary out of the main feed and into the hero carousel as a hidden sports page. The carousel indicator now uses a small trophy icon for the sports page while the main feed jumps from the hero card directly to assignments, keeping assignment deadlines visually prioritized.

### Session 64sam (Show all classes in Home hero timeline)
- **`src/screens/HomeScreen.tsx`** — Reworked the primary Home hero page to show the total number of classes today instead of separate completed/current/upcoming pages. The `Today's timeline` section now lists every class for the day, with past classes dimmed and greyed out so they read as completed without becoming a separate hero state.

### Session 64san (Abbreviate long school names on Home)
- **`src/data/schools.ts`** — Added `schoolHomeLabel()` so the Home header can use compact school labels for long official names while preserving full names for maps and other lookup contexts.
- **`src/screens/HomeScreen.tsx`** — Switched the Home header school title to `schoolHomeLabel()`, so schools with long names such as UIUC and UMD render as short acronyms instead of truncating.

### Session 64sao (Limit day filters to primary class meetings)
- **`src/screens/CoursePickerScreen.tsx`** — Changed the day filter to match only primary class sections instead of supplemental discussions, labs, recitations, quizzes, tutorials, or activities. When day filters are active, expanded course rows now show only matching primary class meetings so a course no longer appears just because a standalone discussion meets on that day.

### Session 64sap (Sharpen Welcome first impression)
- **`src/screens/WelcomeScreen.tsx`** — Reworked the opening screen from a feature-list onboarding page into a tighter first-impression hero: compact ClassMate badge, logo, `Your campus OS` headline, short emotional value prop, and three small status cards for classes, tasks, and classmates. This reduces copy density and gives the first screen a clearer visual focal point.

### Session 64saq (Update onboarding Today copy)
- **`src/components/FeatureOnboardingScreen.tsx`** — Updated the app tour's Today slide copy and preview card to match the current Home behavior: a full-day class timeline with completed rows dimmed and assignments prioritized below, instead of the old live/current/completed/upcoming class-card carousel wording.

### Session 64sar (Make notification skip accessible)
- **`src/components/FeatureOnboardingScreen.tsx`** — Rebalanced the notification permission step so `Not now` is a full secondary button directly under `Enable Notifications`, with `Back` moved to a smaller text action below. This makes declining notifications feel like a real, reachable choice instead of a hidden tap target.

### Session 64sas (Animate intro logo drawing)
- **`src/components/ClassMateIntroScreen.tsx`** — Replaced the static PNG mark on the short brand intro screen with an animated SVG version: the blue app icon pops in, the white `C` draws itself, the checkmark draws after it, and small colorful bubbles bounce around the mark. This makes the quick transition screen feel more playful and tied to the ClassMate logo.

### Session 64sat (Reframe Welcome around student layer)
- **`src/screens/WelcomeScreen.tsx`** — Rewrote the first-screen headline, subtitle, badge, and three signal cards around the YC positioning: ClassMate starts with real course sections, helps students find classmates through shared classes, and grows into a student-only campus conversation layer. This makes the opening value prop feel less generic and more tied to the product's core insight.

### Session 64sau (Prevent notification buttons from covering content)
- **`src/components/FeatureOnboardingScreen.tsx`** — Removed the oversized notification icon from the notification-permission onboarding step and tightened the benefit cards. This keeps all notification explanation content visible above the large `Enable Notifications` / `Not now` actions on shorter phone screens.

### Session 64sav (Restore approved logo in intro animation)
- **`src/components/ClassMateIntroScreen.tsx`** — Removed the hand-drawn SVG recreation of the ClassMate mark and restored the approved `ClassMateMonogram` PNG as the only logo rendered in the intro animation. The intro now animates the original logo with scale/opacity and surrounding motion effects without altering the logo artwork itself.

### Session 64saw (Simplify Welcome to brand promise)
- **`src/screens/WelcomeScreen.tsx`** — Simplified the first screen to the approved brand-forward message: `ClassMate` with `Make your campus life easier.` Removed the three explanatory signal cards so the opening screen feels cleaner and less like a feature checklist.

### Session 64sax (Fill notification onboarding preview space)
- **`src/components/FeatureOnboardingScreen.tsx`** — Added a compact ClassMate notification preview card beneath the notification benefits and restored safe bottom padding for the notification step. This fills the large empty mid-screen gap without letting the action buttons cover content.

### Session 64say (Reveal approved logo through C/check masks)
- **`src/components/ClassMateIntroScreen.tsx`** — Reworked the intro logo animation so it still uses the approved `classmate-logo-approved.png` asset, but reveals that original image through animated SVG masks: the `C` region appears first, the checkmark appears second, and the full original logo fades in at the end. This gives the requested drawn-C/check effect without recreating or altering the logo artwork.

### Session 64saz (Draw C/check on blue intro icon)
- **`src/components/ClassMateIntroScreen.tsx`** — Replaced the failed image-mask reveal with a direct SVG logo build for the intro animation: the blue rounded app-icon background stays visible, then the white `C` stroke draws in, followed by the blue checkmark stroke. The approved PNG still fades in at the end so the final resting logo matches the actual brand asset.

### Session 64sba (Shrink notification actions)
- **`src/components/FeatureOnboardingScreen.tsx`** — Reduced the notification step action buttons from the default tall onboarding buttons to compact 48px actions, tightened the footer spacing, and changed the notification preview into a single-line sample. This keeps the preview content visible instead of being crowded by oversized bottom controls.

### Session 64sbb (Restore original intro flow)
- **`src/components/ClassMateIntroScreen.tsx`** — Removed the experimental C/check drawing animation and restored the original intro behavior: the approved ClassMate logo scales/fades in, followed by the wordmark and the staggered floating chips. This returns the entrance screen to the cleaner pop-up effect the app had before.

### Session 64sbc (Add Career Board)
- **`src/screens/BoardScreen.tsx`** — Added `Career Board` as a default campus board with a briefcase icon for career, internship, recruiting, major-to-job, and future-planning discussions. Board loading now merges missing default boards into cached or Supabase-provided board catalogs so the Career board appears even if a school's remote board list has not been updated yet.

### Session 64sbd (Add new activity badges)
- **`App.tsx`** — Added bottom-tab badges for new social activity: the Board tab now shows a `NEW` badge when posts have appeared since the user's last board visit, and the ClassMates tab shows the unread message count. The app stores a per-user/per-school board last-seen timestamp in AsyncStorage and refreshes both badges through polling plus Supabase realtime hooks.

### Session 64sbe (Stabilize keyboard sheets)
- **`src/screens/HomeScreen.tsx`** — Constrained the Import Assignments sheet height when the keyboard is visible, added keyboard-aware bottom padding, and scrolls the LMS feed input into view on focus so the sync button and input no longer get pushed behind the keyboard.
- **`src/screens/BoardScreen.tsx`** — Constrained the Request New Board bottom sheet to a keyboard-aware height and added extra scroll padding while typing so the sheet does not leave awkward empty space below or get pushed into the keyboard.

### Session 64sbf (Tune keyboard sheets and home swipe)
- **`src/screens/HomeScreen.tsx`** — Anchored the Import Assignments sheet above the keyboard without relying on KeyboardAvoidingView padding and lowered the hero-card pan thresholds so the class/sports carousel swipes with a lighter drag.
- **`src/screens/BoardScreen.tsx`** — Anchored the Request New Board sheet above the keyboard with explicit keyboard spacing so typing does not push the whole modal into an awkward blank area.

### Session 64sbg (Constrain keyboard sheet scroll areas)
- **`src/screens/HomeScreen.tsx`** — Made the Import Assignments sheet ScrollView fill the fixed keyboard-aware sheet height so the bottom action stays reachable through scrolling.
- **`src/screens/BoardScreen.tsx`** — Made the Request New Board sheet body fill the remaining fixed sheet height so its fields and buttons scroll cleanly above the keyboard.

### Session 64sbh (Add Campus Info hub)
- **`src/screens/HomeScreen.tsx`** — Added a compact `Campus Info` home button that opens a bottom sheet of school-specific official links for dining, transit/shuttle, club directories, and organization registration so secondary campus resources stay out of the main home feed.

### Session 64sbi (Add live UCI dining links)
- **`src/data/uciDining.ts`** — Added a UCI MyDiningHub GraphQL client and hours parser for The Anteatery and Brandywine so the app can show live dining status from the official dining data source instead of static links.
- **`src/screens/HomeScreen.tsx`** — Added a UCI-only `Dining today` home card with separate The Anteatery and Brandywine rows, each opening its own official menu/hours page. Split the UCI Campus Info dining entry into separate Anteatery and Brandywine menu links so tapping dining does not land on a generic page.

### Session 64sbj (Move Campus Info into hero carousel)
- **`src/screens/HomeScreen.tsx`** — Removed the separate home-feed Dining and Campus Info cards. Added `Campus Info` as the hero carousel page after Sports Events, with the first rows linking directly to school resources such as The Anteatery and Brandywine for UCI and a `View all` action opening the full Campus Info sheet.

### Session 64sbk (Group dining hall links)
- **`src/screens/HomeScreen.tsx`** — Changed UCI dining from two separate top-level Campus Info rows into one `Dining Menus` parent block with two nested sub-block links for The Anteatery and Brandywine. Updated both the hero Campus Info card and the full Campus Info sheet so dining reads as one category with two choices.

### Session 64sbl (Add nested dining links for supported schools)
- **`src/screens/HomeScreen.tsx`** — Expanded the Campus Info dining parent block pattern to UMD, Cornell, Purdue, and UIUC using official menu, hours, location, app, and nutrition links where available. Updated nested child buttons to wrap cleanly when a school has three dining sub-links, and kept UCI Brandywine/The Anteatery pointed at the direct MyDiningHub location pages.

### Session 64sbm (Fix Cornell transit link)
- **`src/screens/HomeScreen.tsx`** — Replaced Cornell's App Store-only `Navi` transit link with the browser-friendly TCAT bus schedules page and renamed the card to `TCAT Bus` so the Campus Info shuttle link opens reliably in Safari.

### Session 64sbn (Audit Campus Info links)
- **`src/screens/HomeScreen.tsx`** — Replaced Cornell's TCAT direct schedules link after link-checking showed a 403 response. The Cornell transit card now opens Cornell Facilities and Campus Services' official Bus Services / OmniRide page, which returns 200 and is more reliable inside Safari.

### Session 64sbo (Prepare Campus Info app fallbacks)
- **`src/screens/HomeScreen.tsx`** — Added optional `appUrl` support to Campus Info resources and centralized link opening through `openCampusInfoLink()`. Campus links can now try a native app deep link first and fall back to the existing web URL when the app is unavailable or the deep link fails.

### Session 64sbp (Add Handshake jobs links)
- **`src/screens/HomeScreen.tsx`** — Added a `Jobs` Campus Info block for UCI, UMD, Cornell, Purdue, and UIUC. Each block links to that school's Handshake login plus the general Handshake app/web entry point, keeping career jobs access as a simple handoff instead of an API integration.

### Session 64sbq (Add Student Deals hub)
- **`src/screens/HomeScreen.tsx`** — Added a reusable `Student Deals` Campus Info block for supported and fallback schools. The block links to official student discount hubs and representative student plans such as UNiDAYS, Student Beans, ID.me Student, Apple Education, Amazon Prime Student, Spotify Student, and Adobe Student without maintaining coupon data in-app.

### Session 64sbr (Add verified library links)
- **`src/screens/HomeScreen.tsx`** — Added a school-specific `Library` Campus Info block for UCI, UMD, Cornell, Purdue, and UIUC only. Each verified block links to the school's official library homepage plus its study room / library space reservation page, while fallback schools intentionally do not show a library card unless a real service URL is configured.

### Session 64sbs (Add registration links)
- **`src/screens/HomeScreen.tsx`** — Added a reusable `Registration` Campus Info block and school-specific official registration/enrollment links for UCI WebReg, UMD Testudo, Cornell Student Center, Purdue Registrar registration info, and UIUC Self-Service. Placed it directly after dining so it appears in the home Campus Info preview, and kept registration out of fallback schools so the app only shows this card when a verified school service is configured.

### Session 64sbt (Use US-style time display)
- **`src/data/courses.ts`** — Added shared helpers to parse stored timetable times and render them as 12-hour AM/PM labels while keeping the internal 24-hour format for calculations.
- **`App.tsx`**, **`src/screens/HomeScreen.tsx`**, **`src/screens/TimetableScreen.tsx`**, **`src/screens/CoursePickerScreen.tsx`**, **`src/screens/FriendsScreen.tsx`**, **`src/components/PreviewTimetable.tsx`**, **`src/components/FeatureOnboardingScreen.tsx`**, and **`src/data/messages.ts`** — Updated visible class times, grid hour labels, task/message times, custom course time entry, and onboarding mock schedules to use US-style AM/PM display so students no longer see 13:00/14:00-style timestamps. Custom course creation now accepts AM/PM inputs and stores them back as internal timetable times, including the midnight end-time case. The home timeline time column is right-aligned so AM/PM labels do not wrap while staying close to the colored class bar.

### Session 64sbu (Show all Campus Info categories)
- **`src/screens/HomeScreen.tsx`** — Changed Campus Info into a full category hub that always shows Dining, Registration, Jobs, Library, Transit, Clubs, and Student Deals. Supported schools use their configured official links where available, fallback schools get school-specific search links instead of hiding cards, and each category can be collapsed or expanded from the sheet header.

### Session 64sbv (Simplify registration links)
- **`src/screens/HomeScreen.tsx`** — Removed the extra registration helper/guide child button from the Campus Info Registration card so it only links to the school's registration site. Updated the generic fallback and Purdue label to behave like direct site handoffs instead of explanatory registration help.

### Session 64sbw (Remove Start Org card)
- **`src/screens/HomeScreen.tsx`** — Removed the `Start Org` category from Campus Info for supported and fallback schools so the hub focuses on links students are more likely to use regularly.

### Session 64sbx (Trim Campus Info dining and sports)
- **`src/screens/HomeScreen.tsx`** — Removed the Sports category from Campus Info because sports already has its own home carousel/list surface. Restored useful dining splits where they matter, such as UCI's The Anteatery and Brandywine menu buttons, while removing extra dining links like nutrition/app/order-ahead/carry-out so Dining stays focused on menus.

### Session 64sby (Promote dining menus to home)
- **`src/data/diningMenus.ts`** — Added a school-aware dining menu data layer that fetches today's actual dining items from official UCI, Cornell, Purdue, UIUC, and UMD dining sources instead of treating dining as a generic link handoff.
- **`src/screens/HomeScreen.tsx`** — Removed Dining from Campus Info and added a standalone `Today's Dining` hero carousel page plus full-menu bottom sheet, matching the Sports Events pattern while prioritizing real menu data and dining hall names.

### Session 64sbz (Show full dining menu bullets)
- **`src/screens/HomeScreen.tsx`** — Reworked the `Today's Dining` full-menu sheet so meals and stations render as organized sections with every menu item shown as a bullet point. Removed the item/station slicing and `+N more` summaries so students can scroll through the complete dining menu.
- **`src/data/diningMenus.ts`** — Removed the Cornell dining location cap so the dining feed returns every eatery with menu data instead of summarizing the school to the first eight locations.

### Session 64sca (Add Banner school seeder)
- **`scripts/seed-banner-sections.js`** — Added a reusable Banner / Ellucian StudentRegistrationSsb section seeder for UC Riverside, Northeastern University, Temple University, and Georgia State University so new API-backed schools can be added without scraping HTML.
- **`src/data/schools.ts`** — Registered UC Riverside, Northeastern University, Temple University, and Georgia State University in the university picker with term systems, branding, campus metadata, and default school features.
- **`scripts/backfill-school-sections.js`** — Added the four Banner-backed schools to the multi-school backfill runner and taught the runner to pass seeder-specific argument prefixes.

### Session 64scb (Validate Banner seeder output)
- **`scripts/seed-banner-sections.js`** — Fixed the department-name fallback expression, excluded Northeastern CPS Quarter terms from the Northeastern semester seeding path, and normalized verbose Banner section labels like `Base Lecture` / `Lecture and Lab` into compact ClassMate labels.

### Session 64scc (Simplify dining hero rows)
- **`src/screens/HomeScreen.tsx`** — Removed the small meal/today subtitle and right-side item-count badge from the `Today's Dining` hero rows so dining hall names like The Anteatery read cleaner on the home carousel.

### Session 64scd (Clarify dining station labels)
- **`src/screens/HomeScreen.tsx`** — Added a dining station display fallback so cached or source-provided generic `Menu` labels render as `Station 1`, `Station 2`, etc. in the full dining menu sheet.
- **`src/data/diningMenus.ts`** — Replaced generic dining station fallback names from `Menu` to numbered station labels across UCI, Cornell, Purdue, UIUC, and UMD menu normalization.

### Session 64sce (Simplify jobs links)
- **`src/screens/HomeScreen.tsx`** — Replaced the separate `App` button in Campus Info Jobs with a single `Handshake` link that uses Handshake job-search universal links, so installed users can open the app while others fall back to web. Added a `LinkedIn` jobs link beside Handshake for supported and fallback schools.

### Session 64scf (Add push announcement script)
- **`scripts/send-push-announcement.js`** — Added a dry-run-by-default Expo push broadcast helper that targets users with stored Expo tokens and enabled push notifications. The script requires `--send` before delivering a one-off announcement and clears invalid Expo tokens reported by Expo.

### Session 64scg (Add class hero icon)
- **`src/screens/HomeScreen.tsx`** — Added a compact calendar/check icon badge to the home class summary hero cards so the today's-classes card visually matches the sports, dining, and campus info carousel cards.

### Session 64sch (Full parity for Banner schools)
- **`scripts/seed-banner-sections.js`** — Made Banner seeding sequential by default, filtered search results by the requested subject code, and excluded Northeastern CPS/Law terms so long historical backfills cannot accidentally save cached or non-main-campus results.
- **`scripts/backfill-school-sections.js`** — Accepted either `SUPABASE_SERVICE_KEY` or `SUPABASE_SERVICE_ROLE_KEY` for backfills so the same command works with common Supabase secret naming.
- **`src/data/schools.ts`** — Enabled sports feeds for UC Riverside, Northeastern University, Temple University, and Georgia State University using their athletics calendar pages so the home sports carousel works like the existing schools.
- **`src/screens/HomeScreen.tsx`** — Added official Campus Info resources for UC Riverside, Northeastern, Temple, and Georgia State, including registration, jobs, library, transit, clubs, and student deals so the new schools match the existing Campus Info feature set.

### Session 64sci (Audit UCI classroom map aliases)
- **`src/data/campusLocations.ts`** — Corrected the Social Science Lab / Social Science Lecture Hall split, added missing `SSH` and `SS1`/`SS2` classroom aliases, and kept room-code matching aligned with UCI Classroom Technologies building names so course detail map previews point to the right campus buildings.

### Session 64scj (Automate course section seeding)
- **`.github/workflows/seed-course-sections.yml`** — Added a scheduled/manual GitHub Actions workflow that installs dependencies and runs `scripts/backfill-school-sections.js` against the current catalog year by default using Supabase secrets, with manual inputs for school/year/term backfills. This lets backend course data refresh automatically instead of requiring a local terminal command with service keys.

### Session 64sck (Seed next-year sections early)
- **`.github/workflows/seed-course-sections.yml`** — Split the seeding workflow into mandatory current-year scheduled seeding plus best-effort next-year scheduled seeding. Manual runs now default to current year through next year, so newly published future-term SOC data can be pulled into Supabase as soon as school APIs expose it.

### Session 64scl (Include UCI in scheduled seeding)
- **`.github/workflows/seed-course-sections.yml`** — Added optional scheduled UCI seeding for Winter, Spring, and Fall of the current and next year when `ANTEATER_API_KEY` is configured. The workflow now runs twice daily so newly published SOC data lands in Supabase quickly while safely skipping UCI when the Anteater API secret is absent.

### Session 64scm (Extend dining and grade parity)
- **`src/data/diningMenus.ts`** — Added official menu feed support for UC Riverside via FoodPro, Temple via MyDiningHub, and Georgia State via Nutrislice so new Banner-backed schools can show the same standalone `Today's Dining` home surface when real dining data exists. Generalized the MyDiningHub fetcher shared by UCI and Temple and changed generic single-station fallbacks to `Items` for clearer menu labels.
- **`src/screens/HomeScreen.tsx`** — Changed generic dining station display text from numbered station placeholders to `Items` so dining sheets do not imply a real station name when the source feed only exposes a flat menu.
- **`src/components/ReviewsModal.tsx`** — Clarified grade distribution availability by hiding professor filters for schools without an official grade-distribution feed and explaining that personal Grades/GPA tracking still works even when official distribution charts are not connected.

### Session 64scn (Add UCR university logo)
- **`assets/ucr-logo-white-bg.png`** and **`assets/ucr-logo-white-bg.svg`** — Added a white-background UC Riverside logo asset matching the university picker treatment used by the other schools.
- **`src/components/UniversityLogo.tsx`** — Mapped the `ucr` school id to the new UCR logo asset so UC Riverside no longer falls back to the text badge in the school selection screen.

### Session 64sco (Add Northeastern university logo)
- **`assets/northeastern-logo-white-bg.png`** and **`assets/northeastern-logo-white-bg.svg`** — Added a white-background Northeastern University logo asset so the school picker can show the real mark instead of initials.
- **`src/components/UniversityLogo.tsx`** — Mapped the `northeastern` school id to the new logo asset, matching the existing logo rendering path for other supported schools.

### Session 64scp (Add Temple university logo)
- **`assets/temple-logo-white-bg.png`** and **`assets/temple-logo-white-bg.svg`** — Added a white-background Temple University logo asset so the school picker uses the real Temple mark.
- **`src/components/UniversityLogo.tsx`** — Mapped the `temple` school id to the new logo asset, replacing the initials fallback in university selection.

### Session 64scq (Add Georgia State university logo)
- **`assets/gsu-logo-white-bg.png`** and **`assets/gsu-logo-white-bg.svg`** — Added a white-background Georgia State University logo asset so the school picker shows the real GSU mark.
- **`src/components/UniversityLogo.tsx`** — Mapped the `gsu` school id to the new logo asset, replacing the initials fallback in university selection.

### Session 64scs (Replace recreated school logos with source assets)
- **`assets/ucr-logo-white-bg.png`**, **`assets/ucr-logo-white-bg.svg`**, **`assets/northeastern-logo-white-bg.png`**, **`assets/northeastern-logo-white-bg.svg`**, **`assets/temple-logo-white-bg.png`**, **`assets/temple-logo-white-bg.svg`**, **`assets/gsu-logo-white-bg.png`**, and **`assets/gsu-logo-white-bg.svg`** — Replaced the hand-recreated logo artwork with source logo assets so the school picker displays the real marks without distorted or clipped custom redraws.

### Session 64scr (Expand multi-school classroom maps)
- **`src/data/campusLocations.ts`** — Added high-volume classroom building mappings for Cornell, University of Maryland, UIUC, and Northeastern from seeded section unmapped reports, and corrected UCI social-science/student-services aliases. This expands in-app course map previews beyond UCI while keeping ambiguous locations on external Maps fallback.

### Session 64scx (Fill UCR/Purdue classroom map gaps)
- **`src/data/campusLocations.ts`** — Added high-volume UC Riverside and Purdue classroom building mappings after the audit showed UCR had seeded sections but no in-app classroom map coverage. Exported `isUnmappableLocation()` and broadened generic-location handling for values like `NO`, `Boston`, and `Riverside`.
- **`src/screens/TimetableScreen.tsx`** — Reused `isUnmappableLocation()` before showing map actions so generic placeholders no longer open weak campus/city map searches.
- **`scripts/report-unmapped-classrooms.js`** — Mirrored the generic-location skip list so mapping reports focus on real building candidates instead of placeholders.

### Session 64scy (Second-pass classroom map audit)
- **`src/data/campusLocations.ts`** — Added second-pass high-volume building aliases for Purdue, UC Riverside, and Northeastern, including Purdue REC/DUDL/POTR/RHPH, UCR ARTS/SPTH/INTN/LFSC/SCLAB, and Northeastern EXP/ISEC/EV/INV. Expanded generic placeholder detection for `NO ...` and `BOS ...` prefixes.
- **`scripts/report-unmapped-classrooms.js`** — Kept the audit script's placeholder filtering in sync with app-side mapping logic so validation numbers do not count non-building prefixes as missed classroom mappings.

### Session 64sct (Fit Temple logo in school picker)
- **`src/components/UniversityLogo.tsx`** — Kept the source Temple logo asset unchanged and adjusted only the rendered image box for square school logos so the Temple mark appears larger in the university selection row without clipping or redrawing the logo.

### Session 64scu (Center Georgia State logo)
- **`src/components/UniversityLogo.tsx`** — Added a small render-only horizontal offset for the `gsu` logo so the source Georgia State mark sits more centered in the university selection logo slot without modifying the logo asset.

### Session 64scv (Enlarge Georgia State logo)
- **`src/components/UniversityLogo.tsx`** — Replaced the GSU horizontal offset with a larger render-only image box so the source Georgia State logo appears centered and legible in the university selection row without changing the logo asset.

### Session 64scw (Use Temple wordmark logo)
- **`assets/temple-logo-white-bg.png`** and **`assets/temple-logo-white-bg.svg`** — Replaced the Temple T-only mark with the source Temple University wordmark so the school picker logo includes readable Temple text.
- **`src/components/UniversityLogo.tsx`** — Removed the Temple square-logo render override so the full wordmark can use the existing logo slot instead of being squeezed into an icon box.

### Session 64scx (Keep full GSU department list)
- **`src/screens/CoursePickerScreen.tsx`** — Fixed department loading so an authoritative `school_departments` list is not overwritten by the selected term's partial section departments. This restores the full Georgia State department list when a currently selected term only has a small subset of seeded sections.

### Session 64scz (Normalize multi-school course display)
- **`src/screens/CoursePickerScreen.tsx`** — Added display normalization for Supabase-backed course rows so all-caps catalog titles render in title case, `None`/blank/arranged meeting days show as `TBA`, course numbers are parsed more safely from multi-school codes, and section rows show a readable CRN/section id instead of internal source-prefixed IDs. This keeps newly seeded schools from looking oddly formatted in the course picker.

### Session 64sdb (Hide empty departments for selected term)
- **`src/screens/CoursePickerScreen.tsx`** — Changed department loading to scan the selected term's actual `sections` rows before trusting `school_departments`, then show only departments with real sections for that term when any exist. This prevents Temple and other newly seeded schools from showing departments whose metadata exists but whose section rows are missing for the selected term.

### Session 64sda (Fix Temple sports and dining feeds)
- **`src/data/schools.ts`** — Switched Temple Athletics from the old Sidearm page-component parser to the official `responsive-calendar.ashx` JSON feed so home sports events load from the current Owls calendar.
- **`src/data/diningMenus.ts`** — Added Temple MyDiningHub meal-period GraphQL variables (`mealPeriod` + `DAILY` view) and fetches Breakfast/Lunch/Brunch/Dinner separately, because Temple's current menu API returns `null` without those parameters even on days with published menus.

### Session 64sdc (Audit new-school sports dining and links)
- **`src/data/schools.ts`** — Switched UC Riverside, Northeastern, and Georgia State Athletics to the same Sidearm `responsive-calendar.ashx` JSON feed path used by Temple so the home sports carousel does not depend on brittle calendar-page scraping.
- **`src/data/diningMenus.ts`** — Added Northeastern University to supported dining schools with an official NU Dining menu fallback link, because the Dine On Campus API is Cloudflare-protected outside the browser but the official menu page is reachable.
- **`src/screens/HomeScreen.tsx`** — Replaced broken new-school Campus Info links for UCR transit, Northeastern clubs, Temple study rooms, Temple transportation, and Temple clubs with verified live official URLs; added an official menu button to dining detail cards so fallback/external dining sources can still be opened directly.

### Session 64sdd (Audit multi-school section coverage)
- **`scripts/reconcile-school-terms.js`** — Added UC Riverside, Northeastern, Temple, and Georgia State to the school-term reconciliation script and changed reconciliation to count distinct departments from actual `sections` rows. This lets post-backfill metadata reflect real section coverage for the newly added Banner schools instead of stale department metadata.

### Session 64sde (GSU live course fallback)
- **`src/screens/CoursePickerScreen.tsx`** — Added a Georgia State Banner fallback for selected departments, including term-code resolution, Banner session setup, paginated section fetching, and normalization into the existing catalog row shape. When Supabase is missing a selected GSU department's current sections, the course picker now merges live GSU Banner rows so departments like ACCT/CSC can still show courses.

### Session 64sdf (Speed up GSU course loading)
- **`src/screens/CoursePickerScreen.tsx`** — Optimized the Georgia State Banner fallback so live Banner fetches run only for selected departments missing from Supabase, rather than every selected department. Added an in-memory Banner row cache keyed by school/term/department so repeated GSU department selections load immediately after the first fetch.

### Session 64sdg (Unify new-school course loading)
- **`src/data/schoolDepartments.ts`** — Added local department fallback lists for UC Riverside, Northeastern, Temple, and Georgia State so newly added schools show departments immediately like UCI, UMD, Cornell, Purdue, and UIUC instead of waiting on the first Supabase round trip.
- **`src/screens/CoursePickerScreen.tsx`** — Generalized the live missing-section fallback from Georgia State only to all Banner-backed schools (`ucr`, `northeastern`, `temple`, `gsu`) with shared term lookup, session setup, pagination, row normalization, and caching. Banner fallback now runs only for selected departments missing from Supabase, keeping normal Supabase-backed course loading fast and consistent across schools.

### Session 64sdh (Hard-audit school parity)
- **`src/data/schools.ts`** — Fixed quarter-school current-term resolution so schools with a plain `Summer` term, such as UC Riverside, no longer default to UCI's `Summer10wk` term during summer months.
- **`src/data/campusLocations.ts`** and **`scripts/report-unmapped-classrooms.js`** — Expanded generic/unmappable location filtering for Temple and Georgia State placeholders like `Main`, `Health Sciences`, `NAPPL`, `Atlanta`, `ARRNGD`, Japan/Rome abroad-campus labels, and hyphenated off-campus labels so map actions do not launch weak campus-wide searches.
- **`scripts/audit-school-parity.js`** — Added a static parity audit that checks every supported school for department fallbacks, logo assets, dining branches, campus-info resources, sports feeds, Banner fallback/seeder sync, backfill registration, and term reconciliation coverage.
- **`package.json`** — Added `npm run audit:schools` so the multi-school parity check can be rerun before/after adding another university.

### Session 64sdi (Clarify course loading state)
- **`src/screens/CoursePickerScreen.tsx`** — Replaced the ambiguous `Courses will appear here` empty text with an explicit loading card, spinner, and term/category-aware message while selected departments or global search results are being fetched. This makes slower newly added schools show visible progress instead of looking empty.

### Session 64sdj (Privacy update acknowledgment)
- **`src/data/legal.ts`** — Added current terms/privacy version constants plus a helper for checking whether the signed-in user has accepted the latest legal documents.
- **`src/components/LegalDocumentModal.tsx`** — Updated the legal document effective date and tightened privacy/security wording around LMS data, private course files, and privacy-by-default sharing.
- **`src/data/userPreferences.ts`** — Added `legalAcknowledgment` to persisted settings and changed the default timetable visibility to `private` so new users share less by default.
- **`App.tsx`** — Loaded/saved legal acknowledgment data inside `user_settings.profile_details` and passed a home-screen acknowledgment callback for updated terms/privacy versions.
- **`src/screens/HomeScreen.tsx`** — Added a compact home-screen privacy update card with Terms/Privacy links and one-tap checked acceptance so users can acknowledge future legal updates without leaving Home.

### Session 64sdk (Keep GSU dining visible)
- **`src/data/diningMenus.ts`** — Added a reusable official-menu fallback and returns a Georgia State Dining link when Nutrislice is reachable but today's GSU meal feeds contain no menu items. This keeps the Home dining card visible instead of disappearing on empty-menu days.

### Session 64sdl (Add public Banner-backed schools)
- **`src/data/schools.ts`** — Added Georgia Tech, West Virginia, Sam Houston State, Denison, UNC Greensboro, Eastern Illinois, North Georgia, Alfred State, Canisius, Genesee, Utah Valley, Lehigh, Rider, and Wheaton College (Massachusetts) as supported universities using public class-search data. Also made semester current-term selection avoid unsupported summer terms for schools that only expose Spring/Fall.
- **`src/data/schoolDepartments.ts`** — Added empty fallback entries for the new schools so the parity audit recognizes them while Course Picker can load their public Banner subjects live.
- **`src/screens/CoursePickerScreen.tsx`** — Added public Banner fallback configs for the new schools, live subject-list loading from public `get_subject`, and stricter Summer1/Summer2 term matching so unseeded schools can still show department/course data from their public Banner search.
- **`scripts/seed-banner-sections.js`** — Added public Banner seeder configs for the new schools, including Utah Valley non-credit term filtering and Summer1/Summer2 matching for Rider-style split summer terms.
- **`scripts/backfill-school-sections.js`** — Registered the new Banner-backed schools in the multi-school backfill runner so seeded section data can be populated with the existing workflow.
- **`scripts/reconcile-school-terms.js`** — Added the new schools to term reconciliation so `school_terms` can be rebuilt from seeded sections.
- **`scripts/audit-school-parity.js`** — Relaxed logo, dining, and campus-info checks to allow explicit app fallbacks for newly supported public-catalog schools without blocking the school parity audit.

### Session 64sdm (Connect new-school home links)
- **`src/data/diningMenus.ts`** — Added official dining-menu fallback configs for the 14 newly supported public Banner schools so their Home dining card opens a real public dining page even when no structured menu API is available.
- **`src/data/schools.ts`** — Added athletics feeds for the new schools where a public Sidearm JSON feed is available, and added Georgia Tech schedule-page sports coverage using the public RamblinWreck schedule pages.
- **`src/data/sportsEvents.ts`** — Added a `wmt-table` schedule parser for Georgia Tech-style WMT schedule pages so sports cards can parse the actual rendered schedule table instead of returning empty results.
- **`src/screens/HomeScreen.tsx`** — Added standardized Campus Info resources for every newly added school, including class search, jobs, library/study rooms, transportation, clubs, athletics, and student deals links.
- **`scripts/audit-school-parity.js`** — Updated the parity audit to recognize centralized external dining fallbacks and standardized campus-info resources so future audits catch real omissions without flagging intentional link-backed support.

### Session 64sdn (Audit multi-school feature parity)
- **`src/screens/SettingsScreen.tsx`** — Replaced stale hardcoded supported-school help copy with a dynamic `SUPPORTED_UNIVERSITIES.length` count so the Help Center reflects the current school list.
- **`src/data/diningMenus.ts`** — Replaced broken new-school dining fallback URLs for Georgia Tech, Denison, North Georgia, Alfred State, Canisius, Genesee, and Lehigh with verified public official dining pages.
- **`src/screens/HomeScreen.tsx`** — Replaced broken Campus Info links for Georgia Tech, Sam Houston, Denison, UNCG, EIU, Alfred State, Canisius, Genesee, UVU, Lehigh, Rider, and Wheaton with verified public official pages; also fixed Georgia Tech athletics so it no longer redirects to the sports-medicine page.
- **`scripts/audit-school-parity.js`** — Added stronger school parity checks for email domains, term lists, grade scales, dynamic Settings copy, and known-bad dining/Campus Info URLs so regressions are caught by `npm run audit:schools`.

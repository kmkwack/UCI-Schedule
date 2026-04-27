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

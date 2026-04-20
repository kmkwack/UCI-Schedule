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

---

## Changelog

### Session 1
- **`src/data/courses.ts`** — Created. Replaced static fake course data with proper types: `Course` (id is now `string` sectionCode), `Quarter`, `QUARTERS`, `UCI_DEPARTMENTS` (140+ departments from WebSoc), `colorForDepartment()`, `quarterKey()`, `quarterLabel()`.
- **`App.tsx`** — Replaced `addedCourses: number[]` with `timetables: Record<string, Course[]>` + `selectedQuarter: Quarter`. Each quarter has its own independent course list. `handleToggleCourse` now takes full `Course` object.
- **`src/screens/TimetableScreen.tsx`** — Added horizontal quarter picker scroll at the top. Now receives `activeCourses: Course[]` directly instead of resolving IDs against static data. Uses `colorForDepartment()` for timetable block colors.
- **`src/screens/CoursePickerScreen.tsx`** — Full rewrite. Replaced static course list with live Anteater API integration. Two-step flow: department dropdown → catalog fetch → per-course section fetch. Added time normalization (`normalizeApiTime`), section-to-Course mapping, conflict detection, department bottom-sheet modal with search, course number sorting, pre-fetching + filtering of courses with no sections.
- **`src/screens/HomeScreen.tsx`** — Removed static `courses` import. Now receives `activeCourses: Course[]` directly.
- **`src/screens/GradesScreen.tsx`** — Removed static `courses` import. Now receives `activeCourses: Course[]`. Grade state key changed from `number` to `string`.
- **`src/components/PreviewTimetable.tsx`** — Updated `colorForCourse` to use `colorForDepartment()` from `courses.ts`.
- **`UCI_DEPARTMENTS`** — Expanded from ~60 to 140+ departments matching WebSoc exactly. Added EECS, COGS, DATA, CBE, ENGRCEE, ENGRMAE, and many others.
- **Course sorting** — `filteredCatalog` in `CoursePickerScreen` now sorts by numeric course number first (so `10C` appears before `100B`), then by letter suffix.
- **Department selector** — Replaced horizontal chip scroll with a searchable bottom-sheet modal dropdown.

### Session 2
- **`src/screens/CoursePickerScreen.tsx`** — Sections within an expanded course are now sorted by `sectionNum` (e.g. A1 before A2) using `localeCompare` with `numeric: true`, so discussion/lab sections display in the correct ascending order.

### Session 3
- **`src/screens/CoursePickerScreen.tsx`** — Fixed missing courses (especially numbered 1–99 and 200+). Root cause: firing 100+ parallel `enrollmentHistory` requests at once overwhelmed the API, causing many to fail silently and those courses to be incorrectly filtered out. Fix: replaced `Promise.all` over all courses with a batched loop (`BATCH_SIZE = 6`), processing 6 courses at a time so the API is not overwhelmed.
- **`src/screens/CoursePickerScreen.tsx`** — Switched from `enrollmentHistory` (N batched calls) to `GET /v2/rest/websoc?department=X&year=Y&quarter=Z` (single call). This is the same endpoint AntAlmanac uses. Returns all courses and sections in one hierarchical response (schools → departments → courses → sections). Removed `enrollmentHistory` batching entirely. Updated types: `ApiCourse`/`ApiSection` → `CatalogCourse`/`WebsocSection`/`WebsocCourse`. Updated time formatting: `normalizeApiTime()` → `formatWebsocTime()` (uses `{ hour, minute }` objects from the websoc response, already 24hr). `sectionsMap` now stores pre-mapped `Course[]` instead of raw section objects. Cancelled sections (`isCancelled: true`) are filtered out automatically.
- **`src/screens/CoursePickerScreen.tsx`** — Fixed duplicate key error (e.g. `EECS195`, `EECS298`). Root cause: the websoc response can list the same course under multiple schools in its hierarchy. Fix: replaced `newCatalog[]` array with a `catalogMap` keyed by `courseId`. On duplicate, sections are merged (deduped by `sectionCode`) instead of creating a second catalog entry.

### Session 4
- **`src/data/courses.ts`** — Removed past quarters (Fall 2024, Winter 2025, Spring 2025) from `QUARTERS`. Remaining quarters start from Fall 2025.
- **`src/screens/TimetableScreen.tsx`** — Replaced horizontal quarter-chip scroll with a compact top-right dropdown button showing the current quarter. Tapping it opens a Modal overlay with all quarters listed; active quarter is highlighted with a checkmark. "Add Class" button moved inline next to the quarter picker. Timetable grid now shows immediately below without the chip row taking vertical space.

### Session 5
- **`src/screens/FriendsScreen.tsx`** — Created. New Friends tab with two views: (1) friends list showing name, course count, and a delete button; (2) friend timetable view with the same weekly grid as TimetableScreen plus a quarter dropdown and "Add" button that opens CoursePickerScreen for that friend. "Add Friend" opens a modal with a name input. All state is in-memory (no persistence yet).
- **`App.tsx`** — Added `'friends'` to the tab type, imported `FriendsScreen`, rendered it at `currentTab === 'friends'`, and added a "Friends" tab item with `people-outline` icon.

### Session 6
- **`src/data/courses.ts`** — Added optional `sectionLabel?: string` field to the `Course` type to carry human-readable section info (e.g. "Lec A", "Dis A1").
- **`src/screens/CoursePickerScreen.tsx`** — `mapWebsocSection` now populates `sectionLabel` as `"${sectionType} ${sectionNum}"` from the API response. Section rows in the picker now display `sectionLabel` (e.g. "Lec A", "Dis A1") instead of the raw section code number.

### Session 7
- **`src/screens/CoursePickerScreen.tsx`** — Added `sortSections()` to sort raw `WebsocSection[]` before mapping: first by type (Lec → Dis → Lab → other), then by letter prefix of `sectionNum` (A, B, C…), then by numeric suffix (1, 2, 3…). Applied before `mapWebsocSection` in the websoc response handler.
- **`src/screens/CoursePickerScreen.tsx`** — Section row title now shows `"12345 · Lec A"` (code + label). Row order changed to: code/label → professor → units → building → days/time. Units formatted as `"1 unit"` / `"4 units"`.
- **`src/screens/CoursePickerScreen.tsx`** — Added `formatLocation()`: maps `"VRTL REMOTE"` and `"ON LINE"` building strings to `"Online"` in the section display.

### Session 8
- **`src/screens/CoursePickerScreen.tsx`** — Extended `filteredCatalog` search to also match full course codes (e.g. `"ECON 100A"`) and professor names (checks all sections in `sectionsMap` for a professor match). Added `sectionsMap` to the `useMemo` dependency array. Updated search placeholder text.

### Session 9
- **`App.tsx`** — Added `focusedCourseId` state and threaded it between the course picker and timetable so the app can remember which class should be centered in the timetable after user interaction.
- **`src/screens/CoursePickerScreen.tsx`** — When a section is added, the picker now marks that course as the next timetable focus target. Removing a section clears the pending focus target.
- **`src/screens/TimetableScreen.tsx`** — Made timetable blocks tappable and added automatic scroll-to-center behavior for the selected/newly added course by wiring horizontal and vertical scroll positioning to the focused course id.

### Session 10
- **`src/screens/CoursePickerScreen.tsx`** — After a successful `Add` action, the course picker now closes immediately so the user returns to the timetable and can see the automatic scroll-to-focused-course behavior. The same applies after confirming a conflict replacement.

### Session 11
- **`src/screens/CoursePickerScreen.tsx`** — Changed the `Add` flow so the course picker stays open. After adding a section, the top preview timetable now keeps that section as the active preview target, so the visible timetable in the picker scrolls to the added class instead of closing the screen.

### Session 12
- **`src/components/PreviewTimetable.tsx`** — Aligned the preview timetable’s grid sizing with `TimetableScreen` so weekday columns use the same width calculation and Friday no longer gets clipped. Removed the preview-only minimum day width that was forcing unnecessary horizontal overflow.
- **`src/components/PreviewTimetable.tsx`** — Excluded `TBA` courses from preview grid math and changed rendered course labels to use `course.code`, making the course-picker preview look closer to the main timetable instead of shifting to a different visual structure.

### Session 13
- **`App.tsx`** — Changed the course picker from a hard content swap to an animated overlay. It now slides up from the bottom on open and slides back down on close using `Animated` + `translateY`.
- **`src/components/PreviewTimetable.tsx`** — Added optional background tap handling on the timetable grid so tapping empty space in the preview can dismiss the course picker without interfering with course blocks.
- **`src/screens/CoursePickerScreen.tsx`** — Wired the preview timetable’s empty-space tap to `onClose`, so users can close the picker by tapping a blank area in the timetable preview.

### Session 14
- **`App.tsx`** — Reworked the main timetable’s course picker into a half-height bottom sheet instead of a full-screen overlay. The real timetable now stays visible behind it while the picker slides up from the bottom.
- **`src/screens/CoursePickerScreen.tsx`** — Added `sheetMode` so the picker can render as a compact bottom sheet with just the search/department/course list area, while still keeping the full-screen version for other flows.
- **`src/screens/TimetableScreen.tsx`** — Added optional empty-grid tap handling on the real timetable, allowing users to dismiss the half sheet by tapping a blank part of the visible timetable behind it.

### Session 15
- **`App.tsx`** — Fixed the bottom-sheet overlay container to span the full screen with explicit `top: 0` and overlay stacking, so the half-sheet picker actually appears above the timetable when `+ Add` is tapped.

### Session 16
- **`App.tsx`** — Added explicit close interactions for the main timetable bottom sheet: tapping the visible timetable area above the sheet now dismisses it, and dragging the sheet handle downward closes it once the gesture passes a threshold.
- **`src/screens/CoursePickerScreen.tsx`** — Added support for sheet handle pan handlers so the compact picker can participate in drag-to-close gestures without changing its full-screen mode behavior.

### Session 17
- **`src/screens/TimetableScreen.tsx`** — Reduced the day-header row’s left spacer and slightly lowered the hour-label offset so the first time label (`08:00`) is no longer clipped at the top while keeping the weekday tabs aligned with the timetable grid.

### Session 18
- **`App.tsx`** — Reverted the main timetable picker from the experimental half-sheet back to the full-screen animated overlay, restoring the previous interaction model where the course picker has its own dedicated preview timetable.
- **`src/screens/CoursePickerScreen.tsx`** — Removed the temporary sheet-only mode and restored the original full-screen picker layout with the built-in preview timetable at the top.
- **`src/screens/TimetableScreen.tsx`** — Removed the temporary empty-grid dismissal hook that was only needed for the half-sheet experiment.

### Session 19
- **`App.tsx`** — Removed a stale `pickerSheetHeight` reference from the picker animation effect dependencies after reverting the half-sheet experiment. This fixes the runtime error complaining that `pickerSheetHeight` does not exist.

### Session 20
- **`src/screens/TimetableScreen.tsx`** — Removed the trailing rightmost vertical grid line by skipping the right border on the last day column, matching the left side of the timetable.
- **`src/components/PreviewTimetable.tsx`** — Applied the same last-column border rule to the course-picker preview timetable so its grid matches the main timetable.

### Session 21
- **`src/screens/TimetableScreen.tsx`** — Removed the time text from course blocks so the timetable cards now show only the course code and professor.
- **`src/screens/FriendsScreen.tsx`** — Applied the same course-block text simplification to the friend timetable view for consistency with the main timetable.

### Session 22
- **`src/screens/TimetableScreen.tsx`** — Increased the timetable grid height slightly so each hour row has a bit more vertical space.
- **`src/screens/FriendsScreen.tsx`** — Matched the main timetable’s slightly taller hour spacing in the friend timetable view.
- **`src/components/PreviewTimetable.tsx`** — Increased preview hour height slightly so the course-picker mini timetable stays visually aligned with the more spacious main timetable.

### Session 23
- **`src/screens/TimetableScreen.tsx`** — Changed course-code rendering so the department stays on the first line and the numeric course identifier moves to the second line inside timetable blocks.
- **`src/screens/FriendsScreen.tsx`** — Applied the same two-line course-code formatting to friend timetable blocks.
- **`src/components/PreviewTimetable.tsx`** — Matched the preview timetable’s course-code formatting so preview cards also render the numeric portion on the second line.

### Session 24
- **`src/lib/supabase.ts`** — Created. Supabase client configured with project URL and publishable key. Uses AsyncStorage for session persistence.
- **`src/data/courses.ts`** — Added `Timetable` type (`id`, `name`, `quarterKey`, `courses[]`) to support multiple named timetables per quarter.
- **`App.tsx`** — Replaced `timetables: Record<string, Course[]>` with `timetables: Timetable[]` + `selectedTimetableId`. Added Supabase load on mount (`guest` user), `saveTimetable()` upsert, `createTimetable()` insert. `handleToggleCourse` now auto-creates a timetable if none exists for the quarter. Quarter change auto-selects the first timetable for the new quarter. New props passed to TimetableScreen: `quarterTimetables`, `activeTimetableId`, `onSelectTimetable`, `onCreateTimetable`.
- **`src/screens/TimetableScreen.tsx`** — Added timetable switcher row below the header: named pill tabs for each timetable in the current quarter, plus a `+ New` button to create additional ones.

### Session 25
- **`src/screens/FriendsScreen.tsx`** — Redesigned friends list to match Figma: white background, search bar, Friends/Requests tab switcher, new friend row layout (blue circle avatar with 2-letter initials, name + major•year subtitle, Timetable pill button, send circle button, separator lines). Added `major` and `year` fields to `Friend` type. Add friend modal now includes major and year inputs. `getInitials()` helper extracts first+last initials from name.
- **`App.tsx`** — Added `'board'` tab between Grades and Friends. Updated tab icons: Grades uses `school-outline`, Board uses `clipboard-outline`, Friends uses `person-add-outline`.
- **`src/screens/BoardScreen.tsx`** — Created. Community board with search bar, category filter chips (All/Sports/Study Groups/Marketplace/Club Promotions), Recent/Popular sort toggle, and mock post cards. Each post shows avatar with initials, name/role/time, category tag, title, body, and tappable like/comment counts.

### Session 26
### Session 27
- **`src/screens/WelcomeScreen.tsx`** — Created. Landing screen with blue calendar app icon + purple book badge, "Welcome to UniTrack" title, Sign In and Create Account buttons, guest shortcut buttons (guest/guest2/guest3/guest4), and Terms footer.
- **`src/screens/SignInScreen.tsx`** — Created. Sign in form with email + password inputs (with icons), password visibility toggle, remember me checkbox, Forgot password link, Sign In button, OR divider, Continue with Google button, and Sign up link. Sign-in is a placeholder (no real Supabase auth yet).
- **`App.tsx`** — Added `userId` and `authScreen` state. App shows WelcomeScreen or SignInScreen when not logged in. Guest buttons set `userId` directly and skip auth. `USER_ID` is now derived from state instead of hardcoded. Timetable load now only triggers when `userId` is set.

- **`src/screens/HomeScreen.tsx`** — Full redesign to match Figma.

### Session 28
- **`src/screens/GradesScreen.tsx`** — Full redesign. Stats row (GPA/Credits/Courses). Animated GPA trend chart: line draws left-to-right on mount using a ClipPath whose width is driven by an `Animated.Value` listener updating React state. Smooth bezier curve via cubic control points. Current quarter courses show grade badge (tap to pick) or "Select Grade" button; grade picker is a bottom-sheet modal. Past Semesters section with collapsible semester cards (LayoutAnimation expand/collapse). GPA is computed from all graded courses weighted by credits. New sections: (1) Header with date + week number (computed from Spring 2026 quarter start Mar 30); (2) "Your Day" card with class count, rotating quote, and "Coming Up" next class with left accent bar; (3) Weather card with indigo tinted background, large temp, cloud icon; (4) Campus Events card with icon badges, event title/time/location, separator lines. Removed old briefing text, stat grid, and quick action buttons.

### Session 29 (Figma compatibility update)
- **`src/screens/SignUpScreen.tsx`** — Created. New Create Account screen ported from Figma (`figma_design/src/app/components/Signup.tsx`). Full name, email, password, confirm password fields with show/hide toggles, error validation, OR divider, Google sign-up button, and sign-in link.
- **`src/screens/MessagesScreen.tsx`** — Created. Full messages screen ported from Figma (`figma_design/src/app/components/Messages.tsx`). Two views: (1) chat list with search, unread badges, avatar initials; (2) individual chat view with message bubbles, send button, keyboard-avoiding layout. Supports `openChatWith` prop to jump directly into a conversation from Friends or Board.
- **`src/screens/BoardScreen.tsx`** — Added post detail view (tapping a post expands it). Posts now store full `Comment[]` arrays instead of a count. Detail shows comments list, add-comment input, like toggle, and a send button that opens MessagesScreen for the post author. Added `onOpenMessages` prop.
- **`src/screens/FriendsScreen.tsx`** — Added `onOpenMessages` prop. Header now shows a messages icon (opens MessagesScreen) alongside the add-friend icon. Each friend row's send button now calls `onOpenMessages(friend.name)` to open a direct chat.
- **`App.tsx`** — Added `'signup'` to `AuthScreen` type; `onCreateAccount` routes to `SignUpScreen`; `onGoToSignUp` on `SignInScreen` is wired. Added `showMessages` + `messagesOpenWith` state, `handleOpenMessages` helper, `MessagesScreen` full-screen overlay (zIndex 30). Imported `SignUpScreen` and `MessagesScreen`.

### Session 30 (figma_design2 sync)
- **Global brand color** — Replaced all legacy blue shades (`#4f6ef7`, `#2563eb`, `#93a5fb`) with `#4169E1` (royal blue) across all screens: `WelcomeScreen`, `SignInScreen`, `SignUpScreen`, `GradesScreen`, `BoardScreen`, `FriendsScreen`, `TimetableScreen`, `CoursePickerScreen`, `App.tsx`.
- **`src/screens/WelcomeScreen.tsx`** — Changed app name "UniTrack" → "ClassMate". Replaced dual-icon logo (calendar + book badge) with a single "CM" monogram in a rounded blue box, matching figma_design2 Auth.tsx.
- **`src/screens/SignUpScreen.tsx`** — Updated subtitle "Join UniTrack" → "Join ClassMate".
- **`src/screens/HomeScreen.tsx`** — Updated weather card background and text colors from indigo (`#eef2ff`/`#6366f1`/`#a5b4fc`) to `#4169E1`-based palette.
- **`src/screens/FriendsScreen.tsx`** — Renamed header "Friends" → "ClassMates". Updated search placeholder to "Search classmates…". Tab label "Friends" → "ClassMates". Pre-populated with mock friends (Sarah Chen/Engineering/Sophomore, Alex Kim/Computer Science/Junior, Emma Wilson/Business/Freshman) and one pending request (Mike Johnson/Data Science/Senior). Added accept/decline buttons for pending requests; accepting moves the person to the friends list.
- **`App.tsx`** — Tab label "Friends" → "ClassMates".

### Session 31 (Course Reviews)
- **`src/screens/CoursePickerScreen.tsx`** — Added course review feature. Each course row in the picker now has a "Reviews" button next to the expand arrow. Tapping it opens a bottom-sheet Reviews Modal showing: course name/code, overall star rating (4.3), review count, and a list of mock reviews (author, semester, stars, date, content, difficulty/5, workload/5). A "Write a Review" button opens a second bottom-sheet Write Review Modal with: tappable star rating (1-5), Difficulty selector (1-5 buttons), Workload selector (1-5 buttons), multi-line text input, and a Submit button. Submitted reviews are appended to the list in the session. Added `CourseReview` type, `MOCK_REVIEWS` constant, and review-related state variables.

### Session 32
- **`src/screens/CoursePickerScreen.tsx`** — Fixed course number sorting for honors courses prefixed with "H" (e.g. "H2A", "H21A"). `parseInt("H2A")` returns `NaN` (treated as 0), causing all honors courses to sort to the top. Fix: added `stripH()` helper that strips a leading `H` (case-insensitive) before `parseInt` and before extracting the letter suffix, so "H21A" sorts alongside "21A" at position 21.

### Session 33 (Timetable screen redesign)
- **`src/screens/TimetableScreen.tsx`** — Full visual redesign to match Figma. Key changes: (1) White flat background, no card wrapper around the grid. (2) Header now shows "Timetable" + `[Spring 2026 ▾]` quarter picker + `⋮` three-dots button; three-dots opens an "Add Course / Add Timetable" dropdown modal. (3) Plan tabs row below header: named timetable pills (active = blue filled, inactive = outlined) + `+ Add` button on the right that opens the same add-menu. (4) Day headers changed from single letters (M/T/W/Th/F) to abbreviated names (Mon/Tue/Wed/Thu/Fri/Sat/Sun). (5) Time labels changed from "08:00" (zero-padded) to "8:00". (6) Course blocks redesigned: pastel background color + dark text in the same hue + left border accent, showing course title, room/location, and "Prof. [LastName]" instead of white-on-solid-color blocks. Added `pastelForDepartment()` helper mapping department hash to 10 pastel bg/text/border palettes. Added `getProfLastName()` to extract and capitalize last name from "LAST, FIRST" API format.

### Session 34 (Timetable settings + delete)
- **`src/screens/TimetableScreen.tsx`** — Changed `⋮` three-dots button to open a "Timetable Settings" bottom sheet instead of the add-menu. Settings sheet has: (1) **Timetable Theme** radio group — Default (pastel), Minimal (white/gray), Colorful (solid bright), Dark (dark-navy bg); (2) **Display Information** checkbox group — Class Name, Room Number, Instructor, Time (all on by default); (3) **Apply Settings** blue button that commits changes to the live grid; (4) **Delete Current Timetable** red-outlined button that triggers an `Alert.alert` confirmation dialog ("Are you sure…"). Added `getBlockColors()` function that returns block colors based on active theme. Course block rendering is gated by the four display-info booleans. `+ Add` button now exclusively opens the Add Course / Add Timetable dropdown. Added `onDeleteTimetable` prop.
- **`App.tsx`** — Added `handleDeleteTimetable` async function: deletes from Supabase, removes from local `timetables` state, selects next available timetable for the quarter (or null). Passed `onDeleteTimetable` prop to `TimetableScreen`. Removed hardcoded `backgroundColor` from timetable tab wrapper so the screen's own theme background shows through.

### Session 35 (Supabase seeder)
- **`scripts/seed-sections.js`** — Created. One-time Node.js script that fetches all UCI course sections from Anteater API and upserts them into the Supabase `sections` table. Loops over all 4 quarters × 140+ departments. Formats time from `{ hour, minute }` objects to `"HH:MM - HH:MM"`. Filters cancelled sections. Upserts in chunks of 500. 120ms delay between API calls to avoid rate limiting. Run with `node scripts/seed-sections.js` after filling in `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`.

### Session 36 (Timetable scrolling + TBA courses)
- **`src/screens/TimetableScreen.tsx`** — Fixed vertical scrolling. Root cause: `timetableHeight` was calculated as `screenHeight - 270` which is approximately equal to the available viewport, so content height ≈ viewport height → no overflow to scroll. Fix: replaced dynamic calculation with `HOUR_HEIGHT = 72` (fixed px per hour), so `timetableHeight = totalHours * HOUR_HEIGHT` (e.g. 9 hours × 72 = 648px) which is always taller than the viewport. Added `scrollAreaHeight` state measured from a wrapper `View` using `onLayout` — this is the true available viewport height. Both the horizontal and vertical ScrollViews now use `scrollAreaHeight` as their explicit height, ensuring content always exceeds viewport. Added `tbaCourses` (courses with time/days = TBA) rendered below the hour grid in a "TIME TBA" section with a divider label and wrapped pastel cards matching the block style, respecting the active theme and display settings.

### Session 37 (Per-course colors)
- **`src/data/courses.ts`** — Extracted `hashStr()` helper. Expanded `PASTEL_PALETTES` to 12 entries (was 10). Added `pastelForCourse(courseCode)` (hashes by course code, e.g. "ECON 100A") and `colorForCourse(courseCode)` (solid color by course code). Kept `colorForDepartment` unchanged for backward compatibility.
- **`src/screens/TimetableScreen.tsx`** — Removed local `PASTEL_PALETTES` and `pastelForDepartment`. Updated `getBlockColors` to use `pastelForCourse(course.code)` and `colorForCourse(course.code)` instead of department-based hashing. Now each unique course code (e.g. "ECON 100A" vs "ECON 100B") gets its own distinct color rather than every course in the same department sharing one color.
- **`src/components/PreviewTimetable.tsx`** — Updated `colorsForCourse` to use `pastelForCourse(course.code)`. Preview blocks now use pastel bg + dark text + left border accent, consistent with the main timetable.
- **`src/screens/FriendsScreen.tsx`** — Updated friend timetable blocks to use `pastelForCourse(course.code)` instead of `colorForDepartment`. Matching visual style across all three timetable views.

### Session 38 (Section-type color separation)
- **`src/screens/TimetableScreen.tsx`** — Added `colorKey(course)` helper: extracts the section type prefix from `course.sectionLabel` (e.g. "Lec" from "Lec A", "Dis" from "Dis A1") and builds key `"ECON 100A-Lec"` / `"ECON 100A-Dis"`. `getBlockColors` now uses `colorKey(course)` so Lec and Dis sections of the same course hash to different palette entries and render in distinct colors.
- **`src/components/PreviewTimetable.tsx`** — Applied same section-type key logic to `colorsForCourse`.
- **`src/screens/FriendsScreen.tsx`** — Applied same section-type key logic to friend timetable block color lookup.

### Session 39 (Grades screen improvements)
- **`src/screens/GradesScreen.tsx`** — Added `selectedQuarter: Quarter` and `timetables: Timetable[]` to Props. Current quarter heading shows "Current Quarter" (static label). Added `'P'` and `'NP'` to `GRADE_OPTIONS`; P and NP are absent from `GRADE_POINTS` so they do not affect GPA. Grade picker modal gives `NP` a 76px-wide button. Removed all static mock data (`GPA_HISTORY`, `PAST_SEMESTERS`, `PAST_CREDITS`, `PAST_COURSE_COUNT`). Past quarters are now computed dynamically: `pastQuarterItems` finds all QUARTERS before selectedQuarter that have at least one course in any timetable for that quarter; shown most-recent-first with the newest expanded by default. GPA trend chart (`GpaChart`) now accepts a `history` prop computed from graded past quarter courses; shows "No past quarter data yet" when empty. Overall GPA/credits/course-count stats are computed from real timetable data only. Renamed `PastSemesterSection` → `PastQuarterSection`, updated to accept `Course[]` directly. "Past Semesters" label → "Past Quarters"; section hidden entirely when no past quarter data exists.
- **`App.tsx`** — Passed `selectedQuarter` and `timetables` props to `GradesScreen`.

### Session 40
- **`src/screens/GradesScreen.tsx`** — 0-unit sections (e.g. discussion/lab sections with 0 credits) are now hidden from the Grades screen. Filter applied in three places: (1) current quarter course list render; (2) `pastQuarterItems` useMemo — courses with 0 units are excluded, and a past quarter is omitted entirely if all its courses are 0-unit; (3) stats row (credits total and course count) excludes 0-unit active courses.
- **`src/screens/GradesScreen.tsx`** — "Current Quarter" section now always shows Spring 2026 (the actual real-world current quarter), regardless of which quarter is selected in the Timetable tab. Removed `activeCourses` and `selectedQuarter` props; GradesScreen now derives current-quarter courses internally from `timetables` using a hardcoded `CURRENT_QUARTER` constant. Past quarters are computed relative to Spring 2026, not the app's navigation state.
- **`App.tsx`** — Removed `activeCourses` and `selectedQuarter` props from the `GradesScreen` render call.
- **`src/screens/TimetableScreen.tsx`** — Quarter dropdown now only shows quarters that have at least one timetable, derived directly from the `timetables` array (not the hardcoded `QUARTERS` list), so older quarters like 2020–2024 added via "Add Quarter" appear correctly. Sorted most-recent-first by string compare on the quarter key.
- **`src/screens/TimetableScreen.tsx`** — Added "Add Quarter" option to the `+ Add` dropdown menu. The picker checks all quarters in the seeder range (2020–2026 × Winter/Spring/Fall) via parallel Supabase HEAD queries, filters out quarters the user already has timetables for, and shows only seeded quarters not yet added. Fixed bug where checking only the app-level `QUARTERS` array (Fall 2025+) missed older seeded quarters. Added `timetables`, `onAddQuarter` props; `addableQuarters`, `loadingAddableQuarters`, `showAddQuarterModal` state; `openAddQuarterModal` async function.
- **`src/screens/GradesScreen.tsx`** — Added `A+` grade option (maps to 4.0 GPA). Added "Edit Units" button in the grade picker modal; tapping it reveals a 1–5 unit selector inline; selecting a value auto-hides the selector. Unit overrides are stored in local `unitOverrides` state (keyed by compound `qk|courseId`) — they override the Supabase value only within the Grades screen and are not persisted. All GPA calculations, credits totals, and course row displays now use a `getUnits()` helper that prefers the override over the course's Supabase unit value. `PastQuarterSection` receives `unitOverrides` prop to display correct credits.
- **`src/data/courses.ts`** — Expanded `PASTEL_PALETTES` from 12 to 24 entries and `COURSE_COLORS` from 10 to 24 entries to reduce color collisions across courses.
- **`App.tsx`** — `handleDeleteTimetable` now auto-switches to Spring 2026 (current quarter) when deleting the last timetable for a quarter, instead of leaving the user on an empty quarter with no timetables.
- **`App.tsx`** — Added `handleAddQuarter`: switches `selectedQuarter` to the chosen quarter and auto-creates a timetable for it if none exists. Passed `timetables` and `onAddQuarter` props to TimetableScreen.
- **`src/screens/CoursePickerScreen.tsx`** — Replaced Anteater API (`/v2/rest/websoc`) fetch with a Supabase query against the pre-seeded `sections` table. Queries `sections` filtered by `department` and `quarter_key`. Groups rows into `CatalogCourse` entries and builds `sectionsMap` with section sorting (Lec → Dis → Lab) inline. Removed all dead websoc-specific code: `WebsocSection`, `WebsocCourse`, `WebsocTime` types, `BASE` constant, `pad2`, `formatWebsocTime`, `formatLocation`, `sortSections`, `mapWebsocSection`. Added `supabase` and `quarterKey` imports.

### Session 41 (New login flow — Figma design3)
- **`src/screens/WelcomeScreen.tsx`** — Redesigned. Now shows CM logo (centered), "Welcome to ClassMate" title, subtitle, and a single "Get Started →" blue button. Removed old Sign In / Create Account / guest shortcuts (guest access moved to SignInScreen dev section).
- **`src/screens/UniversitySelectionScreen.tsx`** — Created. New screen in the auth flow: back arrow, "Select Your University" heading, searchable university list (only UC Irvine), selectable card with blue border + checkmark when chosen, "Continue" button appears at bottom on selection. Exports `University` type.
- **`src/screens/SignInScreen.tsx`** — Fully redesigned to match Figma. Shows selected university card (blue-tinted bg, UCI logo, name/location, email domain row), "Sign In to ClassMate" title, info pill ("Use your university Google account"), "Continue with Google" button with real Google G SVG icon, OR divider, "Create a new account →" link. Guest shortcut buttons kept at bottom under a "dev" label. Props changed: now receives `university` object and `onGuest` instead of email/password fields.
- **`src/screens/SignUpScreen.tsx`** — Fully redesigned to match Figma. Mirrors SignInScreen layout but with "Join ClassMate" title, "Start organizing your campus life today" subtitle, and "Sign in instead →" link. Accepts optional `university` prop (falls back to UCI default).
- **`App.tsx`** — Auth flow updated: `AuthScreen` type now includes `'university'`. Welcome → University Selection → Sign In. Added `selectedUniversity` state. `UniversitySelectionScreen` imported. `onContinue` stores the selected university and navigates to `'signin'`. Sign In / Sign Up back buttons go to `'university'` instead of `'welcome'`.

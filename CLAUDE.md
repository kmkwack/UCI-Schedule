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

#### 1. Course Catalog
```
GET https://anteaterapi.com/v2/rest/courses?department=ECON
```
Returns all courses offered by a department (general catalog, not quarter-specific).

Response shape:
```json
{
  "ok": true,
  "data": [
    {
      "id": "ECON100A",
      "department": "ECON",
      "courseNumber": "100A",
      "title": "Intermediate Microeconomics",
      "units": { "minUnits": 4, "maxUnits": 4 }
    }
  ]
}
```

#### 2. Enrollment History (sections per quarter)
```
GET https://anteaterapi.com/v2/rest/enrollmentHistory?department=ECON&courseNumber=100A&year=2026&quarter=Spring
```

**Required parameters** — must provide one of these combinations:
- `department` + `courseNumber` (year/quarter optional but recommended)
- `sectionCode` + `year` + `quarter`
- `instructorName` + `courseNumber` + `year` + `quarter`

Valid `quarter` values: `Fall`, `Winter`, `Spring`, `Summer1`, `Summer2`, `Summer10wk`

Response shape:
```json
{
  "ok": true,
  "data": [
    {
      "sectionCode": "36120",
      "department": "ECON",
      "courseNumber": "100A",
      "sectionType": "Lec",
      "sectionNum": "A",
      "units": "4",
      "instructors": ["SMITH, JOHN"],
      "meetings": [
        { "days": "MWF", "time": "10:00-10:50am", "bldg": ["SSPA 2112"] }
      ]
    }
  ]
}
```

### API Docs
- Developer docs: https://docs.icssc.club/docs/developer/anteaterapi
- Interactive reference: https://anteaterapi.com/reference
- Migration from PeterPortal: https://docs.icssc.club/docs/developer/anteaterapi/migrating

### Important Notes
- `enrollmentHistory` is named "history" but it's the only endpoint with live quarter-specific schedule data (instructor, time, location, section code)
- There is **no dedicated WebSoc/live-schedule endpoint** in Anteater API
- Courses with no sections for the selected quarter are filtered out at load time

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

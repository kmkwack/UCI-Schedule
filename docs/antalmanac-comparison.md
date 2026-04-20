# AntAlmanac vs UCI-Schedule (ClassMate) — Feature Comparison

> Last updated: 2026-04-19 (updated with full API surface analysis)

---

## Overview

| | AntAlmanac | ClassMate (UCI-Schedule) |
|---|---|---|
| Platform | Web (React) | Mobile — iOS / Android (React Native + Expo) |
| Focus | Course discovery & schedule planning | Social + mobile-first campus companion |
| Auth | Google OAuth + Postgres | Guest IDs (Supabase backend) |
| Open source | Yes (ICSSC) | No |

---

## Feature Gap Analysis

### 🔴 Critical — Missing, high student impact

#### 1. Advanced Search & Filtering
- **AntAlmanac:** Filter by time range, unit count, GE requirements, enrollment status, instructor; fuzzy autocomplete search
- **ClassMate:** Department picker + basic text search (course name / professor only)
- **Gap:** Students can't find courses by time slot, unit count, or GE requirement

#### 2. Grade Distribution & Historical GPA
- **AntAlmanac:** Per-professor average GPA + A/B/C/D/F/P/NP breakdown from past quarters; bar chart popup; links to Zotistics
- **ClassMate:** No external course difficulty data at all
- **Gap:** Students have no data to evaluate course/professor difficulty before enrolling

---

### 🟠 High — Significant friction without these

#### 3. Enrollment Status (Open / Waitlist / Closed)
- **AntAlmanac:** Live enrollment counts, waitlist size, status color-coded per section
- **ClassMate:** No enrollment visibility
- **Gap:** Students don't know if a section is actually enrollable

#### 4. Prerequisites Tree
- **AntAlmanac:** Visual prereq chain with AND/OR/NOT logic
- **ClassMate:** Nothing — students check the catalog separately
- **Gap:** Cannot verify course requirements in-app

#### 5. Import / Export
- **AntAlmanac:** Import from UCI WebReg study list or Zotcourse; export to `.ics` (Google/Apple/Outlook Calendar); screenshot export
- **ClassMate:** No import, no export, no calendar sync
- **Gap:** Cannot share schedules or sync to system calendar

#### 6. Schedule Duplication / Copy
- **AntAlmanac:** Duplicate entire schedule to explore alternatives; drag-and-drop reordering; inline rename
- **ClassMate:** Basic timetable switching; no copy/duplicate
- **Gap:** Inefficient to explore "what if I swap this section"

---

### 🟡 Medium — Quality of life

#### 7. Custom Events
- **AntAlmanac:** Add non-WebSoc events (study sessions, office hours, exams) directly on the grid
- **ClassMate:** Only WebSoc-sourced sections

#### 8. Email / Push Notifications
- **AntAlmanac:** Per-section alerts when a section opens, closes, or waitlist becomes available
- **ClassMate:** No notifications

#### 9. Undo / Redo
- **AntAlmanac:** Full undo/redo for course add/remove actions
- **ClassMate:** Accidental removal requires re-searching

#### 10. Campus Map
- **AntAlmanac:** Interactive Leaflet map with building markers and routes between back-to-back classes
- **ClassMate:** No map

#### 11. Finals Schedule View
- **AntAlmanac:** Finals calendar overlay togglable on the weekly grid
- **ClassMate:** No finals view

#### 12. Dark Mode / Time Format
- **AntAlmanac:** Light / Dark / System theme; 12-hr vs 24-hr toggle
- **ClassMate:** Theme selector (pastel/minimal/colorful/dark) but no time format option

---

## What ClassMate Has That AntAlmanac Doesn't

| Feature | Notes |
|---|---|
| **In-app course reviews** | Star rating, difficulty (1–5), workload (1–5), written review; persisted per session |
| **Friends / ClassMates social layer** | Add friends, view their timetables, send messages |
| **Community board** | Posts for study groups, campus events, marketplace, club promotions |
| **In-app messaging / chat** | Direct messages + post-reply threads |
| **Mobile-native** | iOS & Android via Expo; offline-capable layout |
| **Per-course color coding** | Each unique course code gets its own consistent color (not department-level) |
| **Section-type color separation** | Lec / Dis / Lab sections of the same course render in distinct colors |

---

## Anteater API — Full Surface vs AntAlmanac Usage

### Endpoint Coverage

| Endpoint | AntAlmanac Uses? | Notes |
|---|---|---|
| `/v2/rest/websoc` | ✅ Yes | Main course + section search |
| `/v2/rest/websoc/departments` | ✅ Yes | Department list |
| `/v2/rest/websoc/terms` | ✅ Yes | Available quarters |
| `/v2/rest/courses` | ✅ Yes | Paginated course list (for search index) |
| `/v2/rest/courses/{id}` | ✅ Yes | Single course detail |
| `/v2/rest/grades/aggregate` | ✅ Yes | GPA per course |
| `/v2/rest/grades/aggregateByOffering` | ✅ Yes | GPA per course + instructor |
| `/v2/rest/grades/raw` | ❌ No | Type imported but never called |
| `/v2/rest/enrollmentHistory` | ✅ Yes | Enrollment trend chart |
| `/v2/rest/calendar/all` | ✅ Build-time only | Term dates baked into bundle |
| `/v2/rest/calendar` (single term) | ❌ No | Never called |
| `/v2/graphql` | ✅ Build-time only | Section code cache generation |

---

### Fields Available But Unused by AntAlmanac

#### From `/v2/rest/courses/{id}` — individual course detail
| Field | What It Contains | Opportunity |
|---|---|---|
| `description` | Full catalog course description text | Show in course detail view |
| `prerequisite_for` | List of courses that require this one | "What does this unlock?" view |
| `ge_list` | GE categories the course satisfies | Show GE badges on course cards |

#### From WebSoc section data
| Field | What It Contains | Opportunity |
|---|---|---|
| `comment` | Registrar notes per section (e.g. "Must also enroll in Dis") | Surface in section picker to prevent enrollment mistakes |
| `finalExam.bldg` | Building where the final exam is held | Show alongside final exam time |
| `numNewOnlyReserved` | Seats reserved exclusively for new students | Useful context for upperclassmen trying to enroll |

#### From `/v2/rest/grades/raw` — unused by everyone
| What It Is | Opportunity |
|---|---|
| Per-quarter raw grade records (not aggregated) | **Unique feature no other app shows:** grade trend over time — e.g. "Prof. Smith graded much harder in 2024 than 2022" |

---

### Key Insight on Grade Data Time Range

The aggregated grade counts (`gradeACount`, `gradeBCount`, etc.) cover **all available historical data — roughly 2014 to present**. There is no `since` or `year` filter on the aggregate endpoints. The `averageGPA` is therefore a long-run average, not a recent snapshot. A professor who changed their grading style recently would not be reflected accurately.

The `/grades/raw` endpoint (unused by AntAlmanac) returns per-quarter breakdowns, which would allow building a recency-aware GPA trend — a genuinely unique feature.

---

## Grade Distribution API Reference

**Endpoint:**
```
GET https://anteaterapi.com/v2/rest/grades/aggregateByOffering
  ?department=ECON
  &courseNumber=100A
  &instructor=SMITH       ← optional; omit to aggregate all instructors
```

**Response fields:**

| Field | Type | Description |
|---|---|---|
| `averageGPA` | `number \| null` | Average GPA across all included offerings; null for P/NP-only courses |
| `gradeACount` | `number` | Students who received an A |
| `gradeBCount` | `number` | Students who received a B |
| `gradeCCount` | `number` | Students who received a C |
| `gradeDCount` | `number` | Students who received a D |
| `gradeFCount` | `number` | Students who received an F |
| `gradePCount` | `number` | Students who received a P (Pass) |
| `gradeNPCount` | `number` | Students who received an NP (No Pass) |

> Percentages are calculated client-side: `gradeACount / totalCount * 100`  
> `totalCount = A + B + C + D + F + P + NP`

**Two available aggregation modes:**
- `/aggregate` — all sections of a course across all instructors and terms
- `/aggregateByOffering` — scoped to a specific department + course number + optional instructor

---

## Recommended Implementation Priority

### From AntAlmanac feature gaps

| Priority | Feature | Effort | Value |
|---|---|---|---|
| 1 | **Enrollment status** (Open/Waitlist/Closed) | Low — already in Supabase `sections` table | High — students need this before adding a course |
| 2 | **Grade distribution popover** | Medium — one API call per course, bar chart UI | High — core decision-making data |
| 3 | **Export to `.ics`** | Low-Medium | High — perceived value is huge |
| 4 | **Advanced search filters** (time, units, GE) | Medium | High — differentiates mobile experience |
| 5 | **Custom events** | Low | Medium — makes app the sole calendar |
| 6 | **Push notifications** (enrollment alerts) | High — requires backend job | Medium |
| 7 | **Prerequisites display** | Medium — `prerequisite_tree` field already in API | Medium |
| 8 | **Schedule duplicate/copy** | Low | Medium |
| 9 | **Finals schedule overlay** | Low — `finalExam` field already in WebSoc response | Medium |
| 10 | **Campus map** | High | Low-Medium |

### From unused API fields (exclusive opportunities)

| Priority | Feature | API Source | Effort | Value |
|---|---|---|---|---|
| 1 | **Course description** in picker | `courses/{id}.description` | Low — field already available | Medium — reduces need to open catalog |
| 2 | **Section registrar comments** | `websoc.sections[].comment` | Low — already in WebSoc response | Medium — prevents enrollment mistakes |
| 3 | **GE category badges** on course cards | `courses/{id}.ge_list` | Low-Medium | Medium — saves students a catalog lookup |
| 4 | **GPA trend over time** (per-quarter) | `grades/raw` | High — needs chart UI + data modeling | High — **no other app shows this** |
| 5 | **"What does this unlock?"** prereq-for view | `courses/{id}.prerequisite_for` | Medium | Low-Medium — useful for planning ahead |
| 6 | **Final exam building location** | `websoc.sections[].finalExam.bldg` | Low — field already fetched | Low |

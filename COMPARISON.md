# ClassMate vs AntAlmanac — Feature Comparison

---

## Feature Table

| Feature | AntAlmanac | ClassMate |
|---|---|---|
| **SCHEDULE BUILDING** | | |
| Browse courses by department | ✅ | ✅ |
| Search by course code / section code | ✅ | ✅ (partial) |
| Search by professor name | ✅ | ✅ |
| Advanced filters (days, time, units, level, GE) | ✅ | ❌ |
| Filter by enrollment status (open/full/waitlist) | ✅ | ✅ (display only) |
| Add course to schedule | ✅ | ✅ |
| Remove course from schedule | ✅ | ✅ |
| Multiple named schedules per quarter | ✅ | ✅ |
| Rename schedules | ✅ | ✅ |
| Delete schedules | ✅ | ✅ |
| Drag-to-reorder schedules | ✅ | ✅ |
| Copy/duplicate a schedule | ✅ | ❌ |
| Conflict detection | ✅ | ✅ |
| TBA course support | ✅ | ✅ |
| **CALENDAR / TIMETABLE VIEW** | | |
| Weekly grid calendar | ✅ | ✅ |
| Color-coded courses | ✅ | ✅ |
| Multiple timetable themes | ❌ | ✅ |
| Custom events (study time, breaks) | ✅ | ❌ |
| Finals schedule view | ✅ | ❌ |
| Hover-to-preview before adding | ✅ (experimental) | ✅ (mini preview) |
| Undo / redo | ✅ | ❌ |
| **COURSE INFORMATION** | | |
| Grade distribution chart | ✅ | ✅ |
| Historical enrollment data | ✅ | ❌ |
| Professor ratings (RateMyProfessors) | ✅ (link) | ✅ (link) |
| Prerequisites display | ✅ | ❌ |
| Course restrictions display | ✅ | ❌ |
| Student-written reviews | ❌ | ✅ |
| **GRADES** | | |
| GPA tracker | ❌ | ✅ |
| Per-course grade entry | ❌ | ✅ |
| GPA trend chart | ❌ | ✅ |
| Past quarter history | ❌ | ✅ |
| **NOTIFICATIONS** | | |
| Notify when course opens | ✅ | ❌ |
| Notify when course fills | ✅ | ❌ |
| Notify when waitlist opens | ✅ | ❌ |
| Class reminder notifications | ❌ | ✅ (built, not wired) |
| **IMPORT / EXPORT** | | |
| Export schedule as .ics (Google/Apple Calendar) | ✅ | ❌ |
| Export as image (PNG) | ✅ | ✅ |
| Share schedule link | ✅ | ❌ |
| Import from WebReg study list | ✅ | ❌ |
| Import from Zotcourse | ✅ | ❌ |
| **MAP** | | |
| Interactive campus map | ✅ | ❌ |
| Building locations for classes | ✅ | ❌ |
| Directions between classes | ✅ | ❌ |
| **SOCIAL** | | |
| View friends' schedules | ❌ | ✅ |
| Friend requests | ❌ | ✅ |
| Community board / posts | ❌ | ✅ |
| Direct messages | ❌ | ✅ (UI only) |
| **ACCOUNT & SETTINGS** | | |
| Google sign-in | ✅ | ✅ |
| Guest mode | ✅ | ✅ |
| Dark mode | ✅ | ✅ |
| Persistent cloud save | ✅ | ✅ (Supabase) |
| Profile customization | ❌ | ✅ |
| **HOME SCREEN** | | |
| Today's classes at a glance | ❌ | ✅ |
| Live weather | ❌ | ✅ |
| Campus sports events | ❌ | ✅ |
| Daily motivational quote | ❌ | ✅ |
| **PLATFORM** | | |
| Web | ✅ | ✅ (Expo web) |
| iOS | ❌ | ✅ |
| Android | ❌ | ✅ |
| PWA / installable | ✅ | ❌ |
| **PLANNER** | | |
| 4-year degree roadmap | ✅ | ❌ |
| Filter courses by roadmap | ✅ | ❌ |

---

## What ClassMate Has That AntAlmanac Doesn't

ClassMate's unique strengths — keep and polish these:

- **Mobile-native app** (iOS + Android via Expo)
- **GPA tracker** with trend chart and past quarter history
- **Student-written course reviews** with ratings, difficulty, workload, and quarter taken
- **Social layer** — friends, classmates, shared schedules, community board
- **Home screen** — today's classes, weather, sports events, daily quote
- **Multiple timetable themes** (Default, Minimal, Colorful, Dark)

---

## What to Add — Sorted by Urgency

### 🔴 High (core scheduling, users will notice immediately)

1. **Export as .ics** — Let students add their schedule to Google/Apple Calendar. This is the #1 most-used AntAlmanac export. One tap, zero friction.
2. **Course open/waitlist notifications** — Push notification when a full course opens up. Huge for enrollment season. Supabase Edge Functions + Expo push tokens.
3. **Advanced search filters** — Filter by days of week, start/end time, units, course level (lower/upper/grad), GE category. Currently users scroll through everything.
4. **Share schedule link** — Generate a URL or deep link so students can share their schedule with friends. Pairs well with the existing friends feature.

### 🟡 Medium (meaningful but not blocking)

5. **Finals schedule view** — Show finals dates/times on the timetable. UCI final exam schedule is published per section. High value at end of quarter.
6. **Historical enrollment data** — Show how quickly a section fills up over past quarters. Helps students decide when to enroll.
7. **Import from WebReg study list** — Let users paste their current WebReg enrollment and auto-populate their timetable. Reduces manual entry.
8. **Custom events** — Add non-class events (study sessions, club meetings, office hours) to the timetable grid.
9. **Copy/duplicate a schedule** — Useful when experimenting with alternate course combinations.
10. **Prerequisites display** — Show prereqs inline in the course picker so students don't have to leave the app.

### 🟢 Low (polish / nice-to-have)

11. **Undo / redo** — Undo accidental course removal. Local state operation, no backend needed.
12. **4-year degree roadmap / planner** — Map out all 4 years of coursework. Large feature, but differentiating for ClassMate since AntAlmanac's planner is a separate app.
13. **Direct messages (Supabase backend)** — Currently UI-only. Wire up with Supabase realtime for actual messaging.
14. **PWA support** — Make the Expo web build installable on desktop browsers.
15. **Filter courses by degree roadmap** — Once roadmap is built, let users hide courses they've already completed.

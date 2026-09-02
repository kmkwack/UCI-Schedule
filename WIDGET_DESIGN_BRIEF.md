# ClassMate — iOS Home Screen Widget Design Brief

Design three iOS home-screen widgets for **ClassMate**, a class-schedule app for
university students (currently UC Irvine, expanding to other campuses).

The widgets must feel like part of the existing app, not a separate product.
Exact brand values are at the bottom — please use them rather than inventing a
palette.

---

## The three sizes

| Size | Points | Question it answers |
|---|---|---|
| **Small** | 170 × 170 | "Where do I have to be next?" |
| **Medium** | 364 × 170 | "What does today look like?" |
| **Large** | 364 × 382 | "When am I busy this week?" |

Each size should answer only its own question. They are not the same content at
three densities.

---

## Data available

Every class has:

- **Course code** — `ECON 131A` (short, always present)
- **Title** — `Public Econ & Dev` (can be long, 20–40 chars)
- **Time range** — `12 PM – 12:50 PM`
- **Location** — `ALP 2100` (sometimes missing)
- **Colour** — each course gets one of 24 pastel triples (background / text /
  border), assigned deterministically. See palette below.
- **Weekday + start/end minutes**

Also available: term label (`Fall 2026`), school name (`UC Irvine`), number of
classes today.

A typical student has **3–5 courses**, each meeting 2–3 times a week, mostly
between 8 AM and 6 PM, Monday–Friday.

---

## What each widget needs

### Small — next class
- Prominent: which class, and when.
- Should also distinguish **"in class right now"** from **"next up"**.
- A relative countdown ("in 25 min") is useful when the class is soon, but
  currently reads badly for something 13 hours away — please solve that.

### Medium — today
- A list of today's classes in time order (typically 1–4).
- Must not leave the bottom half empty when there are only two classes.
- Needs an empty state ("No classes today").

### Large — this week
- Monday–Friday.
- Should convey **when** the busy blocks are, not just which days.
- Today should be identifiable at a glance.
- Course codes must stay readable — titles almost certainly won't fit.

---

## Constraints (important)

1. **SwiftUI, not web.** Deliverable should be layout/spacing/hierarchy
   direction — I implement it in SwiftUI. Please don't rely on effects that
   need CSS (backdrop blur stacks, custom shadows on text, etc.).
2. **Light and dark mode both.** The widget sits on an unpredictable wallpaper.
3. **No interactivity.** Widgets are static images; no scrolling, no buttons.
4. **Very small type is unavoidable** at this size — but it has to stay legible
   at arm's length on a phone.
5. **Widget background is a solid system background** (white in light mode,
   near-black in dark). Content sits directly on it.

---

## What went wrong with my attempt (please avoid)

I built these already and they read as amateurish. Specific failures:

- Blocks looked **neon**: I took the course's solid colour and applied opacity
  instead of using the app's pastel triple, so saturation stayed at full.
- **Grey translucent widget background** killed the contrast of pale pastels.
- **Fixed-height rows** left the bottom 40% of the medium widget empty.
- The large size drew a time grid that felt **sparse and toy-like** — thin
  lines, tiny text, lots of dead space.
- Not enough information per class: just a course code, no title.

---

## Brand values — please use these exactly

**Brand accent:** `#4169E1`

**Light mode**
```
background       #ffffff
secondary bg     #f9fafb
card             #ffffff
text             #111827
text secondary   #6b7280
text tertiary    #9ca3af
border           #e5e7eb
brand tint bg    #eff3ff
```

**Dark mode**
```
background       #0f172a
secondary bg     #111827
card             #111827
```

**Course pastel triples** (background / text / border) — a course is assigned
one of these; use them as a set, don't recolour:
```
#EEF4FF / #3B6BC9 / #93B8F5     #FDF8EE / #8B6914 / #E5C96A
#F2FAEC / #4A7A1E / #90CC5A     #FDF2F0 / #8B3B30 / #E07A70
#F5F0FF / #6D28D9 / #B48AFC     #FFF4EC / #C2540A / #F9A170
#E8FBF9 / #0F766E / #5CD1C8     #FFF0F7 / #BE185D / #F472B6
#F0F9FF / #0369A1 / #7DD3FC     #FEF2F2 / #991B1B / #FCA5A5
#F0FDF4 / #166534 / #86EFAC     #EFF6FF / #1E40AF / #93C5FD
```

**Type:** SF Pro (system). The app leans on heavy weights (800–900) for
headings and uses ALL-CAPS letterspaced labels for section headers.

**Shape language:** rounded rectangles, 10–20pt radii, 1px hairline borders,
generous padding. The app's timetable is a bordered card with a tinted header
row, a time gutter on the left, and ruled day columns.

---

## Deliverable

For each of the three sizes:
- Layout with real spacing values
- Type scale (size + weight per element)
- Which colours go where
- Both light and dark
- The empty state

Please show them at true size (170×170, 364×170, 364×382) so the density is
honest.

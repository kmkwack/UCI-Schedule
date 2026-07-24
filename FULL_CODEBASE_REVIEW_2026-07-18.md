# ClassMate — Full Codebase Review (2026-07-18)

**Scope:** Every file under the project — `App.tsx`, all 8 screens, all components, `src/data`, `src/lib`, `src/utils`, `src/context`, all 21 `scripts/`, and all 24 `supabase/` SQL + edge-function files. ~43,000 lines of source read line-by-line across 10 parallel reviewers, cross-checked against `CLAUDE.md`.

**Method:** `npx tsc --noEmit` (passes clean, zero type errors) + exhaustive manual read. Every bug below has a concrete failure scenario; several regexes were verified empirically in node.

---

## Executive summary

The app is feature-rich and, in the client UI layer, unusually well-hardened against the classic React Native traps — race conditions, stale closures, Hermes date parsing, timer/animation leaks are handled correctly in almost every screen (the Session 91–93 hardening is real and intact). **The serious problems are concentrated in two places:**

1. **The Supabase backend (RLS) — this is where the real risk is.** Four issues let one authenticated student escalate to moderator, forge a friendship to unlock a private account, read a "private" timetable directly, or drive the notification service to email arbitrary users. These are not UI bugs; they are exploitable from any REST client with a normal student login.
2. **Multi-school correctness.** Much of the logic still hardcodes UCI assumptions (quarter calendar, term suppression, the sports name-strip regex). On the four semester schools these produce silent data loss — vanishing grades, dropped sports events, broken class reminders.

Nothing here blocks the app from *working* for a UCI user today. But before a wider / multi-school launch, the backend section below should be treated as release-blocking.

### Top priorities (fix these first)

| # | Severity | What | Where |
|---|---|---|---|
| 1 | 🔴 Critical | Any student can become a moderator by editing their own `profiles.email` | `supabase/sql/production_readiness_p2.sql:87-103` |
| 2 | 🔴 Critical | Sports name-strip regex drops most home/away events from the Home widget | `src/data/sportsEvents.ts:383,405` |
| 3 | 🔴 High | Forge an `accepted` friend request → unlock a victim's private timetable, social links & DMs | `production_readiness_p2.sql:590-618` |
| 4 | 🔴 High | "Private" timetable visibility fails **open** in RLS — friends can read it directly | `production_readiness_p2.sql:258-263` |
| 5 | 🔴 High | `social-notifier` edge function accepts forged payloads & injects raw HTML into emails | `supabase/functions/social-notifier/index.ts:329-372` |
| 6 | 🔴 High | Grades screen uses UCI-only quarter resolver → semester schools lose the whole in-progress term Jan–May | `src/screens/GradesScreen.tsx:871-872` |
| 7 | 🔴 High | `userInterfaceStyle:"light"` in app.json breaks the "Auto" theme in every production build | `app.json:10` |
| 8 | 🔴 High | Moderation filter bypassed by a single trailing `!` (`kill yourself!` passes) | `src/data/moderationPolicy.ts:300` |
| 9 | 🟠 High | Blocking is fully bypassable — a blocked user can still friend-request and re-appear on the board | `FriendsScreen.tsx:741-802`, `BoardScreen.tsx:2065` |

---

## 1. Backend / Supabase security (highest risk)

These are exploitable server-side, independent of the app UI, using the anon key shipped in the bundle plus a normal student JWT.

### 1.1 🔴 CRITICAL — Moderator check trusts a client-writable column
`production_readiness_p2.sql:87-103` — `is_school_moderator()` compares `app_moderators.email` to `profiles.email`, but the profiles UPDATE policy (`:166-185`) never pins `profiles.email` to `auth.jwt()->>'email'`. Any student runs `UPDATE profiles SET email='kwackk@uci.edu' WHERE id=auth.uid()` (passes the policy — own id, school unchanged) and instantly gains moderator rights: read/update `reports` and `board_requests`, full CRUD on `boards`, banned-word management.
**Fix:** base `is_school_moderator()` on `auth.jwt()->>'email'` directly (as `can_auth_email_use_school` already correctly does), or store moderator user UUIDs.

### 1.2 🔴 HIGH — Forge an accepted friendship
`production_readiness_p2.sql:590-618` — the `friend_requests` INSERT policy never constrains `status`, and UPDATE lets either participant change any column. An attacker inserts `(sender=me, receiver=victim, status='accepted')` directly. That forged friendship immediately unlocks the victim's timetables (`:239`), `profile_social_links` set to friends-visibility, the timetable-visibility RPC, and `get_or_create_conversation` DMs — with no action by the victim.
**Fix:** force `status='pending'` in the INSERT check; restrict status transitions to the receiver.

### 1.3 🔴 HIGH — "Private" timetable visibility fails open
`production_readiness_p2.sql:258-263` — the timetables SELECT policy reads `user_settings.timetable_visibility` in a plain subquery, but `user_settings` has its own RLS (`user_id=auth.uid()`), so a *friend's* settings row is invisible → the subquery returns NULL → `coalesce(...,'friends') <> 'private'` is always true. A friend querying `timetables?user_id=eq.B` via PostgREST gets B's rows even when B set visibility to private. The app's RPC hides this in the UI only.
**Fix:** resolve visibility through a `SECURITY DEFINER` helper so it can actually read the other user's setting.

### 1.4 🔴 HIGH — social-notifier accepts forged payloads + HTML injection
`supabase/functions/social-notifier/index.ts:329-372` — no webhook-secret or caller verification, so the public anon key satisfies the gateway. Anyone can POST a fake `direct_messages`/comment/like record and make the function (running with the **service-role** key) send a push + email to any chosen `receiver_id`. Compounding it, `:214/:237/:261/:275` interpolate user-controlled `content`/title unescaped into `<p>${content}</p>`, so even the legitimate path lets any user deliver attacker-authored HTML from the official ClassMate sender via Resend.
**Fix:** require a shared `WEBHOOK_SECRET` header, HTML-escape all user text, `encodeURIComponent` every id interpolated into REST URLs (`:101,104,224,250,268,298,315`), and honor `settings.messages` (`:183` currently skips the preference check for messages entirely).

### 1.5 🟠 MEDIUM — other backend gaps
- **Message tampering** (`p2.sql:718-740`): the soft-delete UPDATE policy checks only `sender_id`+school, not `conversation_id`/`content` — a sender can rewrite message content after the fact or repoint their row into another conversation.
- **`delete_current_user` incomplete** (`p2.sql:1115-1217`): never deletes `blocks` rows (and `blocks` isn't defined in any SQL file); storage-row deletes don't remove the actual S3 bytes (retention/GDPR gap); deletes every conversation the user joined, wiping the *other* participant's chat history.
- **Anonymous posters deanonymized** (`p2.sql:1045-1078`): attachment bucket is public and paths embed the author's UUID; any same-school reader maps UUID→name via the profiles SELECT policy.
- **No moderator power over content**: `posts.is_locked` isn't enforced in the `post_comments` INSERT policy, and there is *no* moderator UPDATE/DELETE policy on `posts`/`post_comments` — a moderator reading a report has no RLS path to remove or lock it.
- **Full roster harvest** (`p2.sql:156-164`): profiles SELECT exposes all columns including `email` to every same-school user.
- **Missing hot-path indexes**: `posts(school,created_at)`, `reviews(school,course_code,section_type)`, `profiles(school)` + `lower(email)`/`lower(name)`.

**Verified correct in the backend:** `can_auth_email_use_school` domain matching (rejects `evil-uci.edu`); owner-scoped writes on `user_settings`/`grades`/`timetables`/academic tables; same-school read + cross-school-vote-blocked board CRUD; conversation participant gating; `delete_own_comment` parameterization; catalog tables public-read-only; all SECURITY DEFINER functions set `search_path`.

---

## 2. Multi-school correctness (silent data loss off UCI)

### 2.1 🔴 HIGH — Grades use the UCI-only quarter resolver
`GradesScreen.tsx:871-872` calls `resolveCurrentQuarter` (UCI `QUARTERS` list) instead of the existing `resolveCurrentTerm(school, timetables)`. A Cornell/Purdue/UMD/UIUC user in February gets `CURRENT_QK="2026-Winter"` (valid in UCI's list, so no fallback) — matches no semester timetable, so Current Term is empty, and their real Spring term is also excluded from Past Terms (`isBeforeCurrent`, `:1251-1257`). **All Spring grades and GPA silently vanish from January through May, every year.** Switching to `resolveCurrentTerm` + `termLabel` also fixes the raw `"Summer10wk 2026"` label (L5).

### 2.2 🔴 CRITICAL — Sports name-strip regex drops most events
`sportsEvents.ts:383,405` — the Session-93 leading-school-name strip `/^[A-Z][A-Za-z .&-]{1,30}\s+(?=[A-Z][a-z])/m` is greedy and includes spaces, so it eats the whole "Sport vs" prefix. Verified: `"Baseball versus Stanford"` → `"Stanford"`, `"Softball at Long Beach State"` → `"State"` — the `vs`/`at` is gone so the event is dropped. Only opponents starting with two capitals (UCLA) survive. On UCI's live HTML calendar path, most home/away games vanish from the Home sports widget.
**Fix:** guard the replace — if the result no longer contains ` vs `/`versus`/` at `, keep the original string (two lines, provably safe).

### 2.3 🔴 HIGH — Moderation filter bypassed by trailing `!`
`moderationPolicy.ts:300` — the leet fold `[1!|]→i` runs *before* punctuation stripping, so `!` becomes a literal `i` glued to the word: `"kill yourself!"` → `"kill yourselfi"` → the `kill yourself` hard-block never matches. Verified bypasses: `kill yourself!`, `faggot!`, `kys!`, `what the fuck!`. Also `1` is folded to `i` but leetspeak `1` conventionally means `l`, so `"ki11 yourself"` → `"kiii yourself"` evades too.
**Fix:** only fold digits/symbols when inside a letter run, strip trailing `!?` before folding, try both `1→l` and `1→i`. Add these exact strings as regression cases.

### 2.4 🟠 MEDIUM — Class-reminder suppression is UCI-only
`academicCalendar.ts:159-196` — `isTermInSession`/`getTermEndDate` read only `LOCAL_FALLBACK` (UCI, 4 terms through 2026-Fall) and ignore the Supabase table that's the source of truth elsewhere. For any other school or any term after 2026-Fall they return null → `isTermInSession` is `true` forever → class reminders keep firing for ended terms and never suppress correctly off-UCI.

### 2.5 Other multi-school items
- `academicCalendar.ts` D-day math uses **device** timezone while everything else uses school tz — off-by-one badges / events vanishing ~16h early for a traveling user (`HomeScreen.tsx:2147,4047,4199`).
- Several seed scripts hardcode UCI term shapes; Cornell weekend-day parsing drops Sat/Sun (`§4`).
- `'unknown@uci.edu'` fallbacks and UC-campus brand data are UCI-hardcoded in the multi-school Settings/onboarding flow.

---

## 3. Client bugs by area

### 3.1 App.tsx (root) — from the earlier dedicated review
- 🔴 Comment notifications die after 100 comments (`ascending+limit(100)` returns *oldest* 100) — `App.tsx:1509-1530`.
- 🔴 No `addNotificationResponseReceivedListener` anywhere → tapping any notification just cold-opens Home; all the routing `data` payloads are dead.
- 🔴 iOS 64-pending-notification cap: reminders scheduled last (assignments, sports) are silently dropped for a full schedule.
- 🟠 Logout never clears the server `expo_push_token` → a logged-out (or next) user keeps receiving pushes.
- 🟠 Onboarding-flag gap for legacy settings rows with `profileSetupComplete === undefined`.
- 🟡 The 3-second forced splash "for ad impressions" shows no ad (AdMob IDs imported nowhere, slot is an empty placeholder) — every login pays 3s for nothing.
- 🟡 `TabItem` declared inside render → all 5 tabs remount on every state change (incl. 60s badge polls).

### 3.2 HomeScreen.tsx
- 🟠 `toggleCalendarTask` runs `AsyncStorage.setItem` + a parent-App `setState` **inside** a `setState` updater (`:1685-1699`) → "Cannot update a component while rendering" + double-fire under StrictMode.
- 🟠 `syncCalendarTasks` has no cancellation guard (`:1470-1527`) → account switch mid-fetch bleeds user A's assignments into user B's view and cache.
- 🟠 `parseIcsDate` ignores `DTSTART;TZID=` (`:715-755`) → Blackboard/Moodle Eastern feeds land 3h off for a Pacific user (Canvas UTC is fine).
- 🟡 Date-keyed sports/dining caches never roll over past midnight while mounted; VEVENTs without a UID are silently dropped; custom event dates like `2026-02-31` render "D-NaN".
- 💡 **~700 lines of dead hero-carousel code** (`renderHeroCardContent` is only ever called with `mainHeroItem`; `diningMenu`/`sportsEvents`/`campusInfo`/`course`/`completedSummary` branches, `getHeroItemKey`, and `ProgressRing` are all unreachable). Also: evenings after the last class never show a "done for today" state.

### 3.3 BoardScreen + MessagesScreen
- 🟠 **Block clobbering** (`BoardScreen:2065`, `MessagesScreen:1058`): `blocks` has one row per pair but Board writes `source:'board'` and Messages writes `source:'friend'`; the `onConflict` upsert overwrites `source`, so blocking someone in one place silently un-blocks them in the other.
- 🟠 `handleDeletePost` (`:1955-1968`) deletes comments/votes **before** the post row and only surfaces the final error → a mid-sequence failure permanently loses all comments/likes while the post remains.
- 🟠 Attachment upload (`:1781`) uses `Promise.all` with no write-back or cleanup → a partial failure orphans uploaded images in the bucket and re-uploads all of them on retry.
- 🟠 Board hard-capped at `.limit(100)` with no pagination (`:1227`) → posts 101+ are unreachable and "search all posts" only searches the newest 100.
- 🟠 Unread counts starve under the shared 200-row preview fetch (`MessagesScreen:494`) → a busy chat overnight makes another chat's badge undercount.
- 🟡 `commentsLoading` state is never rendered (shows "No comments yet." while loading); blocked authors' posts still open via deep-link; DMs run **no** client moderation.

### 3.4 TimetableScreen + GradesScreen + PreviewTimetable
- 🟠 **No overlap layout** (`TimetableScreen:2285-2367`): conflicting blocks render at identical full-width coords, so the buried course is invisible and untappable — can't be removed from the grid.
- 🟠 Unit overrides are never persisted (`GradesScreen:876,1584`) → set units, relaunch, GPA silently reverts.
- 🟠 Optimistic grade clobbered by the in-flight initial load (`:939-945`) despite the comment claiming otherwise.
- 🟠 Grades only reads the timetable literally named `"My Schedule"` (`:873,1274`) → rename your plan and the whole term drops out of GPA/chart.
- 🟠 A genuine 0.00 (all-F) term is treated as "no data" and vanishes from the trend chart (`:1302,1327`).
- 🟠 Add-Term modal poisons its seeded-quarters cache with an empty set when opened offline (`TimetableScreen:947`); Discord-link cache omits school → cross-school link collision (`:253`); Instagram Story share passes a bundle id where a numeric Meta App ID is required (`:1166`).
- 🟡 `getCourseEndHour` crashes on a time string without `" - "` (`:322`, and `PreviewTimetable:33`); Reviews button shows for CUSTOM blocks; units picker hardcoded 1–5; several hardcoded light borders in dark mode.

### 3.5 CoursePicker + ReviewsModal
- 🟠 Day filter hides required discussion/lab sections (`:2116` requires `isPrimaryClassSection`) → filtering "Mon" makes a Monday discussion unaddable and can falsely say "No class meetings match".
- 🟠 `enrollmentCache` keyed by bare section code with no quarter scope → UCI's reused codes show a previous quarter's enrolled/capacity/waitlist.
- 🟠 `reviewSummaryCache` + grade-dist cache omit school and aren't cleared on school switch → a course code shared across schools shows the wrong school's rating/histogram (the grade-dist key `${dept}${courseNumber}${instructor}` also has no separators: "ART"+"S100" == "ARTS"+"100").
- 🟠 ReviewsModal never resets `reviews` on open and keeps stale state on fetch error → opening course B during a network blip shows course A's reviews and averaged stats under B's header.
- 🟠 GE fetch has no pagination → silent 1000-row PostgREST cap truncates later departments.
- 🟠 `getCourseEndHour` TypeError on non-`" - "` time; legacy NULL-school review rows can't be edited/deleted (match 0 rows, no error → false success).

### 3.6 FriendsScreen
- 🟠 **Blocking doesn't gate the friend-request flow** (`:741-802`, and the INSERT RLS policy) — a blocked user can immediately re-send a request; search results don't exclude blocked users either direction.
- 🟠 Stale AsyncStorage cache can show a friend's timetable after they went private (`:379-394,641-665`) — the 0-row refetch early-return keeps the cached courses.
- 🟠 An `@`-prefixed search dumps 50 arbitrary same-school profiles (`:588` — `emailTerm` becomes `''` → `ilike.%%`).
- 🟡 Accepted friend hardcoded to `visibility:'friends'`; `friendAvailableQuarters`/`friendQuarter` not reset on friend/school switch; `Math.max(360, …)` should be `Math.min` (`:1014`).

### 3.7 Settings + Auth + Onboarding
- 🟠 Admin tools are **client-gated only** (`SettingsScreen:52,2323`) — moderator emails ship in the bundle and, per the code's own SQL hint (`:1687`), the intended `boards` DELETE policy grants delete to *every* authenticated user (ties to §1.1).
- 🟠 School email-domain restriction is enforced only client-side after a valid session is issued (`SignInScreen:79`, `SignUpScreen:95`) — a non-student who completes OAuth keeps a working session with a patched client.
- 🟡 Onboarding saves invalid/partial DOBs that later block *all* profile edits; the async social-links fetch clobbers in-progress typing; swipe-back discards unsaved form input with no confirmation; OAuth failures always surface as "No token returned."

### 3.8 Scripts
- 🟠 `send-push-announcement.js` has no retry/backoff or checkpoint (`:159`) → a mid-run 429 aborts after N batches, and re-running `--send` re-pushes everyone already notified.
- 🟠 `backfill --only-subjects uci:...` silently reseeds **every** UCI department (`backfill:187` passes `argv[4]`, `seed-sections.js` reads only `argv[2/3]`).
- 🟠 Cornell weekend days dropped → `'TBA'` (`seed-cornell:136`); subject-scoped UIUC/Banner reruns null out `dept_name`; cancelled/stale sections are never deleted (upsert-only) so students can still add a cancelled class.
- 🟡 Two scripts paginate `.range()` with no `.order()` (skip/dup rows — the team already fixed this exact bug elsewhere); `reconcile-school-terms.js` defaults to the production DB with hardcoded fallback creds when env vars are absent.
- ✅ **No service-role keys are committed** anywhere; upsert conflict keys are correct; the push script's dry-run-by-default + token-format + opt-in safety is solid.

---

## 4. What's genuinely solid (verified working)

- **TypeScript compiles clean** — zero errors across the whole project.
- **Auth/session restore** (App.tsx): timeout-guarded validation, transient-failure tolerance, deferred-out-of-callback to dodge the supabase-js auth-lock deadlock, correct SIGNED_OUT suppression during pre-OAuth signout.
- **Race/staleness discipline** across screens: `cancelled` flags, request-id/generation refs, `selectedXRef.current?.id !== …` guards before every post-await state write, `JSON.parse` in try/catch everywhere.
- **Realtime hygiene**: per-conversation channels with `removeChannel` cleanup and late-event guards.
- **Timezone core** (`timeZone.ts`): the two-pass offset inversion and DST-aware day arithmetic are textbook-correct; the app is Hermes-safe (no unguarded non-ISO `new Date(string)` remains anywhere).
- **GPA math**: correctly credit-weighted, P/NP excluded from GPA units; the Fritsch-Carlson monotone-cubic trend curve is a faithful implementation.
- **Grid width math** and `getDaysArray` two-char-token parsing are correct.
- **Backend fundamentals**: domain-suffix validation, owner-scoped writes, cross-school vote-stuffing blocked, catalog tables read-only — the *structure* is right; the four holes above are specific policy bugs, not a missing model.
- **Seed data parity**: all six schools normalize to `"HH:MM - HH:MM"` 24h and the Tuesday-token divergence (`Tu` vs `T`) is correctly absorbed by the app's day parser.

---

## 5. Suggested order of work

1. **Backend RLS pass** (§1.1–1.4) — release-blocking for any multi-user/multi-school launch. One function change fixes the moderator escalation; three policy changes fix friendship-forgery, private-timetable, and the edge-function auth/escaping.
2. **Multi-school correctness** (§2.1–2.4) — `resolveCurrentTerm` in Grades, the sports regex guard, the moderation `!` fold, and the term-in-session fallback. Small diffs, high user impact.
3. **app.json `userInterfaceStyle:"automatic"`** (§3.7 / §2, one line) — restores dark mode for all production users.
4. **Notification deep-links + push-token-on-logout + 64-cap budgeting** (App.tsx) — makes the whole notification system trustworthy.
5. **Blocking unification** (§3.3, §3.6) — make a block a single global fact and enforce it in the friend-request path.
6. **Board pagination** (§3.3) — before any school crosses ~100 posts.
7. Polish: dead hero-carousel removal (~700 lines), dark-mode color fixes, cache-key scoping, the many LOW items.

*Full per-file findings with every line number and failure scenario are preserved in the reviewer notes; this document is the consolidated view.*

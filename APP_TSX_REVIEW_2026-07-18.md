# App.tsx Full Review — 2026-07-18

**Scope:** Complete read of `App.tsx` (3,344 lines) — the root component owning auth, tab navigation, global timetable state, notification scheduling, unread/board badges, social notification polling, settings persistence, and account deletion.
**Method:** Line-by-line read of App.tsx; cross-checked against `src/data/courses.ts`, `src/data/userPreferences.ts`, `src/components/ScheduleLoader.tsx`, `src/screens/SettingsScreen.tsx`; project-wide greps for notification listeners, AdMob usage, and storage buckets; full `npx tsc --noEmit` type check. Context from `CLAUDE.md`, `AGENTS.md`, `COMPARISON.md`, `ClassMate_UC_API_Outreach.md`.

---

## Progress Log

| Step | Action | Result |
|---|---|---|
| 1 | Read `CLAUDE.md`, `AGENTS.md`, `COMPARISON.md`, outreach doc | Context established (multi-school ClassMate app, Supabase backend, Anteater API) |
| 2 | Read `App.tsx` lines 1–3344 in full | All findings below |
| 3 | `npx tsc --noEmit` | ✅ **Passes clean — zero type errors** |
| 4 | Grep for `addNotificationResponseReceivedListener` app-wide | ❌ **Not found anywhere** — see Bug #2 |
| 5 | Grep for `ADMOB_*` imports app-wide | Constants exported in App.tsx but **never imported/used** — see Bug #14 |
| 6 | Verified time format (`courses.ts`) | Times stored 24-hour; `parseTimeStart` in App.tsx is correct ✅ |
| 7 | Verified `hasCompletedProfileSetup` / `needsInitialOnboarding` | Confirmed onboarding branch gap — see Bug #5 |
| 8 | Grep storage buckets | Only `board-attachments` used app-wide; account deletion covers it ✅ |

---

## What Works Correctly (verified)

- **TypeScript**: whole project compiles with no errors.
- **Auth/session restore** is robust: `getSession()` → deferred `getUser()` validation with an 8s timeout, transient network failures keep the local session instead of kicking the user to Welcome, `TOKEN_REFRESHED` for the same user short-circuits (no mid-session splash reset), validation is deferred out of the `onAuthStateChange` callback with `setTimeout(0)` to avoid the supabase-js auth-lock deadlock, and `suppressNextSignedOutClearRef` correctly distinguishes intentional pre-OAuth `signOut()` from real logouts.
- **`handleToggleCourse`** computes from the functional `setTimetables` updater, so two rapid toggles can't clobber each other (the race fix from Session 91 is intact).
- **Timezone handling for reminders** is right: class/daily-summary notifications are built in the *school's* timezone (not the user override), so a 10:00 PT class never reminds at 10:00 ET. `isTermInSession` correctly stops reminders after finals end.
- **`parseCourseDays`** correctly tokenizes `Th`/`Sa`/`Su` before single letters; `weekdayIndex` map is consistent with it.
- **Social notification baseline**: first snapshot seeds the "seen" sets without notifying, and a failed bootstrap treats the first successful poll as baseline — no notification blast on app launch, even after a launch-time network blip.
- **Assignment reminder offsets** normalization deliberately does *not* re-add the default 60-minute offset (comment at line 453 documents why) — deselecting "1 hour before" sticks. Correct.
- **Missing-`school`-column fallbacks** on every timetable query keep the app working against a pre-migration database (only for the default school, which is the right scope).
- **Board badge** seeds the last-seen marker on first run (count = 0 instead of "everything is new").
- **`AuthNavigator`** slide animations use `useLayoutEffect` + JS-driver as documented; push-guard prevents duplicate screens.
- **Notification identifiers** are namespaced per user + school (`classmate-reminder:<user>:<school>:...`) so reschedules only cancel their own notifications.
- **iOS 26 / Expo SDK 55 notification handler** uses the new `shouldShowBanner`/`shouldShowList` shape (not deprecated `shouldShowAlert`). ✅

---

## Bugs Found (ordered by severity)

### 1. 🔴 Comment notifications silently die after 100 comments
`App.tsx:1509-1530` — both comment-notification queries use
`.order('created_at', { ascending: true }).limit(100)`.
Ascending + limit returns the **oldest** 100 comments. Once a user's posts have accumulated more than 100 total comments, any *new* comment falls outside the window, never enters the snapshot, and never triggers a notification — permanently. The messages query nearby does it correctly (`descending` + `limit` + `.reverse()`, line 1462-1470). Fix: order descending, limit 100, then reverse.

### 2. 🔴 Notification taps go nowhere — all `data` payloads are dead
Every notification carries a routed payload (`type: 'conversation-message'`, `'post-comment'`, `'class-reminder'`, `'friend-request'`…), but there is **no `Notifications.addNotificationResponseReceivedListener` anywhere in the codebase** (verified by grep). Tapping any notification just cold-opens the app on the Home tab. All the navigation metadata being carefully attached is never read. This is half of a deep-linking feature — the sending half — with the receiving half missing.

### 3. 🔴 iOS 64-scheduled-notification cap will silently drop reminders
`rescheduleReminderNotifications` (App.tsx:1756-1906) schedules, in order:
daily summaries (up to 14) → class reminders (courses × meeting days × 14 days; 5 classes on MWF alone ≈ 30) → assignment reminders (up to 4 offsets × every assignment due within 60 days) → sports reminders (14 days).
iOS caps pending local notifications at **64 per app** and silently discards the rest. A typical full schedule blows past 64, and because assignments and sports are scheduled *last*, they are the ones silently dropped — arguably the highest-value reminders. Fix: collect all candidates, sort by `notifyAt`, schedule only the earliest ~60, and re-run the scheduler more often (it already re-runs on app foreground via effect deps).

### 4. 🟠 Logout leaves the Expo push token live on the server
`handleLogout` (App.tsx:2276) cancels local notifications and signs out, but never clears `user_settings.expo_push_token`. Server-sent pushes (`scripts/send-push-announcement.js`) will keep delivering to a device whose user has logged out — and if a different person then uses the device, they receive the previous user's pushes. Fix: `saveUserSettingsRow` with `expo_push_token: null` (or a targeted `update`) *before* `signOut()`, while the session is still valid.

### 5. 🟠 Onboarding-flag gap for legacy settings rows
App.tsx:1279-1296 — the branch chain covers `(!profileRow && !settingsRow)`, `(!settingsRow)`, `profileSetupComplete === false`, and `hasCompletedProfileSetup(...) === true`. If a `settingsRow` exists but `profile_details.profileSetupComplete` is **undefined** (any row written before that flag existed), *no branch runs* and `needsFeatureOnboarding` / `showNotificationPermissionPrompt` keep whatever stale values they had from the previous auth state. Add a final `else` that resolves the flags explicitly.

### 6. 🟠 `handleResolveCourseConflicts` / `handleReplaceCourse` use render-captured state
`handleToggleCourse` was deliberately rewritten (Session 91) to compute inside the functional updater; `handleResolveCourseConflicts` (App.tsx:2101) still reads `activeTimetable.courses` from the render closure, and `handleReplaceCourse` finds the target inside the updater but keys off a render-captured `activeTimetable.id`. A conflict-resolve landing right after another mutation can resurrect the pre-mutation course list. Low probability, same class of bug that was already fixed once — worth unifying.

### 7. 🟠 `TabItem` is declared inside the render body
App.tsx:3028 — `TabItem` is a new component *type* on every `AppContent` render, so React unmounts and remounts all five tab items on every state change (which includes every 60s badge poll). In-flight presses get cancelled and the subtree re-created. Hoist it to module scope (pass colors/sizes as props) or wrap the definition in `useCallback`-stable form.

### 8. 🟡 Realtime message-badge channel listens to the entire table
App.tsx:1038-1061 — the `postgres_changes` subscriptions on `conversation_messages` INSERT/UPDATE have **no filter**, so every message sent by anyone in any school triggers a 3-query unread refresh on every online client. Works now; will not scale. Filter by conversation membership (or debounce + filter server-side via a broadcast channel).

### 9. 🟡 Like notifications re-fire on unlike → re-like
The seen-likes set is rebuilt from the current snapshot each poll (App.tsx:1727-1730). Unlike removes the key; re-like makes it "new" again → duplicate notification. Toggling a like repeatedly notifies repeatedly. Track seen keys additively (union) instead of replacing.

### 10. 🟡 `notifications.messages` force-overridden to `true` on every load
App.tsx:1304 — `messages: true` is hardcoded into the loaded settings. There is no messages toggle in `SettingsScreen` (verified), so this is currently self-consistent, but if the toggle ships later this line will silently reset it every launch. Add a comment or remove the override.

### 11. 🟡 Unread badge counts at most 500 recent messages
`loadUnreadMessageCount` fetches the latest 500 messages across all conversations and counts client-side. Heavy users undercount. A Postgres RPC (`count(*) where created_at > last_read_at group by conversation`) would be exact and 1 round-trip instead of 3.

### 12. 🟡 Double session validation at cold start
Both `restoreSession()` and the `INITIAL_SESSION` auth event call `validateAndHydrateSession`. The `userIdRef` guard only helps after the first `setUserId` commits, so both can pass the guard and run `getUser()` + full bootstrap twice. Harmless (idempotent) but doubles launch network work.

### 13. 🟡 Theme-bootstrap splash is always dark
`App()` (App.tsx:3338) shows a hardcoded `#09111d` screen before the theme preference loads — light-theme users get a dark flash at every cold start. The later `authInitializing` splash respects `isDark`; this first one should too (or read the system scheme synchronously).

### 14. 🟡 3-second forced splash for ads that don't exist
App.tsx:1327-1331 holds the loading screen a minimum of 3,000ms "광고 노출을 위해" — but the ad slot in `ScheduleLoader.tsx` is an empty placeholder comment, and the exported `ADMOB_*` unit IDs are imported nowhere. Every login pays a 3-second tax for an ad impression that never renders. Recommend dropping `MIN_SPLASH_MS` to 0 until the AdMob SDK is actually integrated.

### 15. ⚪ Minor / hygiene
- `handleReorderTimetables` and the rename inside `handleDeleteTimetable` ignore their Supabase errors — silent order/name drift on failure.
- `handleDeleteTimetable` deletes with `.eq('school', currentSchool)`; if the row's school value is out of sync the delete matches 0 rows *without error*, local state removes it, and it resurrects on next launch.
- `AuthNavigator`'s PanResponder captures `W` (window width) at first render — after rotation, swipe-back thresholds/exit target use the stale width.
- `createTimetable` inside the `load()` effect computes `nextOrder` from a stale `timetables` closure (eslint-disable'd deps). Fine for the new-user path, fragile if reused.
- `(pillXAnim as any)._value` reads a private Animated API — works, but an `addListener`-tracked ref is the supported pattern.
- Board badge counts only the latest 100 posts — badge caps at 100 (cosmetic).

---

## Feature Suggestions

### Directly unblocked by the bugs above
1. **Notification deep-links** (fixes Bug #2): a small `addNotificationResponseReceivedListener` in `AppContent` switching on `data.type` → open Messages/Board post/Friends tab. All payloads already exist; this is ~40 lines and makes every notification 2× more useful.
2. **Reminder budget manager** (fixes Bug #3): central `scheduleWithBudget()` that sorts all pending reminders by time and keeps the earliest 60.

### High value (echoing COMPARISON.md, still open)
3. **.ics calendar export** — still the #1 gap vs AntAlmanac; `expo-file-system` + `expo-sharing` are already dependencies. One button on TimetableScreen.
4. **Course open/waitlist push notifications** — enrollment-season killer feature; the push-token plumbing and `send-push-announcement.js` infra already exist, needs a Supabase Edge Function polling WebSoc.
5. **Advanced search filters** (days / time window / units / level) in CoursePicker.
6. **Share schedule as link/deep link** — pairs with the existing friends system.

### Product polish observed while reading App.tsx
7. **Keep Board/Friends mounted like Home** — Home uses `display:none` to survive tab switches, but Timetable/Grades/Board/Friends unmount and refetch on every visit. Board especially would feel much faster with the same treatment.
8. **Aggregate social notifications** — the poll fires one notification per new item; 5 new comments = 5 banners. Batch into "5 new comments on your posts."
9. **Suppress message notifications while the conversation is open** — `presentInAppNotification` fires even when MessagesScreen is showing that chat.
10. **Multi-device push tokens** — `expo_push_token` is a single column; logging in on a tablet silently steals push delivery from the phone. A `push_tokens (user_id, token, device_id)` table fixes this and Bug #4 together.
11. **Crash/error reporting** (Sentry `@sentry/react-native`) — `AppErrorBoundary` exists but nothing reports; you're flying blind on production crashes.
12. **COMPARISON.md is stale** — Custom Blocks (custom events), DMs, and class reminders are now implemented but the table still lists them ❌/"not wired." Worth refreshing before using it for planning.

---

## Verdict

App.tsx is in **good shape overall** — it type-checks clean, the auth/session and race-condition hardening from Sessions 91–93 is genuinely solid, and the notification-scheduling logic is more timezone-correct than most shipping apps. The three issues I'd fix before the next release: the comment-notification ordering bug (#1, silent feature death), notification tap handling (#2, half-built feature), and the iOS 64-notification cap (#3, silent reminder loss). #4 (push token on logout) matters before any real push-announcement campaign.

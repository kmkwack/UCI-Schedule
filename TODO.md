# ClassMate — To-Do / Deferred Work

> Created 2026-07-25 after the full security + code review. Full findings live in
> `FULL_CODEBASE_REVIEW_2026-07-18.md` and `APP_TSX_REVIEW_2026-07-18.md`.
> The RLS security migration (`supabase/sql/security_hardening_2026-07-18.sql`) is
> **already applied to the live database and verified.** The items below are NOT
> yet done.

---

## 🔴 1. Deploy the hardened `social-notifier` edge function  (DEFERRED — do before public launch)

**Status:** the fixed code is in `supabase/functions/social-notifier/index.ts` but is
**NOT deployed** — the old (vulnerable) version is still running on Supabase.
Deploying is server-side only; it does NOT require an app build and does NOT affect
App Store review.

**What the fix does:** requires a secret header so strangers can't forge calls that
send push/email to arbitrary users; HTML-escapes user text in emails (anti-phishing);
URL-encodes ids in queries; honors the "messages off" preference.

**⚠️ Do the steps in this order (the function fails closed — wrong order = notifications go silent):**
> Secret → Webhook headers → Deploy code → Test.

### Step 1 — Generate a secret
```bash
openssl rand -hex 32
```
Copy the 64-char output. Call it `YOUR_SECRET`. Keep it private.

### Step 2 — Store it in Supabase
- Dashboard: **Edge Functions → Secrets** (or Project Settings → Edge Functions) → Add:
  name `WEBHOOK_SECRET`, value `YOUR_SECRET`.
- Or CLI: `supabase secrets set WEBHOOK_SECRET=YOUR_SECRET`

### Step 3 — Add the header to every webhook that calls the function
Dashboard → **Database → Webhooks**. For each webhook targeting `social-notifier`
(tables: `friend_requests`, `direct_messages`, `conversation_messages`,
`post_comments`, `post_votes`, `post_comment_votes`): Edit → HTTP Headers → add
`x-webhook-secret` = `YOUR_SECRET` → Save.
- If notifications are wired as SQL triggers instead (nothing under Database →
  Webhooks), the header goes into the trigger's `net.http_post(...)` headers — ask
  the agent for that SQL. Check with:
  `select id, name, table_name from supabase_functions.hooks order by name;`

### Step 4 — Deploy the code
- Dashboard: Edge Functions → `social-notifier` → editor → paste current
  `index.ts` contents → Deploy.
- Or CLI (repo root):
  ```bash
  supabase login
  supabase link --project-ref YOUR_PROJECT_REF   # Project Settings → General
  supabase functions deploy social-notifier
  ```

### Step 5 — Test right after (don't skip)
1. Two test accounts: one sends the other a DM or friend request → recipient still
   gets push/email.
2. If notifications stopped → a webhook header value doesn't match the secret
   (recheck Step 3; usually a typo).
3. Optional proof it's locked: `curl -i -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/social-notifier`
   → expect **401 Unauthorized**.

**Rollback if needed:** redeploy the previous function version, or remove the
`WEBHOOK_SECRET` check block, to stop rejecting calls while you fix the header.

---

## ✅ 1b. Run `supabase/sql/delete_own_post.sql`  — DONE 2026-07-25

Atomic `delete_own_post(uuid)` RPC installed in the live DB (verified present in
`pg_proc`). The app's `handleDeletePost` calls it; takes effect for users once
the new app build (§2) ships.

---

## 🟠 2. Ship an app build to deliver the client-side fixes

The database security is already live, but these code changes only reach users in a
new build (TestFlight / App Store):
- `app.json` — `userInterfaceStyle: "automatic"` (fixes dark mode / Auto theme in production)
- `src/data/userPreferences.ts` — default `timetableVisibility: 'friends'` (was 'private')
- `src/data/moderationPolicy.ts` — trailing-`!` moderation bypass fixed
- `src/data/sportsEvents.ts` — sports events no longer dropped by the name-strip regex
- `src/screens/GradesScreen.tsx` — multi-school current-term fix (non-UCI schools lost a term Jan–May)
- `src/screens/TimetableScreen.tsx`, `PreviewTimetable.tsx`, `CoursePickerScreen.tsx` — parseHour crash guard; Reviews hidden for custom blocks; `%` search-wildcard strip
- `src/screens/FriendsScreen.tsx` — `@`-only search no longer dumps profiles; `%` strip
- `src/screens/HomeScreen.tsx` — assignment-checkbox render-phase setState fix; impossible custom-event dates rejected
- `App.tsx` — comment-notification query fixed (was fetching oldest 100, missing new comments)
- `src/lib/supabaseErrors.ts`, `src/components/AppErrorBoundary.tsx`, `scripts/seed-academic-calendar.js` — smaller hardening

---

## 🟡 3. Optional / lower-priority (from the review, not started)

- **Cosmetic:** Grades header shows raw `"Summer10wk 2026"` — add a Summer1/Summer10wk/Summer2 → "Summer" display mapping (L5).
- ~~**Notification deep-linking:** tapping a notification just opens Home.~~ **DONE 2026-07-25** — routes by `data.type` (App.tsx).
- **iOS 64-notification cap:** reminders scheduled last (assignments, sports) can be silently dropped; needs a "schedule earliest ~60" budgeter.
- ~~**Push token on logout:** `handleLogout` doesn't clear the server `expo_push_token`.~~ **DONE 2026-07-25.**
- **Board pagination:** board hard-capped at 100 posts; global search only searches those 100.
- ~~**Blocking unification:** the `blocks.source` column lets a board-block and a DM-block overwrite each other.~~ **DONE 2026-07-25** — blocking is now global (board respects all blocks; unblock clears any source).
- ~~**Dead code:** unused hero-carousel branches in `HomeScreen.tsx`.~~ **DONE 2026-07-25** — removed ~410 lines (unreachable diningMenu/sportsEvents/campusInfo branches, `getHeroItemKey`, `ProgressRing`). The `course`/`completedSummary` arms remain (fused with the live `upcomingSummary` render path).
- **Instagram Story share:** `TimetableScreen.tsx:1166` passes the bundle id where a numeric Meta App ID is required (needs a real value from Meta).
- **Grades:** unit overrides not persisted (needs a `units` column); ~~a genuine 0.00 (all-F) term is hidden~~ **(DONE 2026-07-25)**; only reads a timetable literally named "My Schedule".
- Full list with line numbers + failure scenarios: `FULL_CODEBASE_REVIEW_2026-07-18.md`.

---

## ✅ Done this session (2026-07-18 → 07-25)

- Full codebase review (every file) → the two review `.md` files.
- 12 self-contained client bug fixes (see §2).
- RLS security migration written, **applied to the live DB, and verified** (Section 4A structural check + in-app smoke test). Fixes: grades/timetables/posts/comments/votes were world-readable/writable; timetable privacy toggle now enforced; friend-request forgery; board/moderation gating; message-field tampering; incomplete account deletion. Timetable rule: **accepted friends can view unless the owner sets 'private'.**
- `social-notifier` edge function hardened in code (deploy still pending — §1).
- Grades multi-school fix (§2).

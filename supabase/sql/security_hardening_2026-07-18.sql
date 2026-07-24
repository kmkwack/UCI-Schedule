-- ============================================================================
-- ClassMate — RLS security hardening (2026-07-18)
-- ============================================================================
--
-- ┌────────────────────────────────────────────────────────────────────────┐
-- │ READ THIS FIRST — how Supabase security actually works                  │
-- └────────────────────────────────────────────────────────────────────────┘
--
-- Your app talks to the database with the "anon" (publishable) key. That key
-- is shipped inside your app bundle, so ANYONE can extract it and call your
-- database directly over HTTPS (PostgREST) — they are NOT limited to what your
-- app's screens let them do. They can hand-craft any query they want.
--
-- The ONLY thing standing between an attacker and your data is Row Level
-- Security (RLS): per-table rules that decide, for each row, whether the
-- current user may read or write it. If RLS is wrong, the anon key is a skeleton
-- key to your whole database. So RLS is not "extra hardening" — for a Supabase
-- app it IS the security model. Every rule below is the real fence; the checks
-- your React Native code does are just UI convenience on top of it.
--
-- Four concepts you need to read this file:
--
-- 1. auth.uid()  → the logged-in user's ID, pulled from their signed JWT. It
--    cannot be forged (the JWT is signed by Supabase). This is the trustworthy
--    "who is calling" value. auth.jwt() ->> 'email' is their verified email,
--    also from the signed token (NOT the same as the profiles.email column,
--    which a user can freely edit — that distinction matters below).
--
-- 2. A policy has two halves:
--       USING       → which existing rows this user may SEE / touch (SELECT,
--                     UPDATE, DELETE filter). Rows failing USING are invisible.
--       WITH CHECK  → what the NEW row is allowed to look like (INSERT/UPDATE).
--                     A write producing a row that fails WITH CHECK is rejected.
--    Read operations use USING; inserts use WITH CHECK; updates use both
--    (USING = "may I touch this row", WITH CHECK = "is the result allowed").
--
-- 3. Permissive policies are combined with OR. If a table has ANY policy whose
--    condition is simply `true`, that policy alone allows everything — every
--    other, stricter policy becomes irrelevant. This is the core bug this
--    migration fixes: several tables still have leftover "Allow all for now"
--    policies (condition = true, role = public) from early development. Adding
--    strict policies does nothing until those open ones are DROPPED. So each
--    section first drops the open policy, THEN adds scoped ones.
--
-- 4. `to authenticated` vs `to public`:
--       public        → EVERYONE, including anonymous (not-logged-in) callers.
--       authenticated → only callers presenting a valid login JWT.
--    The old policies were `to public`, meaning even a logged-out stranger with
--    your anon key could act. The new ones are `to authenticated` and, on top of
--    that, restrict to the caller's OWN rows / school / friends.
--
-- ── A schema quirk that dictates how these policies are written ──────────────
-- Your tables are inconsistent about the type of the user id column, so the
-- comparisons must match or the policy silently breaks:
--   • TEXT user_id  → grades, timetables, posts, post_comments, post_votes,
--                     reviews, board_requests.requester_id
--                     ⇒ compare with auth.uid()::text  (cast the uuid to text)
--   • UUID          → friend_requests.sender_id/receiver_id,
--                     conversation_messages.sender_id, post_comment_votes.user_id,
--                     blocks.*, sports_event_*.user_id
--                     ⇒ compare with auth.uid() directly
-- If the cast is wrong, the comparison is never true and users get locked out of
-- their OWN data; that's why every clause below is deliberate about ::text.
-- Also note: `grades` and `friend_requests` have NO `school` column, so their
-- policies are user-scoped only (nothing to filter by school).
--
-- ── How to deploy ───────────────────────────────────────────────────────────
-- Paste into Supabase Dashboard → SQL Editor and Run. The script is idempotent
-- (every CREATE is preceded by DROP ... IF EXISTS), so it is safe to run more
-- than once. Run Section 1 first — it stops active data exposure — then 2, then
-- 3. Section 4 is verification you run afterward. The very bottom has a per-table
-- rollback if something misbehaves.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- Section 0 — shared helper functions
-- These are small reusable checks the policies below call. Defining them once
-- keeps the policies readable and gives you a single place to change the rule.
-- ════════════════════════════════════════════════════════════════════════════

-- is_app_moderator(): "is the current caller one of the app's moderators?"
--
-- WHY THIS EXISTS: several tables (boards, banned_words, board_requests) are
-- meant to be managed only by you/your support account, but their live policies
-- currently allow ANY logged-in student to write them. We need one trustworthy
-- moderator test to gate those tables.
--
-- WHY auth.jwt() ->> 'email' AND NOT profiles.email: a user can run
-- `UPDATE profiles SET email = 'you@uci.edu'` on their own row anytime, so
-- trusting the profiles table for a privilege check would let anyone promote
-- themselves to moderator. The JWT email is set by the identity provider at
-- login and signed by Supabase — it cannot be edited by the user. This mirrors
-- how your existing reports_* policies already (correctly) identify moderators.
--
-- NOTE: it is plain (SECURITY INVOKER) and only reads the caller's own token, so
-- it needs no elevated privileges. To add/remove a moderator later, edit this
-- one array — or replace the body with a lookup against a moderators table.
create or replace function public.is_app_moderator()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() ->> 'email') = any (array['sihyup2@uci.edu', 'kwackk@uci.edu']),
    false
  );
$$;

-- timetable_owner_shares_with_friends(owner_id): "is this timetable's owner OK
-- with friends seeing their schedule?" — i.e. they have NOT set visibility to
-- 'private'. This is what makes the in-app privacy toggle actually take effect on
-- the server (a client-only check would be trivially bypassed via the API).
--
-- WHY SECURITY DEFINER (the subtle, important part): user_settings has its own
-- RLS that only lets a user read THEIR OWN row. A plain policy trying to read a
-- friend's user_settings to check their visibility would be blocked by that RLS,
-- the subquery would yield NULL, and the check could misbehave. SECURITY DEFINER
-- lets this function read the owner's setting reliably while returning only a
-- yes/no boolean (never the raw row).
--
-- WHY the default is VISIBLE (true): the app treats "no explicit choice" as
-- shareable with friends, so only an owner who DELIBERATELY picks 'private' is
-- hidden. `is distinct from 'private'` is null-safe (a NULL value → visible), and
-- coalesce(..., true) covers the "no settings row yet" case. Net rule: friends
-- can see UNLESS the owner explicitly chose 'private'. (Any non-'private' value,
-- including 'friends' and 'public', counts as visible — the app has no non-friend
-- timetable view, so 'public' behaves like 'friends' here.)
create or replace function public.timetable_owner_shares_with_friends(owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select timetable_visibility is distinct from 'private'
       from public.user_settings
      where user_id = owner_id),
    true
  );
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- Section 1 (P0 — DATA-EXPOSURE EMERGENCY — deploy this first)
--
-- Every table in this section currently has an "Allow all" policy (condition =
-- true, role = public). Concretely, TODAY, anyone with your anon key — including
-- someone who never signed in — can read, edit, and delete these rows for EVERY
-- user. That includes personal academic data (grades), everyone's class
-- schedules (timetables), and the entire community board. This section closes
-- that by replacing "anyone can do anything" with "you can touch your own data;
-- friends/classmates can read only what's meant to be shared."
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1a. grades ──────────────────────────────────────────────────────────────
-- WHAT'S WRONG NOW: policy "Allow all for now" (FOR ALL, public, using=true,
-- check=true) means a stranger can run `SELECT * FROM grades` and download every
-- student's GPA, or overwrite/delete them. Grades are among the most sensitive
-- data in the app.
-- THE FIX: grades are never shared with anyone, so lock every operation to the
-- owner. `user_id = auth.uid()::text` = "this grade row belongs to me" (::text
-- because grades.user_id is TEXT). Four separate policies, one per operation, so
-- the intent is explicit and auditable.
drop policy if exists "Allow all for now" on public.grades;

create policy "grades_select_own" on public.grades
  for select to authenticated
  using (user_id = auth.uid()::text);

create policy "grades_insert_own" on public.grades
  for insert to authenticated
  with check (user_id = auth.uid()::text);

create policy "grades_update_own" on public.grades
  for update to authenticated
  using (user_id = auth.uid()::text)          -- may only touch my own rows …
  with check (user_id = auth.uid()::text);    -- … and can't reassign them to someone else

create policy "grades_delete_own" on public.grades
  for delete to authenticated
  using (user_id = auth.uid()::text);


-- ── 1b. timetables ──────────────────────────────────────────────────────────
-- WHAT'S WRONG NOW: policies "Allow all for now" + "allow read/insert/update"
-- (all public, true) make every user's class schedule world-readable and
-- world-writable — anyone can pull any schedule or vandalize someone else's plan.
-- THE FIX:
--   • Owner can do everything to their own rows (insert/update/delete/select).
--   • A DIFFERENT user may SELECT your timetable only when BOTH:
--       (a) they are an accepted, same-school friend
--           (profile_links_prior_history_are_friends — an existing SECURITY
--            DEFINER helper, true only for a confirmed 'accepted' same-school
--            friendship), AND
--       (b) you have not set your timetable to 'private'
--           (timetable_owner_shares_with_friends, Section 0).
--   This is what makes the in-app privacy toggle real: the default is
--   visible-to-friends, and choosing 'private' hides your schedule even from
--   friends. FriendsScreen only ever reads a friend's timetable, so this matches
--   what the app needs.
-- NOTE the `::uuid` casts: timetables.user_id is TEXT but both helpers take a
-- uuid, so we cast the owner id back to uuid to call them.
drop policy if exists "Allow all for now" on public.timetables;
drop policy if exists "allow insert" on public.timetables;
drop policy if exists "allow read"   on public.timetables;
drop policy if exists "allow update" on public.timetables;

create policy "timetables_select_own_or_friend" on public.timetables
  for select to authenticated
  using (
    user_id = auth.uid()::text                                               -- my own timetable, OR …
    or (
      public.profile_links_prior_history_are_friends(user_id::uuid, school)  -- … an accepted same-school friend's,
      and public.timetable_owner_shares_with_friends(user_id::uuid)          -- … unless they chose 'private'
    )
  );

create policy "timetables_insert_own" on public.timetables
  for insert to authenticated
  with check (user_id = auth.uid()::text);

create policy "timetables_update_own" on public.timetables
  for update to authenticated
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

create policy "timetables_delete_own" on public.timetables
  for delete to authenticated
  using (user_id = auth.uid()::text);


-- ── 1c. posts (community board) ─────────────────────────────────────────────
-- WHAT'S WRONG NOW: "Allow all reads/inserts/updates/deletes" (public, true)
-- means anyone — even logged out — can delete or edit ANY post, or insert a post
-- while spoofing another user's user_id/author_name. The board has no real
-- ownership or authorship guarantees at all.
-- THE FIX:
--   • SELECT: only within your own school. profile_links_prior_history_current_school()
--     is an existing SECURITY DEFINER helper returning the caller's school; an
--     anonymous caller has none, so they see nothing. This also enforces the
--     multi-school separation the app assumes.
--   • INSERT: the new row's user_id must be you AND its school must be your
--     school — so you can't post as someone else or into another campus.
--   • UPDATE/DELETE: the author, OR a moderator (so moderators can finally edit,
--     lock, or remove reported content — today no one can moderate a post they
--     didn't write, which the report queue depends on).
drop policy if exists "Allow all reads"   on public.posts;
drop policy if exists "Allow all inserts" on public.posts;
drop policy if exists "Allow all updates" on public.posts;
drop policy if exists "Allow all deletes" on public.posts;

create policy "posts_select_same_school" on public.posts
  for select to authenticated
  using (school = public.profile_links_prior_history_current_school());

create policy "posts_insert_own" on public.posts
  for insert to authenticated
  with check (
    user_id = auth.uid()::text                                            -- can't post as another user
    and school = public.profile_links_prior_history_current_school()      -- can't post into another school
  );

create policy "posts_update_own_or_mod" on public.posts
  for update to authenticated
  using (user_id = auth.uid()::text or public.is_app_moderator())
  with check (user_id = auth.uid()::text or public.is_app_moderator());

create policy "posts_delete_own_or_mod" on public.posts
  for delete to authenticated
  using (user_id = auth.uid()::text or public.is_app_moderator());


-- ── 1d. post_comments ───────────────────────────────────────────────────────
-- WHAT'S WRONG NOW: "Allow all inserts/reads" (public, true) let anyone read all
-- comments and insert comments as anyone. (Good news: this table ALREADY has
-- correct owner-only update/delete policies — post_comments_update_own /
-- _delete_own — so we keep those and only replace the two open ones.)
-- THE FIX:
--   • SELECT: same-school only (matches posts).
--   • INSERT: must be you, in your school, AND the target post must not be
--     locked. The `not exists (... is_locked ...)` clause enforces thread locks
--     server-side — today a moderator can lock a thread but users can still
--     comment via a direct API call.
--   • Add a moderator DELETE so reported comments can actually be removed.
drop policy if exists "Allow all inserts" on public.post_comments;
drop policy if exists "Allow all reads"   on public.post_comments;

create policy "post_comments_select_same_school" on public.post_comments
  for select to authenticated
  using (school = public.profile_links_prior_history_current_school());

create policy "post_comments_insert_own" on public.post_comments
  for insert to authenticated
  with check (
    user_id = auth.uid()::text
    and school = public.profile_links_prior_history_current_school()
    and not exists (                                                        -- reject comments on a locked thread
      select 1 from public.posts p
      where p.id = post_comments.post_id and p.is_locked = true
    )
  );

create policy "post_comments_delete_mod" on public.post_comments
  for delete to authenticated
  using (public.is_app_moderator());
-- (existing post_comments_delete_own / post_comments_update_own remain in place,
--  so authors keep control of their own comments)


-- ── 1e. post_votes (likes) ──────────────────────────────────────────────────
-- WHAT'S WRONG NOW: "Allow all reads/inserts/deletes" (public, true) let anyone
-- stuff or clear likes on any post, in any school, as any user — so the vote
-- counts are meaningless and manipulable.
-- THE FIX: read within your school; a vote you insert must be yours and in your
-- school; you may only remove your own vote. (post_comment_votes already has
-- correct policies and is intentionally left untouched.)
drop policy if exists "Allow all reads"   on public.post_votes;
drop policy if exists "Allow all inserts" on public.post_votes;
drop policy if exists "Allow all deletes" on public.post_votes;

create policy "post_votes_select_same_school" on public.post_votes
  for select to authenticated
  using (school = public.profile_links_prior_history_current_school());

create policy "post_votes_insert_own" on public.post_votes
  for insert to authenticated
  with check (
    user_id = auth.uid()::text
    and school = public.profile_links_prior_history_current_school()
  );

create policy "post_votes_delete_own" on public.post_votes
  for delete to authenticated
  using (user_id = auth.uid()::text);


-- ════════════════════════════════════════════════════════════════════════════
-- Section 2 (P1 — INTEGRITY / ABUSE — deploy after Section 1)
--
-- These tables aren't world-writable like Section 1, but their live policies are
-- too loose in specific ways a logged-in user could abuse: forging a friendship,
-- deleting the whole board list, wiping the banned-words filter, etc.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 2a. friend_requests ─────────────────────────────────────────────────────
-- WHAT'S WRONG NOW: two problems combine into a real exploit.
--   (i) The INSERT policy only checks `sender_id = auth.uid()` — it does NOT
--       constrain `status`. So a user can insert a row already marked
--       status='accepted', fabricating a friendship the other person never
--       agreed to.
--   (ii) A legacy UPDATE policy "Users can update their own friend requests"
--        lets EITHER party update the row. Because permissive policies OR
--        together, this defeats the stricter receiver-only policy: a sender can
--        send a pending request and then update it to 'accepted' themselves.
-- WHY IT MATTERS: an accepted friendship is a key that unlocks the victim's
-- shared timetable, their friends-only profile links, and a direct-message
-- channel (get_or_create_conversation trusts the friendship). Forging it is a
-- privacy breach, not just a cosmetic bug.
-- THE FIX:
--   • Drop the permissive either-party UPDATE policy. The already-present
--     friend_requests_update_receiver (receiver-only) then governs acceptance —
--     only the person who RECEIVED the request can accept/reject it.
--   • Recreate INSERT so a new request must be `status = 'pending'`. You can
--     still send requests; you just can't insert a pre-accepted one.
--   (SELECT stays own-rows-only; DELETE by either party stays, so cancelling a
--    request you sent and declining one you received both still work.)
drop policy if exists "Users can update their own friend requests" on public.friend_requests;
drop policy if exists "friend_requests_insert_own" on public.friend_requests;

create policy "friend_requests_insert_own" on public.friend_requests
  for insert to authenticated
  with check (auth.uid() = sender_id and status = 'pending');  -- sender_id is UUID → no ::text cast
-- (friend_requests_update_receiver, friend_requests_select_own, and
--  "Users can delete their own friend requests" remain in place)


-- ── 2b. reviews ─────────────────────────────────────────────────────────────
-- WHAT'S WRONG NOW: the INSERT policy is `with check (true)` for role public —
-- anyone (even logged out) can insert a course review, set any user_id/author,
-- and stuff any school's ratings. (Read/update/delete are already owner-scoped,
-- so we only replace INSERT.)
-- THE FIX: an inserted review must belong to the caller (user_id = me) and be in
-- the caller's own school — so reviews are authenticated and can't be forged for
-- another user or planted into a different campus's course.
drop policy if exists "Users can insert reviews" on public.reviews;

create policy "reviews_insert_own" on public.reviews
  for insert to authenticated
  with check (
    user_id = auth.uid()::text
    and school = public.profile_links_prior_history_current_school()
  );
-- (existing read/update/delete policies remain)


-- ── 2c. boards (the list of community boards) ───────────────────────────────
-- WHAT'S WRONG NOW: DELETE and INSERT are gated on `auth.role() = 'authenticated'`
-- — i.e. ANY logged-in student, not just moderators. One student could delete
-- every board in the app, or spam new ones. (Reading the board list stays open,
-- which is fine — that's just navigation.)
-- THE FIX: creating and deleting boards is a moderator action. is_app_moderator()
-- (Section 0) is the trustworthy, JWT-based check.
drop policy if exists "Authenticated users can delete boards" on public.boards;
drop policy if exists "Authenticated users can insert boards" on public.boards;

create policy "boards_insert_mod" on public.boards
  for insert to authenticated
  with check (public.is_app_moderator());

create policy "boards_delete_mod" on public.boards
  for delete to authenticated
  using (public.is_app_moderator());


-- ── 2d. banned_words (the moderation word list) ─────────────────────────────
-- WHAT'S WRONG NOW: the policy is named "Moderators manage banned words" but its
-- actual condition is `auth.role() = 'authenticated'` — so any logged-in user can
-- add or, worse, DELETE entries, silently disabling your profanity/abuse filter.
-- THE FIX: restrict all management to moderators. Reads stay public because the
-- app/filter needs to load the list.
drop policy if exists "Moderators manage banned words" on public.banned_words;

create policy "banned_words_manage_mod" on public.banned_words
  for all to authenticated
  using (public.is_app_moderator())
  with check (public.is_app_moderator());


-- ── 2e. board_requests (user-submitted "please add this board") ─────────────
-- WHAT'S WRONG NOW: SELECT and UPDATE are `using (true)` for role public despite
-- being named "Moderators can …" — so anyone can read the whole request queue
-- and change any request's status. INSERT is `with check (true)` — anyone can
-- submit a request as any requester_id.
-- THE FIX:
--   • INSERT: a normal user may submit, but the row's requester_id must be them
--     (no submitting on someone else's behalf). This is intentionally NOT
--     moderator-gated — requesting a board is a normal user action.
--   • SELECT + UPDATE (reading the queue, resolving/rejecting a request): only
--     moderators.
drop policy if exists "Moderators can read board requests"   on public.board_requests;
drop policy if exists "Moderators can update board requests" on public.board_requests;
drop policy if exists "Users can insert board requests"      on public.board_requests;

create policy "board_requests_insert_own" on public.board_requests
  for insert to authenticated
  with check (requester_id = auth.uid()::text);   -- requester_id is TEXT → ::text

create policy "board_requests_select_mod" on public.board_requests
  for select to authenticated
  using (public.is_app_moderator());

create policy "board_requests_update_mod" on public.board_requests
  for update to authenticated
  using (public.is_app_moderator())
  with check (public.is_app_moderator());


-- ════════════════════════════════════════════════════════════════════════════
-- Section 3 (P2 — HARDENING — deploy after Sections 1 & 2)
--
-- These don't stop an open door; they close subtler gaps in message integrity
-- and account deletion. Lower urgency, still worth doing.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 3a. conversation_messages — lock the immutable fields ───────────────────
-- WHAT'S WRONG NOW: the "Senders can soft-delete messages" UPDATE policy only
-- checks `sender_id = auth.uid()`. It does NOT stop the sender from changing
-- other columns on that row. So a sender could repoint their message into a
-- DIFFERENT conversation (change conversation_id — potentially injecting a
-- message into a chat they aren't in), or rewrite its created_at timestamp.
-- WHY A TRIGGER INSTEAD OF A POLICY: RLS WITH CHECK can only inspect the NEW row;
-- it cannot compare NEW vs OLD, so it can't express "you may change content and
-- deleted_at but not conversation_id". A BEFORE UPDATE trigger can see both OLD
-- and NEW, so it's the right tool. `is distinct from` is null-safe equality.
-- WHAT STAYS ALLOWED (important — don't break features): editing a message
-- (MessagesScreen updates `content`) and soft-deleting it (setting deleted_at)
-- are still permitted; only conversation_id / sender_id / created_at are frozen.
create or replace function public.enforce_conversation_message_immutable_fields()
returns trigger
language plpgsql
as $$
begin
  if new.conversation_id is distinct from old.conversation_id
     or new.sender_id is distinct from old.sender_id
     or new.created_at is distinct from old.created_at then
    raise exception 'conversation_id, sender_id and created_at are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_conversation_message_immutable on public.conversation_messages;
create trigger trg_conversation_message_immutable
  before update on public.conversation_messages
  for each row execute function public.enforce_conversation_message_immutable_fields();


-- ── 3b. delete_current_user — make "delete my account" actually complete ────
-- WHAT'S WRONG NOW: your existing delete_current_user() (the function the app
-- calls when a user deletes their account) removes most tables but LEAVES BEHIND:
--   • blocks — rows where the user blocked someone (or was blocked) persist,
--     referencing a now-deleted account. This can leave dangling ids the app's
--     block-filter queries then trip over.
--   • the user's conversation footprint (their messages + participant rows).
--   • sports_event_comments / sports_event_rsvps, submitted course_discord_links,
--     and user_academic_events.
-- For a deletion feature you advertise as "permanently removes your data," those
-- gaps are a correctness and data-retention problem.
-- THE FIX: this is a full CREATE OR REPLACE of the function — every line that was
-- there before is unchanged; the blocks marked "NEW:" are the only additions.
-- For conversations we delete the user's OWN messages and their participant rows
-- but do NOT delete the whole conversation, so the other person keeps their side
-- of the chat history (deleting the shared conversation would erase the other
-- participant's messages too). profile_social_links and prior_academic_records
-- are intentionally NOT listed because they cascade automatically when the
-- auth.users row is deleted at the end (their foreign key is ON DELETE CASCADE).
create or replace function public.delete_current_user()
returns void
language plpgsql
security definer                              -- runs with elevated rights: it must delete across many tables
set search_path to 'public', 'storage', 'auth'
as $function$
declare
  uid uuid := auth.uid();
  uid_text text := auth.uid()::text;
  owned_post_ids uuid[];
  affected_comment_ids uuid[];
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Collect the user's post ids and every comment on those posts (or by the
  -- user) up front, so votes/comments can be cleaned before the posts vanish.
  select coalesce(array_agg(id), '{}'::uuid[])
  into owned_post_ids
  from public.posts
  where user_id::text = uid_text;

  select coalesce(array_agg(id), '{}'::uuid[])
  into affected_comment_ids
  from public.post_comments
  where user_id::text = uid_text
     or post_id = any(owned_post_ids);

  delete from public.post_comment_votes
  where user_id::text = uid_text
     or comment_id = any(affected_comment_ids);

  delete from public.post_votes
  where user_id::text = uid_text
     or post_id = any(owned_post_ids);

  delete from public.reports
  where reporter_id::text = uid_text;

  delete from public.post_comments
  where id = any(affected_comment_ids);

  delete from public.posts
  where id = any(owned_post_ids);

  delete from public.reviews
  where user_id::text = uid_text;

  delete from public.grades
  where user_id::text = uid_text;

  delete from public.timetables
  where user_id::text = uid_text;

  -- NEW: block relationships in both directions (blocker or blocked).
  delete from public.blocks
  where blocker_id = uid or blocked_id = uid;

  -- NEW: the user's conversation footprint. Delete their own messages and their
  -- participant rows; the conversation and the other person's messages remain,
  -- so we don't wipe the other participant's history.
  delete from public.conversation_messages
  where sender_id = uid;

  delete from public.conversation_participants
  where user_id = uid;

  delete from public.direct_messages
  where sender_id::text = uid_text
     or receiver_id::text = uid_text;

  delete from public.friend_requests
  where sender_id::text = uid_text
     or receiver_id::text = uid_text;

  -- NEW: sports social activity, submitted Discord links, and custom academic
  -- events the user created.
  delete from public.sports_event_comments where user_id = uid;
  delete from public.sports_event_rsvps    where user_id = uid;
  delete from public.course_discord_links  where submitted_by = uid;
  delete from public.user_academic_events  where user_id = uid;

  delete from public.board_requests
  where requester_id::text = uid_text;

  delete from public.user_settings
  where user_id::text = uid_text;

  -- profile_social_links and prior_academic_records are omitted on purpose: they
  -- cascade-delete when the auth.users row goes, via their ON DELETE CASCADE FK.
  delete from public.profiles
  where id::text = uid_text;

  delete from auth.users
  where id = uid;
end;
$function$;


-- ════════════════════════════════════════════════════════════════════════════
-- Section 4 — verification (run these AFTER applying, to prove it worked)
-- ════════════════════════════════════════════════════════════════════════════
--
-- (A) Confirm no open policy survived on the P0 tables. Every row returned
--     should have a real condition — NONE should show qual = 'true' or
--     with_check = 'true':
--
--       select tablename, policyname, cmd, qual, with_check
--       from pg_policies
--       where schemaname = 'public'
--         and tablename in ('grades','timetables','posts','post_comments','post_votes')
--       order by tablename, cmd;
--
-- (B) While signed in as a NORMAL (non-moderator) user, these must all fail or
--     affect 0 rows — proof the fences hold:
--
--       -- someone else's grades: 0 rows updated
--       update public.grades set grade = 'A' where user_id <> auth.uid()::text;
--
--       -- forging an accepted friendship: rejected by the WITH CHECK
--       insert into public.friend_requests (sender_id, receiver_id, status)
--       values (auth.uid(), '00000000-0000-0000-0000-000000000000', 'accepted');
--
--       -- deleting boards as a non-moderator: 0 rows
--       delete from public.boards where true;
--
--       -- other people's timetables: only friends-who-share should return
--       select count(*) from public.timetables where user_id <> auth.uid()::text;
--
-- (C) App smoke test as a regular user — everything should still work normally:
--     open Grades, Timetable, and Board; add a course; create a post, comment,
--     and like; send and accept a friend request; and view the timetable of a
--     friend who shares theirs. If all of that works, the policies match what the
--     app sends and nothing is over-restricted.


-- ════════════════════════════════════════════════════════════════════════════
-- Rollback (use ONLY if a specific table misbehaves after deploy)
-- ════════════════════════════════════════════════════════════════════════════
-- Re-opening a table re-exposes its data, so prefer fixing the scoped policy over
-- rolling back. If you must, recreate that table's permissive policy, e.g.:
--
--   create policy "Allow all for now" on public.grades
--     for all to public using (true) with check (true);
--
-- Then tell me which table and what broke, and I'll correct the scoped policy
-- instead of leaving it open.

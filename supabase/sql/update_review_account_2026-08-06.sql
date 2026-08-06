-- ─────────────────────────────────────────────────────────────────────────────
-- Switch the App Review account from review@classmate.app → review@theseans.app
--
-- WHY: the team does not own classmate.app (third-party domain, listed for
-- sale). The forgot-password flow will email an OTP to any address, so whoever
-- controls classmate.app's mail could reset the review account's password and
-- hijack it. theseans.app is team-owned.
--
-- RUN in the Supabase SQL editor. Idempotent.
--
-- AFTER RUNNING, also:
--   1. Re-run the bootstrap script for the new address:
--      SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
--        REVIEW_EMAIL='review@theseans.app' REVIEW_PASSWORD='...' \
--        node scripts/ensure-review-account.js
--   2. Delete the OLD auth user review@classmate.app in the dashboard
--      (Authentication → Users) so the hijackable account no longer exists.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.app_review_accounts (email, school) values
  ('review@theseans.app', '*')
on conflict do nothing;

delete from public.app_review_accounts
  where email = 'review@classmate.app';

select * from public.app_review_accounts;

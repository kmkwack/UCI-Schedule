-- ─────────────────────────────────────────────────────────────────────────────
-- FIX: "new row violates row-level security policy for table 'profiles'"
--
-- Root cause (found 2026-07-26, this is the real Guideline 2.1(a) rejection):
-- `production_readiness_p2.sql` was only PARTIALLY applied to the live database.
-- The RLS policies on `profiles` were created — they call
-- `public.can_auth_email_use_school(school)` — but the two lookup tables that
-- function reads (`app_school_email_domains`, `app_review_accounts`) do NOT
-- exist in the live DB (verified: PostgREST returns PGRST205 "Could not find
-- the table"). With those tables missing the function can never return true,
-- so EVERY profile INSERT was rejected.
--
-- Why it wasn't caught earlier: existing users already have a `profiles` row,
-- so they take the UPDATE path and keep working. Only a *first* profile insert
-- fails — which is exactly what an App Review tester hits after installing the
-- app fresh (App Review explicitly deletes and reinstalls before testing).
--
-- This script is idempotent and safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create the missing lookup tables + seed data ────────────────────────────

create table if not exists public.app_school_email_domains (
  school text not null,
  email_domain text not null,
  primary key (school, email_domain)
);

insert into public.app_school_email_domains (school, email_domain) values
  ('UC Irvine', 'uci.edu'),
  ('University of Maryland, College Park', 'umd.edu'),
  ('Cornell University', 'cornell.edu'),
  ('Purdue University', 'purdue.edu'),
  ('University of Illinois Urbana-Champaign', 'illinois.edu')
on conflict do nothing;

create table if not exists public.app_review_accounts (
  email text not null,
  school text not null default '*',
  primary key (email, school)
);

insert into public.app_review_accounts (email, school) values
  ('review@theseans.app', '*')
on conflict do nothing;

-- 2. Recreate the gate function ───────────────────────────────────────────────
-- Changed vs production_readiness_p2.sql: the domain check now also accepts
-- departmental subdomains (e.g. someone@ics.uci.edu for UC Irvine). The app's
-- client-side check in SignInScreen/SignUpScreen already allows these
-- ("Accept departmental subdomains too"), so without this the client would let
-- a student in and then the database would reject their profile insert.

create or replace function public.can_auth_email_use_school(target_school text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_review_accounts review_account
    where lower(review_account.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and (review_account.school = '*' or review_account.school = target_school)
  )
  or exists (
    select 1
    from public.app_school_email_domains domain
    where domain.school = target_school
      and (
        -- exact domain: student@uci.edu
        lower(coalesce(auth.jwt() ->> 'email', '')) like ('%@' || lower(domain.email_domain))
        -- departmental subdomain: student@ics.uci.edu
        or lower(coalesce(auth.jwt() ->> 'email', '')) like ('%.' || lower(domain.email_domain))
      )
  );
$$;

revoke all on function public.can_auth_email_use_school(text) from public;
grant execute on function public.can_auth_email_use_school(text) to authenticated;

-- 3. Make sure the lookup tables are readable by the policies ─────────────────
-- These are non-secret config tables; authenticated users need SELECT so the
-- (security definer) function and any client-side checks can read them.

alter table public.app_school_email_domains enable row level security;
alter table public.app_review_accounts enable row level security;

grant select on public.app_school_email_domains to authenticated;
grant select on public.app_review_accounts to authenticated;

drop policy if exists "Authenticated users can read school domains" on public.app_school_email_domains;
create policy "Authenticated users can read school domains"
on public.app_school_email_domains
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read review accounts" on public.app_review_accounts;
create policy "Authenticated users can read review accounts"
on public.app_review_accounts
for select
to authenticated
using (true);

-- 4. Verify ───────────────────────────────────────────────────────────────────
-- Expected: both tables return rows, and the profiles policies exist.

select 'app_school_email_domains' as table_name, count(*) as row_count from public.app_school_email_domains
union all
select 'app_review_accounts', count(*) from public.app_review_accounts;

select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'profiles'
order by cmd, policyname;

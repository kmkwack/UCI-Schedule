-- Public catalog metadata is non-user data used by the app to load terms and
-- departments quickly. Allow anon/authenticated clients to read it while seed
-- jobs continue writing through the service role.

alter table public.school_terms enable row level security;
alter table public.school_departments enable row level security;

grant select on public.school_terms to anon, authenticated;
grant select on public.school_departments to anon, authenticated;

drop policy if exists "Public can read school terms" on public.school_terms;
create policy "Public can read school terms"
  on public.school_terms
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can read school departments" on public.school_departments;
create policy "Public can read school departments"
  on public.school_departments
  for select
  to anon, authenticated
  using (true);

notify pgrst, 'reload schema';

alter table user_settings
add column if not exists expo_push_token text;

alter table user_settings
add column if not exists last_remote_notification_at timestamptz;

alter table user_settings enable row level security;

drop policy if exists "user_settings_select_support" on user_settings;
drop policy if exists "user_settings_update_support" on user_settings;

create policy "user_settings_select_support"
on user_settings
for select
to authenticated
using (
  auth.jwt() ->> 'email' in ('heyy.seans@gmail.com', 'hii.seans@gmail.com')
);

create policy "user_settings_update_support"
on user_settings
for update
to authenticated
using (
  auth.jwt() ->> 'email' in ('heyy.seans@gmail.com', 'hii.seans@gmail.com')
)
with check (
  auth.jwt() ->> 'email' in ('heyy.seans@gmail.com', 'hii.seans@gmail.com')
);

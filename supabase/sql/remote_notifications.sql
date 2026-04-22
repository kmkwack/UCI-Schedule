alter table user_settings
add column if not exists expo_push_token text;

alter table user_settings
add column if not exists last_remote_notification_at timestamptz;

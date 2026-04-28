# social-notifier

Supabase Edge Function that turns new social activity into:

- Expo push notifications
- Email notifications through Resend

It listens for inserts from:

- `friend_requests`
- `conversation_messages`
- `post_comments`
- `post_votes`
- `post_comment_votes`

## Required secrets

Set these in Supabase:

```bash
supabase secrets set RESEND_API_KEY=...
supabase secrets set NOTIFICATIONS_FROM_EMAIL="ClassMate <notifications@yourdomain.com>"
```

`SUPABASE_SERVICE_ROLE_KEY` is automatically available inside Supabase Edge Functions. Do not try to set it manually with `supabase secrets set`.

Optional:

```bash
supabase secrets set EXPO_ACCESS_TOKEN=...
```

## Deploy

```bash
supabase functions deploy social-notifier
```

## Webhook setup

Create database webhooks in the Supabase dashboard that call:

```text
https://<project-ref>.functions.supabase.co/social-notifier
```

Use `INSERT` events for these tables:

- `friend_requests`
- `conversation_messages`
- `post_comments`
- `post_votes`
- `post_comment_votes`

## SQL

Run the SQL in:

```text
supabase/sql/remote_notifications.sql
```

This file should only add the `expo_push_token` and `last_remote_notification_at` columns to `user_settings`.

## What the app stores

The mobile app saves:

- `user_settings.notification_settings`
- `user_settings.expo_push_token`

The function reads those settings to decide whether the recipient wants:

- push notifications
- email notifications
- friend request alerts
- comment/reply alerts
- like alerts
- message alerts

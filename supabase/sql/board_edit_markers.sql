-- Board edit markers.
-- Run this in the Supabase SQL editor so edited posts/comments can show "Edited" persistently.

alter table public.posts
  add column if not exists edited_at timestamptz;

alter table public.post_comments
  add column if not exists edited_at timestamptz;

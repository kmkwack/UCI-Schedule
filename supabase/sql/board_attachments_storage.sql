-- Board post attachments storage setup.
-- Run this once in the Supabase SQL editor for the ClassMate project.

alter table public.posts
  add column if not exists attachments jsonb not null default '[]'::jsonb;

alter table public.posts
  add column if not exists is_locked boolean not null default false;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'board-attachments',
  'board-attachments',
  true,
  10485760,
  array[
    'image/jpeg',
    'image/heic',
    'image/heif',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Board attachments are publicly readable" on storage.objects;
drop policy if exists "Users can upload board attachments" on storage.objects;
drop policy if exists "Users can update own board attachments" on storage.objects;
drop policy if exists "Users can delete own board attachments" on storage.objects;

create policy "Board attachments are publicly readable"
on storage.objects
for select
to public
using (bucket_id = 'board-attachments');

create policy "Users can upload board attachments"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'board-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update own board attachments"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'board-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'board-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own board attachments"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'board-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

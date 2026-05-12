-- Account deletion support for ClassMate.
-- Run this in the Supabase SQL editor before enabling in-app account deletion.

create or replace function public.delete_current_user()
returns void
language plpgsql
security definer
set search_path = public, storage, auth
as $$
declare
  uid uuid := auth.uid();
  uid_text text := auth.uid()::text;
  owned_post_ids uuid[];
  affected_comment_ids uuid[];
  owned_conversation_ids uuid[];
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

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

  if to_regclass('public.direct_messages') is not null then
    execute 'delete from public.direct_messages where sender_id::text = $1 or receiver_id::text = $1'
    using uid_text;
  end if;

  select coalesce(array_agg(conversation_id), '{}'::uuid[])
  into owned_conversation_ids
  from public.conversation_participants
  where user_id::text = uid_text;

  delete from public.conversation_messages
  where conversation_id = any(owned_conversation_ids);

  delete from public.conversation_participants
  where conversation_id = any(owned_conversation_ids);

  delete from public.conversations
  where id = any(owned_conversation_ids);

  delete from public.friend_requests
  where sender_id::text = uid_text
     or receiver_id::text = uid_text;

  delete from public.board_requests
  where requester_id::text = uid_text;

  delete from public.sports_event_comments
  where user_id::text = uid_text;

  delete from public.sports_event_rsvps
  where user_id::text = uid_text;

  delete from public.course_discord_links
  where submitted_by::text = uid_text;

  delete from public.user_settings
  where user_id::text = uid_text;

  delete from public.profiles
  where id::text = uid_text;

  delete from storage.objects
  where bucket_id = 'board-attachments'
    and (storage.foldername(name))[1] = uid_text;

  delete from auth.users
  where id = uid;
end;
$$;

grant execute on function public.delete_current_user() to authenticated;

-- School partitioning for social data.
-- Run this after the base friend/request/report/board-request tables exist.

alter table public.friend_requests
  add column if not exists school text not null default 'UC Irvine';

update public.friend_requests
   set school = 'UC Irvine'
 where school is null or btrim(school) = '';

alter table public.board_requests
  add column if not exists school text not null default 'UC Irvine';

update public.board_requests
   set school = 'UC Irvine'
 where school is null or btrim(school) = '';

alter table public.reports
  add column if not exists school text not null default 'UC Irvine';

update public.reports
   set school = 'UC Irvine'
 where school is null or btrim(school) = '';

alter table public.post_comments
  add column if not exists school text not null default 'UC Irvine';

update public.post_comments
   set school = 'UC Irvine'
 where school is null or btrim(school) = '';

alter table public.post_votes
  add column if not exists school text not null default 'UC Irvine';

update public.post_votes
   set school = 'UC Irvine'
 where school is null or btrim(school) = '';

alter table public.post_comment_votes
  add column if not exists school text not null default 'UC Irvine';

update public.post_comment_votes
   set school = 'UC Irvine'
 where school is null or btrim(school) = '';

alter table public.sports_event_rsvps
  add column if not exists school text not null default 'UC Irvine';

alter table public.sports_event_comments
  add column if not exists school text not null default 'UC Irvine';

alter table public.friend_requests
  drop constraint if exists friend_requests_sender_id_receiver_id_key;

alter table public.friend_requests
  drop constraint if exists friend_requests_sender_receiver_key;

alter table public.sports_event_rsvps
  drop constraint if exists sports_event_rsvps_event_id_user_id_key;

alter table public.sports_event_rsvps
  drop constraint if exists sports_event_rsvps_event_user_key;

alter table public.post_votes
  drop constraint if exists post_votes_post_id_user_id_key;

alter table public.post_votes
  drop constraint if exists post_votes_post_user_key;

alter table public.post_comment_votes
  drop constraint if exists post_comment_votes_comment_id_user_id_key;

alter table public.post_comment_votes
  drop constraint if exists post_comment_votes_comment_user_key;

create unique index if not exists friend_requests_school_sender_receiver_idx
  on public.friend_requests (school, sender_id, receiver_id);

create index if not exists friend_requests_school_receiver_status_idx
  on public.friend_requests (school, receiver_id, status, created_at desc);

create index if not exists friend_requests_school_sender_status_idx
  on public.friend_requests (school, sender_id, status, created_at desc);

create index if not exists board_requests_school_status_idx
  on public.board_requests (school, status, created_at desc);

create index if not exists reports_school_status_idx
  on public.reports (school, status, created_at desc);

create index if not exists post_comments_school_post_idx
  on public.post_comments (school, post_id, created_at);

create unique index if not exists post_votes_school_post_user_idx
  on public.post_votes (school, post_id, user_id);

create unique index if not exists post_comment_votes_school_comment_user_idx
  on public.post_comment_votes (school, comment_id, user_id);

create index if not exists sports_event_rsvps_school_event_idx
  on public.sports_event_rsvps (school, event_id);

create unique index if not exists sports_event_rsvps_school_event_user_idx
  on public.sports_event_rsvps (school, event_id, user_id);

create index if not exists sports_event_comments_school_event_idx
  on public.sports_event_comments (school, event_id, created_at);

notify pgrst, 'reload schema';

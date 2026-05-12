-- Production readiness P2: RLS, school isolation, account cleanup, and social data hardening.
-- Run after the base schema migrations, social_school_partitioning.sql, conversation_messages.sql,
-- course_discord_links.sql, sports_event_social.sql, board_attachments_storage.sql, and production_readiness_p0.sql.

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
  ('review@classmate.app', '*')
on conflict do nothing;

create table if not exists public.app_moderators (
  school text not null,
  email text not null,
  created_at timestamptz not null default now(),
  primary key (school, email)
);

insert into public.app_moderators (school, email) values
  ('UC Irvine', 'sihyup2@uci.edu'),
  ('UC Irvine', 'kwackk@uci.edu')
on conflict do nothing;

create or replace function public.current_user_school()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.school
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

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
      and lower(coalesce(auth.jwt() ->> 'email', '')) like ('%@' || lower(domain.email_domain))
  );
$$;

create or replace function public.is_same_school(target_school text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and target_school is not null
    and public.current_user_school() = target_school;
$$;

create or replace function public.is_school_moderator(target_school text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.app_moderators m
      on lower(m.email) = lower(p.email)
     and (m.school = '*' or m.school = target_school)
    where p.id = auth.uid()
      and p.school = target_school
  );
$$;

revoke all on function public.current_user_school() from public;
revoke all on function public.can_auth_email_use_school(text) from public;
revoke all on function public.is_same_school(text) from public;
revoke all on function public.is_school_moderator(text) from public;
grant execute on function public.current_user_school() to authenticated;
grant execute on function public.can_auth_email_use_school(text) to authenticated;
grant execute on function public.is_same_school(text) to authenticated;
grant execute on function public.is_school_moderator(text) to authenticated;

alter table public.app_school_email_domains enable row level security;
alter table public.app_review_accounts enable row level security;
alter table public.app_moderators enable row level security;

grant select on public.app_school_email_domains to authenticated;
grant select on public.app_review_accounts to authenticated;
grant select on public.app_moderators to authenticated;

drop policy if exists "Authenticated users can read school domains" on public.app_school_email_domains;
create policy "Authenticated users can read school domains"
on public.app_school_email_domains
for select
to authenticated
using (true);

drop policy if exists "Review accounts are internal" on public.app_review_accounts;
create policy "Review accounts are internal"
on public.app_review_accounts
for select
to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "Moderators can read moderator registry" on public.app_moderators;
create policy "Moderators can read moderator registry"
on public.app_moderators
for select
to authenticated
using (public.is_school_moderator(school));

-- Private account data.
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.timetables enable row level security;
alter table public.grades enable row level security;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;
grant select, insert, update, delete on public.timetables to authenticated;
grant select, insert, update, delete on public.grades to authenticated;

drop policy if exists "Same-school users can read profiles" on public.profiles;
create policy "Same-school users can read profiles"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or school = public.current_user_school()
);

drop policy if exists "Users can create own verified-school profile" on public.profiles;
create policy "Users can create own verified-school profile"
on public.profiles
for insert
to authenticated
with check (
  id = auth.uid()
  and public.can_auth_email_use_school(school)
);

drop policy if exists "Users can update own verified-school profile" on public.profiles;
create policy "Users can update own verified-school profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and public.can_auth_email_use_school(school)
);

drop policy if exists "Users can delete own profile" on public.profiles;
create policy "Users can delete own profile"
on public.profiles
for delete
to authenticated
using (id = auth.uid());

drop policy if exists "Users can manage own settings" on public.user_settings;
create policy "Users can manage own settings"
on public.user_settings
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.get_friend_timetable_visibility(friend_ids uuid[], target_school text)
returns table(user_id uuid, timetable_visibility text)
language sql
stable
security definer
set search_path = public
as $$
  select
    us.user_id,
    coalesce(us.timetable_visibility, 'friends') as timetable_visibility
  from public.user_settings us
  join public.profiles friend_profile
    on friend_profile.id = us.user_id
   and friend_profile.school = target_school
  where auth.uid() is not null
    and us.user_id = any(friend_ids)
    and exists (
      select 1
      from public.profiles requester
      where requester.id = auth.uid()
        and requester.school = target_school
    )
    and exists (
      select 1
      from public.friend_requests fr
      where fr.school = target_school
        and fr.status = 'accepted'
        and (
          (fr.sender_id = auth.uid() and fr.receiver_id = us.user_id)
          or (fr.receiver_id = auth.uid() and fr.sender_id = us.user_id)
        )
    );
$$;

revoke all on function public.get_friend_timetable_visibility(uuid[], text) from public;
grant execute on function public.get_friend_timetable_visibility(uuid[], text) to authenticated;

drop policy if exists "Users and accepted friends can read timetables" on public.timetables;
create policy "Users and accepted friends can read timetables"
on public.timetables
for select
to authenticated
using (
  user_id = auth.uid()
  or (
    school = public.current_user_school()
    and exists (
      select 1
      from public.friend_requests fr
      where fr.school = timetables.school
        and fr.status = 'accepted'
        and (
          (fr.sender_id = auth.uid() and fr.receiver_id = timetables.user_id)
          or (fr.receiver_id = auth.uid() and fr.sender_id = timetables.user_id)
        )
    )
    and coalesce((
      select us.timetable_visibility
      from public.user_settings us
      where us.user_id = timetables.user_id
      limit 1
    ), 'friends') <> 'private'
  )
);

drop policy if exists "Users can insert own same-school timetables" on public.timetables;
create policy "Users can insert own same-school timetables"
on public.timetables
for insert
to authenticated
with check (
  user_id = auth.uid()
  and school = public.current_user_school()
);

drop policy if exists "Users can update own same-school timetables" on public.timetables;
create policy "Users can update own same-school timetables"
on public.timetables
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and school = public.current_user_school()
);

drop policy if exists "Users can delete own timetables" on public.timetables;
create policy "Users can delete own timetables"
on public.timetables
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can manage own grades" on public.grades;
create policy "Users can manage own grades"
on public.grades
for all
to authenticated
using (
  user_id = auth.uid()
  and school = public.current_user_school()
)
with check (
  user_id = auth.uid()
  and school = public.current_user_school()
);

-- Public course catalog metadata. Service-role seed jobs bypass RLS for writes.
alter table public.sections enable row level security;
alter table public.school_terms enable row level security;
alter table public.school_departments enable row level security;
alter table public.section_source_payloads enable row level security;

grant select on public.sections to anon, authenticated;
grant select on public.school_terms to anon, authenticated;
grant select on public.school_departments to anon, authenticated;

drop policy if exists "Public can read sections" on public.sections;
create policy "Public can read sections"
on public.sections
for select
to anon, authenticated
using (true);

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

-- Board, moderation, and voting.
alter table public.boards enable row level security;
alter table public.posts enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_votes enable row level security;
alter table public.post_comment_votes enable row level security;
alter table public.reports enable row level security;
alter table public.board_requests enable row level security;

grant select, insert, update, delete on public.boards to authenticated;
grant select, insert, update, delete on public.posts to authenticated;
grant select, insert, update, delete on public.post_comments to authenticated;
grant select, insert, update, delete on public.post_votes to authenticated;
grant select, insert, update, delete on public.post_comment_votes to authenticated;
grant select, insert, update, delete on public.reports to authenticated;
grant select, insert, update, delete on public.board_requests to authenticated;

drop policy if exists "Same-school users can read boards" on public.boards;
create policy "Same-school users can read boards"
on public.boards
for select
to authenticated
using (public.is_same_school(school));

drop policy if exists "Moderators can manage boards" on public.boards;
create policy "Moderators can manage boards"
on public.boards
for all
to authenticated
using (public.is_school_moderator(school))
with check (public.is_school_moderator(school));

drop policy if exists "Same-school users can read posts" on public.posts;
create policy "Same-school users can read posts"
on public.posts
for select
to authenticated
using (public.is_same_school(school));

drop policy if exists "Users can create own same-school posts" on public.posts;
create policy "Users can create own same-school posts"
on public.posts
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_same_school(school)
);

drop policy if exists "Users can update own same-school posts" on public.posts;
create policy "Users can update own same-school posts"
on public.posts
for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_same_school(school)
)
with check (
  user_id = auth.uid()
  and public.is_same_school(school)
);

drop policy if exists "Users can delete own same-school posts" on public.posts;
create policy "Users can delete own same-school posts"
on public.posts
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.is_same_school(school)
);

drop policy if exists "Same-school users can read comments" on public.post_comments;
create policy "Same-school users can read comments"
on public.post_comments
for select
to authenticated
using (public.is_same_school(school));

drop policy if exists "Users can create own same-school comments" on public.post_comments;
create policy "Users can create own same-school comments"
on public.post_comments
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_same_school(school)
  and exists (
    select 1
    from public.posts post
    where post.id = post_comments.post_id
      and post.school = post_comments.school
  )
);

drop policy if exists "Users can update own same-school comments" on public.post_comments;
create policy "Users can update own same-school comments"
on public.post_comments
for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_same_school(school)
)
with check (
  user_id = auth.uid()
  and public.is_same_school(school)
);

drop policy if exists "Users can delete own same-school comments" on public.post_comments;
create policy "Users can delete own same-school comments"
on public.post_comments
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.is_same_school(school)
);

drop policy if exists "Same-school users can read post votes" on public.post_votes;
create policy "Same-school users can read post votes"
on public.post_votes
for select
to authenticated
using (public.is_same_school(school));

drop policy if exists "Users can create own same-school post votes" on public.post_votes;
create policy "Users can create own same-school post votes"
on public.post_votes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_same_school(school)
  and exists (
    select 1
    from public.posts post
    where post.id = post_votes.post_id
      and post.school = post_votes.school
  )
);

drop policy if exists "Users can delete own same-school post votes" on public.post_votes;
create policy "Users can delete own same-school post votes"
on public.post_votes
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.is_same_school(school)
);

drop policy if exists "Same-school users can read comment votes" on public.post_comment_votes;
create policy "Same-school users can read comment votes"
on public.post_comment_votes
for select
to authenticated
using (public.is_same_school(school));

drop policy if exists "Users can create own same-school comment votes" on public.post_comment_votes;
create policy "Users can create own same-school comment votes"
on public.post_comment_votes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_same_school(school)
  and exists (
    select 1
    from public.post_comments comment
    where comment.id = post_comment_votes.comment_id
      and comment.school = post_comment_votes.school
  )
);

drop policy if exists "Users can delete own same-school comment votes" on public.post_comment_votes;
create policy "Users can delete own same-school comment votes"
on public.post_comment_votes
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.is_same_school(school)
);

drop policy if exists "Users can create same-school reports" on public.reports;
create policy "Users can create same-school reports"
on public.reports
for insert
to authenticated
with check (
  reporter_id = auth.uid()
  and public.is_same_school(school)
);

drop policy if exists "Moderators can read reports" on public.reports;
create policy "Moderators can read reports"
on public.reports
for select
to authenticated
using (public.is_school_moderator(school));

drop policy if exists "Moderators can update reports" on public.reports;
create policy "Moderators can update reports"
on public.reports
for update
to authenticated
using (public.is_school_moderator(school))
with check (public.is_school_moderator(school));

drop policy if exists "Users can create same-school board requests" on public.board_requests;
create policy "Users can create same-school board requests"
on public.board_requests
for insert
to authenticated
with check (
  requester_id = auth.uid()
  and public.is_same_school(school)
);

drop policy if exists "Moderators can read board requests" on public.board_requests;
create policy "Moderators can read board requests"
on public.board_requests
for select
to authenticated
using (public.is_school_moderator(school));

drop policy if exists "Moderators can update board requests" on public.board_requests;
create policy "Moderators can update board requests"
on public.board_requests
for update
to authenticated
using (public.is_school_moderator(school))
with check (public.is_school_moderator(school));

-- Friend graph.
alter table public.friend_requests enable row level security;
grant select, insert, update, delete on public.friend_requests to authenticated;

drop policy if exists "Friend request participants can read" on public.friend_requests;
create policy "Friend request participants can read"
on public.friend_requests
for select
to authenticated
using (
  public.is_same_school(school)
  and (sender_id = auth.uid() or receiver_id = auth.uid())
);

drop policy if exists "Users can create same-school friend requests" on public.friend_requests;
create policy "Users can create same-school friend requests"
on public.friend_requests
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.is_same_school(school)
  and exists (
    select 1
    from public.profiles target
    where target.id = friend_requests.receiver_id
      and target.school = friend_requests.school
  )
);

drop policy if exists "Friend request participants can update" on public.friend_requests;
create policy "Friend request participants can update"
on public.friend_requests
for update
to authenticated
using (
  public.is_same_school(school)
  and (sender_id = auth.uid() or receiver_id = auth.uid())
)
with check (
  public.is_same_school(school)
  and (sender_id = auth.uid() or receiver_id = auth.uid())
);

drop policy if exists "Friend request participants can delete" on public.friend_requests;
create policy "Friend request participants can delete"
on public.friend_requests
for delete
to authenticated
using (
  public.is_same_school(school)
  and (sender_id = auth.uid() or receiver_id = auth.uid())
);

-- Conversations/messages: participant-only plus same-school RPC enforcement.
drop policy if exists "Participants can read conversations" on public.conversations;
create policy "Participants can read conversations"
on public.conversations
for select
to authenticated
using (
  school = public.current_user_school()
  and public.is_conversation_participant(conversations.id)
);

drop policy if exists "Participants can read participant rows" on public.conversation_participants;
create policy "Participants can read participant rows"
on public.conversation_participants
for select
to authenticated
using (
  public.is_conversation_participant(conversation_participants.conversation_id)
  and exists (
    select 1
    from public.conversations conversation
    where conversation.id = conversation_participants.conversation_id
      and conversation.school = public.current_user_school()
  )
);

drop policy if exists "Participants can update their own read state" on public.conversation_participants;
create policy "Participants can update their own read state"
on public.conversation_participants
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.conversations conversation
    where conversation.id = conversation_participants.conversation_id
      and conversation.school = public.current_user_school()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.conversations conversation
    where conversation.id = conversation_participants.conversation_id
      and conversation.school = public.current_user_school()
  )
);

drop policy if exists "Participants can read messages" on public.conversation_messages;
create policy "Participants can read messages"
on public.conversation_messages
for select
to authenticated
using (
  public.is_conversation_participant(conversation_messages.conversation_id)
  and exists (
    select 1
    from public.conversations conversation
    where conversation.id = conversation_messages.conversation_id
      and conversation.school = public.current_user_school()
  )
);

drop policy if exists "Participants can send messages" on public.conversation_messages;
create policy "Participants can send messages"
on public.conversation_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.is_conversation_participant(conversation_messages.conversation_id)
  and exists (
    select 1
    from public.conversations conversation
    where conversation.id = conversation_messages.conversation_id
      and conversation.school = public.current_user_school()
  )
  and not exists (
    select 1
    from public.conversation_participants participant
    where participant.conversation_id = conversation_messages.conversation_id
      and participant.user_id = auth.uid()
      and participant.blocked_at is not null
  )
);

drop policy if exists "Senders can soft-delete messages" on public.conversation_messages;
create policy "Senders can soft-delete messages"
on public.conversation_messages
for update
to authenticated
using (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.conversations conversation
    where conversation.id = conversation_messages.conversation_id
      and conversation.school = public.current_user_school()
  )
)
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.conversations conversation
    where conversation.id = conversation_messages.conversation_id
      and conversation.school = public.current_user_school()
  )
);

create or replace function public.get_or_create_conversation(
  p_target_user_id uuid,
  p_conversation_kind text,
  p_source_post_id uuid default null,
  p_conversation_school text default 'UC Irvine'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_conversation_id uuid;
  created_conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_target_user_id is null or p_target_user_id = current_user_id then
    raise exception 'Invalid chat target';
  end if;

  if p_conversation_kind not in ('friend', 'board_anonymous') then
    raise exception 'Invalid conversation kind';
  end if;

  if not exists (
    select 1
    from public.profiles requester
    join public.profiles target on target.id = p_target_user_id
    where requester.id = current_user_id
      and requester.school = p_conversation_school
      and target.school = p_conversation_school
  ) then
    raise exception 'Chat participants must belong to the conversation school';
  end if;

  if p_conversation_kind = 'friend' then
    if not exists (
      select 1
      from public.friend_requests
      where school = p_conversation_school
        and status = 'accepted'
        and (
          (sender_id = current_user_id and receiver_id = p_target_user_id)
          or (sender_id = p_target_user_id and receiver_id = current_user_id)
        )
    ) then
      raise exception 'Friend chat requires an accepted ClassMate connection';
    end if;
  end if;

  if p_conversation_kind = 'board_anonymous' then
    if p_source_post_id is null then
      raise exception 'Anonymous board chats require a source post';
    end if;

    if not exists (
      select 1
      from public.posts post
      where post.id = p_source_post_id
        and post.school = p_conversation_school
        and (
          post.user_id = p_target_user_id
          or exists (
            select 1
            from public.post_comments comment
            where comment.post_id = post.id
              and comment.school = post.school
              and comment.user_id = p_target_user_id
          )
        )
    ) then
      raise exception 'Anonymous board chat target is not part of this post';
    end if;
  end if;

  select conversation.id
  into existing_conversation_id
  from public.conversations conversation
  where conversation.school = p_conversation_school
    and conversation.kind = p_conversation_kind
    and (
      p_conversation_kind = 'friend'
      or conversation.source_post_id is not distinct from p_source_post_id
    )
    and exists (
      select 1
      from public.conversation_participants participant
      where participant.conversation_id = conversation.id
        and participant.user_id = current_user_id
    )
    and exists (
      select 1
      from public.conversation_participants participant
      where participant.conversation_id = conversation.id
        and participant.user_id = p_target_user_id
    )
  order by conversation.updated_at desc
  limit 1;

  if existing_conversation_id is not null then
    return existing_conversation_id;
  end if;

  insert into public.conversations (school, kind, source_post_id)
  values (
    p_conversation_school,
    p_conversation_kind,
    case when p_conversation_kind = 'board_anonymous' then p_source_post_id else null end
  )
  returning id into created_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id, display_mode)
  values
    (
      created_conversation_id,
      current_user_id,
      case when p_conversation_kind = 'friend' then 'real' else 'anonymous' end
    ),
    (
      created_conversation_id,
      p_target_user_id,
      case when p_conversation_kind = 'friend' then 'real' else 'anonymous' end
    );

  return created_conversation_id;
end;
$$;

grant execute on function public.get_or_create_conversation(uuid, text, uuid, text) to authenticated;

-- Course resources and sports social rows.
alter table public.course_discord_links enable row level security;
alter table public.sports_event_rsvps enable row level security;
alter table public.sports_event_comments enable row level security;

grant select, insert, update, delete on public.course_discord_links to authenticated;
grant select, insert, update, delete on public.sports_event_rsvps to authenticated;
grant select, insert, delete on public.sports_event_comments to authenticated;

drop policy if exists "Authenticated users can read course Discord links" on public.course_discord_links;
drop policy if exists "Same-school users can read course Discord links" on public.course_discord_links;
create policy "Same-school users can read course Discord links"
on public.course_discord_links
for select
to authenticated
using (public.is_same_school(school));

drop policy if exists "Users can submit course Discord links" on public.course_discord_links;
create policy "Users can submit course Discord links"
on public.course_discord_links
for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and public.is_same_school(school)
  and discord_url ~* '^https://discord\.gg/[A-Za-z0-9-]+$'
);

drop policy if exists "Submitters can update course Discord links" on public.course_discord_links;
create policy "Submitters can update course Discord links"
on public.course_discord_links
for update
to authenticated
using (
  submitted_by = auth.uid()
  and public.is_same_school(school)
)
with check (
  submitted_by = auth.uid()
  and public.is_same_school(school)
  and discord_url ~* '^https://discord\.gg/[A-Za-z0-9-]+$'
);

drop policy if exists "Submitters can delete course Discord links" on public.course_discord_links;
create policy "Submitters can delete course Discord links"
on public.course_discord_links
for delete
to authenticated
using (
  submitted_by = auth.uid()
  and public.is_same_school(school)
);

drop policy if exists "Authenticated users can read sports event RSVPs" on public.sports_event_rsvps;
drop policy if exists "Same-school users can read sports event RSVPs" on public.sports_event_rsvps;
create policy "Same-school users can read sports event RSVPs"
on public.sports_event_rsvps
for select
to authenticated
using (public.is_same_school(school));

drop policy if exists "Users can upsert their own sports event RSVP" on public.sports_event_rsvps;
create policy "Users can upsert their own sports event RSVP"
on public.sports_event_rsvps
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_same_school(school)
);

drop policy if exists "Users can update their own sports event RSVP" on public.sports_event_rsvps;
create policy "Users can update their own sports event RSVP"
on public.sports_event_rsvps
for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_same_school(school)
)
with check (
  user_id = auth.uid()
  and public.is_same_school(school)
);

drop policy if exists "Users can delete their own sports event RSVP" on public.sports_event_rsvps;
create policy "Users can delete their own sports event RSVP"
on public.sports_event_rsvps
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.is_same_school(school)
);

drop policy if exists "Authenticated users can read sports event comments" on public.sports_event_comments;
drop policy if exists "Same-school users can read sports event comments" on public.sports_event_comments;
create policy "Same-school users can read sports event comments"
on public.sports_event_comments
for select
to authenticated
using (public.is_same_school(school));

drop policy if exists "Users can create their own sports event comments" on public.sports_event_comments;
create policy "Users can create their own sports event comments"
on public.sports_event_comments
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_same_school(school)
);

drop policy if exists "Users can delete their own sports event comments" on public.sports_event_comments;
create policy "Users can delete their own sports event comments"
on public.sports_event_comments
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.is_same_school(school)
);

-- Course reviews are public within a school; only the author can write their row.
alter table public.reviews enable row level security;
grant select, insert, update, delete on public.reviews to authenticated;

drop policy if exists "Same-school users can read reviews" on public.reviews;
create policy "Same-school users can read reviews"
on public.reviews
for select
to authenticated
using (public.is_same_school(school));

drop policy if exists "Users can create own same-school reviews" on public.reviews;
create policy "Users can create own same-school reviews"
on public.reviews
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_same_school(school)
);

drop policy if exists "Users can update own same-school reviews" on public.reviews;
create policy "Users can update own same-school reviews"
on public.reviews
for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_same_school(school)
)
with check (
  user_id = auth.uid()
  and public.is_same_school(school)
);

drop policy if exists "Users can delete own same-school reviews" on public.reviews;
create policy "Users can delete own same-school reviews"
on public.reviews
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.is_same_school(school)
);

-- Storage: public read is intentional for public board posts, but writes/deletes stay confined to the user's folder.
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
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read board attachments" on storage.objects;
create policy "Public can read board attachments"
on storage.objects
for select
to public
using (bucket_id = 'board-attachments');

drop policy if exists "Users can upload board attachments to their folder" on storage.objects;
create policy "Users can upload board attachments to their folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'board-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update their own board attachments" on storage.objects;
create policy "Users can update their own board attachments"
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

drop policy if exists "Users can delete their own board attachments" on storage.objects;
create policy "Users can delete their own board attachments"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'board-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Account deletion RPC with newer social tables and storage metadata cleanup.
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
  where user_id = uid;

  select coalesce(array_agg(id), '{}'::uuid[])
  into affected_comment_ids
  from public.post_comments
  where user_id = uid
     or post_id = any(owned_post_ids);

  delete from public.post_comment_votes
  where user_id = uid
     or comment_id = any(affected_comment_ids);

  delete from public.post_votes
  where user_id = uid
     or post_id = any(owned_post_ids);

  delete from public.reports
  where reporter_id = uid;

  delete from public.post_comments
  where id = any(affected_comment_ids);

  delete from public.posts
  where id = any(owned_post_ids);

  delete from public.reviews
  where user_id = uid;

  delete from public.grades
  where user_id = uid;

  delete from public.timetables
  where user_id = uid;

  if to_regclass('public.direct_messages') is not null then
    execute 'delete from public.direct_messages where sender_id::text = $1 or receiver_id::text = $1'
    using uid_text;
  end if;

  select coalesce(array_agg(conversation_id), '{}'::uuid[])
  into owned_conversation_ids
  from public.conversation_participants
  where user_id = uid;

  delete from public.conversation_messages
  where conversation_id = any(owned_conversation_ids);

  delete from public.conversation_participants
  where conversation_id = any(owned_conversation_ids);

  delete from public.conversations
  where id = any(owned_conversation_ids);

  delete from public.friend_requests
  where sender_id = uid
     or receiver_id = uid;

  delete from public.board_requests
  where requester_id = uid;

  delete from public.sports_event_comments
  where user_id = uid;

  delete from public.sports_event_rsvps
  where user_id = uid;

  delete from public.course_discord_links
  where submitted_by = uid;

  delete from public.user_settings
  where user_id = uid;

  delete from public.profiles
  where id = uid;

  delete from storage.objects
  where bucket_id = 'board-attachments'
    and (storage.foldername(name))[1] = uid_text;

  delete from auth.users
  where id = uid;
end;
$$;

grant execute on function public.delete_current_user() to authenticated;

notify pgrst, 'reload schema';

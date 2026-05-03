-- Conversation-based chat support for ClassMate.
-- Run this in the Supabase SQL editor before enabling the new Messages UI.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  school text not null default 'UC Irvine',
  kind text not null check (kind in ('friend', 'board_anonymous')),
  source_post_id uuid references public.posts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversations drop constraint if exists conversations_kind_check;
alter table public.conversations
  add constraint conversations_kind_check
  check (kind in ('friend', 'board_anonymous'));

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_mode text not null check (display_mode in ('real', 'anonymous')),
  alias_snapshot text,
  last_read_at timestamptz,
  muted_at timestamptz,
  blocked_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) > 0 and char_length(content) <= 2000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists conversations_school_updated_idx
  on public.conversations (school, updated_at desc);

create index if not exists conversations_kind_source_idx
  on public.conversations (kind, source_post_id);

drop index if exists public.conversations_course_key_idx;
drop index if exists public.conversations_unique_course_idx;

create index if not exists conversation_participants_user_idx
  on public.conversation_participants (user_id, conversation_id);

create index if not exists conversation_messages_conversation_created_idx
  on public.conversation_messages (conversation_id, created_at desc);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.conversation_messages enable row level security;

do $$
begin
  alter publication supabase_realtime add table public.conversation_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.conversation_participants;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants participant
    where participant.conversation_id = p_conversation_id
      and participant.user_id = auth.uid()
  );
$$;

grant execute on function public.is_conversation_participant(uuid) to authenticated;

drop policy if exists "Participants can read conversations" on public.conversations;
create policy "Participants can read conversations"
on public.conversations
for select
using (public.is_conversation_participant(conversations.id));

drop policy if exists "Conversation creation is handled by RPC" on public.conversations;
create policy "Conversation creation is handled by RPC"
on public.conversations
for insert
with check (false);

drop policy if exists "Participants can update conversation timestamp" on public.conversations;

drop policy if exists "Participants can read participant rows" on public.conversation_participants;
create policy "Participants can read participant rows"
on public.conversation_participants
for select
using (public.is_conversation_participant(conversation_participants.conversation_id));

drop policy if exists "Participant creation is handled by RPC" on public.conversation_participants;
create policy "Participant creation is handled by RPC"
on public.conversation_participants
for insert
with check (false);

drop policy if exists "Participants can update their own read state" on public.conversation_participants;
create policy "Participants can update their own read state"
on public.conversation_participants
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Participants can read messages" on public.conversation_messages;
create policy "Participants can read messages"
on public.conversation_messages
for select
using (public.is_conversation_participant(conversation_messages.conversation_id));

drop policy if exists "Participants can send messages" on public.conversation_messages;
create policy "Participants can send messages"
on public.conversation_messages
for insert
with check (
  sender_id = auth.uid()
  and public.is_conversation_participant(conversation_messages.conversation_id)
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
using (sender_id = auth.uid())
with check (sender_id = auth.uid());

create or replace function public.touch_conversation_after_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
     set updated_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists conversation_messages_touch_conversation on public.conversation_messages;
create trigger conversation_messages_touch_conversation
after insert on public.conversation_messages
for each row
execute function public.touch_conversation_after_message();

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

  if not exists (select 1 from public.profiles where id = p_target_user_id) then
    raise exception 'Chat target does not exist';
  end if;

  if p_conversation_kind = 'friend' then
    if not exists (
      select 1
      from public.friend_requests
      where school = p_conversation_school
        and status = 'accepted'
        and (
          (sender_id::text = current_user_id::text and receiver_id::text = p_target_user_id::text)
          or (sender_id::text = p_target_user_id::text and receiver_id::text = current_user_id::text)
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
          post.user_id::text = p_target_user_id::text
          or exists (
            select 1
            from public.post_comments comment
            where comment.post_id = post.id
              and comment.user_id::text = p_target_user_id::text
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

drop function if exists public.get_or_create_course_conversation(text, text, text, text, text);

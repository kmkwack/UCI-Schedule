-- Repair board comment tables after adding school-scoped board data.
-- This keeps comments, post likes, and comment likes aligned with posts.school.

alter table public.post_comments
  add column if not exists school text not null default 'UC Irvine';

alter table public.post_votes
  add column if not exists school text not null default 'UC Irvine';

alter table public.post_comment_votes
  add column if not exists school text not null default 'UC Irvine';

update public.post_comments comment
   set school = post.school
  from public.posts post
 where comment.post_id = post.id
   and (comment.school is null or comment.school <> post.school);

update public.post_votes vote
   set school = post.school
  from public.posts post
 where vote.post_id = post.id
   and (vote.school is null or vote.school <> post.school);

update public.post_comment_votes vote
   set school = comment.school
  from public.post_comments comment
 where vote.comment_id = comment.id
   and (vote.school is null or vote.school <> comment.school);

alter table public.post_votes
  drop constraint if exists post_votes_post_id_user_id_key;

alter table public.post_votes
  drop constraint if exists post_votes_post_user_key;

alter table public.post_comment_votes
  drop constraint if exists post_comment_votes_comment_id_user_id_key;

alter table public.post_comment_votes
  drop constraint if exists post_comment_votes_comment_user_key;

create index if not exists post_comments_school_post_idx
  on public.post_comments (school, post_id, created_at);

create unique index if not exists post_votes_school_post_user_idx
  on public.post_votes (school, post_id, user_id);

create unique index if not exists post_comment_votes_school_comment_user_idx
  on public.post_comment_votes (school, comment_id, user_id);

grant select, insert, update, delete on public.post_comments to authenticated;
grant select, insert, delete on public.post_votes to authenticated;
grant select, insert, delete on public.post_comment_votes to authenticated;

drop policy if exists post_comments_update_own on public.post_comments;
create policy post_comments_update_own
on public.post_comments
for update
to authenticated
using (auth.uid()::text = user_id::text)
with check (auth.uid()::text = user_id::text);

drop policy if exists post_comments_delete_own on public.post_comments;
create policy post_comments_delete_own
on public.post_comments
for delete
to authenticated
using (auth.uid()::text = user_id::text);

create or replace function public.delete_own_comment(target_comment_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_comment public.post_comments%rowtype;
begin
  select *
    into target_comment
    from public.post_comments
   where id::text = target_comment_id
     and user_id::text = auth.uid()::text
   limit 1;

  if not found then
    raise exception 'Comment not found or not owned by current user';
  end if;

  update public.post_comments
     set parent_comment_id = target_comment.parent_comment_id
   where school = target_comment.school
     and parent_comment_id::text = target_comment_id;

  delete from public.post_comment_votes
   where school = target_comment.school
     and comment_id::text = target_comment_id;

  delete from public.post_comments
   where school = target_comment.school
     and id::text = target_comment_id
     and user_id::text = auth.uid()::text;
end;
$$;

grant execute on function public.delete_own_comment(text) to authenticated;

notify pgrst, 'reload schema';

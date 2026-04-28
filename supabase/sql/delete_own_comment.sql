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
   where parent_comment_id::text = target_comment_id;

  delete from public.post_comment_votes
   where comment_id::text = target_comment_id;

  delete from public.post_comments
   where id::text = target_comment_id
     and user_id::text = auth.uid()::text;
end;
$$;

grant execute on function public.delete_own_comment(text) to authenticated;

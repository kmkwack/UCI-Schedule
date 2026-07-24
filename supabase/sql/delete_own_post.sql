-- ============================================================================
-- delete_own_post(target_post_id) — atomic post deletion (2026-07-25)
--
-- WHY: BoardScreen.handleDeletePost deleted a post's comment-votes, comments,
-- and post-votes in separate requests BEFORE deleting the post row, checking
-- only the final delete for errors. A failure partway through (network drop /
-- RLS) could permanently wipe a post's comments and likes while leaving the post
-- itself on the board. A plpgsql function runs in a single transaction, so this
-- is all-or-nothing — no partial deletion is possible.
--
-- Mirrors the existing delete_own_comment() pattern (SECURITY DEFINER + explicit
-- ownership check inside). Ownership is verified against auth.uid(), so a user
-- can only delete their own post.
--
-- HOW TO RUN: paste into Supabase Dashboard → SQL Editor and run once. Safe to
-- re-run (create or replace).
--
-- NOTE: this deletes DB rows only. Storage attachments are still removed
-- client-side in handleDeletePost after the RPC succeeds.
-- ============================================================================

create or replace function public.delete_own_post(target_post_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Authorization: the caller must own the post (posts.user_id is TEXT).
  if not exists (
    select 1 from public.posts
    where id = target_post_id and user_id = auth.uid()::text
  ) then
    raise exception 'Post not found or not owned by current user';
  end if;

  -- Children first (respects any FK ordering), then the post — all in one
  -- transaction, so it either fully succeeds or fully rolls back.
  delete from public.post_comment_votes
    where comment_id in (select id from public.post_comments where post_id = target_post_id);
  delete from public.post_votes    where post_id = target_post_id;
  delete from public.post_comments where post_id = target_post_id;
  delete from public.posts         where id = target_post_id and user_id = auth.uid()::text;
end;
$$;

grant execute on function public.delete_own_post(uuid) to authenticated;

-- Remove empty chat rows created by older builds that opened a conversation
-- before the first message was sent. Participant rows are deleted by cascade.
delete from public.conversations as conversation
where not exists (
  select 1
  from public.conversation_messages as message
  where message.conversation_id = conversation.id
);

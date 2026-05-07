export type ChatKind = 'friend' | 'board_anonymous';

export type ChatTarget = {
  id: string;
  kind: ChatKind;
  name?: string;
  conversationId?: string;
  sourcePostId?: string | null;
  sourceLabel?: string | null;
};

export type ConversationRow = {
  id: string;
  school: string;
  kind: ChatKind;
  source_post_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationParticipantRow = {
  conversation_id: string;
  user_id: string;
  display_mode: 'real' | 'anonymous';
  alias_snapshot: string | null;
  last_read_at: string | null;
};

export type ConversationMessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  deleted_at: string | null;
};

export function formatMessageTime(isoString: string) {
  const date = new Date(isoString);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
